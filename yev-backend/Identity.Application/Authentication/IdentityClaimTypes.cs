namespace Identity.Application.Authentication
{
    // Shared names for the claims/identity that the Identity module builds itself. Kept in one place
    // because the same literals are used in three layers that must agree exactly: MyClaimsTransformation
    // (Infrastructure — creates them), TokenService (Application — packs them into the JWT) and
    // AuthController (Api — reads them back into UserDto).
    public static class IdentityClaimTypes
    {
        // AuthenticationType of the extra ClaimsIdentity that MyClaimsTransformation attaches after
        // reading the DB. It is the source of truth for Role/Permission on EVERY authenticated request;
        // the copies embedded in a JWT are only a snapshot taken at login time and may be stale.
        public const string DbRolesAuthenticationType = "DbRoles";

        public const string Permission = "Permission";
        public const string FullName = "FullName";
        public const string Email = "Email";
        public const string DeviceName = "DeviceName";
        public const string IpAddress = "IpAddress";
        public const string IsLocalAccount = "IsLocalAccount";
        public const string MustChangePassword = "MustChangePassword";

        // Numeric Identity.Users.Id, added 2026-08-25 so other modules (starting with Workflow —
        // Workflow.Domain.Entities.Employee.UserId, workflow-module.md §1.4) can resolve "which
        // Employee row is the current logged-in user" without a username/email match. Before this,
        // no claim carried the numeric id at all — every module only had the Windows username string
        // (ClaimTypes.Name). Safe to add: existing JWTs without this claim keep working, they just
        // can't resolve a current Employee until the holder re-logs in and gets a fresh token.
        public const string UserId = "UserId";

        // Marks a principal whose Role/Permission claims were already loaded from the DB during the
        // current request. Must NEVER be written into the JWT: if it were, the next Bearer request
        // would short-circuit MyClaimsTransformation and keep running on the stale snapshot.
        public const string RolesLoaded = "RolesLoaded";
    }
}
