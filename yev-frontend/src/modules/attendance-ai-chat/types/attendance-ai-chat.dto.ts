// Hợp đồng với BE: docs/docs-be/attendance-module.md §API (POST /api/AttendanceAiChat/stream).
// BE KHÔNG lưu hội thoại — FE tự giữ `history` và gửi lại toàn bộ mỗi lượt. Cùng hình dạng với
// modules/ai-chat/types/ai-chat.dto.ts (tính năng AI Chat của Asset) nhưng KHÔNG dùng chung file —
// đây là 1 hợp đồng BE riêng (endpoint riêng, permission riêng), giữ đúng ranh giới module.

export type AttendanceAiChatRole = "user" | "assistant";

export interface AttendanceAiChatMessageDto {
    role: AttendanceAiChatRole;
    content: string;
}

export interface AttendanceAiChatRequestDto {
    message: string;
    history: AttendanceAiChatMessageDto[];
    /** Bỏ trống/null thì BE dùng system prompt mặc định. */
    systemPrompt?: string | null;
    /** Bỏ trống/null = false (mặc định nhanh hơn). true = bật suy luận sâu (chậm hơn nhiều). */
    think?: boolean;
}

// 5 dạng dòng NDJSON BE trả về. Field không áp dụng cho `type` đó bị LƯỢC khỏi JSON (không phải
// null) nên phải phân biệt bằng `type`, đừng giả định field luôn có mặt. Biến thể "otform" thay cho
// "device" của Asset — id của đơn tăng ca (Draft) vừa được tool create_ot_form_draft tạo thật.
export type AttendanceAiChatStreamEvent =
    | { type: "content"; text: string }
    | { type: "tool"; name: string }
    | { type: "otform"; otFormId: number }
    | { type: "done" }
    | { type: "error"; message: string };
