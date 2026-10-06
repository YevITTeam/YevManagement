using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;
using Shared.Core.Exceptions;

namespace Shared.Infrastructure.External
{
    // Talks to LM Studio's OpenAI-compatible /v1/chat/completions (docs/docs-be/asset-module.md §1.18).
    // HttpClient is a typed client registered via AddHttpClient<ILlmChatClient, LmStudioChatClient>()
    // in CompanySystem.HostApi/Configurations/DependencyInjection.cs (BaseAddress/Timeout configured
    // there from appsettings AiChatSettings) — this class only knows the request/response shape.
    //
    // Was OllamaChatClient (talking to Ollama's /api/chat) before the internal AI server moved to LM
    // Studio (2026-08-24, verified against the real server at 10.45.6.70:1234 — model id discovered
    // via GET /v1/models is "google/gemma-4-e4b"). The 2 protocols differ in ways that matter here:
    //   - Ollama sent 1 complete NDJSON line per chunk with `message.tool_calls` fully formed the
    //     moment the model decided to call a tool. LM Studio streams OpenAI-style SSE ("data: {...}"
    //     lines, terminated by a literal "data: [DONE]") where tool call `arguments` arrive as
    //     fragments of a JSON-encoded STRING spread across multiple chunks, keyed by an `index` within
    //     the delta — they must be accumulated before they're valid JSON.
    //   - Ollama had no language-model-agnostic "thinking" toggle; LM Studio's llama.cpp server
    //     exposes reasoning depth via a `reasoning_effort` request field instead. Measured against
    //     gemma-4-e4b (2026-08-24): "none" ~50s / 0 reasoning tokens vs "high" ~86s / 317 reasoning
    //     tokens for the same prompt — same ~7x tradeoff docs §3 measured for Ollama's `think`, so
    //     `think` maps 1:1 onto "high"/"none" here.
    // This class hides both differences: it still exposes StreamChatAsync -> IAsyncEnumerable<ChatChunkWire>
    // with Message.Content per fragment and (at most) 1 final Message.ToolCalls once a round's tool
    // calls are fully accumulated — exactly what the Ollama-era client handed the orchestrator, so
    // AiChatService/AttendanceAiChatService needed no change to their streaming loop.
    public class LmStudioChatClient : ILlmChatClient
    {
        // Thấp để model bám sát tool schema hơn — xem giải thích gốc ở OllamaChatClient (lịch sử git),
        // vẫn đúng với LM Studio: nhiệt độ cao làm quyết định "có nên gọi tool không" kém nhất quán.
        private const double DefaultTemperature = 0.3;

        private readonly HttpClient _httpClient;
        private readonly string _model;
        private readonly double _temperature;

        public LmStudioChatClient(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _model = configuration["AiChatSettings:Model"] ?? "google/gemma-4-e4b";
            _temperature = configuration.GetValue<double?>("AiChatSettings:Temperature") ?? DefaultTemperature;
        }

        public async IAsyncEnumerable<ChatChunkWire> StreamChatAsync(
            List<ChatMessageWire> messages,
            JsonNode tools,
            bool think,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var requestBody = new JsonObject
            {
                ["model"] = _model,
                ["messages"] = JsonSerializer.SerializeToNode(messages, ChatWireJson.Options),
                // Caller-supplied catalogue — must already be a node the caller owns (see
                // ILlmChatClient's remark on DeepClone()), since a JsonNode can only ever be attached
                // to 1 parent at a time.
                ["tools"] = tools,
                ["stream"] = true,
                ["temperature"] = _temperature,
                // See the class remark above for the "none"/"high" ~ Ollama's think false/true mapping.
                ["reasoning_effort"] = think ? "high" : "none"
            };

            // Relative, NO leading slash — the typed HttpClient's BaseAddress already carries LM
            // Studio's "/v1/" path (DependencyInjection.cs normalizes it to end with "/"). A leading
            // slash here would make .NET's URI combining DROP the "/v1" segment instead of appending
            // to it (classic HttpClient BaseAddress gotcha) and hit the wrong path entirely.
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
            {
                Content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json")
            };

            using var response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new DomainException($"Không thể kết nối tới máy chủ AI (LM Studio), mã lỗi {(int)response.StatusCode}.");

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            // index (within this response's single choice) -> accumulated tool call so far. OpenAI
            // streams a tool call's `id`/`function.name` once (on its first fragment) and its
            // `function.arguments` progressively across many fragments — only a completed set is ever
            // surfaced to the caller, never a partial one.
            var toolCallAccumulators = new SortedDictionary<int, ToolCallAccumulator>();

            // NDJSON-style loop (docs §3 kept the same shape on purpose): loop on ReadLineAsync's own
            // null-at-EOF signal instead of checking `reader.EndOfStream` first (CA2024) — EndOfStream
            // blocks the calling thread synchronously waiting on the network, tying up thread-pool
            // threads instead of releasing them under concurrent chat requests.
            // Tracks the most recent "event:" line — LM Studio uses named SSE events for
            // out-of-band failures (verified 2026-08-24: a huge prompt made its internal engine call
            // fail after ~5 minutes, arriving as "event: error" + a "data:" line with the error detail,
            // NOT as a normal chat.completion.chunk). Reset on every blank line per the SSE spec (a
            // blank line ends the current event).
            string? pendingEvent = null;

            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) { pendingEvent = null; continue; }

