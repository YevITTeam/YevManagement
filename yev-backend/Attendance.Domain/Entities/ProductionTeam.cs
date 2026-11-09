using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// "Khu/Team" column of Thong_Tin_Line_Team.xlsx; meaning of the admin/support values is unconfirmed.
public partial class ProductionTeam
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? NameVn { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ProductionLine> ProductionLines { get; set; } = new List<ProductionLine>();

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
