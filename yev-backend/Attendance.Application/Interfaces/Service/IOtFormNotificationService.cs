using Attendance.Domain.Entities;

namespace Attendance.Application.Interfaces.Service
{
    // Every OT form / batch mail. Never throws on a missing address or template: mail is a supplementary channel.
    public interface IOtFormNotificationService
    {
        // Runs after the request scope is disposed, so it reloads the form and step by Id.
        Task SendStepApprovalNotificationAsync(int otFormId, int otFormApprovalStepId);

        // The creator gets no other signal when an approver finishes, rejects or trims their form.
        Task SendApprovedNotificationAsync(int otFormId);
        Task SendRejectedNotificationAsync(int otFormId);
        Task SendEmployeesRemovedNotificationAsync(int otFormId, List<int> employeeIds);

        // Mails the delegate of an active delegation for steps already waiting on the delegator.
        Task SendDelegationBackfillNotificationsAsync(int delegationId);

        // Adds tokens and saves them; one mail per UserName even when they are a candidate on several forms.
        Task NotifyBatchApproversAsync(OtFormBatch batch, List<OtForm> activeForms, (string Vn, string? Jp) scopeName, bool isReminder);
    }
}
