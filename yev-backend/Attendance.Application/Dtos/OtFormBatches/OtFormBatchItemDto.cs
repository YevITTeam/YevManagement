using Attendance.Application.Dtos.OtForms;

namespace Attendance.Application.Dtos.OtFormBatches
{
    // One member OtForm inside a "Đơn tổng" — a trimmed-down view of OtFormDto (only what the
    // Department Manager needs to decide Approve/Reject for this form, see docs/attendance-module.md — §Đơn tổng).
    public class OtFormBatchItemDto
    {
        public int OtFormId { get; set; }

        // Null khi đơn "theo chuyền" (OtForm.IsProductionForm = true, không có GroupId cố định).
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
        public bool IsProductionForm { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public DateOnly Date { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public string CreatedByUserName { get; set; } = null!;
        public string? CreatedByFullName { get; set; }
        public int NumberOfEmployee { get; set; }

        // Mới (2026-08-08) — Trưởng phòng cần thấy đủ chi tiết như màn Chi tiết đơn thường để quyết
        // định Duyệt/Từ chối, không chỉ danh sách nhân viên rút gọn. Null nếu tạo đơn không gửi.
        public ProcessPartDto? ProcessPart { get; set; }

        // Chỉ gồm nhân viên ĐANG active (chưa bị loại) — trùng nguyên tắc numberOfEmployee của OtForm.
        public List<OtFormEmployeeDto> Employees { get; set; } = new();
    }
}
