namespace Identity.Application.Interfaces.Service
{
    public interface IActiveDirectoryAuthService
    {
        // Binds directly to AD to validate a plain username/password pair — used by the custom
        // login form (POST /Auth/login) as a replacement for the browser-driven Negotiate handshake.
        // Throws if the domain controller can't be reached; returns false for a wrong username/password.
        bool ValidateCredentials(string domain, string userName, string password);

        // AD "mail" plus every smtp entry of "proxyAddresses" for a DOMAIN\user account. Empty when the
        // account is not a domain account or AD cannot be reached.
        AdEmailAddresses GetEmailAddresses(string windowsUserName);
    }

    public record AdEmailAddresses(string? Mail, IReadOnlyList<string> Aliases)
    {
        public static readonly AdEmailAddresses Empty = new(null, Array.Empty<string>());
    }
}
