// Danh sách 51 mã permission là cố định (seed qua migration BE) — FE chỉ đọc, không tạo/sửa/xoá Permission.
// Xem docs/identity-api-fe.md §4.7.
export interface PermissionDto {
    id: number;
    code: string;
    module: string;
    description: string;
}
