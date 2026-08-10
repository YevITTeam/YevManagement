namespace Attendance.Domain.Entities;

// Mapping Chức vụ -> danh sách permission Identity tự động cấp cho người giữ Chức vụ đó (2026-08-10)
// — chỉ nhận permission trong JobTitlePermissionWhitelist (nhóm "tham gia quy trình"), validate ở
// JobTitlePermissionService.ReplaceAsync. PermissionCode lưu dạng CHUỖI (không FK) vì bảng
// Permissions nằm ở DB Identity (YevIdentityManagement) khác hẳn DB Attendance (YevOTManagement) —
// không FK được xuyên database. Đồng bộ thật (ghi/xoá UserPermission bên Identity) diễn ra ở
// EmployeeService (khi đổi JobTitleId/UserName của 1 Employee) và JobTitlePermissionService.ReplaceAsync
// (khi sửa mapping) qua IUserDirectoryService.SyncAutoGrantedPermissionsAsync — xem
// docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ". Quản lý kiểu "thay
// nguyên danh sách" — không có Create/Update/Delete từng dòng riêng (mirror GroupApprovalStep).
public partial class JobTitlePermission
{
    public int Id { get; set; }

    public int JobTitleId { get; set; }

    public string PermissionCode { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual JobTitle JobTitle { get; set; } = null!;
}
