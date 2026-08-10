using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Services
{
    public class PermissionService : BaseService<IIdentityUnitOfWork>, IPermissionService
    {
        public PermissionService(IIdentityUnitOfWork identityUnitOfWork) : base(identityUnitOfWork)
        {
        }

        public async Task<List<PermissionModuleGroupDto>> GetAllPermissionsAsync()
        {
            var permissions = await _unitOfWork.Permissions.GetAllAsync();

            // Code has the format "Module.Entity.Action" -> extract the middle segment as the Entity name
            // to group into 2 levels (Module > Entity) so FE can easily render it as a tree/collapsible view.
            return permissions
                .OrderBy(p => p.Module)
                .ThenBy(p => p.Code)
                .GroupBy(p => p.Module)
                .Select(moduleGroup => new PermissionModuleGroupDto
                {
                    Module = moduleGroup.Key,
                    Entities = moduleGroup
                        .GroupBy(p => GetEntityFromCode(p.Code))
                        .Select(entityGroup => new PermissionEntityGroupDto
                        {
                            Entity = entityGroup.Key,
                            Permissions = entityGroup
                                .Select(p => new PermissionDto
                                {
                                    Id = p.Id,
                                    Code = p.Code,
                                    Module = p.Module,
                                    Description = p.Description
                                }).ToList()
                        }).ToList()
                }).ToList();
        }

        private static string GetEntityFromCode(string code)
        {
            var parts = code.Split('.');
            return parts.Length >= 3 ? parts[1] : code;
        }

        public async Task<List<PermissionDto>> GetRolePermissionsAsync(int roleId)
        {
            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.Id == roleId, r => r.Permissions);
            role.OrThrowNotFound("Quyền (Role)", roleId);

            return role.Permissions
                .OrderBy(p => p.Module)
                .ThenBy(p => p.Code)
                .Select(p => new PermissionDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Module = p.Module,
                    Description = p.Description
                }).ToList();
        }

        public async Task UpdateRolePermissionsAsync(UpdateRolePermissionsDto dto)
        {
            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId, r => r.Permissions);
            role.OrThrowNotFound("Quyền (Role)", dto.RoleId);

            role.Permissions.Clear();

            if (dto.PermissionIds.Any())
            {
                var newPermissions = await _unitOfWork.Permissions.FindAsync(p => dto.PermissionIds.Contains(p.Id));

                foreach (var permission in newPermissions)
                {
                    role.Permissions.Add(permission);
                }
            }

            _unitOfWork.Roles.Update(role);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<UserPermissionDto>> GetUserPermissionOverridesAsync(int userId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            user.OrThrowNotFound("Người dùng", userId);

            var overrides = await _unitOfWork.UserPermissions.FindWithIncludesAsync(
                x => x.UserId == userId,
                x => x.Permission);

            return overrides
                .OrderBy(x => x.Permission.Module)
                .ThenBy(x => x.Permission.Code)
                .Select(x => new UserPermissionDto
                {
                    PermissionId = x.PermissionId,
                    Code = x.Permission.Code,
                    Module = x.Permission.Module,
                    Description = x.Permission.Description,
                    IsGranted = x.IsGranted,
                    IsAutoGranted = x.IsAutoGranted
                }).ToList();
        }

        public async Task<List<PermissionDto>> GetEffectivePermissionsForUserAsync(int userId)
        {
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.Id == userId, x => x.Roles);
            user.OrThrowNotFound("Người dùng", userId);

            // FirstOrDefaultAsync(includes: x => x.Roles) only loads 1 level of Roles, not
            // Roles.Permissions -> reload the Roles including Permissions for the user's roleIds.
            var roleIds = user!.Roles.Select(r => r.Id).ToList();
            var rolePermissions = await _unitOfWork.Roles.FindWithIncludesAsync(
                r => roleIds.Contains(r.Id),
                r => r.Permissions);
            var basePermissionIds = rolePermissions.SelectMany(r => r.Permissions).Select(p => p.Id).ToHashSet();

            var overrides = await _unitOfWork.UserPermissions.FindAsync(x => x.UserId == userId);
            var grantIds = overrides.Where(x => x.IsGranted).Select(x => x.PermissionId);
            var denyIds = overrides.Where(x => !x.IsGranted).Select(x => x.PermissionId).ToHashSet();

            var effectiveIds = basePermissionIds.Union(grantIds).Except(denyIds).ToHashSet();

            var allPermissions = await _unitOfWork.Permissions.GetAllAsync();

            return allPermissions
                .Where(p => effectiveIds.Contains(p.Id))
                .OrderBy(p => p.Module)
                .ThenBy(p => p.Code)
                .Select(p => new PermissionDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Module = p.Module,
                    Description = p.Description
                }).ToList();
        }

        public async Task UpdateUserPermissionOverridesAsync(UpdateUserPermissionsDto dto)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(dto.UserId);
            user.OrThrowNotFound("Người dùng", dto.UserId);

            var overlap = dto.GrantPermissionIds.Intersect(dto.DenyPermissionIds).Any();
            if (overlap)
                throw new DomainException("1 permission không thể vừa cấp thêm vừa thu hồi cùng lúc cho 1 người dùng.");

            // Chỉ xoá phần Admin đã cấp TAY (IsAutoGranted=false) — KHÔNG đụng tới phần Chức vụ tự
            // cấp (IsAutoGranted=true, xem JobTitlePermission/EmployeeService), nếu không mỗi lần
            // Admin lưu màn này cho 1 người sẽ vô tình xoá sạch mọi permission do Chức vụ họ đang giữ
            // tự cấp (FE cũng không gửi những dòng đó lên nữa — xem UserPermissionOverrideManager.tsx).
            var existingManualOverrides = await _unitOfWork.UserPermissions.FindAsync(x => x.UserId == dto.UserId && !x.IsAutoGranted);
            foreach (var existing in existingManualOverrides)
            {
                _unitOfWork.UserPermissions.Delete(existing);
            }

            // Nếu Admin tick tay đúng permission đang IsAutoGranted=true — thao tác tay "chiếm quyền"
            // dòng đó luôn. SỬA TẠI CHỖ (Update) trên đúng entity đang tracked thay vì Delete rồi Add
            // 1 entity mới CÙNG khoá chính (UserId, PermissionId) trong cùng 1 SaveChanges — EF Core
            // không tách được 2 thao tác đó thành DELETE-rồi-INSERT đúng như mong đợi (đã tự kiểm
            // chứng: IsAutoGranted của dòng cũ "sống sót" qua Add mới, chỉ IsGranted đổi), Update tại
            // chỗ tránh hẳn việc phải trông cậy vào hành vi đó.
            var touchedIds = dto.GrantPermissionIds.Concat(dto.DenyPermissionIds).ToHashSet();
            var existingAutoOverridesBeingClaimed = await _unitOfWork.UserPermissions.FindAsync(
                x => x.UserId == dto.UserId && x.IsAutoGranted && touchedIds.Contains(x.PermissionId));
            var claimedByPermissionId = existingAutoOverridesBeingClaimed.ToDictionary(x => x.PermissionId);

            foreach (var permissionId in dto.GrantPermissionIds)
            {
                if (claimedByPermissionId.TryGetValue(permissionId, out var claimed))
                {
                    claimed.IsGranted = true;
                    claimed.IsAutoGranted = false;
                    _unitOfWork.UserPermissions.Update(claimed);
                }
                else
                {
                    await _unitOfWork.UserPermissions.AddAsync(new UserPermission
                    {
                        UserId = dto.UserId,
                        PermissionId = permissionId,
                        IsGranted = true,
                        IsAutoGranted = false
                    });
                }
            }

            foreach (var permissionId in dto.DenyPermissionIds)
            {
                if (claimedByPermissionId.TryGetValue(permissionId, out var claimed))
                {
                    claimed.IsGranted = false;
                    claimed.IsAutoGranted = false;
                    _unitOfWork.UserPermissions.Update(claimed);
                }
                else
                {
                    await _unitOfWork.UserPermissions.AddAsync(new UserPermission
                    {
                        UserId = dto.UserId,
                        PermissionId = permissionId,
                        IsGranted = false,
                        IsAutoGranted = false
                    });
                }
            }

            await _unitOfWork.SaveChangesAsync();
        }
    }
}
