using Microsoft.AspNetCore.Authorization;

namespace Shared.Application.Authorization
{
    public class RequirePermissionAttribute : AuthorizeAttribute
    {
        // Multiple permissions are OR-ed.
        public RequirePermissionAttribute(params string[] permissions) : base()
        {
            Policy = PermissionPolicyProvider.PolicyPrefix + string.Join(PermissionPolicyProvider.PermissionSeparator, permissions);
        }
    }
}
