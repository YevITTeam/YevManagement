using Attendance.Application.Interfaces.Service;
using Microsoft.EntityFrameworkCore;
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
            var isFirstLoop = true;
            while (!stoppingToken.IsCancellationRequested)
            {
                TimeSpan delay;
                try
                {
                    delay = await GetDelayUntilNextRunAsync(catchUp: isFirstLoop);
                    isFirstLoop = false;
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

        // catchUp: an app pool started (or woken) after today's run time that missed it runs right away.
        private async Task<TimeSpan> GetDelayUntilNextRunAsync(bool catchUp)
        {
            using var scope = _scopeFactory.CreateScope();
            var attendanceSettingService = scope.ServiceProvider.GetRequiredService<IAttendanceSettingService>();
            var (runAt, lastRunDate) = await attendanceSettingService.GetBatchScheduleAsync();

            var now = TimeHelper.GetCurrentUtcTime();
            var nextRun = now.Date.Add(runAt.ToTimeSpan());
            if (nextRun <= now)
            {
                if (catchUp && lastRunDate < DateOnly.FromDateTime(now)) return TimeSpan.Zero;
                nextRun = nextRun.AddDays(1);
            }
            return nextRun - now;
        }

        private async Task RunOnceAsync(int attempt = 1)
        {
            using var scope = _scopeFactory.CreateScope();
            var otFormService = scope.ServiceProvider.GetRequiredService<IOtFormService>();

            try
            {
                await otFormService.RunDailyBatchSweepAsync();
                _logger.LogInformation("OtFormBatchBackgroundService: đã chạy xong đợt gom đơn tổng hằng ngày.");
            }
            // A form edited at the same moment (OtForm rowversion) fails the sweep; a fresh scope sees the new row.
            catch (DbUpdateConcurrencyException) when (attempt < 3)
            {
                _logger.LogWarning("OtFormBatchBackgroundService: đơn vừa bị sửa đồng thời, chạy lại lần {Attempt}.", attempt + 1);
                await RunOnceAsync(attempt + 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OtFormBatchBackgroundService: lỗi khi gom đơn tổng hằng ngày.");
            }
        }
    }
}
