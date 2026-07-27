namespace Attendance.Application.Dtos.Departments
{
    public class DepartmentDto
    {
        public int Id { get; set; }
        public string DepartmentCode { get; set; } = null!;
        public string DepartmentNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
    }
}
