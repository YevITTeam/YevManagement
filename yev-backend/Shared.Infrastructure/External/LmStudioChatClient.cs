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
    // LM Studio streams OpenAI-style SSE where tool-call arguments arrive as string fragments keyed by index;
    // they are accumulated and surfaced as one final Message.ToolCalls so callers see complete calls only.
    public class LmStudioChatClient : ILlmChatClient
    {
        // Low temperature keeps the model's "call a tool or not" decision consistent with the tool schema.
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
                // Must be a node the caller owns: a JsonNode can only be attached to one parent.
                ["tools"] = tools,
                ["stream"] = true,
                ["temperature"] = _temperature,
                ["reasoning_effort"] = think ? "high" : "none"
            };

                // No leading slash: it would make URI combining drop the "/v1/" segment of BaseAddress.
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
            {
                Content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json")
            };

            using var response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new DomainException($"Không thể kết nối tới máy chủ AI (LM Studio), mã lỗi {(int)response.StatusCode}.");

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            // Tool-call id/name arrive on the first fragment, arguments across many; only completed calls are surfaced.
            var toolCallAccumulators = new SortedDictionary<int, ToolCallAccumulator>();

            // ReadLineAsync's null-at-EOF instead of EndOfStream, which blocks synchronously on the network (CA2024).
            // LM Studio reports engine failures as a named "event: error" SSE event; reset on blank line per SSE spec.
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

        // Only the fields this client reads are mapped.
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
