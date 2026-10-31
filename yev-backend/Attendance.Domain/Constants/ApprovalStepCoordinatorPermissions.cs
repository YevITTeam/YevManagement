namespace Attendance.Domain.Constants;

// Hardcoded grants for approval-tree coordinators, so they bypass JobTitlePermissionWhitelist. Must be synced in the
// same SyncAutoGrantedPermissionsAsync call as job-title grants, otherwise one call wipes the other.
public static class ApprovalStepCoordinatorPermissions
{
    // Granted to any coordinator: the approval-tree screen loads every tab, so view rights are shared; only Update is per role.
    public static readonly string[] BaseViewCodes =
    {
        "Attendance.Department.View",
        "Attendance.Group.View",
        "Attendance.JobTitle.View",
        "Attendance.Employee.View",
        "Attendance.DepartmentApprovalStep.View",
        "Attendance.GroupApprovalStep.View",
        "Attendance.ProductionApprovalStep.View",
    };

    public const string DepartmentUpdateCode = "Attendance.DepartmentApprovalStep.Update";

    public const string GroupUpdateCode = "Attendance.GroupApprovalStep.Update";

    public const string ProductionUpdateCode = "Attendance.ProductionApprovalStep.Update";

    // Granted to department and group coordinators, scoped to what they coordinate (EnsureCanManageDeptOrGroupScopeAsync).
    public const string EmployeeUpdateOtLimitCode = "Attendance.Employee.UpdateOtLimit";

    public const string EmployeeAccumulationUpdateCode = "Attendance.EmployeeAccumulation.Update";

    // Bulk version of EmployeeAccumulationUpdateCode; scope is checked per Excel row.
    public const string EmployeeAccumulationImportCode = "Attendance.EmployeeAccumulation.Import";

    // Full profile CRUD like Admin, but locked to the coordinator's department/group scope.
    public const string EmployeeCreateCode = "Attendance.Employee.Create";
    public const string EmployeeUpdateCode = "Attendance.Employee.Update";
    public const string EmployeeDeleteCode = "Attendance.Employee.Delete";

    // Department coordinators only: production staff belong to a whole department, not a sub-group.
    public const string ProductionEmployeeViewCode = "Attendance.ProductionEmployee.View";
    public const string ProductionEmployeeUpdateCode = "Attendance.ProductionEmployee.Update";
    public const string ProductionEmployeeImportCode = "Attendance.ProductionEmployee.Import";
    public const string ProductionEmployeeExportCode = "Attendance.ProductionEmployee.Export";
}
