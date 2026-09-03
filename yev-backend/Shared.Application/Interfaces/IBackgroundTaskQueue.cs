namespace Shared.Application.Interfaces
{
    // FIFO queue for background work a request handler wants to trigger without waiting for it to
    // finish (e.g. sending OtForm approval-notification emails after Create/Approve already committed
    // its own DB transaction — see OtFormService.SendStepApprovalNotificationAsync). The request's own
    // DI scope is disposed by the time a queued item runs, so a work item must resolve everything it
    // needs from the IServiceProvider it's given, never capture a request-scoped dependency directly.
    public interface IBackgroundTaskQueue
    {
        void QueueBackgroundWorkItem(Func<IServiceProvider, CancellationToken, Task> workItem);

        Task<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(CancellationToken cancellationToken);
    }
}
