using System.Text.Json;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Reports install, start, stop and crashes. The flag file exists only while the service runs, so finding it at start
// means the previous run never stopped cleanly (killed, power loss, crash); its last touch is when that happened.
public sealed class Lifecycle : BackgroundService
{
    private static readonly TimeSpan TouchEvery = TimeSpan.FromMinutes(1);

    private readonly EventQueue _queue;
    private readonly ILogger<Lifecycle> _logger;
    private readonly string _flagPath;
    private readonly string _installedPath;

    public Lifecycle(EventQueue queue, IOptions<AgentOptions> options, ILogger<Lifecycle> logger)
    {
        _queue = queue;
        _logger = logger;
        var dataDir = options.Value.ResolveDataDir();
        _flagPath = Path.Combine(dataDir, "running.flag");
        _installedPath = Path.Combine(dataDir, "installed.json");
    }

    public static AgentEvent Event(int type, string? detail, string? actor = null) => new()
    {
        Type = EventTypes.Agent,
        EventId = Guid.NewGuid(),
        Action = type,
        Detail = detail,
        WindowsUser = actor ?? UserSession.GetConsoleUser()
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (File.Exists(_flagPath))
        {
            var crash = Event(AgentEventTypes.AbnormalStop, "Lần chạy trước dừng đột ngột (mất điện, treo máy hoặc bị tắt tiến trình)");
            crash.OccurredAt = new DateTimeOffset(File.GetLastWriteTime(_flagPath));
            _queue.Enqueue(crash);
        }
        ReportInstall();
        _queue.Enqueue(Event(AgentEventTypes.Started, $"Phiên bản {PolicySync.AgentVersion}"));

        while (!stoppingToken.IsCancellationRequested)
        {
            try { File.WriteAllText(_flagPath, ""); }
            catch (IOException ex) { _logger.LogWarning("Could not touch the running flag: {Message}", ex.Message); }

            try { await Task.Delay(TouchEvery, stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        _queue.Enqueue(Event(AgentEventTypes.Stopped, "Dừng dịch vụ hoặc tắt máy"));
        try { File.Delete(_flagPath); }
        catch (IOException) { }
    }

    // install.ps1 leaves installed.json ({ By, Reason }) for the freshly installed service to report.
    private void ReportInstall()
    {
        if (!File.Exists(_installedPath)) return;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(_installedPath));
            var by = doc.RootElement.TryGetProperty("By", out var b) ? b.GetString() : null;
            var reason = doc.RootElement.TryGetProperty("Reason", out var r) ? r.GetString() : null;
            var ev = Event(AgentEventTypes.Installed, $"Phiên bản {PolicySync.AgentVersion}" + (reason == "self-update" ? " (tự cập nhật)" : ""), by);
            ev.OccurredAt = new DateTimeOffset(File.GetLastWriteTime(_installedPath));
            _queue.Enqueue(ev);
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException)
        {
            _logger.LogWarning("Could not read installed.json: {Message}", ex.Message);
        }
        finally
        {
            try { File.Delete(_installedPath); }
            catch (IOException) { }
        }
    }
}
