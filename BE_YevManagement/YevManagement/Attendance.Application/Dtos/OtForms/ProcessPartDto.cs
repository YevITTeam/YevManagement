namespace Attendance.Application.Dtos.OtForms
{
    public class ProcessPartDto
    {
        public bool IsEat { get; set; }

        // Số lượng từng loại phiếu ăn — người lập đơn tự nhập tay (không tự tính từ danh sách nhân
        // viên), chỉ có ý nghĩa khi IsEat = true (2026-07-16, xem docs/attendance-module.md).
        public int MainTicketCount { get; set; }
        public int SecondaryTicketCount { get; set; }
        public int MilkCount { get; set; }

        public bool IsTransportation { get; set; }
        public bool IsUseCopyRoom { get; set; }
        public string? AnotherSuggestionVn { get; set; }
        public string? AnotherSuggestionJp { get; set; }
    }
}
