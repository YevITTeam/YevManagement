using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgLevels
{
    public class CreateOrgLevelDto
    {
        [Required(ErrorMessage = "Số cấp không được để trống")]
        public int LevelNumber { get; set; }

        [Required(ErrorMessage = "Tên cấp không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }
    }
}
