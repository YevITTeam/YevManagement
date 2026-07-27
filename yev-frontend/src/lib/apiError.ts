/**
 * Trích xuất thông điệp lỗi thân thiện từ lỗi do `fetchClient` ném ra.
 *
 * `fetchClient` ném `new Error(errorBody)` với `errorBody` là body JSON gốc của
 * API (dạng `{ isSuccess, message, ... }`). Hàm này cố gắng đọc trường `message`
 * trong đó; nếu không phân tích được thì trả về `fallback`.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        try {
            const parsed = JSON.parse(error.message) as { message?: unknown };
            if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
                return parsed.message;
            }
        } catch {
            // error.message không phải JSON — dùng fallback bên dưới.
        }
    }
    return fallback;
}
