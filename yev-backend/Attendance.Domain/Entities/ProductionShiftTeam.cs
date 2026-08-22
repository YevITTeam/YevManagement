namespace Attendance.Domain.Entities;

// Reference data for khối chuyền (Chế tạo): Nhóm = shift-color grouping (Green/Orange/Blue/HC),
// per Le Kim Ngan's email (2026-08-21) — "Áp dụng cho tất cả các line block".
// Deliberately independent of ProductionLine for now: the same Line appears under
// multiple shift-team values in the personnel data, so this is not a child level of Line.
public partial class ProductionShiftTeam
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? NameVn { get; set; }

    public bool IsDeleted { get; set; }
}
