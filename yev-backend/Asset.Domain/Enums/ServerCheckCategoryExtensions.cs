namespace Asset.Domain.Enums;

public static class ServerCheckCategoryExtensions
{
    public const string UnknownText = "Không xác định";

    public static string GetDisplayText(this ServerCheckCategory category) => category switch
    {
        ServerCheckCategory.Server => "Server",
        ServerCheckCategory.Network => "Network",
        ServerCheckCategory.Ups => "UPS",
        ServerCheckCategory.AirConditioner => "Máy lạnh",
        _ => UnknownText
    };

    public static string GetServerCheckCategoryText(this int category)
        => Enum.IsDefined(typeof(ServerCheckCategory), category)
            ? ((ServerCheckCategory)category).GetDisplayText()
            : UnknownText;
}
