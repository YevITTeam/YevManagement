namespace Asset.Domain.Enums;

public static class ServerCheckItemStatusExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this ServerCheckItemStatus status) => status switch
    {
        ServerCheckItemStatus.Pending => "Chưa quét",
        ServerCheckItemStatus.Ok => "OK",
        ServerCheckItemStatus.Ng => "NG",
        _ => UnknownText
    };

    public static string GetServerCheckItemStatusText(this int status)
        => Enum.IsDefined(typeof(ServerCheckItemStatus), status)
            ? ((ServerCheckItemStatus)status).GetDisplayText()
            : UnknownText;
}
