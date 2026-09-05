namespace Attendance.Application.Dtos.OtFormBatches
{
    public class OtFormBatchDto
    {
        public int Id { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — cấp duyệt của batch này.
        public int TerminalLevel { get; set; }

        // Chỉ có giá trị khi TerminalLevel=DepartmentManager — WorkshopManager/GeneralDirector là
        // batch toàn công ty (DepartmentId=null), xem OtFormBatch.
        public int? DepartmentId { get; set; }

        // Tên hiển thị phạm vi batch — Department (bilingual) nếu TerminalLevel=DepartmentManager,
        // ngược lại là tên JobTitle ứng với TerminalLevel đó (JobTitle không có bản Jp).
        public string ScopeNameVn { get; set; } = null!;
        public string? ScopeNameJp { get; set; }

        public DateOnly BatchDate { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchStatus.
        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public string? ProcessedByUserName { get; set; }
        public string? ProcessedByFullName { get; set; }

        // Chỉ gồm các đơn nhỏ VẪN CÒN Status==Pending (còn hiệu lực xử lý) — đơn đã bị duyệt/từ chối
        // lẻ tay ngoài luồng batch (hiếm) sẽ không xuất hiện ở đây nữa.
        public List<OtFormBatchItemDto> OtForms { get; set; } = new();
    }
}
