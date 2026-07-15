namespace Attendance.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }
        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
    }
}
