namespace Attendance.Application.Dtos.Employees
{
    // One (Workshop, Department) pair a Department Manager approves for.
    public class EmployeeApprovalScopeDto
    {
        public int WorkshopId { get; set; }
        public string WorkshopNameVn { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
    }

    public class EmployeeApprovalScopeInputDto
    {
        public int WorkshopId { get; set; }
        public int DepartmentId { get; set; }
    }
}
