// Nhãn hiển thị + parse diff dùng chung cho AuditTrailList (grid-list toàn hệ thống) và
// DeviceAuditHistoryPanel (lịch sử theo 1 bản ghi) — docs/asset-api-fe.md §7b.
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

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export { formatAuditValue };
