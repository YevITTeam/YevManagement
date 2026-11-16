using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Groups
{
    public class UpdateGroupDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Tên nhóm (VN) không được để trống")]
        public string GroupNameVn { get; set; } = null!;

        public string? GroupNameJp { get; set; }

        [Required(ErrorMessage = "Bộ phận không được để trống")]
        public int DepartmentId { get; set; }

        [Required(ErrorMessage = "Xưởng không được để trống")]
        public int WorkshopId { get; set; }

        public bool AllowEatLater { get; set; } = true;

        public List<GroupLineDto> Lines { get; set; } = new();

        // Pairs another group of the same workshop and department owns move here with the people standing on them.
        public bool TakeOverLines { get; set; }
    }
}
