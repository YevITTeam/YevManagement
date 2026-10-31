using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Latest daily state per person, upserted by EmployeeCode on each import; never written back to Employee, which stays
// the stable source. Rows whose codes don't all resolve are skipped, so the nullable FKs are always set in practice.
public partial class ProductionEmployee
{
    public int Id { get; set; }

    public string EmployeeCode { get; set; } = null!;

    // Only meaningful when EmployeeId is null.
    public string? LastNameSnapshot { get; set; }

    public string? FirstNameSnapshot { get; set; }

    // File column BOPHAN; no FK because its relation to ProductionLine.CongDoan is undecided.
    public string? CongDoan { get; set; }

    public string? TaskName { get; set; }

    // File column BLOCK; admin/support stations that are not physical lines stay unresolved.
    public string? BlockCode { get; set; }

    public int? ProductionLineId { get; set; }

    // File column GROUP; mapped A->1, B->2, HC->HC, otherwise matched by Code.
    public string? TeamCode { get; set; }

    public int? TeamId { get; set; }

    // File column NHOM (G/O/HC).
    public string? ShiftTeamCode { get; set; }

    public int? ShiftTeamId { get; set; }

    public bool IsLeader { get; set; }

    // Null = no matching Employee yet, so the person cannot be added to any OtForm.
    public int? EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ProductionLine? ProductionLine { get; set; }

    public virtual ProductionTeam? Team { get; set; }

    public virtual ProductionShiftTeam? ShiftTeam { get; set; }

    public virtual Employee? Employee { get; set; }
}
