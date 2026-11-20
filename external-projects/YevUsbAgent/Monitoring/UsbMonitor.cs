using System.Management;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Polls WMI for USB disks, built-in SD cards and USB phones/cameras; a new one opens a session, a vanished one closes it.
// Device-change events trigger an immediate scan so an unapproved disk is write-blocked right after it mounts.
public sealed partial class UsbMonitor : BackgroundService
{
    // Phones need a Win32_PnPEntity scan, far heavier than the disk query; between device events it runs every N polls.
    private const int PhoneScanEvery = 5;
    private const string PhonePrefix = "phone|";

    private readonly EventQueue _queue;
    private readonly PolicyStore _policy;
    private readonly AgentOptions _options;
    private readonly ILogger<UsbMonitor> _logger;
    private readonly Dictionary<string, Tracked> _sessions = new();
    private readonly Dictionary<string, UsbIdentity?> _identities = new();
    private readonly string _activeSessionsPath;
    private readonly string _lockedPath;
    private readonly HashSet<string> _locked;
    private readonly SemaphoreSlim _deviceChanged = new(0, 1);
    private int _appliedRevision = -1;
    private bool _reevaluationPending;
    private int _tick;

    private sealed record UsbIdentity(string VendorId, string ProductId, string Serial)
    {
        public string Key => $"{VendorId}|{ProductId}|{Serial}".ToUpperInvariant();
    }

    private sealed record UsbDrive(string Letter, string? Label, long? Capacity, string? Model, UsbIdentity Identity, uint DiskIndex);

    private sealed record Phone(string? Name, string DeviceClass, UsbIdentity Identity);

    private sealed class Tracked
    {
        public required Guid SessionId { get; init; }
        public UsbDrive? Drive { get; init; }
        public DriveSession? Watcher { get; set; }
        public int? PolicyResult { get; set; }
    }

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

    private void Refresh(bool scanPhones)
    {
        var drives = ScanDrives();
        foreach (var (key, drive) in drives)
            if (!_sessions.ContainsKey(key)) OpenDrive(key, drive, drives.Values);

        var phones = scanPhones ? ScanPhones() : null;
        if (phones != null)
            foreach (var (key, phone) in phones)
                if (!_sessions.ContainsKey(key)) OpenPhone(key, phone);

        var gone = _sessions.Keys.Where(k => k.StartsWith(PhonePrefix, StringComparison.Ordinal)
            ? phones != null && !phones.ContainsKey(k)
            : !drives.ContainsKey(k)).ToList();
        foreach (var key in gone) Close(key);

        if (_policy.Revision != _appliedRevision || _reevaluationPending) Reevaluate(drives.Values);
    }

    private int? Decide(UsbIdentity identity)
    {
        var policy = _policy.Current;
        if (policy.Mode == PolicyModes.Off) return null;
        if (policy.IsApproved(identity.Key, identity.Serial)) return PolicyResults.Approved;
        return policy.Mode == PolicyModes.Enforce ? PolicyResults.Blocked : PolicyResults.NotApproved;
    }

