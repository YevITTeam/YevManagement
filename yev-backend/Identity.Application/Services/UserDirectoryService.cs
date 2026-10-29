using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Identity.Domain.Enums;
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
        private const int MaxParallelDirectoryLookups = 8;

        private readonly IActiveDirectoryAuthService _activeDirectoryService;

        public UserDirectoryService(IIdentityUnitOfWork unitOfWork, IActiveDirectoryAuthService activeDirectoryService) : base(unitOfWork)
        {
            _activeDirectoryService = activeDirectoryService;
        }

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
            var resolvedRoleName = string.IsNullOrWhiteSpace(roleName) ? "Basic" : roleName.Trim();
            var existingUser = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == trimmedUserName, x => x.Roles);
            if (existingUser != null && (roleName == null || existingUser.Roles.Any(r => r.RoleName == resolvedRoleName)))
                return false;

            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.RoleName == resolvedRoleName && !r.IsDeleted);
            if (role == null)
                throw new DomainException($"Không tìm thấy Role '{resolvedRoleName}'.");

            // An existing account keeps its roles; the requested one is only added.
            if (existingUser != null)
            {
                existingUser.Roles.Add(role);
                await _unitOfWork.SaveChangesAsync();
                return false;
            }

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

        public async Task<bool> SetModuleEmailAsync(string userName, string moduleCode, string email)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            if (user == null) return false;

            var normalized = email.Trim().ToLowerInvariant();
            var emails = await _unitOfWork.UserEmails.FindAsync(x => x.UserId == user.Id);
            var target = emails.FirstOrDefault(x => x.Email == normalized);
            if (target == null)
            {
                target = new UserEmail
                {
                    UserId = user.Id,
                    Email = normalized,
                    Source = (int)UserEmailSource.Manual,
                    CreatedAt = TimeHelper.GetCurrentUtcTime()
                };
                // Keeps the UserEmailService invariant: a user's first address is its primary.
                if (emails.Count == 0)
                {
                    target.IsPrimary = true;
                    user.Email = normalized;
                    _unitOfWork.Users.Update(user);
                }
                await _unitOfWork.UserEmails.AddAsync(target);
            }

            var route = await _unitOfWork.UserEmailModules.FirstOrDefaultAsync(x => x.UserId == user.Id && x.ModuleCode == moduleCode);
            // Unrouted modules already go to the primary address; adding a route would pin it if the primary later changes.
            if (route == null && target.IsPrimary)
            {
                await _unitOfWork.SaveChangesAsync();
                return true;
            }
            if (route == null)
            {
                await _unitOfWork.UserEmailModules.AddAsync(new UserEmailModule { UserId = user.Id, ModuleCode = moduleCode, UserEmail = target });
            }
            else
            {
                route.UserEmail = target;
                _unitOfWork.UserEmailModules.Update(route);
            }

            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<IReadOnlyDictionary<string, string>> GetModuleEmailsAsync(IReadOnlyCollection<string> userNames, string moduleCode)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (userNames.Count == 0) return result;

            var users = await _unitOfWork.Users.SelectAsync(x => userNames.Contains(x.UserName), x => new { x.Id, x.UserName, x.Email });
            var userIds = users.Select(x => x.Id).ToList();
            var routed = (await _unitOfWork.UserEmailModules.SelectAsync(
                    x => userIds.Contains(x.UserId) && x.ModuleCode == moduleCode, x => new { x.UserId, x.UserEmail.Email }))
                .ToDictionary(x => x.UserId, x => x.Email);

            foreach (var user in users)
            {
                var email = routed.GetValueOrDefault(user.Id) ?? user.Email;
                if (!string.IsNullOrWhiteSpace(email)) result[user.UserName] = email;
            }
            return result;
        }

        public async Task<IReadOnlyList<DomainAccountInfo>> ResolveDomainAccountsAsync(IEnumerable<string> accounts)
        {
            var distinct = accounts
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (distinct.Count == 0) return Array.Empty<DomainAccountInfo>();

            var existing = (await _unitOfWork.Users.FindAsync(x => distinct.Contains(x.UserName)))
                .Select(x => x.UserName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missing = distinct.Where(x => !existing.Contains(x)).ToList();
            using var gate = new SemaphoreSlim(MaxParallelDirectoryLookups);
            var lookups = await Task.WhenAll(missing.Select(async account =>
            {
                await gate.WaitAsync();
                try { return (Account: account, Lookup: await Task.Run(() => _activeDirectoryService.FindAccount(account))); }
                finally { gate.Release(); }
            }));
            var lookupByAccount = lookups.ToDictionary(x => x.Account, x => x.Lookup, StringComparer.OrdinalIgnoreCase);

            return distinct.Select(account =>
            {
                if (existing.Contains(account)) return new DomainAccountInfo(account, DomainAccountState.ExistsInIdentity, null);

                var lookup = lookupByAccount[account];
                return lookup.Status switch
                {
                    AdAccountStatus.Found => new DomainAccountInfo(account, DomainAccountState.WillCreate, lookup.DisplayName),
                    AdAccountStatus.Disabled => new DomainAccountInfo(account, DomainAccountState.Disabled, lookup.DisplayName),
                    AdAccountStatus.NotFound => new DomainAccountInfo(account, DomainAccountState.NotInDirectory, null),
                    _ => new DomainAccountInfo(account, DomainAccountState.DirectoryUnavailable, null)
                };
            }).ToList();
        }

        public async Task<IReadOnlyList<DomainAccountInfo>> EnsureDomainUsersAsync(IEnumerable<string> accounts)
        {
            var resolved = await ResolveDomainAccountsAsync(accounts);
            var result = new List<DomainAccountInfo>(resolved.Count);
            foreach (var info in resolved)
            {
                if (info.State != DomainAccountState.WillCreate)
                {
                    result.Add(info);
                    continue;
                }

                try
                {
                    var created = await EnsureUserExistsAsync(info.Account, info.FullName, null);
                    result.Add(info with { State = created ? DomainAccountState.Created : DomainAccountState.ExistsInIdentity });
                }
                catch
                {
                    result.Add(info with { State = DomainAccountState.Failed });
                }
            }

            return result;
        }
    }
}
