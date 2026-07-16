namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormListItemDto
    {
        public int Id { get; set; }
        public string GroupNameVn { get; set; } = null!;
        public string DepartmentNameVn { get; set; } = null!;
        public string OtCaseCode { get; set; } = null!;
        public DateOnly Date { get; set; }
        public decimal TotalHour { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Snapshot Họ tên người tạo — FE luôn ưu tiên hiển thị field này, fallback CreatedByUserName nếu null.
        public string? CreatedByFullName { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // true khi Status == Pending (chưa cấp nào duyệt) — dùng để hiện/ẩn nút "Sửa" ngay trên danh sách.
        public bool IsEditable { get; set; }
    }
}
