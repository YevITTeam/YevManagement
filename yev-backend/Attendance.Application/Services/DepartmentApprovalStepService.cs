using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý cây duyệt cấu hình tay theo từng Phòng ban (2026-08-06) — CHỈ chứa 3 cấp duyệt CUỐI
    // (Manager/Factory Manager/Director, JobTitle.TerminalLevel != None). 3 cấp trung gian dời sang
    // GroupApprovalStepService theo từng Nhóm (2026-08-08) — xem
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

            // CHỈ nhận Chức vụ cấp cuối (Manager/Factory Manager/Director) — cấp trung gian
            // (TerminalLevel=None) cấu hình ở phần "Cây duyệt Nhóm" (GroupApprovalStepService), không
            // còn được thêm vào đây nữa (2026-08-08).
            foreach (var item in request.Steps)
            {
                var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == item.JobTitleId && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel == (int)JobTitleTerminalLevel.None)
                    throw new DomainException($"Chức vụ '{jobTitle.Name}' là cấp trung gian — cấu hình ở phần \"Cây duyệt Nhóm\" (màn \"Cây duyệt\"), không thêm vào cây duyệt Bộ phận.");
            }

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
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.DepartmentApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            return await GetByDepartmentAsync(departmentId);
        }
    }
}
