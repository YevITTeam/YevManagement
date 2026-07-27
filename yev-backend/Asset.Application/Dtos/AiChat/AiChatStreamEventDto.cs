namespace Asset.Application.Dtos.AiChat
{
    // 1 line of the NDJSON stream sent back to the FE (docs/ai-chat-be-huong-dan.md §7) — a rewritten,
    // simplified view that hides Ollama's raw chunk format and all tool-calling internals from the
    // client. Only the field relevant to `Type` is populated; the controller serializes with
    // JsonIgnoreCondition.WhenWritingNull so the others are dropped from the JSON line, not sent as null.
    public class AiChatStreamEventDto
    {
        public string Type { get; set; } = null!;  // "content" | "tool" | "done" | "error"
        public string? Text { get; set; }          // Type = "content": next chunk of the answer text
        public string? Name { get; set; }          // Type = "tool": tool name currently being called
        public string? Message { get; set; }       // Type = "error": human-readable error message

        public static AiChatStreamEventDto Content(string text) => new() { Type = "content", Text = text };
        public static AiChatStreamEventDto Tool(string name) => new() { Type = "tool", Name = name };
        public static AiChatStreamEventDto Done() => new() { Type = "done" };
        public static AiChatStreamEventDto Error(string message) => new() { Type = "error", Message = message };
    }
}