    // Applies a decision to the disk. Only disks this agent locked are ever unlocked, so a stick with a hardware
    // write-protect switch is left alone. Remounted = the volume was dismounted and its watcher must be recreated.
    private (bool Done, int? Result, bool Remounted) Enforce(UsbDrive drive, int? decision, IReadOnlyCollection<UsbDrive> present, bool force)
    {
        var key = drive.Identity.Key;
        var letters = present.Where(d => d.DiskIndex == drive.DiskIndex).Select(d => d.Letter).Distinct().ToList();

        if (decision == PolicyResults.Blocked)
        {
            var outcome = DiskLock.Apply(drive.DiskIndex, letters, readOnly: true, force, _logger);
            if (outcome == LockOutcome.Deferred) return (false, null, false);
            if (outcome == LockOutcome.Failed) return (true, PolicyResults.BlockFailed, false);
            // Unchanged is recorded too: an attribute left from an earlier plug-in must still be cleared on approval.
            if (_locked.Add(key)) SaveLocked();
            return (true, PolicyResults.Blocked, outcome == LockOutcome.Done);
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
        return (true, decision, unlock == LockOutcome.Done);
    }

    private void OpenDrive(string key, UsbDrive drive, IReadOnlyCollection<UsbDrive> present)
    {
        var identity = drive.Identity;
        var sessionId = Guid.NewGuid();

        // Force: a disk that just mounted has nothing worth protecting open yet.
        var (_, result, _) = Enforce(drive, Decide(identity), present, force: true);

        // Connected must be queued before the watcher can queue file events of the same session.
        _queue.Enqueue(new AgentEvent
        {
            Type = EventTypes.Connected,
            SessionId = sessionId,
            VendorId = identity.VendorId,
            ProductId = identity.ProductId,
            SerialNumber = identity.Serial,
            FriendlyName = drive.Model,
            CapacityBytes = drive.Capacity,
            WindowsUser = UserSession.GetConsoleUser(),
            DriveLetter = drive.Letter,
            VolumeLabel = drive.Label,
            DeviceClass = "DiskDrive",
            PolicyResult = result
        });

        _sessions[key] = new Tracked { SessionId = sessionId, Drive = drive, Watcher = StartWatcher(sessionId, drive), PolicyResult = result };
        SaveActiveSessions();
        _logger.LogInformation("USB connected: {Model} {Letter} (serial {Serial}, policy {Result})", drive.Model, drive.Letter, identity.Serial, result);

        if (result == PolicyResults.Blocked) NotifyBlocked(drive);
    }

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

    // Policy changed (approved, revoked, mode switched): bring plugged-in disks in line. Disks with open files are retried next poll.
    private void Reevaluate(IReadOnlyCollection<UsbDrive> present)
    {
        _appliedRevision = _policy.Revision;
        _reevaluationPending = false;

        foreach (var tracked in _sessions.Values)
        {
            if (tracked.Drive == null) continue;

            var decision = Decide(tracked.Drive.Identity);
            if (decision == tracked.PolicyResult) continue;

            var (done, result, remounted) = Enforce(tracked.Drive, decision, present, force: false);
            if (!done)
            {
                _reevaluationPending = true;
                continue;
            }

            if (remounted)
            {
                tracked.Watcher?.Dispose();
                tracked.Watcher = StartWatcher(tracked.SessionId, tracked.Drive);
            }

            tracked.PolicyResult = result;
            _queue.Enqueue(new AgentEvent { Type = EventTypes.Policy, SessionId = tracked.SessionId, PolicyResult = result });
            _logger.LogInformation("USB {Letter} policy is now {Result}", tracked.Drive.Letter, result);
            if (result == PolicyResults.Blocked) NotifyBlocked(tracked.Drive);
        }
    }

    private DriveSession StartWatcher(Guid sessionId, UsbDrive drive)
    {
        var session = new DriveSession(sessionId, drive.Letter + "\\", _queue, _logger);
        session.Start();
        return session;
    }

    private void NotifyBlocked(UsbDrive drive)
    {
        var serial = drive.Identity.Serial.Length > 0 ? drive.Identity.Serial : "không có";
        UserSession.ShowToast("USB chưa được cấp phép ghi",
            $"Ổ {drive.Letter} chỉ đọc được, không chép dữ liệu vào được. Serial: {serial}. Liên hệ IT để được cấp phép.", _logger);
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

        using var disks = new ManagementObjectSearcher("SELECT * FROM Win32_DiskDrive");
        foreach (ManagementObject disk in disks.Get())
        {
            using (disk)
            {
                var pnpId = disk["PNPDeviceID"] as string ?? "";
                var identity = Identify(pnpId) ?? CardReaderIdentity(disk);
                if (identity == null) continue;

                var model = disk["Model"] as string;
                long? capacity = disk["Size"] == null ? null : Convert.ToInt64(disk["Size"]);
                var index = Convert.ToUInt32(disk["Index"]);

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
                                result[$"{pnpId}|{letter}"] = new UsbDrive(letter, logical["VolumeName"] as string, capacity, model, identity, index);
                            }
                        }
                    }
                }
            }
        }
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
