using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using System;
using System.Collections.Generic;
using System.Linq; // Cần thiết cho các hàm LINQ như Select, ToList
using System.Threading.Tasks; // Cần thiết cho Task

namespace Identity.Application.Services
{
    public class UserService : BaseService<IIdentityUnitOfWork>, IUserService
    {
        public UserService(IIdentityUnitOfWork identityUnitOfWork) : base(identityUnitOfWork)
        {
        }

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
            var roles = await _unitOfWork.Roles.GetAllAsync();

            return roles.Select(role => new RoleDto
            {
                Id = role.Id,
                RoleName = role.RoleName,
                Description = role.Description
            }).ToList();
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            var users = await _unitOfWork.Users.GetAllAsync();

            return users.Select(user => new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                DeviceName = user.DeviceName,
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
                CreatedAt = DateTime.UtcNow,

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
                throw new ArgumentException("Dữ liệu cấp quyền không hợp lệ.");
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
    }
}