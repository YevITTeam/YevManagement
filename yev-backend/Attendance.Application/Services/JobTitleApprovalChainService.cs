using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Giai đoạn 2b (2026-08-06) — chuỗi duyệt đọc từ DepartmentApprovalStep (cấu hình TAY theo từng
    // Phòng ban), KHÔNG còn tự bắc cầu qua mọi RankOrder đang có người giữ. Giai đoạn 3.1 (2026-08-07)
    // wiring thật vào OtFormService.CreateAsync qua ResolveChainForCreationAsync — xem
    // docs/docs-be/attendance-module.md §Cây chức vụ.
    //
    // Phạm vi tìm ứng viên mỗi bước (sửa 2026-08-08 — trước đây chỉ GeneralDirector dùng chung toàn
    // công ty, WorkshopManager vẫn bị lọc theo Department như DepartmentManager, KHÔNG khớp nghiệp vụ
    // thật: Trưởng Xưởng cũng là 1 người dùng chung cho nhiều Phòng ban, giống Giám đốc):
    //   - Chức vụ có TerminalLevel = WorkshopManager hoặc GeneralDirector → dùng chung toàn công ty,
    //     KHÔNG lọc theo Department của người tạo đơn (mirrors ScopeType.All của UserApprovalScope cũ)
    //   - Chức vụ có TerminalLevel = DepartmentManager hoặc None (cấp trung gian) → chỉ tính người có
    //     Employee.Group.DepartmentId khớp đúng Department của người tạo đơn. Employee.GroupId chỉ cần
    //     trỏ tới BẤT KỲ Group nào thuộc đúng Department đó — không cần phản ánh đúng "bộ phận quản lý"
    //     theo nghĩa thành viên (Trưởng phòng không thuộc bộ phận cụ thể nào).
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

            // Người tạo đơn OT phải thuộc 1 Bộ phận thật (GroupId) — Trưởng phòng/Trưởng Xưởng/Giám đốc
            // (2026-08-08, GroupId null) không tạo đơn OT cho chính họ qua luồng này.
            if (creator.Group is null)
                throw new DomainException($"Nhân viên '{creator.Code}' không thuộc Bộ phận nào (Trưởng phòng/Trưởng Xưởng/Giám đốc) — không áp dụng cho việc tạo đơn OT.");

            return await ResolveChainCoreAsync(creator.JobTitle.RankOrder, creator.Group.DepartmentId, otCaseId);
        }

        public async Task<ResolveApprovalChainResultDto> ResolveChainForCreationAsync(int? creatorEmployeeId, int departmentId, int otCaseId)
        {
            var creatorRank = 0;

            if (creatorEmployeeId.HasValue)
            {
                var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.Id == creatorEmployeeId.Value && !x.IsDeleted, x => x.JobTitle!);
                if (creator?.JobTitle != null)
                    creatorRank = creator.JobTitle.RankOrder;
            }

            return await ResolveChainCoreAsync(creatorRank, departmentId, otCaseId);
        }

        private async Task<ResolveApprovalChainResultDto> ResolveChainCoreAsync(int creatorRank, int departmentId, int otCaseId)
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

            // Người tạo đã ở cấp bằng/cao hơn cấp duyệt cuối cần tới — không cần bước duyệt nào.
            if (targetJobTitle.RankOrder <= creatorRank)
                return new ResolveApprovalChainResultDto { IsComplete = true };

            var configuredSteps = await _unitOfWork.DepartmentApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new
                {
                    x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    x.JobTitle.RankOrder,
                    x.RequiresSignature,
                    x.IsResponsible,
                    x.JobTitle.TerminalLevel
                });

            if (configuredSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = "Phòng ban của người tạo đơn chưa được cấu hình cây duyệt (xem màn \"Cây duyệt Phòng ban\")."
                };
            }

            // Chỉ giữ các bước ở cấp CAO HƠN người tạo (người tạo không tự duyệt đơn của mình), theo
            // đúng thứ tự StepOrder Admin đã sắp xếp, rồi cắt tại bước đầu tiên chạm đúng cấp duyệt cuối
            // cần tới — các bước cấu hình sau đó (nếu có) không liên quan tới OtCase này.
            var relevantSteps = configuredSteps
                .Where(x => x.RankOrder > creatorRank)
                .OrderBy(x => x.StepOrder)
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
                    Warning = $"Cây duyệt của Phòng ban chưa có bước nào phù hợp để tới '{targetJobTitle.Name}'."
                };
            }

            var deptScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel != (int)JobTitleTerminalLevel.WorkshopManager
                    && x.TerminalLevel != (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.WorkshopManager
                    || x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            // Khớp cả 2 đường tới Department: qua Group (nhân viên thường giữ Chức vụ trung gian) hoặc
            // trực tiếp Employee.DepartmentId (Trưởng phòng — TerminalLevel=DepartmentManager, không
            // thuộc Bộ phận cụ thể nào, xem 2026-08-08).
            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && ((x.Group != null && x.Group.DepartmentId == departmentId) || x.DepartmentId == departmentId)
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

            var allCandidates = deptCandidates.Concat(companyWideCandidates).ToList();

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
                warning = $"Cây duyệt của Phòng ban chưa cấu hình tới cấp '{targetJobTitle.Name}' — đơn sẽ bị kẹt.";
            else if (!isComplete)
            {
                var missingStepNames = steps.Where(x => x.Candidates.Count == 0).Select(x => x.JobTitleName);
                warning = $"Chưa có ai giữ Chức vụ: {string.Join(", ", missingStepNames)} trong Phòng ban — đơn sẽ bị kẹt ở (các) bước này.";
            }

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = warning
            };
        }
    }
}
