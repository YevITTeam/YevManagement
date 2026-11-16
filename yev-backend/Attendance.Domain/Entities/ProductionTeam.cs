using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Team/area of a workshop; the same code in two workshops is two different teams.
public partial class ProductionTeam
{
    public int Id { get; set; }

    public int WorkshopId { get; set; }

    public string Code { get; set; } = null!;

    public string? NameVn { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual ICollection<ProductionLine> ProductionLines { get; set; } = new List<ProductionLine>();

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
