using System.Text.Json;
using Attendance.Application.Dtos.AiChat;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;

namespace Attendance.Api.Controllers
{
    // Streaming NDJSON endpoint for the Attendance AI Chat (create OT form via conversation) —
    // deliberately does NOT use Success()/Fail() (ApiResponse<T> wrapper) like every other Attendance
    // controller, same precedented exception as Asset's AiChatController: the response body is a
    // sequence of independent JSON lines written incrementally as Ollama answers, not a single
    // envelope available only at the end (see docs/docs-be/attendance-aichat-be-huong-dan.md).
    //
    // Unlike Asset's AiChatController, this one MUST resolve the acting user's identity here (same
    // pattern as OtFormController.Create) and thread it down to the orchestrator — the create tool
    // needs to know exactly who is asking to enforce the same scope rules as the manual create screen.
    public class AttendanceAiChatController : BaseController
    {
        private const string AdminRole = "Admin";

        private static readonly JsonSerializerOptions StreamJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        private readonly IAttendanceAiChatService _attendanceAiChatService;

        public AttendanceAiChatController(IAttendanceAiChatService attendanceAiChatService)
        {
            _attendanceAiChatService = attendanceAiChatService;
        }

        [RequirePermission("Attendance.AiChat.Use")]
        [HttpPost("stream")]
        public async Task Stream([FromBody] AttendanceAiChatRequestDto request, CancellationToken cancellationToken)
        {
            Response.ContentType = "application/x-ndjson; charset=utf-8";
            Response.Headers.CacheControl = "no-cache";

            var caller = new AttendanceAiChatCallerContext
            {
                UserName = CurrentUserName,
                FullName = CurrentFullName,
                IsAdmin = User.IsInRole(AdminRole)
            };

            // From here on, headers are about to be sent with each write — any exception must be
            // turned into an {"type":"error"} line instead of being thrown, since the global exception
            // middleware can no longer set a status code / write a normal JSON error body once
            // streaming started.
            try
            {
                await foreach (var streamEvent in _attendanceAiChatService.StreamChatAsync(request, caller, cancellationToken))
                {
                    var line = JsonSerializer.Serialize(streamEvent, StreamJsonOptions);
                    await Response.WriteAsync(line + "\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                var errorLine = JsonSerializer.Serialize(AttendanceAiChatStreamEventDto.Error(ex.Message), StreamJsonOptions);
                await Response.WriteAsync(errorLine + "\n", CancellationToken.None);
                await Response.Body.FlushAsync(CancellationToken.None);
            }
        }
    }
}
