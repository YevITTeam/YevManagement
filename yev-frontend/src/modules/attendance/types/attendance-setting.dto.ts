// Cấu hình dùng chung của module Attendance — 1 dòng duy nhất trong DB, xem
// docs/docs-be/attendance-module.md §API (mới 2026-08-01).
// Redesign 3 bậc phiếu ăn (2026-08-26, chốt với người dùng — xem docs/attendance-module.md §Phiếu ăn):
// thực tích < noMealTicketMaxHours -> không phiếu; noMealTicketMaxHours..mainMealTicketMinHours ->
// Phụ; >= mainMealTicketMinHours -> Chính. Ngoại lệ: ca khớp ĐÚNG khung [earlyMealWindowStartTime,
// earlyMealWindowEndTime) luôn phiếu Phụ, không trừ mealBreakDeductionHours dù có ăn hay không.
export interface AttendanceSettingDto {
    // Số giờ OT THỰC TÍCH tối thiểu để nhận PHIẾU CHÍNH (mặc định 3.5).
    mainMealTicketMinHours: number;
    // Sàn dưới — thực tích dưới mốc này (mặc định 2) thì không có phiếu ăn nào.
    noMealTicketMaxHours: number;
    // Số giờ trừ khi có ăn, áp dụng ngoài khung sớm (mặc định 0.5).
    mealBreakDeductionHours: number;
    // TimeOnly "HH:mm:ss" — khung giờ OT sớm đặc cách (mặc định 06:00:00 - 08:00:00).
    earlyMealWindowStartTime: string;
    earlyMealWindowEndTime: string;
    // Ngày: vượt thì BE CHẶN tạo/sửa đơn. Tháng/năm: vượt (mốc riêng của nhân viên nếu có) thì đơn BẮT BUỘC
    // là TH3, không chặn.
    dailyOtHourLimit: number;
    monthlyOtHourLimit: number;
    yearlyOtHourLimit: number;
    // Giới hạn ngày khi ngày đó là ngày nghỉ theo lịch (mặc định 12).
    dailyOtHourLimitHoliday: number;
    // TimeOnly "HH:mm:ss" — giờ hằng ngày hệ thống tự gom "Đơn tổng" gửi Trưởng phòng.
    batchAutoSendTime: string;
    // Days after completion a Manager-signed office form may still be re-submitted.
    resubmitWindowDays: number;
    // How many days back a new form's date may be.
    backdateDays: number;
}

// Body PUT /api/AttendanceSetting — cùng shape với AttendanceSettingDto (không có field server tự tính).
export type UpdateAttendanceSettingDto = AttendanceSettingDto;

// Body POST /api/AttendanceSetting/test-email (2026-09-05) — gửi 1 email mẫu để tự kiểm tra cấu hình
// SMTP + hiển thị đúng font/layout, không đụng gì tới AttendanceSettingDto.
export interface SendTestEmailDto {
    email: string;
}
