using System.ComponentModel;
using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Downloads the version the server assigns to this PC, checks hash + release signature, then hands over to the new
// exe's installer, which stops this service, replaces the binary and starts it again.
public sealed class Updater
{
    // A version that failed is not retried for a while, so a bad release cannot loop a download every minute.
    private static readonly TimeSpan RetryAfter = TimeSpan.FromHours(6);

    private readonly EventQueue _queue;
    private readonly ILogger<Updater> _logger;
    private readonly HttpClient _http;
    private readonly string _dir;
    private readonly string _attemptPath;

    public Updater(EventQueue queue, IOptions<AgentOptions> options, ILogger<Updater> logger)
    {
        _queue = queue;
        _logger = logger;
        _http = AgentHttp.Create(options.Value, timeoutSeconds: 600);
        var dataDir = options.Value.ResolveDataDir();
        _dir = Path.Combine(dataDir, "update");
        _attemptPath = Path.Combine(dataDir, "update-attempt.txt");
    }

    public async Task InstallAsync(UpdateInfo update, CancellationToken ct)
    {
        if (update.Version == PolicySync.AgentVersion || RecentlyAttempted(update.Version)) return;
        File.WriteAllText(_attemptPath, $"{update.Version}|{DateTime.UtcNow.Ticks}");

        var exe = Path.Combine(_dir, "YevUsbAgent.exe");
        try
        {
            Directory.CreateDirectory(_dir);
            using (var response = await _http.GetAsync($"api/UsbLog/agent-releases/{Uri.EscapeDataString(update.Version)}/download",
                       HttpCompletionOption.ResponseHeadersRead, ct))
            {
                if (!response.IsSuccessStatusCode)
                {
                    Fail(update.Version, $"tải về lỗi HTTP {(int)response.StatusCode}");
                    return;
                }
                await using var file = File.Create(exe);
                await response.Content.CopyToAsync(file, ct);
            }

            var bytes = await File.ReadAllBytesAsync(exe, ct);
            if (!Convert.ToHexString(SHA256.HashData(bytes)).Equals(update.Sha256, StringComparison.OrdinalIgnoreCase)
                || !UpdateKey.Verify(bytes, update.Signature))
            {
                File.Delete(exe);
                Fail(update.Version, "sai mã băm hoặc chữ ký");
                return;
            }

            _logger.LogInformation("Installing agent {Version}.", update.Version);
            Process.Start(new ProcessStartInfo(exe, "--install --silent --self-update") { UseShellExecute = false, CreateNoWindow = true })?.Dispose();
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or UnauthorizedAccessException or Win32Exception
                                       or TaskCanceledException && !ct.IsCancellationRequested)
        {
            Fail(update.Version, ex.Message);
        }
    }

    private bool RecentlyAttempted(string version)
    {
        try
        {
            var parts = File.Exists(_attemptPath) ? File.ReadAllText(_attemptPath).Split('|') : Array.Empty<string>();
            return parts.Length == 2 && parts[0] == version && long.TryParse(parts[1], out var ticks)
                   && DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc) < RetryAfter;
        }
        catch (IOException) { return false; }
    }

    private void Fail(string version, string reason)
    {
        _logger.LogWarning("Update to {Version} failed: {Reason}", version, reason);
        _queue.Enqueue(Lifecycle.Event(AgentEventTypes.UpdateFailed, $"{version}: {reason}"));
    }
}
