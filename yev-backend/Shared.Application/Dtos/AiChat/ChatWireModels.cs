using System.Text.Json;
using System.Text.Json.Serialization;

namespace Shared.Application.Dtos.AiChat
{
    // Wire format for the OpenAI-compatible /v1/chat/completions API served by LM Studio (docs/
    // ai-chat-be-huong-dan.md §3) — intentionally separate from each module's own FE-facing chat DTOs
    // (AiChatMessageDto/AiChatStreamEventDto for Asset, AttendanceAiChat* for Attendance): this shape
    // is the LLM server's own vocabulary (role/content/tool_calls), not something any FE should ever
    // see directly.
    //
    // Was OllamaWireModels.cs / Ollama{Message,ToolCall,ToolCallFunction,ChatChunk}Wire before the
    // internal AI server moved from Ollama's /api/chat to LM Studio's /v1/chat/completions
    // (2026-08-24) — renamed since "Ollama" was no longer true of the shape. The one shape difference
    // that actually matters to callers: `arguments` is now a JSON-ENCODED STRING (OpenAI spec), not a
    // JSON object like Ollama sent, and tool calls now carry an `Id` that must be echoed back via
    // ToolCallId on the follow-up "tool" role message.
    //
    // Lives in Shared.Application because there are 2 real consumers — the Asset AI Chat orchestrator
    // and the Attendance AI Chat orchestrator.

    public class ChatMessageWire
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = null!; // "system" | "user" | "assistant" | "tool"

        [JsonPropertyName("content")]
        public string? Content { get; set; }

        // Only present on an "assistant" message when the model chose to call 1+ tools.
        [JsonPropertyName("tool_calls")]
        public List<ChatToolCallWire>? ToolCalls { get; set; }

        // Only present on a "tool" role message — must echo the Id of the ChatToolCallWire this
        // message is the result of (OpenAI Chat Completions spec). LmStudioChatClient has been seen
        // to accept a tool message without it too, but sending it is the spec-correct thing to do.
        [JsonPropertyName("tool_call_id")]
        public string? ToolCallId { get; set; }
    }

    public class ChatToolCallWire
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; } = "function";

        [JsonPropertyName("function")]
        public ChatToolCallFunctionWire Function { get; set; } = null!;
    }

    public class ChatToolCallFunctionWire
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;

        // JSON-ENCODED STRING (OpenAI wire format) — unlike Ollama, which sent this as a JSON object.
        // LM Studio streams it in fragments across multiple SSE chunks; LmStudioChatClient accumulates
        // those by index internally before ever exposing a ChatChunkWire with a completed ToolCalls
        // list to the orchestrator, so this field is always a complete, parseable JSON string by the
        // time any caller outside the client sees it.
        [JsonPropertyName("arguments")]
        public string Arguments { get; set; } = "";
    }

    // Completed chunk exposed to the orchestrator (Asset/Attendance *AiChatService) — one per content
    // fragment as it streams in, plus (at most) 1 final chunk carrying the fully-accumulated
    // ToolCalls once the model finishes deciding which tool(s) to call. This shape intentionally
    // matches what the Ollama-era client used to hand the orchestrator (Message.Content /
    // Message.ToolCalls) so the orchestrators needed no change when the wire protocol underneath was
    // swapped from Ollama to LM Studio.
    public class ChatChunkWire
    {
        public ChatMessageWire? Message { get; set; }
    }

    public static class ChatWireJson
    {
        public static readonly JsonSerializerOptions Options = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }
}
