using System.Management;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Polls WMI for disks that sit on a USB device and have a drive letter; a new one opens a session, a vanished one closes it.
public sealed partial class UsbMonitor : BackgroundService
{
    private readonly EventQueue _queue;
    private readonly AgentOptions _options;
    private readonly ILogger<UsbMonitor> _logger;
    private readonly Dictionary<string, DriveSession> _sessions = new();
    private readonly Dictionary<string, UsbIdentity?> _identities = new();
    private readonly string _activeSessionsPath;

    private sealed record UsbDrive(string Letter, string? Label, long? Capacity, string? Model, UsbIdentity Identity);

    private sealed record UsbIdentity(string VendorId, string ProductId, string Serial);

    public UsbMonitor(EventQueue queue, IOptions<AgentOptions> options, ILogger<UsbMonitor> logger)
    {
        _queue = queue;
        _options = options.Value;
        _logger = logger;
        _activeSessionsPath = Path.Combine(_options.ResolveDataDir(), "active-sessions.txt");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Keep the first (slow) WMI scan off the host startup path.
        await Task.Yield();
        _logger.LogInformation("YevUsbAgent {Version} started", typeof(UsbMonitor).Assembly.GetName().Version);

        CloseStaleSessions();

        while (!stoppingToken.IsCancellationRequested)
        {
            try { Refresh(); }
            catch (Exception ex) { _logger.LogError(ex, "USB scan failed."); }

            try { await Task.Delay(TimeSpan.FromSeconds(_options.PollSeconds), stoppingToken); }
            catch (OperationCanceledException) { }
        }

        foreach (var key in _sessions.Keys.ToList()) Close(key);
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

    private void Refresh()
    {
        var present = ScanDrives();

        foreach (var (key, drive) in present)
            if (!_sessions.ContainsKey(key)) Open(key, drive);

        foreach (var key in _sessions.Keys.Where(k => !present.ContainsKey(k)).ToList())
            Close(key);
    }

    private void Open(string key, UsbDrive drive)
    {
        var identity = drive.Identity;
        var sessionId = Guid.NewGuid();

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
            WindowsUser = GetWindowsUser(),
            DriveLetter = drive.Letter,
            VolumeLabel = drive.Label
        });

        var session = new DriveSession(sessionId, drive.Letter + "\\", _queue, _logger);
        session.Start();
        _sessions[key] = session;
        SaveActiveSessions();
        _logger.LogInformation("USB connected: {Model} {Letter} (serial {Serial})", drive.Model, drive.Letter, identity.Serial);
    }

    private void Close(string key)
    {
        var session = _sessions[key];
        _sessions.Remove(key);
        session.Dispose();

        _queue.Enqueue(new AgentEvent { Type = EventTypes.Disconnected, SessionId = session.SessionId });
        SaveActiveSessions();
        _logger.LogInformation("USB disconnected: {Key}", key);
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
                var identity = Identify(pnpId);
                if (identity == null) continue;

                var model = disk["Model"] as string;
                long? capacity = disk["Size"] == null ? null : Convert.ToInt64(disk["Size"]);

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
                                result[$"{pnpId}|{letter}"] = new UsbDrive(letter, logical["VolumeName"] as string, capacity, model, identity);
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    // Null for disks that are not USB-attached. The USB node id is "USB\VID_xxxx&PID_xxxx\<serial>"; a serial
    // that still contains '&' is Windows-generated, i.e. the device has none. Cached per disk id.
    private UsbIdentity? Identify(string diskPnpId)
    {
        if (_identities.TryGetValue(diskPnpId, out var cached)) return cached;

        UsbIdentity? identity = null;
        var usbId = diskPnpId.Length == 0 ? null : UsbTopology.FindUsbAncestor(diskPnpId);
        if (usbId != null)
        {
            var match = VidPidRegex().Match(usbId);
            if (match.Success)
            {
                var serial = usbId[(usbId.LastIndexOf('\\') + 1)..];
                if (serial.Contains('&')) serial = "";
                identity = new UsbIdentity(match.Groups[1].Value.ToUpperInvariant(), match.Groups[2].Value.ToUpperInvariant(), serial);
            }
        }

        _identities[diskPnpId] = identity;
        return identity;
    }

    // The service runs as SYSTEM, so the interactive user comes from WMI.
    private static string? GetWindowsUser()
    {
        using var searcher = new ManagementObjectSearcher("SELECT UserName FROM Win32_ComputerSystem");
        foreach (ManagementObject obj in searcher.Get())
        {
            using (obj) return obj["UserName"] as string;
        }
        return null;
    }

    [GeneratedRegex(@"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})")]
    private static partial Regex VidPidRegex();
}
