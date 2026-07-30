namespace Attendance.Application.Dtos.AiChat
{
    // Structured result of 1 tool call (mirrors Asset's AiChatToolExecutionResult). `Json` is what
    // still goes into the "tool" role message sent back to Ollama; `CreatedOtFormId` is extra metadata
    // used ONLY by AttendanceAiChatService to emit a {"type":"otform"} stream event for the FE's
    // deep-link button — it never reaches the model. Nullable (not a list, unlike Asset's
    // DeviceReferences) because at most 1 form is ever created per tool call — the create tool is only
    // ever called once per confirmed intent, per the confirmation-gating design.
    public class AttendanceAiChatToolExecutionResult
    {
        public string Json { get; set; } = null!;
        public int? CreatedOtFormId { get; set; }
    }
}
