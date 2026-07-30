using System.Text.Json;
using Attendance.Application.Dtos.AiChat;

namespace Attendance.Application.Interfaces.Service
{
    // Dispatches 1 tool call chosen by the model to the matching internal Attendance service
    // (docs/docs-be/attendance-aichat-be-huong-dan.md §5) and returns the JSON string to place in the
    // "tool" role message. Unlike Asset's IAiChatToolExecutorService (17 read-only tools), exactly 1
    // tool here (create_ot_form_draft) WRITES data — it calls the exact same
    // IOtFormService.CreateAsync used by the manual "Tạo đơn tăng ca" screen, no duplicated business
    // logic. `caller` carries the acting user's identity (Attendance.Application has no
    // IHttpContextAccessor anywhere — identity is always threaded explicitly, see
    // AttendanceAiChatCallerContext).
    public interface IAttendanceAiChatToolExecutorService
    {
        // Never throws — any failure (unknown tool, validation/scope DomainException from CreateAsync,
        // not-found lookup, internal exception) is caught and returned as a serialized
        // {"error": "..."} object instead: a tool failing must not break the surrounding ask-answer loop.
        Task<AttendanceAiChatToolExecutionResult> ExecuteAsync(
            string toolName, JsonElement arguments, AttendanceAiChatCallerContext caller, CancellationToken cancellationToken);
    }
}
