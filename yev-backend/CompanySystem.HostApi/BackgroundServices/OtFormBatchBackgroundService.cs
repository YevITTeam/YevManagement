using Attendance.Application.Interfaces.Service;
using Shared.Application.Helper;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Runs a daily sweep (giờ chạy đọc từ AttendanceSetting.BatchAutoSendTime, Admin tự đổi qua màn
    // Cấu hình — mặc định 15:00, xem AttendanceSettingService.DefaultBatchAutoSendTime): bundles every
    // OT Form still un-batched and waiting on the Department Manager (OtFormStatus.Pending) into ONE
    // NEW "Đơn tổng" per Department, and sends a reminder mail for every batch from a previous day
    // that is still unresolved (see docs/attendance-module.md — §Đơn tổng). Same daily-delay +
    // scoped-service pattern as DeviceLiquidationBackgroundService.
    //
    // Giờ được đọc lại MỖI vòng lặp (không cache) — đổi cấu hình sẽ áp dụng cho lần tính delay TIẾP
    // THEO (sau khi vòng chờ hiện tại kết thúc), không đánh thức sớm 1 vòng chờ đang Task.Delay dở —
    // chấp nhận được vì đây là tác vụ chạy 1 lần/ngày, không cần phản hồi tức thời (cần gấp thì dùng
    // nút "Gửi ngay" ở màn Cấu hình, xem OtFormBatchController.RunNow).
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
                    // Host đang shutdown ngay đúng lúc vòng lặp mới bắt đầu — root IServiceProvider đã
                    // bị dispose trước khi kịp check stoppingToken. Coi như tín hiệu dừng, không phải lỗi.
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
