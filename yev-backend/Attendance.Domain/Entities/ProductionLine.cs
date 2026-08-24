using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Reference data for khối chuyền (Chế tạo), imported from Thong_Tin_Line_Team.xlsx.
// Deliberately independent of Department/Group/Employee for now — the relationship
// between Line/Team/CongDoan and the office org tree has not been decided yet.
// Team <-> Line is now a real FK (2026-08-21); CongDoan stays a raw string for now —
// deferred until its relationship is decided (user request: "công đoạn để sau").
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
