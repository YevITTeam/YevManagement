// Danh sách 52 mã permission là cố định (seed qua migration BE) — FE chỉ đọc, không tạo/sửa/xoá Permission.
// Xem docs/identity-api-fe.md §4.7.
export interface PermissionDto {
    id: number;
    code: string;
    module: string;
    description: string;
}

// Override permission riêng theo User — đè lên permission suy ra từ Role của họ.
// isGranted=false: đang bị THU HỒI riêng dù Role có cấp. isGranted=true: đang được CẤP THÊM riêng dù Role không cấp.
// Xem docs/identity-api-fe.md §4.8.
export interface UserPermissionOverrideDto {
    permissionId: number;
    code: string;
    module: string;
    description: string;
    isGranted: boolean;
}

// body PUT /api/Permission/user/{userId} — TOÀN BỘ override sau cùng (thay thế hết override cũ).
// 1 permission id không được xuất hiện ở cả 2 mảng cùng lúc (BE trả 400).
export interface UpdateUserPermissionOverridesDto {
    grantPermissionIds: number[];
    denyPermissionIds: number[];
}
