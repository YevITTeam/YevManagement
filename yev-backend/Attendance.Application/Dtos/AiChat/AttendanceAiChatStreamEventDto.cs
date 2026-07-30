namespace Attendance.Application.Dtos.AiChat
{
    // 1 line of the NDJSON stream sent back to the FE (mirrors Asset's AiChatStreamEventDto) — a
    // rewritten, simplified view that hides Ollama's raw chunk format and all tool-calling internals
    // from the client. Only the field relevant to `Type` is populated; the controller serializes with
    // JsonIgnoreCondition.WhenWritingNull so the others are dropped from the JSON line, not sent as null.
    public class AttendanceAiChatStreamEventDto
    {
        public string Type { get; set; } = null!;  // "content" | "tool" | "otform" | "done" | "error"
        public string? Text { get; set; }          // Type = "content": next chunk of the answer text
        public string? Name { get; set; }          // Type = "tool": tool name currently being called
        public string? Message { get; set; }       // Type = "error": human-readable error message
        public int? OtFormId { get; set; }         // Type = "otform": id of the just-created Draft

        public static AttendanceAiChatStreamEventDto Content(string text) => new() { Type = "content", Text = text };
        public static AttendanceAiChatStreamEventDto Tool(string name) => new() { Type = "tool", Name = name };
        public static AttendanceAiChatStreamEventDto OtForm(int otFormId) => new() { Type = "otform", OtFormId = otFormId };
        public static AttendanceAiChatStreamEventDto Done() => new() { Type = "done" };
        public static AttendanceAiChatStreamEventDto Error(string message) => new() { Type = "error", Message = message };
    }
}
