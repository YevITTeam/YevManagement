namespace Workflow.Application.Dtos.FormCategoryCoordinators
{
    public class FormCategoryCoordinatorDto
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string EmployeeFullName { get; set; } = null!;
    }
}
