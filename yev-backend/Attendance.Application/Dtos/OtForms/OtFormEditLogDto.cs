namespace Attendance.Application.Dtos.OtForms
{
    // 1 dòng lịch sử chỉnh sửa đơn (xem OtFormEditLog) — hiển thị trong khu vực "Lịch sử chỉnh sửa"
    // ở OtFormDetail.tsx (2026-08-28, theo yêu cầu người dùng).
    public class OtFormEditLogDto
    {
        public string ActionByUserName { get; set; } = null!;
        public string? ActionByFullName { get; set; }
        public DateTime ActionAt { get; set; }

        // Enum Attendance.Domain.Enums.OtFormEditActionType.
        public int ActionType { get; set; }

        public int? EmployeeId { get; set; }
        public string? EmployeeCodeSnapshot { get; set; }
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
    }
}
