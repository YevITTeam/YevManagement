using System.Text.Json;
using Asset.Application.Dtos.AiChat;

namespace Asset.Application.Interfaces.Service
{
    // Dispatches 1 tool call chosen by the model to the matching internal Asset service (docs/ai-chat-be-huong-dan.md
    // §5) and returns the JSON string to place in the "tool" role message. Read-only: no tool here is
    // allowed to create/update/delete anything.
    public interface IAiChatToolExecutorService
    {
        // Never throws — any failure (unknown tool, not-found lookup, internal exception) is caught
        // and returned as a serialized {"error": "..."} object instead, per doc §4: a tool failing must
        // not break the surrounding ask-answer loop.
        Task<AiChatToolExecutionResult> ExecuteAsync(string toolName, JsonElement arguments, CancellationToken cancellationToken);
    }
}
