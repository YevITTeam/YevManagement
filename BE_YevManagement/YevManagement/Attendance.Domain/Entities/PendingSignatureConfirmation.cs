using System;

namespace Attendance.Domain.Entities;

// Chữ ký mới chờ chính chủ tự xác nhận qua email trước khi có hiệu lực (UserSignature chỉ được
// upsert SAU KHI xác nhận) — chống trường hợp ai đó chiếm phiên đăng nhập rồi đổi chữ ký người khác.
public partial class PendingSignatureConfirmation
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public byte[] SignatureImage { get; set; } = null!;

    // Token ngẫu nhiên dùng trong link email — tự nó là thông tin xác thực duy nhất (endpoint xác
    // nhận là [AllowAnonymous]), xem Shared.Application.Helper.TokenHelper.
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = chưa xác nhận. Có giá trị = đã áp dụng vào UserSignature lúc nào.
    public DateTime? ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
