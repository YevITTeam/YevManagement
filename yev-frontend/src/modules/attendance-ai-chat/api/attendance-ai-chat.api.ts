import { postStream } from "@/lib/client";
import type { AttendanceAiChatRequestDto } from "@/modules/attendance-ai-chat/types/attendance-ai-chat.dto";

const ATTENDANCE_AI_CHAT_ENDPOINT = "/AttendanceAiChat";

export const AttendanceAiChatApi = {
    // Trả về Response còn nguyên body (application/x-ndjson) — dùng `readAiChatStream` (module
    // ai-chat, hàm generic dùng lại được) để đọc dần. Khác mọi API còn lại của dự án: KHÔNG return
    // `response.data` vì đây không phải ApiResponse<T>.
    streamChat: (request: AttendanceAiChatRequestDto, signal?: AbortSignal): Promise<Response> =>
        postStream(`${ATTENDANCE_AI_CHAT_ENDPOINT}/stream`, request, { signal }),
};
