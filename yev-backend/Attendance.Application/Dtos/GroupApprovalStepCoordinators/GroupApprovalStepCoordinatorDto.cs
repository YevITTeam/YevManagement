namespace Attendance.Application.Dtos.GroupApprovalStepCoordinators
{
    public class GroupApprovalStepCoordinatorDto
    {
        public int Id { get; set; }
        public int GroupId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;

        // Null = no linked login yet (see DepartmentApprovalStepCoordinatorDto.UserName).
        public string? UserName { get; set; }
    }
}
