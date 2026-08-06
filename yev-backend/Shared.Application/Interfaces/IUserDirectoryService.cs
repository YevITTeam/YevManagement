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
    }
}
