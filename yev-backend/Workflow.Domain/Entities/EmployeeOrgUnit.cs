namespace Workflow.Domain.Entities;

// "One active IsPrimary per Employee" and "one holder per (OrgUnitId, JobTitleId)" are validated in the Service,
// not the DB, because rows have validity periods (ValidFrom/ValidTo).
public partial class EmployeeOrgUnit
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int OrgUnitId { get; set; }

    public int? JobTitleId { get; set; }

    public bool IsPrimary { get; set; }

    public DateTime? ValidFrom { get; set; }

    public DateTime? ValidTo { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Employee Employee { get; set; } = null!;

    public virtual OrgUnit OrgUnit { get; set; } = null!;

    public virtual JobTitle? JobTitle { get; set; }
}
