// Schema theo docs/asset-module.md §4 — lịch sử Create/Update/Delete/Restore, ghi tự động ở BE,
// FE chỉ đọc. oldValues/newValues là chuỗi JSON {field: value} (chỉ field thực sự đổi), null khi
// không áp dụng (vd Create không có oldValues) — FE tự JSON.parse nếu muốn hiển thị diff đẹp.
export interface AuditTrailDto {
    id: number;
    tableName: string;
    recordId: number;
    // Đối tượng bị tác động, BE tự dựng sẵn để hiển thị thẳng lên grid (cột "Đối tượng"):
    // "PC-001 - Máy kế toán", "192.168.1.5 (PC-001)", "192.168.1.x"...
    recordName: string;
    // Số bản ghi mà dòng log này đại diện. 1 = thao tác đơn lẻ (đọc oldValues/newValues bình
    // thường). >1 = thao tác hàng loạt đã gộp (vd tạo dải IP) — khi đó oldValues=null và
    // newValues là chuỗi JSON của AuditTrailBulkValuesDto thay vì diff field thường.
    affectedCount: number;
    action: string; // "Create" | "Update" | "Delete" | "Restore"
    oldValues: string | null;
    newValues: string | null;
    changedBy: string;
    changedAt: string;
}

// Shape của newValues (sau khi JSON.parse) khi affectedCount > 1 (docs §7b.1).
// recordNames tối đa 50 phần tử — truncated=true nghĩa là còn nữa (không hiện hết).
export interface AuditTrailBulkValuesDto {
    affectedCount: number;
    recordIds: number[];
    recordNames: string[];
    truncated: boolean;
}
