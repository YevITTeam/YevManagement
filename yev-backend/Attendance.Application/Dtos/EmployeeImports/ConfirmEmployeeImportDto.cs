using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.EmployeeImports
{
    public class ConfirmEmployeeImportDto
    {
        [Required(ErrorMessage = "Danh sách nhân viên cần import không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách nhân viên cần import không được để trống")]
        public List<EmployeeImportRowDto> Rows { get; set; } = new();
    }
}
