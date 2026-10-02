using Attendance.Application.Dtos.AiChat;

namespace Attendance.Application.Interfaces.Service
{
    // Orchestrates 1 chat turn against Ollama with tool-calling for OT-form creation (mirrors Asset's
    // IAiChatService) — docs/docs-be/attendance-module.md §AttendanceAiChat. `caller` (missing from
    // Asset's version) carries the acting user's identity, since unlike Asset's 17 read-only tools,
    // this feature's tools (especially create_ot_form_draft) need to know who is asking.
    public interface IAttendanceAiChatService
    {
        IAsyncEnumerable<AttendanceAiChatStreamEventDto> StreamChatAsync(
            AttendanceAiChatRequestDto request,
            AttendanceAiChatCallerContext caller,
            CancellationToken cancellationToken);
    }
}
