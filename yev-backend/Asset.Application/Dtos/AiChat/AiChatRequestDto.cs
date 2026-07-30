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

        // Optional (2026-07-27, §11) — opt-in "deep reasoning" toggle from the FE UI. Omitted/null ->
        // false (the measured-faster default, docs §3). The model IS "thinking"-capable
        // (`gemma4:e2b` reports "thinking" in its Ollama capability list), so true is a real request,
        // not a no-op — just ~7x slower per docs §3's measurement.
        public bool? Think { get; set; }
    }
}
