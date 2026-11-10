using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Identity.Application.Services
{
    public class UserService : BaseService<IIdentityUnitOfWork>, IUserService
    {
        public UserService(IIdentityUnitOfWork identityUnitOfWork) : base(identityUnitOfWork)
        {
        }

        public async Task<List<UserDto>> GetAllUsersAsync(int? roleId = null)
        {
            var users = roleId.HasValue
                ? await _unitOfWork.Users.FindWithIncludesAsync(x => x.Roles.Any(r => r.Id == roleId.Value), x => x.Roles, x => x.LocalLoginAccount!)
                : await _unitOfWork.Users.FindWithIncludesAsync(null, x => x.Roles, x => x.LocalLoginAccount!);

            return users.Select(user => new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                DeviceName = user.DeviceName,
                Email = user.Email,
                IsLocalAccount = user.LocalLoginAccount != null,
                Roles = user.Roles.Select(r => r.RoleName).ToList()
            }).ToList();
        }

        public async Task<UserDto> SyncWindowsUserAsync(string username, string fullName)
        {
            var existingUser = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == username, x => x.Roles);

            if (existingUser != null)
            {
                return new UserDto
                {
                    Id = existingUser.Id,
                    UserName = existingUser.UserName,
                    FullName = existingUser.FullName,
                    Roles = existingUser.Roles.Select(x => x.RoleName).ToList()
                };
            }

            int basicRoleId = (await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.RoleName == "Basic"))?.Id ?? 0;

            var newUser = new Domain.Entities.User
            {
                UserName = username,
                FullName = fullName,
                CreatedAt = TimeHelper.GetCurrentUtcTime(),

                Roles = new List<Role>
                {
                    new Domain.Entities.Role { Id = basicRoleId, RoleName = "Basic" }
                }
            };

            await _unitOfWork.Users.AddAsync(newUser);
            await _unitOfWork.SaveChangesAsync();

            return new UserDto
            {
                Id = newUser.Id,
                UserName = newUser.UserName,
                FullName = newUser.FullName,
                Roles = new List<string> { "Basic" }
            };
        }

        public async Task UpdateUserRolesAsync(UpdateUserRolesDto request)
        {
            if (request == null || request.RoleIds == null)
            {
                throw new Exception("Dữ liệu cấp quyền không hợp lệ.");
            }

            var user = await _unitOfWork.Users.FirstOrDefaultAsync(
                u => u.Id == request.UserId,
                u => u.Roles
            );

            if (user == null)
            {
                throw new Exception("Không tìm thấy người dùng.");
            }

            user.Roles.Clear();

            if (request.RoleIds.Any())
            {
                var newRoles = await _unitOfWork.Roles.FindAsync(r => request.RoleIds.Contains(r.Id));

                foreach (var role in newRoles)
                {
                    user.Roles.Add(role);
                }
            }

            _unitOfWork.Users.Update(user);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<UserDto> CreateUserAsync(CreateUserDto request)
        {
            var userName = request.UserName.Trim();
            var deviceName = string.IsNullOrWhiteSpace(request.DeviceName) ? null : request.DeviceName.Trim();

            // Login identity is the plain UserName (2026-07-11, changed back — see
            // MyClaimsTransformation). Duplicate UserName creation is not allowed, to avoid
            // 2 User rows matching the same real login.
            var existingUser = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName);
            if (existingUser != null)
                throw new DomainException($"Người dùng '{userName}' đã tồn tại.");

            var roles = new List<Role>();
            if (request.RoleIds.Any())
            {
                roles = (await _unitOfWork.Roles.FindAsync(r => request.RoleIds.Contains(r.Id) && !r.IsDeleted)).ToList();
                if (roles.Count != request.RoleIds.Distinct().Count())
                    throw new DomainException("Một số quyền (Role) được chọn không tồn tại.");
            }

            var newUser = new User
            {
                UserName = userName,
                DeviceName = deviceName,
                FullName = request.FullName,
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                Roles = roles
            };

            await _unitOfWork.Users.AddAsync(newUser);
            await _unitOfWork.SaveChangesAsync();

            return new UserDto
            {
                Id = newUser.Id,
                UserName = newUser.UserName,
                FullName = newUser.FullName,
                DeviceName = newUser.DeviceName,
                Roles = roles.Select(r => r.RoleName).ToList()
            };
        }

        // Admin edits ONLY the display name here — UserName (Windows login identity) and DeviceName
        // must stay untouched, since UserName is the sole match key used at login (MyClaimsTransformation §5).
        public async Task<UserDto> UpdateUserFullNameAsync(UpdateUserFullNameDto request)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, u => u.Roles);
            user.OrThrowNotFound("Người dùng", request.UserId);

            user!.FullName = request.FullName.Trim();

            _unitOfWork.Users.Update(user);
            await _unitOfWork.SaveChangesAsync();

            return new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                DeviceName = user.DeviceName,
                Email = user.Email,
                Roles = user.Roles.Select(r => r.RoleName).ToList()
            };
        }

        // Hard delete: permanently removes the User from the DB (this entity has no IsDeleted).
        // UserRoles/LoginUserIPs/UserPermissions cascade automatically at the DB level. If this
        // UserName logs in via Windows again, MyClaimsTransformation will create a new User with
        // the default "Basic" role.
        public async Task DeleteUserAsync(int userId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            user.OrThrowNotFound("Người dùng", userId);

            _unitOfWork.Users.Delete(user!);
            await _unitOfWork.SaveChangesAsync();
        }

        private static readonly Microsoft.AspNetCore.Identity.PasswordHasher<object> PasswordHasher = new();

        public async Task<bool> ValidateTestLoginAsync(string userName, string password)
        {
            var record = await _unitOfWork.TestLoginAccounts.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (record == null) return false;

            var result = PasswordHasher.VerifyHashedPassword(null!, record.PasswordHash, password);
            return result != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed;
        }
    }
}