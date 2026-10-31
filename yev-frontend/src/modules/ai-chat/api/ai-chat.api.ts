import { postStream } from "@/lib/client";
import type { AiChatRequestDto } from "@/modules/ai-chat/types/ai-chat.dto";

const AI_CHAT_ENDPOINT = "/AiChat";

export const AiChatApi = {
    // Returns the raw NDJSON Response (not ApiResponse<T>); read it with `readAiChatStream`.
    streamChat: (request: AiChatRequestDto, signal?: AbortSignal): Promise<Response> =>
        postStream(`${AI_CHAT_ENDPOINT}/stream`, request, { signal }),
};
