namespace Shared.Application.Interfaces
{
    // Lets other modules query Identity users without referencing Identity.Application.
    public interface IUserDirectoryService
    {
        // Recipient address for mail sent by moduleCode (EmailModules): the address the admin routed that
        // module to, else the user's primary email. Returns (null, null) for an unknown UserName instead of
        // throwing, so a missing address never blocks the calling business flow.
        Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName, string moduleCode);

        // Effective permission including per-user grant/deny overrides, same rule as the JWT claims.
        Task<bool> UserHasPermissionAsync(string userName, string permissionCode);

        // Only touches IsAutoGranted rows, never Admin's manual overrides. Unknown/empty userName is a no-op
        // (the next sync after linking grants it); an empty desired set revokes all auto grants.
        Task SyncAutoGrantedPermissionsAsync(string? userName, IReadOnlyCollection<string> desiredPermissionCodes);

        // Creates the user with roleName (null = "Basic", like first Windows login); returns true only then.
        // An existing user keeps its roles and just gains roleName when one is given and missing.
        Task<bool> EnsureUserExistsAsync(string userName, string? fullName, string? roleName);

        // Routes moduleCode mail of userName to email, adding it as a manual address when missing (it only
        // becomes primary if the user had no address). Returns false when the UserName has no Identity user.
        Task<bool> SetModuleEmailAsync(string userName, string moduleCode, string email);

        // Effective moduleCode recipient (routed address, else primary) per UserName; unknown users are left out.
        Task<IReadOnlyDictionary<string, string>> GetModuleEmailsAsync(IReadOnlyCollection<string> userNames, string moduleCode);

        // Read-only: already in Identity, active in the directory (WillCreate), or not eligible; duplicates collapsed case-insensitively.
        Task<IReadOnlyList<DomainAccountInfo>> ResolveDomainAccountsAsync(IEnumerable<string> accounts);

        // Resolve, then create a role-Basic User (FullName from the directory) for every WillCreate account.
        // Never throws for one bad account: it comes back as Failed. Creates no emails.
        Task<IReadOnlyList<DomainAccountInfo>> EnsureDomainUsersAsync(IEnumerable<string> accounts);
    }
}
