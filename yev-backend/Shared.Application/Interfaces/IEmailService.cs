namespace Shared.Application.Interfaces
{
    public interface IEmailService
    {
        // Queues the mail on disk; EmailOutboxBackgroundService delivers it spaced out and retries transient
        // failures. Never throws: returns false only when SMTP is not configured or the mail could not be queued.
        // trackingId is handed back to every IMailDeliveryTracker once the outbox knows the outcome.
        // toEmail may list several addresses separated by ';' or ','.
        Task<bool> SendAsync(string toEmail, string subject, string htmlBody, string? trackingId = null, IReadOnlyList<MailAttachment>? attachments = null);

        // Bypasses the queue, for the SMTP test button whose whole point is the live result.
        Task<bool> SendNowAsync(string toEmail, string subject, string htmlBody);
    }

    public record MailAttachment(string FileName, byte[] Content);
}
