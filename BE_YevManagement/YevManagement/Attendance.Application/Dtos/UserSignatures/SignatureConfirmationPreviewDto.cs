namespace Attendance.Application.Dtos.UserSignatures
{
    // Trả về cho FE render trang xác nhận nhỏ (link email, không cần đăng nhập SPA) — chỉ đủ thông
    // tin để người dùng xác nhận đúng ảnh chữ ký họ vừa yêu cầu cập nhật, không lộ gì thêm.
    public class SignatureConfirmationPreviewDto
    {
        public string UserName { get; set; } = null!;
        public byte[] SignatureImage { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
