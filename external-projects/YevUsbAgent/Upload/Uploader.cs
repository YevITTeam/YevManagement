using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace YevUsbAgent;

public sealed class Uploader : BackgroundService
{
    private readonly EventQueue _queue;
    private readonly AgentOptions _options;
    private readonly ILogger<Uploader> _logger;
    private readonly HttpClient _http;

    public Uploader(EventQueue queue, IOptions<AgentOptions> options, ILogger<Uploader> logger)
    {
        _queue = queue;
        _options = options.Value;
        _logger = logger;
        _http = new HttpClient { BaseAddress = new Uri(_options.ServerUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Add("X-Agent-Key", _options.ApiKey);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Keep sending while full batches are waiting; otherwise sleep until the next tick.
            while (!stoppingToken.IsCancellationRequested && await SendBatchAsync(stoppingToken)) { }

            try { await Task.Delay(TimeSpan.FromSeconds(_options.UploadSeconds), stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }

    // Returns true when a full batch was accepted and more may be waiting.
    private async Task<bool> SendBatchAsync(CancellationToken ct)
    {
        var (events, lineCount) = _queue.Peek(_options.BatchSize);
        if (lineCount == 0) return false;

        try
        {
            if (events.Count > 0)
            {
                var body = new IngestRequest(Environment.MachineName, events);
                using var response = await _http.PostAsJsonAsync("api/UsbLog/ingest", body, AgentJson.Default.IngestRequest, ct);

                if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                {
                    _logger.LogError("Server rejected the agent key (HTTP {Status}); check Agent:ApiKey.", (int)response.StatusCode);
                    return false;
                }

                // A 400 would repeat forever, so that batch is dropped; other failures are retried next tick.
                if (response.StatusCode == HttpStatusCode.BadRequest)
                    _logger.LogWarning("Server rejected a batch of {Count} events as invalid; dropped.", events.Count);
                else if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Upload failed with HTTP {Status}; will retry.", (int)response.StatusCode);
                    return false;
                }
            }

            _queue.Remove(lineCount);
            return lineCount >= _options.BatchSize;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("Server unreachable ({Message}); will retry.", ex.Message);
            return false;
        }
    }
}
