namespace Asset.Domain.Enums;

// Display text for DeviceStatus, mirroring IpAddressStatusExtensions (2026-07-23). Added so the
// import services can name the blocking status in their error messages without copying the wording
// a 4th time; DeviceService.GetStatusText now delegates here.
public static class DeviceStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this DeviceStatus status) => status switch
    {
        DeviceStatus.PendingUse => "Chờ sử dụng",
        DeviceStatus.InUse => "Đang sử dụng",
        DeviceStatus.PendingLiquidation => "Chờ thanh lý",
        DeviceStatus.Liquidated => "Đã thanh lý",
        _ => UnknownText
    };

    public static string GetDeviceStatusText(this int status)
        => Enum.IsDefined(typeof(DeviceStatus), status)
            ? ((DeviceStatus)status).GetDisplayText()
            : UnknownText;
}
