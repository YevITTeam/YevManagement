using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.AiChat
{
    public class AttendanceAiChatRequestDto
    {
        [Required(ErrorMessage = "Nội dung câu hỏi không được để trống.")]
        public string Message { get; set; } = null!;

        // Whole prior conversation, resent every turn by the FE (stateless BE — no conversation table).
        public List<AttendanceAiChatMessageDto> History { get; set; } = new();

        // Optional — user-editable system prompt from the FE UI. Empty/omitted -> BE falls back to
        // AttendanceAiChatService.DefaultSystemPrompt.
        public string? SystemPrompt { get; set; }

        // Optional "deep reasoning" toggle, same knob as the Asset AI Chat (docs/docs-be/asset-module.md §1.18
        // §11) — omitted/null -> false (measured-faster default).
        public bool? Think { get; set; }
    }
}
