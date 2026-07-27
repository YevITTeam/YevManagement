namespace Attendance.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;

        // The employee's own AD account (nullable) — used to adjust their own accumulation.
        public string? UserName { get; set; }

        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Month/year that MonthToDate/YearToDate currently reflect (see Employee.AccumulationYear/Month).
        public int AccumulationYear { get; set; }
        public int AccumulationMonth { get; set; }

        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
    }
}
