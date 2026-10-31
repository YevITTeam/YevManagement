using System.Collections.Generic;

namespace Shared.Application.Authorization
{
    // OR semantics, for endpoints where two permissions are equivalent (e.g. OTForm.Create or CreateProduction);
    // the action itself re-checks the exact permission per mode.
    public class PermissionRequirement : Microsoft.AspNetCore.Authorization.IAuthorizationRequirement
    {
        public IReadOnlyList<string> Permissions { get; }

        public PermissionRequirement(params string[] permissions)
        {
            Permissions = permissions;
        }
    }
}
