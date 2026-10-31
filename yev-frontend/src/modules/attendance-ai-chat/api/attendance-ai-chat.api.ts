import { postStream } from "@/lib/client";
import type { AttendanceAiChatRequestDto } from "@/modules/attendance-ai-chat/types/attendance-ai-chat.dto";

const ATTENDANCE_AI_CHAT_ENDPOINT = "/AttendanceAiChat";

export const AttendanceAiChatApi = {
    // Returns the raw NDJSON Response (not ApiResponse<T>); read it with `readAiChatStream`.
    streamChat: (request: AttendanceAiChatRequestDto, signal?: AbortSignal): Promise<Response> =>
        postStream(`${ATTENDANCE_AI_CHAT_ENDPOINT}/stream`, request, { signal }),
};
