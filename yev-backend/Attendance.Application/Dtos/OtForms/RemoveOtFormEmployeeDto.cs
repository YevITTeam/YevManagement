using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Kênh trong-app (JWT), khôi phục lại 2026-09-30 — xem docs/attendance-module.md §Khôi phục "Loại
    // khỏi đơn" ngay trên màn Duyệt (web). Gọi thẳng RemoveEmployeeCoreAsync (đã dùng đúng luật "candidate
    // của bước Pending hiện tại" cho CẢ đơn theo Nhóm lẫn theo chuyền, không phải UpdateAsync creator-only)
    // — KHÔNG cần SecondaryPassword, cùng quyết định 2026-07-31 áp dụng cho kênh email.
    public class RemoveOtFormEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
