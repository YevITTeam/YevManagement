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
    // Phạm vi tìm kiếm ứng viên:
    //   - Tất cả cấp trừ GeneralDirector → giới hạn cùng Department (mirrors ScopeType.Department)
    //   - GeneralDirector → toàn công ty, không lọc Department (mirrors ScopeType.All, 2026-08-05)
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

            // GeneralDirector mirrors ScopeType.All trong real approval mechanism (2026-08-05):
            // họ duyệt toàn công ty nên không bị giới hạn theo Department. Mọi cấp còn lại
            // (trung gian, DepartmentManager, WorkshopManager) vẫn scoped theo Department.
            var candidates = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted
                    && x.UserName != null
                    && x.JobTitleId != null
                    && x.JobTitle!.RankOrder > creatorRank
                    && x.JobTitle.RankOrder <= targetJobTitle.RankOrder
                    && (
                        x.Group.DepartmentId == departmentId
                        || x.JobTitle.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector
                    ),
                selector: x => new
                {
                    x.Id,
                    x.UserName,
                    x.FirstName,
                    x.LastName,
                    JobTitleCode = x.JobTitle!.Code,
                    JobTitleName = x.JobTitle.Name,
                    x.JobTitle.RankOrder,
                    x.JobTitle.RequiresSignature,
                    x.JobTitle.TerminalLevel
                });

            var steps = candidates
                .GroupBy(x => new { x.RankOrder, x.JobTitleCode, x.JobTitleName, x.RequiresSignature, x.TerminalLevel })
                .OrderBy(g => g.Key.RankOrder)
                .Select((g, index) => new ResolvedApprovalStepDto
                {
                    StepOrder = index + 1,
                    JobTitleCode = g.Key.JobTitleCode,
                    JobTitleName = g.Key.JobTitleName,
                    RankOrder = g.Key.RankOrder,
                    RequiresSignature = g.Key.RequiresSignature,
                    TerminalLevel = g.Key.TerminalLevel,
                    Candidates = g.Select(c => new ResolvedApprovalCandidateDto
                    {
                        EmployeeId = c.Id,
                        UserName = c.UserName!,
                        FullName = $"{c.LastName} {c.FirstName}"
                    }).ToList()
                })
                .ToList();

            var isComplete = steps.Count > 0 && steps[^1].RankOrder == targetJobTitle.RankOrder;

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = isComplete
                    ? null
                    : $"Phòng ban chưa có đủ người giữ Chức vụ theo từng cấp — chuỗi duyệt hiện chưa tới được '{targetJobTitle.Name}'."
            };
        }
    }
}
