using Attendance.Application.Dtos.UserApprovalScopes;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class UserApprovalScopeService : BaseService<IAttendanceUnitOfWork>, IUserApprovalScopeService
    {
        // Role duy nhất được phép giữ ApprovalLevel=Submitter — chữ ký "Người đề nghị" trên OT Form
        // bắt buộc phải là chữ ký Trưởng nhóm, không phải người tạo đơn thông thường
        // (xem docs/attendance-module.md — Bước Trưởng nhóm ký duyệt).
        private const string GroupLeaderRoleName = "Trưởng Group";

        private readonly IUserDirectoryService _userDirectoryService;

        public UserApprovalScopeService(IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
        }

        public async Task<PagedResponse<UserApprovalScopeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.UserApprovalScopes.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.UserName.Contains(keyword));
            }

            var page = await _unitOfWork.UserApprovalScopes.ToPagedResponseAsync(
                query.OrderBy(x => x.UserName),
                pageIndex,
                pageSize,
                x => x
            );

            var data = await ToDtosAsync(page.Data);
            return new PagedResponse<UserApprovalScopeDto>(data, page.TotalCount, page.PageIndex, page.PageSize);
        }

        public async Task<List<UserApprovalScopeDto>> GetByUserNameAsync(string userName)
        {
            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x => !x.IsDeleted && x.UserName == userName);
            return await ToDtosAsync(scopes.ToList());
        }

        public async Task<UserApprovalScopeDto> CreateAsync(CreateUserApprovalScopeDto request)
        {
            var scopeName = await ResolveScopeNameAsync(request.ScopeType, request.ScopeId);

            if (request.ApprovalLevel == (int)ApprovalLevel.Submitter)
            {
                var isGroupLeader = await _userDirectoryService.IsUserInRoleAsync(request.UserName, GroupLeaderRoleName);
                if (!isGroupLeader)
                    throw new DomainException($"'{request.UserName}' chưa giữ Role 'Trưởng Group' — chỉ Trưởng nhóm mới được gán quyền ký/duyệt cấp Submitter (Người đề nghị).");
            }

            var exists = await _unitOfWork.UserApprovalScopes.FirstOrDefaultAsync(x =>
                !x.IsDeleted && x.UserName == request.UserName && x.ScopeType == request.ScopeType &&
                x.ScopeId == request.ScopeId && x.ApprovalLevel == request.ApprovalLevel);
            if (exists != null) throw new DomainException($"'{request.UserName}' đã được gán đúng phạm vi/cấp duyệt này rồi.");

            var newScope = new UserApprovalScope
            {
                UserName = request.UserName,
                ScopeType = request.ScopeType,
                ScopeId = request.ScopeId,
                ApprovalLevel = request.ApprovalLevel,
                IsDeleted = false
            };

            await _unitOfWork.UserApprovalScopes.AddAsync(newScope);
            await _unitOfWork.SaveChangesAsync();

            return new UserApprovalScopeDto
            {
                Id = newScope.Id,
                UserName = newScope.UserName,
                ScopeType = newScope.ScopeType,
                ScopeId = newScope.ScopeId,
                ScopeName = scopeName,
                ApprovalLevel = newScope.ApprovalLevel
            };
        }

        public async Task DeleteAsync(int id)
        {
            var scope = await _unitOfWork.UserApprovalScopes.GetByIdAsync(id);
            scope.OrThrowNotFound("Phân quyền duyệt", id);

            scope!.IsDeleted = true;

            _unitOfWork.UserApprovalScopes.Update(scope);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<string> ResolveScopeNameAsync(int scopeType, int scopeId)
        {
            if (scopeType == (int)ScopeType.Group)
            {
                var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == scopeId && !x.IsDeleted);
                group.OrThrowNotFound("Nhóm", scopeId);
                return group!.GroupNameVn;
            }

            if (scopeType == (int)ScopeType.Department)
            {
                var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == scopeId && !x.IsDeleted);
                department.OrThrowNotFound("Bộ phận", scopeId);
                return department!.DepartmentNameVn;
            }

            throw new DomainException($"ScopeType '{scopeType}' không hợp lệ.");
        }

        private async Task<List<UserApprovalScopeDto>> ToDtosAsync(IReadOnlyList<UserApprovalScope> scopes)
        {
            var result = new List<UserApprovalScopeDto>();
            foreach (var scope in scopes)
            {
                string scopeName;
                try
                {
                    scopeName = await ResolveScopeNameAsync(scope.ScopeType, scope.ScopeId);
                }
                catch (NotFoundException)
                {
                    scopeName = "(đã xóa)";
                }

                result.Add(new UserApprovalScopeDto
                {
                    Id = scope.Id,
                    UserName = scope.UserName,
                    ScopeType = scope.ScopeType,
                    ScopeId = scope.ScopeId,
                    ScopeName = scopeName,
                    ApprovalLevel = scope.ApprovalLevel
                });
            }
            return result;
        }
    }
}
