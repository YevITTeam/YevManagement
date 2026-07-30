using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;
using Shared.Core.Exceptions;

namespace Shared.Infrastructure.External
{
    // Talks to Ollama's /api/chat (docs/ai-chat-be-huong-dan.md §3). HttpClient is a typed client
    // registered via AddHttpClient<IOllamaChatClient, OllamaChatClient>() in
    // CompanySystem.HostApi/Configurations/DependencyInjection.cs (BaseAddress/Timeout configured
    // there from appsettings AiChatSettings) — this class only knows the request/response shape.
    //
    // Moved here from Asset.Infrastructure (2026-07-29) when the Attendance module gained its own
    // tool-calling chat: nothing in this class is domain-specific, the only thing that ever differed
    // per module was the tool catalogue, which is now a `tools` parameter instead of a hard-coded
    // reference to Asset's AiChatToolDefinitions.
    public class OllamaChatClient : IOllamaChatClient
    {
        // Thấp để model bám sát tool schema hơn — mặc định của Ollama (kế thừa từ Modelfile, thường
        // 0.7-0.8) ưu tiên đa dạng câu chữ, nhưng với model nhỏ chạy nội bộ (gemma4) nhiệt độ cao
        // cũng làm quyết định "có nên gọi tool không" kém nhất quán hơn — cùng 1 dạng câu hỏi lúc gọi
        // đúng tool, lúc lại tự bịa câu trả lời. Hạ nhiệt độ không đổi tool schema (không rủi ro như
        // "format" — xem ai-chat-be-huong-dan.md §3), chỉ giảm tính ngẫu nhiên khi model chọn hướng đi.
        private const double DefaultTemperature = 0.3;

        private readonly HttpClient _httpClient;
        private readonly string _model;
        private readonly double _temperature;

        public OllamaChatClient(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _model = configuration["AiChatSettings:Model"] ?? "gemma4:e4b";
            _temperature = configuration.GetValue<double?>("AiChatSettings:Temperature") ?? DefaultTemperature;
        }

        public async IAsyncEnumerable<OllamaChatChunkWire> StreamChatAsync(
            List<OllamaMessageWire> messages,
            JsonNode tools,
            bool think,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var requestBody = new JsonObject
            {
                ["model"] = _model,
                ["messages"] = JsonSerializer.SerializeToNode(messages, OllamaJson.Options),
                // Caller-supplied catalogue — must already be a node the caller owns (see
                // IOllamaChatClient's remark on DeepClone()), since a JsonNode can only ever be
                // attached to 1 parent at a time.
                ["tools"] = tools,
                ["stream"] = true,
                // Default false is the measured-faster choice (docs §3: the "thinking" model is ~7x
                // slower with chain-of-thought enabled, for an identical final answer) — but it is
                // a per-request opt-in (AiChatRequestDto.Think, 2026-07-27 §11) rather than hardcoded,
                // so a user can knowingly trade speed for deeper reasoning on a specific question.
                ["think"] = think,
                ["options"] = new JsonObject { ["temperature"] = _temperature }
            };

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/chat")
            {
                Content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json")
            };

            using var response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new DomainException($"Không thể kết nối tới máy chủ AI (Ollama), mã lỗi {(int)response.StatusCode}.");

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            // NDJSON: 1 JSON object per line, not 1 combined document (docs §3). Loop on
            // ReadLineAsync's own null-at-EOF signal instead of checking `reader.EndOfStream` first
            // (CA2024): EndOfStream blocks the calling thread synchronously waiting on the network to
            // know whether more data is coming, which under concurrent chat requests ties up
            // thread-pool threads instead of releasing them — a real contributor to overall latency,
            // not just a style nit (2026-07-27).
            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                OllamaChatChunkWire? chunk;
                try
                {
                    chunk = JsonSerializer.Deserialize<OllamaChatChunkWire>(line, OllamaJson.Options);
                }
                catch (JsonException)
                {
                    // A malformed line shouldn't kill the whole answer — skip it and keep reading.
                    continue;
                }

                if (chunk != null) yield return chunk;
            }
        }
    }
}
