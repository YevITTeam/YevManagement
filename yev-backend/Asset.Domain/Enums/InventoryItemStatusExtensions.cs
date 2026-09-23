namespace Asset.Domain.Enums;

public static class InventoryItemStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this InventoryItemStatus status) => status switch
    {
        InventoryItemStatus.Pending => "Chưa kiểm kê",
        InventoryItemStatus.Found => "Đã tìm thấy",
        InventoryItemStatus.Missing => "Thiếu",
        _ => UnknownText
    };

    public static string GetInventoryItemStatusText(this int status)
        => Enum.IsDefined(typeof(InventoryItemStatus), status)
            ? ((InventoryItemStatus)status).GetDisplayText()
            : UnknownText;
}
