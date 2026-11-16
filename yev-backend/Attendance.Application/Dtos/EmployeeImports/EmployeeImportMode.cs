namespace Attendance.Application.Dtos.EmployeeImports
{
    // Overwrite: the file is the full roster of its departments, so line data picks the group and absentees are marked resigned.
    // Add: only the listed people change, and a filled group code wins over line data.
    public enum EmployeeImportMode
    {
        Overwrite = 1,
        Add = 2
    }
}
