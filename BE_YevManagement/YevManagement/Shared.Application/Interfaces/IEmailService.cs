namespace Shared.Application.Interfaces
{
    public interface IEmailService
    {
        // Tự bắt lỗi SMTP bên trong implementation, KHÔNG throw — trả false + log nếu gửi thất bại.
        // Gửi email chỉ là kênh bổ sung (thông báo/xác nhận), không được phép làm hỏng nghiệp vụ
        // chính (tạo đơn/duyệt đơn/cập nhật chữ ký vẫn phải thành công dù SMTP đang lỗi).
        Task<bool> SendAsync(string toEmail, string subject, string htmlBody);
    }
}
