// BE guarantees endTime > startTime (no overnight), so Math.max only guards odd legacy data.
export function calculateHours(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const minutes = endH * 60 + endM - (startH * 60 + startM);
    return Math.max(0, minutes / 60);
}

// Rounds to 2 decimals and drops trailing zeros (2 -> "2h", 2.5 -> "2.5h").
export function formatHours(hours: number): string {
    const rounded = Math.round(hours * 100) / 100;
    return `${rounded}h`;
}
