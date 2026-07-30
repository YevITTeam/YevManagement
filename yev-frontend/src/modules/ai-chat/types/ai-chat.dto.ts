// Hợp đồng với BE: docs/docs-be/asset-api-fe.md §7c (POST /api/AiChat/stream).
// BE KHÔNG lưu hội thoại — FE tự giữ `history` và gửi lại toàn bộ mỗi lượt.

export type AiChatRole = "user" | "assistant";

export interface AiChatMessageDto {
    role: AiChatRole;
    content: string;
}

export interface AiChatRequestDto {
    message: string;
    history: AiChatMessageDto[];
    /** Bỏ trống/null thì BE dùng system prompt mặc định. */
    systemPrompt?: string | null;
    /** Bỏ trống/null = false (mặc định nhanh hơn). true = bật suy luận sâu (chậm hơn nhiều). */
    think?: boolean;
}

// 5 dạng dòng NDJSON BE trả về. Field không áp dụng cho `type` đó bị LƯỢC khỏi JSON (không phải
// null) nên phải phân biệt bằng `type`, đừng giả định field luôn có mặt.
export type AiChatStreamEvent =
    | { type: "content"; text: string }
    | { type: "tool"; name: string }
    | { type: "device"; deviceId: number; deviceCode: string }
    | { type: "done" }
    | { type: "error"; message: string };
