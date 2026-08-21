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

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null);

        // Đếm nhanh cho badge sidebar FE — cùng logic lọc "bước hiện tại" với GetPendingApprovalsAsync
        // nhưng không phân trang/không map DTO (2026-08-19).
        Task<int> GetPendingApprovalsCountAsync(string approverUserName);

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

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, bool isAdmin, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request);

        // Loại 1 nhân viên khỏi đơn để duyệt được phần còn lại thay vì từ chối cả đơn — xem
        // docs/attendance-module.md § Loại nhân viên khỏi đơn.
        Task<OtFormDto> RemoveEmployeeAsync(int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request);

        // Kênh bổ sung qua email ([AllowAnonymous] ở Controller) — token tự nó là thông tin xác thực,
        // KHÔNG cần mật khẩu cấp 2 (khác Approve/Reject qua email vẫn giữ) — xem docs/attendance-module.md.
        Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request);

        // Admin xoá đơn kẹt vĩnh viễn (chuỗi duyệt thiếu candidate, không resolve lại được) — soft-delete,
        // chặn nếu đơn đã Completed (đã cộng lũy kế thật). Xem docs/attendance-module.md §Cây chức vụ.
        Task DeleteAsync(int id, string deletedByUserName, string? deletedByFullName, DeleteOtFormDto request);

        // Kênh bổ sung qua email (link Duyệt/Từ chối, [AllowAnonymous] ở Controller) — token tự nó
        // là thông tin xác thực duy nhất, xem docs/attendance-module.md.
        Task<OtFormDto> GetByEmailTokenAsync(string token);
        Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request);
        Task RejectByEmailTokenAsync(string token, RejectOtFormDto request);

        // === "Đơn tổng" — redesign xong theo Cây chức vụ (2026-08-07, Giai đoạn 3.2, xem
        // docs/attendance-module.md §Đơn tổng). ===
        Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(string userName, bool isAdmin, int pageIndex, int pageSize);
        Task<OtFormBatchDto> GetBatchByIdAsync(int id);
        Task<OtFormBatchDto> ProcessBatchAsync(int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request);
        Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token);
        Task<OtFormBatchDto> ProcessBatchByEmailTokenAsync(string token, ProcessOtFormBatchDto request);

        // Called by OtFormBatchBackgroundService (daily sweep, default 15:00).
        Task RunDailyBatchSweepAsync();
    }
}
