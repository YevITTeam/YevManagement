namespace Shared.Application.Interfaces
{
    // Contract dùng chung để module khác (Attendance...) tra cứu Email/FullName/Role của 1 UserName
    // mà KHÔNG cần ProjectReference trực tiếp tới Identity.Application — implementation thật nằm ở
    // Identity.Application (nơi có quyền truy cập IIdentityUnitOfWork), Scrutor tự nối dây lúc DI.
    public interface IUserDirectoryService
    {
        // Trả (null, null) nếu không tìm thấy UserName — không throw, để caller tự quyết định bỏ qua
        // (VD không gửi được email thì vẫn không nên chặn nghiệp vụ chính).
        Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName);

        // Danh sách UserName đang giữ đúng Role này (không phân biệt hoa/thường theo RoleName) —
        // dùng để gửi email cho toàn bộ Tổng Giám Đốc (không có UserApprovalScope để tra như
        // DepartmentManager/WorkshopManager).
        Task<List<string>> GetUserNamesInRoleAsync(string roleName);
    }
}
