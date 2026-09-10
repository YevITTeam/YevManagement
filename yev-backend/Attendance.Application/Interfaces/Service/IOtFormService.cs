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
        // groupId/departmentId lọc đơn văn phòng; productionLineId/productionTeamId/productionShiftTeamId
        // lọc đơn dưới chuyền — cả 5 field đều optional, dùng chung cho mọi tab danh sách (2026-09-04,
        // trước đây chỉ GetPendingApprovalsAsync có 3 field production, riêng office chưa tab nào có).
        Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null);

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null);

        // Đếm nhanh cho badge sidebar FE — cùng logic lọc "bước hiện tại" với GetPendingApprovalsAsync
        // nhưng không phân trang/không map DTO (2026-08-19).
        Task<int> GetPendingApprovalsCountAsync(string approverUserName);

        // Số đơn chưa duyệt (candidate bước hiện tại) theo TỪNG ngày, trong khoảng fromDate..toDate —
        // phục vụ lịch mini ở màn Duyệt hàng loạt (2026-09-04, xem docs/attendance-module.md §Nâng cấp
        // màn Duyệt hàng loạt). Cùng scoping GetMyCurrentPendingFormIdsAsync với GetPendingApprovalsAsync.
        Task<List<PendingApprovalDateCountDto>> GetPendingApprovalDatesAsync(
            string approverUserName, DateOnly fromDate, DateOnly toDate);

        // Lịch sử đơn CHÍNH mình đã Ký/Duyệt/Từ chối ở bất kỳ cấp nào — dùng chung cho cả 4 vai trò
        // (Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null);

        // Đơn tôi CÓ TÊN trong danh sách nhân viên tăng ca (OtFormEmployee) — không nhất thiết là người
        // tạo/ký/duyệt. Dành cho mọi user (kể cả Role "Nhân viên"), gate bằng Attendance.OTForm.View.
        Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null);

        // "Tất cả đơn" — Admin xem/quản lý toàn bộ đơn, không lọc theo user gọi API. Gate bằng
        // Attendance.OTForm.ViewAll (Admin-only, 2026-09-04, xem migration AddOtFormViewAllPermission).
        Task<PagedResponse<OtFormListItemDto>> GetAllFormsAsync(
            int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null);

        Task<OtFormDto> GetByIdAsync(int id);

        // Scopes / Validations
        Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin);
        Task<List<int>> CheckOverlapAsync(CheckOtFormOverlapDto request);

        // Mutations
        Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request);

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request);

        // Ký/Từ chối hàng loạt (Team Leader/Trưởng phòng — nhiều Group Leader/Team Leader bên dưới,
        // 2026-08-27). Lặp gọi lại ApproveAsync/RejectAsync đơn lẻ cho từng OtFormId, từng đơn độc lập
        // (1 đơn lỗi không huỷ các đơn còn lại) — xem BulkApproveOtFormDto/BulkRejectOtFormDto.
        Task<List<BulkOtFormActionResultItemDto>> BulkApproveAsync(
            string approverUserName, string? approverFullName, BulkApproveOtFormDto request);

        Task<List<BulkOtFormActionResultItemDto>> BulkRejectAsync(
            string approverUserName, string? approverFullName, BulkRejectOtFormDto request);

        // Kênh bổ sung qua email ([AllowAnonymous] ở Controller) — token tự nó là thông tin xác thực,
        // KHÔNG cần mật khẩu cấp 2 (khác Approve/Reject qua email vẫn giữ) — xem docs/attendance-module.md.
        // Kênh trong-app (thêm/loại nhân viên) đã gộp vào UpdateAsync (2026-09-04) — xem
        // docs/attendance-module.md §Gộp thêm/xóa NV vào Sửa đơn.
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

        // Gọi bởi QueuedHostedService (chạy nền, ngoài request Create/Approve) — tự tải lại OtForm +
        // OtFormApprovalStep (kèm Candidates) theo Id vì scope DI của request đã bị dispose lúc hàm
        // này chạy, không thể tái sử dụng entity đã load trong CreateAsync/ApproveAsync. Xem
        // docs/attendance-module.md "Gửi email duyệt chạy nền".
        Task SendStepApprovalNotificationAsync(int otFormId, int otFormApprovalStepId);
    }
}
