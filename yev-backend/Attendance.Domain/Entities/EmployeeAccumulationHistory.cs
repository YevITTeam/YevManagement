namespace Attendance.Domain.Entities;

// Append-only monthly ledger, since Employee month/year counters are reset on rollover.
// No backfill of older data; no IsDeleted (audit log).
public partial class EmployeeAccumulationHistory
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int Year { get; set; }

    public int Month { get; set; }

    public decimal TotalHours { get; set; }

    // Set when an accumulation adjustment from production-staff import is added; the (EmployeeId, Year, Month)
    // unique index prevents a separate row for it.
    public string? Note { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}
