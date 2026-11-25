using System.Management;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Polls WMI for USB disks, built-in SD cards and USB phones/cameras; a new one opens a session, a vanished one closes it.
// Device-change events trigger an immediate scan so an unapproved disk is blocked right after it mounts.
public sealed partial class UsbMonitor : BackgroundService
{
    // Phones need a Win32_PnPEntity scan, far heavier than the disk query; between device events it runs every N polls.
    private const int PhoneScanEvery = 5;
    private const string PhonePrefix = "phone|";
    private const string BlockedPrefix = "blocked|";

    private readonly EventQueue _queue;
    private readonly PolicyStore _policy;
    private readonly AgentOptions _options;
    private readonly ILogger<UsbMonitor> _logger;
    private readonly Dictionary<string, Tracked> _sessions = new();
    private readonly Dictionary<string, UsbIdentity?> _identities = new();
    private readonly string _activeSessionsPath;
    private readonly string _lockedPath;
    private readonly HashSet<string> _locked;
    private readonly string _blockedPath;
    private readonly Dictionary<string, BlockedDisk> _blocked;
    private readonly CopyInMonitor _copyIn;
    private readonly SemaphoreSlim _deviceChanged = new(0, 1);
    private int _appliedRevision = -1;
    private bool _reevaluationPending;
    private int _tick;

    private sealed record UsbIdentity(string VendorId, string ProductId, string Serial)
    {
        public string Key => $"{VendorId}|{ProductId}|{Serial}".ToUpperInvariant();
    }

    // Letter is "" for a disk this agent disabled: it is still plugged in but has no volume any more.
    private sealed record UsbDrive(string Letter, string? Label, long? Capacity, string? Model, UsbIdentity Identity, uint DiskIndex,
        string PnpId, bool SharedSerial);

    private sealed record Phone(string? Name, string DeviceClass, UsbIdentity Identity);

    private sealed class Tracked
    {
        public required Guid SessionId { get; init; }
        public UsbDrive? Drive { get; init; }
        public DriveSession? Watcher { get; set; }
        public int? PolicyResult { get; set; }
        // Set while a block waits for open files to close; after BlockGrace the volume is locked anyway.
        public DateTime? BlockDeferredSince { get; set; }
        public bool Disabled => Drive?.Letter.Length == 0;
    }

    private static readonly TimeSpan BlockGrace = TimeSpan.FromMinutes(1);

    public UsbMonitor(EventQueue queue, PolicyStore policy, IOptions<AgentOptions> options, ILogger<UsbMonitor> logger)
    {
        _queue = queue;
        _policy = policy;
        _options = options.Value;
        _logger = logger;
        var dataDir = _options.ResolveDataDir();
        _activeSessionsPath = Path.Combine(dataDir, "active-sessions.txt");
        _lockedPath = Path.Combine(dataDir, "locked-disks.txt");
        _locked = File.Exists(_lockedPath) ? File.ReadAllLines(_lockedPath).Where(x => x.Length > 0).ToHashSet() : new HashSet<string>();
        _blockedPath = BlockedPathIn(dataDir);
        _blocked = LoadBlocked(_blockedPath).ToDictionary(b => b.PnpId, StringComparer.OrdinalIgnoreCase);
        _copyIn = new CopyInMonitor(queue, logger);
    }

    public static string BlockedPathIn(string dataDir) => Path.Combine(dataDir, "blocked-disks.json");

    public static List<BlockedDisk> LoadBlocked(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize(File.ReadAllText(path), AgentJson.Default.ListBlockedDisk) ?? new() : new();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return new();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Keep the first (slow) WMI scan off the host startup path.
        await Task.Yield();
        _logger.LogInformation("YevUsbAgent {Version} started", typeof(UsbMonitor).Assembly.GetName().Version);

        CloseStaleSessions();
        using var watcher = StartDeviceWatcher();

        var deviceEvent = true;
        while (!stoppingToken.IsCancellationRequested)
        {
            try { Refresh(scanPhones: deviceEvent || _tick++ % PhoneScanEvery == 0); }
            catch (Exception ex) { _logger.LogError(ex, "USB scan failed."); }

            try { deviceEvent = await _deviceChanged.WaitAsync(TimeSpan.FromSeconds(_options.PollSeconds), stoppingToken); }
            catch (OperationCanceledException) { }
        }

        _copyIn.Dispose();
        foreach (var key in _sessions.Keys.ToList()) Close(key);
    }

