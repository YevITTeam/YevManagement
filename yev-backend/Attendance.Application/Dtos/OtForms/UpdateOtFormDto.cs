using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Edit an existing form — restricted to ONLY each active employee's actual OT end time ("thực
    // tích", chốt lại 2026-07-31, see docs/attendance-module.md — Sửa đơn: giới hạn chỉ sửa thực
    // tích). Every other field (Group/Department/Reason/OtCase/Date/StartTime/EndTime/SubReason/
    // ProcessPart) and the employee list itself (thêm/bớt người) are fixed after creation — see
    // OtFormService.UpdateAsync. Thêm/loại nhân viên đi qua 2 action riêng (AddOtFormEmployeeDto/
    // RemoveOtFormEmployeeDto, 2026-08-28) — Employees ở đây vẫn phải khớp ĐÚNG danh sách active hiện
    // có, không đổi qua PUT này.
    public class UpdateOtFormDto
    {
        [Required(ErrorMessage = "Danh sách nhân viên không được để trống")]
        [MinLength(1, ErrorMessage = "Phải có ít nhất 1 nhân viên")]
        public List<UpdateOtFormEmployeeTimeDto> Employees { get; set; } = new();

        // Second-factor password — bắt buộc từ 2026-08-28 (theo yêu cầu người dùng, lưu thay đổi
        // chỉnh sửa cũng phải nhập mật khẩu cấp 2), cùng cơ chế với ApproveOtFormDto.SecondaryPassword.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
