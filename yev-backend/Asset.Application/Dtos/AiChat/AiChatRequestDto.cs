using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.AiChat
{
    public class AiChatRequestDto
    {
        [Required(ErrorMessage = "Nội dung câu hỏi không được để trống.")]
        public string Message { get; set; } = null!;

        // Whole prior conversation, resent every turn by the FE (stateless BE — no conversation table).
        public List<AiChatMessageDto> History { get; set; } = new();

        // Optional — user-editable system prompt from the FE UI (see docs/ai-chat-be-huong-dan.md §9).
        // Empty/omitted -> BE falls back to AiChatService.DefaultSystemPrompt.
        public string? SystemPrompt { get; set; }
    }
}
