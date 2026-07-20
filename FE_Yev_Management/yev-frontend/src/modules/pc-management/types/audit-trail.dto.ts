// Schema theo docs/asset-api-fe.md §7b — lịch sử Create/Update/Delete/Restore, ghi tự động ở BE,
// FE chỉ đọc. oldValues/newValues là chuỗi JSON {field: value} (chỉ field thực sự đổi), null khi
// không áp dụng (vd Create không có oldValues) — FE tự JSON.parse nếu muốn hiển thị diff đẹp.
export interface AuditTrailDto {
    id: number;
    tableName: string;
    recordId: number;
    action: string; // "Create" | "Update" | "Delete" | "Restore"
    oldValues: string | null;
    newValues: string | null;
    changedBy: string;
    changedAt: string;
}
