namespace Attendance.Domain.Entities;

// System configuration for the Attendance module — always exactly 1 row (Id=1), edited via API
// instead of appsettings.json so the Admin can change it immediately without redeploying.
// Mirrors Asset.Domain.Entities.AssetSetting (see docs/attendance-module.md — Cấu hình phiếu ăn &
// giới hạn lũy kế). No IsDeleted: a singleton config row is never soft-deleted.
public partial class AttendanceSetting
{
    public int Id { get; set; }

    // OT hours from which an employee gets a MAIN meal ticket ("phiếu chính"). Below this they get a
    // SECONDARY ticket ("phiếu phụ") instead — every OT employee gets exactly one of the two, there is
    // no lower bound (chốt với người dùng 2026-08-01). Default 2.5 (= 2h30).
    public decimal MainMealTicketMinHours { get; set; }

    // Monthly OT hour limit — an employee whose MonthToDate exceeds this is flagged in red on the UI.
    // Display/warning only, does NOT block creating or approving a form. Default 25.
    public decimal MonthlyOtHourLimit { get; set; }

    // Yearly OT hour limit — same semantics as MonthlyOtHourLimit. Default 300.
    public decimal YearlyOtHourLimit { get; set; }

    // Giờ trong ngày OtFormBatchBackgroundService chạy gom "Đơn tổng" (giờ Việt Nam, khớp
    // TimeHelper.GetCurrentUtcTime()). Default 15:00 — trước đây hardcode trong background service,
    // chuyển vào đây để Admin tự đổi không cần build lại (2026-08-08).
    public TimeOnly BatchAutoSendTime { get; set; }
}
