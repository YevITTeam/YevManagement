namespace Asset.Domain.Enums;

public static class ServerCheckSessionStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this ServerCheckSessionStatus status) => status switch
    {
        ServerCheckSessionStatus.InProgress => "Đang quét",
        ServerCheckSessionStatus.Completed => "Đã hoàn thành",
        _ => UnknownText
    };

    public static string GetServerCheckSessionStatusText(this int status)
        => Enum.IsDefined(typeof(ServerCheckSessionStatus), status)
            ? ((ServerCheckSessionStatus)status).GetDisplayText()
            : UnknownText;
}
