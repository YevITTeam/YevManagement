using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class JobTitle
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    // Higher = more senior; only used to drop titles at or below the creator's rank from the chain, not to auto-bridge levels.
    public int RankOrder { get; set; }

    // Attendance.Domain.Enums.JobTitleTerminalLevel.
    public int TerminalLevel { get; set; }

    // Marks the Line Leader title: its holders act only on their own Employee.ProductionLineId.
    // Kept separate from TerminalLevel because Line Leader is not terminal.
    public bool IsLineScoped { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public virtual ICollection<DepartmentApprovalStep> DepartmentApprovalSteps { get; set; } = new List<DepartmentApprovalStep>();

    public virtual ICollection<GroupApprovalStep> GroupApprovalSteps { get; set; } = new List<GroupApprovalStep>();

    public virtual ICollection<JobTitlePermission> JobTitlePermissions { get; set; } = new List<JobTitlePermission>();

    public virtual ICollection<ProductionApprovalStep> ProductionApprovalSteps { get; set; } = new List<ProductionApprovalStep>();
}
