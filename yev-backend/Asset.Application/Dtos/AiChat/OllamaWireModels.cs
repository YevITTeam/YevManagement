using System.Text.Json;
using System.Text.Json.Serialization;

namespace Asset.Application.Dtos.AiChat
{
    // Wire format for Ollama's /api/chat (docs/ai-chat-be-huong-dan.md §3) — intentionally separate
    // from AiChatMessageDto/AiChatStreamEventDto (the FE-facing contract): this shape is Ollama's own
    // vocabulary (role/content/tool_calls, snake_case), not something the FE should ever see directly.

    public class OllamaMessageWire
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = null!; // "system" | "user" | "assistant" | "tool"

        [JsonPropertyName("content")]
        public string? Content { get; set; }

        // Only present on an "assistant" message when the model chose to call 1+ tools.
        [JsonPropertyName("tool_calls")]
        public List<OllamaToolCallWire>? ToolCalls { get; set; }
    }

    public class OllamaToolCallWire
    {
        [JsonPropertyName("function")]
        public OllamaToolCallFunctionWire Function { get; set; } = null!;
    }

    public class OllamaToolCallFunctionWire
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;

        // Ollama sends this as a JSON OBJECT (not a JSON-encoded string like OpenAI) — kept as raw
        // JsonElement so the tool executor can pull out whichever fields the specific tool needs.
        [JsonPropertyName("arguments")]
        public JsonElement Arguments { get; set; }
    }

    // 1 line of Ollama's NDJSON response stream. Only the fields the orchestrator actually needs are
    // mapped — eval_count/total_duration/etc. on the final chunk are ignored (unknown JSON properties
    // are skipped by System.Text.Json by default, no [JsonExtensionData] needed).
    public class OllamaChatChunkWire
    {
        [JsonPropertyName("message")]
        public OllamaMessageWire? Message { get; set; }

        [JsonPropertyName("done")]
        public bool Done { get; set; }
    }

    public static class OllamaJson
    {
        public static readonly JsonSerializerOptions Options = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }
}
