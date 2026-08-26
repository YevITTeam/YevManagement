namespace Workflow.Domain.Enums;

// workflow-module.md §3.2 FormAccesses — đúng 1 trong 3 cột đích (RoleId/OrgUnitId/EmployeeId) khác
// NULL tương ứng với giá trị này, 2 cột còn lại phải NULL (Service tự validate, DB không ràng buộc
// được điều này bằng CHECK constraint đơn giản).
public enum AccessTargetType
{
    Role = 1,
    OrgUnit = 2,
    Employee = 3
}
