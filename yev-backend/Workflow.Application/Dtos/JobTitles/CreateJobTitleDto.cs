using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.JobTitles
{
    public class CreateJobTitleDto
    {
        [Required(ErrorMessage = "Mã chức danh không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên chức danh không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        [Required(ErrorMessage = "Thứ bậc không được để trống")]
        public int RankOrder { get; set; }

        public bool IsUniquePerOrgUnit { get; set; } = true;
    }
}
