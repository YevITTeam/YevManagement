namespace Asset.Domain.Enums;

public static class UsbFileActionExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this UsbFileAction action) => action switch
    {
        UsbFileAction.Created => "Tạo mới",
        UsbFileAction.Modified => "Sửa",
        UsbFileAction.Deleted => "Xoá",
        UsbFileAction.Renamed => "Đổi tên",
        _ => UnknownText
    };

    public static string GetUsbFileActionText(this int action)
        => Enum.IsDefined(typeof(UsbFileAction), action)
            ? ((UsbFileAction)action).GetDisplayText()
            : UnknownText;
}
