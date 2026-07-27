using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceDepartments
{
    public class CreateDeviceDepartmentDto
    {
        [Required(ErrorMessage = "Mã bộ phận không được để trống")]
        public string DepartmentCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên bộ phận không được để trống")]
        public string DepartmentName { get; set; } = null!;
    }
}
