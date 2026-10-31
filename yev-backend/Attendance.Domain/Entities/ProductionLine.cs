using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Imported from Thong_Tin_Line_Team.xlsx; deliberately not linked to the office org tree, and CongDoan stays a raw
// string until its relationship is decided.
public partial class ProductionLine
{
    public int Id { get; set; }

    public string LineCode { get; set; } = null!;

    public int TeamId { get; set; }

    public string? CongDoan { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ProductionTeam Team { get; set; } = null!;

    public virtual ICollection<ProductionEmployee> ProductionEmployees { get; set; } = new List<ProductionEmployee>();
}
