namespace Asset.Domain.Enums;

// Single source for IpAddressStatus text, including validation messages, so errors match what users see.
public static class IpAddressStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this IpAddressStatus status) => status switch
    {
        IpAddressStatus.Available => "Chưa sử dụng",
        IpAddressStatus.AssignedExternal => "Đã sử dụng (khác)",
        IpAddressStatus.Assigned => "Đã sử dụng",
        _ => UnknownText
    };

    // Out-of-range values fall back to the "unknown" text instead of throwing.
    public static string GetIpAddressStatusText(this int status)
        => Enum.IsDefined(typeof(IpAddressStatus), status)
            ? ((IpAddressStatus)status).GetDisplayText()
            : UnknownText;
}
