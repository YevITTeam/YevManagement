using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Dtos.Departments;
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
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public DepartmentApprovalStepService(IAttendanceUnitOfWork unitOfWork, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _departmentAccessGuard = departmentAccessGuard;
        }

        // Admin xem/sửa được mọi Bộ phận; không phải Admin thì phải có tên trong
        // DepartmentApprovalStepCoordinators của ĐÚNG Bộ phận này (gán tay bởi Admin — xem
        // docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt"). KHÔNG suy
        // luận theo Chức vụ (Trưởng phòng không tự động có quyền — thực tế việc này thường giao cho
        // người khác phụ trách). Logic chuyển sang IDepartmentAccessGuard (2026-08-29) để dùng chung với
        // các tính năng khác cũng scope theo Phòng ban — xem docs/docs-be/attendance-module.md §Phân
        // quyền theo Phòng ban.
        public async Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId)
        {
            await _departmentAccessGuard.EnsureCanManageDepartmentAsync(userName, isAdmin, departmentId);
            return await GetByDepartmentCoreAsync(departmentId);
        }

        private async Task<List<DepartmentApprovalStepDto>> GetByDepartmentCoreAsync(int departmentId)
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

        public async Task<List<DepartmentApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceDepartmentApprovalStepsDto request)
        {
            await _departmentAccessGuard.EnsureCanManageDepartmentAsync(userName, isAdmin, departmentId);

            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            // CHỈ nhận Chức vụ cấp cuối (Manager/Factory Manager/Director) — cấp trung gian
            // (TerminalLevel=None) cấu hình ở phần "Cây duyệt Nhóm" (GroupApprovalStepService), không
            // còn được thêm vào đây nữa (2026-08-08).
            // Batch-fetch JobTitle theo Id thay vì query từng bước trong vòng lặp (2026-08-11).
            var jobTitleIds = request.Steps.Select(x => x.JobTitleId).ToHashSet();
            var jobTitlesById = (await _unitOfWork.JobTitles.FindAsync(x => jobTitleIds.Contains(x.Id) && !x.IsDeleted))
                .ToDictionary(x => x.Id);
            foreach (var item in request.Steps)
            {
                var jobTitle = jobTitlesById.GetValueOrDefault(item.JobTitleId);
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

            return await GetByDepartmentCoreAsync(departmentId);
        }

        public async Task<List<DepartmentDto>> GetMyManagedDepartmentsAsync(string userName, bool isAdmin)
        {
            if (isAdmin)
            {
                var all = await _unitOfWork.Departments.SelectAsync(
                    predicate: x => !x.IsDeleted,
                    selector: x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp });
                return all.OrderBy(x => x.DepartmentNameVn).ToList();
            }

            var myDepartmentIds = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.Employee.UserName == userName && !x.IsDeleted))
                .Select(x => x.DepartmentId)
                .ToHashSet();

            var items = await _unitOfWork.Departments.SelectAsync(
                predicate: x => !x.IsDeleted && myDepartmentIds.Contains(x.Id),
                selector: x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp });
            return items.OrderBy(x => x.DepartmentNameVn).ToList();
        }
    }
}
