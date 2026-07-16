namespace Attendance.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;

        // Tài khoản AD của chính nhân viên (nullable) — dùng để tự chỉnh lũy kế của chính mình.
        public string? UserName { get; set; }

        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Tháng/năm mà MonthToDate/YearToDate đang phản ánh (xem Employee.AccumulationYear/Month).
        public int AccumulationYear { get; set; }
        public int AccumulationMonth { get; set; }

        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
    }
}
