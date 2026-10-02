namespace Attendance.Application.Dtos.AiChat
{
    // 1 message in the conversation, as the FE understands it — only "user"/"assistant". The FE keeps
    // the whole history and resends it every turn (stateless BE, see
    // docs/docs-be/attendance-module.md §AttendanceAiChat); it never sees "tool" role messages, those stay
    // internal to AttendanceAiChatService's orchestration loop.
    public class AttendanceAiChatMessageDto
    {
        public string Role { get; set; } = null!;
        public string Content { get; set; } = null!;
    }
}
