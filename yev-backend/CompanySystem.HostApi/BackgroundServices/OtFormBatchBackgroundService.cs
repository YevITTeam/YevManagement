using Attendance.Application.Interfaces.Service;
using Shared.Application.Helper;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Runs a daily sweep (fixed 15:00): bundles every OT Form still un-batched and waiting on the
    // Department Manager (OtFormStatus.Pending) into ONE NEW "Đơn tổng" per Department, and sends a
    // reminder mail for every batch from a previous day that is still unresolved (see
    // docs/attendance-module.md — §Đơn tổng). Same daily-delay + scoped-service pattern as
    // DeviceLiquidationBackgroundService.
    public class OtFormBatchBackgroundService : BackgroundService
    {
        private static readonly TimeSpan RunAtTimeOfDay = new(15, 0, 0);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OtFormBatchBackgroundService> _logger;

        public OtFormBatchBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<OtFormBatchBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var delay = GetDelayUntilNextRun();
                try
                {
                    await Task.Delay(delay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                if (stoppingToken.IsCancellationRequested) break;

                await RunOnceAsync();
            }
        }

        private static TimeSpan GetDelayUntilNextRun()
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var nextRun = now.Date.Add(RunAtTimeOfDay);
            if (nextRun <= now) nextRun = nextRun.AddDays(1);
            return nextRun - now;
        }

        private async Task RunOnceAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var otFormService = scope.ServiceProvider.GetRequiredService<IOtFormService>();

            try
            {
                await otFormService.RunDailyBatchSweepAsync();
                _logger.LogInformation("OtFormBatchBackgroundService: đã chạy xong đợt gom đơn tổng hằng ngày.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OtFormBatchBackgroundService: lỗi khi gom đơn tổng hằng ngày.");
            }
        }
    }
}
