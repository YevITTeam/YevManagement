namespace Attendance.Domain.Entities;

// Công việc of a workshop; its kind decides whether the people doing it are TT or GT. Employee.TaskName holds the code.
public partial class ProductionTask
{
    public int Id { get; set; }

    public int WorkshopId { get; set; }

    public string Code { get; set; } = null!;

    public string StaffKind { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual Workshop Workshop { get; set; } = null!;
}
