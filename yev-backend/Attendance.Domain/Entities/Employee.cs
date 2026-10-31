using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Employee
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    // Nullable: not every employee has a login account.
    public string? UserName { get; set; }

    // Department comes via Group.DepartmentId. Required only for non-terminal job titles, enforced in
    // EmployeeService.ValidateOrganizationAssignment rather than by the DB.
    public int? GroupId { get; set; }

    // Only for DepartmentManager titles; WorkshopManager/GeneralDirector leave both GroupId and DepartmentId null (company-wide).
    public int? DepartmentId { get; set; }

    // One job title per person (no concurrent titles).
    public int? JobTitleId { get; set; }

    // Null = AttendanceSetting default. There is no per-employee daily limit by design.
    public decimal? CustomMonthlyOtHourLimit { get; set; }

    public decimal? CustomYearlyOtHourLimit { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group? Group { get; set; }

    public virtual Department? Department { get; set; }

    public virtual JobTitle? JobTitle { get; set; }

    public virtual ICollection<EmployeeApprovalScope> ApprovalScopes { get; set; } = new List<EmployeeApprovalScope>();

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<EmployeeAccumulationHistory> EmployeeAccumulationHistories { get; set; } = new List<EmployeeAccumulationHistory>();

    public virtual ICollection<ProductionEmployee> ProductionEmployees { get; set; } = new List<ProductionEmployee>();
}
