using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgLevels
{
    public class UpdateOrgLevelDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Số cấp không được để trống")]
        public int LevelNumber { get; set; }

        [Required(ErrorMessage = "Tên cấp không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }
    }
}
