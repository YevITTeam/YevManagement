using System.Linq.Expressions;
using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class OtFormService : BaseService<IAttendanceUnitOfWork>, IOtFormService
    {
        // Ngưỡng giờ OT để nhận PHIẾU CHÍNH giờ đọc từ AttendanceSetting (Admin sửa được), không còn
        // hardcode 2h nữa — xem docs/attendance-module.md §Cấu hình phiếu ăn & giới hạn lũy kế.

        // Much longer than the PendingSignatureConfirmation expiry — superiors (Department Manager/
        // Workshop Manager/General Director) rarely open the app/mailbox right away, so they need
        // enough time to process it (see docs/attendance-module.md).
        private const int EmailApprovalTokenExpiryDays = 3;

        // Shared by all list endpoints (my-forms/pending-submissions/pending-approvals/
        // my-actions/my-participations) — avoids repeating the same Select block in 5 places. EF Core
        // automatically translates OtFormApprovalHistories (navigation collection, see OtForm.cs) into
        // a subquery, no separate .Include() needed (see docs/attendance-module.md).
        private static readonly Expression<Func<OtForm, OtFormListItemDto>> ToListItemDto = x => new OtFormListItemDto
        {
            Id = x.Id,
            GroupNameVn = x.Group.GroupNameVn,
            GroupNameJp = x.Group.GroupNameJp,
            DepartmentNameVn = x.Department.DepartmentNameVn,
            DepartmentNameJp = x.Department.DepartmentNameJp,
            OtCaseCode = x.OtCase.Code,
            Date = x.Date,
            TotalHour = x.TotalHour,
            NumberOfEmployee = x.NumberOfEmployee,
            CreatedByUserName = x.CreatedByUserName,
            CreatedByFullName = x.CreatedByFullName,
            Status = x.Status,
            IsEditable = x.Status == (int)OtFormStatus.Draft || x.Status == (int)OtFormStatus.PendingGroupHead || x.Status == (int)OtFormStatus.Pending,
            ApprovalSummary = x.OtFormApprovalHistories
                .OrderBy(h => h.ActionAt)
                .Select(h => new ApprovalSummaryItemDto
                {
                    ApprovalLevel = h.ApprovalLevel,
                    ApproverUserName = h.ApproverUserName,
                    ApproverFullName = h.ApproverFullName,
                    Action = h.Action,
                    ActionAt = h.ActionAt
                }).ToList()
        };

        // Shared by GetBatchesAsync — FormCount/EmployeeCount/TotalHour only count member forms still
        // Status==Pending (still waiting on THIS batch); a form resolved individually outside the batch
        // flow no longer counts (see docs/attendance-module.md — §Đơn tổng).
        private static readonly Expression<Func<OtFormBatch, OtFormBatchListItemDto>> ToBatchListItemDto = b => new OtFormBatchListItemDto
        {
            Id = b.Id,
            DepartmentId = b.DepartmentId,
            DepartmentNameVn = b.Department.DepartmentNameVn,
            DepartmentNameJp = b.Department.DepartmentNameJp,
            BatchDate = b.BatchDate,
            Status = b.Status,
            FormCount = b.OtForms.Count(f => !f.IsDeleted && f.Status == (int)OtFormStatus.Pending),
            EmployeeCount = b.OtForms.Where(f => !f.IsDeleted && f.Status == (int)OtFormStatus.Pending).Sum(f => (int?)f.NumberOfEmployee) ?? 0,
            TotalHour = b.OtForms.Where(f => !f.IsDeleted && f.Status == (int)OtFormStatus.Pending).Sum(f => (decimal?)f.TotalHour) ?? 0,
            CreatedAt = b.CreatedAt,
            ProcessedAt = b.ProcessedAt,
            ProcessedByFullName = b.ProcessedByFullName
        };

        // Lọc chung cho cả 5 endpoint danh sách đơn (my-forms/pending-submissions/pending-approvals/
        // my-actions/my-participations) — fromDate/toDate theo OtForm.Date (bao gồm 2 đầu mút), status
        // theo đúng giá trị OtFormStatus, cả 3 đều optional (2026-08-06).
        private static IQueryable<OtForm> ApplyListFilters(IQueryable<OtForm> query, DateOnly? fromDate, DateOnly? toDate, int? status)
        {
            if (fromDate.HasValue) query = query.Where(x => x.Date >= fromDate.Value);
            if (toDate.HasValue) query = query.Where(x => x.Date <= toDate.Value);
            if (status.HasValue) query = query.Where(x => x.Status == status.Value);
            return query;
        }

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;
        private readonly ISecondaryPasswordService _secondaryPasswordService;
        private readonly IAttendanceSettingService _attendanceSettingService;

        public OtFormService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration,
            ISecondaryPasswordService secondaryPasswordService,
            IAttendanceSettingService attendanceSettingService) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
            _secondaryPasswordService = secondaryPasswordService;
            _attendanceSettingService = attendanceSettingService;
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.CreatedByUserName == userName);
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
        }

        // Draft forms awaiting sign-off from the CURRENT user (Team Leader) — a separate endpoint,
        // gated by Attendance.OTForm.Create (not .Approve, since the Team Leader role does not have
        // the Approve permission — see docs/attendance-module.md §Form creator DIFFERENT from Team Leader).
        public async Task<PagedResponse<OtFormListItemDto>> GetPendingSubmissionsAsync(
            string currentUserName, bool isAdmin, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            List<int> submitterDepartmentIds = new();
            List<int> submitterGroupIds = new();

            if (!isAdmin)
            {
                var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == currentUserName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

                submitterDepartmentIds = scopes.Where(s => s.ScopeType == (int)ScopeType.Department).Select(s => s.ScopeId).ToList();
                submitterGroupIds = scopes.Where(s => s.ScopeType == (int)ScopeType.Group).Select(s => s.ScopeId).ToList();
            }

            var draftQuery = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.Draft &&
                    (isAdmin || submitterDepartmentIds.Contains(x.DepartmentId) || submitterGroupIds.Contains(x.GroupId)));
            draftQuery = ApplyListFilters(draftQuery, fromDate, toDate, status).OrderBy(x => x.Date);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(draftQuery, pageIndex, pageSize, ToListItemDto);
        }

        // History of forms the CURRENT user has processed (Signed/Approved/Rejected) at ANY level
        // (Submitter/DepartmentManager/WorkshopManager/GeneralDirector) — shared by all 4 roles since
        // they all already have the Attendance.OTForm.View permission. Previously there was no way to
        // look this up: `my-forms` only filters by the form CREATOR (not the signer/approver), while
        // `pending-submissions`/`pending-approvals` only show forms NOT YET processed — a form that was
        // just processed instantly disappears from those 2 lists (see docs/attendance-module.md).
        public async Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var actedFormIds = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => h.ApproverUserName == userName, h => h.OtFormId);
            var distinctFormIds = actedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
        }

        // Forms I am LISTED on in the OT employee list (OtFormEmployee) — not necessarily the person
        // who created/signed/approved that form. Available to every Attendance user (including Role
        // "Nhân viên", only needs OTForm.View), derived via Employee.UserName linked to the calling
        // account (2026-07-17, see docs/attendance-module.md).
        public async Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (employee == null)
                return new PagedResponse<OtFormListItemDto>(new List<OtFormListItemDto>(), 0, pageIndex, pageSize);

            var participatedFormIds = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.EmployeeId == employee.Id, x => x.OtFormId);
            var distinctFormIds = participatedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x => !x.IsDeleted && x.UserName == approverUserName);

            // GeneralDirector's scope is always ScopeType.All (company-wide, no Department/Group to
            // match against) — a data-driven replacement for the old User.IsInRole(GeneralDirectorRole)
            // bypass (removed 2026-08-05, see docs/attendance-module.md).
            var isGeneralDirectorApprover = scopes.Any(s => s.ApprovalLevel == (int)ApprovalLevel.GeneralDirector);

            // GroupHead (Trưởng Bộ phận, new as of 2026-07-17) — an intermediate level between Team
            // Leader and Department Manager, using the same Group/Department scope mechanism as
            // DepartmentManager/WorkshopManager below.
            var groupHeadDepartmentIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.GroupHead && s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            var groupHeadGroupIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.GroupHead && s.ScopeType == (int)ScopeType.Group)
                .Select(s => s.ScopeId).ToList();

            var deptManagerDepartmentIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.DepartmentManager && s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            var deptManagerGroupIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.DepartmentManager && s.ScopeType == (int)ScopeType.Group)
                .Select(s => s.ScopeId).ToList();
            var workshopManagerDepartmentIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.WorkshopManager && s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            var workshopManagerGroupIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.WorkshopManager && s.ScopeType == (int)ScopeType.Group)
                .Select(s => s.ScopeId).ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && (
                    (x.Status == (int)OtFormStatus.PendingGroupHead &&
                        (groupHeadDepartmentIds.Contains(x.DepartmentId) || groupHeadGroupIds.Contains(x.GroupId))) ||
                    (x.Status == (int)OtFormStatus.Pending &&
                        (deptManagerDepartmentIds.Contains(x.DepartmentId) || deptManagerGroupIds.Contains(x.GroupId))) ||
                    (x.Status == (int)OtFormStatus.ApprovedByDepartment &&
                        (workshopManagerDepartmentIds.Contains(x.DepartmentId) || workshopManagerGroupIds.Contains(x.GroupId))) ||
                    (isGeneralDirectorApprover && x.Status == (int)OtFormStatus.ApprovedByWorkshop)
                ));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderBy(x => x.Date);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
        }

        public async Task<OtFormDto> GetByIdAsync(int id)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.Group, x => x.Department, x => x.Reason, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var employees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == id, x => x.Employee);

            var processPart = await _unitOfWork.ProcessParts.FirstOrDefaultAsync(x => x.OtFormId == id);

            var histories = await _unitOfWork.OtFormApprovalHistories.FindAsync(x => x.OtFormId == id);

            // Ngưỡng "đủ điều kiện phiếu chính" đọc từ cấu hình (Admin sửa được) thay vì hardcode.
            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

            return new OtFormDto
            {
                Id = otForm!.Id,
                GroupId = otForm.GroupId,
                GroupNameVn = otForm.Group.GroupNameVn,
                GroupNameJp = otForm.Group.GroupNameJp,
                DepartmentId = otForm.DepartmentId,
                DepartmentNameVn = otForm.Department.DepartmentNameVn,
                DepartmentNameJp = otForm.Department.DepartmentNameJp,
                ReasonId = otForm.ReasonId,
                ReasonNameVn = otForm.Reason.ReasonNameVn,
                ReasonNameJp = otForm.Reason.ReasonNameJp,
                OtCaseId = otForm.OtCaseId,
                OtCaseCode = otForm.OtCase.Code,
                StartTime = otForm.StartTime,
                EndTime = otForm.EndTime,
                SubReason = otForm.SubReason,
                TotalHour = otForm.TotalHour,
                Date = otForm.Date,
                NumberOfEmployee = otForm.NumberOfEmployee,
                CreatedByUserName = otForm.CreatedByUserName,
                CreatedByFullName = otForm.CreatedByFullName,
                RequesterEmployeeId = otForm.RequesterEmployeeId,
                RequesterFullName = otForm.RequesterFullName,
                RequesterUserName = otForm.RequesterUserName,
                ResponsibleEmployeeId = otForm.ResponsibleEmployeeId,
                ResponsibleFullName = otForm.ResponsibleFullName,
                ResponsibleUserName = otForm.ResponsibleUserName,
                Status = otForm.Status,
                IsEditable = IsEditableStatus(otForm.Status),
                Employees = employees.Select(x => new OtFormEmployeeDto
                {
                    EmployeeId = x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    FullName = $"{x.Employee.LastName} {x.Employee.FirstName}",
                    StartTime = x.StartTime,
                    EndTime = x.EndTime,
                    NoteVn = x.NoteVn,
                    NoteJp = x.NoteJp,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    // >= (không phải >) — "tăng ca TỪ 2h30 mới có phiếu chính" (chốt 2026-08-01), đúng
                    // mốc 2h30 vẫn được tính. Người dưới mốc này nhận phiếu phụ, không phải không có gì.
                    IsEligibleForMeal = (decimal)(x.EndTime - x.StartTime).TotalHours >= mainMealTicketMinHours,
                    DidEat = x.DidEat,
                    // Employees dropped by an approver are returned here TOO (not filtered out) so the
                    // detail screen can show who was dropped, by whom and why — the FE hides them from
                    // the printed form (see docs/attendance-module.md — Loại nhân viên khỏi đơn).
                    IsRemoved = x.IsRemoved,
                    RemovedByUserName = x.RemovedByUserName,
                    RemovedByFullName = x.RemovedByFullName,
                    RemovedAtLevel = x.RemovedAtLevel,
                    RemovedAt = x.RemovedAt,
                    RemoveReason = x.RemoveReason
                }).ToList(),
                ProcessPart = processPart == null ? null : new ProcessPartDto
                {
                    IsEat = processPart.IsEat,
                    MainTicketCount = processPart.MainTicketCount,
                    SecondaryTicketCount = processPart.SecondaryTicketCount,
                    MilkCount = processPart.MilkCount,
                    IsTransportation = processPart.IsTransportation,
                    IsUseCopyRoom = processPart.IsUseCopyRoom,
                    AnotherSuggestionVn = processPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = processPart.AnotherSuggestionJp
                },
                ApprovalHistories = histories
                    .OrderBy(x => x.ActionAt)
                    .Select(x => new OtFormApprovalHistoryDto
                    {
                        ApproverUserName = x.ApproverUserName,
                        ApproverFullName = x.ApproverFullName,
                        ApprovalLevel = x.ApprovalLevel,
                        Action = x.Action,
                        Comment = x.Comment,
                        HasSignature = x.SignatureImage != null,
                        SignatureImage = x.SignatureImage,
                        ActionAt = x.ActionAt
                    }).ToList()
            };
        }

        public async Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", request.GroupId);

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            if (group!.DepartmentId != request.DepartmentId)
                throw new DomainException($"Nhóm '{group.GroupNameVn}' không thuộc Bộ phận đã chọn.");

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            // Form-creation scope — ALLOWS 2 independent paths (2026-07-17, separating "create form" from
            // "Team Leader sign-off" per requirement, see docs/attendance-module.md):
            //   1. Team Leader (or anyone the Admin assigned a UserApprovalScope(Submitter) matching
            //      Group/Department) — the old mechanism, unchanged. This group can ALSO later sign as
            //      "Requester" via /submit.
            //   2. Role "Nhân viên" (only has OTForm.Create, has NO UserApprovalScope) — can create a
            //      form for THEIR OWN Group only, derived from Employee.GroupId via Employee.UserName
            //      linked to the calling account. This group CANNOT sign, because ApproveSubmitterAsync
            //      still only accepts UserApprovalScope(Submitter), not Employee.GroupId.
            // Admin bypasses both paths, same as GeneralDirector bypassing during approval.
            await EnsureCanCreateOrEditForScopeAsync(createdByUserName, isAdmin, request.GroupId, request.DepartmentId);

            var validatedEmployees = await ValidateEmployeesAsync(request.GroupId, request.StartTime, request.EndTime, request.Employees);
            var employeeById = validatedEmployees.ToDictionary(x => x.Id);

            // Kiểm tra trùng giờ tăng ca — 1 nhân viên không được xuất hiện trong 2 đơn tăng ca có
            // giờ chồng chéo trong cùng 1 ngày (chốt 2026-08-06). Chỉ xét các đơn chưa bị xóa và
            // chưa bị từ chối (Rejected) — đơn Rejected đã trả lũy kế và không còn hiệu lực nữa.
            var employeeEndTimes = request.Employees.ToDictionary(x => x.EmployeeId, x => x.EndTime);
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, request.StartTime, employeeEndTimes, excludeFormId: null);

            // Lấy thông tin Requester & Responsible mặc định từ Group nếu không truyền từ client
            int? requesterEmpId = request.RequesterEmployeeId ?? group.RequesterEmployeeId;
            int? responsibleEmpId = request.ResponsibleEmployeeId ?? group.ResponsibleEmployeeId;

            string? requesterFullName = null;
            string? requesterUserName = null;
            if (requesterEmpId.HasValue)
            {
                var reqEmp = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == requesterEmpId.Value);
                if (reqEmp != null)
                {
                    requesterFullName = $"{reqEmp.LastName} {reqEmp.FirstName}";
                    requesterUserName = reqEmp.UserName;
                }
            }

            string? responsibleFullName = null;
            string? responsibleUserName = null;
            if (responsibleEmpId.HasValue)
            {
                var respEmp = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == responsibleEmpId.Value);
                if (respEmp != null)
                {
                    responsibleFullName = $"{respEmp.LastName} {respEmp.FirstName}";
                    responsibleUserName = respEmp.UserName;
                }
            }

            var newOtForm = new OtForm
            {
                GroupId = request.GroupId,
                DepartmentId = request.DepartmentId,
                ReasonId = request.ReasonId,
                OtCaseId = request.OtCaseId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                SubReason = request.SubReason,
                TotalHour = request.TotalHour,
                Date = request.Date,
                NumberOfEmployee = request.Employees.Count,
                CreatedByUserName = createdByUserName,
                CreatedByFullName = createdByFullName,
                RequesterEmployeeId = requesterEmpId,
                RequesterFullName = requesterFullName,
                RequesterUserName = requesterUserName,
                ResponsibleEmployeeId = responsibleEmpId,
                ResponsibleFullName = responsibleFullName,
                ResponsibleUserName = responsibleUserName,
                // Just a Draft — DOES NOT YET have the "Requester" signature. The Team Leader must call
                // POST /{id}/submit to sign it before the form moves to Pending (awaiting Department
                // Manager) (see docs/attendance-module.md — the form creator differs from the signer).
                Status = (int)OtFormStatus.Draft,
                IsDeleted = false
            };

            await _unitOfWork.OtForms.AddAsync(newOtForm);

            // Đơn mới luôn ở trạng thái chưa duyệt (Draft) — reserve ngay giờ OT dự kiến của từng người
            // vào lũy kế dự kiến (xem docs/attendance-module.md — Lũy kế dự kiến), để đơn khác tạo sau
            // cho cùng người này thấy được cảnh báo dù đơn này chưa ai duyệt.
            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

            foreach (var item in request.Employees)
            {
                var employee = employeeById[item.EmployeeId];

                ApplyProjectedRollover(employee, request.Date);
                // Snapshot dự kiến TRƯỚC khi cộng chính đơn này — see OtFormEmployee.MonthToDate/YearToDate.
                var projectedMonthBefore = employee.ProjectedMonthToDate;
                var projectedYearBefore = employee.ProjectedYearToDate;

                var hours = CalculateOtHours(request.StartTime, item.EndTime, item.DidEat, mainMealTicketMinHours);
                employee.ProjectedMonthToDate += hours;
                employee.ProjectedYearToDate += hours;
                _unitOfWork.Employees.Update(employee);

                await _unitOfWork.OtFormEmployees.AddAsync(new OtFormEmployee
                {
                    OtForm = newOtForm,
                    EmployeeId = item.EmployeeId,
                    StartTime = request.StartTime,
                    EndTime = item.EndTime,
                    DidEat = item.DidEat,
                    NoteVn = item.NoteVn,
                    NoteJp = item.NoteJp,
                    MonthToDate = projectedMonthBefore,
                    YearToDate = projectedYearBefore
                });
            }

            if (request.ProcessPart != null)
            {
                await _unitOfWork.ProcessParts.AddAsync(new ProcessPart
                {
                    OtForm = newOtForm,
                    IsEat = request.ProcessPart.IsEat,
                    MainTicketCount = request.ProcessPart.MainTicketCount,
                    SecondaryTicketCount = request.ProcessPart.SecondaryTicketCount,
                    MilkCount = request.ProcessPart.MilkCount,
                    IsTransportation = request.ProcessPart.IsTransportation,
                    IsUseCopyRoom = request.ProcessPart.IsUseCopyRoom,
                    AnotherSuggestionVn = request.ProcessPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = request.ProcessPart.AnotherSuggestionJp
                });
            }

            await _unitOfWork.SaveChangesAsync();

            // New form is in Draft status, needs Team Leader sign-off first (POST /{id}/submit) —
            // send an email with an Approve/Reject link to everyone eligible (a supplementary channel,
            // not a replacement for the button in the app).
            await NotifyEligibleApproversAsync(newOtForm, ApprovalLevel.Submitter);

            return await GetByIdAsync(newOtForm.Id);
        }

        // Shared by CreateAsync and UpdateAsync — a non-Admin user may only create/edit a form for the
        // exact Group/Department they have a matching UserApprovalScope(Submitter) for, OR their own
        // Group via Employee.GroupId (Role "Nhân viên"). UpdateAsync MUST call this again with the NEW
        // GroupId/DepartmentId from the request — otherwise a "Nhân viên" who validly created a form for
        // their own Group could then call PUT to change it to a different Group/Department (outside
        // their allowed scope) and slip through, because UpdateAsync previously only checked
        // `createdByUserName == currentUserName` without re-checking the Group/Department scope.
        private async Task EnsureCanCreateOrEditForScopeAsync(string userName, bool isAdmin, int groupId, int departmentId)
        {
            if (isAdmin) return;

            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.UserName == userName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

            var authorizedViaScope = scopes.Any(s =>
                (s.ScopeType == (int)ScopeType.Department && s.ScopeId == departmentId) ||
                (s.ScopeType == (int)ScopeType.Group && s.ScopeId == groupId));

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x =>
                x.UserName == userName && !x.IsDeleted);
            var authorizedViaOwnGroup = callerEmployee != null && callerEmployee.GroupId == groupId;

            if (!authorizedViaScope && !authorizedViaOwnGroup)
                throw new DomainException("Bạn không được phân quyền tạo/sửa đơn cho nhóm/bộ phận này. Liên hệ Admin để được gán qua UserApprovalScope (ApprovalLevel=Submitter), hoặc kiểm tra tài khoản đã liên kết đúng nhân viên/nhóm chưa.");
        }

        // Returns the Group(s) the caller is allowed to create forms for — so the FE can pre-fill the
        // Group/Department on the "Create OT form" screen instead of forcing Employee/Team Leader to
        // pick from the full list (they can only create for this exact scope anyway, see
        // EnsureCanCreateOrEditForScopeAsync — same 2 data sources, just querying in the opposite
        // direction). Returns empty for Admin — FE keeps the old free-choice dropdown since Admin isn't
        // restricted to any scope (2026-07-17).
        public async Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin)
        {
            if (isAdmin) return new List<MyCreateScopeItemDto>();

            var groupIds = new HashSet<int>();

            var submitterScopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.UserName == userName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

            foreach (var s in submitterScopes.Where(s => s.ScopeType == (int)ScopeType.Group))
                groupIds.Add(s.ScopeId);

            // Legacy data from before the ScopeType=Group constraint became mandatory for Submitter
            // (2026-07-17) may still have Department-type scopes — expand these to all Groups under
            // that Department so nothing is missed.
            var legacyDepartmentIds = submitterScopes
                .Where(s => s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            if (legacyDepartmentIds.Count > 0)
            {
                var groupsInDepartments = await _unitOfWork.Groups.FindAsync(
                    x => !x.IsDeleted && legacyDepartmentIds.Contains(x.DepartmentId));
                foreach (var g in groupsInDepartments) groupIds.Add(g.Id);
            }

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.UserName == userName && !x.IsDeleted);
            if (callerEmployee != null) groupIds.Add(callerEmployee.GroupId);

            if (groupIds.Count == 0) return new List<MyCreateScopeItemDto>();

            var groups = await _unitOfWork.Groups.SelectAsync(
                x => groupIds.Contains(x.Id) && !x.IsDeleted,
                x => new MyCreateScopeItemDto
                {
                    GroupId = x.Id,
                    GroupNameVn = x.GroupNameVn,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn
                });

            return groups.OrderBy(x => x.GroupNameVn).ToList();
        }

        // Team Leader signs as "Requester" — moves the form from Draft to Pending (awaiting Department
        // Manager). Separated from CreateAsync because the form creator (data entry, possibly Role
        // "Nhân viên") is not necessarily the Team Leader; the "Requester" signature must always be the
        // real Team Leader's signature — ONLY accepts UserApprovalScope(Submitter), does not accept
        // Employee.GroupId like CreateAsync does (see docs/attendance-module.md).
        public async Task<OtFormDto> ApproveSubmitterAsync(int id, string approverUserName, string? approverFullName, bool isAdmin, ApproveOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.Draft)
                throw new DomainException("Đơn không ở trạng thái nháp (Draft), không thể ký duyệt cấp Trưởng nhóm nữa.");

            // Same Scope mechanism as CreateAsync — only a Team Leader assigned a matching
            // UserApprovalScope(Submitter) for the form's exact Group/Department can sign it. Admin
            // bypasses this check.
            if (!isAdmin)
            {
                var approverScopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == approverUserName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

                var authorized = approverScopes.Any(s =>
                    (s.ScopeType == (int)ScopeType.Department && s.ScopeId == otForm.DepartmentId) ||
                    (s.ScopeType == (int)ScopeType.Group && s.ScopeId == otForm.GroupId));

                if (!authorized)
                    throw new DomainException("Bạn không được phân quyền ký duyệt (cấp Trưởng nhóm) cho nhóm/bộ phận của đơn này.");
            }

            // Second-factor password gate — applies to EVERY sign/approve/reject action, including this
            // Submitter step (see docs/attendance-module.md — Mật khẩu cấp 2). Verified before any write.
            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            // The "Requester" signature is always required, taken from the already-registered
            // signature (UserSignature) of the Team Leader who is signing — not accepted from the
            // request's image (see docs/attendance-module.md).
            var submitterSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == approverUserName);
            if (submitterSignature == null)
                throw new DomainException("Bạn chưa đăng ký chữ ký. Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước khi ký duyệt.");

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)ApprovalLevel.Submitter,
                Action = (int)ApprovalAction.Submitted,
                Comment = request.Comment,
                SignatureImage = submitterSignature.SignatureImage,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            otForm.Status = (int)OtFormStatus.PendingGroupHead;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            // Form now has the Team Leader's signature, next needs Trưởng Bộ phận (GroupHead, NEW as
            // of 2026-07-17) to approve before it reaches the Department Manager.
            await NotifyEligibleApproversAsync(otForm, ApprovalLevel.GroupHead);

            return await GetByIdAsync(otForm.Id);
        }

        // Edit an existing form — restricted to ONLY each active employee's actual OT end time ("thực
        // tích" — chốt lại 2026-07-31, xem docs/attendance-module.md — Sửa đơn: giới hạn chỉ sửa thực
        // tích). Every other field (Group/Department/Reason/OtCase/Date/StartTime/EndTime/SubReason/
        // ProcessPart) AND the employee list itself (thêm/bớt người) are now FIXED after creation —
        // dropping a person still goes through the separate "Loại khỏi đơn" flow
        // (RemoveEmployeeAsync), not through this endpoint. Only the creator can edit, and only while
        // the form is still Draft/PendingGroupHead/Pending (see IsEditableStatus).
        public async Task<OtFormDto> UpdateAsync(int id, string currentUserName, bool isAdmin, UpdateOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.CreatedByUserName != currentUserName)
                throw new DomainException("Bạn chỉ có thể sửa đơn do chính mình tạo.");

            if (!IsEditableStatus(otForm.Status))
                throw new DomainException("Đơn đã được Trưởng phòng duyệt trở lên, không thể sửa nữa.");

            // Re-check the creator's scope for THIS form's (now fixed) Group/Department hasn't been
            // revoked since creation — defense-in-depth, same permission model as CreateAsync.
            await EnsureCanCreateOrEditForScopeAsync(currentUserName, isAdmin, otForm.GroupId, otForm.DepartmentId);

            // Removed employees never come back through this endpoint anymore (the list itself is
            // fixed) — only active rows are eligible to have their EndTime edited.
            var activeEmployees = otForm.OtFormEmployees.Where(x => !x.IsRemoved).ToList();
            var activeEmployeeIds = activeEmployees.Select(x => x.EmployeeId).ToHashSet();
            var requestedEmployeeIds = request.Employees.Select(x => x.EmployeeId).ToHashSet();

            if (requestedEmployeeIds.Count != request.Employees.Count)
                throw new DomainException("Danh sách nhân viên có mã trùng lặp.");

            if (!requestedEmployeeIds.SetEquals(activeEmployeeIds))
                throw new DomainException(
                    "Danh sách nhân viên trong đơn đã thay đổi — không thể thêm/bớt người khi sửa đơn, chỉ được sửa giờ kết thúc của từng người.");

            var employeesById = (await _unitOfWork.Employees.FindAsync(x => activeEmployeeIds.Contains(x.Id)))
                .ToDictionary(x => x.Id);
            var employeeCodeById = employeesById.ToDictionary(x => x.Key, x => x.Value.Code);

            foreach (var item in request.Employees)
            {
                if (item.EndTime <= otForm.StartTime || item.EndTime > otForm.EndTime)
                {
                    var code = employeeCodeById.GetValueOrDefault(item.EmployeeId, item.EmployeeId.ToString());
                    throw new DomainException(
                        $"Giờ kết thúc OT của nhân viên '{code}' phải sau giờ bắt đầu ({otForm.StartTime:HH:mm}) " +
                        $"và không được vượt quá giờ kết thúc của đơn ({otForm.EndTime:HH:mm}).");
                }
            }

            // Sửa "thực tích"/DidEat trước khi Trưởng phòng duyệt làm số giờ đã reserve lúc tạo không
            // còn đúng nữa — điều chỉnh đúng phần chênh lệch vào lũy kế dự kiến (xem
            // docs/attendance-module.md — Lũy kế dự kiến), không cộng/trừ lại từ đầu để tránh đụng tới
            // phần dự kiến của các đơn khác đã cộng chung vào cùng Employee từ trước.
            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

            var activeByEmployeeId = activeEmployees.ToDictionary(x => x.EmployeeId);
            foreach (var item in request.Employees)
            {
                var existing = activeByEmployeeId[item.EmployeeId];
                var oldHours = CalculateOtHours(existing.StartTime, existing.EndTime, existing.DidEat, mainMealTicketMinHours);

                existing.EndTime = item.EndTime;
                existing.DidEat = item.DidEat;
                _unitOfWork.OtFormEmployees.Update(existing);

                var newHours = CalculateOtHours(existing.StartTime, existing.EndTime, existing.DidEat, mainMealTicketMinHours);
                ApplyProjectedDelta(employeesById[item.EmployeeId], otForm.Date, newHours - oldHours);
            }

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(otForm.Id);
        }

        public async Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName);

            // Second-factor password gate — see docs/attendance-module.md — Mật khẩu cấp 2.
            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            // The approval-level signature is taken from the approver's already-registered signature
            // (UserSignature) — no longer accepted from the request's image (see docs/attendance-module.md).
            var approverSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == approverUserName);
            if (otForm.OtCase.RequireSignature && approverSignature == null)
                throw new DomainException("Trường hợp OT này bắt buộc phải ký khi duyệt. Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước.");

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Approved,
                Comment = request.Comment,
                SignatureImage = approverSignature?.SignatureImage,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            var nextStatus = DetermineNextStatus(currentLevel, (ApprovalLevel)otForm.OtCase.RequiredApprovalLevel);
            otForm.Status = (int)nextStatus;
            _unitOfWork.OtForms.Update(otForm);

            // Only accumulate hours once, when the form finishes the entire approval flow (Completed) —
            // avoids double-counting across intermediate levels and avoids having to roll back the
            // accumulation if the form gets Rejected midway.
            if (nextStatus == OtFormStatus.Completed)
            {
                await AccumulateEmployeeHoursAsync(otForm);
            }

            await _unitOfWork.SaveChangesAsync();

            // If there's a next level still needing approval (not yet Completed), send an email to
            // that level — for Completed/Rejected, stop, since no one needs to approve further.
            // DepartmentManager is deliberately NOT notified here (unlike WorkshopManager/GeneralDirector
            // below): as of 2026-08-06 those forms are gathered into "Đơn tổng" and emailed once a day at
            // 15:00 by OtFormBatchBackgroundService instead of 1 email per form (see docs/attendance-
            // module.md — §Đơn tổng). The form just sits with OtFormBatchId=null until that sweep picks
            // it up — no action needed here.
            if (nextStatus == OtFormStatus.ApprovedByDepartment)
                await NotifyEligibleApproversAsync(otForm, ApprovalLevel.WorkshopManager);
            else if (nextStatus == OtFormStatus.ApprovedByWorkshop)
                await NotifyEligibleApproversAsync(otForm, ApprovalLevel.GeneralDirector);
        }

        public async Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName);

            // Second-factor password gate — see docs/attendance-module.md — Mật khẩu cấp 2.
            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Rejected,
                Comment = request.Comment,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            otForm.Status = (int)OtFormStatus.Rejected;
            _unitOfWork.OtForms.Update(otForm);

            // Đơn bị từ chối — trả lại lũy kế dự kiến đã reserve lúc tạo (xem docs/attendance-module.md
            // — Lũy kế dự kiến). Lũy kế thực tế không đụng gì vì chưa bao giờ được cộng cho đơn này.
            await ReverseProjectedAccumulationAsync(otForm);

            await _unitOfWork.SaveChangesAsync();
        }

        // Drops ONE employee from the form so the REST of it can still be approved — an approver who
        // disagrees with one person out of many no longer has to reject all of it (requirement
        // 2026-07-30, see docs/attendance-module.md — Loại nhân viên khỏi đơn). Deliberately a separate
        // endpoint rather than a field on approve: the remover reviews the shortened form before
        // deciding to approve it, so removal and approval are two distinct signed acts.
        //
        // Does NOT move the form's Status and does NOT invalidate signatures already collected — levels
        // that already signed stay signed, and the flow continues from wherever it was.
        public async Task<OtFormDto> RemoveEmployeeAsync(
            int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request)
        {
            // No second-factor password gate here — unlike sign/approve/reject, removing an employee does
            // not re-verify SecondaryPassword (chốt lại 2026-07-31, see docs/attendance-module.md — Mật
            // khẩu cấp 2). Same as the email-channel twin (RemoveEmployeeByEmailTokenAsync).
            return await RemoveEmployeeCoreAsync(id, userName, fullName, isAdmin, request.EmployeeId, request.Reason);
        }

        // Same removal reachable from the [AllowAnonymous] email-confirm channel — authenticated by the
        // OtFormApprovalEmailToken instead of a JWT + UserApprovalScope check, and WITHOUT a secondary
        // password (see docs/attendance-module.md — Loại nhân viên khỏi đơn). Deliberately does NOT
        // consume/expire the token (ResolveEmailTokenAsync requireUnused: false) — the approver may still
        // need the same token afterward to actually Approve/Reject, and may remove more than one person
        // before deciding.
        public async Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);

            return await RemoveEmployeeCoreAsync(
                emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName,
                isAdmin: false, request.EmployeeId, request.Reason);
        }

        private async Task<OtFormDto> RemoveEmployeeCoreAsync(
            int id, string userName, string? fullName, bool isAdmin, int employeeId, string reason)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            // Which level is the caller acting at right now? Mirrors LoadFormAndValidateAuthorityAsync,
            // except Draft is a VALID state here: the Team Leader who signs at /submit may also drop
            // someone, whereas approve/reject never applies to a Draft.
            var currentLevel = ((OtFormStatus)otForm!.Status) switch
            {
                OtFormStatus.Draft => ApprovalLevel.Submitter,
                OtFormStatus.PendingGroupHead => ApprovalLevel.GroupHead,
                OtFormStatus.Pending => ApprovalLevel.DepartmentManager,
                OtFormStatus.ApprovedByDepartment => ApprovalLevel.WorkshopManager,
                OtFormStatus.ApprovedByWorkshop => ApprovalLevel.GeneralDirector,
                _ => throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể loại nhân viên khỏi đơn nữa.")
            };

            // Same 2-layer model as everywhere else (Permission gates the action at the Controller,
            // UserApprovalScope gates WHICH form) — the caller must be entitled to act at the level the
            // form is currently waiting on, so nobody can reach into a form that isn't theirs or that is
            // sitting at a different level. Admin bypasses only at Submitter level, matching
            // ApproveSubmitterAsync; the upper levels have no Admin bypass, matching ApproveAsync.
            // GeneralDirector is no longer a special case (2026-08-05) — their scope is always
            // ScopeType.All, matched by the 3rd branch below, same mechanism as every other level.
            if (!(currentLevel == ApprovalLevel.Submitter && isAdmin))
            {
                var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == userName && x.ApprovalLevel == (int)currentLevel);

                var authorized = scopes.Any(s =>
                    (s.ScopeType == (int)ScopeType.Department && s.ScopeId == otForm.DepartmentId) ||
                    (s.ScopeType == (int)ScopeType.Group && s.ScopeId == otForm.GroupId) ||
                    s.ScopeType == (int)ScopeType.All);

                if (!authorized)
                    throw new DomainException("Bạn không được phân quyền ở cấp mà đơn này đang chờ, nên không thể loại nhân viên khỏi đơn.");
            }

            var target = otForm.OtFormEmployees.FirstOrDefault(x => x.EmployeeId == employeeId);
            if (target == null)
                throw new DomainException("Nhân viên này không có trong danh sách tăng ca của đơn.");

            if (target.IsRemoved)
                throw new DomainException("Nhân viên này đã bị loại khỏi đơn trước đó.");

            // A form with nobody left on it is meaningless — that case is a rejection, not a removal.
            if (otForm.OtFormEmployees.Count(x => !x.IsRemoved) <= 1)
                throw new DomainException("Đơn chỉ còn 1 nhân viên, không thể loại tiếp. Nếu không duyệt đơn này, hãy dùng chức năng Từ chối đơn.");

            target.IsRemoved = true;
            target.RemovedByUserName = userName;
            target.RemovedByFullName = fullName;
            target.RemovedAtLevel = (int)currentLevel;
            target.RemovedAt = TimeHelper.GetCurrentUtcTime();
            target.RemoveReason = reason;
            _unitOfWork.OtFormEmployees.Update(target);

            // Người bị loại không còn nằm trong đơn nữa — trả lại đúng phần giờ dự kiến của riêng họ,
            // dù đơn vẫn tiếp tục chạy cho những người còn lại (xem docs/attendance-module.md — Lũy kế
            // dự kiến). Không đụng lũy kế thực tế vì chưa bao giờ được cộng cho đơn chưa Completed.
            var removedEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId);
            if (removedEmployee != null)
            {
                var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();
                var hours = CalculateOtHours(target.StartTime, target.EndTime, target.DidEat, mainMealTicketMinHours);
                ApplyProjectedDelta(removedEmployee, otForm.Date, -hours);
            }

            // Keep the headline count in sync with who is actually still on the form — this is what the
            // list screens and the printed form show.
            otForm.NumberOfEmployee = otForm.OtFormEmployees.Count(x => !x.IsRemoved);
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(otForm.Id);
        }

        // === Email-based verification (a supplementary channel to Approve/Reject in the app) ===

        public async Task<OtFormDto> GetByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);
            return await GetByIdAsync(emailToken.OtFormId);
        }

        public async Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);

            // The Submitter level (Team Leader signing a Draft) goes through a separate handling branch —
            // there's no concept of isAdmin over the email channel (see docs/attendance-module.md).
            if ((ApprovalLevel)emailToken.ApprovalLevel == ApprovalLevel.Submitter)
            {
                await ApproveSubmitterAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, isAdmin: false, request);
            }
            else
            {
                await ApproveAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);
            }

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task RejectByEmailTokenAsync(string token, RejectOtFormDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);

            await RejectAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<OtFormApprovalEmailToken> ResolveEmailTokenAsync(string token, bool requireUnused)
        {
            var emailToken = await _unitOfWork.OtFormApprovalEmailTokens.FirstOrDefaultAsync(x => x.Token == token);
            emailToken.OrThrowNotFound("Link duyệt đơn qua email", token);

            if (emailToken!.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link duyệt đơn qua email đã hết hạn.");

            if (requireUnused && emailToken.UsedAt != null)
                throw new DomainException("Link duyệt đơn này đã được sử dụng.");

            return emailToken;
        }

        // Sends an email with an Approve/Reject link to everyone eligible to approve at the exact
        // `level` of the `otForm` form — called after CreateAsync (always needs DepartmentManager) and
        // after ApproveAsync (when there's a next level). Does not throw if Email is missing/SMTP
        // fails — notification is just a supplementary channel.
        private async Task NotifyEligibleApproversAsync(OtForm otForm, ApprovalLevel level)
        {
            var approverUserNames = await ResolveEligibleApproverUserNamesAsync(level, otForm.DepartmentId, otForm.GroupId);
            if (approverUserNames.Count == 0) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var hasNewToken = false;

            // Fetched fresh by Id instead of relying on otForm.Group/Department/Reason navigation
            // properties — callers (CreateAsync/ApproveSubmitterAsync/ApproveAsync) don't all Include()
            // these, so the navigation may be null. Needed here for the bilingual (Vn/Jp) email content
            // (2026-07-29, see docs/attendance-module.md).
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == otForm.GroupId);
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == otForm.DepartmentId);
            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == otForm.ReasonId);
            var departmentName = FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp);
            var groupName = FormatBilingual(group?.GroupNameVn, group?.GroupNameJp);
            var reasonName = FormatBilingual(reason?.ReasonNameVn, reason?.ReasonNameJp);

            foreach (var approverUserName in approverUserNames)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(approverUserName);
                if (string.IsNullOrWhiteSpace(email)) continue;

                var emailToken = new OtFormApprovalEmailToken
                {
                    OtFormId = otForm.Id,
                    ApproverUserName = approverUserName,
                    ApproverFullName = fullName,
                    ApprovalLevel = (int)level,
                    Token = TokenHelper.GenerateSecureToken(),
                    ExpiresAt = now.AddDays(EmailApprovalTokenExpiryDays),
                    CreatedAt = now
                };
                await _unitOfWork.OtFormApprovalEmailTokens.AddAsync(emailToken);
                hasNewToken = true;

                var link = $"{baseUrl}/xac-nhan-don?token={emailToken.Token}";

                // A template rendering error must not break the main business flow (creating/approving
                // the form still has to succeed) — same principle as EmailService.SendAsync swallowing
                // SMTP errors.
                try
                {
                    var html = _emailTemplateRenderer.Render("OtForm/ApprovalNotification.html", new Dictionary<string, string>
                    {
                        ["ApproverFullName"] = fullName ?? approverUserName,
                        ["OtFormId"] = otForm.Id.ToString(),
                        ["RequesterFullName"] = otForm.CreatedByFullName ?? otForm.CreatedByUserName,
                        ["DepartmentName"] = departmentName,
                        ["GroupName"] = groupName,
                        ["ReasonName"] = reasonName,
                        ["OtFormDate"] = otForm.Date.ToString("dd/MM/yyyy"),
                        ["OtFormTime"] = $"{otForm.StartTime:HH\\:mm} - {otForm.EndTime:HH\\:mm}",
                        ["TotalHour"] = otForm.TotalHour.ToString("0.##"),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    });

                    await _emailService.SendAsync(email, $"Đơn tăng ca #{otForm.Id} đang chờ bạn duyệt - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // A missing template file is a deployment error (deploy forgot to copy
                    // EmailTemplates/) — skip sending the email to this person rather than blocking
                    // the whole notification flow.
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        // Vietnamese is always shown; Japanese is appended only when the master data has it filled in
        // (NameJp is nullable on Department/Group/Reason — see docs/attendance-module.md).
        private static string FormatBilingual(string? nameVn, string? nameJp)
        {
            if (string.IsNullOrWhiteSpace(nameVn)) return "-";
            return string.IsNullOrWhiteSpace(nameJp) ? nameVn : $"{nameVn} / {nameJp}";
        }

        // DepartmentManager/WorkshopManager/GeneralDirector: all looked up via UserApprovalScope
        // matching the form's Department/Group (reuses the same scope-matching logic as
        // LoadFormAndValidateAuthorityAsync, just querying in the opposite direction — here we find
        // ALL matching users instead of checking one specific user). GeneralDirector's scope is
        // always ScopeType.All (company-wide, matched unconditionally) — no longer a Role lookup
        // (removed 2026-08-05, see docs/attendance-module.md).
        private async Task<List<string>> ResolveEligibleApproverUserNamesAsync(ApprovalLevel level, int departmentId, int groupId)
        {
            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.ApprovalLevel == (int)level &&
                ((x.ScopeType == (int)ScopeType.Department && x.ScopeId == departmentId) ||
                 (x.ScopeType == (int)ScopeType.Group && x.ScopeId == groupId) ||
                 x.ScopeType == (int)ScopeType.All));

            return scopes.Select(s => s.UserName).Distinct().ToList();
        }

        // Load employees by Id, reject employees that don't exist/belong to a different group, and
        // validate each person's end time: StartTime always equals the form's start time (not accepted
        // from the FE), EndTime must be after StartTime and must not exceed the form's EndTime (the
        // time declared at the top of the form is the MAXIMUM).
        private async Task<List<Employee>> ValidateEmployeesAsync(
            int groupId, TimeOnly formStartTime, TimeOnly formEndTime, List<CreateOtFormEmployeeItemDto> items)
        {
            var employeeIds = items.Select(x => x.EmployeeId).ToList();
            var employees = await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id) && !x.IsDeleted);
            if (employees.Count != employeeIds.Distinct().Count())
                throw new DomainException("Có nhân viên không tồn tại hoặc đã bị xóa trong danh sách.");

            var wrongGroupEmployee = employees.FirstOrDefault(x => x.GroupId != groupId);
            if (wrongGroupEmployee != null)
                throw new DomainException($"Nhân viên '{wrongGroupEmployee.Code}' không thuộc nhóm đã chọn.");

            var employeeById = employees.ToDictionary(x => x.Id);
            foreach (var item in items)
            {
                if (item.EndTime <= formStartTime || item.EndTime > formEndTime)
                {
                    var code = employeeById[item.EmployeeId].Code;
                    throw new DomainException(
                        $"Giờ kết thúc OT của nhân viên '{code}' phải sau giờ bắt đầu ({formStartTime:HH:mm}) " +
                        $"và không được vượt quá giờ kết thúc của đơn ({formEndTime:HH:mm}).");
                }
            }

            return employees.ToList();
        }

        // Kiểm tra trùng giờ tăng ca trong cùng ngày — 1 nhân viên không được nằm trong 2 đơn tăng ca
        // có khoảng giờ chồng chéo (overlap) trong cùng 1 ngày. Đơn bị xóa (IsDeleted) hoặc bị từ
        // chối (Rejected) không tính. excludeFormId cho phép loại trừ chính đơn đang sửa (nếu gọi từ
        // UpdateAsync trong tương lai) — CreateAsync truyền null vì chưa có Id (chốt 2026-08-06).
        private async Task EnsureNoOverlappingOtFormsAsync(
            List<Employee> employees, DateOnly date, TimeOnly formStartTime, Dictionary<int, TimeOnly> employeeEndTimes, int? excludeFormId)
        {
            var employeeIds = employees.Select(x => x.Id).ToList();

            // Lấy tất cả OtFormEmployee của các nhân viên này trong các đơn cùng ngày, non-deleted,
            // non-rejected — join qua OtForm để lọc theo Date/Status/IsDeleted.
            var existingRecords = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId)
                     && x.OtForm.Date == date
                     && !x.OtForm.IsDeleted
                     && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.IsRemoved
                     && (excludeFormId == null || x.OtFormId != excludeFormId.Value),
                x => x.OtForm);

            // Kiểm tra chồng chéo giờ: khoảng [formStartTime, employeeEndTime) chồng với [existing.StartTime,
            // existing.EndTime) khi formStartTime < existing.EndTime AND employeeEndTime > existing.StartTime.
            var overlapping = existingRecords
                .Where(x => formStartTime < x.EndTime && employeeEndTimes.GetValueOrDefault(x.EmployeeId, formStartTime) > x.StartTime)
                .ToList();

            if (overlapping.Count > 0)
            {
                var employeeCodeById = employees.ToDictionary(x => x.Id, x => x.Code);
                var conflicts = overlapping
                    .Select(x => $"'{employeeCodeById.GetValueOrDefault(x.EmployeeId, x.EmployeeId.ToString())}' " +
                                 $"(đơn #{x.OtFormId}, giờ {x.StartTime:HH:mm}–{x.EndTime:HH:mm})")
                    .Distinct()
                    .ToList();

                throw new DomainException(
                    $"Không thể tạo đơn — các nhân viên sau đã có đơn tăng ca trùng giờ trong ngày {date:dd/MM/yyyy}: " +
                    string.Join(", ", conflicts) + ".");
            }
        }

        public async Task<List<int>> CheckOverlapAsync(CheckOtFormOverlapDto request)
        {
            var employeeIds = request.Employees.Select(x => x.EmployeeId).Distinct().ToList();
            if (employeeIds.Count == 0) return new List<int>();

            var existingRecords = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId)
                     && x.OtForm.Date == request.Date
                     && !x.OtForm.IsDeleted
                     && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.IsRemoved
                     && (request.ExcludeFormId == null || x.OtFormId != request.ExcludeFormId.Value),
                x => x.OtForm);

            var employeeEndTimes = request.Employees.ToDictionary(x => x.EmployeeId, x => x.EndTime);

            var overlappingIds = existingRecords
                .Where(x => request.StartTime < x.EndTime && employeeEndTimes.GetValueOrDefault(x.EmployeeId, request.StartTime) > x.StartTime)
                .Select(x => x.EmployeeId)
                .Distinct()
                .ToList();

            return overlappingIds;
        }


        // Adds each employee's actual OT hours (EndTime - StartTime) to their monthly/yearly
        // accumulation, automatically rolling over to 0 when the form's Date falls into a new
        // month/year compared to Employee.AccumulationYear/Month.
        // Nhân viên đủ ngưỡng nhận phiếu ăn (xem IsEligibleForMeal) mà KHÔNG ăn (DidEat=false) thì được
        // cộng thêm đúng 30 phút vào lũy kế — CHỈ vào MonthToDate/YearToDate, KHÔNG đổi EndTime/giờ thực
        // tích đã ký trên đơn (chốt 2026-08-05, xem docs/attendance-module.md — Phiếu ăn).
        private const decimal NoMealExtraAccumulationHours = 0.5m;

        // Số giờ OT thực sự sẽ được cộng vào lũy kế cho 1 người — dùng chung cho cả lũy kế thực tế
        // (Completed) lẫn lũy kế dự kiến (Create/Update/Remove/Reject), để 2 loại lũy kế luôn tính theo
        // đúng 1 công thức (kể cả phần +30 phút không ăn).
        private static decimal CalculateOtHours(TimeOnly startTime, TimeOnly endTime, bool didEat, decimal mainMealTicketMinHours)
        {
            var hours = (decimal)(endTime - startTime).TotalHours;

            if (hours >= mainMealTicketMinHours && !didEat)
            {
                hours += NoMealExtraAccumulationHours;
            }

            return hours;
        }

        private async Task AccumulateEmployeeHoursAsync(OtForm otForm)
        {
            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

            // Employees dropped by an approver never accumulate hours — they did not end up on the
            // approved form (see docs/attendance-module.md — Loại nhân viên khỏi đơn).
            var otFormEmployees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == otForm.Id && !x.IsRemoved, x => x.Employee);

            foreach (var otFormEmployee in otFormEmployees)
            {
                var employee = otFormEmployee.Employee;
                var hours = CalculateOtHours(otFormEmployee.StartTime, otFormEmployee.EndTime, otFormEmployee.DidEat, mainMealTicketMinHours);

                if (employee.AccumulationYear != otForm.Date.Year)
                {
                    employee.YearToDate = 0;
                    employee.AccumulationYear = otForm.Date.Year;
                    employee.MonthToDate = 0;
                    employee.AccumulationMonth = otForm.Date.Month;
                }
                else if (employee.AccumulationMonth != otForm.Date.Month)
                {
                    employee.MonthToDate = 0;
                    employee.AccumulationMonth = otForm.Date.Month;
                }

                employee.MonthToDate += hours;
                employee.YearToDate += hours;

                _unitOfWork.Employees.Update(employee);
            }
        }

        // === Lũy kế DỰ KIẾN (2026-08-06) — xem Employee.ProjectedMonthToDate/YearToDate ===

        // Mốc rollover RIÊNG cho lũy kế dự kiến (ProjectedAccumulationYear/Month) — không dùng chung
        // AccumulationYear/Month của lũy kế thực tế, vì dự kiến có thể bị trừ ngược sau khi cộng
        // (Reject/loại người), còn thực tế thì không bao giờ bị đảo ngược.
        private static void ApplyProjectedRollover(Employee employee, DateOnly formDate)
        {
            if (employee.ProjectedAccumulationYear != formDate.Year)
            {
                employee.ProjectedYearToDate = 0;
                employee.ProjectedAccumulationYear = formDate.Year;
                employee.ProjectedMonthToDate = 0;
                employee.ProjectedAccumulationMonth = formDate.Month;
            }
            else if (employee.ProjectedAccumulationMonth != formDate.Month)
            {
                employee.ProjectedMonthToDate = 0;
                employee.ProjectedAccumulationMonth = formDate.Month;
            }
        }

        // deltaHours dương khi tạo đơn/tăng giờ, âm khi Reject/loại người/giảm giờ.
        private void ApplyProjectedDelta(Employee employee, DateOnly formDate, decimal deltaHours)
        {
            if (deltaHours == 0) return;

            ApplyProjectedRollover(employee, formDate);
            employee.ProjectedMonthToDate += deltaHours;
            employee.ProjectedYearToDate += deltaHours;

            _unitOfWork.Employees.Update(employee);
        }

        // Đơn bị Rejected — trả lại toàn bộ giờ đã reserve lúc tạo cho những người còn active trong đơn
        // (người đã bị loại trước đó qua RemoveEmployeeAsync thì phần của họ đã được trả lại từ lúc đó rồi).
        private async Task ReverseProjectedAccumulationAsync(OtForm otForm)
        {
            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

            var otFormEmployees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == otForm.Id && !x.IsRemoved, x => x.Employee);

            foreach (var otFormEmployee in otFormEmployees)
            {
                var hours = CalculateOtHours(otFormEmployee.StartTime, otFormEmployee.EndTime, otFormEmployee.DidEat, mainMealTicketMinHours);
                ApplyProjectedDelta(otFormEmployee.Employee, otForm.Date, -hours);
            }
        }

        private async Task<(OtForm otForm, ApprovalLevel currentLevel)> LoadFormAndValidateAuthorityAsync(
            int id, string approverUserName)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var currentLevel = ((OtFormStatus)otForm!.Status) switch
            {
                OtFormStatus.Draft => throw new DomainException("Đơn đang ở trạng thái nháp, cần Trưởng nhóm ký duyệt (POST /{id}/submit) trước khi duyệt/từ chối ở các cấp tiếp theo."),
                OtFormStatus.PendingGroupHead => ApprovalLevel.GroupHead,
                OtFormStatus.Pending => ApprovalLevel.DepartmentManager,
                OtFormStatus.ApprovedByDepartment => ApprovalLevel.WorkshopManager,
                OtFormStatus.ApprovedByWorkshop => ApprovalLevel.GeneralDirector,
                _ => throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể duyệt/từ chối thêm.")
            };

            // GeneralDirector is no longer a special case (2026-08-05) — their UserApprovalScope is
            // always ScopeType.All, matched by the 3rd branch below, same mechanism as every other
            // level. Previously bypassed entirely via User.IsInRole(GeneralDirectorRole).
            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.UserName == approverUserName && x.ApprovalLevel == (int)currentLevel);

            var authorized = scopes.Any(s =>
                (s.ScopeType == (int)ScopeType.Department && s.ScopeId == otForm.DepartmentId) ||
                (s.ScopeType == (int)ScopeType.Group && s.ScopeId == otForm.GroupId) ||
                s.ScopeType == (int)ScopeType.All);

            if (!authorized)
                throw new DomainException("Bạn không được phân quyền duyệt phạm vi (nhóm/bộ phận) của đơn này.");

            return (otForm, currentLevel);
        }

        // Editable while Draft (no one has signed yet), PendingGroupHead (already has the Team
        // Leader's signature, awaiting Trưởng Bộ phận) and Pending (already has Trưởng Bộ phận's
        // signature, awaiting Department Manager) — only locked once it passes the Department Manager
        // level or beyond (see docs/attendance-module.md).
        private static bool IsEditableStatus(int status) =>
            status == (int)OtFormStatus.Draft || status == (int)OtFormStatus.PendingGroupHead || status == (int)OtFormStatus.Pending;

        private static OtFormStatus DetermineNextStatus(ApprovalLevel justApprovedLevel, ApprovalLevel requiredApprovalLevel)
        {
            // GroupHead (Trưởng Bộ phận) is always a mandatory intermediate step, NOT a stopping point
            // according to OtCase.RequiredApprovalLevel (this field only accepts DepartmentManager/
            // WorkshopManager/GeneralDirector — see ApprovalLevel.cs) — so check this first, skipping
            // the requiredApprovalLevel comparison.
            if (justApprovedLevel == ApprovalLevel.GroupHead) return OtFormStatus.Pending;

            if (justApprovedLevel == requiredApprovalLevel) return OtFormStatus.Completed;

            return justApprovedLevel switch
            {
                ApprovalLevel.DepartmentManager => OtFormStatus.ApprovedByDepartment,
                ApprovalLevel.WorkshopManager => OtFormStatus.ApprovedByWorkshop,
                ApprovalLevel.GeneralDirector => OtFormStatus.Completed,
                _ => throw new DomainException("Cấp duyệt không hợp lệ.")
            };
        }

        // === "Đơn tổng" — gom nhiều OtForm đang chờ đúng cấp DepartmentManager của cùng 1 Department,
        // duyệt 1 lần thay vì từng đơn (see docs/attendance-module.md — §Đơn tổng). ===

        public async Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(
            string userName, bool isAdmin, int pageIndex, int pageSize)
        {
            var departmentIds = new List<int>();
            var hasAllScope = false;

            if (!isAdmin)
            {
                var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == userName && x.ApprovalLevel == (int)ApprovalLevel.DepartmentManager);

                departmentIds = scopes.Where(s => s.ScopeType == (int)ScopeType.Department).Select(s => s.ScopeId).ToList();
                hasAllScope = scopes.Any(s => s.ScopeType == (int)ScopeType.All);
            }

            var query = _unitOfWork.OtFormBatches.GetQueryable(false, x => x.Department)
                .Where(b => isAdmin || hasAllScope || departmentIds.Contains(b.DepartmentId))
                .OrderByDescending(b => b.Id);

            return await _unitOfWork.OtFormBatches.ToPagedResponseAsync(query, pageIndex, pageSize, ToBatchListItemDto);
        }

        public async Task<OtFormBatchDto> GetBatchByIdAsync(int id)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == id, x => x.Department);
            batch.OrThrowNotFound("Đơn tổng", id);

            return await BuildBatchDtoAsync(batch!);
        }

        public async Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveBatchEmailTokenAsync(token, requireUnused: false);

            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == emailToken.OtFormBatchId, x => x.Department);
            batch.OrThrowNotFound("Đơn tổng", emailToken.OtFormBatchId);

            return await BuildBatchDtoAsync(batch!);
        }

        public async Task<OtFormBatchDto> ProcessBatchByEmailTokenAsync(string token, ProcessOtFormBatchDto request)
        {
            var emailToken = await ResolveBatchEmailTokenAsync(token, requireUnused: true);

            var result = await ProcessBatchAsync(emailToken.OtFormBatchId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormBatchEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();

            return result;
        }

        // Duyệt/Từ chối hàng loạt — mỗi đơn nhỏ (còn Status==Pending trong batch) BẮT BUỘC có đúng 1
        // quyết định trong request.Forms. Không viết lại logic duyệt/từ chối: gọi thẳng ApproveAsync/
        // RejectAsync/RemoveEmployeeCoreAsync đã có cho từng đơn — mỗi đơn tiếp tục đúng luồng hiện có
        // (DetermineNextStatus, cộng lũy kế, gửi mail cấp kế tiếp). Không có Admin bypass, cùng tinh
        // thần ApproveAsync ở cấp DepartmentManager (chỉ cấp Submitter mới bypass được cho Admin).
        public async Task<OtFormBatchDto> ProcessBatchAsync(
            int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == batchId, x => x.Department);
            batch.OrThrowNotFound("Đơn tổng", batchId);

            if (batch!.Status != (int)OtFormBatchStatus.Pending)
                throw new DomainException("Đơn tổng này đã được xử lý.");

            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.UserName == approverUserName && x.ApprovalLevel == (int)ApprovalLevel.DepartmentManager);
            var authorized = scopes.Any(s =>
                (s.ScopeType == (int)ScopeType.Department && s.ScopeId == batch.DepartmentId) ||
                s.ScopeType == (int)ScopeType.All);
            if (!authorized)
                throw new DomainException("Bạn không được phân quyền duyệt đơn tổng của phòng ban này.");

            var activeForms = await _unitOfWork.OtForms.FindAsync(x =>
                x.OtFormBatchId == batchId && !x.IsDeleted && x.Status == (int)OtFormStatus.Pending);

            if (activeForms.Count == 0)
            {
                // Every member form was already resolved individually outside the batch flow (normal
                // "Chờ tôi duyệt" tab) — auto-close instead of leaving this batch Pending forever.
                batch.Status = (int)OtFormBatchStatus.Processed;
                batch.ProcessedAt = TimeHelper.GetCurrentUtcTime();
                _unitOfWork.OtFormBatches.Update(batch);
                await _unitOfWork.SaveChangesAsync();
                throw new DomainException("Toàn bộ đơn trong đơn tổng này đã được xử lý ở nơi khác, không còn gì để duyệt.");
            }

            var activeFormIds = activeForms.Select(x => x.Id).ToHashSet();
            var requestedFormIds = request.Forms.Select(x => x.OtFormId).ToHashSet();

            if (requestedFormIds.Count != request.Forms.Count)
                throw new DomainException("Danh sách đơn có mã trùng lặp.");

            if (!requestedFormIds.SetEquals(activeFormIds))
                throw new DomainException("Danh sách đơn trong yêu cầu không khớp với danh sách đơn hiện còn hiệu lực của đơn tổng này.");

            // Fail-fast validation BEFORE writing anything, so the batch action never ends up half-applied.
            var activeEmployeeCountByForm = (await _unitOfWork.OtFormEmployees.FindAsync(
                    x => activeFormIds.Contains(x.OtFormId) && !x.IsRemoved))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var item in request.Forms)
            {
                if ((OtFormBatchFormDecision)item.Decision == OtFormBatchFormDecision.Reject)
                {
                    if (string.IsNullOrWhiteSpace(item.RejectReason))
                        throw new DomainException($"Đơn #{item.OtFormId}: lý do từ chối không được để trống.");
                }
                else
                {
                    var excludedCount = item.ExcludedEmployeeIds?.Distinct().Count() ?? 0;
                    var totalActive = activeEmployeeCountByForm.GetValueOrDefault(item.OtFormId, 0);
                    if (excludedCount >= totalActive)
                        throw new DomainException($"Đơn #{item.OtFormId}: không thể bỏ chọn hết nhân viên, hãy dùng quyết định Từ chối cho đơn này.");
                }
            }

            // Verified once here (fail fast at batch level); ApproveAsync/RejectAsync below re-verify
            // it again per form — cheap and harmless, avoids touching their existing signatures.
            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            foreach (var item in request.Forms)
            {
                if ((OtFormBatchFormDecision)item.Decision == OtFormBatchFormDecision.Reject)
                {
                    await RejectAsync(item.OtFormId, approverUserName, approverFullName, new RejectOtFormDto
                    {
                        Comment = item.RejectReason!,
                        SecondaryPassword = request.SecondaryPassword
                    });
                }
                else
                {
                    foreach (var employeeId in (item.ExcludedEmployeeIds ?? new List<int>()).Distinct())
                    {
                        await RemoveEmployeeCoreAsync(item.OtFormId, approverUserName, approverFullName, isAdmin: false,
                            employeeId, "Bị loại khi duyệt đơn tổng");
                    }

                    await ApproveAsync(item.OtFormId, approverUserName, approverFullName, new ApproveOtFormDto
                    {
                        SecondaryPassword = request.SecondaryPassword
                    });
                }
            }

            batch.Status = (int)OtFormBatchStatus.Processed;
            batch.ProcessedAt = TimeHelper.GetCurrentUtcTime();
            batch.ProcessedByUserName = approverUserName;
            batch.ProcessedByFullName = approverFullName;
            _unitOfWork.OtFormBatches.Update(batch);
            await _unitOfWork.SaveChangesAsync();

            return await BuildBatchDtoAsync(batch);
        }

        // Daily sweep, called by OtFormBatchBackgroundService (default 15:00, see docs/attendance-module.md
        // — §Đơn tổng). Does 2 things: (a) bundles every OtForm still un-batched (OtFormBatchId == null)
        // and Status==Pending into ONE NEW batch per Department, (b) sends a reminder for every still-open
        // batch from a PREVIOUS day — deliberately NEVER re-bundles a form that already belongs to a batch,
        // so a form is only ever the subject of exactly 1 "new batch" email, plus 1 reminder per day it
        // stays unresolved (chốt qua AskUserQuestion — xem docs).
        public async Task RunDailyBatchSweepAsync()
        {
            var todayDateOnly = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime().Date);

            var unbatchedForms = await _unitOfWork.OtForms.FindAsync(x =>
                !x.IsDeleted && x.Status == (int)OtFormStatus.Pending && x.OtFormBatchId == null);

            var newBatches = new List<OtFormBatch>();
            foreach (var group in unbatchedForms.GroupBy(x => x.DepartmentId))
            {
                var newBatch = new OtFormBatch
                {
                    DepartmentId = group.Key,
                    BatchDate = todayDateOnly,
                    Status = (int)OtFormBatchStatus.Pending,
                    CreatedAt = TimeHelper.GetCurrentUtcTime()
                };
                await _unitOfWork.OtFormBatches.AddAsync(newBatch);
                newBatches.Add(newBatch);

                foreach (var form in group)
                {
                    form.OtFormBatch = newBatch;
                    _unitOfWork.OtForms.Update(form);
                }
            }

            if (newBatches.Count > 0)
                await _unitOfWork.SaveChangesAsync();

            foreach (var batch in newBatches)
                await NotifyBatchApproversAsync(batch, isReminder: false);

            var openOldBatches = await _unitOfWork.OtFormBatches.FindAsync(x =>
                x.Status == (int)OtFormBatchStatus.Pending && x.BatchDate < todayDateOnly);

            foreach (var batch in openOldBatches)
            {
                var stillPendingCount = (await _unitOfWork.OtForms.FindAsync(x =>
                    x.OtFormBatchId == batch.Id && !x.IsDeleted && x.Status == (int)OtFormStatus.Pending)).Count;

                if (stillPendingCount == 0)
                {
                    // Every member form got resolved individually (outside the batch flow) since this
                    // batch was created — auto-close it instead of nagging forever with reminder mails.
                    batch.Status = (int)OtFormBatchStatus.Processed;
                    batch.ProcessedAt = TimeHelper.GetCurrentUtcTime();
                    _unitOfWork.OtFormBatches.Update(batch);
                    await _unitOfWork.SaveChangesAsync();
                    continue;
                }

                await NotifyBatchApproversAsync(batch, isReminder: true);
            }
        }

        private async Task<OtFormBatchDto> BuildBatchDtoAsync(OtFormBatch batch)
        {
            var forms = await _unitOfWork.OtForms.FindWithIncludesAsync(
                x => x.OtFormBatchId == batch.Id && !x.IsDeleted && x.Status == (int)OtFormStatus.Pending,
                x => x.Group, x => x.Reason, x => x.OtCase);

            var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();
            var formIds = forms.Select(f => f.Id).ToList();
            var allEmployees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => formIds.Contains(x.OtFormId) && !x.IsRemoved, x => x.Employee);
            var employeesByFormId = allEmployees.ToLookup(x => x.OtFormId);

            return new OtFormBatchDto
            {
                Id = batch.Id,
                DepartmentId = batch.DepartmentId,
                DepartmentNameVn = batch.Department.DepartmentNameVn,
                DepartmentNameJp = batch.Department.DepartmentNameJp,
                BatchDate = batch.BatchDate,
                Status = batch.Status,
                CreatedAt = batch.CreatedAt,
                ProcessedAt = batch.ProcessedAt,
                ProcessedByUserName = batch.ProcessedByUserName,
                ProcessedByFullName = batch.ProcessedByFullName,
                OtForms = forms.Select(f => new OtFormBatchItemDto
                {
                    OtFormId = f.Id,
                    GroupNameVn = f.Group.GroupNameVn,
                    GroupNameJp = f.Group.GroupNameJp,
                    ReasonNameVn = f.Reason.ReasonNameVn,
                    ReasonNameJp = f.Reason.ReasonNameJp,
                    OtCaseCode = f.OtCase.Code,
                    Date = f.Date,
                    StartTime = f.StartTime,
                    EndTime = f.EndTime,
                    TotalHour = f.TotalHour,
                    CreatedByUserName = f.CreatedByUserName,
                    CreatedByFullName = f.CreatedByFullName,
                    NumberOfEmployee = f.NumberOfEmployee,
                    Employees = employeesByFormId[f.Id].Select(x => new OtFormEmployeeDto
                    {
                        EmployeeId = x.EmployeeId,
                        EmployeeCode = x.Employee.Code,
                        FullName = $"{x.Employee.LastName} {x.Employee.FirstName}",
                        StartTime = x.StartTime,
                        EndTime = x.EndTime,
                        NoteVn = x.NoteVn,
                        NoteJp = x.NoteJp,
                        MonthToDate = x.MonthToDate,
                        YearToDate = x.YearToDate,
                        IsEligibleForMeal = (decimal)(x.EndTime - x.StartTime).TotalHours >= mainMealTicketMinHours,
                        DidEat = x.DidEat,
                        IsRemoved = x.IsRemoved,
                        RemovedByUserName = x.RemovedByUserName,
                        RemovedByFullName = x.RemovedByFullName,
                        RemovedAtLevel = x.RemovedAtLevel,
                        RemovedAt = x.RemovedAt,
                        RemoveReason = x.RemoveReason
                    }).ToList()
                }).ToList()
            };
        }

        // Người nhận luôn là mọi UserName giữ UserApprovalScope(ApprovalLevel=DepartmentManager) khớp
        // Department của batch (hoặc ScopeType.All) — tái dùng ResolveEligibleApproverUserNamesAsync với
        // groupId: 0 (sentinel không khớp Group nào, vì batch gom nhiều Group, không gắn 1 Group cụ thể).
        private async Task NotifyBatchApproversAsync(OtFormBatch batch, bool isReminder)
        {
            var approverUserNames = await ResolveEligibleApproverUserNamesAsync(ApprovalLevel.DepartmentManager, batch.DepartmentId, groupId: 0);
            if (approverUserNames.Count == 0) return;

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == batch.DepartmentId);
            var departmentName = FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp);

            var pendingForms = await _unitOfWork.OtForms.FindAsync(x =>
                x.OtFormBatchId == batch.Id && !x.IsDeleted && x.Status == (int)OtFormStatus.Pending);
            var formCount = pendingForms.Count;
            var employeeCount = pendingForms.Sum(x => x.NumberOfEmployee);
            var totalHour = pendingForms.Sum(x => x.TotalHour);

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var hasNewToken = false;

            foreach (var approverUserName in approverUserNames)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(approverUserName);
                if (string.IsNullOrWhiteSpace(email)) continue;

                var emailToken = new OtFormBatchEmailToken
                {
                    OtFormBatchId = batch.Id,
                    ApproverUserName = approverUserName,
                    ApproverFullName = fullName,
                    IsReminder = isReminder,
                    Token = TokenHelper.GenerateSecureToken(),
                    ExpiresAt = now.AddDays(EmailApprovalTokenExpiryDays),
                    CreatedAt = now
                };
                await _unitOfWork.OtFormBatchEmailTokens.AddAsync(emailToken);
                hasNewToken = true;

                var link = $"{baseUrl}/xac-nhan-don-tong?token={emailToken.Token}";

                try
                {
                    var html = _emailTemplateRenderer.Render("OtForm/BatchApprovalNotification.html", new Dictionary<string, string>
                    {
                        ["ApproverFullName"] = fullName ?? approverUserName,
                        ["OtFormBatchId"] = batch.Id.ToString(),
                        ["DepartmentName"] = departmentName,
                        ["BatchDate"] = batch.BatchDate.ToString("dd/MM/yyyy"),
                        ["FormCount"] = formCount.ToString(),
                        ["EmployeeCount"] = employeeCount.ToString(),
                        ["TotalHour"] = totalHour.ToString("0.##"),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    });

                    var subject = isReminder
                        ? $"[Nhắc nhở] Đơn tổng #{batch.Id} đang chờ bạn duyệt - YevManagement"
                        : $"Đơn tổng #{batch.Id} đang chờ bạn duyệt - YevManagement";

                    await _emailService.SendAsync(email, subject, html);
                }
                catch (FileNotFoundException)
                {
                    // A missing template file is a deployment error — skip this recipient rather than
                    // blocking the whole sweep, same principle as NotifyEligibleApproversAsync.
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        private async Task<OtFormBatchEmailToken> ResolveBatchEmailTokenAsync(string token, bool requireUnused)
        {
            var emailToken = await _unitOfWork.OtFormBatchEmailTokens.FirstOrDefaultAsync(x => x.Token == token);
            emailToken.OrThrowNotFound("Link duyệt đơn tổng qua email", token);

            if (emailToken!.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link duyệt đơn tổng qua email đã hết hạn.");

            if (requireUnused && emailToken.UsedAt != null)
                throw new DomainException("Link duyệt đơn tổng này đã được sử dụng.");

            return emailToken;
        }
    }
}
