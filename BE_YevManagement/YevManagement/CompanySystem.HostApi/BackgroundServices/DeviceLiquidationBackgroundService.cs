using Asset.Application.Interfaces.Service;
using Asset.Domain.Enums;
using Shared.Application.Helper;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Runs a daily sweep (default 00:30 system time): Devices that are Pending Use/In Use
    // and have expired (ExpirationDate < today) → move to "Pending Liquidation"; Devices in "Pending
    // Liquidation" whose ExpirationDate has passed the configured number of months (AssetSetting.LiquidationAfterMonths,
    // see docs/asset-module.md) → move to "Liquidated". Devices with IsDeleted are not touched.
    public class DeviceLiquidationBackgroundService : BackgroundService
    {
        private static readonly TimeSpan RunAtTimeOfDay = new(0, 30, 0);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DeviceLiquidationBackgroundService> _logger;

        public DeviceLiquidationBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<DeviceLiquidationBackgroundService> logger)
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

                await RunOnceAsync(stoppingToken);
            }
        }

        private static TimeSpan GetDelayUntilNextRun()
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var nextRun = now.Date.Add(RunAtTimeOfDay);
            if (nextRun <= now) nextRun = nextRun.AddDays(1);
            return nextRun - now;
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IAssetUnitOfWork>();
            var settingService = scope.ServiceProvider.GetRequiredService<IAssetSettingService>();

            try
            {
                var setting = await settingService.GetAsync();
                var today = TimeHelper.GetCurrentUtcTime().Date;

                var toPendingLiquidation = await unitOfWork.Devices.FindAsync(d =>
                    !d.IsDeleted &&
                    (d.Status == (int)DeviceStatus.PendingUse || d.Status == (int)DeviceStatus.InUse) &&
                    d.ExpirationDate != null && d.ExpirationDate.Value < today);

                foreach (var device in toPendingLiquidation)
                {
                    device.Status = (int)DeviceStatus.PendingLiquidation;
                    unitOfWork.Devices.Update(device);
                }

                var toLiquidated = await unitOfWork.Devices.FindAsync(d =>
                    !d.IsDeleted &&
                    d.Status == (int)DeviceStatus.PendingLiquidation &&
                    d.ExpirationDate != null && d.ExpirationDate.Value.AddMonths(setting.LiquidationAfterMonths) < today);

                foreach (var device in toLiquidated)
                {
                    device.Status = (int)DeviceStatus.Liquidated;
                    unitOfWork.Devices.Update(device);
                }

                await unitOfWork.SaveChangesAsync();

                _logger.LogInformation(
                    "DeviceLiquidationBackgroundService: {PendingCount} thiết bị -> Chờ thanh lý, {LiquidatedCount} thiết bị -> Đã thanh lý.",
                    toPendingLiquidation.Count, toLiquidated.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeviceLiquidationBackgroundService: lỗi khi rà soát trạng thái thiết bị.");
            }
        }
    }
}
