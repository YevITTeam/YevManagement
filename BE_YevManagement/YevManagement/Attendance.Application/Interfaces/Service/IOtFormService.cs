using Attendance.Application.Dtos.OtForms;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtFormService
    {
        Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(string userName, int pageIndex, int pageSize);

        // Đơn Draft đang chờ CHÍNH mình (Trưởng nhóm) ký duyệt — tách riêng khỏi GetPendingApprovalsAsync
        // vì gate bằng permission Attendance.OTForm.Create, không phải .Approve.
        Task<PagedResponse<OtFormListItemDto>> GetPendingSubmissionsAsync(
            string currentUserName, bool isAdmin, int pageIndex, int pageSize);

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, bool isGeneralDirector, int pageIndex, int pageSize);

        // Lịch sử đơn CHÍNH mình đã Ký/Duyệt/Từ chối ở bất kỳ cấp nào — dùng chung cho cả 4 vai trò
        // (Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(string userName, int pageIndex, int pageSize);

        // Đơn tôi CÓ TÊN trong danh sách nhân viên tăng ca (OtFormEmployee) — không nhất thiết là người
        // tạo/ký/duyệt. Dành cho mọi user (kể cả Role "Nhân viên"), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(string userName, int pageIndex, int pageSize);

        Task<OtFormDto> GetByIdAsync(int id);

        // (Các) Group mà người gọi được phép tạo đơn — FE dùng để tự điền sẵn Bộ phận/Phòng ban trên
        // màn "Tạo đơn tăng ca" thay vì bắt chọn từ toàn bộ danh sách. Admin trả về rỗng (không giới hạn).
        Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin);

        Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request);

        // Trưởng nhóm ký duyệt "Người đề nghị" — chuyển đơn từ Draft sang Pending (chờ Trưởng phòng).
        Task<OtFormDto> ApproveSubmitterAsync(int id, string approverUserName, string? approverFullName, bool isAdmin, ApproveOtFormDto request);

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, bool isAdmin, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, RejectOtFormDto request);

        // Kênh bổ sung qua email (link Duyệt/Từ chối, [AllowAnonymous] ở Controller) — token tự nó
        // là thông tin xác thực duy nhất, xem docs/attendance-module.md.
        Task<OtFormDto> GetByEmailTokenAsync(string token);
        Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request);
        Task RejectByEmailTokenAsync(string token, RejectOtFormDto request);
    }
}
