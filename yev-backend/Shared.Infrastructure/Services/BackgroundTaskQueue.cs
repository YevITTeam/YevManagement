using System.Threading.Channels;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    // Unbounded channel — the only producer today (OtFormService) enqueues at most a handful of items
    // per Create/Approve call (1 email-notification batch), nowhere near enough volume to need a
    // bounded channel with backpressure. Registered as Singleton (see DependencyInjection.cs) so the
    // same queue is shared between request-scoped producers and the singleton QueuedHostedService consumer.
    public class BackgroundTaskQueue : IBackgroundTaskQueue
    {
        private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _channel =
            Channel.CreateUnbounded<Func<IServiceProvider, CancellationToken, Task>>();

        public void QueueBackgroundWorkItem(Func<IServiceProvider, CancellationToken, Task> workItem)
        {
            ArgumentNullException.ThrowIfNull(workItem);
            _channel.Writer.TryWrite(workItem);
        }

        public Task<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(CancellationToken cancellationToken)
        {
            return _channel.Reader.ReadAsync(cancellationToken).AsTask();
        }
    }
}
