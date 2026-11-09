namespace Attendance.Application.Dtos.EmployeeImports
{
    public class EmployeeImportPreviewResultDto
    {
        public List<EmployeeImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }

        // Number of new Department/Group entries that would be created if Confirm is called right now (reference info for the FE).
        public int NewDepartmentCount { get; set; }
        public int NewGroupCount { get; set; }

        // People whose production fields Confirm would clear: absent from the file, in a department the file covers.
        public List<EmployeeImportRemovedRowDto> RemovedRows { get; set; } = new();
    }
}
