using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class CreateOtFormEmployeeItemDto
    {
        [Required(ErrorMessage = "Nhân viên không được để trống")]
        public int EmployeeId { get; set; }

        // Giờ kết thúc OT thực tế của nhân viên này — người lập đơn có thể điều chỉnh riêng cho
        // từng người, nhưng phải <= EndTime của cả đơn (validate ở Service). StartTime KHÔNG nhận
        // từ FE nữa — luôn cố định bằng StartTime của đơn (xem docs/attendance-module.md).
        public TimeOnly EndTime { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }
    }
}
