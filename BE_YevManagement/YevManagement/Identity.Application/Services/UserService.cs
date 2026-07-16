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
                ? await _unitOfWork.Users.FindWithIncludesAsync(x => x.Roles.Any(r => r.Id == roleId.Value), x => x.Roles)
                : await _unitOfWork.Users.FindWithIncludesAsync(null, x => x.Roles);

            return users.Select(user => new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                DeviceName = user.DeviceName,
                Email = user.Email,
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

            // Định danh đăng nhập là UserName suông (2026-07-11, đổi lại — xem
            // MyClaimsTransformation). Không cho tạo trùng UserName để tránh 2 dòng User
            // cùng khớp 1 lần đăng nhập thật.
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

        // Hard delete: xoá hẳn User khỏi DB (không có IsDeleted trên entity này).
        // UserRoles/LoginUserIPs/UserPermissions cascade tự động ở DB. Nếu UserName này
        // đăng nhập Windows lại, MyClaimsTransformation sẽ tạo mới User với role mặc định "Basic".
        public async Task DeleteUserAsync(int userId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            user.OrThrowNotFound("Người dùng", userId);

            _unitOfWork.Users.Delete(user!);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}