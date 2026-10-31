using Attendance.Application.Dtos.ApprovalDelegations;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class ApprovalDelegationService : BaseService<IAttendanceUnitOfWork>, IApprovalDelegationService
    {
        private const string ApprovePermission = "Attendance.OTForm.Approve";

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IBackgroundTaskQueue _taskQueue;

        public ApprovalDelegationService(
            IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService, IBackgroundTaskQueue taskQueue) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _taskQueue = taskQueue;
        }

        public async Task<List<ApprovalDelegationDto>> GetMineAsync(string currentUserName)
        {
            var me = await ResolveCurrentEmployeeAsync(currentUserName);
            var items = await _unitOfWork.ApprovalDelegations.FindWithIncludesAsync(
                x => !x.IsDeleted && (x.DelegatorEmployeeId == me.Id || x.DelegateEmployeeId == me.Id),
                x => x.DelegatorEmployee, x => x.DelegateEmployee);

            return items.OrderByDescending(x => x.FromDate).Select(x => ToDto(x, me.Id)).ToList();
        }

        public async Task<List<DelegateOptionDto>> GetDelegateOptionsAsync(string currentUserName)
        {
            var me = await ResolveCurrentEmployeeAsync(currentUserName);
            var eligible = await GetEligibleDelegatesAsync(me);
            return eligible
                .OrderBy(e => e.Code)
                .Select(e => new DelegateOptionDto
                {
                    EmployeeId = e.Id,
                    Code = e.Code,
                    FullName = $"{e.LastName} {e.FirstName}",
                    UserName = e.UserName!,
                    JobTitleName = e.JobTitle?.Name ?? ""
                })
                .ToList();
        }

        // Manager delegates to the top non-terminal title (Team Leader) in one of their (workshop, department) pairs;
        // any other title delegates to the same title in the same unit (Group, or workshop + department for the top
        // non-terminal title).
        private async Task<List<Employee>> GetEligibleDelegatesAsync(Employee me)
        {
            var myTitle = me.JobTitle ?? throw new DomainException("Bạn chưa được gán Chức vụ nên không thể ủy quyền.");

            var titles = await _unitOfWork.JobTitles.FindAsync(x => !x.IsDeleted);
            var topNonTerminal = titles
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None)
                .OrderByDescending(x => x.RankOrder)
                .FirstOrDefault();

            static int? DepartmentOf(Employee e) => e.Group?.DepartmentId ?? e.DepartmentId;
            static int? WorkshopOf(Employee e) => e.Group?.WorkshopId;

            var candidates = await _unitOfWork.Employees.FindWithIncludesAsync(
                x => !x.IsDeleted && x.UserName != null && x.Id != me.Id && x.JobTitleId != null, x => x.Group!, x => x.JobTitle!);

            if (myTitle.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
            {
                var myPairs = (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == me.Id))
                    .Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
                if (topNonTerminal == null || myPairs.Count == 0) return new List<Employee>();
                return candidates.Where(x => x.JobTitleId == topNonTerminal.Id && x.Group != null
                    && myPairs.Contains(ScopeKey.Of(x.Group.DepartmentId, x.Group.WorkshopId))).ToList();
            }

            var peers = candidates.Where(x => x.JobTitleId == myTitle.Id);
            if (myTitle.TerminalLevel != (int)JobTitleTerminalLevel.None) return peers.ToList();

            return myTitle.Id == topNonTerminal?.Id
                ? peers.Where(x => DepartmentOf(me) != null && DepartmentOf(x) == DepartmentOf(me) && WorkshopOf(x) == WorkshopOf(me)).ToList()
                : peers.Where(x => me.GroupId != null && x.GroupId == me.GroupId).ToList();
        }

        public async Task<ApprovalDelegationDto> CreateAsync(string currentUserName, CreateUpdateApprovalDelegationDto request)
        {
            var me = await ResolveCurrentEmployeeAsync(currentUserName);
            await ValidateAsync(me, request, excludeId: null);

            var entity = new ApprovalDelegation
            {
                DelegatorEmployeeId = me.Id,
                DelegateEmployeeId = request.DelegateEmployeeId,
                FromDate = request.FromDate,
                ToDate = request.ToDate,
                Reason = request.Reason
            };
            await _unitOfWork.ApprovalDelegations.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();
            QueueBackfill(entity.Id);

            return await LoadDtoAsync(entity.Id, me.Id);
        }

        public async Task<ApprovalDelegationDto> UpdateAsync(int id, string currentUserName, CreateUpdateApprovalDelegationDto request)
        {
            var me = await ResolveCurrentEmployeeAsync(currentUserName);
            var entity = await GetOwnedAsync(id, me.Id, "sửa");
            await ValidateAsync(me, request, excludeId: id);

            entity.DelegateEmployeeId = request.DelegateEmployeeId;
            entity.FromDate = request.FromDate;
            entity.ToDate = request.ToDate;
            entity.Reason = request.Reason;
            _unitOfWork.ApprovalDelegations.Update(entity);
            await _unitOfWork.SaveChangesAsync();
            QueueBackfill(entity.Id);

            return await LoadDtoAsync(entity.Id, me.Id);
        }

        // Runs in its own scope after the response so a slow SMTP round-trip never blocks saving.
        private void QueueBackfill(int delegationId)
        {
            _taskQueue.QueueBackgroundWorkItem(async (sp, _) =>
                await sp.GetRequiredService<IOtFormNotificationService>().SendDelegationBackfillNotificationsAsync(delegationId));
        }

        public async Task DeleteAsync(int id, string currentUserName)
        {
            var me = await ResolveCurrentEmployeeAsync(currentUserName);
            var entity = await GetOwnedAsync(id, me.Id, "xóa");

            entity.IsDeleted = true;
            _unitOfWork.ApprovalDelegations.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<ApprovalDelegation> GetOwnedAsync(int id, int myEmployeeId, string verb)
        {
            var entity = await _unitOfWork.ApprovalDelegations.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            entity.OrThrowNotFound("Ủy quyền", id);
            if (entity!.DelegatorEmployeeId != myEmployeeId)
                throw new DomainException($"Chỉ người ủy quyền mới được {verb}.");
            return entity;
        }

        private async Task ValidateAsync(Employee me, CreateUpdateApprovalDelegationDto request, int? excludeId)
        {
            if (request.DelegateEmployeeId == me.Id)
                throw new DomainException("Không thể ủy quyền cho chính mình.");
            if (request.ToDate < request.FromDate)
                throw new DomainException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
            if (request.ToDate < Today())
                throw new DomainException("Ngày kết thúc đã qua.");

            var delegateEmployee = (await GetEligibleDelegatesAsync(me)).FirstOrDefault(x => x.Id == request.DelegateEmployeeId)
                ?? throw new DomainException("Người này không thuộc đối tượng được ủy quyền theo cấp của bạn.");
            if (!await _userDirectoryService.UserHasPermissionAsync(delegateEmployee.UserName!, ApprovePermission))
                throw new DomainException("Người được ủy quyền chưa có quyền duyệt đơn tăng ca.");

            var overlapping = (await _unitOfWork.ApprovalDelegations.FindAsync(
                x => !x.IsDeleted && x.Id != (excludeId ?? 0) && x.FromDate <= request.ToDate && x.ToDate >= request.FromDate)).ToList();

            if (overlapping.Any(x => x.DelegatorEmployeeId == me.Id))
                throw new DomainException("Bạn đã có một ủy quyền khác chồng khoảng thời gian này.");
            if (overlapping.Any(x => x.DelegatorEmployeeId == request.DelegateEmployeeId))
                throw new DomainException("Người được ủy quyền đang ủy quyền cho người khác trong khoảng thời gian này — không hỗ trợ ủy quyền dây chuyền.");
            if (overlapping.Any(x => x.DelegateEmployeeId == me.Id))
                throw new DomainException("Bạn đang được ủy quyền duyệt thay người khác trong khoảng thời gian này — không hỗ trợ ủy quyền dây chuyền.");
        }

        private async Task<ApprovalDelegationDto> LoadDtoAsync(int id, int myEmployeeId)
        {
            var item = (await _unitOfWork.ApprovalDelegations.FindWithIncludesAsync(
                x => x.Id == id, x => x.DelegatorEmployee, x => x.DelegateEmployee)).Single();
            return ToDto(item, myEmployeeId);
        }

        private static ApprovalDelegationDto ToDto(ApprovalDelegation x, int myEmployeeId)
        {
            var today = Today();
            return new ApprovalDelegationDto
            {
                Id = x.Id,
                DelegatorEmployeeId = x.DelegatorEmployeeId,
                DelegatorName = $"{x.DelegatorEmployee.LastName} {x.DelegatorEmployee.FirstName}",
                DelegateEmployeeId = x.DelegateEmployeeId,
                DelegateName = $"{x.DelegateEmployee.LastName} {x.DelegateEmployee.FirstName}",
                FromDate = x.FromDate,
                ToDate = x.ToDate,
                Reason = x.Reason,
                IsActive = x.FromDate <= today && today <= x.ToDate,
                IsMine = x.DelegatorEmployeeId == myEmployeeId
            };
        }

        private static DateOnly Today() => DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());

        private async Task<Employee> ResolveCurrentEmployeeAsync(string currentUserName)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == currentUserName && !x.IsDeleted, x => x.JobTitle!, x => x.Group!);
            return employee ?? throw new DomainException("Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào, không thể thao tác ủy quyền.");
        }
    }
}
