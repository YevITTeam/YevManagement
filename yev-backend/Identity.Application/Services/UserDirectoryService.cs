using Identity.Application.Interfaces.Service;
using Shared.Application.Interfaces;
using Shared.Application.Services;

namespace Identity.Application.Services
{
    // Implements IUserDirectoryService (Shared.Application) — a bridge that lets the Attendance module look up
    // a User's Email/FullName/Role without needing a direct ProjectReference to Identity.Application.
    // Scrutor auto-registers this class against the interface at host startup (see docs/architecture-core.md §DI).
    public class UserDirectoryService : BaseService<IIdentityUnitOfWork>, IUserDirectoryService
    {
        public UserDirectoryService(IIdentityUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            return (user?.Email, user?.FullName);
        }

        public async Task<List<string>> GetUserNamesInRoleAsync(string roleName)
        {
            var roles = await _unitOfWork.Roles.FindWithIncludesAsync(
                r => r.RoleName == roleName && !r.IsDeleted, r => r.Users);

            return roles.SelectMany(r => r.Users).Select(u => u.UserName).Distinct().ToList();
        }

        public async Task<bool> IsUserInRoleAsync(string userName, string roleName)
        {
            var users = await _unitOfWork.Users.FindWithIncludesAsync(u => u.UserName == userName, u => u.Roles);
            return users.Any(u => u.Roles.Any(r => r.RoleName == roleName && !r.IsDeleted));
        }
    }
}
