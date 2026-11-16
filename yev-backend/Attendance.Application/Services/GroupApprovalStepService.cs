using Attendance.Domain.Constants;
using Attendance.Application.Dtos.GroupApprovalSteps;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Holds only the intermediate levels (TerminalLevel=None); terminal levels live per department.
    // Whole-list replace only, matching the "reorder then Save" UI.
    public class GroupApprovalStepService : BaseService<IAttendanceUnitOfWork>, IGroupApprovalStepService
    {
        private readonly IEmployeeService _employeeService;

        public GroupApprovalStepService(IAttendanceUnitOfWork unitOfWork, IEmployeeService employeeService) : base(unitOfWork)
        {
            _employeeService = employeeService;
        }

        // Group coordinators are separate from department coordinators; coordinating a department doesn't grant its groups.
        private async Task EnsureCanManageGroupAsync(string userName, bool isAdmin, int groupId)
        {
            if (isAdmin) return;

            var isCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.GroupId == groupId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
            if (!isCoordinator)
                throw new DomainException("Bạn không được phân công phụ trách Cây duyệt của Nhóm này.");
        }

        public async Task<List<GroupDto>> GetMyManagedGroupsAsync(string userName, bool isAdmin)
        {
            var myGroupIds = isAdmin
                ? null
                : (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(x => x.Employee.UserName == userName && !x.IsDeleted))
                    .Select(x => x.GroupId).ToHashSet();

            var items = await _unitOfWork.Groups.SelectAsync(
                predicate: x => !x.IsDeleted && (myGroupIds == null || myGroupIds.Contains(x.Id)),
                selector: x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn
                });
            return items.OrderBy(x => x.GroupNameVn).ToList();
        }

        public async Task<List<GroupApprovalStepDto>> GetByGroupAsync(string userName, bool isAdmin, int groupId)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);
            return await GetByGroupCoreAsync(groupId);
        }

        private async Task<List<GroupApprovalStepDto>> GetByGroupCoreAsync(int groupId)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            var steps = await _unitOfWork.GroupApprovalSteps.SelectAsync(
                predicate: x => x.GroupId == groupId && !x.IsDeleted,
                selector: x => new GroupApprovalStepDto
                {
                    Id = x.Id,
                    GroupId = x.GroupId,
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitleId,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    CanResubmit = x.CanResubmit,
                    ResubmitSkipsIntermediate = x.ResubmitSkipsIntermediate,
                    TerminalLevel = x.JobTitle.TerminalLevel,
                    Members = x.Members.Where(m => !m.Employee.IsDeleted).OrderBy(m => m.Id).Select(m => new GroupApprovalStepMemberDto
                    {
                        EmployeeId = m.EmployeeId,
                        EmployeeCode = m.Employee.Code,
                        LastName = m.Employee.LastName,
                        FirstName = m.Employee.FirstName,
                        GroupNameVn = m.Employee.Group != null ? m.Employee.Group.GroupNameVn : null,
                        ReceivesMail = m.ReceivesMail
                    }).ToList()
                });

            return steps.OrderBy(x => x.StepOrder).ToList();
        }

        public async Task<List<GroupApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int groupId, ReplaceGroupApprovalStepsDto request)
        {
            if (!isAdmin) throw new DomainException(ApprovalStepCoordinatorPermissions.TreeEditAdminOnlyMessage);

            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            if (request.Steps.Count(x => x.IsResponsible) > 1)
                throw new DomainException("Chỉ được đánh dấu tối đa 1 bước là \"người chịu trách nhiệm\".");

            var jobTitleIds = request.Steps.Select(x => x.JobTitleId).ToHashSet();
            var jobTitlesById = (await _unitOfWork.JobTitles.FindAsync(x => jobTitleIds.Contains(x.Id) && !x.IsDeleted))
                .ToDictionary(x => x.Id);

            var signingCount = request.CreatorMustSign ? 1 : 0;
            foreach (var item in request.Steps)
            {
                var jobTitle = jobTitlesById.GetValueOrDefault(item.JobTitleId);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    throw new DomainException($"Chức vụ '{jobTitle.Name}' là cấp duyệt cuối — cấu hình ở phần \"Cây duyệt Bộ phận\" (màn \"Cây duyệt\"), không thêm vào cây duyệt Nhóm.");
                if (item.RequiresSignature) signingCount++;
                if (item.Members.Count == 0)
                    throw new DomainException($"Cấp '{jobTitle.Name}' chưa có người.");
                if (item.Members.Select(x => x.EmployeeId).Distinct().Count() != item.Members.Count)
                    throw new DomainException($"Cấp '{jobTitle.Name}' có người bị trùng.");
                if (!item.Members.Any(x => x.ReceivesMail))
                    throw new DomainException($"Cấp '{jobTitle.Name}' phải có ít nhất một người nhận mail.");
            }

            // One person on two levels would approve and sign the same form twice.
            var repeatedIds = request.Steps.SelectMany(x => x.Members).GroupBy(x => x.EmployeeId).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
            if (repeatedIds.Count > 0)
            {
                var repeatedCodes = await _unitOfWork.Employees.SelectAsync(x => repeatedIds.Contains(x.Id), x => x.Code);
                throw new DomainException($"Mỗi người chỉ được ở một cấp trong Nhóm: {string.Join(", ", repeatedCodes)}.");
            }

            // The printed YEV-22-024 form has exactly two fixed "requester" signature boxes.
            if (request.Steps.Count > 0 && (signingCount < 1 || signingCount > 2))
                throw new DomainException("Phải có từ 1 đến 2 cấp được đánh dấu \"Bắt buộc ký\", tính cả người tạo đơn (khớp 2 ô \"Người đề nghị\" cố định trên giấy in) — các cấp khác để \"Chỉ xác nhận\".");

            var requestedIds = request.Steps.SelectMany(x => x.Members).Select(x => x.EmployeeId).ToHashSet();
            await EnsureEligibleAsync(group!, requestedIds);

            var existing = await _unitOfWork.GroupApprovalSteps.FindAsync(x => x.GroupId == groupId && !x.IsDeleted);
            var existingStepIds = existing.Select(x => x.Id).ToList();
            var existingMembers = await _unitOfWork.GroupApprovalStepMembers.FindAsync(x => existingStepIds.Contains(x.GroupApprovalStepId));
            var previousIds = existingMembers.Select(x => x.EmployeeId).ToHashSet();

            foreach (var member in existingMembers)
                _unitOfWork.GroupApprovalStepMembers.Delete(member);
            foreach (var step in existing)
            {
                _unitOfWork.GroupApprovalSteps.Delete(step);
            }

            group!.CreatorMustSign = request.CreatorMustSign;
            group.StepwiseEdit = request.StepwiseEdit;
            _unitOfWork.Groups.Update(group);

            var newSteps = request.Steps
                .Select((item, index) => new GroupApprovalStep
                {
                    GroupId = groupId,
                    StepOrder = index + 1,
                    JobTitleId = item.JobTitleId,
                    RequiresSignature = item.RequiresSignature,
                    IsResponsible = item.IsResponsible,
                    CanResubmit = item.CanResubmit,
                    ResubmitSkipsIntermediate = item.CanResubmit && item.ResubmitSkipsIntermediate,
                    IsDeleted = false,
                    Members = item.Members.Select(x => new GroupApprovalStepMember { EmployeeId = x.EmployeeId, ReceivesMail = x.ReceivesMail }).ToList()
                })
                .ToList();

            await _unitOfWork.GroupApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            previousIds.SymmetricExceptWith(requestedIds);
            foreach (var employeeId in previousIds)
                await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);

            return await GetByGroupCoreAsync(groupId);
        }

        // Departments stay separate: a tree only takes people with an account from its own Department.
        private async Task EnsureEligibleAsync(Group group, IReadOnlyCollection<int> employeeIds)
        {
            if (employeeIds.Count == 0) return;

            var eligibleIds = await _unitOfWork.Employees.SelectAsync(
                x => employeeIds.Contains(x.Id) && !x.IsDeleted && x.UserName != null
                    && ((x.Group != null && x.Group.DepartmentId == group.DepartmentId) || x.DepartmentId == group.DepartmentId),
                x => x.Id);
            var invalidIds = employeeIds.Except(eligibleIds).ToList();
            if (invalidIds.Count == 0) return;

            var codes = await _unitOfWork.Employees.SelectAsync(x => invalidIds.Contains(x.Id), x => x.Code);
            throw new DomainException($"Chỉ được chọn nhân viên có tài khoản, cùng Bộ phận với Nhóm: {string.Join(", ", codes)}.");
        }

        public async Task<ApplyGroupLevelMemberResultDto> ApplyMemberAsync(string userName, bool isAdmin, ApplyGroupLevelMemberDto request)
        {
            if (!isAdmin) throw new DomainException(ApprovalStepCoordinatorPermissions.TreeEditAdminOnlyMessage);

            var result = new ApplyGroupLevelMemberResultDto();
            foreach (var groupId in request.GroupIds.Distinct())
            {
                var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
                group.OrThrowNotFound("Nhóm", groupId);
                await EnsureEligibleAsync(group!, new[] { request.EmployeeId });

                var step = await _unitOfWork.GroupApprovalSteps.FirstOrDefaultAsync(
                    x => x.GroupId == groupId && x.JobTitleId == request.JobTitleId && !x.IsDeleted);
                if (step == null)
                {
                    result.SkippedGroupNames.Add(group!.GroupNameVn);
                    continue;
                }

                var onOtherLevel = (await _unitOfWork.GroupApprovalStepMembers.SelectAsync(
                    x => x.EmployeeId == request.EmployeeId && x.GroupApprovalStepId != step.Id
                        && x.GroupApprovalStep.GroupId == groupId && !x.GroupApprovalStep.IsDeleted, x => x.Id)).Count > 0;
                if (onOtherLevel)
                {
                    result.OnOtherLevelGroupNames.Add(group!.GroupNameVn);
                    continue;
                }

                if ((await _unitOfWork.GroupApprovalStepMembers.FindAsync(x => x.GroupApprovalStepId == step.Id && x.EmployeeId == request.EmployeeId)).Count == 0)
                    await _unitOfWork.GroupApprovalStepMembers.AddAsync(new GroupApprovalStepMember
                    {
                        GroupApprovalStepId = step.Id,
                        EmployeeId = request.EmployeeId,
                        ReceivesMail = request.ReceivesMail
                    });
                result.AppliedCount++;
            }

            await _unitOfWork.SaveChangesAsync();
            await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(request.EmployeeId);
            return result;
        }

        public async Task<GroupBorrowedApproversDto> GetBorrowedApproversAsync(string userName, bool isAdmin, int groupId)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);
            return await GetBorrowedApproversCoreAsync(groupId);
        }

        private async Task<GroupBorrowedApproversDto> GetBorrowedApproversCoreAsync(int groupId)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            // Only people with an account can log in to use a level.
            var lendable = await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && x.UserName != null
                    && ((x.Group != null && x.Group.DepartmentId == group!.DepartmentId) || x.DepartmentId == group!.DepartmentId),
                x => new GroupBorrowedApproverDto
                {
                    EmployeeId = x.Id,
                    EmployeeCode = x.Code,
                    LastName = x.LastName,
                    FirstName = x.FirstName,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    GroupNameJp = x.Group != null ? x.Group.GroupNameJp : null
                });

            return new GroupBorrowedApproversDto
            {
                Candidates = lendable.OrderBy(x => x.EmployeeCode).ToList(),
                CreatorMustSign = group!.CreatorMustSign,
                StepwiseEdit = group.StepwiseEdit
            };
        }
    }
}