                if (line.StartsWith("event:", StringComparison.Ordinal))
                {
                    pendingEvent = line["event:".Length..].Trim();
                    continue;
                }

                if (!line.StartsWith("data:", StringComparison.Ordinal)) continue; // other SSE fields (id:, retry:...) — ignore

                var payload = line["data:".Length..].Trim();

                if (pendingEvent == "error")
                {
                    var message = payload;
                    try
                    {
                        using var errorDoc = JsonDocument.Parse(payload);
                        if (errorDoc.RootElement.TryGetProperty("error", out var errorProp) &&
                            errorProp.TryGetProperty("message", out var errorMessageProp))
                            message = errorMessageProp.GetString() ?? payload;
                        else if (errorDoc.RootElement.TryGetProperty("message", out var messageProp))
                            message = messageProp.GetString() ?? payload;
                    }
                    catch (JsonException)
                    {
                        // Keep the raw payload as the message.
                    }

                    throw new DomainException($"Lỗi từ máy chủ AI (LM Studio): {message}");
                }

                if (payload == "[DONE]") break;

                SseLineWire? parsed;
                try
                {
                    parsed = JsonSerializer.Deserialize<SseLineWire>(payload, ChatWireJson.Options);
                }
                catch (JsonException)
                {
                    // A malformed line shouldn't kill the whole answer — skip it and keep reading.
                    continue;
                }

                var delta = parsed?.Choices?.FirstOrDefault()?.Delta;
                if (delta == null) continue;

                if (!string.IsNullOrEmpty(delta.Content))
                    yield return new ChatChunkWire { Message = new ChatMessageWire { Role = "assistant", Content = delta.Content } };

                if (delta.ToolCalls is not { Count: > 0 }) continue;

                foreach (var callDelta in delta.ToolCalls)
                {
                    if (!toolCallAccumulators.TryGetValue(callDelta.Index, out var acc))
                        toolCallAccumulators[callDelta.Index] = acc = new ToolCallAccumulator();

                    acc.Id ??= callDelta.Id;
                    acc.Name ??= callDelta.Function?.Name;
                    acc.Arguments.Append(callDelta.Function?.Arguments);
                }
            }

            if (toolCallAccumulators.Count == 0) yield break;

            var toolCalls = toolCallAccumulators.Values
                .Where(acc => !string.IsNullOrEmpty(acc.Name))
                .Select(acc => new ChatToolCallWire
                {
                    Id = acc.Id,
                    Type = "function",
                    Function = new ChatToolCallFunctionWire { Name = acc.Name!, Arguments = acc.Arguments.ToString() }
                })
                .ToList();

            if (toolCalls.Count > 0)
                yield return new ChatChunkWire { Message = new ChatMessageWire { Role = "assistant", ToolCalls = toolCalls } };
        }

        private class ToolCallAccumulator
        {
            public string? Id;
            public string? Name;
            public readonly StringBuilder Arguments = new();
        }

        // Raw SSE line shape ("choices[0].delta...") — purely a parsing internal, never surfaced
        // outside this class. Only the fields the client actually reads are mapped.
        private class SseLineWire
        {
            [JsonPropertyName("choices")]
            public List<SseChoiceWire>? Choices { get; set; }
        }

        private class SseChoiceWire
        {
            [JsonPropertyName("delta")]
            public SseDeltaWire? Delta { get; set; }
        }

        private class SseDeltaWire
        {
            [JsonPropertyName("content")]
            public string? Content { get; set; }

            [JsonPropertyName("tool_calls")]
            public List<SseToolCallDeltaWire>? ToolCalls { get; set; }
        }

        private class SseToolCallDeltaWire
        {
            [JsonPropertyName("index")]
            public int Index { get; set; }

            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("function")]
            public SseToolCallFunctionDeltaWire? Function { get; set; }
        }

        private class SseToolCallFunctionDeltaWire
        {
            [JsonPropertyName("name")]
            public string? Name { get; set; }

            [JsonPropertyName("arguments")]
            public string? Arguments { get; set; }
        }
    }
}
