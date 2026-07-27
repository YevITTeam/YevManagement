using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Groups
{
    public class UpdateGroupDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã nhóm không được để trống")]
        public string GroupCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên nhóm (VN) không được để trống")]
        public string GroupNameVn { get; set; } = null!;

        public string? GroupNameJp { get; set; }

        [Required(ErrorMessage = "Bộ phận không được để trống")]
        public int DepartmentId { get; set; }
    }
}
