using System.Text.Json;
using Attendance.Application.Dtos.AiChat;

namespace Attendance.Application.Interfaces.Service
{
    // create_ot_form_draft writes data by calling the same IOtFormService.CreateAsync as the manual screen.
    // Identity is threaded via `caller` because Attendance.Application has no IHttpContextAccessor.
    public interface IAttendanceAiChatToolExecutorService
    {
        // Never throws: failures are returned as {"error": "..."} so one bad tool call doesn't break the chat loop.
        Task<AttendanceAiChatToolExecutionResult> ExecuteAsync(
            string toolName, JsonElement arguments, AttendanceAiChatCallerContext caller, CancellationToken cancellationToken);

        // Injected every turn because the model, left to look these up via tools, fabricated ids and lost earlier results.
        // Never throws: returns partial data plus a warning line on failure.
        Task<string> BuildReferenceContextAsync(AttendanceAiChatCallerContext caller, CancellationToken cancellationToken);
    }
}
