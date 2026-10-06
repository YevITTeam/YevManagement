using System.Text.Json.Nodes;
using Shared.Application.Dtos.AiChat;

namespace Shared.Application.Interfaces.External
{
    // Abstraction over the LLM server's OpenAI-compatible /v1/chat/completions endpoint (docs/
    // docs/docs-be/asset-module.md §1.18) — host/model/timeout are an implementation detail of the
    // Infrastructure-layer client (read from appsettings there), the orchestrator only deals with
    // messages in/chunks out.
    //
    // Shared by every module that runs a tool-calling chat (Asset AI Chat, Attendance AI Chat) — the
    // client itself holds no domain knowledge, which is exactly why `tools` is a parameter rather
    // than something the client reaches for: each module owns its own tool catalogue.
    //
    // Was IOllamaChatClient before the internal AI server moved from Ollama to LM Studio (2026-08-24)
    // — renamed since "Ollama" was no longer true of what this actually talks to.
    public interface ILlmChatClient
    {
        // `tools`: the module's own JSON-schema tool catalogue (OpenAI function-calling shape —
        // {type:"function", function:{name, description, parameters}} — unchanged by the Ollama→LM
        // Studio migration since Ollama already used this shape), sent as-is in the request's `tools`
        // field. IMPORTANT — the caller must pass a node it owns (typically
        // `MyToolDefinitions.Tools.DeepClone()`): a JsonNode can only ever be attached to 1 parent, so
        // handing over a cached/static node directly would throw the second time it is used.
        IAsyncEnumerable<ChatChunkWire> StreamChatAsync(
            List<ChatMessageWire> messages,
            JsonNode tools,
            bool think,
            CancellationToken cancellationToken);
    }
}
