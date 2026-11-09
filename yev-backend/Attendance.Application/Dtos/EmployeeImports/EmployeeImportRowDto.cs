namespace Attendance.Application.Dtos.EmployeeImports
{
    // 1 row parsed from Excel: employee, Department (code+name), Group (code+name) and the optional production columns.
    // Shared by the Preview response (server fills in Resolved*/IsNew*/IsValid/Errors) and the
    // Confirm request (client sends back the exact same original fields, server re-resolves from
    // scratch, not trusting the Resolved*/IsNew* fields sent by the client — same principle as
    // DeviceImportRowDto in the Asset module).
    public class EmployeeImportRowDto
    {
        public int RowNumber { get; set; }

        public string? EmployeeCode { get; set; }
        public string? FullName { get; set; }
        public string? DepartmentCode { get; set; }
        public string? DepartmentNameVn { get; set; }
        public string? GroupCode { get; set; }
        public string? GroupNameVn { get; set; }

        // Line, Team and shift team come together or not at all; none of them = not on the production roster.
        public string? LineCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }

        public int? ResolvedProductionLineId { get; set; }
        public int? ResolvedTeamId { get; set; }
        public int? ResolvedShiftTeamId { get; set; }

        // Split from FullName — last word = FirstName (given name), the rest = LastName (family +
        // middle name), matching the "{LastName} {FirstName}" display convention used in OtFormService.
        public string? ResolvedFirstName { get; set; }
        public string? ResolvedLastName { get; set; }

        // Informational flags — this department/group/employee doesn't exist in the system yet and
        // will be created at Confirm time. The employee code is unique — if it already exists,
        // Confirm will UPDATE (FirstName/LastName/GroupId) instead of raising a duplicate error
        // (2026-07-16, changed from create-only to upsert).
        public bool IsNewDepartment { get; set; }
        public bool IsNewGroup { get; set; }
        public bool IsNewEmployee { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
