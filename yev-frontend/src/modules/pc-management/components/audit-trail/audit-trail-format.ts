// Nhãn hiển thị + parse diff dùng chung cho AuditTrailList (grid-list toàn hệ thống) và
// DeviceAuditHistoryPanel (lịch sử theo 1 bản ghi) — docs/asset-module.md §4
export const auditActionLabels: Record<string, string> = {
    Create: "Tạo mới",
    Update: "Cập nhật",
    Delete: "Xoá",
    Restore: "Khôi phục",
};

export const auditActionClasses: Record<string, string> = {
    Create: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    Update: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    Delete: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
    Restore: "border border-[#cfe0fb] bg-[#eef4ff] text-[#1d4ed8]",
};

export function parseAuditValues(json: string | null): Record<string, unknown> | null {
    if (!json) return null;
    try {
        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

// Shape gộp hàng loạt (docs §7b.1). BE có thể serialize key theo PascalCase (RecordNames,
// AffectedCount...) hoặc camelCase → đọc gần đúng theo cả 2 kiểu, chỉ nhận khi có mảng recordNames.
export interface NormalizedBulkValues {
    affectedCount: number;
    recordNames: string[];
    truncated: boolean;
}

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
    for (const key of keys) {
        if (source[key] !== undefined) return source[key] as T;
    }
    return undefined;
}

export function parseBulkAuditValues(json: string | null): NormalizedBulkValues | null {
    const parsed = parseAuditValues(json);
    if (!parsed) return null;
    const recordNames = pick<unknown>(parsed, "recordNames", "RecordNames");
    if (!Array.isArray(recordNames)) return null;
    const names = recordNames.map((name) => String(name));
    const affectedCount = pick<number>(parsed, "affectedCount", "AffectedCount") ?? names.length;
    const truncated = pick<boolean>(parsed, "truncated", "Truncated") ?? false;
    return { affectedCount, recordNames: names, truncated };
}

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export { formatAuditValue };
