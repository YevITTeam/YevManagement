namespace Asset.Domain.Enums;

public static class InventorySessionStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this InventorySessionStatus status) => status switch
    {
        InventorySessionStatus.InProgress => "Đang kiểm kê",
        InventorySessionStatus.Completed => "Đã hoàn thành",
        _ => UnknownText
    };

    public static string GetInventorySessionStatusText(this int status)
        => Enum.IsDefined(typeof(InventorySessionStatus), status)
            ? ((InventorySessionStatus)status).GetDisplayText()
            : UnknownText;
}
