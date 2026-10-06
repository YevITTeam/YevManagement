namespace Asset.Application.Dtos.AiChat
{
    // 1 message in the conversation, as the FE understands it — only "user"/"assistant". The FE keeps
    // the whole history and resends it every turn (stateless BE, see docs/docs-be/asset-module.md §1.18);
    // it never sees "tool" role messages, those stay internal to AiChatService's orchestration loop.
    public class AiChatMessageDto
    {
        public string Role { get; set; } = null!;
        public string Content { get; set; } = null!;
    }
}
