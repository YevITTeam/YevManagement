using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.JobTitles
{
    public class CreateJobTitleDto
    {
        [Required(ErrorMessage = "Mã chức vụ không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên chức vụ không được để trống")]
        public string Name { get; set; } = null!;

        [Required(ErrorMessage = "Cấp độ không được để trống")]
        public int RankOrder { get; set; }

        public bool RequiresSignature { get; set; }

        public int TerminalLevel { get; set; }
    }
}
