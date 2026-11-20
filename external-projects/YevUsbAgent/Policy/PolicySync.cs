using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

// Heartbeat + policy pull: tells the server this agent is alive and fetches the block mode and approved USB list.
public sealed class PolicySync : BackgroundService
{
    private static readonly string AgentVersion = typeof(PolicySync).Assembly.GetName().Version?.ToString(3) ?? "";

    private readonly PolicyStore _store;
    private readonly AgentOptions _options;
    private readonly ILogger<PolicySync> _logger;
    private readonly HttpClient _http;

    public PolicySync(PolicyStore store, IOptions<AgentOptions> options, ILogger<PolicySync> logger)
    {
        _store = store;
        _options = options.Value;
        _logger = logger;
        _http = new HttpClient { BaseAddress = new Uri(_options.ServerUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Add("X-Agent-Key", _options.ApiKey);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await SyncAsync(stoppingToken);

            try { await Task.Delay(TimeSpan.FromSeconds(_options.SyncSeconds), stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }

    private async Task SyncAsync(CancellationToken ct)
    {
        try
        {
            var body = new SyncRequest(Environment.MachineName, AgentVersion, UserSession.GetConsoleUser(), _store.Current.Version);
            using var response = await _http.PostAsJsonAsync("api/UsbLog/agent-sync", body, AgentJson.Default.SyncRequest, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Policy sync failed with HTTP {Status}; keeping the cached policy.", (int)response.StatusCode);
                return;
            }

            var envelope = await response.Content.ReadFromJsonAsync(AgentJson.Default.SyncEnvelope, ct);
            if (envelope?.Data is { } data)
                _store.Update(data.Mode, data.PolicyVersion, data.Approved);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            _logger.LogWarning("Policy sync failed ({Message}); keeping the cached policy.", ex.Message);
        }
    }
}
