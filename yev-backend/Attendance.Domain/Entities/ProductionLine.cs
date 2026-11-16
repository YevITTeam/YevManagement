using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Mirrors docs/ot/Cau_Truc_Team_Line_Ca.xlsx: one row per line of a workshop; the code is unique only within that workshop.
public partial class ProductionLine
{
    public int Id { get; set; }

    public int WorkshopId { get; set; }

    public string LineCode { get; set; } = null!;

    // Indirect-only lines (GT AB/GT B) belong to no team.
    public int? TeamId { get; set; }

    // C_doan: the BOPHAN column of the production reports.
    public string? CongDoan { get; set; }

    public string? CdMae { get; set; }

    // "Co": ordering code meant to replace LineCode later.
    public string? SortCode { get; set; }

    // Whether the line has direct (TT) and/or indirect (GT) staff; an employee's TT/GT must be one the line has.
    public bool HasDirectStaff { get; set; }

    public bool HasIndirectStaff { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual ProductionTeam? Team { get; set; }

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
