namespace Attendance.Domain.Enums;

// Loại phiếu ăn 1 nhân viên nhận cho 1 lần OT — xem OtFormService.CalculateMealTicketType
// (docs/attendance-module.md §Phiếu ăn, chốt với người dùng 2026-08-26).
public enum MealTicketType
{
    None = 0,
    Secondary = 1,
    Main = 2
}
