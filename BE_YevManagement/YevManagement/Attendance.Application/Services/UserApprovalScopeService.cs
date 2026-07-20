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
        // Mỗi ApprovalLevel gán qua UserApprovalScope chỉ có ý nghĩa nếu userName đang giữ đúng Role
        // tương ứng — nếu không, dòng UserApprovalScope vẫn tạo được (không lỗi) nhưng người đó KHÔNG
        // BAO GIỜ gọi được /approve thật (bị chặn 403 ở [RequirePermission("Attendance.OTForm.Approve")]
        // vì Role của họ không có permission này, VD Role "Nhân viên") — tạo ra 1 "cấu hình ma": nhìn
        // giống đã gán duyệt đầy đủ nhưng đơn sẽ kẹt vĩnh viễn ở cấp đó, không ai biết vì sao (2026-07-17,
        // phát hiện qua việc Admin gán được ApprovalLevel=GroupHead cho tài khoản Role "Nhân viên").
        // GeneralDirector (3) không nằm trong danh sách vì cấp đó KHÔNG dùng UserApprovalScope (bypass
        // qua Role, xem OtFormService).
        private static readonly Dictionary<int, string> RequiredRoleByApprovalLevel = new()
        {
            [(int)ApprovalLevel.Submitter] = "Trưởng nhóm",
            [(int)ApprovalLevel.GroupHead] = "Trưởng Bộ phận",
            [(int)ApprovalLevel.DepartmentManager] = "Trưởng phòng",
            [(int)ApprovalLevel.WorkshopManager] = "Trưởng xưởng",
        };

        // Trưởng nhóm/Trưởng Bộ phận chỉ quản 1 Bộ phận (Group) cụ thể — không hợp lý nếu gán theo cả
        // 1 Phòng ban (Department, có thể gồm nhiều Bộ phận). Ngược lại Trưởng phòng/Trưởng xưởng quản
        // cả 1 Phòng ban — gán theo 1 Bộ phận lẻ bên trong sẽ gây hiểu nhầm (thấy đúng như ảnh chụp màn
        // "Phân quyền duyệt": "Trưởng Bộ phận" lại gán theo phạm vi "Phòng ban", "Trưởng phòng" lại gán
        // theo phạm vi "Bộ phận" — ngược thứ bậc, dễ đọc nhầm). Khoá cứng đúng cặp ScopeType theo tên gọi
        // thật của từng cấp (2026-07-17).
        private static readonly Dictionary<int, int> RequiredScopeTypeByApprovalLevel = new()
        {
            [(int)ApprovalLevel.Submitter] = (int)ScopeType.Group,
            [(int)ApprovalLevel.GroupHead] = (int)ScopeType.Group,
            [(int)ApprovalLevel.DepartmentManager] = (int)ScopeType.Department,
            [(int)ApprovalLevel.WorkshopManager] = (int)ScopeType.Department,
        };

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
            if (RequiredScopeTypeByApprovalLevel.TryGetValue(request.ApprovalLevel, out var requiredScopeType) &&
                request.ScopeType != requiredScopeType)
            {
                var requiredScopeTypeName = requiredScopeType == (int)ScopeType.Group ? "Bộ phận" : "Phòng ban";
                throw new DomainException($"Cấp duyệt này chỉ được gán theo phạm vi '{requiredScopeTypeName}'.");
            }

            var scopeName = await ResolveScopeNameAsync(request.ScopeType, request.ScopeId);

            if (RequiredRoleByApprovalLevel.TryGetValue(request.ApprovalLevel, out var requiredRole))
            {
                var hasRequiredRole = await _userDirectoryService.IsUserInRoleAsync(request.UserName, requiredRole);
                if (!hasRequiredRole)
                    throw new DomainException($"'{request.UserName}' chưa giữ Role '{requiredRole}' — chỉ '{requiredRole}' mới được gán quyền duyệt ở cấp này.");
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

            var (_, userFullName) = await _userDirectoryService.GetContactInfoAsync(newScope.UserName);

            return new UserApprovalScopeDto
            {
                Id = newScope.Id,
                UserName = newScope.UserName,
                UserFullName = userFullName,
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

                var (_, userFullName) = await _userDirectoryService.GetContactInfoAsync(scope.UserName);

                result.Add(new UserApprovalScopeDto
                {
                    Id = scope.Id,
                    UserName = scope.UserName,
                    UserFullName = userFullName,
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
