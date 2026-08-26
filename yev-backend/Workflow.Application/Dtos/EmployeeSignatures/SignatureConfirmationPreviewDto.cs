namespace Workflow.Application.Dtos.EmployeeSignatures
{
    // Trả về cho trang xác nhận công khai (link email, không cần đăng nhập SPA) — chỉ đủ thông tin để
    // người dùng nhận ra đúng chữ ký mình vừa yêu cầu cập nhật, không lộ gì thêm.
    public class SignatureConfirmationPreviewDto
    {
        public string EmployeeFullName { get; set; } = null!;

        public byte[] SignatureImage { get; set; } = null!;

        public DateTime ExpiresAt { get; set; }
    }
}
