namespace Attendance.Domain.Constants;

// Being listed in a Group's tree is what lets someone act, so the operational rights follow the list, not the job title.
public static class GroupLevelPermissions
{
    public static readonly string[] FormCreatorCodes =
    {
        "Attendance.OTForm.View",
        "Attendance.OTForm.Create",
        "Attendance.UserSignature.View",
        "Attendance.UserSignature.Update",
        "Attendance.SecondaryPassword.Update",
        "Attendance.Department.View",
        "Attendance.Group.View",
        "Attendance.OtCase.View",
        "Attendance.Reason.View",
        "Attendance.Employee.View",
        "Attendance.JobTitle.View",
    };

    public static readonly string[] ApproverCodes =
    {
        "Attendance.OTForm.Approve",
        "Attendance.OTForm.RemoveEmployee",
    };
}
