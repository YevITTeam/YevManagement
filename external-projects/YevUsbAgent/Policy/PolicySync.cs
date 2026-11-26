using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Heartbeat + policy pull: tells the server this agent is alive and fetches the block mode, approved USB lists,
// agent settings and, when this PC is due one, an update to install.
public sealed class PolicySync : BackgroundService
{
    public static readonly string AgentVersion = typeof(PolicySync).Assembly.GetName().Version?.ToString(3) ?? "";

    private readonly PolicyStore _store;
    private readonly Updater _updater;
    private readonly AgentOptions _options;
    private readonly ILogger<PolicySync> _logger;
    private readonly HttpClient _http;

    public PolicySync(PolicyStore store, Updater updater, IOptions<AgentOptions> options, ILogger<PolicySync> logger)
    {
        _store = store;
        _updater = updater;
        _options = options.Value;
        _logger = logger;
        _http = AgentHttp.Create(_options);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var update = await SyncAsync(stoppingToken);
            if (update != null) await _updater.InstallAsync(update, stoppingToken);

            // The server's interval wins once known; agents that never synced use their own setting.
            var seconds = _store.Current.SyncSeconds > 0 ? _store.Current.SyncSeconds : _options.SyncSeconds;
            try { await Task.Delay(TimeSpan.FromSeconds(seconds), stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }

    private async Task<UpdateInfo?> SyncAsync(CancellationToken ct)
    {
        try
        {
            var body = new SyncRequest(Environment.MachineName, AgentVersion, UserSession.GetConsoleUser(), _store.Current.Version);
            using var response = await _http.PostAsJsonAsync("api/UsbLog/agent-sync", body, AgentJson.Default.SyncRequest, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Policy sync failed with HTTP {Status}; keeping the cached policy.", (int)response.StatusCode);
                return null;
            }

            var envelope = await response.Content.ReadFromJsonAsync(AgentJson.Default.SyncEnvelope, ct);
            if (envelope?.Data is not { } data) return null;

            _store.Update(data);
            return data.Update;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            _logger.LogWarning("Policy sync failed ({Message}); keeping the cached policy.", ex.Message);
            return null;
        }
    }
}

internal static class AgentHttp
{
    public static HttpClient Create(AgentOptions options, int timeoutSeconds = 30)
    {
        var http = new HttpClient { BaseAddress = new Uri(options.ServerUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(timeoutSeconds) };
        http.DefaultRequestHeaders.Add("X-Agent-Key", options.ApiKey);
        return http;
    }
}
