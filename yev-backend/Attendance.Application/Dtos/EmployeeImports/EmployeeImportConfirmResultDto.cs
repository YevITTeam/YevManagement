namespace Attendance.Application.Dtos.EmployeeImports
{
    public class EmployeeImportConfirmResultDto
    {
        public int CreatedDepartmentCount { get; set; }
        public int CreatedGroupCount { get; set; }
        public int CreatedEmployeeCount { get; set; }

        // Employees that already exist (matched by Code) get FirstName/LastName/GroupId updated
        // instead of raising a duplicate-code error — Code is unique so it's used as the key to
        // decide whether to create new or update.
        public int UpdatedEmployeeCount { get; set; }

        public int RemovedFromLineCount { get; set; }

        // Rows that still fail validation at Confirm time are skipped, and do NOT block the whole
        // batch — valid rows are still created normally; failing rows are listed here with reasons for the FE to report.
        public int SkippedCount { get; set; }
        public List<EmployeeImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
