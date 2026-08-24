using Asset.Application.Interfaces.Service;
using Asset.Domain.Enums;
using Shared.Application.Helper;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Checks daily (00:30 system time) whether it is time to run; the sweep itself only actually
    // executes once every AssetSetting.LiquidationAfterMonths months (configurable via
    // GET/PUT /api/AssetSetting), tracked through AssetSetting.LastAutoDeleteRunAt — not on a fixed
    // daily cadence (2026-08-22, per user request; see docs/asset-module.md §1.16). When due: every
    // Device already Liquidated(3) and not yet soft-deleted gets auto soft-deleted (IsDeleted=true),
    // with the same cleanup as DeviceService.DeleteAsync (release assigned IpAddresses back to
    // Available, soft-delete DeviceEmails).
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
                var delay = GetDelayUntilNextCheck();
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

        private static TimeSpan GetDelayUntilNextCheck()
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

            try
            {
                var settings = await unitOfWork.AssetSettings.GetAllAsync();
                var setting = settings.FirstOrDefault();
                if (setting == null)
                {
                    _logger.LogWarning("DeviceLiquidationBackgroundService: chưa có cấu hình AssetSetting, bỏ qua lượt này.");
                    return;
                }

                var now = TimeHelper.GetCurrentUtcTime();
                var isDue = setting.LastAutoDeleteRunAt == null
                    || setting.LastAutoDeleteRunAt.Value.AddMonths(setting.LiquidationAfterMonths) <= now;
                if (!isDue) return;

                await SweepLiquidatedDevicesAsync(unitOfWork);

                setting.LastAutoDeleteRunAt = now;
                unitOfWork.AssetSettings.Update(setting);

                await unitOfWork.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeviceLiquidationBackgroundService: lỗi khi tự động xóa thiết bị đã thanh lý.");
            }
        }

        private async Task SweepLiquidatedDevicesAsync(IAssetUnitOfWork unitOfWork)
        {
            var devicesToDelete = await unitOfWork.Devices.FindAsync(d =>
                !d.IsDeleted && d.Status == (int)DeviceStatus.Liquidated);

            if (devicesToDelete.Count == 0) return;

            var deviceIds = devicesToDelete.Select(d => d.Id).ToHashSet();

            foreach (var device in devicesToDelete)
            {
                device.IsDeleted = true;
                unitOfWork.Devices.Update(device);
            }

            var assignedIps = await unitOfWork.IpAddresses.FindAsync(x =>
                x.DeviceId.HasValue && deviceIds.Contains(x.DeviceId.Value) && !x.IsDeleted);
            foreach (var ip in assignedIps)
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                unitOfWork.IpAddresses.Update(ip);
            }

            var emails = await unitOfWork.DeviceEmails.FindAsync(x =>
                deviceIds.Contains(x.DeviceId) && !x.IsDeleted);
            foreach (var email in emails)
            {
                email.IsDeleted = true;
                unitOfWork.DeviceEmails.Update(email);
            }

            _logger.LogInformation(
                "DeviceLiquidationBackgroundService: đã tự động xóa mềm {Count} thiết bị đã thanh lý.",
                devicesToDelete.Count);
        }
    }
}
