using Attendance.Application.Dtos.GroupApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý cây duyệt cấu hình tay theo từng Nhóm (2026-08-08) — CHỈ chứa 3 cấp trung gian dưới
    // Manager (Staff/Group Leader/Team Leader, JobTitle.TerminalLevel=None). 3 cấp cuối vẫn cấu hình
    // ở DepartmentApprovalStepService theo Bộ phận, không lặp lại ở đây — xem
    // docs/docs-be/attendance-module.md §Cây chức vụ. Không có Create/Update/Delete từng dòng riêng
    // lẻ, chỉ thay NGUYÊN danh sách 1 lần (khớp UI kiểu "sắp xếp rồi Lưu", mirror
    // DepartmentApprovalStepService).
    public class GroupApprovalStepService : BaseService<IAttendanceUnitOfWork>, IGroupApprovalStepService
    {
        public GroupApprovalStepService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<GroupApprovalStepDto>> GetByGroupAsync(int groupId)
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
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            return steps.OrderBy(x => x.StepOrder).ToList();
        }

        public async Task<List<GroupApprovalStepDto>> ReplaceAsync(int groupId, ReplaceGroupApprovalStepsDto request)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            if (request.Steps.Count(x => x.IsResponsible) > 1)
                throw new DomainException("Chỉ được đánh dấu tối đa 1 bước là \"người chịu trách nhiệm\".");

            var signingCount = 0;
            foreach (var item in request.Steps)
            {
                var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == item.JobTitleId && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    throw new DomainException($"Chức vụ '{jobTitle.Name}' là cấp duyệt cuối — cấu hình ở phần \"Cây duyệt Bộ phận\" (màn \"Cây duyệt\"), không thêm vào cây duyệt Nhóm.");
                if (item.RequiresSignature) signingCount++;
            }

            // Đúng 2 ô "Người đề nghị" cố định trên giấy in YEV-22-024 — mirror
            // DepartmentApprovalStepService.ReplaceAsync (trước 2026-08-08, cùng luật, dời nguyên
            // xuống đây vì cấp trung gian giờ chỉ còn tồn tại ở GroupApprovalStep).
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
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.GroupApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            return await GetByGroupAsync(groupId);
        }
    }
}
