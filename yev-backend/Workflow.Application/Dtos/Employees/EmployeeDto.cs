namespace Workflow.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? FullNameJp { get; set; }
        public string? Email { get; set; }
        public string? Position { get; set; }
        public int? UserId { get; set; }
        public bool IsActive { get; set; }
    }
}
