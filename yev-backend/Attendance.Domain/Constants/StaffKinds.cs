using Attendance.Domain.Entities;

namespace Attendance.Domain.Constants;

// TT = direct production staff, GT = indirect; used on Employee.StaffKind and Group.LineKind.
public static class StaffKinds
{
    public const string Direct = "TT";
    public const string Indirect = "GT";

    public static List<string> AllowedOn(bool hasDirect, bool hasIndirect) =>
        new[] { (hasDirect, Direct), (hasIndirect, Indirect) }.Where(x => x.Item1).Select(x => x.Item2).ToList();

    public static List<string> AllowedOn(ProductionLine line) => AllowedOn(line.HasDirectStaff, line.HasIndirectStaff);

    public static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
