namespace Attendance.Domain.Entities;

// Người được Admin CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Bộ phận (2026-08-11, sửa
// 2026-08-11b: khoá theo EmployeeId thay vì UserName) — KHÔNG suy luận tự động theo Chức vụ (Trưởng
// phòng/GL/TL thường ít trực tiếp làm việc này, thực tế được giao cho 1 người khác phụ trách) — xem
// docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt". Chỉ được chọn
// trong số Employee đang thuộc ĐÚNG Bộ phận này (trực tiếp hoặc qua Group con) — validate ở
// DepartmentApprovalStepCoordinatorService.ReplaceAsync. Employee được chọn KHÔNG BẮT BUỘC đã có
// UserName (liên kết tài khoản đăng nhập) — quyền tương ứng chỉ có hiệu lực thật khi Admin liên kết
// UserName cho Employee đó sau này (tự động, xem EmployeeService.SyncAutoGrantedPermissionsCoreAsync).
// 1 Bộ phận có thể có nhiều người phụ trách, 1 Employee có thể phụ trách nhiều Bộ phận. TÁCH BIỆT
// HOÀN TOÀN với GroupApprovalStepCoordinator — phụ trách Bộ phận KHÔNG tự động có quyền với Nhóm con
// bên trong, phải gán riêng nếu cần. Quản lý kiểu "thay nguyên danh sách" (mirror JobTitlePermission)
// — không có Create/Update/Delete từng dòng riêng.
public partial class DepartmentApprovalStepCoordinator
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
