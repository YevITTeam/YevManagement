// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) — falls back when the
// app is accessed over plain HTTP via LAN IP (e.g. http://10.45.1.181:3000).
export function randomClientId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
