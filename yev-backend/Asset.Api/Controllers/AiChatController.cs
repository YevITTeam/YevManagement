using System.Text.Json;
using Asset.Application.Dtos.AiChat;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;

namespace Asset.Api.Controllers
{
    // Streaming NDJSON endpoint — deliberately does NOT use Success()/Fail() (ApiResponse<T> wrapper)
    // like every other Asset controller: the response body is a sequence of independent JSON lines
    // written incrementally as Ollama answers, not a single envelope available only at the end (see
    // docs/docs-be/asset-module.md §1.18). Still inherits BaseController purely for the shared
    // [ApiController]/[Route("api/[controller]")] routing convention.
    public class AiChatController : BaseController
    {
        private static readonly JsonSerializerOptions StreamJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        private readonly IAiChatService _aiChatService;

        public AiChatController(IAiChatService aiChatService)
        {
            _aiChatService = aiChatService;
        }

        [RequirePermission("Asset.AiChat.Use")]
        [HttpPost("stream")]
        public async Task Stream([FromBody] AiChatRequestDto request, CancellationToken cancellationToken)
        {
            Response.ContentType = "application/x-ndjson; charset=utf-8";
            Response.Headers.CacheControl = "no-cache";

            // From here on, headers are about to be sent with each write — any exception must be
            // turned into an {"type":"error"} line instead of being thrown, since HandleExceptionMiddleware
            // can no longer set a status code / write a normal JSON error body once streaming started.
            try
            {
                await foreach (var streamEvent in _aiChatService.StreamChatAsync(request, cancellationToken))
                {
                    var line = JsonSerializer.Serialize(streamEvent, StreamJsonOptions);
                    await Response.WriteAsync(line + "\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                var errorLine = JsonSerializer.Serialize(AiChatStreamEventDto.Error(ex.Message), StreamJsonOptions);
                await Response.WriteAsync(errorLine + "\n", CancellationToken.None);
                await Response.Body.FlushAsync(CancellationToken.None);
            }
        }
    }
}
