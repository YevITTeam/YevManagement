using Asset.Application.Dtos.AiChat;

namespace Asset.Application.Interfaces.Service
{
    // Orchestrates 1 chat turn: calls Ollama, runs the tool-calling loop (max N rounds), streams back
    // a simplified event sequence the FE can render directly (docs/docs-be/asset-module.md §1.18).
    public interface IAiChatService
    {
        IAsyncEnumerable<AiChatStreamEventDto> StreamChatAsync(AiChatRequestDto request, CancellationToken cancellationToken);
    }
}
