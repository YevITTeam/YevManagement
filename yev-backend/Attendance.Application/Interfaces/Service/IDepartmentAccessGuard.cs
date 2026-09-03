namespace Attendance.Application.Interfaces.Service
{
    // Kiểm tra 1 tài khoản có được phép quản trị dữ liệu của 1 Phòng ban cụ thể hay không — dùng chung
    // cho mọi tính năng "người phụ trách Phòng ban" (cây duyệt, nhân sự dưới chuyền, lũy kế, giới hạn
    // OT). Trích ra từ DepartmentApprovalStepService.EnsureCanManageDepartmentAsync (2026-08-29) để 3+
    // nơi dùng chung 1 bản logic bảo mật, tránh lệch nhau — xem docs/docs-be/attendance-module.md
    // §Phân quyền theo Phòng ban.
    public interface IDepartmentAccessGuard
    {
        // Admin (isAdmin=true) luôn qua. Không phải Admin: bắt buộc có dòng
        // DepartmentApprovalStepCoordinator đúng departmentId đó (Admin gán tay, KHÔNG suy luận theo
        // Chức vụ) — ném DomainException nếu không đủ điều kiện.
        Task EnsureCanManageDepartmentAsync(string userName, bool isAdmin, int departmentId);

        // Danh sách DepartmentId mà userName đang là Coordinator — dùng cho chỗ cần scope THEO TỪNG
        // DÒNG dữ liệu tự do (VD ApplyAccumulationAsync nhận EmployeeCode tự do từ file Excel, không
        // hardcode 1 Phòng ban như ProductionEmployeeImportService). Admin gọi hàm này không có ý nghĩa
        // (nên bỏ qua, luôn tự xử lý bypass ở nơi gọi).
        Task<HashSet<int>> GetManagedDepartmentIdsAsync(string userName);
    }
}
