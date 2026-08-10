namespace Shared.Application.Interfaces
{
    // Contract dùng chung để module khác (Attendance...) tra cứu Email/FullName/quyền của 1 UserName
    // mà KHÔNG cần ProjectReference trực tiếp tới Identity.Application — implementation thật nằm ở
    // Identity.Application (nơi có quyền truy cập IIdentityUnitOfWork), Scrutor tự nối dây lúc DI.
    public interface IUserDirectoryService
    {
        // Trả (null, null) nếu không tìm thấy UserName — không throw, để caller tự quyết định bỏ qua
        // (VD không gửi được email thì vẫn không nên chặn nghiệp vụ chính).
        Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName);

        // 1 UserName cụ thể có đang có (effective) permission này không — tính CẢ UserPermissionOverride
        // (grant/deny riêng từng người), không chỉ permission suy ra từ Role, cùng công thức với JWT claim
        // (Identity.Infrastructure/Authentication/MyClaimsTransformation.cs). Thay cho IsUserInRoleAsync/
        // GetUserNamesInRoleAsync (xoá 2026-08-05) — kể từ khi khu vực OT chỉ còn 1 Role trên Identity
        // (`Quản lý tăng ca`), luật "ai được gán quyền duyệt ở cấp nào" không còn tra được theo tên Role
        // nữa, phải tra theo permission (xem docs/attendance-module.md).
        Task<bool> UserHasPermissionAsync(string userName, string permissionCode);

        // Đồng bộ permission "tự động cấp theo Chức vụ" cho 1 UserName (2026-08-10 — xem
        // docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ"). Gọi mỗi khi
        // Attendance.EmployeeService lưu 1 Employee mà JobTitleId/UserName đổi, và mỗi khi
        // JobTitlePermissionService.ReplaceAsync sửa mapping của 1 Chức vụ.
        //   - userName null/rỗng hoặc không khớp User nào ở Identity → no-op (nhân viên chưa có tài
        //     khoản đăng nhập để cấp — khi sau này UserName được gán, lần sync tiếp theo sẽ tự cấp,
        //     không cần thao tác gì thêm).
        //   - desiredPermissionCodes RỖNG → thu hồi hết mọi permission đang IsAutoGranted=true của
        //     user đó (dùng khi gỡ Chức vụ, đổi UserName sang người khác, hoặc xoá Employee).
        //   - Chỉ ghi/xoá các dòng UserPermission có IsAutoGranted=true — KHÔNG BAO GIỜ đụng tới dòng
        //     Admin cấp tay qua "Tuỳ chỉnh quyền" (IsAutoGranted=false), dù trùng permission.
        Task SyncAutoGrantedPermissionsAsync(string? userName, IReadOnlyCollection<string> desiredPermissionCodes);
    }
}
