// Mapping Chức vụ -> permission Identity tự động cấp cho người giữ Chức vụ đó (2026-08-10) — xem
// docs/docs-be/attendance-api-fe.md §JobTitlePermission. Chỉ chứa permission thuộc nhóm "tham gia
// quy trình" (GET /JobTitlePermission/allowed-codes trả đúng danh sách được phép chọn).
export interface JobTitlePermissionDto {
    id: number;
    jobTitleId: number;
    permissionCode: string;
}
