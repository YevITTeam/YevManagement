using Microsoft.AspNetCore.Authorization;

namespace Shared.Application.Authorization
{
    public class RequirePermissionAttribute : AuthorizeAttribute
    {
        public RequirePermissionAttribute(string permission) : base()
        {
            Policy = PermissionPolicyProvider.PolicyPrefix + permission;
        }
    }
}
