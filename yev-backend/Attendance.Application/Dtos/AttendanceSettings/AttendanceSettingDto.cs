namespace Attendance.Application.Dtos.AttendanceSettings
{
    // Cấu hình dùng chung của module Attendance — xem docs/attendance-module.md
    // (§Cấu hình phiếu ăn & giới hạn lũy kế).
    public class AttendanceSettingDto
    {
        // Số giờ OT THỰC TÍCH tối thiểu để nhận PHIẾU CHÍNH; dưới mốc này (nhưng còn >= NoMealTicketMaxHours)
        // nhận PHIẾU PHỤ; dưới NoMealTicketMaxHours thì không có phiếu nào (xem AttendanceSetting.cs).
        public decimal MainMealTicketMinHours { get; set; }

        // Sàn dưới — thực tích dưới mốc này thì không có phiếu ăn nào.
        public decimal NoMealTicketMaxHours { get; set; }

        // Số giờ trừ khi có ăn (áp dụng ngoài khung sớm).
        public decimal MealBreakDeductionHours { get; set; }

        // Khung giờ OT sớm đặc cách (mặc định 6h-8h) — khớp ĐÚNG khung này thì luôn phiếu Phụ, không trừ.
        public TimeOnly EarlyMealWindowStartTime { get; set; }

        public TimeOnly EarlyMealWindowEndTime { get; set; }

        // Giới hạn giờ OT theo ngày / tháng / năm của 1 nhân viên — vượt bất kỳ mốc nào thì BE CHẶN
        // tạo/sửa đơn (2026-08-26, không còn "chỉ cảnh báo" như trước — xem AttendanceSetting.cs).
        public decimal DailyOtHourLimit { get; set; }

        public decimal MonthlyOtHourLimit { get; set; }

        public decimal YearlyOtHourLimit { get; set; }

        // Giờ hằng ngày OtFormBatchBackgroundService chạy gom "Đơn tổng" gửi Trưởng phòng (giờ VN).
        public TimeOnly BatchAutoSendTime { get; set; }
    }
}
