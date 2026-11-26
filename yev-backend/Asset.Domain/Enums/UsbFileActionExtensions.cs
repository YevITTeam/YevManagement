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
        UsbFileAction.CopiedIn => "Chép vào máy",
        _ => UnknownText
    };

    public static string GetUsbFileActionText(this int action)
        => Enum.IsDefined(typeof(UsbFileAction), action)
            ? ((UsbFileAction)action).GetDisplayText()
            : UnknownText;

    public const long LargeFileBytes = 10L * 1024 * 1024;

    // Documents, drawings, databases, archives, mailboxes and keys: what leaks company data.
    public static readonly string[] SensitiveExtensions =
    {
        ".xlsx", ".xls", ".xlsm", ".csv", ".docx", ".doc", ".pdf", ".pptx", ".ppt",
        ".dwg", ".dxf", ".cad", ".sql", ".bak", ".mdb", ".accdb", ".sqlite", ".db",
        ".zip", ".rar", ".7z", ".tar", ".gz", ".pst", ".ost", ".kdbx", ".key", ".pem", ".pfx", ".env"
    };

    // Inbound files that can run code on the PC.
    public static readonly string[] RiskyInboundExtensions =
    {
        ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".pif", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".hta",
        ".jar", ".dll", ".lnk", ".reg", ".iso", ".img", ".docm", ".xlsm", ".pptm"
    };

    // Writes to the USB are flagged by data type or size (>= 10 MB); copies into the PC only when executable.
    // Deletes and Office "~$" owner files never: they carry no data.
    public static bool IsSensitiveFileEvent(int action, string filePath, long? sizeBytes)
    {
        if (action == (int)UsbFileAction.Deleted || Path.GetFileName(filePath).StartsWith("~$")) return false;
        var extension = Path.GetExtension(filePath);
        if (action == (int)UsbFileAction.CopiedIn)
            return RiskyInboundExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
        return SensitiveExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase) || sizeBytes >= LargeFileBytes;
    }
}
