using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Departments
{
    public class UpdateDepartmentDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã bộ phận không được để trống")]
        public string DepartmentCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên bộ phận (VN) không được để trống")]
        public string DepartmentNameVn { get; set; } = null!;

        public string? DepartmentNameJp { get; set; }
    }
}