    private ManagementEventWatcher? StartDeviceWatcher()
    {
        try
        {
            var watcher = new ManagementEventWatcher("SELECT * FROM Win32_DeviceChangeEvent");
            watcher.EventArrived += (_, _) =>
            {
                try { _deviceChanged.Release(); }
                catch (SemaphoreFullException) { }
            };
            watcher.Start();
            return watcher;
        }
        catch (Exception ex) when (ex is ManagementException or UnauthorizedAccessException)
        {
            _logger.LogWarning("Device-change events unavailable ({Message}); polling only.", ex.Message);
            return null;
        }
    }

    // Sessions still open when the agent last died (power loss, crash) never got their Disconnected event;
    // close them now so the server does not show them as plugged in forever. The unplug time is the restart time.
    private void CloseStaleSessions()
    {
        try
        {
            if (!File.Exists(_activeSessionsPath)) return;

            foreach (var line in File.ReadAllLines(_activeSessionsPath))
            {
                if (Guid.TryParse(line, out var sessionId))
                    _queue.Enqueue(new AgentEvent { Type = EventTypes.Disconnected, SessionId = sessionId });
            }
            File.WriteAllText(_activeSessionsPath, "");
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "Could not recover stale sessions.");
        }
    }

    private void SaveActiveSessions()
    {
        try { File.WriteAllLines(_activeSessionsPath, _sessions.Values.Select(x => x.SessionId.ToString())); }
        catch (IOException ex) { _logger.LogWarning(ex, "Could not save active sessions."); }
    }

    private void SaveLocked()
    {
        try { File.WriteAllLines(_lockedPath, _locked); }
        catch (IOException ex) { _logger.LogWarning(ex, "Could not save locked disks."); }
    }

    private void SaveBlocked()
    {
        try { File.WriteAllText(_blockedPath, JsonSerializer.Serialize(_blocked.Values.ToList(), AgentJson.Default.ListBlockedDisk)); }
        catch (IOException ex) { _logger.LogWarning(ex, "Could not save blocked disks."); }
    }

    private static string BlockedKey(string pnpId) => BlockedPrefix + pnpId;

    private void Refresh(bool scanPhones)
    {
        var drives = ScanDrives();
        foreach (var (key, drive) in drives)
            if (!_sessions.ContainsKey(key) && !_sessions.ContainsKey(BlockedKey(drive.PnpId))) OpenDrive(key, drive, drives.Values);

        // A disabled disk has no letter, so it is found through the list of disks this agent disabled.
        foreach (var blocked in _blocked.Values.ToList())
            if (!_sessions.ContainsKey(BlockedKey(blocked.PnpId)) && DeviceBlock.IsPresent(blocked.PnpId) && DeviceBlock.IsDisabled(blocked.PnpId))
                OpenDisabled(blocked);

        var phones = scanPhones ? ScanPhones() : null;
        if (phones != null)
            foreach (var (key, phone) in phones)
                if (!_sessions.ContainsKey(key)) OpenPhone(key, phone);

        var gone = _sessions.Keys.Where(k =>
            k.StartsWith(PhonePrefix, StringComparison.Ordinal) ? phones != null && !phones.ContainsKey(k)
            : k.StartsWith(BlockedPrefix, StringComparison.Ordinal) ? !DeviceBlock.IsPresent(k[BlockedPrefix.Length..])
            : !drives.ContainsKey(k)).ToList();
        foreach (var key in gone) Close(key);

        foreach (var tracked in _sessions.Values.Where(t => t.Drive != null && !t.Disabled && t.Watcher == null))
            tracked.Watcher = StartWatcher(tracked.SessionId, tracked.Drive!);

        if (_policy.Revision != _appliedRevision || _reevaluationPending) Reevaluate(drives.Values);

        var readable = _policy.Current.TrackCopyIn
            ? _sessions.Values.Where(t => t.Watcher != null).Select(t => new CopyInMonitor.UsbRoot(t.Drive!.Letter + "\\", t.SessionId)).ToList()
            : new List<CopyInMonitor.UsbRoot>();
        _copyIn.Process(readable);
    }

    private int? Decide(UsbIdentity identity)
    {
        var policy = _policy.Current;
        if (policy.Mode == PolicyModes.Off) return null;
        if (policy.IsApproved(identity.Key, identity.Serial)) return PolicyResults.Approved;

        var enforce = policy.Mode == PolicyModes.Enforce;
        if (policy.IsReadOnly(identity.Key, identity.Serial)) return enforce ? PolicyResults.ReadOnly : PolicyResults.Approved;
        return enforce ? PolicyResults.Blocked : PolicyResults.NotApproved;
    }

    // Applies a decision to the disk. Only disks this agent locked or disabled are ever given back, so a stick with a
    // hardware write-protect switch is left alone. Disabled = the disk is now off in Windows and has no volume.
    private (bool Done, int? Result, bool Disabled) Enforce(UsbDrive drive, int? decision, IReadOnlyCollection<UsbDrive> present, bool force)
    {
        var key = drive.Identity.Key;
        var letters = present.Where(d => d.DiskIndex == drive.DiskIndex).Select(d => d.Letter).Distinct().ToList();

        // A built-in SD reader keeps one disk device for every card, so disabling it would block approved cards too.
        if (decision == PolicyResults.Blocked && drive.Identity.VendorId != "SD")
        {
            var outcome = DeviceBlock.Disable(drive.PnpId, letters, force, _logger);
            if (outcome == LockOutcome.Deferred) return (false, null, false);
            if (outcome == LockOutcome.Done)
            {
                _blocked[drive.PnpId] = new BlockedDisk
                {
                    PnpId = drive.PnpId, Key = key, VendorId = drive.Identity.VendorId, ProductId = drive.Identity.ProductId,
                    Serial = drive.Identity.Serial, Model = drive.Model, SharedSerial = drive.SharedSerial
                };
                SaveBlocked();
                return (true, PolicyResults.Blocked, true);
            }
            // Windows would not disable it (system disk, driver refusing): writes are still stopped below.
            _logger.LogWarning("Falling back to read-only for {Letter}.", drive.Letter);
        }

        if (decision is PolicyResults.Blocked or PolicyResults.ReadOnly)
        {
            var outcome = DiskLock.Apply(drive.DiskIndex, letters, readOnly: true, force, _logger);
            if (outcome == LockOutcome.Deferred) return (false, null, false);
            if (outcome == LockOutcome.Failed) return (true, PolicyResults.BlockFailed, false);
            // Unchanged is recorded too: an attribute left from an earlier plug-in must still be cleared on approval.
            if (_locked.Add(key)) SaveLocked();
            return (true, decision, false);
        }

        if (!_locked.Contains(key)) return (true, decision, false);

        var unlock = DiskLock.Apply(drive.DiskIndex, letters, readOnly: false, force, _logger);
        if (unlock == LockOutcome.Deferred) return (false, null, false);
        if (unlock == LockOutcome.Failed)
        {
            _logger.LogWarning("Could not make disk {Disk} writable again.", drive.DiskIndex);
            return (true, decision, false);
        }
        _locked.Remove(key);
        SaveLocked();
        return (true, decision, false);
    }

    private void OpenDrive(string key, UsbDrive drive, IReadOnlyCollection<UsbDrive> present)
    {
        var identity = drive.Identity;
        var sessionId = Guid.NewGuid();

        // Force: a disk that just mounted has nothing worth protecting open yet.
        var (_, result, disabled) = Enforce(drive, Decide(identity), present, force: true);

        // Connected must be queued before the watcher can queue file events of the same session.
        QueueConnected(sessionId, drive, result);

        var tracked = disabled
            ? new Tracked { SessionId = sessionId, Drive = drive with { Letter = "" }, PolicyResult = result }
            : new Tracked { SessionId = sessionId, Drive = drive, Watcher = StartWatcher(sessionId, drive), PolicyResult = result };
        _sessions[disabled ? BlockedKey(drive.PnpId) : key] = tracked;
        SaveActiveSessions();
        _logger.LogInformation("USB connected: {Model} {Letter} (serial {Serial}, policy {Result})", drive.Model, drive.Letter, identity.Serial, result);

        Notify(drive, result);
    }

    // A disk Windows still keeps disabled from an earlier plug-in.
    private void OpenDisabled(BlockedDisk blocked)
    {
        var identity = new UsbIdentity(blocked.VendorId, blocked.ProductId, blocked.Serial);
        var drive = new UsbDrive("", null, null, blocked.Model, identity, uint.MaxValue, blocked.PnpId, blocked.SharedSerial);
        var sessionId = Guid.NewGuid();
        QueueConnected(sessionId, drive, PolicyResults.Blocked);
        _sessions[BlockedKey(blocked.PnpId)] = new Tracked { SessionId = sessionId, Drive = drive, PolicyResult = PolicyResults.Blocked };
        SaveActiveSessions();
        _logger.LogInformation("Disabled USB plugged in: {Model} (serial {Serial})", blocked.Model, blocked.Serial);
        Notify(drive, PolicyResults.Blocked);
    }

    private void QueueConnected(Guid sessionId, UsbDrive drive, int? result)
        => _queue.Enqueue(new AgentEvent
        {
            Type = EventTypes.Connected,
            SessionId = sessionId,
            VendorId = drive.Identity.VendorId,
            ProductId = drive.Identity.ProductId,
            SerialNumber = drive.Identity.Serial,
            SharedSerial = drive.SharedSerial,
            FriendlyName = drive.Model,
            CapacityBytes = drive.Capacity,
            WindowsUser = UserSession.GetConsoleUser(),
            DriveLetter = drive.Letter.Length == 0 ? null : drive.Letter,
            VolumeLabel = drive.Label,
            DeviceClass = "DiskDrive",
            PolicyResult = result
        });

    private void OpenPhone(string key, Phone phone)
    {
        var sessionId = Guid.NewGuid();
        _queue.Enqueue(new AgentEvent
        {
            Type = EventTypes.Connected,
            SessionId = sessionId,
            VendorId = phone.Identity.VendorId,
            ProductId = phone.Identity.ProductId,
            SerialNumber = phone.Identity.Serial,
            FriendlyName = phone.Name,
            WindowsUser = UserSession.GetConsoleUser(),
            DeviceClass = phone.DeviceClass
        });

        _sessions[key] = new Tracked { SessionId = sessionId };
        SaveActiveSessions();
        _logger.LogInformation("Device connected: {Name} ({Class})", phone.Name, phone.DeviceClass);
    }

    // Policy changed (approved, revoked, mode switched): bring plugged-in disks in line. Re-run every poll while a
    // block waits for the user's open files; giving access back never waits, there is nothing unsaved to lose.
    private void Reevaluate(IReadOnlyCollection<UsbDrive> present)
    {
        _appliedRevision = _policy.Revision;
        _reevaluationPending = false;

        // Disks disabled earlier and now allowed, plugged in or not: Windows would otherwise keep them off forever.
        foreach (var blocked in _blocked.Values.ToList())
        {
            if (Decide(new UsbIdentity(blocked.VendorId, blocked.ProductId, blocked.Serial)) == PolicyResults.Blocked) continue;

            DeviceBlock.Enable(blocked.PnpId, _logger);
            _blocked.Remove(blocked.PnpId);
            SaveBlocked();
            // It comes back with a letter and opens a fresh session under the new decision.
            if (_sessions.ContainsKey(BlockedKey(blocked.PnpId))) Close(BlockedKey(blocked.PnpId));
            _logger.LogInformation("Re-enabled USB {Serial}.", blocked.Serial);
        }

        foreach (var (key, tracked) in _sessions.ToList())
        {
            if (tracked.Drive == null || tracked.Disabled || !_sessions.ContainsKey(key)) continue;

            var decision = Decide(tracked.Drive.Identity);
            if (decision == tracked.PolicyResult) continue;

            var blocking = decision is PolicyResults.Blocked or PolicyResults.ReadOnly;
            var force = !blocking || DateTime.UtcNow - tracked.BlockDeferredSince > BlockGrace;

            // Our own watchers keep the volumes open and would make the volume lock fail every time.
            var touchesDisk = blocking || _locked.Contains(tracked.Drive.Identity.Key);
            var sameDisk = touchesDisk ? _sessions.Where(s => s.Value.Drive?.DiskIndex == tracked.Drive.DiskIndex && !s.Value.Disabled).ToList()
                : new List<KeyValuePair<string, Tracked>>();
            foreach (var (_, t) in sameDisk)
            {
                t.Watcher?.Dispose();
                t.Watcher = null;
            }

            var (done, result, disabled) = Enforce(tracked.Drive, decision, present, force);

            if (disabled)
            {
                // Every volume of the disk is gone; one session stands for the disabled disk from now on.
                foreach (var (otherKey, _) in sameDisk.Where(s => s.Key != key)) Close(otherKey);
                _sessions.Remove(key);
                _sessions[BlockedKey(tracked.Drive.PnpId)] = new Tracked
                {
                    SessionId = tracked.SessionId, Drive = tracked.Drive with { Letter = "" }, PolicyResult = result
                };
                SaveActiveSessions();
            }
            else
                foreach (var (_, t) in sameDisk) t.Watcher = StartWatcher(t.SessionId, t.Drive!);

            if (!done)
            {
                _reevaluationPending = true;
                if (tracked.BlockDeferredSince == null)
                {
                    tracked.BlockDeferredSince = DateTime.UtcNow;
                    _logger.LogInformation("USB {Letter} has open files; blocking in {Seconds}s.", tracked.Drive.Letter, BlockGrace.TotalSeconds);
                    UserSession.ShowToast(decision == PolicyResults.ReadOnly ? "USB sắp chuyển sang chỉ đọc" : "USB sắp bị chặn",
                        $"Ổ {tracked.Drive.Letter} chưa được cấp phép {(decision == PolicyResults.ReadOnly ? "ghi" : "sử dụng")}. "
                        + "Hãy lưu và đóng các file đang mở trên ổ, sau 1 phút ổ sẽ bị khoá.", _logger);
                }
                continue;
            }

            tracked.BlockDeferredSince = null;
            tracked.PolicyResult = result;
            _queue.Enqueue(new AgentEvent { Type = EventTypes.Policy, SessionId = tracked.SessionId, PolicyResult = result });
            _logger.LogInformation("USB {Letter} policy is now {Result}", tracked.Drive.Letter, result);
            Notify(tracked.Drive, result);
        }
    }

    // Null when the volume is briefly unavailable (just dismounted); Refresh retries on the next poll.
    private DriveSession? StartWatcher(Guid sessionId, UsbDrive drive)
    {
        try
        {
            var session = new DriveSession(sessionId, drive.Letter + "\\", _queue, _logger);
            session.Start();
            return session;
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning("Could not watch {Letter}: {Message}", drive.Letter, ex.Message);
            return null;
        }
    }

    private void Notify(UsbDrive drive, int? result)
    {
        var serial = drive.Identity.Serial.Length > 0 ? drive.Identity.Serial : "không có";
        var name = drive.Letter.Length > 0 ? $"Ổ {drive.Letter}" : drive.Model ?? "USB";
        if (result == PolicyResults.Blocked)
            UserSession.ShowToast("USB chưa được cấp phép",
                $"{name} đã bị chặn, không đọc hay chép dữ liệu được. Serial: {serial}. Liên hệ IT để được cấp phép.", _logger);
        else if (result == PolicyResults.ReadOnly)
            UserSession.ShowToast("USB chỉ được phép đọc",
                $"{name} chỉ đọc được, không chép dữ liệu vào được. Serial: {serial}. Liên hệ IT nếu cần ghi.", _logger);
    }

    private void Close(string key)
    {
        var tracked = _sessions[key];
        _sessions.Remove(key);
        tracked.Watcher?.Dispose();

        _queue.Enqueue(new AgentEvent { Type = EventTypes.Disconnected, SessionId = tracked.SessionId });
        SaveActiveSessions();
        _logger.LogInformation("Disconnected: {Key}", key);
    }

    private Dictionary<string, UsbDrive> ScanDrives()
    {
        var result = new Dictionary<string, UsbDrive>();
        var seen = new List<string>();

        using var disks = new ManagementObjectSearcher("SELECT * FROM Win32_DiskDrive");
        foreach (ManagementObject disk in disks.Get())
        {
            using (disk)
            {
                var pnpId = disk["PNPDeviceID"] as string ?? "";
                var identity = Identify(pnpId) ?? CardReaderIdentity(disk);
                if (identity == null) continue;
                seen.Add(pnpId);

                var model = disk["Model"] as string;
                long? capacity = disk["Size"] == null ? null : Convert.ToInt64(disk["Size"]);
                var index = Convert.ToUInt32(disk["Index"]);

                var shared = false;
                if (identity.VendorId != "SD" && BridgedSerial.IsGeneric(identity.Serial))
                {
                    if (BridgedSerial.Get(pnpId, index, model) is { } inner)
                    {
                        identity = identity with { Serial = inner.Serial };
                        if (inner.Model.Length > 0) model = $"{inner.Model} ({model})";
                    }
                    else shared = true;
                }

                foreach (ManagementObject partition in disk.GetRelated("Win32_DiskPartition"))
                {
                    using (partition)
                    {
                        foreach (ManagementObject logical in partition.GetRelated("Win32_LogicalDisk"))
                        {
                            using (logical)
                            {
                                var letter = logical["DeviceID"] as string;
                                if (string.IsNullOrEmpty(letter)) continue;
                                result[$"{pnpId}|{letter}"] = new UsbDrive(letter, logical["VolumeName"] as string, capacity, model, identity, index, pnpId, shared);
                            }
                        }
                    }
                }
            }
        }
        BridgedSerial.ForgetAllExcept(seen);
        return result;
    }

    // Built-in SD/MMC readers sit on PCI, not USB; their disks are the only non-USB ones reporting removable media.
    private static UsbIdentity? CardReaderIdentity(ManagementObject disk)
        => (disk["MediaType"] as string)?.StartsWith("Removable", StringComparison.OrdinalIgnoreCase) == true
            ? new UsbIdentity("SD", "0000", (disk["SerialNumber"] as string)?.Trim() ?? "")
            : null;

    // WPD = MTP phones and media players, Image = PTP cameras/iPhones and scanners. Logged only, never blocked.
    private static Dictionary<string, Phone> ScanPhones()
    {
        var result = new Dictionary<string, Phone>();

        using var searcher = new ManagementObjectSearcher(
            "SELECT PNPDeviceID, Name, PNPClass FROM Win32_PnPEntity WHERE PNPClass = 'WPD' OR PNPClass = 'Image'");
        foreach (ManagementObject entity in searcher.Get())
        {
            using (entity)
            {
                var pnpId = entity["PNPDeviceID"] as string ?? "";
                if (!pnpId.StartsWith(@"USB\", StringComparison.OrdinalIgnoreCase)) continue;

                // A composite phone exposes interface nodes ("&MI_xx"); its serial lives on the parent USB node.
                var usbId = pnpId.Contains("&MI_", StringComparison.OrdinalIgnoreCase) ? UsbTopology.FindUsbAncestor(pnpId) : pnpId;
                var identity = usbId == null ? null : ParseUsbId(usbId);
                if (identity == null) continue;

                result.TryAdd(PhonePrefix + usbId, new Phone(entity["Name"] as string, entity["PNPClass"] as string ?? "", identity));
            }
        }
        return result;
    }

    // Null for disks that are not USB-attached. Cached per disk id.
    private UsbIdentity? Identify(string diskPnpId)
    {
        if (_identities.TryGetValue(diskPnpId, out var cached)) return cached;

        var usbId = diskPnpId.Length == 0 ? null : UsbTopology.FindUsbAncestor(diskPnpId);
        var identity = usbId == null ? null : ParseUsbId(usbId);

        _identities[diskPnpId] = identity;
        return identity;
    }

    // The USB node id is "USB\VID_xxxx&PID_xxxx\<serial>"; a serial that still contains '&' is Windows-generated,
    // i.e. the device has none.
    private static UsbIdentity? ParseUsbId(string usbId)
    {
        var match = VidPidRegex().Match(usbId);
        if (!match.Success) return null;

        var serial = usbId[(usbId.LastIndexOf('\\') + 1)..];
        if (serial.Contains('&')) serial = "";
        return new UsbIdentity(match.Groups[1].Value.ToUpperInvariant(), match.Groups[2].Value.ToUpperInvariant(), serial);
    }

    [GeneratedRegex(@"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})")]
    private static partial Regex VidPidRegex();
}
