using Identity.Application.Interfaces.Service;
using Shared.Application.Interfaces;
using Shared.Application.Services;

namespace Identity.Application.Services
{
    // Implements IUserDirectoryService (Shared.Application) — a bridge that lets the Attendance module look up
    // a User's Email/FullName/effective permission without needing a direct ProjectReference to Identity.Application.
    // Scrutor auto-registers this class against the interface at host startup (see docs/architecture-core.md §DI).
    public class UserDirectoryService : BaseService<IIdentityUnitOfWork>, IUserDirectoryService
    {
        public UserDirectoryService(IIdentityUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            return (user?.Email, user?.FullName);
        }

        // Effective permission = Role-based permissions, plus individually granted permissions
        // (UserPermission.IsGranted=true), minus individually revoked permissions (IsGranted=false) —
        // a deny override always wins over a Role grant. Mirrors the exact same computation as the JWT
        // claim builder (Identity.Infrastructure/Authentication/MyClaimsTransformation.cs:162-179), kept
        // separate here since that lives in Infrastructure and reads straight from the DB by UserName
        // instead of an already-loaded ClaimsPrincipal.
        public async Task<bool> UserHasPermissionAsync(string userName, string permissionCode)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName, x => x.Roles);
            if (user == null) return false;

            var roleIds = user.Roles.Select(r => r.Id).ToList();
            var rolePermissions = await _unitOfWork.Roles.FindWithIncludesAsync(
                r => roleIds.Contains(r.Id), r => r.Permissions);
            var basePermissionCodes = rolePermissions.SelectMany(r => r.Permissions).Select(p => p.Code);

            var overrides = await _unitOfWork.UserPermissions.FindWithIncludesAsync(
                x => x.UserId == user.Id, x => x.Permission);
            var grantedCodes = overrides.Where(x => x.IsGranted).Select(x => x.Permission.Code);
            var deniedCodes = overrides.Where(x => !x.IsGranted).Select(x => x.Permission.Code).ToHashSet();

            var effectiveCodes = basePermissionCodes.Union(grantedCodes).Except(deniedCodes);
            return effectiveCodes.Contains(permissionCode);
        }
    }
}
