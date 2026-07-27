namespace Shared.Application.Interfaces
{
    public interface IEmailService
    {
        // Catches SMTP errors internally within the implementation, does NOT throw — returns false + logs
        // if sending fails. Sending email is only a supplementary channel (notification/confirmation)
        // and must never break the main business logic (form creation/approval/signature update must
        // still succeed even if SMTP is failing).
        Task<bool> SendAsync(string toEmail, string subject, string htmlBody);
    }
}
