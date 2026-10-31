using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Dtos.OtForms;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtFormService
    {
        // Date range is inclusive; office filters use group/department, production filters use line/team/shift team.
        Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null);

        Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null);

        // Sidebar badge: same "current step" filter as GetPendingApprovalsAsync, without paging.
        Task<int> GetPendingApprovalsCountAsync(string approverUserName);

        // Per-day pending counts for the batch-approval mini calendar.
        Task<List<PendingApprovalDateCountDto>> GetPendingApprovalDatesAsync(
            string approverUserName, DateOnly fromDate, DateOnly toDate);

        Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null);

        // Forms listing the user as an OT employee, regardless of who created or approved them.
        Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null);

        // Admin-only, gated by Attendance.OTForm.ViewAll.
        Task<PagedResponse<OtFormListItemDto>> GetAllFormsAsync(
            int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null);

        Task<OtFormDto> GetByIdAsync(int id);

        Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin);

        // Lets FE lock the Team/Line/Shift-team dropdowns for Line Leaders.
        Task<List<MyProductionCreateScopeItemDto>> GetMyProductionCreateScopesAsync(string userName, bool isAdmin);

        Task<List<int>> CheckOverlapAsync(CheckOtFormOverlapDto request);

        Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request);

        Task<OtFormDto> UpdateAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request);

        Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request);

        Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request);

        // Each form is processed independently; one failure doesn't abort the rest.
        Task<List<BulkOtFormActionResultItemDto>> BulkApproveAsync(
            string approverUserName, string? approverFullName, BulkApproveOtFormDto request);

        Task<List<BulkOtFormActionResultItemDto>> BulkRejectAsync(
            string approverUserName, string? approverFullName, BulkRejectOtFormDto request);

        // Anonymous: the token is the credential, so no second-factor password is required.
        Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request);

        // In-app path so current-step approvers (not only the creator) can remove employees.
        Task<OtFormDto> RemoveEmployeeAsync(int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request);

        // Soft-delete for permanently stuck forms; blocked once Completed because accumulation was already applied.
        Task DeleteAsync(int id, string deletedByUserName, string? deletedByFullName, DeleteOtFormDto request);

        // Anonymous email links: the token is the only credential.
        Task<OtFormDto> GetByEmailTokenAsync(string token);
        Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request);
        Task RejectByEmailTokenAsync(string token, RejectOtFormDto request);

        // Batch forms ("Don tong").
        Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(string userName, bool isAdmin, int pageIndex, int pageSize);
        Task<OtFormBatchDto> GetBatchByIdAsync(int id);
        Task<OtFormBatchDto> ProcessBatchAsync(int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request);
        Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token);
        Task<OtFormBatchDto> ProcessBatchByEmailTokenAsync(string token, ProcessOtFormBatchDto request);

        // Called by OtFormBatchBackgroundService (daily sweep, default 15:00).
        Task RunDailyBatchSweepAsync();
    }
}
