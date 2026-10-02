using System.Text.Json;
using Attendance.Application.Dtos.AiChat;

namespace Attendance.Application.Interfaces.Service
{
    // Dispatches 1 tool call chosen by the model to the matching internal Attendance service
    // (docs/docs-be/attendance-module.md §AttendanceAiChat) and returns the JSON string to place in the
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

        // Pre-fetches every bounded reference list the caller could need (their create scopes, all OT
        // cases, all reasons, the employees of their scoped group) as a plain-text block injected into
        // the system prompt on EVERY turn — see docs §16. This exists because relying on the model to
        // look this data up via tools failed in production in 3 compounding ways: it fabricated whole
        // lists with wrong ids (a fake "TH1 (ID: 2)" when TH1 is really id 1, which would have silently
        // created a form with the wrong OT case), it burned the entire MaxToolRounds budget on lookups
        // before ever reaching create_ot_form_draft, and — because the FE only ever resends
        // user/assistant messages, never "tool" ones — it lost every earlier turn's lookup result and
        // then re-invented it rather than re-querying. Data that is small, static and always needed
        // belongs in the context deterministically, not behind a tool call the model may skip or lie about.
        // Never throws: on failure returns whatever was gathered plus an explicit warning line, because
        // degraded reference data must not take the whole chat down.
        Task<string> BuildReferenceContextAsync(AttendanceAiChatCallerContext caller, CancellationToken cancellationToken);
    }
}
