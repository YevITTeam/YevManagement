using Asset.Application.Dtos.AiChat;

namespace Asset.Application.Interfaces.External
{
    // Abstraction over Ollama's /api/chat (docs/ai-chat-be-huong-dan.md §3) — host/model/timeout are
    // an implementation detail of the Infrastructure-layer client (read from appsettings there), the
    // orchestrator only deals with messages in/chunks out.
    public interface IOllamaChatClient
    {
        IAsyncEnumerable<OllamaChatChunkWire> StreamChatAsync(List<OllamaMessageWire> messages, CancellationToken cancellationToken);
    }
}
