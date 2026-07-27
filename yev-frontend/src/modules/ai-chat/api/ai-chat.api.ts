import { postStream } from "@/lib/client";
import type { AiChatRequestDto } from "@/modules/ai-chat/types/ai-chat.dto";

const AI_CHAT_ENDPOINT = "/AiChat";

export const AiChatApi = {
    // Trả về Response còn nguyên body (application/x-ndjson) — dùng `readAiChatStream` để đọc dần.
    // Khác mọi API còn lại của dự án: KHÔNG return `response.data` vì đây không phải ApiResponse<T>.
    streamChat: (request: AiChatRequestDto, signal?: AbortSignal): Promise<Response> =>
        postStream(`${AI_CHAT_ENDPOINT}/stream`, request, { signal }),
};
