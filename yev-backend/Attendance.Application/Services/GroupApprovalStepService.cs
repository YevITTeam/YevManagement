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
        public GroupApprovalStepService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

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
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            return steps.OrderBy(x => x.StepOrder).ToList();
        }

        public async Task<List<GroupApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int groupId, ReplaceGroupApprovalStepsDto request)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);

            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            if (request.Steps.Count(x => x.IsResponsible) > 1)
                throw new DomainException("Chỉ được đánh dấu tối đa 1 bước là \"người chịu trách nhiệm\".");

            var jobTitleIds = request.Steps.Select(x => x.JobTitleId).ToHashSet();
            var jobTitlesById = (await _unitOfWork.JobTitles.FindAsync(x => jobTitleIds.Contains(x.Id) && !x.IsDeleted))
                .ToDictionary(x => x.Id);

            var signingCount = 0;
            foreach (var item in request.Steps)
            {
                var jobTitle = jobTitlesById.GetValueOrDefault(item.JobTitleId);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    throw new DomainException($"Chức vụ '{jobTitle.Name}' là cấp duyệt cuối — cấu hình ở phần \"Cây duyệt Bộ phận\" (màn \"Cây duyệt\"), không thêm vào cây duyệt Nhóm.");
                if (item.RequiresSignature) signingCount++;
            }

            // The printed YEV-22-024 form has exactly two fixed "requester" signature boxes.
            if (request.Steps.Count > 0 && (signingCount < 1 || signingCount > 2))
                throw new DomainException("Phải có từ 1 đến 2 bước được đánh dấu \"Bắt buộc ký\" (khớp 2 ô \"Người đề nghị\" cố định trên giấy in) — các bước khác để \"Chỉ xác nhận\", không giới hạn số lượng.");

            var existing = await _unitOfWork.GroupApprovalSteps.FindAsync(x => x.GroupId == groupId && !x.IsDeleted);
            foreach (var step in existing)
            {
                _unitOfWork.GroupApprovalSteps.Delete(step);
            }

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
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.GroupApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            return await GetByGroupCoreAsync(groupId);
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

            var borrowedIds = (await _unitOfWork.GroupBorrowedApprovers.SelectAsync(x => x.GroupId == groupId, x => x.EmployeeId)).ToHashSet();

            var lendable = await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && !x.JobTitle!.IsDeleted && x.JobTitle.TerminalLevel == (int)JobTitleTerminalLevel.None
                    && x.GroupId != null && x.GroupId != groupId
                    && x.Group!.DepartmentId == group!.DepartmentId,
                x => new GroupBorrowedApproverDto
                {
                    EmployeeId = x.Id,
                    EmployeeCode = x.Code,
                    LastName = x.LastName,
                    FirstName = x.FirstName,
                    JobTitleId = x.JobTitleId!.Value,
                    GroupNameVn = x.Group!.GroupNameVn,
                    GroupNameJp = x.Group!.GroupNameJp
                });

            return new GroupBorrowedApproversDto
            {
                Approvers = lendable.Where(x => borrowedIds.Contains(x.EmployeeId)).OrderBy(x => x.EmployeeCode).ToList(),
                Candidates = lendable.Where(x => !borrowedIds.Contains(x.EmployeeId)).OrderBy(x => x.EmployeeCode).ToList()
            };
        }

        public async Task<GroupBorrowedApproversDto> ReplaceBorrowedApproversAsync(string userName, bool isAdmin, int groupId, ReplaceGroupBorrowedApproversDto request)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);

            var current = await GetBorrowedApproversCoreAsync(groupId);
            var eligibleIds = current.Approvers.Concat(current.Candidates).Select(x => x.EmployeeId).ToHashSet();
            var requestedIds = request.EmployeeIds.Distinct().ToList();
            if (requestedIds.Any(id => !eligibleIds.Contains(id)))
                throw new DomainException("Chỉ được chọn người giữ chức vụ cấp trung gian thuộc Nhóm khác trong cùng Bộ phận.");

            var existing = await _unitOfWork.GroupBorrowedApprovers.FindAsync(x => x.GroupId == groupId);
            foreach (var item in existing.Where(x => !requestedIds.Contains(x.EmployeeId)))
                _unitOfWork.GroupBorrowedApprovers.Delete(item);

            var existingIds = existing.Select(x => x.EmployeeId).ToHashSet();
            await _unitOfWork.GroupBorrowedApprovers.AddRangeAsync(
                requestedIds.Where(id => !existingIds.Contains(id)).Select(id => new GroupBorrowedApprover { GroupId = groupId, EmployeeId = id }));
            await _unitOfWork.SaveChangesAsync();

            return await GetBorrowedApproversCoreAsync(groupId);
        }
        public async Task<GroupOtFormCreatorsDto> GetOtFormCreatorsAsync(string userName, bool isAdmin, int groupId)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);
            return await GetOtFormCreatorsCoreAsync(groupId);
        }

        private async Task<GroupOtFormCreatorsDto> GetOtFormCreatorsCoreAsync(int groupId)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            var creatorIds = (await _unitOfWork.GroupOtFormCreators.SelectAsync(x => x.GroupId == groupId, x => x.EmployeeId)).ToHashSet();

            // Own members can already create; only people with an account can log in to do it.
            var eligible = await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && x.UserName != null && x.GroupId != groupId
                    && ((x.Group != null && x.Group.DepartmentId == group!.DepartmentId) || x.DepartmentId == group!.DepartmentId),
                x => new GroupOtFormCreatorDto
                {
                    EmployeeId = x.Id,
                    EmployeeCode = x.Code,
                    LastName = x.LastName,
                    FirstName = x.FirstName,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null
                });

            return new GroupOtFormCreatorsDto
            {
                Creators = eligible.Where(x => creatorIds.Contains(x.EmployeeId)).OrderBy(x => x.EmployeeCode).ToList(),
                Candidates = eligible.Where(x => !creatorIds.Contains(x.EmployeeId)).OrderBy(x => x.EmployeeCode).ToList()
            };
        }

        public async Task<GroupOtFormCreatorsDto> ReplaceOtFormCreatorsAsync(string userName, bool isAdmin, int groupId, ReplaceGroupOtFormCreatorsDto request)
        {
            await EnsureCanManageGroupAsync(userName, isAdmin, groupId);

            var current = await GetOtFormCreatorsCoreAsync(groupId);
            var eligibleIds = current.Creators.Concat(current.Candidates).Select(x => x.EmployeeId).ToHashSet();
            var requestedIds = request.EmployeeIds.Distinct().ToList();
            if (requestedIds.Any(id => !eligibleIds.Contains(id)))
                throw new DomainException("Chỉ được chọn nhân viên có tài khoản, cùng Bộ phận, ngoài Nhóm này.");

            var existing = await _unitOfWork.GroupOtFormCreators.FindAsync(x => x.GroupId == groupId);
            foreach (var item in existing.Where(x => !requestedIds.Contains(x.EmployeeId)))
                _unitOfWork.GroupOtFormCreators.Delete(item);

            var existingIds = existing.Select(x => x.EmployeeId).ToHashSet();
            await _unitOfWork.GroupOtFormCreators.AddRangeAsync(
                requestedIds.Where(id => !existingIds.Contains(id)).Select(id => new GroupOtFormCreator { GroupId = groupId, EmployeeId = id }));
            await _unitOfWork.SaveChangesAsync();

            return await GetOtFormCreatorsCoreAsync(groupId);
        }
    }
}
