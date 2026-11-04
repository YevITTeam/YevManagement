namespace Shared.Application.Interfaces
{
    // Lets a module record what happened to mail it queued with a trackingId; each tracker ignores ids it did not issue.
    public interface IMailDeliveryTracker
    {
        // sent=false with permanent=false means the mail is queued again for a retry.
        Task TrackAsync(string trackingId, bool sent, bool permanent, int attempts, string? error);
    }
}
