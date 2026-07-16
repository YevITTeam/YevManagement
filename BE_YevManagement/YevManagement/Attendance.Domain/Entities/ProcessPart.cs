namespace Attendance.Domain.Entities;

// Chi tiết phát sinh riêng của 1 OtForm (ăn/xe đưa đón/phòng photocopy...) — quan hệ 1-1 với OtForm.
public partial class ProcessPart
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public bool IsEat { get; set; }

    // Số lượng từng loại phiếu ăn khi IsEat = true — người lập đơn tự nhập tay (không tự tính từ
    // danh sách nhân viên), xem docs/attendance-module.md.
    public int MainTicketCount { get; set; }

    public int SecondaryTicketCount { get; set; }

    public int MilkCount { get; set; }

    public bool IsTransportation { get; set; }

    public bool IsUseCopyRoom { get; set; }

    public string? AnotherSuggestionVn { get; set; }

    public string? AnotherSuggestionJp { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
