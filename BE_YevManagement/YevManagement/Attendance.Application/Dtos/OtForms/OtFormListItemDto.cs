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

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }
    }
}
