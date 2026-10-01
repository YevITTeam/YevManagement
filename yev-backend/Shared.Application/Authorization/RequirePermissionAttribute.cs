using Microsoft.AspNetCore.Authorization;

namespace Shared.Application.Authorization
{
    public class RequirePermissionAttribute : AuthorizeAttribute
    {
        // params cho phép truyền NHIỀU permission, coi là quan hệ OR — chỉ cần có 1 trong số đó là qua
        // được cổng này (xem PermissionRequirement/PermissionAuthorizationHandler/PermissionPolicyProvider,
        // 2026-09-28). Đa số action vẫn chỉ truyền đúng 1 permission như trước, hành vi không đổi.
        public RequirePermissionAttribute(params string[] permissions) : base()
        {
            Policy = PermissionPolicyProvider.PolicyPrefix + string.Join(PermissionPolicyProvider.PermissionSeparator, permissions);
        }
    }
}
