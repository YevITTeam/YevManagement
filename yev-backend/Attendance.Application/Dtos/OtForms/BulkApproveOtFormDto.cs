using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Ký hàng loạt (Giai đoạn "theo chuyền" — Team Leader/Trưởng phòng có nhiều Group Leader/Team
    // Leader bên dưới, 2026-08-27). Comment/SecondaryPassword dùng CHUNG cho cả loạt — BE lặp gọi lại
    // đúng OtFormService.ApproveAsync (đơn lẻ) cho từng OtFormId, tái verify mật khẩu cấp 2 mỗi lần
    // (chấp nhận verify lại N lần thay vì tách riêng logic, để không đổi/không rủi ro luồng đơn lẻ đã
    // ổn định). Từng đơn thành công/thất bại ĐỘC LẬP — 1 đơn lỗi (VD người khác vừa xử lý trước) không
    // huỷ các đơn còn lại, xem BulkOtFormActionResultItemDto.
    public class BulkApproveOtFormDto : ApproveOtFormDto
    {
        [Required(ErrorMessage = "Danh sách đơn không được để trống")]
        [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 đơn")]
        public List<int> OtFormIds { get; set; } = new();
    }
}
