using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ConfirmProductionEmployeeImportDto
    {
        [Required(ErrorMessage = "Danh sách nhân sự cần import không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách nhân sự cần import không được để trống")]
        public List<ProductionEmployeeImportRowDto> Rows { get; set; } = new();
    }
}
