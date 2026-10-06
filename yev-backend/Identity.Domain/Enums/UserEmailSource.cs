namespace Identity.Domain.Enums;

public enum UserEmailSource
{
    // AD "mail" attribute, read at login.
    Ad = 0,

    // AD "proxyAddresses" alias (smtp:...).
    AdAlias = 1,

    // Email of a device whose Tanium "Last Logged In User" is this account.
    Tanium = 2,

    // Typed by an admin.
    Manual = 3
}
