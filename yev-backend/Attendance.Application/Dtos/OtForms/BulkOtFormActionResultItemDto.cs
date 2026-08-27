namespace Attendance.Application.Dtos.OtForms
{
    // 1 dòng kết quả / đơn trong thao tác ký hàng loạt hoặc từ chối hàng loạt — FE dùng để hiện đúng
    // đơn nào thành công, đơn nào lỗi (và lý do) thay vì chỉ báo 1 thông báo chung chung.
    public class BulkOtFormActionResultItemDto
    {
        public int OtFormId { get; set; }

        public bool Success { get; set; }

        public string? Error { get; set; }
    }
}
