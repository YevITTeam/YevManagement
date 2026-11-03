using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // One office form per group, same date; created all or nothing.
    public class CreateManyOtFormsDto
    {
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;

        [Required]
        public List<CreateOtFormDto> Forms { get; set; } = new();
    }
}
