namespace Attendance.Application.Dtos.AttendanceSettings
{
    // Cấu hình dùng chung của module Attendance — xem docs/attendance-module.md
    // (§Cấu hình phiếu ăn & giới hạn lũy kế).
    public class AttendanceSettingDto
    {
        // Số giờ OT tối thiểu để nhận PHIẾU CHÍNH; dưới mốc này nhận PHIẾU PHỤ.
        public decimal MainMealTicketMinHours { get; set; }

        // Giới hạn giờ OT trong tháng / trong năm — vượt thì UI cảnh báo đỏ (không chặn tạo/duyệt đơn).
        public decimal MonthlyOtHourLimit { get; set; }

        public decimal YearlyOtHourLimit { get; set; }

        // Giờ hằng ngày OtFormBatchBackgroundService chạy gom "Đơn tổng" gửi Trưởng phòng (giờ VN).
        public TimeOnly BatchAutoSendTime { get; set; }
    }
}
