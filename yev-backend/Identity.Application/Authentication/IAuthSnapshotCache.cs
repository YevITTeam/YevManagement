namespace Identity.Application.Authentication
{
    // Per-user identity data (roles, effective permissions, display fields) that MyClaimsTransformation
    // loads from the DB. Cached so Bearer requests do not hit the DB on every call.
    public sealed record AuthSnapshot(
        int UserId,
        string? FullName,
        string? Email,
        IReadOnlyList<string> Roles,
        IReadOnlyList<string> Permissions);

    public interface IAuthSnapshotCache
    {
        bool TryGet(string userName, out AuthSnapshot snapshot);

        void Set(string userName, AuthSnapshot snapshot);

        // Drops every cached snapshot (called after any write that can change roles/permissions/profile).
        void InvalidateAll();
    }
}
