using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.Employees
{
    public class CreateEmployeeDto
    {
        [Required(ErrorMessage = "Mã nhân sự không được để trống")]
        public string EmployeeCode { get; set; } = null!;

        [Required(ErrorMessage = "Họ tên không được để trống")]
        public string FullName { get; set; } = null!;

        public string? FullNameJp { get; set; }

        public string? Email { get; set; }

        public string? Position { get; set; }

        public int? UserId { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
