namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormListItemDto
    {
        public int Id { get; set; }

        // Null for production-line forms (no fixed GroupId).
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
        public bool IsProductionForm { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public string WorkshopNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string? OtCaseDescription { get; set; }
        public string? OtCaseDescriptionJp { get; set; }
        public DateOnly Date { get; set; }
        public decimal TotalHour { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // FE prefers this, falling back to CreatedByUserName.
        public string? CreatedByFullName { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // True when InApproval and no step approved yet; drives the Edit button in the list.
        public bool IsEditable { get; set; }

        // Lets the list show who approved / who is pending without opening each form. Ordered by ActionAt.
        public List<ApprovalSummaryItemDto> ApprovalSummary { get; set; } = new();

        // Candidates for the current pending step, for "waiting on 1 of N" (0 when not InApproval).
        public int CurrentStepCandidateCount { get; set; }

        // Distinct lines/shift teams among active employees, joined by ", " (a form may span lines). Null for group forms.
        public string? ProductionLineNames { get; set; }
        public string? ProductionShiftTeamNames { get; set; }
    }
}
