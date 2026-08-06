namespace Attendance.Application.Dtos.OtFormBatches
{
    public class OtFormBatchDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
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
