using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Dtos.Departments;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepService
    {
        // userName/isAdmin dùng để scope-check (2026-08-11) — Admin xem/sửa được mọi Bộ phận, người
        // không phải Admin chỉ xem/sửa được Bộ phận mình được gán phụ trách (xem
        // DepartmentApprovalStepCoordinator, docs/docs-be/attendance-module.md §Cây chức vụ).
        Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId);
        Task<List<DepartmentApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceDepartmentApprovalStepsDto request);

        // Danh sách Bộ phận để hiện lên dropdown chọn ở màn "Cây duyệt" — Admin thấy TOÀN BỘ, người
        // phụ trách (Coordinator) chỉ thấy đúng (các) Bộ phận mình được gán, tránh chọn nhầm rồi bị
        // 403 khi gọi GetByDepartment/Replace (2026-08-25, yêu cầu người dùng).
        Task<List<ApprovalTreeDepartmentDto>> GetMyManagedDepartmentsAsync(string userName, bool isAdmin);
    }
}
