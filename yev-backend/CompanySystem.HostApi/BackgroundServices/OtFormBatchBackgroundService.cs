using Attendance.Application.Interfaces.Service;
using Shared.Application.Helper;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Run time is re-read each loop, so a settings change applies from the next wait, not the current one;
    // acceptable for a daily job (use RunNow when urgent).
    public class OtFormBatchBackgroundService : BackgroundService
    {
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
                TimeSpan delay;
                try
                {
                    delay = await GetDelayUntilNextRunAsync();
                }
                catch (ObjectDisposedException)
                {
                    // Root provider disposed during shutdown before stoppingToken was observed; treat as stop.
                    break;
                }

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

        private async Task<TimeSpan> GetDelayUntilNextRunAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var attendanceSettingService = scope.ServiceProvider.GetRequiredService<IAttendanceSettingService>();
            var runAtTimeOfDay = (await attendanceSettingService.GetBatchAutoSendTimeAsync()).ToTimeSpan();

            var now = TimeHelper.GetCurrentUtcTime();
            var nextRun = now.Date.Add(runAtTimeOfDay);
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
