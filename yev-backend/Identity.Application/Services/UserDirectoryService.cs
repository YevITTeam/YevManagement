using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Identity.Application.Services
{
    // Implements IUserDirectoryService (Shared.Application) — a bridge that lets the Attendance module look up
    // a User's mail recipient/FullName/effective permission without a direct ProjectReference to Identity.Application.
    // Scrutor auto-registers this class against the interface at host startup (see docs/architecture-core.md §DI).
    public class UserDirectoryService : BaseService<IIdentityUnitOfWork>, IUserDirectoryService
    {
        public UserDirectoryService(IIdentityUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<(string? Email, string? FullName)> GetContactInfoAsync(string userName, string moduleCode)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            if (user == null) return (null, null);

            var routed = await _unitOfWork.UserEmailModules.FirstOrDefaultAsync(
                x => x.UserId == user.Id && x.ModuleCode == moduleCode, x => x.UserEmail);
            return (routed?.UserEmail.Email ?? user.Email, user.FullName);
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

        public async Task SyncAutoGrantedPermissionsAsync(string? userName, IReadOnlyCollection<string> desiredPermissionCodes)
        {
            if (string.IsNullOrWhiteSpace(userName)) return;

            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            if (user == null) return; // Chưa có tài khoản Identity — lần sync tiếp theo (khi UserName được gán) sẽ tự cấp.

            var desiredCodes = (desiredPermissionCodes ?? Array.Empty<string>()).ToHashSet();
            var desiredPermissionIds = desiredCodes.Count == 0
                ? new HashSet<int>()
                : (await _unitOfWork.Permissions.FindAsync(p => desiredCodes.Contains(p.Code))).Select(p => p.Id).ToHashSet();

            var existingOverrides = await _unitOfWork.UserPermissions.FindAsync(x => x.UserId == user.Id);
            var existingPermissionIds = existingOverrides.Select(x => x.PermissionId).ToHashSet();

            // 1) Thu hồi: dòng đang IsAutoGranted=true mà giờ không còn trong desired set nữa.
            foreach (var existing in existingOverrides)
            {
                if (existing.IsAutoGranted && !desiredPermissionIds.Contains(existing.PermissionId))
                {
                    _unitOfWork.UserPermissions.Delete(existing);
                }
            }

            // 2) Cấp thêm: permission desired mà CHƯA có override nào (manual lẫn auto) — không đụng
            //    tới permission đã có override (dù đang grant/deny tay, hay đã đúng là auto rồi).
            foreach (var permissionId in desiredPermissionIds)
            {
                if (!existingPermissionIds.Contains(permissionId))
                {
                    await _unitOfWork.UserPermissions.AddAsync(new UserPermission
                    {
                        UserId = user.Id,
                        PermissionId = permissionId,
                        IsGranted = true,
                        IsAutoGranted = true
                    });
                }
            }

            await _unitOfWork.SaveChangesAsync();
        }

        // Idempotent — dùng bởi EmployeeIdentityLinkImportService (import hàng loạt liên kết
        // Identity↔Attendance, 2026-09-03). Khác UserService.CreateUserAsync (throw nếu UserName đã
        // tồn tại, dùng cho form "Tạo user" tay từng người) — ở đây UserName đã tồn tại là chuyện BÌNH
        // THƯỜNG (nhiều dòng import có thể trỏ tới người đã có tài khoản từ trước), nên no-op thay vì lỗi.
        public async Task<bool> EnsureUserExistsAsync(string userName, string? fullName, string? roleName)
        {
            var trimmedUserName = userName.Trim();
            var existingUser = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == trimmedUserName);
            if (existingUser != null) return false;

            var resolvedRoleName = string.IsNullOrWhiteSpace(roleName) ? "Basic" : roleName.Trim();
            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.RoleName == resolvedRoleName && !r.IsDeleted);
            if (role == null)
                throw new DomainException($"Không tìm thấy Role '{resolvedRoleName}'.");

            var newUser = new User
            {
                UserName = trimmedUserName,
                FullName = fullName,
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                Roles = new List<Role> { role }
            };
            await _unitOfWork.Users.AddAsync(newUser);
            await _unitOfWork.SaveChangesAsync();
            return true;
        }
    }
}
