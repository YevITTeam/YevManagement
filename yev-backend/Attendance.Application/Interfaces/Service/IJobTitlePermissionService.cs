using Attendance.Application.Dtos.JobTitlePermissions;

namespace Attendance.Application.Interfaces.Service
{
    public interface IJobTitlePermissionService
    {
        Task<List<JobTitlePermissionDto>> GetByJobTitleAsync(int jobTitleId);

        // Thay nguyên danh sách + đồng bộ NGAY quyền Identity cho mọi Employee đang giữ Chức vụ này
        // (có UserName) — xem JobTitlePermissionService.ReplaceAsync.
        Task<List<JobTitlePermissionDto>> ReplaceAsync(int jobTitleId, ReplaceJobTitlePermissionsDto request);

        // Danh sách permission code được PHÉP chọn (nhóm "tham gia quy trình") — FE dùng để lọc UI,
        // tránh hiển thị permission quản trị vào màn cấu hình này.
        List<string> GetAllowedPermissionCodes();
    }
}
