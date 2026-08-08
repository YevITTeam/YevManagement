using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Admin-only soft-delete for a form permanently stuck in the approval chain (2026-08-08 — see
    // docs/attendance-module.md §Cây chức vụ). Reason is mandatory, same principle as
    // RemoveOtFormEmployeeDto.Reason: any action that removes something from a legal document must
    // record why.
    public class DeleteOtFormDto
    {
        [Required(ErrorMessage = "Lý do xoá đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
