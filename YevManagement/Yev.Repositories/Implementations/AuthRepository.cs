using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using Yev.Entities.Users;
using Yev.Repositories.Interfaces;
using Yev.DTOs.Auth;

namespace Yev.Repositories.Implementations
{
    public class AuthRepository : IAuthRepository
    {
        private readonly AppDbContext _context;

        public AuthRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task<UserDto> GetUserWithRolesAsync(string username)
        {
            // 1. Chọc xuống DB lấy Entity
            var user = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserName == username);

            if (user == null) return null;

            // 2. BỨC TƯỜNG CÁCH LY: Map thủ công từ Entity sang DTO
            return new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                IpAddress = user.LastLoginIp,
                DeviceName = user.DeviceName,
                Roles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList()
            };
        }

        public async Task<UserDto> CreateUserAsync(string username, string fullName, int basicRoleId)
        {
            // Map từ tham số thành Entity để lưu DB
            var newUser = new User
            {
                UserName = username,
                FullName = fullName,
                CreatedAt = DateTime.Now,
                UserRoles = new List<UserRole>
                {
                    new UserRole { RoleId = basicRoleId }
                }
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            // Trả về DTO (Tái sử dụng hàm Get ở trên cho sạch code)
            return await GetUserWithRolesAsync(username);
        }

        public async Task<int> GetRoleIdByNameAsync(string roleName)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName);
            return role?.Id ?? 0;
        }

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
            var roles = await _context.Roles.Where(x => x.IsDeleted == false).ToListAsync();
            // Đóng gói danh sách Entity thành danh sách DTO
            return roles.Select(r => new RoleDto
            {
                Id = r.Id,
                RoleName = r.RoleName,
                Description = r.Description
            }).ToList();
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            var users = await _context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .ToListAsync();

            return users.Select(u => new UserDto
            {
                Id = u.Id,
                UserName = u.UserName,
                FullName = u.FullName,
                IpAddress = u.LastLoginIp,
                DeviceName = u.DeviceName,
                Roles = u.UserRoles.Select(ur => ur.Role.RoleName).ToList()
            }).ToList();
        }
        public async Task UpdateUserRolesAsync(int userId, List<int> roleIds)
        {
            // 1. Tìm tất cả các quyền hiện tại của User này trong bảng trung gian
            var existingRoles = await _context.UserRoles
                                              .Where(ur => ur.UserId == userId)
                                              .ToListAsync();

            // 2. Xóa toàn bộ quyền cũ (để chuẩn bị ghi đè quyền mới)
            if (existingRoles.Any())
            {
                _context.UserRoles.RemoveRange(existingRoles);
            }

            // 3. Tạo danh sách các quyền mới từ Next.js gửi xuống
            if (roleIds != null && roleIds.Any())
            {
                foreach (var roleId in roleIds)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        UserId = userId,
                        RoleId = roleId
                    });
                }
            }

            // 4. Lưu một lần duy nhất xuống SQL Server
            await _context.SaveChangesAsync();
        }
    }
}
