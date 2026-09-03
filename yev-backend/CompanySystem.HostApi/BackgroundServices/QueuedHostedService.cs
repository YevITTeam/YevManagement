using Shared.Application.Interfaces;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Drains IBackgroundTaskQueue — today the only producer is OtFormService, queuing approval-email
    // notifications after OtForm Create/Approve/RunNow already committed their own DB transaction, so
    // the HTTP response doesn't wait on SMTP round-trips to VNMAIL04 (2026-09-03, xem attendance-module.md
    // "Gửi email duyệt chạy nền"). Each item runs in its own DI scope (mirrors
    // DeviceLiquidationBackgroundService) since the request scope that queued it is already disposed.
    // A failing item is only logged, never retried — same best-effort guarantee EmailService already
    // had when email-sending ran inline (SendAsync swallows its own errors and returns false).
    public class QueuedHostedService : BackgroundService
    {
        private readonly IBackgroundTaskQueue _taskQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<QueuedHostedService> _logger;

        public QueuedHostedService(
            IBackgroundTaskQueue taskQueue,
            IServiceScopeFactory scopeFactory,
            ILogger<QueuedHostedService> logger)
        {
            _taskQueue = taskQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                Func<IServiceProvider, CancellationToken, Task> workItem;
                try
                {
                    workItem = await _taskQueue.DequeueAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    await workItem(scope.ServiceProvider, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "QueuedHostedService: lỗi khi xử lý 1 tác vụ nền.");
                }
            }
        }
    }
}
