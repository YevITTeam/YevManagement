namespace Attendance.Application.Dtos.DepartmentApprovalStepCoordinators
{
    public class DepartmentApprovalStepCoordinatorDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;

        // Null = no linked login yet; still assignable, permissions are auto-granted once Admin links the UserName.
        public string? UserName { get; set; }
    }
}
