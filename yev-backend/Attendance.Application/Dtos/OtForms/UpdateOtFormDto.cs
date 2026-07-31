using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Edit an existing form — restricted to ONLY each active employee's actual OT end time ("thực
    // tích", chốt lại 2026-07-31, see docs/attendance-module.md — Sửa đơn: giới hạn chỉ sửa thực
    // tích). Every other field (Group/Department/Reason/OtCase/Date/StartTime/EndTime/SubReason/
    // ProcessPart) and the employee list itself (thêm/bớt người) are fixed after creation — see
    // OtFormService.UpdateAsync. Only allowed while OtForm.Status is Draft/PendingGroupHead/Pending.
    public class UpdateOtFormDto
    {
        [Required(ErrorMessage = "Danh sách nhân viên không được để trống")]
        [MinLength(1, ErrorMessage = "Phải có ít nhất 1 nhân viên")]
        public List<UpdateOtFormEmployeeTimeDto> Employees { get; set; } = new();
    }
}
