namespace Workflow.Domain.Entities;

// Duyệt qua email, dùng 1 lần — workflow-module.md §3.3. Token là credential DUY NHẤT (không có mật
// khẩu cấp 2 như Attendance.OtFormApprovalEmailToken — Workflow không có khái niệm secondary password).
// KHÔNG neo cứng StepOrder lúc dùng: ApproveByEmailTokenAsync/RejectByEmailTokenAsync luôn tự tra lại
// bước Current THẬT SỰ của đơn tại thời điểm bấm link (mirror Attendance — token cũ/của bước đã qua tự
// thất bại êm ái nhờ business logic gốc, không cần chủ động vô hiệu hoá các token anh em cùng bước).
public partial class WorkflowRequestEmailToken
{
    public int Id { get; set; }

    public int WorkflowRequestId { get; set; }

    public int StepOrder { get; set; }

    public int ApproverEmployeeId { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual WorkflowRequest WorkflowRequest { get; set; } = null!;

    public virtual Employee ApproverEmployee { get; set; } = null!;
}
