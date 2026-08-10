namespace Attendance.Domain.Entities;

// Cây duyệt CẤU HÌNH TAY cho từng Nhóm (2026-08-08) — chỉ chứa các Chức vụ TerminalLevel=None
// (cấp trung gian, dưới Manager). Mirror DepartmentApprovalStep nhưng khoá theo GroupId thay vì
// DepartmentId — 3 cấp cuối (Manager/Factory Manager/Director) vẫn cấu hình ở DepartmentApprovalStep
// như cũ (không lặp theo từng Nhóm con). Quản lý theo kiểu "thay nguyên danh sách" (xem
// IGroupApprovalStepService.ReplaceAsync) — không có Create/Update/Delete từng dòng riêng lẻ.
public partial class GroupApprovalStep
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    // Bắt buộc ký tay (UserSignature) hay chỉ cần xác nhận ở BƯỚC này — cấu hình riêng theo từng
    // Nhóm (mirror DepartmentApprovalStep.RequiresSignature).
    public bool RequiresSignature { get; set; }

    // Đánh dấu BƯỚC này là "người chịu trách nhiệm" trên form in — tối đa 1 bước/Nhóm (validate ở
    // GroupApprovalStepService.ReplaceAsync). Dời từ DepartmentApprovalStep xuống đây (2026-08-08) —
    // người chịu trách nhiệm luôn là 1 người ở cấp trung gian sát người tạo đơn nhất.
    public bool IsResponsible { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
