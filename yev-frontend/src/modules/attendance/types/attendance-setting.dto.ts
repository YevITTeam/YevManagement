// Cấu hình dùng chung của module Attendance — 1 dòng duy nhất trong DB, xem
// docs/docs-be/attendance-api-fe.md §6d (mới 2026-08-01).
export interface AttendanceSettingDto {
    // Số giờ OT tối thiểu để nhận PHIẾU CHÍNH (mặc định 2.5 = 2h30). Dưới mốc này nhận PHIẾU PHỤ —
    // mọi người tăng ca đều nhận đúng 1 trong 2 loại, không có ngưỡng sàn.
    mainMealTicketMinHours: number;
    // Vượt các mốc này thì UI tô đỏ cảnh báo (không chặn tạo/duyệt đơn).
    monthlyOtHourLimit: number;
    yearlyOtHourLimit: number;
    // TimeOnly "HH:mm:ss" — giờ hằng ngày hệ thống tự gom "Đơn tổng" gửi Trưởng phòng.
    batchAutoSendTime: string;
}

// Body PUT /api/AttendanceSetting — cùng shape với AttendanceSettingDto (không có field server tự tính).
export type UpdateAttendanceSettingDto = AttendanceSettingDto;
