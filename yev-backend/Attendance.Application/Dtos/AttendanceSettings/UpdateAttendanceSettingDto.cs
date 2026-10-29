using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.AttendanceSettings
{
    public class UpdateAttendanceSettingDto
    {
        [Required(ErrorMessage = "Số giờ tối thiểu để nhận phiếu chính không được để trống")]
        [Range(0.5, 24, ErrorMessage = "Số giờ tối thiểu để nhận phiếu chính phải từ 0.5 đến 24")]
        public decimal MainMealTicketMinHours { get; set; }

        [Required(ErrorMessage = "Sàn giờ không có phiếu ăn không được để trống")]
        [Range(0, 24, ErrorMessage = "Sàn giờ không có phiếu ăn phải từ 0 đến 24")]
        public decimal NoMealTicketMaxHours { get; set; }

        [Required(ErrorMessage = "Số giờ trừ khi có ăn không được để trống")]
        [Range(0, 4, ErrorMessage = "Số giờ trừ khi có ăn phải từ 0 đến 4")]
        public decimal MealBreakDeductionHours { get; set; }

        [Required(ErrorMessage = "Giờ bắt đầu khung OT sớm không được để trống")]
        public TimeOnly EarlyMealWindowStartTime { get; set; }

        [Required(ErrorMessage = "Giờ kết thúc khung OT sớm không được để trống")]
        public TimeOnly EarlyMealWindowEndTime { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong ngày không được để trống")]
        [Range(0.5, 24, ErrorMessage = "Giới hạn giờ OT trong ngày phải từ 0.5 đến 24")]
        public decimal DailyOtHourLimit { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong tháng không được để trống")]
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT trong tháng phải từ 1 đến 744")]
        public decimal MonthlyOtHourLimit { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong năm không được để trống")]
        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT trong năm phải từ 1 đến 8784")]
        public decimal YearlyOtHourLimit { get; set; }

        [Required(ErrorMessage = "Giới hạn giờ OT trong ngày nghỉ không được để trống")]
        [Range(0.5, 24, ErrorMessage = "Giới hạn giờ OT trong ngày nghỉ phải từ 0.5 đến 24")]
        public decimal DailyOtHourLimitHoliday { get; set; }

        [Required(ErrorMessage = "Giờ tự động gửi đơn tổng không được để trống")]
        public TimeOnly BatchAutoSendTime { get; set; }

        [Range(0, 31, ErrorMessage = "Số ngày được trình ký lại phải từ 0 đến 31")]
        public int ResubmitWindowDays { get; set; }

        [Range(0, 31, ErrorMessage = "Số ngày được tạo đơn lùi phải từ 0 đến 31")]
        public int BackdateDays { get; set; }
    }
}
