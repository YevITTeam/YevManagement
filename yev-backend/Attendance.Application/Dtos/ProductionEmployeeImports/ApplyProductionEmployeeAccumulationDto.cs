using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    // Separate from structure Confirm: accumulation affects payroll, so the target month/year is chosen explicitly.
    public class ApplyProductionEmployeeAccumulationDto
    {
        [Required(ErrorMessage = "Năm áp dụng không được để trống")]
        public int Year { get; set; }

        [Required(ErrorMessage = "Tháng áp dụng không được để trống")]
        [Range(1, 12, ErrorMessage = "Tháng áp dụng phải từ 1 đến 12")]
        public int Month { get; set; }

        [Required(ErrorMessage = "Danh sách nhân sự cần áp dụng lũy kế không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách nhân sự cần áp dụng lũy kế không được để trống")]
        public List<ProductionEmployeeImportRowDto> Rows { get; set; } = new();
    }
}
