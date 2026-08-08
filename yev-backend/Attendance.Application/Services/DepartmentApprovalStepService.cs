using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý cây duyệt cấu hình tay theo từng Phòng ban (2026-08-06) — xem
    // docs/docs-be/attendance-module.md §Cây chức vụ. Không có Create/Update/Delete từng dòng riêng lẻ,
    // chỉ thay NGUYÊN danh sách 1 lần (khớp UI kiểu "sắp xếp rồi Lưu").
    public class DepartmentApprovalStepService : BaseService<IAttendanceUnitOfWork>, IDepartmentApprovalStepService
    {
        public DepartmentApprovalStepService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(int departmentId)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            var steps = await _unitOfWork.DepartmentApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new DepartmentApprovalStepDto
                {
                    Id = x.Id,
                    DepartmentId = x.DepartmentId,
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

        public async Task<List<DepartmentApprovalStepDto>> ReplaceAsync(int departmentId, ReplaceDepartmentApprovalStepsDto request)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            if (request.Steps.Count(x => x.IsResponsible) > 1)
                throw new DomainException("Chỉ được đánh dấu tối đa 1 bước là \"người chịu trách nhiệm\".");

            var intermediateCount = 0;
            foreach (var item in request.Steps)
            {
                var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == item.JobTitleId && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel == (int)JobTitleTerminalLevel.None) intermediateCount++;
            }

            // Tối đa 2 bước trung gian (TerminalLevel=None, dưới cấp Trưởng phòng) — chốt theo yêu cầu
            // người dùng (2026-08-08, Giai đoạn 3.2): khớp đúng 2 ô "Người đề nghị" cố định trên giấy in
            // YEV-22-024 (xem OtFormPrintView.tsx), không có chỗ cho ô thứ 3 trên ảnh nền.
            if (intermediateCount > 2)
                throw new DomainException("Chỉ được cấu hình tối đa 2 bước dưới cấp Trưởng phòng (khớp 2 ô \"Người đề nghị\" trên giấy in).");

            var existing = await _unitOfWork.DepartmentApprovalSteps.FindAsync(x => x.DepartmentId == departmentId && !x.IsDeleted);
            foreach (var step in existing)
            {
                _unitOfWork.DepartmentApprovalSteps.Delete(step);
            }

            var newSteps = request.Steps
                .Select((item, index) => new DepartmentApprovalStep
                {
                    DepartmentId = departmentId,
                    StepOrder = index + 1,
                    JobTitleId = item.JobTitleId,
                    RequiresSignature = item.RequiresSignature,
                    IsResponsible = item.IsResponsible,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.DepartmentApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            return await GetByDepartmentAsync(departmentId);
        }
    }
}
