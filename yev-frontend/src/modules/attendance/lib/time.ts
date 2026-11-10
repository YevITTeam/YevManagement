// An end before the start means the next day. Works on "HH:mm" and "HH:mm:ss".
export function isOvernight(startTime: string, endTime: string): boolean {
    return Boolean(startTime && endTime) && endTime.slice(0, 5) < startTime.slice(0, 5);
}

// Rounds to 2 decimals and drops trailing zeros (2 -> "2h", 2.5 -> "2.5h").
export function formatHours(hours: number): string {
    const rounded = Math.round(hours * 100) / 100;
    return `${rounded}h`;
}
