namespace Attendance.Domain.Entities;

// Chi tiết phát sinh riêng của 1 OtForm (ăn/xe đưa đón/phòng photocopy...) — quan hệ 1-1 với OtForm.
public partial class ProcessPart
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public bool IsEat { get; set; }

    public bool IsTransportation { get; set; }

    public bool IsUseCopyRoom { get; set; }

    public string? AnotherSuggestionVn { get; set; }

    public string? AnotherSuggestionJp { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
