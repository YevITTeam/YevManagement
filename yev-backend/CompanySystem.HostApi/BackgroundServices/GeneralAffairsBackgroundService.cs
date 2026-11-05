using Attendance.Application.Interfaces.Service;
using Shared.Application.Helper;
using Shared.Core.Exceptions;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Same schedule pattern as OtFormBatchBackgroundService: send time is re-read each loop, a missed run catches up on start.
    public class GeneralAffairsBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GeneralAffairsBackgroundService> _logger;

        public GeneralAffairsBackgroundService(IServiceScopeFactory scopeFactory, ILogger<GeneralAffairsBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var isFirstLoop = true;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(await GetDelayUntilNextRunAsync(catchUp: isFirstLoop), stoppingToken);
                    isFirstLoop = false;
                }
                catch (Exception ex) when (ex is OperationCanceledException or ObjectDisposedException)
                {
                    break;
                }

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var sent = await scope.ServiceProvider.GetRequiredService<IGeneralAffairsReportService>().SendPendingAsync();
                    _logger.LogInformation("GeneralAffairsBackgroundService: đã gửi {Count} mail dữ liệu tăng ca cho Tổng vụ.", sent);
                }
                catch (DomainException ex)
                {
                    _logger.LogInformation("GeneralAffairsBackgroundService: bỏ qua — {Message}", ex.Message);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "GeneralAffairsBackgroundService: lỗi khi gửi dữ liệu tăng ca cho Tổng vụ.");
                }
            }
        }

        private async Task<TimeSpan> GetDelayUntilNextRunAsync(bool catchUp)
        {
            using var scope = _scopeFactory.CreateScope();
            var (runAt, lastRunDate) = await scope.ServiceProvider.GetRequiredService<IAttendanceSettingService>().GetGeneralAffairsScheduleAsync();

            var now = TimeHelper.GetCurrentUtcTime();
            var nextRun = now.Date.Add(runAt.ToTimeSpan());
            if (nextRun <= now)
            {
                if (catchUp && lastRunDate < DateOnly.FromDateTime(now)) return TimeSpan.Zero;
                nextRun = nextRun.AddDays(1);
            }
            return nextRun - now;
        }
    }
}
