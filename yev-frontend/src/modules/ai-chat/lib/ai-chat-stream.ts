import type { AiChatStreamEvent } from "@/modules/ai-chat/types/ai-chat.dto";

// Đọc body NDJSON (mỗi dòng 1 JSON, kết thúc bằng "\n") thành từng event một.
//
// Vì sao phải tự gom buffer: 1 chunk mạng KHÔNG tương ứng 1 dòng — có thể chứa nhiều dòng, hoặc
// cắt ngang giữa một dòng (thậm chí giữa 1 ký tự UTF-8 nhiều byte, nên TextDecoder phải dùng
// { stream: true }). Chỉ parse phần trước dấu "\n" cuối cùng, phần dư giữ lại cho chunk sau.
export async function* readAiChatStream(response: Response): AsyncGenerator<AiChatStreamEvent> {
    if (!response.body) {
        throw new Error("Trình duyệt không hỗ trợ đọc stream từ máy chủ.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            // Phần tử cuối là mẩu chưa thấy "\n" → chưa chắc đủ 1 JSON, giữ lại cho vòng sau.
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const event = parseEventLine(line);
                if (event) {
                    yield event;
                }
            }
        }

        // Dòng cuối cùng có thể không kèm "\n" — flush nốt phần còn trong buffer.
        buffer += decoder.decode();
        const lastEvent = parseEventLine(buffer);
        if (lastEvent) {
            yield lastEvent;
        }
    } finally {
        // Hủy giữa chừng (người dùng bấm Dừng / rời trang) vẫn phải nhả kết nối.
        reader.releaseLock();
    }
}

const parseEventLine = (line: string): AiChatStreamEvent | null => {
    const trimmed = line.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed) as AiChatStreamEvent;
    } catch {
        // Dòng hỏng thì bỏ qua thay vì làm hỏng cả lượt trả lời — BE có thể cắt stream giữa chừng
        // khi mất kết nối tới AI, lúc đó mẩu JSON dở dang là bình thường.
        console.warn("Bỏ qua dòng NDJSON không hợp lệ từ AI Chat:", trimmed);
        return null;
    }
};
