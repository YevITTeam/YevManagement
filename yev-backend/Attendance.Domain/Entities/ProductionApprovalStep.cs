namespace Attendance.Domain.Entities;

// Cây duyệt CẤU HÌNH TAY riêng cho đơn OT "theo chuyền" (Chế tạo) — CHỈ 1 danh sách DUY NHẤT theo
// từng Bộ phận, KHÔNG tách 2 tầng Group/Department như DepartmentApprovalStep + GroupApprovalStep
// của đơn "theo Nhóm" (2026-08-24, theo yêu cầu người dùng — Chế tạo có 137 Group, cấu hình riêng
// từng Group là không khả thi). 1 dòng = 1 bước, đi từ Line Leader -> Group Leader -> Team Leader ->
// Manager -> Factory Manager -> Director, tất cả đều là JobTitleId thật (kể cả "Line Leader" — đã
// thêm vào JobTitles để tái dùng nguyên cơ chế tìm ứng viên theo Employee.JobTitleId có sẵn, KHÔNG
// cần special-case riêng). Với bước JobTitle.TerminalLevel=None mà không phải Line Leader (Group
// Leader/Team Leader): vì đơn "theo chuyền" không có OtForm.GroupId cố định, phạm vi tìm ứng viên
// suy từ Employee.GroupId THẬT của chính những người đang được thêm vào đơn (không phải 1 field cố
// định) — xem JobTitleApprovalChainService khi wiring. Quản lý theo kiểu "thay nguyên danh sách",
// giống DepartmentApprovalStep/GroupApprovalStep — không Create/Update/Delete từng dòng riêng lẻ.
public partial class ProductionApprovalStep
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    public bool RequiresSignature { get; set; }

    // "Người chịu trách nhiệm" in ra ô riêng trên giấy (KHÁC 2 ô chữ ký "Người đề nghị" —
    // RequiresSignature) — tối đa 1 bước/Bộ phận, mirror GroupApprovalStep.IsResponsible (2026-08-25).
    public bool IsResponsible { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
