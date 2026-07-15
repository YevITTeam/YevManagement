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

        Task<OtFormDto> CreateAsync(string createdByUserName, CreateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, bool isGeneralDirector, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, bool isGeneralDirector, RejectOtFormDto request);
    }
}
