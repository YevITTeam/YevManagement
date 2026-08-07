using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Giai đoạn 2 "Cây chức vụ" (2026-08-06) — engine suy luận chuỗi duyệt XÂY SONG SONG với cơ chế
    // Submitter/GroupHead/UserApprovalScope hiện tại. Service này KHÔNG được OtFormService gọi tới —
    // chỉ phục vụ endpoint xem trước (JobTitleController.ResolveChain) để test thuật toán trên dữ liệu
    // thật trước khi quyết định wiring/xoá dữ liệu cũ. Xem docs/docs-be/attendance-module.md §Cây chức vụ.
    //
    // SỬA 2026-08-06 (phản hồi người dùng): KHÔNG còn tự bắc cầu qua mọi RankOrder đang có người giữ —
    // cách đó khiến 1 đơn phải đi qua quá nhiều bước nếu Phòng ban có đủ người ở mọi cấp (VD 10 bước
    // cho 1 đơn tăng ca). Chuỗi giờ đọc từ DepartmentApprovalStep — Admin tự cấu hình tay danh sách
    // Chức vụ nào là bước duyệt thật của TỪNG Phòng ban, theo đúng thứ tự StepOrder.
    //
    // Phạm vi tìm ứng viên mỗi bước:
    //   - Chức vụ có TerminalLevel = GeneralDirector → toàn công ty, không lọc Department (mirrors
    //     ScopeType.All của UserApprovalScope, 2026-08-05)
    //   - Mọi Chức vụ khác → chỉ trong đúng Department của người tạo đơn
    public class JobTitleApprovalChainService : BaseService<IAttendanceUnitOfWork>, IJobTitleApprovalChainService
    {
        public JobTitleApprovalChainService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId)
        {
            var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.Id == creatorEmployeeId && !x.IsDeleted, x => x.Group, x => x.JobTitle!);
            creator.OrThrowNotFound("Nhân viên", creatorEmployeeId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", otCaseId);

            if (creator!.JobTitleId is null || creator.JobTitle is null)
                throw new DomainException($"Nhân viên '{creator.Code}' chưa được gán chức vụ — không thể suy luận chuỗi duyệt.");

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

            var creatorRank = creator.JobTitle.RankOrder;
            var departmentId = creator.Group.DepartmentId;

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
                .Where(x => x.TerminalLevel != (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null && x.Group.DepartmentId == departmentId
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
