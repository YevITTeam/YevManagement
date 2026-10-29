namespace Attendance.Application.Dtos.EmployeeIdentityLinkImports
{
    // Preview and Confirm both re-read the uploaded file (rows may carry embedded signature images),
    // so Confirm never trusts data echoed back from Preview.
    public class EmployeeIdentityLinkImportRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public string? UserName { get; set; }
        public string? Email { get; set; }
        public string? JobTitleCode { get; set; }
        public bool IsCoordinator { get; set; }
        public bool HasSignatureImage { get; set; }

        public string? ResolvedEmployeeFullName { get; set; }
        public bool IdentityUserAlreadyExists { get; set; }
        public string? CurrentUserNameOnEmployee { get; set; }
        public string? ResolvedJobTitleName { get; set; }
        // Scope the coordinator role applies to, derived from the employee's current Group/Department.
        public string? CoordinatorScopeDescription { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public class EmployeeIdentityLinkImportPreviewResultDto
    {
        public List<EmployeeIdentityLinkImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        public int NewIdentityUserCount { get; set; }
        public int RowsWithSignatureCount { get; set; }
        public int RowsWithJobTitleCount { get; set; }
        public int RowsWithCoordinatorCount { get; set; }
    }

    public class EmployeeIdentityLinkImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public class EmployeeIdentityLinkImportConfirmResultDto
    {
        public int SuccessCount { get; set; }
        public int CreatedIdentityUserCount { get; set; }
        public int EmailSetCount { get; set; }
        public int SignatureSetCount { get; set; }
        public int JobTitleAssignedCount { get; set; }
        public int CoordinatorAddedCount { get; set; }
        public int SkippedCount { get; set; }
        public List<EmployeeIdentityLinkImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
