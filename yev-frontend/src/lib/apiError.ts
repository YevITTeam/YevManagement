/** `fetchClient` throws `new Error(rawJsonBody)`; reads its `message` field, else returns `fallback`. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        try {
            const parsed = JSON.parse(error.message) as { message?: unknown };
            if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
                return parsed.message;
            }
        } catch {
            // Not JSON — use the fallback below.
        }
    }
    return fallback;
}
