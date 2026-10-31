namespace Workflow.Domain.Enums;

// Exactly one of RoleId/OrgUnitId/EmployeeId is non-null per value; validated in the Service, not by a DB constraint.
public enum AccessTargetType
{
    Role = 1,
    OrgUnit = 2,
    Employee = 3
}
