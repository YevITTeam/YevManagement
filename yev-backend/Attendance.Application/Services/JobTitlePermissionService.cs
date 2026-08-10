using Attendance.Application.Dtos.JobTitlePermissions;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý mapping Chức vụ -> permission Identity tự động cấp (2026-08-10) — quản lý kiểu "thay
    // nguyên danh sách" (mirror GroupApprovalStepService), không có Create/Update/Delete từng dòng
    // riêng. Xem docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ".
    public class JobTitlePermissionService : BaseService<IAttendanceUnitOfWork>, IJobTitlePermissionService
    {
        private readonly IUserDirectoryService _userDirectoryService;

        public JobTitlePermissionService(IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
        }

        public List<string> GetAllowedPermissionCodes() => JobTitlePermissionWhitelist.AllowedCodes.OrderBy(x => x).ToList();

        public async Task<List<JobTitlePermissionDto>> GetByJobTitleAsync(int jobTitleId)
        {
            var jobTitle = await _unitOfWork.JobTitles.GetByIdAsync(jobTitleId);
            jobTitle.OrThrowNotFound("Chức vụ", jobTitleId);

            var items = await _unitOfWork.JobTitlePermissions.FindAsync(x => x.JobTitleId == jobTitleId && !x.IsDeleted);
            return items
                .OrderBy(x => x.PermissionCode)
                .Select(x => new JobTitlePermissionDto
                {
                    Id = x.Id,
                    JobTitleId = x.JobTitleId,
                    PermissionCode = x.PermissionCode
                }).ToList();
        }

        public async Task<List<JobTitlePermissionDto>> ReplaceAsync(int jobTitleId, ReplaceJobTitlePermissionsDto request)
        {
            var jobTitle = await _unitOfWork.JobTitles.GetByIdAsync(jobTitleId);
            jobTitle.OrThrowNotFound("Chức vụ", jobTitleId);

            var codes = request.PermissionCodes.Distinct().ToList();
            var invalidCodes = codes.Where(c => !JobTitlePermissionWhitelist.AllowedCodes.Contains(c)).ToList();
            if (invalidCodes.Count > 0)
                throw new DomainException(
                    $"Permission '{string.Join(", ", invalidCodes)}' không thuộc nhóm được phép tự động cấp theo Chức vụ.");

            var existing = await _unitOfWork.JobTitlePermissions.FindAsync(x => x.JobTitleId == jobTitleId && !x.IsDeleted);
            foreach (var item in existing)
            {
                _unitOfWork.JobTitlePermissions.Delete(item);
            }

            var newItems = codes
                .Select(code => new JobTitlePermission
                {
                    JobTitleId = jobTitleId,
                    PermissionCode = code,
                    IsDeleted = false
                }).ToList();

            await _unitOfWork.JobTitlePermissions.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            // Sửa mapping có hiệu lực NGAY cho mọi nhân viên đang giữ đúng Chức vụ này (có UserName) —
            // không cần đợi ai đó động vào Employee của từng người mới đồng bộ lại.
            var employees = await _unitOfWork.Employees.FindAsync(x => x.JobTitleId == jobTitleId && !x.IsDeleted && x.UserName != null);
            foreach (var employee in employees)
            {
                await _userDirectoryService.SyncAutoGrantedPermissionsAsync(employee.UserName, codes);
            }

            return await GetByJobTitleAsync(jobTitleId);
        }
    }
}
