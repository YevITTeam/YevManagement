namespace Attendance.Domain.Entities;

// Extra expense details for a single OtForm (meal/shuttle/photocopy room...) — 1-1 relationship with OtForm.
public partial class ProcessPart
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public bool IsEat { get; set; }

    // Count of each meal ticket type when IsEat = true — manually entered by the form creator
    // (not auto-calculated from the employee list), see docs/attendance-module.md.
    public int MainTicketCount { get; set; }

    public int SecondaryTicketCount { get; set; }

    public int MilkCount { get; set; }

    public bool IsTransportation { get; set; }

    public bool IsUseCopyRoom { get; set; }

    public string? AnotherSuggestionVn { get; set; }

    public string? AnotherSuggestionJp { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
