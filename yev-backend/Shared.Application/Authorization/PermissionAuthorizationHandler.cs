using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Threading.Tasks;

namespace Shared.Application.Authorization
{
    public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
    {
        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            PermissionRequirement requirement)
        {
            // OR: any one of the listed permissions suffices.
            if (requirement.Permissions.Any(permission => context.User.HasClaim("Permission", permission)))
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
