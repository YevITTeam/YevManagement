export function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

export function formatBytes(value: number | null) {
    if (value === null || value === undefined) return "-";
    if (value < 1024) return `${value} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
}
