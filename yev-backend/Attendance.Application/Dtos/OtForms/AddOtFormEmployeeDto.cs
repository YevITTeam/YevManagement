using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Request to add ONE employee to a form the caller is currently entitled to edit — the reverse of
    // RemoveOtFormEmployeeDto (2026-08-28, theo yêu cầu người dùng — "chỉnh sửa đơn... loại hoặc thêm
    // nhân viên"). Same eligibility rule as Remove (candidate of the current pending step, or Admin) —
    // see OtFormService.AddEmployeeAsync.
    public class AddOtFormEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần thêm không được để trống")]
        public int EmployeeId { get; set; }

        public TimeOnly EndTime { get; set; }

        public bool DidEat { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }

        // Second-factor password — bắt buộc từ 2026-08-28 (theo yêu cầu người dùng, mọi thao tác thay
        // đổi đơn đều cần nhập mật khẩu cấp 2), cùng cơ chế với ApproveOtFormDto.SecondaryPassword.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
