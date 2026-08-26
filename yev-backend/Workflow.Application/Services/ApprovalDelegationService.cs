using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.ApprovalDelegations;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class ApprovalDelegationService : BaseService<IWorkflowUnitOfWork>, IApprovalDelegationService
    {
        public ApprovalDelegationService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<ApprovalDelegationDto>> GetMineAsync(int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var items = await _unitOfWork.ApprovalDelegations.FindAsync(
                x => !x.IsDeleted && (x.DelegatorEmployeeId == currentEmployeeId || x.DelegateEmployeeId == currentEmployeeId));
            return await ToDtoListAsync(items.ToList());
        }

        public async Task<ApprovalDelegationDto> CreateAsync(CreateUpdateApprovalDelegationDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            if (request.DelegateEmployeeId == currentEmployeeId)
                throw new DomainException("Không thể ủy quyền duyệt thay cho chính mình.");

            (await _unitOfWork.Employees.GetByIdAsync(request.DelegateEmployeeId)).OrThrowNotFound("Nhân sự", request.DelegateEmployeeId);
            if (request.FormDefinitionId is int fdId)
                (await _unitOfWork.FormDefinitions.GetByIdAsync(fdId)).OrThrowNotFound("Form", fdId);

            if (request.ToDate < request.FromDate)
                throw new DomainException("Ngày kết thúc phải sau ngày bắt đầu.");

            await GuardNoDelegationChainAsync(currentEmployeeId, request.DelegateEmployeeId);

            var entity = new ApprovalDelegation
            {
                DelegatorEmployeeId = currentEmployeeId,
                DelegateEmployeeId = request.DelegateEmployeeId,
                FormDefinitionId = request.FormDefinitionId,
                FromDate = request.FromDate,
                ToDate = request.ToDate,
                Reason = request.Reason,
                IsDeleted = false
            };
            await _unitOfWork.ApprovalDelegations.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return (await ToDtoListAsync(new List<ApprovalDelegation> { entity })).Single();
        }

        public async Task<ApprovalDelegationDto> UpdateAsync(int id, CreateUpdateApprovalDelegationDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var entity = (await _unitOfWork.ApprovalDelegations.GetByIdAsync(id)).OrThrowNotFound("Ủy quyền", id);

            if (entity.DelegatorEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo ủy quyền mới được sửa.");

            if (request.DelegateEmployeeId == currentEmployeeId)
                throw new DomainException("Không thể ủy quyền duyệt thay cho chính mình.");

            (await _unitOfWork.Employees.GetByIdAsync(request.DelegateEmployeeId)).OrThrowNotFound("Nhân sự", request.DelegateEmployeeId);
            if (request.FormDefinitionId is int fdId)
                (await _unitOfWork.FormDefinitions.GetByIdAsync(fdId)).OrThrowNotFound("Form", fdId);

            if (request.ToDate < request.FromDate)
                throw new DomainException("Ngày kết thúc phải sau ngày bắt đầu.");

            await GuardNoDelegationChainAsync(currentEmployeeId, request.DelegateEmployeeId, excludeId: id);

            entity.DelegateEmployeeId = request.DelegateEmployeeId;
            entity.FormDefinitionId = request.FormDefinitionId;
            entity.FromDate = request.FromDate;
            entity.ToDate = request.ToDate;
            entity.Reason = request.Reason;

            _unitOfWork.ApprovalDelegations.Update(entity);
            await _unitOfWork.SaveChangesAsync();

            return (await ToDtoListAsync(new List<ApprovalDelegation> { entity })).Single();
        }

        public async Task DeleteAsync(int id, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var entity = (await _unitOfWork.ApprovalDelegations.GetByIdAsync(id)).OrThrowNotFound("Ủy quyền", id);

            if (entity.DelegatorEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo ủy quyền mới được xóa.");

            entity.IsDeleted = true;
            _unitOfWork.ApprovalDelegations.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        // Chỉ chấp nhận ủy quyền 1 cấp (workflow-module.md §3.4/§5.6): chặn nếu Delegate của dòng mới
        // đang là Delegator của 1 dòng khác còn hiệu lực (A->B rồi B->C), và ngược lại (chặn cả 2
        // chiều để không ai vô tình trở thành mắt xích giữa của một dây chuyền).
        private async Task GuardNoDelegationChainAsync(int delegatorEmployeeId, int delegateEmployeeId, int? excludeId = null)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var active = (await _unitOfWork.ApprovalDelegations.FindAsync(x => !x.IsDeleted && x.Id != (excludeId ?? 0) && x.ToDate >= now)).ToList();

            if (active.Any(x => x.DelegatorEmployeeId == delegateEmployeeId))
                throw new DomainException("Người được ủy quyền đang là người ủy quyền ở một dòng khác — không hỗ trợ ủy quyền dây chuyền.");

            if (active.Any(x => x.DelegateEmployeeId == delegatorEmployeeId))
                throw new DomainException("Bạn đang là người được ủy quyền duyệt thay ở một dòng khác — không hỗ trợ ủy quyền dây chuyền.");
        }

        private async Task<List<ApprovalDelegationDto>> ToDtoListAsync(List<ApprovalDelegation> items)
        {
            var employeeIds = items.Select(x => x.DelegatorEmployeeId).Concat(items.Select(x => x.DelegateEmployeeId)).Distinct().ToList();
            var employeesById = (await _unitOfWork.Employees.FindAsync(e => employeeIds.Contains(e.Id))).ToDictionary(e => e.Id);
            var formIds = items.Where(x => x.FormDefinitionId is not null).Select(x => x.FormDefinitionId!.Value).Distinct().ToList();
            var formsById = (await _unitOfWork.FormDefinitions.FindAsync(f => formIds.Contains(f.Id))).ToDictionary(f => f.Id);

            return items.Select(x => new ApprovalDelegationDto
            {
                Id = x.Id,
                DelegatorEmployeeId = x.DelegatorEmployeeId,
                DelegatorEmployeeName = employeesById.TryGetValue(x.DelegatorEmployeeId, out var d) ? d.FullName : "",
                DelegateEmployeeId = x.DelegateEmployeeId,
                DelegateEmployeeName = employeesById.TryGetValue(x.DelegateEmployeeId, out var dg) ? dg.FullName : "",
                FormDefinitionId = x.FormDefinitionId,
                FormDefinitionNameVn = x.FormDefinitionId is int fid && formsById.TryGetValue(fid, out var f) ? f.NameVn : null,
                FromDate = x.FromDate,
                ToDate = x.ToDate,
                Reason = x.Reason
            }).ToList();
        }

        private async Task<int> ResolveCurrentEmployeeIdAsync(int? currentUserId)
        {
            if (currentUserId is null)
                throw new DomainException("Không xác định được người dùng hiện tại. Vui lòng đăng nhập lại.");

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserId == currentUserId && !x.IsDeleted);
            if (employee is null)
                throw new DomainException("Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự nào trong Workflow, không thể thực hiện thao tác này.");

            return employee.Id;
        }
    }
}
