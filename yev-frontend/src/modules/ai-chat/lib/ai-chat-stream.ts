import type { AiChatStreamEvent } from "@/modules/ai-chat/types/ai-chat.dto";

// A network chunk may hold several lines or split one (even mid UTF-8 char, hence { stream: true }),
// so only text before the last "\n" is parsed and the rest is buffered.
export async function* readAiChatStream<TEvent = AiChatStreamEvent>(response: Response): AsyncGenerator<TEvent> {
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
            // Last piece has no "\n" yet — may be incomplete JSON, keep it for the next chunk.
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const event = parseEventLine<TEvent>(line);
                if (event) {
                    yield event;
                }
            }
        }

        // The final line may lack a trailing "\n".
        buffer += decoder.decode();
        const lastEvent = parseEventLine<TEvent>(buffer);
        if (lastEvent) {
            yield lastEvent;
        }
    } finally {
        // Release the connection even when aborted mid-stream.
        reader.releaseLock();
    }
}

function parseEventLine<TEvent>(line: string): TEvent | null {
    const trimmed = line.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed) as TEvent;
    } catch {
        // Skip bad lines rather than fail the whole answer — BE may cut the stream when the AI connection drops.
        console.warn("Bỏ qua dòng NDJSON không hợp lệ từ AI Chat:", trimmed);
        return null;
    }
}
