namespace Shared.Application.Interfaces
{
    public interface IEmailService
    {
        // Queues the mail on disk; EmailOutboxBackgroundService delivers it spaced out and retries transient
        // failures. Never throws: returns false only when SMTP is not configured or the mail could not be queued.
        Task<bool> SendAsync(string toEmail, string subject, string htmlBody);

        // Bypasses the queue, for the SMTP test button whose whole point is the live result.
        Task<bool> SendNowAsync(string toEmail, string subject, string htmlBody);
    }
}
