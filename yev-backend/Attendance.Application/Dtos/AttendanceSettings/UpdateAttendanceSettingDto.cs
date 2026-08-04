using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.AttendanceSettings
{
    public class UpdateAttendanceSettingDto
    {
        [Required(ErrorMessage = "Số giờ tối thiểu để nhận phiếu chính không được để trống")]
        [Range(0.5, 24, ErrorMessage = "Số giờ tối thiểu để nhận phiếu chính phải từ 0.5 đến 24")]
        public decimal MainMealTicketMinHours { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong tháng không được để trống")]
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT trong tháng phải từ 1 đến 744")]
        public decimal MonthlyOtHourLimit { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong năm không được để trống")]
        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT trong năm phải từ 1 đến 8784")]
        public decimal YearlyOtHourLimit { get; set; }
    }
}
