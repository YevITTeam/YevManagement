using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtCases
{
    public class UpdateOtCaseDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã trường hợp không được để trống")]
        public string Code { get; set; } = null!;

        public string? Description { get; set; }

        public bool RequireSignature { get; set; }

        [Required(ErrorMessage = "Cấp duyệt cuối không được để trống")]
        public int RequiredApprovalLevel { get; set; }
    }
}
