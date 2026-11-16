namespace Attendance.Domain.Entities;

// One Line × Ca a group covers; within a workshop, department and TT/GT kind a pair belongs to at most one group.
public partial class GroupLine
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int ProductionLineId { get; set; }

    public int ShiftTeamId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual ProductionLine ProductionLine { get; set; } = null!;

    public virtual ProductionShiftTeam ShiftTeam { get; set; } = null!;
}
