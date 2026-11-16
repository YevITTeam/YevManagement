namespace Attendance.Domain.Constants;

// TT = direct production staff, GT = indirect; an employee's kind follows their task (ProductionTask.StaffKind).
public static class StaffKinds
{
    public const string Direct = "TT";
    public const string Indirect = "GT";

    public static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
