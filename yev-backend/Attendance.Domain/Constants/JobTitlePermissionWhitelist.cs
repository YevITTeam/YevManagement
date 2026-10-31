namespace Attendance.Domain.Constants;

// Only workflow-participation permissions; never add admin/CRUD codes here, or a user could escalate
// privileges by changing their own job title. Validated in JobTitlePermissionService.ReplaceAsync.
public static class JobTitlePermissionWhitelist
{
    public static readonly IReadOnlySet<string> AllowedCodes = new HashSet<string>
    {
        "Attendance.OTForm.View",
        "Attendance.OTForm.Create",
        "Attendance.OTForm.Approve",
        "Attendance.OTForm.RemoveEmployee",
        "Attendance.OTForm.AddEmployee",
        "Attendance.OTForm.Delegate",
        "Attendance.OTForm.CreateProduction",
        "Attendance.UserSignature.View",
        "Attendance.UserSignature.Update",
        "Attendance.SecondaryPassword.Update",
        "Attendance.Department.View",
        "Attendance.Group.View",
        "Attendance.OtCase.View",
        "Attendance.Reason.View",
        "Attendance.Employee.View",
        "Attendance.JobTitle.View",
        "Attendance.ProductionOtReport.View",
        "Attendance.ProductionEmployee.View",
        "Attendance.ProductionEmployee.Update",
        "Attendance.ProductionEmployee.Import",
        "Attendance.ProductionEmployee.Export",
        "Attendance.EmployeeAccumulation.Import",
    };
}
