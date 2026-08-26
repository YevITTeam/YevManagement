namespace Workflow.Domain.Entities;

// Chữ ký đăng ký sẵn — chỉ dùng để tự điền lúc duyệt đơn (workflow-module.md §3.4), KHÔNG phải nguồn
// chân lý cho audit (bản chính thức là snapshot ở WorkflowRequestHistories.SignatureImage). Cập nhật
// KHÔNG áp dụng ngay — luôn đi qua PendingEmployeeSignatureConfirmation + email xác nhận, mirror
// Attendance.UserSignature (§10, quyết định 2026-08-26).
public partial class EmployeeSignature
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public byte[] SignatureImage { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}
