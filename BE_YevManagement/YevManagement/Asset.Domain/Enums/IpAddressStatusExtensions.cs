namespace Asset.Domain.Enums;

// Single source of truth for the IpAddressStatus display text (2026-07-23). It used to be
// duplicated in 3 places inside IpAddressService with 2 different wordings ("Chưa gán" on the
// grid vs "Chưa sử dụng" on the detail screen) — everything now goes through here, including
// the validation messages so the error text always matches what the user sees on screen.
// Wording chosen by the user: "sử dụng" (not "gán").
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

    // Overload for the raw int stored on the entity/DTO — an out-of-range value falls back to
    // "Không xác định" instead of throwing.
    public static string GetIpAddressStatusText(this int status)
        => Enum.IsDefined(typeof(IpAddressStatus), status)
            ? ((IpAddressStatus)status).GetDisplayText()
            : UnknownText;
}
