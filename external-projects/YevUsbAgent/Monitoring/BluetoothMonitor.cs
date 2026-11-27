using System.Diagnostics;
using System.Management;

namespace YevUsbAgent;

// fsquirt.exe is Windows' built-in Bluetooth file-transfer wizard. Each run is a session of a pseudo device
// "BT|0000|SEND" or "BT|0000|RECEIVE"; under Enforce, that direction must be approved for this PC or the wizard is
// closed before a device or file can be picked.
// ponytail: no file names (the wizard keeps them inside its own process); add an OBEX/temp-folder watch if needed.
public sealed class BluetoothMonitor : BackgroundService
{
    public const string DeviceClass = "Bluetooth";
    private const string VendorId = "BT";
    private const string ProductId = "0000";
    private const string Send = "SEND";
    private const string Receive = "RECEIVE";
    private static readonly TimeSpan Poll = TimeSpan.FromSeconds(1);

    private readonly EventQueue _queue;
    private readonly PolicyStore _policy;
    private readonly ILogger<BluetoothMonitor> _logger;
    private readonly Dictionary<int, Guid> _sessions = new();

    public BluetoothMonitor(EventQueue queue, PolicyStore policy, ILogger<BluetoothMonitor> logger)
    {
        _queue = queue;
        _policy = policy;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        while (!stoppingToken.IsCancellationRequested)
        {
            try { Scan(); }
            catch (Exception ex) { _logger.LogError(ex, "Bluetooth scan failed."); }

            try { await Task.Delay(Poll, stoppingToken); }
            catch (OperationCanceledException) { }
        }

        foreach (var pid in _sessions.Keys.ToList()) Close(pid);
    }

    private void Scan()
    {
        var alive = new HashSet<int>();
        foreach (var process in Process.GetProcessesByName("fsquirt"))
        {
            using (process)
            {
                alive.Add(process.Id);
                if (!_sessions.ContainsKey(process.Id)) Open(process);
            }
        }

        foreach (var pid in _sessions.Keys.Where(pid => !alive.Contains(pid)).ToList()) Close(pid);
    }

    private void Open(Process process)
    {
        // The tray's "Receive a File" passes -receive; "Send a File" and the Settings wizard (which can do both) count as sending.
        var receive = CommandLine(process.Id)?.Contains("-receive", StringComparison.OrdinalIgnoreCase) == true;
        var serial = receive ? Receive : Send;
        var result = _policy.Current.Decide($"{VendorId}|{ProductId}|{serial}", serial);
        if (result == PolicyResults.ReadOnly) result = PolicyResults.Approved;

        if (result == PolicyResults.Blocked)
        {
            try { process.Kill(entireProcessTree: true); }
            catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
            {
                result = PolicyResults.BlockFailed;
                _logger.LogWarning("Could not close the Bluetooth wizard: {Message}", ex.Message);
            }
        }

        var sessionId = Guid.NewGuid();
        _queue.Enqueue(new AgentEvent
        {
            Type = EventTypes.Connected,
            SessionId = sessionId,
            VendorId = VendorId,
            ProductId = ProductId,
            SerialNumber = serial,
            FriendlyName = receive ? "Nhận file qua Bluetooth" : "Gửi file qua Bluetooth",
            WindowsUser = UserSession.GetConsoleUser(),
            DeviceClass = DeviceClass,
            PolicyResult = result
        });
        _sessions[process.Id] = sessionId;
        _logger.LogInformation("Bluetooth transfer opened ({Direction}, policy {Result})", serial, result);

        if (result == PolicyResults.Blocked)
            UserSession.ShowToast("Bluetooth chưa được cấp phép",
                $"Máy này chưa được cấp phép {(receive ? "nhận" : "gửi")} file qua Bluetooth. Liên hệ IT nếu cần.", _logger);
    }

    private void Close(int pid)
    {
        _queue.Enqueue(new AgentEvent { Type = EventTypes.Disconnected, SessionId = _sessions[pid] });
        _sessions.Remove(pid);
    }

    private static string? CommandLine(int pid)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher($"SELECT CommandLine FROM Win32_Process WHERE ProcessId = {pid}");
            foreach (ManagementObject process in searcher.Get())
                using (process)
                    return process["CommandLine"] as string;
        }
        catch (ManagementException) { }
        return null;
    }
}
