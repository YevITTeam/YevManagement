using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Candidate scope per step: TerminalLevel=None -> creator's own group only; Factory Manager/Director -> company-wide;
    // DepartmentManager -> people whose EmployeeApprovalScope matches the form's (workshop, department) pair.
    public class JobTitleApprovalChainService : BaseService<IAttendanceUnitOfWork>, IJobTitleApprovalChainService
    {
        public JobTitleApprovalChainService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId)
        {
            var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.Id == creatorEmployeeId && !x.IsDeleted, x => x.Group!, x => x.JobTitle!);
            creator.OrThrowNotFound("Nhân viên", creatorEmployeeId);

            if (creator!.JobTitleId is null || creator.JobTitle is null)
                throw new DomainException($"Nhân viên '{creator.Code}' chưa được gán chức vụ — không thể suy luận chuỗi duyệt.");

            // Department managers and above have no GroupId and can't create OT forms for themselves through this path.
            if (creator.Group is null)
                throw new DomainException($"Nhân viên '{creator.Code}' không thuộc Nhóm nào (Trưởng phòng/Trưởng Xưởng/Giám đốc) — không áp dụng cho việc tạo đơn OT.");

            return await ResolveChainCoreAsync(creator.JobTitle.RankOrder, creator.Group.Id, creator.Group.DepartmentId, creator.Group.WorkshopId, otCaseId);
        }

        public async Task<ResolveApprovalChainResultDto> ResolveChainForCreationAsync(int? creatorEmployeeId, int groupId, int departmentId, int workshopId, int otCaseId)
        {
            var creatorRank = 0;

            if (creatorEmployeeId.HasValue)
            {
                var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.Id == creatorEmployeeId.Value && !x.IsDeleted, x => x.JobTitle!);
                if (creator?.JobTitle != null)
                    creatorRank = creator.JobTitle.RankOrder;
            }

            return await ResolveChainCoreAsync(creatorRank, groupId, departmentId, workshopId, otCaseId);
        }

        private class ConfiguredStepRow
        {
            public int StepOrder { get; set; }
            public int JobTitleId { get; set; }
            public string JobTitleCode { get; set; } = null!;
            public string JobTitleName { get; set; } = null!;
            public int RankOrder { get; set; }
            public bool RequiresSignature { get; set; }
            public bool IsResponsible { get; set; }
            public int TerminalLevel { get; set; }

            // Only meaningful for production chains (ProductionApprovalStep).
            public bool IsLineScoped { get; set; }
        }

        private async Task<ResolveApprovalChainResultDto> ResolveChainCoreAsync(int creatorRank, int groupId, int departmentId, int workshopId, int otCaseId)
        {
            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", otCaseId);

            var targetTerminalLevel = otCase!.RequiredApprovalLevel;
            var targetJobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.TerminalLevel == targetTerminalLevel && !x.IsDeleted);

            if (targetJobTitle is null)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Chưa có Chức vụ nào được cấu hình làm cấp duyệt cuối tương ứng (TerminalLevel={targetTerminalLevel})."
                };
            }

            // Group steps always come before department steps; the two StepOrder sequences are independent and not comparable.
            var groupSteps = await _unitOfWork.GroupApprovalSteps.SelectAsync(
                predicate: x => x.GroupId == groupId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            var departmentSteps = await _unitOfWork.DepartmentApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = false,
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            var configuredSteps = groupSteps.OrderBy(x => x.StepOrder)
                .Concat(departmentSteps.OrderBy(x => x.StepOrder))
                .ToList();

            // Computed before filtering: must consider every configured signing title, including steps at or below the creator's rank.
            var configuredSigningIntermediateSteps = configuredSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.RequiresSignature)
                .ToList();
            // A signing step of the creator's own rank is dropped from the chain, so they sign for it at creation.
            var requiresCreatorSelfSign = creatorRank > 0
                && configuredSigningIntermediateSteps.Count > 0
                && (configuredSigningIntermediateSteps.All(x => x.RankOrder <= creatorRank)
                    || configuredSigningIntermediateSteps.Any(x => x.RankOrder == creatorRank));

            // Checked after requiresCreatorSelfSign so a form completing immediately still snapshots the creator's signature.
            if (targetJobTitle.RankOrder <= creatorRank)
                return new ResolveApprovalChainResultDto { IsComplete = true, RequiresCreatorSelfSign = requiresCreatorSelfSign };

            if (configuredSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = "Nhóm/Bộ phận của người tạo đơn chưa được cấu hình cây duyệt (xem màn \"Cây duyệt\", phần \"Cây duyệt Nhóm\"/\"Cây duyệt Bộ phận\")."
                };
            }

            // Keep steps above the creator, cut at the first one reaching the target level; later steps don't apply to this OtCase.
            var relevantSteps = configuredSteps
                .Where(x => x.RankOrder > creatorRank)
                .ToList();

            var cutoffIndex = relevantSteps.FindIndex(x => x.TerminalLevel == targetTerminalLevel);
            var reachesTarget = cutoffIndex >= 0;
            if (reachesTarget)
            {
                relevantSteps = relevantSteps.Take(cutoffIndex + 1).ToList();
            }

            if (relevantSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Cây duyệt của Nhóm/Bộ phận chưa có bước nào phù hợp để tới '{targetJobTitle.Name}'.",
                    RequiresCreatorSelfSign = requiresCreatorSelfSign
                };
            }

            var intermediateJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None)
                .Select(x => x.JobTitleId)
                .ToList();
            var deptScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.WorkshopManager
                    || x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            // Intermediate levels: creator's own group plus people of other Groups lent to it (GroupBorrowedApprover).
            var borrowedApproverIds = intermediateJobTitleIds.Count == 0
                ? new List<int>()
                : await _unitOfWork.GroupBorrowedApprovers.SelectAsync(x => x.GroupId == groupId, x => x.EmployeeId);
            var intermediateCandidates = intermediateJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && (x.GroupId == groupId || borrowedApproverIds.Contains(x.Id))
                        && x.JobTitleId != null && intermediateJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            // Department managers are matched by the form's (workshop, department) scope, not Employee.DepartmentId.
            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.ApprovalScopes.Any(s => s.DepartmentId == departmentId && s.WorkshopId == workshopId)
                        && x.JobTitleId != null && deptScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var companyWideCandidates = companyWideJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.JobTitleId != null && companyWideJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var allCandidates = intermediateCandidates.Concat(deptCandidates).Concat(companyWideCandidates).ToList();

            var steps = relevantSteps
                .Select((step, index) => new ResolvedApprovalStepDto
                {
                    StepOrder = index + 1,
                    JobTitleId = step.JobTitleId,
                    JobTitleCode = step.JobTitleCode,
                    JobTitleName = step.JobTitleName,
                    RankOrder = step.RankOrder,
                    RequiresSignature = step.RequiresSignature,
                    IsResponsible = step.IsResponsible,
                    TerminalLevel = step.TerminalLevel,
                    Candidates = allCandidates
                        .Where(c => c.JobTitleId == step.JobTitleId)
                        .Select(c => new ResolvedApprovalCandidateDto
                        {
                            EmployeeId = c.Id,
                            UserName = c.UserName,
                            FullName = $"{c.LastName} {c.FirstName}"
                        })
                        .ToList()
                })
                .ToList();

            var isComplete = reachesTarget && steps.All(x => x.Candidates.Count > 0);

            string? warning = null;
            if (!reachesTarget)
                warning = $"Cây duyệt của Nhóm/Bộ phận chưa cấu hình tới cấp '{targetJobTitle.Name}' — đơn sẽ bị kẹt.";
            else if (!isComplete)
            {
                var missingStepNames = steps.Where(x => x.Candidates.Count == 0).Select(x => x.JobTitleName);
                warning = $"Chưa có ai giữ Chức vụ: {string.Join(", ", missingStepNames)} trong Nhóm/Bộ phận — đơn sẽ bị kẹt ở (các) bước này.";
            }

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = warning,
                RequiresCreatorSelfSign = requiresCreatorSelfSign
            };
        }

        public async Task<ResolveApprovalChainResultDto> ResolveChainForProductionCreationAsync(
            int? creatorEmployeeId, int departmentId, int workshopId, List<int> employeeIds, int otCaseId)
        {
            var creatorRank = 0;
            if (creatorEmployeeId.HasValue)
            {
                var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.Id == creatorEmployeeId.Value && !x.IsDeleted, x => x.JobTitle!);
                if (creator?.JobTitle != null)
                    creatorRank = creator.JobTitle.RankOrder;
            }

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", otCaseId);

            var targetTerminalLevel = otCase!.RequiredApprovalLevel;
            var targetJobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.TerminalLevel == targetTerminalLevel && !x.IsDeleted);

            if (targetJobTitle is null)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Chưa có Chức vụ nào được cấu hình làm cấp duyệt cuối tương ứng (TerminalLevel={targetTerminalLevel})."
                };
            }

            var configuredSteps = (await _unitOfWork.ProductionApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    TerminalLevel = x.JobTitle.TerminalLevel,
                    IsLineScoped = x.JobTitle.IsLineScoped
                }))
                .OrderBy(x => x.StepOrder)
                .ToList();

            var configuredSigningIntermediateSteps = configuredSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.RequiresSignature)
                .ToList();
            var requiresCreatorSelfSign = creatorRank > 0
                && configuredSigningIntermediateSteps.Count > 0
                && configuredSigningIntermediateSteps.All(x => x.RankOrder <= creatorRank);

            if (targetJobTitle.RankOrder <= creatorRank)
                return new ResolveApprovalChainResultDto { IsComplete = true, RequiresCreatorSelfSign = requiresCreatorSelfSign };

            if (configuredSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = "Bộ phận này chưa cấu hình cây duyệt theo chuyền (xem màn \"Cây duyệt\", phần \"Cây duyệt Chuyền\")."
                };
            }

            // ">=" so a Line Leader creator keeps their own step: the form must wait for them to sign before going up.
            var relevantSteps = configuredSteps.Where(x => x.RankOrder >= creatorRank).ToList();

            var cutoffIndex = relevantSteps.FindIndex(x => x.TerminalLevel == targetTerminalLevel);
            var reachesTarget = cutoffIndex >= 0;
            if (reachesTarget)
                relevantSteps = relevantSteps.Take(cutoffIndex + 1).ToList();

            if (relevantSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Cây duyệt chuyền của Bộ phận chưa có bước nào phù hợp để tới '{targetJobTitle.Name}'.",
                    RequiresCreatorSelfSign = requiresCreatorSelfSign
                };
            }

            // Line Leaders must sit on the line derived from the form's employees;
            // Group/Team Leaders are shared across the whole department for production forms.
            var lineScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.IsLineScoped)
                .Select(x => x.JobTitleId)
                .ToList();
            var groupScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && !x.IsLineScoped)
                .Select(x => x.JobTitleId)
                .ToList();
            var deptScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.WorkshopManager
                    || x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            // Line scope is derived only when all employees share one line; otherwise the Line Leader step gets no candidate.
            int? derivedProductionLineId = null;
            if (employeeIds.Count > 0)
            {
                var participantLineIds = (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => employeeIds.Contains(x.Id) && x.ProductionLineId != null && !x.IsDeleted,
                    selector: x => x.ProductionLineId))
                    .Distinct()
                    .ToList();
                if (participantLineIds.Count == 1 && participantLineIds[0].HasValue)
                    derivedProductionLineId = participantLineIds[0];
            }

            var lineScopedCandidates = (lineScopedJobTitleIds.Count == 0 || derivedProductionLineId is null)
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null && x.ProductionLineId == derivedProductionLineId
                        && x.JobTitleId != null && lineScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var groupScopedCandidates = groupScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.Group != null && x.Group.DepartmentId == departmentId && x.Group.WorkshopId == workshopId
                        && x.JobTitleId != null && groupScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.ApprovalScopes.Any(s => s.DepartmentId == departmentId && s.WorkshopId == workshopId)
                        && x.JobTitleId != null && deptScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var companyWideCandidates = companyWideJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.JobTitleId != null && companyWideJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var allCandidates = lineScopedCandidates.Concat(groupScopedCandidates).Concat(deptCandidates).Concat(companyWideCandidates).ToList();

            var steps = relevantSteps
                .Select((step, index) => new ResolvedApprovalStepDto
                {
                    StepOrder = index + 1,
                    JobTitleId = step.JobTitleId,
                    JobTitleCode = step.JobTitleCode,
                    JobTitleName = step.JobTitleName,
                    RankOrder = step.RankOrder,
                    RequiresSignature = step.RequiresSignature,
                    IsResponsible = step.IsResponsible,
                    TerminalLevel = step.TerminalLevel,
                    Candidates = allCandidates
                        .Where(c => c.JobTitleId == step.JobTitleId)
                        .Select(c => new ResolvedApprovalCandidateDto
                        {
                            EmployeeId = c.Id,
                            UserName = c.UserName,
                            FullName = $"{c.LastName} {c.FirstName}"
                        })
                        .ToList()
                })
                .ToList();

            var isComplete = reachesTarget && steps.All(x => x.Candidates.Count > 0);

            string? warning = null;
            if (!reachesTarget)
                warning = $"Cây duyệt chuyền của Bộ phận chưa cấu hình tới cấp '{targetJobTitle.Name}' — đơn sẽ bị kẹt.";
            else if (!isComplete)
            {
                var missingStepNames = steps.Where(x => x.Candidates.Count == 0).Select(x => x.JobTitleName);
                warning = $"Chưa tìm được ứng viên cho: {string.Join(", ", missingStepNames)} — có thể chưa có ai giữ Chức vụ đó " +
                    "trong Bộ phận, hoặc (riêng Line Leader) những người trong đơn đang lẫn nhiều Line khác nhau — đơn sẽ bị kẹt " +
                    "ở (các) bước này.";
            }

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = warning,
                RequiresCreatorSelfSign = requiresCreatorSelfSign
            };
        }
    }
}
