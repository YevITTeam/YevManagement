namespace Shared.Application.Interfaces
{
    public enum DomainAccountState
    {
        // A User with this UserName already exists in Identity.
        ExistsInIdentity = 0,
        // Not in Identity, active in the directory: Ensure will create it.
        WillCreate = 1,
        // Created by Ensure just now.
        Created = 2,
        // Found in the directory but the account is disabled.
        Disabled = 3,
        // Not a domain account of the configured domain, or unknown to the directory.
        NotInDirectory = 4,
        // The directory could not be queried, so nothing was decided.
        DirectoryUnavailable = 5,
        // Ensure tried to create the User and failed.
        Failed = 6
    }

    public record DomainAccountInfo(string Account, DomainAccountState State, string? FullName);
}
