namespace Workflow.Domain.Entities;

// Chữ ký mới đang chờ chính chủ xác nhận qua email trước khi áp dụng vào EmployeeSignature — chống
// trường hợp ai đó chiếm phiên đăng nhập rồi đổi chữ ký hộ người khác. Mirror
// Attendance.PendingSignatureConfirmation, không phải 1 trong 25 bảng thiết kế gốc — thêm khi scaffold
// Pha 4 (workflow-module.md §10, quyết định 2026-08-26).
public partial class PendingEmployeeSignatureConfirmation
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public byte[] SignatureImage { get; set; } = null!;

    // Chuỗi ngẫu nhiên dùng trong link email — tự nó là thông tin xác thực duy nhất (endpoint xác nhận
    // là [AllowAnonymous]), xem Shared.Application.Helper.TokenHelper.
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = chưa xác nhận. Có giá trị = thời điểm đã áp dụng vào EmployeeSignature.
    public DateTime? ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}
