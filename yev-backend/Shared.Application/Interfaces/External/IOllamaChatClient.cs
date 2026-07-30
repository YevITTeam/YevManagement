using System.Text.Json.Nodes;
using Shared.Application.Dtos.AiChat;

namespace Shared.Application.Interfaces.External
{
    // Abstraction over Ollama's /api/chat (docs/ai-chat-be-huong-dan.md §3) — host/model/timeout are
    // an implementation detail of the Infrastructure-layer client (read from appsettings there), the
    // orchestrator only deals with messages in/chunks out.
    //
    // Shared by every module that runs a tool-calling chat (Asset AI Chat, Attendance AI Chat) — the
    // client itself holds no domain knowledge, which is exactly why `tools` is a parameter rather
    // than something the client reaches for: each module owns its own tool catalogue.
    public interface IOllamaChatClient
    {
        // `tools`: the module's own JSON-schema tool catalogue, sent as Ollama's `tools` field.
        // IMPORTANT — the caller must pass a node it owns (typically `MyToolDefinitions.Tools.DeepClone()`):
        // a JsonNode can only ever be attached to 1 parent, so handing over a cached/static node
        // directly would throw the second time it is used.
        IAsyncEnumerable<OllamaChatChunkWire> StreamChatAsync(
            List<OllamaMessageWire> messages,
            JsonNode tools,
            bool think,
            CancellationToken cancellationToken);
    }
}
