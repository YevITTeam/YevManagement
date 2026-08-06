using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Dtos.OtForms;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtFormService
    {
        // fromDate/toDate lọc theo OtForm.Date (bao gồm cả 2 đầu mút), status lọc theo đúng giá trị
        // OtFormStatus — cả 3 đều optional, dùng chung cho mọi tab danh sách (2026-08-06, xem
        // docs/attendance-module.md §Lọc danh sách đơn).
        Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        // Đơn Draft đang chờ CHÍNH mình (Trưởng nhóm) ký duyệt — tách riêng khỏi GetPendingApprovalsAsync
        // vì gate bằng permission Attendance.OTForm.Create, không phải .Approve.
        Task<PagedResponse<OtFormListItemDto>> GetPendingSubmissionsAsync(
            string currentUserName, bool isAdmin, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        // Lịch sử đơn CHÍNH mình đã Ký/Duyệt/Từ chối ở bất kỳ cấp nào — dùng chung cho cả 4 vai trò
        // (Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        // Đơn tôi CÓ TÊN trong danh sách nhân viên tăng ca (OtFormEmployee) — không nhất thiết là người
        // tạo/ký/duyệt. Dành cho mọi user (kể cả Role "Nhân viên"), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        Task<OtFormDto> GetByIdAsync(int id);

        // Scopes / Validations
        Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin);
        Task<List<int>> CheckOverlapAsync(CheckOtFormOverlapDto request);

        // Mutations
        Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request);

        // Trưởng nhóm ký duyệt "Người đề nghị" — chuyển đơn từ Draft sang Pending (chờ Trưởng phòng).
        Task<OtFormDto> ApproveSubmitterAsync(int id, string approverUserName, string? approverFullName, bool isAdmin, ApproveOtFormDto request);

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, bool isAdmin, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request);

        // Loại 1 nhân viên khỏi đơn để duyệt được phần còn lại thay vì từ chối cả đơn — xem
        // docs/attendance-module.md § Loại nhân viên khỏi đơn.
        Task<OtFormDto> RemoveEmployeeAsync(int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request);

        // Kênh bổ sung qua email ([AllowAnonymous] ở Controller) — token tự nó là thông tin xác thực,
        // KHÔNG cần mật khẩu cấp 2 (khác Approve/Reject qua email vẫn giữ) — xem docs/attendance-module.md.
        Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request);

        // Kênh bổ sung qua email (link Duyệt/Từ chối, [AllowAnonymous] ở Controller) — token tự nó
        // là thông tin xác thực duy nhất, xem docs/attendance-module.md.
        Task<OtFormDto> GetByEmailTokenAsync(string token);
        Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request);
        Task RejectByEmailTokenAsync(string token, RejectOtFormDto request);

        // === "Đơn tổng" — xem docs/attendance-module.md §Đơn tổng. ===
        Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(string userName, bool isAdmin, int pageIndex, int pageSize);
        Task<OtFormBatchDto> GetBatchByIdAsync(int id);
        Task<OtFormBatchDto> ProcessBatchAsync(int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request);
        Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token);
        Task<OtFormBatchDto> ProcessBatchByEmailTokenAsync(string token, ProcessOtFormBatchDto request);

        // Called by OtFormBatchBackgroundService (daily sweep, default 15:00).
        Task RunDailyBatchSweepAsync();
    }
}
