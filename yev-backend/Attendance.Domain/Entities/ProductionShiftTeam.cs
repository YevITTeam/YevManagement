using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Shift-color grouping (Green/Orange/Blue/HC) shared by all lines; not a child of ProductionLine because one line
// appears under several shift teams.
public partial class ProductionShiftTeam
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? NameVn { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ProductionEmployee> ProductionEmployees { get; set; } = new List<ProductionEmployee>();
}
