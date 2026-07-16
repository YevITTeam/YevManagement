using Attendance.Application.Dtos.OtForms;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtFormService
    {
        Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(string userName, int pageIndex, int pageSize);

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, bool isGeneralDirector, int pageIndex, int pageSize);

        Task<OtFormDto> GetByIdAsync(int id);

        Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request);

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, RejectOtFormDto request);

        // Kênh bổ sung qua email (link Duyệt/Từ chối, [AllowAnonymous] ở Controller) — token tự nó
        // là thông tin xác thực duy nhất, xem docs/attendance-module.md.
        Task<OtFormDto> GetByEmailTokenAsync(string token);
        Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request);
        Task RejectByEmailTokenAsync(string token, RejectOtFormDto request);
    }
}
