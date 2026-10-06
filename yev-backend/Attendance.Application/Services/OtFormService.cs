using System.Linq.Expressions;
using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.JobTitles;
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
using static Attendance.Application.Services.MealTicketCalculator;

namespace Attendance.Application.Services
{
    // Giai đoạn 3.1 (2026-08-07) — wiring Cây chức vụ (JobTitle/DepartmentApprovalStep) vào luồng
    // duyệt OT THẬT, thay thế hoàn toàn Submitter/GroupHead/UserApprovalScope/ApprovalLevel cũ. Xem
    // docs/attendance-module.md §Cây chức vụ. Không cần tương thích ngược — toàn bộ dữ liệu OT cũ đã
    // bị xoá cùng đợt migrate này (dữ liệu dev).
    public class OtFormService : BaseService<IAttendanceUnitOfWork>, IOtFormService
    {
        private const int EmailApprovalTokenExpiryDays = 3;

        // Shared by all list endpoints (my-forms/pending-approvals/my-actions/my-participations) —
        // avoids repeating the same Select block in 4 places.
        private static readonly Expression<Func<OtForm, OtFormListItemDto>> ToListItemDto = x => new OtFormListItemDto
        {
            Id = x.Id,
            GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
            GroupNameJp = x.Group != null ? x.Group.GroupNameJp : null,
            IsProductionForm = x.IsProductionForm,
            DepartmentNameVn = x.Department.DepartmentNameVn,
            DepartmentNameJp = x.Department.DepartmentNameJp,
            OtCaseCode = x.OtCase.Code,
            Date = x.Date,
            TotalHour = x.TotalHour,
            NumberOfEmployee = x.NumberOfEmployee,
            CreatedByUserName = x.CreatedByUserName,
            CreatedByFullName = x.CreatedByFullName,
            Status = x.Status,
            // Giai đoạn 5 (2026-08-27): đơn "theo chuyền" sửa được theo TỪNG BƯỚC (xem UpdateAsync) nên
            // "có bước nào Approved chưa" không còn chặn — chỉ cần đơn còn InApproval là VẪN CÓ NGƯỜI
            // sửa được (đúng là ai thì FE/Service tự kiểm khi gọi PUT). Đơn theo Nhóm giữ nguyên luật cũ.
            IsEditable = x.Status == (int)OtFormStatus.InApproval &&
                (x.IsProductionForm || !x.ApprovalSteps.Any(s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Approved)),
            ApprovalSummary = x.OtFormApprovalHistories
                .OrderBy(h => h.ActionAt)
                .Select(h => new ApprovalSummaryItemDto
                {
                    StepOrder = h.OtFormApprovalStep.StepOrder,
                    JobTitleNameSnapshot = h.OtFormApprovalStep.JobTitleNameSnapshot,
                    ApproverUserName = h.ApproverUserName,
                    ApproverFullName = h.ApproverFullName,
                    Action = h.Action,
                    ActionAt = h.ActionAt
                }).ToList(),
            CurrentStepCandidateCount = x.ApprovalSteps
                .Where(s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending)
                .OrderBy(s => s.StepOrder)
                .Select(s => (int?)s.Candidates.Count)
                .FirstOrDefault() ?? 0
        };

        // Lọc chung cho các endpoint danh sách đơn — fromDate/toDate theo OtForm.Date (bao gồm 2 đầu
        // mút), status theo đúng giá trị OtFormStatus, cả 3 đều optional (2026-08-06).
        private static IQueryable<OtForm> ApplyListFilters(IQueryable<OtForm> query, DateOnly? fromDate, DateOnly? toDate, int? status)
        {
            if (fromDate.HasValue) query = query.Where(x => x.Date >= fromDate.Value);
            if (toDate.HasValue) query = query.Where(x => x.Date <= toDate.Value);
            if (status.HasValue) query = query.Where(x => x.Status == status.Value);
            return query;
        }

        // Lọc theo Bộ phận/Nhóm cho đơn văn phòng (2026-09-04) — song song ApplyProductionFilterAsync
        // bên dưới, dùng chung cho mọi endpoint danh sách (trước đây không tab nào lọc được theo 2 field
        // này dù OtFormListItemDto đã hiển thị sẵn). Vô hại với đơn theo chuyền (vẫn có DepartmentId).
        private static IQueryable<OtForm> ApplyOfficeFilter(IQueryable<OtForm> query, int? groupId, int? departmentId)
        {
            if (groupId.HasValue) query = query.Where(x => x.GroupId == groupId.Value);
            if (departmentId.HasValue) query = query.Where(x => x.DepartmentId == departmentId.Value);
            return query;
        }

        // Lọc theo Line/Team/Nhóm ca cho đơn dưới chuyền — tách ra từ GetPendingApprovalsAsync
        // (2026-09-04) để dùng chung cho MỌI endpoint danh sách, không riêng "Chờ tôi duyệt" nữa. So
        // trực tiếp với BlockCodeSnapshot/TeamCodeSnapshot/ShiftTeamCodeSnapshot đã lưu trên
        // OtFormEmployee (KHÔNG join ProductionEmployee sống, giữ đúng tinh thần snapshot-tại-thời-điểm-tạo).
        private async Task<IQueryable<OtForm>> ApplyProductionFilterAsync(
            IQueryable<OtForm> query, int? productionLineId, int? productionTeamId, int? productionShiftTeamId)
        {
            if (!productionLineId.HasValue && !productionTeamId.HasValue && !productionShiftTeamId.HasValue) return query;

            var lineCode = productionLineId.HasValue
                ? (await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.Id == productionLineId.Value && !x.IsDeleted))?.LineCode
                : null;
            var teamCode = productionTeamId.HasValue
                ? (await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.Id == productionTeamId.Value && !x.IsDeleted))?.Code
                : null;
            var shiftTeamCode = productionShiftTeamId.HasValue
                ? (await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Id == productionShiftTeamId.Value && !x.IsDeleted))?.Code
                : null;

            if (lineCode != null)
                query = query.Where(x => x.OtFormEmployees.Any(e => !e.IsRemoved && e.BlockCodeSnapshot == lineCode));
            if (teamCode != null)
                query = query.Where(x => x.OtFormEmployees.Any(e => !e.IsRemoved && e.TeamCodeSnapshot == teamCode));
            if (shiftTeamCode != null)
                query = query.Where(x => x.OtFormEmployees.Any(e => !e.IsRemoved && e.ShiftTeamCodeSnapshot == shiftTeamCode));

            return query;
        }

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;
        private readonly ISecondaryPasswordService _secondaryPasswordService;
        private readonly IAttendanceSettingService _attendanceSettingService;
        private readonly IJobTitleApprovalChainService _jobTitleApprovalChainService;
        private readonly IBackgroundTaskQueue _taskQueue;

        public OtFormService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration,
            ISecondaryPasswordService secondaryPasswordService,
            IAttendanceSettingService attendanceSettingService,
            IJobTitleApprovalChainService jobTitleApprovalChainService,
            IBackgroundTaskQueue taskQueue) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
            _secondaryPasswordService = secondaryPasswordService;
            _attendanceSettingService = attendanceSettingService;
            _jobTitleApprovalChainService = jobTitleApprovalChainService;
            _taskQueue = taskQueue;
        }

        // Đưa việc gửi mail duyệt vào hàng đợi nền thay vì await trực tiếp — Create/Approve đã
        // SaveChangesAsync xong PHẦN NGHIỆP VỤ CHÍNH trước khi gọi hàm này (xem 2 điểm gọi trong
        // CreateAsync/ApproveAsync), nên hoãn việc gửi mail không ảnh hưởng tính đúng đắn, chỉ giúp
        // response trả về ngay mà không đợi round-trip SMTP tới VNMAIL04 (có thể vài trăm ms tới vài
        // giây mỗi người nhận). Chỉ truyền Id thuần (không truyền entity đã load) vì scope DI của
        // request sẽ bị dispose trước khi tác vụ nền thực sự chạy (2026-09-03).
        private void QueueStepApprovalNotification(int otFormId, int otFormApprovalStepId)
        {
            _taskQueue.QueueBackgroundWorkItem(async (sp, _) =>
            {
                var otFormService = sp.GetRequiredService<IOtFormService>();
                await otFormService.SendStepApprovalNotificationAsync(otFormId, otFormApprovalStepId);
            });
        }

        public async Task SendStepApprovalNotificationAsync(int otFormId, int otFormApprovalStepId)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == otFormId);
            if (otForm == null) return;

            var step = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.Id == otFormApprovalStepId, x => x.Candidates)).FirstOrDefault();
            if (step == null) return;

            await NotifyEligibleApproversAsync(otForm, step);
        }

        // Notify the form's creator (not the approvers) when the form is rejected or employees are removed
        // from it. Same background-queue rationale as QueueStepApprovalNotification: callers have already
        // saved the business change, so a slow/failed SMTP round-trip must not affect the response.
        private void QueueRejectedNotification(int otFormId)
        {
            _taskQueue.QueueBackgroundWorkItem(async (sp, _) =>
            {
                var otFormService = sp.GetRequiredService<IOtFormService>();
                await otFormService.SendRejectedNotificationAsync(otFormId);
            });
        }

        private void QueueEmployeesRemovedNotification(int otFormId, List<int> employeeIds)
        {
            if (employeeIds.Count == 0) return;

            _taskQueue.QueueBackgroundWorkItem(async (sp, _) =>
            {
                var otFormService = sp.GetRequiredService<IOtFormService>();
                await otFormService.SendEmployeesRemovedNotificationAsync(otFormId, employeeIds);
            });
        }

        public async Task SendRejectedNotificationAsync(int otFormId)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == otFormId);
            if (otForm == null) return;

            var rejection = (await _unitOfWork.OtFormApprovalHistories.FindAsync(
                x => x.OtFormId == otFormId && x.Action == (int)ApprovalAction.Rejected))
                .OrderByDescending(x => x.ActionAt).FirstOrDefault();
            if (rejection == null || rejection.ApproverUserName == otForm.CreatedByUserName) return;

            var detailBlock = BuildRequesterDetailRow("LÝ DO TỪ CHỐI", "却下理由",
                string.IsNullOrWhiteSpace(rejection.Comment) ? "-" : WebUtility.HtmlEncode(rejection.Comment),
                RejectedAccentColor);

            await SendRequesterNotificationAsync(
                otForm,
                actorFullName: rejection.ApproverFullName ?? rejection.ApproverUserName,
                subject: $"[TỪ CHỐI] Đơn tăng ca #{otForm.Id} đã bị từ chối - YevManagement",
                statusLabelVn: "ĐƠN TĂNG CA ĐÃ BỊ TỪ CHỐI", statusLabelJp: "残業申請が却下されました",
                introVn: "Đơn tăng ca bạn đã lập đã bị từ chối. Vui lòng xem lý do bên dưới và lập đơn mới nếu cần.",
                introJp: "作成された残業申請が却下されました。下記の理由をご確認のうえ、必要に応じて再度申請してください。",
                detailBlock, RejectedAccentColor);
        }

        public async Task SendEmployeesRemovedNotificationAsync(int otFormId, List<int> employeeIds)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == otFormId);
            if (otForm == null) return;

            var removedRows = (await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == otFormId && employeeIds.Contains(x.EmployeeId) && x.IsRemoved, x => x.Employee))
                .Where(x => x.RemovedByUserName != otForm.CreatedByUserName)
                .ToList();
            if (removedRows.Count == 0) return;

            var employeeLinesHtml = string.Join("<br>", removedRows.Select(x =>
            {
                var line = $"{x.Employee.Code} - {x.Employee.LastName} {x.Employee.FirstName}";
                if (!string.IsNullOrWhiteSpace(x.RemoveReason)) line += $" ({x.RemoveReason})";
                return WebUtility.HtmlEncode(line);
            }));
            var detailBlock = BuildRequesterDetailRow("NHÂN VIÊN BỊ LOẠI KHỎI ĐƠN", "除外された従業員", employeeLinesHtml, EmployeesRemovedAccentColor);

            var first = removedRows[0];
            await SendRequesterNotificationAsync(
                otForm,
                actorFullName: first.RemovedByFullName ?? first.RemovedByUserName ?? "-",
                subject: $"Đơn tăng ca #{otForm.Id}: có nhân viên bị loại khỏi đơn - YevManagement",
                statusLabelVn: "NHÂN VIÊN BỊ LOẠI", statusLabelJp: "従業員が除外されました",
                introVn: "Người duyệt đã loại nhân viên khỏi đơn tăng ca bạn lập. Đơn vẫn được xử lý tiếp với các nhân viên còn lại.",
                introJp: "作成された残業申請から従業員が除外されました。申請は残りの従業員で引き続き処理されます。",
                detailBlock, EmployeesRemovedAccentColor);
        }

        private async Task SendRequesterNotificationAsync(
            OtForm otForm, string actorFullName, string subject,
            string statusLabelVn, string statusLabelJp, string introVn, string introJp, string detailBlock, string accentColor)
        {
            var (email, requesterFullName) = await _userDirectoryService.GetContactInfoAsync(otForm.CreatedByUserName, EmailModules.Attendance);
            if (string.IsNullOrWhiteSpace(email)) return;

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == otForm.GroupId);
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == otForm.DepartmentId);

            try
            {
                var html = _emailTemplateRenderer.Render("OtForm/RequesterNotification.html", new Dictionary<string, string>
                {
                    ["OtFormId"] = otForm.Id.ToString(),
                    ["RequesterFullName"] = WebUtility.HtmlEncode(requesterFullName ?? otForm.CreatedByFullName ?? otForm.CreatedByUserName),
                    ["ActorFullName"] = WebUtility.HtmlEncode(actorFullName),
                    ["DepartmentName"] = WebUtility.HtmlEncode(FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp)),
                    ["GroupName"] = WebUtility.HtmlEncode(FormatBilingual(group?.GroupNameVn, group?.GroupNameJp)),
                    ["OtFormDate"] = otForm.Date.ToString("dd/MM/yyyy"),
                    ["OtFormTime"] = $"{otForm.StartTime:HH\\:mm} - {otForm.EndTime:HH\\:mm}",
                    ["StatusLabelVn"] = statusLabelVn,
                    ["StatusLabelJp"] = statusLabelJp,
                    ["IntroVn"] = introVn,
                    ["IntroJp"] = introJp,
                    ["DetailBlock"] = detailBlock,
                    ["AccentColor"] = accentColor,
                    ["DetailLink"] = $"{_configuration["AppSettings:FrontendBaseUrl"]}/ot/forms?id={otForm.Id}"
                });

                await _emailService.SendAsync(email, subject, html);
            }
            catch (FileNotFoundException)
            {
                // A missing template file is a deployment error — must not break the business flow.
            }
        }

        private const string RejectedAccentColor = "#c0182b";
        private const string EmployeesRemovedAccentColor = "#b45309";

        // 1 full-width highlighted row (accent left border) of the outcome-specific block;
        // valueHtml must already be HTML-encoded.
        private static string BuildRequesterDetailRow(string labelVn, string labelJp, string valueHtml, string accentColor) =>
            $"<tr><td colspan=\"2\" style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; padding:14px 16px; background-color:#fbf3f4; border-left:4px solid {accentColor}; border-bottom:1px solid #e7e9ee;\">" +
            "<span style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; display:block; font-size:11px; letter-spacing:0.5px; color:#9aa2b1; mso-line-height-rule:exactly; line-height:16px;\">" +
            $"{labelVn}&nbsp;/&nbsp;{labelJp}</span>" +
            $"<span style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; display:block; font-size:15px; font-weight:bold; color:{accentColor}; margin-top:4px; mso-line-height-rule:exactly; line-height:22px;\">" +
            $"{valueHtml}</span></td></tr>";

        public async Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.CreatedByUserName == userName);
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // Đơn đang chờ CHÍNH người gọi duyệt — "bước đang chờ xử lý" của 1 đơn là bước Pending có
        // StepOrder NHỎ NHẤT (các bước Pending StepOrder lớn hơn chưa tới lượt, chưa hiển thị cho ai —
        // xem OtFormApprovalStep). 2026-08-07, Giai đoạn 3.1 — thay thế hoàn toàn UserApprovalScope cũ.
        private async Task<List<int>> GetMyCurrentPendingFormIdsAsync(string approverUserName)
        {
            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.SelectAsync(
                predicate: s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending,
                selector: s => new { s.Id, s.OtFormId, s.StepOrder });

            var currentStepIds = pendingSteps
                .GroupBy(s => s.OtFormId)
                .Select(g => g.OrderBy(s => s.StepOrder).First().Id)
                .ToHashSet();

            return (await _unitOfWork.OtFormApprovalStepCandidates.SelectAsync(
                predicate: c => c.UserName == approverUserName,
                selector: c => new { c.OtFormApprovalStepId, c.OtFormApprovalStep.OtFormId }))
                .Where(c => currentStepIds.Contains(c.OtFormApprovalStepId))
                .Select(c => c.OtFormId)
                .Distinct()
                .ToList();
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null)
        {
            var myCurrentFormIds = await GetMyCurrentPendingFormIdsAsync(approverUserName);

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval && myCurrentFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderBy(x => x.Date);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // Hiện Line/Ca trên lưới Duyệt hàng loạt (2026-09-04) — truy vấn riêng SAU khi đã phân trang
        // (không nhét string.Join/Distinct vào ToListItemDto vì đây là 1 Expression dùng chung cho
        // nhiều query khác, rủi ro không dịch được sang SQL) — gộp Distinct ở phía C#.
        private async Task EnrichWithProductionLineInfoAsync(IReadOnlyList<OtFormListItemDto> items)
        {
            var productionFormIds = items.Where(x => x.IsProductionForm).Select(x => x.Id).ToList();
            if (productionFormIds.Count == 0) return;

            var rows = await _unitOfWork.OtFormEmployees.SelectAsync(
                predicate: x => productionFormIds.Contains(x.OtFormId) && !x.IsRemoved,
                selector: x => new { x.OtFormId, x.BlockCodeSnapshot, x.ShiftTeamCodeSnapshot });

            var rowsByFormId = rows.GroupBy(x => x.OtFormId).ToDictionary(g => g.Key, g => g.ToList());
            foreach (var item in items)
            {
                if (!rowsByFormId.TryGetValue(item.Id, out var formRows)) continue;
                item.ProductionLineNames = string.Join(", ",
                    formRows.Select(x => x.BlockCodeSnapshot).Where(x => !string.IsNullOrEmpty(x)).Distinct());
                item.ProductionShiftTeamNames = string.Join(", ",
                    formRows.Select(x => x.ShiftTeamCodeSnapshot).Where(x => !string.IsNullOrEmpty(x)).Distinct());
            }
        }

        // Số đơn chưa duyệt theo TỪNG ngày (2026-09-04) — lịch mini ở màn Duyệt hàng loạt, cùng scoping
        // GetMyCurrentPendingFormIdsAsync với GetPendingApprovalsAsync.
        public async Task<List<PendingApprovalDateCountDto>> GetPendingApprovalDatesAsync(
            string approverUserName, DateOnly fromDate, DateOnly toDate)
        {
            var myCurrentFormIds = await GetMyCurrentPendingFormIdsAsync(approverUserName);
            if (myCurrentFormIds.Count == 0) return new List<PendingApprovalDateCountDto>();

            var dates = await _unitOfWork.OtForms.SelectAsync(
                predicate: x => !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval && myCurrentFormIds.Contains(x.Id)
                    && x.Date >= fromDate && x.Date <= toDate,
                selector: x => x.Date);

            return dates.GroupBy(x => x)
                .Select(g => new PendingApprovalDateCountDto { Date = g.Key, Count = g.Count() })
                .OrderBy(x => x.Date)
                .ToList();
        }

        // Đếm nhanh cho badge sidebar FE — không phân trang/không map DTO, chỉ COUNT (2026-08-19).
        public async Task<int> GetPendingApprovalsCountAsync(string approverUserName)
        {
            var myCurrentFormIds = await GetMyCurrentPendingFormIdsAsync(approverUserName);
            if (myCurrentFormIds.Count == 0) return 0;

            return await _unitOfWork.OtForms.CountAsync(
                _unitOfWork.OtForms.GetQueryable(false),
                x => !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval && myCurrentFormIds.Contains(x.Id));
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null)
        {
            var actedFormIds = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => h.ApproverUserName == userName, h => h.OtFormId);
            var distinctFormIds = actedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (employee == null)
                return new PagedResponse<OtFormListItemDto>(new List<OtFormListItemDto>(), 0, pageIndex, pageSize);

            var participatedFormIds = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.EmployeeId == employee.Id, x => x.OtFormId);
            var distinctFormIds = participatedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // "Tất cả đơn" — Admin xem/quản lý toàn bộ đơn tăng ca, không phân biệt người tạo hay phạm vi
        // duyệt (2026-09-04, gate bằng Attendance.OTForm.ViewAll — CHỈ gán cho Admin, xem migration
        // AddOtFormViewAllPermission, cùng cách làm với Attendance.OTForm.Delete).
        public async Task<PagedResponse<OtFormListItemDto>> GetAllFormsAsync(
            int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted);
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        public async Task<OtFormDto> GetByIdAsync(int id)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.Group!, x => x.Department, x => x.Reason, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var employees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == id, x => x.Employee);

            var processPart = await _unitOfWork.ProcessParts.FirstOrDefaultAsync(x => x.OtFormId == id);

            var histories = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                predicate: x => x.OtFormId == id,
                selector: x => new OtFormApprovalHistoryDto
                {
                    ApproverUserName = x.ApproverUserName,
                    ApproverFullName = x.ApproverFullName,
                    StepOrder = x.OtFormApprovalStep.StepOrder,
                    JobTitleNameSnapshot = x.OtFormApprovalStep.JobTitleNameSnapshot,
                    Action = x.Action,
                    Comment = x.Comment,
                    HasSignature = x.SignatureImage != null,
                    SignatureImage = x.SignatureImage,
                    ActionAt = x.ActionAt
                });

            var steps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == id && !x.IsDeleted, x => x.Candidates);
            var orderedSteps = steps.OrderBy(x => x.StepOrder).ToList();

            var editLogs = await _unitOfWork.OtFormEditLogs.SelectAsync(
                predicate: x => x.OtFormId == id,
                selector: x => new OtFormEditLogDto
                {
                    ActionByUserName = x.ActionByUserName,
                    ActionByFullName = x.ActionByFullName,
                    ActionAt = x.ActionAt,
                    ActionType = x.ActionType,
                    EmployeeId = x.EmployeeId,
                    EmployeeCodeSnapshot = x.EmployeeCodeSnapshot,
                    FieldName = x.FieldName,
                    OldValue = x.OldValue,
                    NewValue = x.NewValue
                });

            // Giai đoạn 5 (2026-08-27) — xem ghi chú ở ToListItemDto.IsEditable.
            var isEditable = otForm!.Status == (int)OtFormStatus.InApproval &&
                (otForm.IsProductionForm || orderedSteps.All(s => s.Status != (int)OtFormApprovalStepStatus.Approved));

            var mealSettings = await _attendanceSettingService.GetAsync();

            return new OtFormDto
            {
                Id = otForm.Id,
                GroupId = otForm.GroupId,
                GroupNameVn = otForm.Group?.GroupNameVn,
                GroupNameJp = otForm.Group?.GroupNameJp,
                IsProductionForm = otForm.IsProductionForm,
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
                CreatedAt = otForm.CreatedAt,
                CreatorSignatureImage = otForm.CreatorSignatureImage,
                Status = otForm.Status,
                IsEditable = isEditable,
                ApprovalChainWarning = otForm.ApprovalChainWarning,
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
                    CustomMonthlyOtHourLimit = x.Employee.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.Employee.CustomYearlyOtHourLimit,
                    MealTicketType = (int)CalculateMealTicketType(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                    ActualHours = CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                    DidEat = x.DidEat,
                    IsRemoved = x.IsRemoved,
                    RemovedByUserName = x.RemovedByUserName,
                    RemovedByFullName = x.RemovedByFullName,
                    RemovedAtLevel = x.RemovedAtLevel,
                    RemovedAt = x.RemovedAt,
                    RemoveReason = x.RemoveReason,
                    CongDoanSnapshot = x.CongDoanSnapshot,
                    TaskNameSnapshot = x.TaskNameSnapshot,
                    BlockCodeSnapshot = x.BlockCodeSnapshot,
                    TeamCodeSnapshot = x.TeamCodeSnapshot,
                    ShiftTeamCodeSnapshot = x.ShiftTeamCodeSnapshot
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
                ApprovalHistories = histories.OrderBy(x => x.ActionAt).ToList(),
                EditLogs = editLogs.OrderByDescending(x => x.ActionAt).ToList(),
                ApprovalSteps = orderedSteps.Select(s => new OtFormApprovalStepDto
                {
                    Id = s.Id,
                    StepOrder = s.StepOrder,
                    JobTitleCodeSnapshot = s.JobTitleCodeSnapshot,
                    JobTitleNameSnapshot = s.JobTitleNameSnapshot,
                    RequiresSignatureSnapshot = s.RequiresSignatureSnapshot,
                    IsResponsibleSnapshot = s.IsResponsibleSnapshot,
                    TerminalLevelSnapshot = s.TerminalLevelSnapshot,
                    Status = s.Status,
                    Candidates = s.Candidates.Select(c => new OtFormApprovalStepCandidateDto
                    {
                        EmployeeId = c.EmployeeId,
                        UserName = c.UserName,
                        FullName = c.FullName
                    }).ToList()
                }).ToList()
            };
        }

        public async Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            // KHÔNG hỗ trợ ca qua đêm (2026-08-26, theo yêu cầu người dùng) — giờ kết thúc phải SAU giờ
            // bắt đầu trong CÙNG ngày. Chặn ở đây trước khi làm gì khác, vì ValidateEmployeesAsync bên
            // dưới so TimeOnly trực tiếp không tính ngày — nếu EndTime < StartTime lọt qua, validate đó
            // sẽ sai lệch (coi StartTime/EndTime của đơn như 1 mốc giờ trong ngày, không phải khoảng).
            if (request.EndTime <= request.StartTime)
                throw new DomainException("Giờ kết thúc phải sau giờ bắt đầu (không hỗ trợ ca qua đêm).");

            // Mật khẩu cấp 2 bắt buộc khi tạo đơn (2026-08-28, theo yêu cầu người dùng) — verify SỚM,
            // trước khi làm bất kỳ việc gì khác, cùng nguyên tắc với ApproveAsync/RejectAsync.
            await _secondaryPasswordService.VerifyAsync(createdByUserName, request.SecondaryPassword);

            if (request.IsProductionForm)
                return await CreateProductionFormAsync(createdByUserName, createdByFullName, isAdmin, request);

            if (!request.GroupId.HasValue)
                throw new DomainException("Đơn theo Nhóm phải chọn Nhóm.");
            var groupId = request.GroupId.Value;

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", groupId);

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            if (group!.DepartmentId != request.DepartmentId)
                throw new DomainException($"Nhóm '{group.GroupNameVn}' không thuộc Bộ phận đã chọn.");

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            // Ai được tạo đơn cho Group này — CHỈ nhân viên thuộc đúng Group đó, hoặc Admin (2026-08-07,
            // Giai đoạn 3.1 — thay cho UserApprovalScope(Submitter) cũ). creatorEmployee (nếu có) cũng
            // chính là "người tạo" dùng để suy luận chuỗi duyệt Cây chức vụ bên dưới.
            var creatorEmployee = await EnsureCanCreateOrEditForScopeAsync(createdByUserName, isAdmin, groupId);

            var validatedEmployees = await ValidateEmployeesAsync(groupId, request.StartTime, request.EndTime, request.Employees);

            await EnsureOtCaseMatchesRulesAsync(request, isProductionForm: false, otCase!);

            // Kiểm tra trùng giờ tăng ca — 1 nhân viên không được xuất hiện trong 2 đơn tăng ca có
            // giờ chồng chéo trong cùng 1 ngày. Chỉ xét các đơn chưa bị xóa và chưa bị từ chối.
            var employeeTimes = request.Employees.ToDictionary(
                x => x.EmployeeId, x => (x.StartTime ?? request.StartTime, x.EndTime));
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, employeeTimes, excludeFormId: null);

            // Suy luận chuỗi duyệt tự động qua Cây chức vụ (2026-08-07, Giai đoạn 3.1) — Admin tạo hộ
            // (creatorEmployee null) coi như đứng ở cấp thấp nhất, không loại bước nào khỏi cây duyệt
            // của Department (xem JobTitleApprovalChainService.ResolveChainForCreationAsync). KHÔNG
            // chặn tạo đơn nếu chuỗi không đủ (plan §3 quyết định #10) — đơn vẫn tạo, kẹt ở bước thiếu
            // candidate, ApprovalChainWarning phản ánh rõ cho FE hiển thị cảnh báo.
            var chainResult = await _jobTitleApprovalChainService.ResolveChainForCreationAsync(
                creatorEmployee?.Id, groupId, request.DepartmentId, request.OtCaseId);

            var creatorSignatureImage = await ResolveCreatorSelfSignAsync(createdByUserName, chainResult);

            var newOtForm = new OtForm
            {
                GroupId = groupId,
                IsProductionForm = false,
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
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                CreatorSignatureImage = creatorSignatureImage,
                // Không còn giai đoạn Draft (2026-08-06 đã chốt) — tạo đơn = vào chuỗi ngay lập tức.
                // CHỈ hoàn tất ngay khi Steps.Count == 0 VÀ IsComplete == true — tức người tạo đã ở cấp
                // bằng/cao hơn cấp duyệt cuối (không có bước nào để duyệt). KHÔNG được chỉ xét
                // IsComplete: preview cũng trả IsComplete=true khi chuỗi có ĐỦ bước thật + đủ candidate
                // (chuỗi "sẵn sàng", không phải "đã xong") — nếu chỉ xét IsComplete thì mọi đơn có chuỗi
                // duyệt hợp lệ đều bị đánh dấu Completed ngay từ lúc tạo, sai hoàn toàn. Trường hợp
                // Phòng ban chưa cấu hình chuỗi (Steps.Count == 0, IsComplete=false, có
                // ApprovalChainWarning) đúng ra vẫn rơi vào nhánh else → InApproval, kẹt lại để Admin
                // cấu hình xong mới xử lý tiếp (plan §3 quyết định #10).
                Status = (chainResult.Steps.Count == 0 && chainResult.IsComplete)
                    ? (int)OtFormStatus.Completed
                    : (int)OtFormStatus.InApproval,
                ApprovalChainWarning = chainResult.Warning,
                IsDeleted = false
            };

            return await FinalizeCreateAsync(newOtForm, request, chainResult, productionEmployeesByEmployeeId: null);
        }

        // Đơn "theo chuyền" (OtForm.IsProductionForm = true, 2026-08-24) — chọn nhân viên qua
        // ProductionEmployee thay vì theo Group cố định, xem docs/docs-be/attendance-module.md
        // §Cây chức vụ & Cây duyệt. Không có Group để check "ai được tạo đơn cho Group này" như Mode A.
        //
        // Ai được tạo đơn theo chuyền do QUYỀN quyết định (Attendance.OTForm.CreateProduction, kiểm ở
        // OtFormController.Create, cấu hình theo Chức vụ/từng user) — không còn ép "phải là Line Leader
        // của Line trong đơn" như trước (2026-09-26). Người thường vẫn cần liên kết với 1 Employee để
        // suy luận chuỗi duyệt.
        private async Task<OtFormDto> CreateProductionFormAsync(
            string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            var employeeIds = request.Employees.Select(x => x.EmployeeId).ToList();

            Employee? creatorEmployee = null;
            if (!isAdmin)
            {
                creatorEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.UserName == createdByUserName && !x.IsDeleted, x => x.JobTitle!);
                if (creatorEmployee == null)
                    throw new DomainException("Tài khoản chưa liên kết với nhân viên nào. Liên hệ Admin nếu tài khoản chưa liên kết đúng nhân viên.");
            }

            // Nhóm ca bắt buộc trước khi tạo đơn (2026-08-28, theo yêu cầu người dùng) — phòng vệ thêm
            // cho dữ liệu cũ/nhập tay ngoài Import; Import đã chặn "Thiếu mã NHOM" từ 2026-08-24 (xem
            // ProductionEmployeeImportService.ValidateAndResolveRowsAsync) nên trường hợp này hiếm gặp.
            var productionEmployeesForCheck = await _unitOfWork.ProductionEmployees.FindAsync(
                x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted);
            var missingShiftTeam = productionEmployeesForCheck.Where(x => x.ShiftTeamId == null).Select(x => x.EmployeeCode).ToList();
            if (missingShiftTeam.Count > 0)
                throw new DomainException($"Nhân viên chưa có Nhóm ca, cần cập nhật trước khi tạo đơn: {string.Join(", ", missingShiftTeam)}.");

            // Phạm vi Line (2026-09-28, theo quyết định người dùng) — có quyền
            // Attendance.OTForm.CreateProduction KHÔNG có nghĩa được tạo đơn cho MỌI Line, chỉ được tạo
            // cho (những) Line mà chính người tạo đang là Line Leader (IsLeader=true). Admin bỏ qua.
            //
            // Phải khớp TOÀN BỘ Line trong đơn, không phải chỉ cần giao nhau ≥ 1 phần tử (sửa lỗi
            // 2026-09-29: bản cũ dùng "isLineLeaderOfAnyLine" nên Line Leader của Line A có thể nhét
            // thêm nhân viên Line B/C mà mình không quản lý, chỉ cần đơn có ít nhất 1 người của Line A).
            if (!isAdmin)
            {
                var orderLineIds = productionEmployeesForCheck
                    .Where(x => x.ProductionLineId.HasValue)
                    .Select(x => x.ProductionLineId!.Value)
                    .Distinct()
                    .ToList();
                var leaderLineIds = (await _unitOfWork.ProductionEmployees.FindAsync(
                    x => x.EmployeeId == creatorEmployee!.Id && x.IsLeader && !x.IsDeleted && x.ProductionLineId.HasValue))
                    .Select(x => x.ProductionLineId!.Value)
                    .ToHashSet();
                if (orderLineIds.Count == 0 || !orderLineIds.All(leaderLineIds.Contains))
                    throw new DomainException("Bạn chỉ được tạo đơn cho nhân viên thuộc (những) Line mà mình là Line Leader.");
            }

            var validatedEmployees = await ValidateEmployeesAsync(null, request.StartTime, request.EndTime, request.Employees);

            await EnsureOtCaseMatchesRulesAsync(request, isProductionForm: true, otCase!);

            var employeeTimes = request.Employees.ToDictionary(
                x => x.EmployeeId, x => (x.StartTime ?? request.StartTime, x.EndTime));
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, employeeTimes, excludeFormId: null);

            var chainResult = await _jobTitleApprovalChainService.ResolveChainForProductionCreationAsync(
                creatorEmployee?.Id, request.DepartmentId, employeeIds, request.OtCaseId);

            var creatorSignatureImage = await ResolveCreatorSelfSignAsync(createdByUserName, chainResult);

            var newOtForm = new OtForm
            {
                GroupId = null,
                IsProductionForm = true,
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
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                CreatorSignatureImage = creatorSignatureImage,
                Status = (chainResult.Steps.Count == 0 && chainResult.IsComplete)
                    ? (int)OtFormStatus.Completed
                    : (int)OtFormStatus.InApproval,
                ApprovalChainWarning = chainResult.Warning,
                IsDeleted = false
            };

            // ProductionEmployee đổi hàng ngày — chụp lại đúng trạng thái LÚC tạo đơn thành snapshot
            // trên OtFormEmployee (xem OtFormEmployee.CongDoanSnapshot), không đọc lại sau này.
            var productionEmployeesByEmployeeId = (await _unitOfWork.ProductionEmployees.FindAsync(
                x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted))
                .ToDictionary(x => x.EmployeeId!.Value);

            return await FinalizeCreateAsync(newOtForm, request, chainResult, productionEmployeesByEmployeeId);
        }

        // Người tạo đã ở cấp cao hơn/bằng MỌI Chức vụ trung gian "Bắt buộc ký" — không còn ai khác để
        // ký ô "Người đề nghị" thay họ, nên chính họ tự ký (2026-08-08, theo yêu cầu người dùng — xem
        // ResolveApprovalChainResultDto.RequiresCreatorSelfSign). Chặn tạo đơn nếu chưa có chữ ký lưu
        // sẵn, cùng message/cơ chế với ApproveAsync khi bước yêu cầu ký. Dùng chung cho cả 2 kiểu tạo
        // đơn (theo Nhóm/theo chuyền, 2026-08-24).
        private async Task<byte[]?> ResolveCreatorSelfSignAsync(string createdByUserName, ResolveApprovalChainResultDto chainResult)
        {
            if (!chainResult.RequiresCreatorSelfSign) return null;

            var creatorSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == createdByUserName);
            if (creatorSignature == null)
                throw new DomainException("Bạn đang ở cấp cao nhất trong chuỗi duyệt trung gian — đơn cần chữ ký của chính bạn ở ô \"Người đề nghị\". Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước khi tạo đơn.");
            return creatorSignature.SignatureImage;
        }

        // Ăn uống bắt buộc cho MỌI đơn tăng ca (2026-09-28, theo yêu cầu người dùng) — đơn Theo chuyền
        // (Sản xuất) không còn cho từng người tự chọn "Có ăn"/"Không ăn" nữa (FE đã bỏ hẳn checkbox
        // này cho loại đơn này), luôn coi như có ăn (DidEat=true) bất kể FE gửi gì lên (phòng vệ ở tầng
        // Service). Đơn Theo Nhóm (Văn phòng) giữ nguyên Ý NGHĨA field DidEat như cũ (true = có ăn
        // TRONG ca, bị trừ MealBreakDeductionHours) — chỉ đổi NHÃN + default hiển thị ở FE thành "Ăn
        // sau" (mặc định tích sẵn = DidEat false = không trừ giờ), BE không cần đổi gì thêm ở field này.
        private static bool ResolveDidEat(bool isProductionForm, bool requestedDidEat) => isProductionForm || requestedDidEat;

        // Phần đuôi dùng chung cho cả 2 kiểu tạo đơn (2026-08-24) — thêm OtForm/OtFormEmployee(kèm
        // snapshot ProductionEmployee nếu có)/ProcessPart/chuỗi bước duyệt, lưu, rồi cộng luỹ kế ngay
        // nếu Completed hoặc báo email cho bước đầu tiên nếu còn InApproval.
        private async Task<OtFormDto> FinalizeCreateAsync(
            OtForm newOtForm, CreateOtFormDto request, ResolveApprovalChainResultDto chainResult,
            Dictionary<int, ProductionEmployee>? productionEmployeesByEmployeeId)
        {
            await _unitOfWork.OtForms.AddAsync(newOtForm);

            var mealSettings = await _attendanceSettingService.GetAsync();

            var didEatByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => ResolveDidEat(newOtForm.IsProductionForm, x.DidEat));

            // Chặn CỨNG trước khi ghi bất kỳ gì — vượt giới hạn ngày/tháng/năm của bất kỳ nhân viên nào
            // thì từ chối tạo cả đơn (2026-08-26, xem ValidateOtHourLimitsAsync).
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(x.StartTime ?? request.StartTime, x.EndTime, didEatByEmployeeId[x.EmployeeId], mealSettings));
            await ValidateOtHourLimitsAsync(request.Date, newHoursByEmployeeId, mealSettings, excludeFormId: null);

            // Chụp lại Dự kiến "trước khi thêm đơn này" — query CHƯA thấy đơn đang tạo (chưa
            // AddAsync/SaveChanges), nên tự nhiên đúng nghĩa "trước" (2026-08-19). Fetch 1 lượt cho CẢ
            // đơn (batch) thay vì từng người, tránh N+1 khi đơn có nhiều nhân viên.
            var projectedByEmployee = await ComputeAccumulatedHoursBatchAsync(
                request.Employees.Select(x => x.EmployeeId), request.Date, mealSettings);

            foreach (var item in request.Employees)
            {
                var (_, projectedMonthBefore, projectedYearBefore) =
                    projectedByEmployee.TryGetValue(item.EmployeeId, out var projected) ? projected : (0m, 0m, 0m);
                ProductionEmployee? pe = null;
                productionEmployeesByEmployeeId?.TryGetValue(item.EmployeeId, out pe);

                await _unitOfWork.OtFormEmployees.AddAsync(new OtFormEmployee
                {
                    OtForm = newOtForm,
                    EmployeeId = item.EmployeeId,
                    StartTime = item.StartTime ?? request.StartTime,
                    EndTime = item.EndTime,
                    DidEat = didEatByEmployeeId[item.EmployeeId],
                    NoteVn = item.NoteVn,
                    NoteJp = item.NoteJp,
                    MonthToDate = projectedMonthBefore,
                    YearToDate = projectedYearBefore,
                    CongDoanSnapshot = pe?.CongDoan,
                    TaskNameSnapshot = pe?.TaskName,
                    BlockCodeSnapshot = pe?.BlockCode,
                    TeamCodeSnapshot = pe?.TeamCode,
                    ShiftTeamCodeSnapshot = pe?.ShiftTeamCode
                });
            }

            // ProcessPart giờ LUÔN được tạo, bất kể request.ProcessPart có gửi lên hay không — "Ăn uống"
            // (IsEat) bắt buộc true cho MỌI đơn (2026-09-28, theo yêu cầu người dùng), không còn tuỳ
            // chọn tắt như trước. 3 mục còn lại (Xe đưa đón/Phòng photo/Đề nghị khác) vẫn tuỳ chọn,
            // mặc định rỗng/false nếu request không gửi.
            await _unitOfWork.ProcessParts.AddAsync(new ProcessPart
            {
                OtForm = newOtForm,
                IsEat = true,
                MainTicketCount = request.ProcessPart?.MainTicketCount ?? 0,
                SecondaryTicketCount = request.ProcessPart?.SecondaryTicketCount ?? 0,
                MilkCount = request.ProcessPart?.MilkCount ?? 0,
                IsTransportation = request.ProcessPart?.IsTransportation ?? false,
                IsUseCopyRoom = request.ProcessPart?.IsUseCopyRoom ?? false,
                AnotherSuggestionVn = request.ProcessPart?.AnotherSuggestionVn,
                AnotherSuggestionJp = request.ProcessPart?.AnotherSuggestionJp
            });

            // Snapshot chuỗi bước duyệt — mọi bước tạo Status=Pending ngay từ đầu; "bước đang chờ xử
            // lý" thật sự là bước Pending có StepOrder nhỏ nhất (xem GetPendingApprovalsAsync).
            OtFormApprovalStep? firstCreatedStep = null;
            foreach (var step in chainResult.Steps)
            {
                var newStep = new OtFormApprovalStep
                {
                    OtForm = newOtForm,
                    StepOrder = step.StepOrder,
                    JobTitleId = step.JobTitleId,
                    JobTitleCodeSnapshot = step.JobTitleCode,
                    JobTitleNameSnapshot = step.JobTitleName,
                    RequiresSignatureSnapshot = step.RequiresSignature,
                    IsResponsibleSnapshot = step.IsResponsible,
                    TerminalLevelSnapshot = step.TerminalLevel,
                    Status = (int)OtFormApprovalStepStatus.Pending,
                    IsDeleted = false
                };
                await _unitOfWork.OtFormApprovalSteps.AddAsync(newStep);
                firstCreatedStep ??= newStep;

                foreach (var candidate in step.Candidates)
                {
                    await _unitOfWork.OtFormApprovalStepCandidates.AddAsync(new OtFormApprovalStepCandidate
                    {
                        OtFormApprovalStep = newStep,
                        EmployeeId = candidate.EmployeeId,
                        UserName = candidate.UserName,
                        FullName = candidate.FullName
                    });
                }
            }

            await _unitOfWork.SaveChangesAsync();

            if (newOtForm.Status == (int)OtFormStatus.Completed)
            {
                await AccumulateEmployeeHoursAsync(newOtForm);
                await _unitOfWork.SaveChangesAsync();
            }
            else if (firstCreatedStep != null)
            {
                var firstStepWithCandidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                    x => x.Id == firstCreatedStep.Id, x => x.Candidates)).FirstOrDefault();
                // Bước ở cấp quản lý (DepartmentManager/WorkshopManager/GeneralDirector) KHÔNG còn gửi
                // mail riêng từng đơn nữa (2026-09-05) — người ở 3 cấp này chỉ nhận đúng 1 mail tổng
                // hợp/ngày qua OtFormBatchBackgroundService (xem RunDailyBatchSweepAsync), tránh gửi
                // trùng 2 lần cho cùng 1 đơn. Cấp trung gian (TerminalLevel=None, Staff/Group
                // Leader/Team Leader) chưa có cơ chế gom nên vẫn giữ mail tức thời như cũ.
                if (firstStepWithCandidates != null && firstStepWithCandidates.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None)
                    QueueStepApprovalNotification(newOtForm.Id, firstStepWithCandidates.Id);
            }

            return await GetByIdAsync(newOtForm.Id);
        }

        // Trả về Employee của userName NẾU họ thuộc đúng Group này — dùng cho cả việc validate quyền
        // tạo/sửa đơn LẪN xác định "người tạo" để suy luận chuỗi duyệt Cây chức vụ (2026-08-07, Giai
        // đoạn 3.1 — thay UserApprovalScope(Submitter) cũ). Chỉ 2 đối tượng được tạo/sửa đơn cho 1
        // Group: (a) chính Nhân viên thuộc Group đó (trả về Employee), (b) Admin (trả về null — Admin
        // coi như đứng cấp thấp nhất khi suy luận chuỗi, xem ResolveChainForCreationAsync).
        private async Task<Employee?> EnsureCanCreateOrEditForScopeAsync(string userName, bool isAdmin, int groupId)
        {
            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.UserName == userName && !x.IsDeleted && x.GroupId == groupId, x => x.JobTitle!);

            if (callerEmployee == null && !isAdmin)
                throw new DomainException("Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình. Liên hệ Admin nếu tài khoản chưa liên kết đúng nhân viên/nhóm.");

            return callerEmployee;
        }

        // Group DUY NHẤT người gọi được tạo đơn — chính Group của họ (2026-08-07, Giai đoạn 3.1: bỏ
        // hẳn đường "Admin gán tay UserApprovalScope(Submitter) cho Group khác" cũ).
        public async Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin)
        {
            if (isAdmin) return new List<MyCreateScopeItemDto>();

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (callerEmployee == null) return new List<MyCreateScopeItemDto>();

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == callerEmployee.GroupId && !x.IsDeleted, x => x.Department);
            if (group == null) return new List<MyCreateScopeItemDto>();

            return new List<MyCreateScopeItemDto>
            {
                new MyCreateScopeItemDto
                {
                    GroupId = group.Id,
                    GroupNameVn = group.GroupNameVn,
                    DepartmentId = group.DepartmentId,
                    DepartmentNameVn = group.Department.DepartmentNameVn
                }
            };
        }

        // (Những) tổ hợp Team/Line/Nhóm ca mà người gọi đang là Line Leader — dùng để FE tự điền sẵn +
        // khoá cứng 3 dropdown Team/Line/Nhóm ca ở chế độ "Theo chuyền" (2026-09-28, theo yêu cầu người
        // dùng: "hiện giờ phải nhập team line nhóm ca ... cũng cố định luôn") — mirror GetMyCreateScopesAsync
        // của chế độ "Theo Nhóm". Admin/người không phải Line Leader trả mảng rỗng → FE giữ nguyên dropdown
        // tự do như hiện tại (không có gì để khoá). Chỉ tính các dòng ProductionEmployee đã resolve ĐỦ cả 3
        // FK (ProductionLineId/TeamId/ShiftTeamId) — đúng policy nạp dữ liệu ghi ở ProductionEmployee.cs.
        public async Task<List<MyProductionCreateScopeItemDto>> GetMyProductionCreateScopesAsync(string userName, bool isAdmin)
        {
            if (isAdmin) return new List<MyProductionCreateScopeItemDto>();

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.UserName == userName && !x.IsDeleted, x => x.Group!);
            if (callerEmployee == null) return new List<MyProductionCreateScopeItemDto>();

            // Line Leader thường được gán qua Group (vd "SHIDO" thuộc Bộ phận "Chế tạo"), KHÔNG set thẳng
            // Employee.DepartmentId — cùng thứ tự ưu tiên với EnsureCanManageDeptOrGroupScopeAsync. Không
            // resolve được Bộ phận nào → không có gì để khoá, trả rỗng (fallback dropdown tự do như cũ).
            var departmentId = callerEmployee.DepartmentId ?? callerEmployee.Group?.DepartmentId;
            if (departmentId == null) return new List<MyProductionCreateScopeItemDto>();

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == departmentId.Value && !x.IsDeleted);
            if (department == null) return new List<MyProductionCreateScopeItemDto>();

            var leaderRows = await _unitOfWork.ProductionEmployees.SelectAsync(
                x => x.EmployeeId == callerEmployee.Id && x.IsLeader && !x.IsDeleted
                    && x.ProductionLineId != null && x.TeamId != null && x.ShiftTeamId != null,
                x => new MyProductionCreateScopeItemDto
                {
                    DepartmentId = department.Id,
                    DepartmentNameVn = department.DepartmentNameVn,
                    ProductionLineId = x.ProductionLineId!.Value,
                    LineCode = x.ProductionLine!.LineCode,
                    LineNameVn = null,
                    TeamId = x.TeamId!.Value,
                    TeamCode = x.Team!.Code,
                    TeamNameVn = x.Team!.NameVn,
                    ShiftTeamId = x.ShiftTeamId!.Value,
                    ShiftTeamCode = x.ShiftTeam!.Code,
                    ShiftTeamNameVn = x.ShiftTeam!.NameVn
                });

            // 1 Line Leader có thể xuất hiện ở nhiều dòng ProductionEmployee cùng 1 tổ hợp (vd nhiều
            // CongDoan/TaskName khác nhau cùng ngày) — gộp về đúng tổ hợp duy nhất.
            return leaderRows
                .GroupBy(x => (x.ProductionLineId, x.TeamId, x.ShiftTeamId))
                .Select(g => g.First())
                .ToList();
        }

        public async Task<OtFormDto> UpdateAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể sửa.");

            // Bước Pending hiện tại — dùng cho check quyền đơn theo chuyền bên dưới VÀ cho
            // RemovedAtLevel khi loại nhân viên (2026-09-04, xem GetCurrentPendingStepAsync).
            var currentStep = await GetCurrentPendingStepAsync(id);

            // Giai đoạn 5 (2026-08-27, theo yêu cầu người dùng — xem attendance-module.md §Cây chức vụ & Cây duyệt):
            // quyền sửa đơn "theo chuyền" đi theo TỪNG BƯỚC duyệt — ai đang là candidate của bước
            // Pending hiện tại thì sửa được (giống hệt ai được duyệt bước đó), KHÔNG còn giới hạn "chỉ
            // người tạo, chỉ trước khi có bước nào Approved" như đơn theo Nhóm. Bước trước đã ký thì
            // GIỮ NGUYÊN chữ ký cũ khi có sửa ở bước sau (đã chốt với người dùng — không huỷ/bắt ký
            // lại), nhưng chính bước ĐÃ ký đó bị khoá lại — chỉ bước đang Pending mới sửa được (khớp
            // đúng "Line Leader ký xong không sửa được nữa" nhưng Group Leader/Team Leader ở bước sau
            // vẫn sửa được cho tới khi TỰ HỌ ký). Không có Admin bypass — cùng nguyên tắc với
            // LoadFormAndCurrentStepAsync (Approve/Reject). Quyền này giờ ÁP DỤNG LUÔN cho thêm/xóa
            // nhân viên (2026-09-04, đã gộp vào đây — không còn quyền riêng "candidate bước hiện tại
            // cho mọi loại đơn" như 2 action AddEmployeeAsync/RemoveEmployeeCoreAsync cũ).
            if (otForm.IsProductionForm)
            {
                if (currentStep == null)
                    throw new DomainException("Đơn không còn bước duyệt nào đang chờ xử lý (dữ liệu không nhất quán, liên hệ Admin).");
                if (!currentStep.Candidates.Any(c => c.UserName == currentUserName))
                    throw new DomainException($"Bạn không phải người được chỉ định xử lý bước hiện tại (Chức vụ '{currentStep.JobTitleNameSnapshot}') của đơn này, không thể sửa.");
            }
            else
            {
                if (otForm.CreatedByUserName != currentUserName)
                    throw new DomainException("Bạn chỉ có thể sửa đơn do chính mình tạo.");

                var hasApprovedStep = (await _unitOfWork.OtFormApprovalSteps.FindAsync(
                    x => x.OtFormId == otForm.Id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Approved)).Count > 0;
                if (hasApprovedStep)
                    throw new DomainException("Đơn đã có bước duyệt được xử lý, không thể sửa nữa.");

                if (otForm.GroupId.HasValue)
                    await EnsureCanCreateOrEditForScopeAsync(currentUserName, isAdmin, otForm.GroupId.Value);
            }

            // Mật khẩu cấp 2 bắt buộc khi lưu sửa đơn (2026-08-28, theo yêu cầu người dùng) — cùng cơ
            // chế với ApproveAsync/RejectAsync. 1 LẦN cho toàn bộ thay đổi trong lượt lưu này (thêm/xóa/
            // sửa giờ), không hỏi lại riêng cho từng thao tác như trước 2026-09-04.
            await _secondaryPasswordService.VerifyAsync(currentUserName, request.SecondaryPassword);

            var activeEmployees = otForm.OtFormEmployees.Where(x => !x.IsRemoved).ToList();
            var activeEmployeeIds = activeEmployees.Select(x => x.EmployeeId).ToHashSet();
            var activeByEmployeeId = activeEmployees.ToDictionary(x => x.EmployeeId);
            var requestedEmployeeIds = request.Employees.Select(x => x.EmployeeId).ToHashSet();

            if (requestedEmployeeIds.Count != request.Employees.Count)
                throw new DomainException("Danh sách nhân viên có mã trùng lặp.");

            // Diff giữa danh sách active hiện có và danh sách gửi lên (2026-09-04 — gộp thêm/xóa NV vào
            // đây, xem UpdateOtFormDto.RemovedEmployees). toAdd = NV hoàn toàn mới hoặc trước đó đã bị
            // loại khỏi CHÍNH đơn này; toKeep = NV vẫn còn, chỉ có thể đổi thực tích.
            var removedEmployeeIds = request.RemovedEmployees.Select(x => x.EmployeeId).ToHashSet();
            if (removedEmployeeIds.Count != request.RemovedEmployees.Count)
                throw new DomainException("Danh sách nhân viên bị loại có mã trùng lặp.");
            if (!removedEmployeeIds.IsSubsetOf(activeEmployeeIds))
                throw new DomainException("Có nhân viên bị loại không có trong đơn.");
            if (removedEmployeeIds.Overlaps(requestedEmployeeIds))
                throw new DomainException("Nhân viên vừa bị loại vừa có trong danh sách sửa — dữ liệu không hợp lệ.");

            var toKeepIds = activeEmployeeIds.Except(removedEmployeeIds).ToHashSet();
            if (!toKeepIds.All(requestedEmployeeIds.Contains))
                throw new DomainException(
                    "Danh sách nhân viên trong đơn không khớp — thiếu nhân viên đang có trong đơn (dùng chức năng Loại khỏi đơn nếu muốn bỏ ai đó).");

            var toAddIds = requestedEmployeeIds.Except(activeEmployeeIds).ToHashSet();

            if (toKeepIds.Count + toAddIds.Count < 1)
                throw new DomainException("Đơn phải còn ít nhất 1 nhân viên.");

            var employeesById = (await _unitOfWork.Employees.FindAsync(x => activeEmployeeIds.Contains(x.Id)))
                .ToDictionary(x => x.Id);
            if (toAddIds.Count > 0)
            {
                var addedEmployees = await _unitOfWork.Employees.FindAsync(x => toAddIds.Contains(x.Id) && !x.IsDeleted);
                if (addedEmployees.Count != toAddIds.Count)
                {
                    var missing = toAddIds.Except(addedEmployees.Select(x => x.Id));
                    throw new DomainException($"Không tìm thấy nhân viên mã ID: {string.Join(", ", missing)}.");
                }
                foreach (var e in addedEmployees) employeesById[e.Id] = e;
            }
            var employeeCodeById = employeesById.ToDictionary(x => x.Key, x => x.Value.Code);

            // Per-employee StartTime: null keeps the row's current value (new rows: the form's StartTime).
            var startTimeByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId,
                x => x.StartTime ?? (activeByEmployeeId.TryGetValue(x.EmployeeId, out var row) ? row.StartTime : otForm.StartTime));

            foreach (var item in request.Employees)
            {
                var code = employeeCodeById.GetValueOrDefault(item.EmployeeId, item.EmployeeId.ToString());
                EnsureEmployeeTimeWithinForm(code, startTimeByEmployeeId[item.EmployeeId], item.EndTime, otForm.StartTime, otForm.EndTime);
            }

            // Nhân viên MỚI thêm vào đơn theo chuyền phải cùng Line/Nhóm ca với NV còn lại của đơn
            // (2026-09-04, theo yêu cầu người dùng — trước đó không hề kiểm tra). Đơn theo Nhóm giữ
            // nguyên check GroupId cũ.
            Dictionary<int, ProductionEmployee> productionEmployeesByEmployeeId = new();
            if (otForm.IsProductionForm && toAddIds.Count > 0)
            {
                productionEmployeesByEmployeeId = (await _unitOfWork.ProductionEmployees.FindAsync(
                    x => x.EmployeeId.HasValue && toAddIds.Contains(x.EmployeeId.Value) && !x.IsDeleted))
                    .ToDictionary(x => x.EmployeeId!.Value);

                var baselinePairs = activeEmployees
                    .Where(x => toKeepIds.Contains(x.EmployeeId))
                    .Select(x => (x.BlockCodeSnapshot, x.ShiftTeamCodeSnapshot))
                    .ToHashSet();

                foreach (var employeeId in toAddIds)
                {
                    var employee = employeesById[employeeId];
                    if (!productionEmployeesByEmployeeId.TryGetValue(employeeId, out var productionEmployee))
                        throw new DomainException($"Nhân viên '{employee.Code}' không có trong danh sách nhân sự dưới chuyền.");
                    if (productionEmployee.ShiftTeamId == null)
                        throw new DomainException($"Nhân viên '{employee.Code}' chưa có Nhóm ca, cần cập nhật trước khi thêm vào đơn.");
                    EnsureAddedEmployeeMatchesFormScope(employee, productionEmployee, baselinePairs);
                }
            }
            else if (!otForm.IsProductionForm && otForm.GroupId.HasValue)
            {
                foreach (var employeeId in toAddIds)
                {
                    var employee = employeesById[employeeId];
                    if (employee.GroupId != otForm.GroupId.Value)
                        throw new DomainException($"Nhân viên '{employee.Code}' không thuộc Nhóm của đơn này.");
                }
            }

            var mealSettings = await _attendanceSettingService.GetAsync();

            // Ăn uống bắt buộc cho MỌI đơn (2026-09-28) — đơn Theo chuyền hardcode DidEat=true bất kể
            // FE gửi gì, xem ResolveDidEat. Đơn Theo Nhóm giữ nguyên field như FE gửi lên (chỉ đổi
            // nhãn/default hiển thị "Ăn sau" ở FE).
            var didEatByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => ResolveDidEat(otForm.IsProductionForm, x.DidEat));

            // Chặn CỨNG nếu giờ sửa lại khiến ai đó vượt giới hạn ngày — excludeFormId: otForm.Id vì
            // các dòng OtFormEmployee hiện có của CHÍNH đơn này đang bị thay thế/sửa, không được cộng
            // dồn ngược lại với giá trị cũ của chính nó (xem ValidateOtHourLimitsAsync). Áp dụng cho cả
            // NV giữ nguyên lẫn NV mới thêm.
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(startTimeByEmployeeId[x.EmployeeId], x.EndTime, didEatByEmployeeId[x.EmployeeId], mealSettings));
            await ValidateOtHourLimitsAsync(otForm.Date, newHoursByEmployeeId, mealSettings, excludeFormId: otForm.Id);

            // The OT case is fixed after creation, so edited hours may not push a non-TH3 form past the month/year limit.
            var currentOtCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otForm.OtCaseId);
            if (currentOtCase?.Code != "TH3"
                && await ExceedsMonthYearLimitAsync(otForm.Date, newHoursByEmployeeId, mealSettings, excludeFormId: otForm.Id))
                throw new DomainException("Giờ sửa khiến có nhân viên vượt giới hạn OT tháng/năm, đơn này phải là TH3. Vui lòng giảm giờ hoặc tạo đơn TH3 mới.");

            // NV mới cần thêm 2 check chỉ áp dụng lúc THÊM (không áp dụng cho NV giữ nguyên — ngày/giờ
            // của họ không đổi nên đã được validate từ lúc tạo/lần thêm trước): trùng giờ với đơn khác,
            // và snapshot lũy kế trước đó (MonthToDate/YearToDate).
            var projectedByEmployee = new Dictionary<int, (decimal Day, decimal Month, decimal Year)>();
            if (toAddIds.Count > 0)
            {
                var toAddEmployees = toAddIds.Select(eid => employeesById[eid]).ToList();
                var toAddTimes = request.Employees.Where(x => toAddIds.Contains(x.EmployeeId))
                    .ToDictionary(x => x.EmployeeId, x => (startTimeByEmployeeId[x.EmployeeId], x.EndTime));
                await EnsureNoOverlappingOtFormsAsync(toAddEmployees, otForm.Date, toAddTimes, excludeFormId: otForm.Id);

                projectedByEmployee = await ComputeAccumulatedHoursBatchAsync(toAddIds, otForm.Date, mealSettings, excludeFormId: otForm.Id);
            }

            // === Áp dụng: xóa trước, thêm sau, rồi sửa NV giữ nguyên — thứ tự không quan trọng vì mỗi
            // nhóm động vào ID khác nhau, chỉ gộp lại đúng roster cuối để tính NumberOfEmployee/phiếu ăn. ===

            foreach (var employeeId in removedEmployeeIds)
            {
                var target = activeByEmployeeId[employeeId];
                var reason = request.RemovedEmployees.First(x => x.EmployeeId == employeeId).Reason;

                target.IsRemoved = true;
                target.RemovedByUserName = currentUserName;
                target.RemovedByFullName = currentFullName;
                target.RemovedAtLevel = currentStep?.StepOrder;
                target.RemovedAt = TimeHelper.GetCurrentUtcTime();
                target.RemoveReason = reason;
                _unitOfWork.OtFormEmployees.Update(target);

                var code = employeeCodeById.GetValueOrDefault(employeeId, employeeId.ToString());
                await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.EmployeeRemoved,
                    employeeId, code, null, null, reason);
            }

            var addedOrReactivatedRows = new List<OtFormEmployee>();
            foreach (var employeeId in toAddIds)
            {
                var employee = employeesById[employeeId];
                var addRequest = request.Employees.First(x => x.EmployeeId == employeeId);
                var productionEmployee = productionEmployeesByEmployeeId.GetValueOrDefault(employeeId);
                var (_, projectedMonthBefore, projectedYearBefore) =
                    projectedByEmployee.TryGetValue(employeeId, out var projected) ? projected : (0m, 0m, 0m);

                // NV trước đó đã bị loại khỏi CHÍNH đơn này (IsRemoved=true) được thêm lại bằng cách tái
                // dùng đúng dòng cũ (giữ nguyên khoá chính OtFormId+EmployeeId), không tạo dòng mới.
                var existingRow = otForm.OtFormEmployees.FirstOrDefault(x => x.EmployeeId == employeeId);
                OtFormEmployee affectedRow;
                if (existingRow != null)
                {
                    existingRow.IsRemoved = false;
                    existingRow.RemovedByUserName = null;
                    existingRow.RemovedByFullName = null;
                    existingRow.RemovedAtLevel = null;
                    existingRow.RemovedAt = null;
                    existingRow.RemoveReason = null;
                    existingRow.StartTime = startTimeByEmployeeId[employeeId];
                    existingRow.EndTime = addRequest.EndTime;
                    existingRow.DidEat = didEatByEmployeeId[employeeId];
                    existingRow.NoteVn = addRequest.NoteVn;
                    existingRow.NoteJp = addRequest.NoteJp;
                    _unitOfWork.OtFormEmployees.Update(existingRow);
                    affectedRow = existingRow;
                }
                else
                {
                    affectedRow = new OtFormEmployee
                    {
                        OtForm = otForm,
                        EmployeeId = employeeId,
                        StartTime = startTimeByEmployeeId[employeeId],
                        EndTime = addRequest.EndTime,
                        DidEat = didEatByEmployeeId[employeeId],
                        NoteVn = addRequest.NoteVn,
                        NoteJp = addRequest.NoteJp,
                        MonthToDate = projectedMonthBefore,
                        YearToDate = projectedYearBefore,
                        CongDoanSnapshot = productionEmployee?.CongDoan,
                        TaskNameSnapshot = productionEmployee?.TaskName,
                        BlockCodeSnapshot = productionEmployee?.BlockCode,
                        TeamCodeSnapshot = productionEmployee?.TeamCode,
                        ShiftTeamCodeSnapshot = productionEmployee?.ShiftTeamCode
                    };
                    await _unitOfWork.OtFormEmployees.AddAsync(affectedRow);
                }
                addedOrReactivatedRows.Add(affectedRow);

                await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.EmployeeAdded,
                    employeeId, employee.Code, null, null, $"{startTimeByEmployeeId[employeeId]:HH:mm}–{addRequest.EndTime:HH:mm}");
            }

            foreach (var item in request.Employees.Where(x => toKeepIds.Contains(x.EmployeeId)))
            {
                var existing = activeByEmployeeId[item.EmployeeId];
                var code = employeeCodeById.GetValueOrDefault(item.EmployeeId, item.EmployeeId.ToString());

                // Log lại từng field thực sự đổi (2026-08-28, theo yêu cầu người dùng — xem OtFormEditLog).
                var newStartTime = startTimeByEmployeeId[item.EmployeeId];
                if (existing.StartTime != newStartTime)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.TimeChanged,
                        item.EmployeeId, code, "StartTime", existing.StartTime.ToString("HH:mm"), newStartTime.ToString("HH:mm"));
                if (existing.EndTime != item.EndTime)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.TimeChanged,
                        item.EmployeeId, code, "EndTime", existing.EndTime.ToString("HH:mm"), item.EndTime.ToString("HH:mm"));
                var resolvedDidEat = didEatByEmployeeId[item.EmployeeId];
                if (existing.DidEat != resolvedDidEat)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.TimeChanged,
                        item.EmployeeId, code, "DidEat", existing.DidEat ? "Có ăn" : "Không ăn", resolvedDidEat ? "Có ăn" : "Không ăn");
                if (existing.NoteVn != item.NoteVn)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.NoteChanged,
                        item.EmployeeId, code, "NoteVn", existing.NoteVn, item.NoteVn);
                if (existing.NoteJp != item.NoteJp)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.NoteChanged,
                        item.EmployeeId, code, "NoteJp", existing.NoteJp, item.NoteJp);

                existing.StartTime = newStartTime;
                existing.EndTime = item.EndTime;
                existing.DidEat = resolvedDidEat;
                existing.NoteVn = item.NoteVn;
                existing.NoteJp = item.NoteJp;
                _unitOfWork.OtFormEmployees.Update(existing);
            }

            var finalActiveEmployees = activeEmployees.Where(x => toKeepIds.Contains(x.EmployeeId))
                .Concat(addedOrReactivatedRows)
                .ToList();
            await RecalculateMealTicketCountsAsync(otForm.Id, finalActiveEmployees, mealSettings);

            otForm.NumberOfEmployee = finalActiveEmployees.Count;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            // Skipped in the background job when the remover is the form's own creator.
            QueueEmployeesRemovedNotification(otForm.Id, removedEmployeeIds.ToList());

            return await GetByIdAsync(otForm.Id);
        }

        // Nhân viên MỚI thêm vào đơn theo chuyền phải cùng (Line, Nhóm ca) với ít nhất 1 nhân viên còn
        // lại của đơn (2026-09-04, theo yêu cầu người dùng — trước đó không hề kiểm tra, cho phép thêm
        // nhân viên Line khác vào đơn). KHÔNG ép tất cả nhân viên của đơn phải cùng 1 Line — đơn theo
        // chuyền vốn có thể gồm nhiều Line miễn người tạo là Line Leader của ít nhất 1 Line trong đó
        // (xem CreateProductionFormAsync) — chỉ chặn nhân viên HOÀN TOÀN lạ so với những gì đơn đang có.
        // Nếu đơn không còn nhân viên "gốc" nào sau khi trừ người bị xóa cùng lượt lưu (hiếm — xóa hết
        // rồi thêm toàn người mới) thì bỏ qua check này cho lượt lưu đó.
        private static void EnsureAddedEmployeeMatchesFormScope(
            Employee employee, ProductionEmployee productionEmployee, HashSet<(string? BlockCode, string? ShiftTeamCode)> baselinePairs)
        {
            if (baselinePairs.Count == 0) return;

            var pair = (productionEmployee.BlockCode, productionEmployee.ShiftTeamCode);
            if (!baselinePairs.Contains(pair))
                throw new DomainException($"Nhân viên '{employee.Code}' không thuộc Line/Nhóm ca của đơn này.");
        }

        // Bước Pending có StepOrder nhỏ nhất của 1 đơn (kèm Candidates) — dùng chung cho
        // LoadFormAndCurrentStepAsync (Approve/Reject) VÀ UpdateAsync (Giai đoạn 5, 2026-08-27 — quyền
        // sửa đơn "theo chuyền" đi theo từng bước, xem UpdateAsync).
        private async Task<OtFormApprovalStep?> GetCurrentPendingStepAsync(int otFormId)
        {
            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == otFormId && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates);
            return pendingSteps.OrderBy(x => x.StepOrder).FirstOrDefault();
        }

        // Tìm đơn + bước duyệt HIỆN TẠI, validate approverUserName là 1 trong các candidate của bước đó
        // (2026-08-07, Giai đoạn 3.1 — thay LoadFormAndValidateAuthorityAsync cũ). Không có Admin bypass
        // ở đây — giữ đúng hành vi cũ (ApproveAsync/RejectAsync trước đây cũng không cho Admin bypass,
        // chỉ Submitter mới có).
        private async Task<(OtForm otForm, OtFormApprovalStep currentStep)> LoadFormAndCurrentStepAsync(
            int id, string approverUserName)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể duyệt/từ chối thêm.");

            var currentStep = await GetCurrentPendingStepAsync(id);
            if (currentStep == null)
                throw new DomainException("Đơn không còn bước duyệt nào đang chờ xử lý (dữ liệu không nhất quán, liên hệ Admin).");

            if (!currentStep.Candidates.Any(c => c.UserName == approverUserName))
                throw new DomainException($"Bạn không phải người được chỉ định duyệt bước hiện tại (Chức vụ '{currentStep.JobTitleNameSnapshot}') của đơn này.");

            return (otForm, currentStep);
        }

        public async Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request)
        {
            var (otForm, currentStep) = await LoadFormAndCurrentStepAsync(id, approverUserName);

            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            byte[]? signatureImage = null;
            if (currentStep.RequiresSignatureSnapshot)
            {
                var approverSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == approverUserName);
                if (approverSignature == null)
                    throw new DomainException("Bước duyệt này bắt buộc phải ký. Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước.");
                signatureImage = approverSignature.SignatureImage;
            }

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                OtFormApprovalStepId = currentStep.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                Action = (int)ApprovalAction.Approved,
                Comment = request.Comment,
                SignatureImage = signatureImage,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            currentStep.Status = (int)OtFormApprovalStepStatus.Approved;
            _unitOfWork.OtFormApprovalSteps.Update(currentStep);

            var remainingPending = await _unitOfWork.OtFormApprovalSteps.FindAsync(
                x => x.OtFormId == otForm.Id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending && x.Id != currentStep.Id);

            if (remainingPending.Count == 0)
            {
                otForm.Status = (int)OtFormStatus.Completed;
                _unitOfWork.OtForms.Update(otForm);
                await AccumulateEmployeeHoursAsync(otForm);
            }

            await _unitOfWork.SaveChangesAsync();

            // Còn bước tiếp theo — gửi mail cho candidate của bước Pending có StepOrder nhỏ nhất còn
            // lại. Không tự thông báo gì thêm nếu đơn vừa Completed.
            if (remainingPending.Count > 0)
            {
                var nextStepId = remainingPending.OrderBy(x => x.StepOrder).First().Id;
                var nextStepWithCandidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                    x => x.Id == nextStepId, x => x.Candidates)).FirstOrDefault();
                // Cùng lý do với CreateAsync — bỏ mail riêng cho bước ở cấp quản lý, chỉ còn mail tổng
                // hợp hằng ngày (xem comment ở CreateAsync).
                if (nextStepWithCandidates != null && nextStepWithCandidates.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None)
                    QueueStepApprovalNotification(otForm.Id, nextStepWithCandidates.Id);
            }
        }

        public async Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request)
        {
            var (otForm, currentStep) = await LoadFormAndCurrentStepAsync(id, approverUserName);

            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                OtFormApprovalStepId = currentStep.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                Action = (int)ApprovalAction.Rejected,
                Comment = request.Comment,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            currentStep.Status = (int)OtFormApprovalStepStatus.Rejected;
            _unitOfWork.OtFormApprovalSteps.Update(currentStep);

            // Các bước Pending còn lại (chưa tới lượt) không còn ý nghĩa nữa — chuyển Skipped để không
            // ai còn thấy đơn này trong danh sách chờ duyệt của họ.
            var otherPendingSteps = await _unitOfWork.OtFormApprovalSteps.FindAsync(
                x => x.OtFormId == otForm.Id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending && x.Id != currentStep.Id);
            foreach (var step in otherPendingSteps)
            {
                step.Status = (int)OtFormApprovalStepStatus.Skipped;
                _unitOfWork.OtFormApprovalSteps.Update(step);
            }

            otForm.Status = (int)OtFormStatus.Rejected;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            QueueRejectedNotification(otForm.Id);
        }

        // Ký hàng loạt (2026-08-27, theo yêu cầu người dùng — Team Leader/Trưởng phòng có nhiều Group
        // Leader/Team Leader bên dưới cần xử lý nhanh nhiều đơn cùng lúc). Lặp gọi lại ApproveAsync đơn
        // lẻ cho từng OtFormId — TÁI DÙNG NGUYÊN logic/validate đã có (candidate đúng bước, chữ ký nếu
        // bắt buộc, mật khẩu cấp 2...), không viết lại. Từng đơn thành công/thất bại ĐỘC LẬP (bắt
        // DomainException/NotFoundException của riêng đơn đó, không để 1 đơn lỗi chặn các đơn còn lại).
        public async Task<List<BulkOtFormActionResultItemDto>> BulkApproveAsync(
            string approverUserName, string? approverFullName, BulkApproveOtFormDto request)
        {
            var results = new List<BulkOtFormActionResultItemDto>();
            foreach (var otFormId in request.OtFormIds.Distinct())
            {
                try
                {
                    await ApproveAsync(otFormId, approverUserName, approverFullName, request);
                    results.Add(new BulkOtFormActionResultItemDto { OtFormId = otFormId, Success = true });
                }
                catch (Exception ex) when (ex is DomainException or NotFoundException)
                {
                    results.Add(new BulkOtFormActionResultItemDto { OtFormId = otFormId, Success = false, Error = ex.Message });
                }
            }
            return results;
        }

        // Từ chối hàng loạt — mirror BulkApproveAsync.
        public async Task<List<BulkOtFormActionResultItemDto>> BulkRejectAsync(
            string approverUserName, string? approverFullName, BulkRejectOtFormDto request)
        {
            var results = new List<BulkOtFormActionResultItemDto>();
            foreach (var otFormId in request.OtFormIds.Distinct())
            {
                try
                {
                    await RejectAsync(otFormId, approverUserName, approverFullName, request);
                    results.Add(new BulkOtFormActionResultItemDto { OtFormId = otFormId, Success = true });
                }
                catch (Exception ex) when (ex is DomainException or NotFoundException)
                {
                    results.Add(new BulkOtFormActionResultItemDto { OtFormId = otFormId, Success = false, Error = ex.Message });
                }
            }
            return results;
        }

        // Kênh email — token tự nó là thông tin xác thực, dùng RemoveEmployeeCoreAsync trực tiếp.
        public async Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);

            // secondaryPassword: null — kênh email KHÔNG cần mật khẩu cấp 2 (quyết định riêng, không đổi
            // theo yêu cầu 2026-08-28, xem RemoveOtFormEmployeeByEmailTokenDto).
            var result = await RemoveEmployeeCoreAsync(
                emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName,
                isAdmin: false, request.EmployeeId, request.Reason, secondaryPassword: null);

            QueueEmployeesRemovedNotification(emailToken.OtFormId, new List<int> { request.EmployeeId });
            return result;
        }

        // Kênh trong-app (JWT) — khôi phục 2026-09-30 ngay trên màn Duyệt, xem docs/attendance-module.md
        // §Loại nhân viên khỏi đơn. Cùng RemoveEmployeeCoreAsync với kênh
        // email (authorization đã đúng "candidate bước Pending hiện tại" cho CẢ đơn theo Nhóm lẫn theo
        // chuyền) — KHÔNG cần SecondaryPassword, cùng quyết định 2026-07-31.
        public async Task<OtFormDto> RemoveEmployeeAsync(
            int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request)
        {
            var result = await RemoveEmployeeCoreAsync(
                id, userName, fullName, isAdmin, request.EmployeeId, request.Reason, secondaryPassword: null);

            QueueEmployeesRemovedNotification(id, new List<int> { request.EmployeeId });
            return result;
        }

        // Admin xoá đơn kẹt vĩnh viễn (chuỗi duyệt thiếu candidate ở 1 bước, không có cách resolve lại
        // vì candidate đã snapshot 1 lần lúc tạo — xem docs/attendance-module.md §Cây chức vụ). Chặn
        // Completed vì đơn đó đã cộng lũy kế THẬT (ghi vào ledger EmployeeAccumulationHistory) — xoá sẽ
        // làm sai số liệu đã dùng cho lương, không thể tự động đảo ngược an toàn. InApproval/Rejected
        // chỉ có lũy kế DỰ KIẾN (2026-08-19: không còn lưu ở đâu, tính lúc đọc) nên không cần đảo ngược
        // gì cả khi xoá — lần đọc tiếp theo tự động không còn thấy đơn này nữa (đã IsDeleted).
        public async Task DeleteAsync(int id, string deletedByUserName, string? deletedByFullName, DeleteOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status == (int)OtFormStatus.Completed)
                throw new DomainException("Đơn đã hoàn tất (đã cộng lũy kế) không thể xoá.");

            otForm.IsDeleted = true;
            otForm.DeletedByUserName = deletedByUserName;
            otForm.DeletedByFullName = deletedByFullName;
            otForm.DeletedAt = TimeHelper.GetCurrentUtcTime();
            otForm.DeleteReason = request.Reason;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<OtFormDto> RemoveEmployeeCoreAsync(
            int id, string userName, string? fullName, bool isAdmin, int employeeId, string reason, string? secondaryPassword)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể loại nhân viên khỏi đơn nữa.");

            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates);
            var currentStep = pendingSteps.OrderBy(x => x.StepOrder).FirstOrDefault();

            // Admin luôn được phép — khái niệm "chỉ Admin bypass ở cấp Submitter" cũ không còn (Submitter
            // đã bị xoá, xem docs/attendance-module.md §Cây chức vụ, Giai đoạn 3.1).
            if (!isAdmin)
            {
                if (currentStep == null || !currentStep.Candidates.Any(c => c.UserName == userName))
                    throw new DomainException("Bạn không được phân quyền ở bước mà đơn này đang chờ, nên không thể loại nhân viên khỏi đơn.");
            }

            // secondaryPassword null = kênh email (RemoveEmployeeByEmailTokenAsync), không cần verify —
            // xem RemoveOtFormEmployeeDto (2026-08-28).
            if (secondaryPassword != null)
                await _secondaryPasswordService.VerifyAsync(userName, secondaryPassword);

            var target = otForm.OtFormEmployees.FirstOrDefault(x => x.EmployeeId == employeeId);
            if (target == null)
                throw new DomainException("Nhân viên này không có trong danh sách tăng ca của đơn.");

            if (target.IsRemoved)
                throw new DomainException("Nhân viên này đã bị loại khỏi đơn trước đó.");

            if (otForm.OtFormEmployees.Count(x => !x.IsRemoved) <= 1)
                throw new DomainException("Đơn chỉ còn 1 nhân viên, không thể loại tiếp. Nếu không duyệt đơn này, hãy dùng chức năng Từ chối đơn.");

            target.IsRemoved = true;
            target.RemovedByUserName = userName;
            target.RemovedByFullName = fullName;
            target.RemovedAtLevel = currentStep?.StepOrder;
            target.RemovedAt = TimeHelper.GetCurrentUtcTime();
            target.RemoveReason = reason;
            _unitOfWork.OtFormEmployees.Update(target);

            var removedEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId);
            await LogEditAsync(otForm.Id, userName, fullName, OtFormEditActionType.EmployeeRemoved,
                employeeId, removedEmployee?.Code, null, null, reason);

            var mealSettings = await _attendanceSettingService.GetAsync();

            var remainingActiveEmployees = otForm.OtFormEmployees.Where(x => !x.IsRemoved).ToList();
            await RecalculateMealTicketCountsAsync(otForm.Id, remainingActiveEmployees, mealSettings);

            otForm.NumberOfEmployee = remainingActiveEmployees.Count;
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

            await ApproveAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);

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

        // Gửi email kèm link Duyệt/Từ chối cho TẤT CẢ candidate của 1 bước cụ thể (step.Candidates phải
        // đã được Include từ trước) — gọi sau CreateAsync (bước đầu tiên) và sau ApproveAsync (bước kế
        // tiếp, nếu còn). Không throw nếu thiếu Email/SMTP lỗi — chỉ là kênh bổ sung.
        private async Task NotifyEligibleApproversAsync(OtForm otForm, OtFormApprovalStep step)
        {
            if (step.Candidates.Count == 0) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var hasNewToken = false;

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == otForm.GroupId);
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == otForm.DepartmentId);
            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == otForm.ReasonId);
            var departmentName = FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp);
            var groupName = FormatBilingual(group?.GroupNameVn, group?.GroupNameJp);
            var reasonName = FormatBilingual(reason?.ReasonNameVn, reason?.ReasonNameJp);

            foreach (var candidate in step.Candidates)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(candidate.UserName, EmailModules.Attendance);
                if (string.IsNullOrWhiteSpace(email)) continue;

                var emailToken = new OtFormApprovalEmailToken
                {
                    OtFormId = otForm.Id,
                    ApproverUserName = candidate.UserName,
                    ApproverFullName = fullName,
                    OtFormApprovalStepId = step.Id,
                    Token = TokenHelper.GenerateSecureToken(),
                    ExpiresAt = now.AddDays(EmailApprovalTokenExpiryDays),
                    CreatedAt = now
                };
                await _unitOfWork.OtFormApprovalEmailTokens.AddAsync(emailToken);
                hasNewToken = true;

                var link = $"{baseUrl}/xac-nhan-don?token={emailToken.Token}";

                try
                {
                    var html = _emailTemplateRenderer.Render("OtForm/ApprovalNotification.html", new Dictionary<string, string>
                    {
                        ["ApproverFullName"] = fullName ?? candidate.UserName,
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
                    // A missing template file is a deployment error — skip sending to this person rather
                    // than blocking the whole notification flow.
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        // Vietnamese is always shown; Japanese is appended only when the master data has it filled in.
        private static string FormatBilingual(string? nameVn, string? nameJp)
        {
            if (string.IsNullOrWhiteSpace(nameVn)) return "-";
            return string.IsNullOrWhiteSpace(nameJp) ? nameVn : $"{nameVn} / {nameJp}";
        }

        private async Task<List<Employee>> ValidateEmployeesAsync(
            int? groupId, TimeOnly formStartTime, TimeOnly formEndTime, List<CreateOtFormEmployeeItemDto> items)
        {
            var employeeIds = items.Select(x => x.EmployeeId).ToList();
            var employees = await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id) && !x.IsDeleted);
            if (employees.Count != employeeIds.Distinct().Count())
                throw new DomainException("Có nhân viên không tồn tại hoặc đã bị xóa trong danh sách.");

            // groupId null = đơn "theo chuyền" (OtForm.IsProductionForm = true) — không có Group cố
            // định để đối chiếu, bỏ qua check này (xem JobTitleApprovalChainService.
            // ResolveChainForProductionCreationAsync — phạm vi Group/Line suy tự động theo từng bước).
            if (groupId.HasValue)
            {
                var wrongGroupEmployee = employees.FirstOrDefault(x => x.GroupId != groupId);
                if (wrongGroupEmployee != null)
                    throw new DomainException($"Nhân viên '{wrongGroupEmployee.Code}' không thuộc nhóm đã chọn.");
            }

            var employeeById = employees.ToDictionary(x => x.Id);
            foreach (var item in items)
                EnsureEmployeeTimeWithinForm(
                    employeeById[item.EmployeeId].Code, item.StartTime ?? formStartTime, item.EndTime, formStartTime, formEndTime);

            return employees.ToList();
        }

        // Per-employee OT window must sit inside the form's window: formStart <= start < end <= formEnd.
        private static void EnsureEmployeeTimeWithinForm(
            string code, TimeOnly startTime, TimeOnly endTime, TimeOnly formStartTime, TimeOnly formEndTime)
        {
            if (startTime < formStartTime || startTime >= formEndTime)
                throw new DomainException(
                    $"Giờ bắt đầu OT của nhân viên '{code}' phải nằm trong khoảng giờ của đơn " +
                    $"({formStartTime:HH:mm}–{formEndTime:HH:mm}).");
            if (endTime <= startTime || endTime > formEndTime)
                throw new DomainException(
                    $"Giờ kết thúc OT của nhân viên '{code}' phải sau giờ bắt đầu ({startTime:HH:mm}) " +
                    $"và không được vượt quá giờ kết thúc của đơn ({formEndTime:HH:mm}).");
        }

        private async Task EnsureNoOverlappingOtFormsAsync(
            List<Employee> employees, DateOnly date, Dictionary<int, (TimeOnly Start, TimeOnly End)> employeeTimes, int? excludeFormId)
        {
            var employeeIds = employees.Select(x => x.Id).ToList();

            var existingRecords = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId)
                     && x.OtForm.Date == date
                     && !x.OtForm.IsDeleted
                     && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.IsRemoved
                     && (excludeFormId == null || x.OtFormId != excludeFormId.Value),
                x => x.OtForm);

            var overlapping = existingRecords
                .Where(x => employeeTimes.TryGetValue(x.EmployeeId, out var t) && t.Start < x.EndTime && t.End > x.StartTime)
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

            var employeeTimes = request.Employees.ToDictionary(
                x => x.EmployeeId, x => (Start: x.StartTime ?? request.StartTime, End: x.EndTime));

            var overlappingIds = existingRecords
                .Where(x => employeeTimes.TryGetValue(x.EmployeeId, out var t) && t.Start < x.EndTime && t.End > x.StartTime)
                .Select(x => x.EmployeeId)
                .Distinct()
                .ToList();

            return overlappingIds;
        }

        // IsEarlyMealWindowOt/CalculateOtHours/CalculateMealTicketType đã dời sang MealTicketCalculator
        // (cùng namespace Attendance.Application.Services, 2026-08-28) để ProductionOtReportService
        // dùng lại đúng công thức — gọi không cần qualify vì cùng namespace.
        private static (int Main, int Secondary) CalculateMealTicketCounts(
            IEnumerable<OtFormEmployee> activeEmployees, AttendanceSettingDto settings)
        {
            var main = 0;
            var secondary = 0;

            foreach (var employee in activeEmployees)
            {
                switch (CalculateMealTicketType(employee.StartTime, employee.EndTime, employee.DidEat, settings))
                {
                    case MealTicketType.Main: main++; break;
                    case MealTicketType.Secondary: secondary++; break;
                }
            }

            return (main, secondary);
        }

        // Gọi lại sau bất kỳ thay đổi nào tới danh sách/DidEat của nhân viên trong đơn SAU lúc tạo
        // (sửa thực tích, loại người khỏi đơn) để phiếu ăn không bị lệch với thực tế — chỉ đụng tới
        // MainTicketCount/SecondaryTicketCount, giữ nguyên MilkCount (luôn nhập tay). Mọi đơn từ
        // 2026-09-28 đều LUÔN có ProcessPart (Ăn uống bắt buộc, xem FinalizeCreateAsync) — guard null
        // dưới đây chỉ còn ý nghĩa phòng vệ cho đơn cũ tạo trước mốc này (nếu còn sót, dev DB đã xoá).
        private async Task RecalculateMealTicketCountsAsync(
            int otFormId, IEnumerable<OtFormEmployee> activeEmployees, AttendanceSettingDto settings)
        {
            var processPart = await _unitOfWork.ProcessParts.FirstOrDefaultAsync(x => x.OtFormId == otFormId);
            if (processPart == null) return;

            var (main, secondary) = CalculateMealTicketCounts(activeEmployees, settings);
            processPart.MainTicketCount = main;
            processPart.SecondaryTicketCount = secondary;
            _unitOfWork.ProcessParts.Update(processPart);
        }

        // 1 dòng OtFormEditLog cho 1 field/hành động thay đổi (2026-08-28, theo yêu cầu người dùng —
        // "mọi thao tác thay đổi này cần log lại ai làm gì thay đổi cái gì"). Gọi từ UpdateAsync (sửa
        // giờ/ghi chú), AddEmployeeAsync, RemoveEmployeeCoreAsync — KHÔNG gọi từ CreateAsync (đơn mới
        // đã có CreatedByUserName/CreatedAt làm log riêng).
        private async Task LogEditAsync(
            int otFormId, string userName, string? fullName, OtFormEditActionType actionType,
            int? employeeId, string? employeeCode, string? fieldName, string? oldValue, string? newValue)
        {
            await _unitOfWork.OtFormEditLogs.AddAsync(new OtFormEditLog
            {
                OtFormId = otFormId,
                ActionByUserName = userName,
                ActionByFullName = fullName,
                ActionAt = TimeHelper.GetCurrentUtcTime(),
                ActionType = (int)actionType,
                EmployeeId = employeeId,
                EmployeeCodeSnapshot = employeeCode,
                FieldName = fieldName,
                OldValue = oldValue,
                NewValue = newValue
            });
        }

        // Lũy kế THẬT không còn lưu trên Employee (2026-08-19) — hàm này giờ CHỈ ghi ledger
        // (EmployeeAccumulationHistory), nguồn chân lý DUY NHẤT cho lũy kế thật. EmployeeService tự
        // tính MonthToDate/YearToDate lúc đọc bằng cách sum ledger theo đúng tháng/năm THỰC TẾ hiện tại
        // — nên 1 đơn dán ngày tương lai chỉ "hiện" ra khi tới đúng tháng đó, không cộng sớm dù
        // Completed từ trước (xem docs/docs-be/attendance-module.md §Lũy kế).
        private async Task AccumulateEmployeeHoursAsync(OtForm otForm)
        {
            var mealSettings = await _attendanceSettingService.GetAsync();

            var otFormEmployees = await _unitOfWork.OtFormEmployees.FindAsync(x => x.OtFormId == otForm.Id && !x.IsRemoved);

            // Batch-fetch dòng ledger đã có sẵn TRƯỚC vòng lặp để tránh N+1. Chỉ cần khoá theo EmployeeId
            // (không cần thêm Year/Month vào key tra cứu) vì INVARIANT: trong 1 lần gọi hàm này, MỌI
            // nhân viên xử lý đều thuộc CHUNG đúng 1 OtForm nên dùng chung đúng 1 otForm.Date — cả 2 call
            // site (CreateAsync khi đơn Hoàn tất ngay lúc tạo, ApproveAsync khi hết bước Pending) đều
            // truyền vào đúng 1 OtForm duy nhất.
            var employeeIds = otFormEmployees.Select(x => x.EmployeeId).ToList();
            var existingLedgerRows = (await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => employeeIds.Contains(x.EmployeeId) && x.Year == otForm.Date.Year && x.Month == otForm.Date.Month))
                .ToDictionary(x => x.EmployeeId);

            foreach (var otFormEmployee in otFormEmployees)
            {
                var hours = CalculateOtHours(otFormEmployee.StartTime, otFormEmployee.EndTime, otFormEmployee.DidEat, mealSettings);

                if (existingLedgerRows.TryGetValue(otFormEmployee.EmployeeId, out var ledgerRow))
                {
                    ledgerRow.TotalHours += hours;
                    _unitOfWork.EmployeeAccumulationHistories.Update(ledgerRow);
                }
                else
                {
                    await _unitOfWork.EmployeeAccumulationHistories.AddAsync(new EmployeeAccumulationHistory
                    {
                        EmployeeId = otFormEmployee.EmployeeId,
                        Year = otForm.Date.Year,
                        Month = otForm.Date.Month,
                        TotalHours = hours
                    });
                }
            }
        }

        // Projected accumulation of a batch of employees around targetDate (the date on the form being checked,
        // not today):
        //   Day   = every valid form of the employee on that date (ledger has no daily figure);
        //   Month = ledger rows of that month + forms still InApproval in that month;
        //   Year  = ledger rows of the year (including the Month = 0 opening balance) + forms still InApproval that year.
        // Completed forms are NOT added again for Month/Year because AccumulateEmployeeHoursAsync already put their
        // hours in the ledger, which is also where imported and hand-edited figures live. A valid form is
        // !IsRemoved && Status != Rejected && !IsDeleted. excludeFormId skips the form being edited so its current
        // rows are not counted against its own new hours.
        private async Task<Dictionary<int, (decimal Day, decimal Month, decimal Year)>> ComputeAccumulatedHoursBatchAsync(
            IEnumerable<int> employeeIds, DateOnly targetDate, AttendanceSettingDto mealSettings, int? excludeFormId = null)
        {
            var employeeIdList = employeeIds.Distinct().ToList();

            var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIdList.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.OtForm.IsDeleted && x.OtForm.Date.Year == targetDate.Year
                     && (excludeFormId == null || x.OtFormId != excludeFormId.Value),
                x => x.OtForm);
            var ledgerRows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => employeeIdList.Contains(x.EmployeeId) && x.Year == targetDate.Year);

            var rowsByEmployee = rows.ToLookup(x => x.EmployeeId);
            var ledgerByEmployee = ledgerRows.ToLookup(x => x.EmployeeId);

            var result = new Dictionary<int, (decimal Day, decimal Month, decimal Year)>();
            foreach (var employeeId in employeeIdList)
            {
                var employeeRows = rowsByEmployee[employeeId].ToList();
                var pendingRows = employeeRows.Where(x => x.OtForm.Status != (int)OtFormStatus.Completed).ToList();
                var ledger = ledgerByEmployee[employeeId].ToList();

                result[employeeId] = (
                    Day: employeeRows.Where(x => x.OtForm.Date == targetDate)
                        .Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)),
                    Month: ledger.Where(x => x.Month == targetDate.Month).Sum(x => x.TotalHours)
                        + pendingRows.Where(x => x.OtForm.Date.Month == targetDate.Month)
                            .Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)),
                    Year: ledger.Sum(x => x.TotalHours)
                        + pendingRows.Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)));
            }
            return result;
        }

        // Hard-blocks create/update when an employee's total OT hours in the day, including this form's hours,
        // exceed the daily limit. The day total adds up every OT shift of that employee on that date (several
        // forms count together). Non-working days (WorkCalendarDay) use DailyOtHourLimitHoliday, working days
        // DailyOtHourLimit; there is no per-employee override. Month/year accumulation never blocks: passing
        // MonthlyOtHourLimit/YearlyOtHourLimit (or the employee's own custom limit) forces the form to TH3 instead,
        // see EnsureOtCaseMatchesRulesAsync. Message wording is mirrored in CreateOtFormPage.tsx.
        private async Task ValidateOtHourLimitsAsync(
            DateOnly date, Dictionary<int, decimal> newHoursByEmployeeId, AttendanceSettingDto settings, int? excludeFormId)
        {
            if (newHoursByEmployeeId.Count == 0) return;

            var accumulated = await ComputeAccumulatedHoursBatchAsync(newHoursByEmployeeId.Keys, date, settings, excludeFormId);
            var employeesById = (await _unitOfWork.Employees.FindAsync(x => newHoursByEmployeeId.Keys.Contains(x.Id)))
                .ToDictionary(x => x.Id);

            var dailyLimit = await IsNonWorkingDayAsync(date) ? settings.DailyOtHourLimitHoliday : settings.DailyOtHourLimit;

            var violations = new List<string>();
            foreach (var (employeeId, newHours) in newHoursByEmployeeId)
            {
                var dayBefore = accumulated.TryGetValue(employeeId, out var acc) ? acc.Day : 0m;
                var dayAfter = dayBefore + newHours;
                if (dayAfter > dailyLimit)
                {
                    var code = employeesById.GetValueOrDefault(employeeId)?.Code ?? employeeId.ToString();
                    violations.Add($"Nhân viên mã {code} quá giới hạn OT ngày ({dayAfter:0.##}h > {dailyLimit:0.##}h)");
                }
            }

            if (violations.Count > 0)
                throw new DomainException(string.Join("; ", violations) + ". Vui lòng loại khỏi đơn hoặc giảm giờ OT rồi thử lại.");
        }

        private async Task<bool> IsNonWorkingDayAsync(DateOnly date) =>
            (await _unitOfWork.WorkCalendarDays.FindAsync(x => x.Date == date)).Count > 0;

        // True when any employee's month or year accumulation, including this form's hours, passes
        // MonthlyOtHourLimit/YearlyOtHourLimit (the employee's custom limit wins when set). Such a form must be TH3.
        private async Task<bool> ExceedsMonthYearLimitAsync(
            DateOnly date, Dictionary<int, decimal> newHoursByEmployeeId, AttendanceSettingDto settings, int? excludeFormId)
        {
            if (newHoursByEmployeeId.Count == 0) return false;

            var accumulated = await ComputeAccumulatedHoursBatchAsync(newHoursByEmployeeId.Keys, date, settings, excludeFormId);
            var employeesById = (await _unitOfWork.Employees.FindAsync(x => newHoursByEmployeeId.Keys.Contains(x.Id)))
                .ToDictionary(x => x.Id);

            return newHoursByEmployeeId.Any(kv =>
            {
                var (_, monthBefore, yearBefore) = accumulated.TryGetValue(kv.Key, out var acc) ? acc : (0m, 0m, 0m);
                var employee = employeesById.GetValueOrDefault(kv.Key);
                var monthlyLimit = employee?.CustomMonthlyOtHourLimit ?? settings.MonthlyOtHourLimit;
                var yearlyLimit = employee?.CustomYearlyOtHourLimit ?? settings.YearlyOtHourLimit;
                return monthBefore + kv.Value > monthlyLimit || yearBefore + kv.Value > yearlyLimit;
            });
        }

        // The OT case is derived, not chosen: TH3 when ExceedsMonthYearLimitAsync, otherwise TH2 on a non-working
        // day and TH1 on a working day. The daily total never forces TH3. Rejects a request whose OtCaseId differs
        // from the derived case.
        private async Task EnsureOtCaseMatchesRulesAsync(CreateOtFormDto request, bool isProductionForm, OtCase requestedCase)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId,
                x => CalculateOtHours(x.StartTime ?? request.StartTime, x.EndTime, ResolveDidEat(isProductionForm, x.DidEat), settings));
            var exceedsTh3 = await ExceedsMonthYearLimitAsync(request.Date, newHoursByEmployeeId, settings, excludeFormId: null);

            var expectedCode = exceedsTh3 ? "TH3" : (await IsNonWorkingDayAsync(request.Date) ? "TH2" : "TH1");
            if (!string.Equals(requestedCase.Code, expectedCode, StringComparison.OrdinalIgnoreCase))
            {
                var reason = exceedsTh3
                    ? "có nhân viên vượt giới hạn OT tháng/năm"
                    : $"ngày {request.Date:dd/MM/yyyy} là {(expectedCode == "TH2" ? "ngày nghỉ" : "ngày làm việc")}";
                throw new DomainException($"Trường hợp OT phải là {expectedCode} vì {reason}.");
            }
        }

        // === "Đơn tổng" — REDESIGN theo Cây chức vụ (2026-08-07, Giai đoạn 3.2) ===
        //
        // Model cũ: 1 trạng thái CỐ ĐỊNH OtFormStatus.Pending = "đang chờ Trưởng phòng" (đã xoá). Model
        // mới: mỗi đơn có 1 chuỗi bước ĐỘNG (OtFormApprovalStep), số bước trung gian co giãn theo Phòng
        // ban. "Đang chờ Trưởng phòng" giờ suy ra bằng cách xem bước Pending có StepOrder NHỎ NHẤT của
        // đơn — nếu đúng là bước có TerminalLevelSnapshot=DepartmentManager thì đơn coi như "đủ điều
        // kiện gom Đơn tổng"; đơn còn kẹt ở bước trung gian trước đó (SUP/CHIEF...) thì KHÔNG được gom,
        // vẫn phải duyệt lẻ tới khi tự nó tới lượt Trưởng phòng (quyết định đã chốt với người dùng qua
        // AskUserQuestion trước khi code — xem docs/attendance-module.md §Đơn tổng).
        //
        // Toàn bộ business logic vẫn tái dùng trực tiếp ApproveAsync/RejectAsync/RemoveEmployeeAsync đã
        // có (không viết lại logic duyệt/từ chối/loại nhân viên) — chỉ thêm lớp gom nhóm + validate
        // fail-fast + gửi mail tóm tắt ở trên.

        // Id của các OtForm (thoả filter truyền vào) mà bước đang chờ HIỆN TẠI (Pending, StepOrder nhỏ
        // nhất) đúng là bước ở TerminalLevel truyền vào — điều kiện chung cho còn hiệu lực/tự đóng 1
        // batch cụ thể (batch đã có sẵn TerminalLevel riêng, xem OtFormBatch).
        private async Task<List<int>> GetActiveFormIdsForBatchAsync(Expression<Func<OtForm, bool>> formFilter, int terminalLevel)
        {
            var formIds = (await _unitOfWork.OtForms.SelectAsync(predicate: formFilter, selector: x => x.Id)).ToHashSet();
            if (formIds.Count == 0) return new List<int>();

            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.SelectAsync(
                predicate: s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending && formIds.Contains(s.OtFormId),
                selector: s => new { s.OtFormId, s.StepOrder, s.TerminalLevelSnapshot });

            return pendingSteps
                .GroupBy(s => s.OtFormId)
                .Where(g => g.OrderBy(s => s.StepOrder).First().TerminalLevelSnapshot == terminalLevel)
                .Select(g => g.Key)
                .ToList();
        }

        // Đơn CHƯA từng vào batch nào (OtFormBatchId==null) mà bước đang chờ hiện tại đúng là 1 trong 3
        // cấp quản lý (DepartmentManager/WorkshopManager/GeneralDirector) — nền tảng cho bước (a) của
        // RunDailyBatchSweepAsync. Trả kèm DepartmentId/TerminalLevel để nhóm batch đúng phạm vi: cấp
        // DepartmentManager gom theo từng Phòng ban, 2 cấp còn lại gom company-wide (1 batch/cấp/ngày,
        // vì candidate ở 2 cấp này vốn không lọc theo Department — xem JobTitleApprovalChainService).
        private async Task<List<(int OtFormId, int DepartmentId, int TerminalLevel)>> GetNewFormsAtManagerStepAsync()
        {
            var candidateForms = await _unitOfWork.OtForms.SelectAsync(
                predicate: x => !x.IsDeleted && x.OtFormBatchId == null && x.Status == (int)OtFormStatus.InApproval,
                selector: x => new { x.Id, x.DepartmentId });
            if (candidateForms.Count == 0) return new List<(int, int, int)>();

            var formIds = candidateForms.Select(x => x.Id).ToHashSet();
            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.SelectAsync(
                predicate: s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending && formIds.Contains(s.OtFormId),
                selector: s => new { s.OtFormId, s.StepOrder, s.TerminalLevelSnapshot });

            var levelByFormId = pendingSteps
                .GroupBy(s => s.OtFormId)
                .Select(g => new { g.Key, Level = g.OrderBy(s => s.StepOrder).First().TerminalLevelSnapshot })
                .Where(x => x.Level != (int)JobTitleTerminalLevel.None)
                .ToDictionary(x => x.Key, x => x.Level);

            return candidateForms
                .Where(f => levelByFormId.ContainsKey(f.Id))
                .Select(f => (f.Id, f.DepartmentId, levelByFormId[f.Id]))
                .ToList();
        }

        // Tên hiển thị phạm vi của 1 batch — Department (bilingual) nếu TerminalLevel=DepartmentManager,
        // ngược lại là tên JobTitle ứng với TerminalLevel đó (company-wide, JobTitle không có bản Jp).
        private async Task<(string ScopeNameVn, string? ScopeNameJp)> ResolveBatchScopeNameAsync(OtFormBatch batch)
        {
            if (batch.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
            {
                var department = batch.Department ?? await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == batch.DepartmentId!.Value);
                return (department?.DepartmentNameVn ?? "", department?.DepartmentNameJp);
            }

            var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.TerminalLevel == batch.TerminalLevel && !x.IsDeleted);
            return (jobTitle?.Name ?? "", null);
        }

        public async Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(string userName, bool isAdmin, int pageIndex, int pageSize)
        {
            var query = _unitOfWork.OtFormBatches.GetQueryable(false, x => x.Department!);

            if (!isAdmin)
            {
                // Chỉ Admin thấy hết — người thường chỉ thấy Đơn tổng của phạm vi mà mình đang/đã từng
                // là candidate hợp lệ ở đúng cấp đó (không nhất thiết đơn còn trong batch này): cấp
                // DepartmentManager so theo đúng DepartmentId; WorkshopManager/GeneralDirector
                // company-wide nên chỉ cần khớp TerminalLevel, không lọc Department.
                var myCandidacies = (await _unitOfWork.OtFormApprovalStepCandidates.SelectAsync(
                    predicate: c => c.UserName == userName && c.OtFormApprovalStep.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None,
                    selector: c => new { c.OtFormApprovalStep.TerminalLevelSnapshot, c.OtFormApprovalStep.OtForm.DepartmentId }))
                    .Distinct().ToList();

                var myDepartmentManagerDeptIds = myCandidacies
                    .Where(x => x.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.DepartmentManager)
                    .Select(x => x.DepartmentId).ToHashSet();
                var myCompanyWideLevels = myCandidacies
                    .Where(x => x.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.DepartmentManager)
                    .Select(x => x.TerminalLevelSnapshot).ToHashSet();

                query = query.Where(x =>
                    (x.DepartmentId != null && myDepartmentManagerDeptIds.Contains(x.DepartmentId.Value))
                    || (x.DepartmentId == null && myCompanyWideLevels.Contains(x.TerminalLevel)));
            }

            query = query.OrderByDescending(x => x.Id);

            var page = await _unitOfWork.OtFormBatches.ToPagedResponseAsync(query, pageIndex, pageSize, x => new OtFormBatchListItemDto
            {
                Id = x.Id,
                TerminalLevel = x.TerminalLevel,
                DepartmentId = x.DepartmentId,
                ScopeNameVn = x.Department != null ? x.Department.DepartmentNameVn : "",
                ScopeNameJp = x.Department != null ? x.Department.DepartmentNameJp : null,
                BatchDate = x.BatchDate,
                Status = x.Status,
                FormCount = x.OtForms.Count(f => !f.IsDeleted),
                EmployeeCount = x.OtForms.Where(f => !f.IsDeleted).SelectMany(f => f.OtFormEmployees).Count(e => !e.IsRemoved),
                TotalHour = x.OtForms.Where(f => !f.IsDeleted).Sum(f => f.TotalHour),
                CreatedAt = x.CreatedAt,
                ProcessedAt = x.ProcessedAt,
                ProcessedByFullName = x.ProcessedByFullName
            });

            await FillCompanyWideBatchScopeNamesAsync(page.Data);
            return page;
        }

        // ScopeNameVn ở trên chỉ điền được ngay trong query cho batch có Department (TerminalLevel=
        // DepartmentManager) — 2 cấp company-wide (WorkshopManager/GeneralDirector) không có Department
        // để join, phải tra riêng qua JobTitle.TerminalLevel (1 query gộp cho cả trang, không N+1).
        private async Task FillCompanyWideBatchScopeNamesAsync(IReadOnlyList<OtFormBatchListItemDto> items)
        {
            var levels = items.Where(x => x.DepartmentId == null).Select(x => x.TerminalLevel).Distinct().ToList();
            if (levels.Count == 0) return;

            var nameByLevel = (await _unitOfWork.JobTitles.SelectAsync(
                predicate: x => !x.IsDeleted && levels.Contains(x.TerminalLevel),
                selector: x => new { x.TerminalLevel, x.Name }))
                .ToDictionary(x => x.TerminalLevel, x => x.Name);

            foreach (var item in items.Where(x => x.DepartmentId == null))
                item.ScopeNameVn = nameByLevel.GetValueOrDefault(item.TerminalLevel, "");
        }

        public async Task<OtFormBatchDto> GetBatchByIdAsync(int id)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == id, x => x.Department!);
            batch.OrThrowNotFound("Đơn tổng", id);
            return await BuildBatchDtoAsync(batch!);
        }

        // otForms chỉ còn các đơn VẪN CÒN hiệu lực xử lý (đang chờ đúng bước ở TerminalLevel của batch)
        // — đơn nào đã bị duyệt/từ chối lẻ tay ngoài luồng batch thì rơi khỏi danh sách này (không xoá
        // liên kết OtFormBatchId, chỉ đơn giản không còn hiển thị như "chờ xử lý" ở đây nữa).
        private async Task<OtFormBatchDto> BuildBatchDtoAsync(OtFormBatch batch)
        {
            var activeFormIds = await GetActiveFormIdsForBatchAsync(
                x => !x.IsDeleted && x.OtFormBatchId == batch.Id && x.Status == (int)OtFormStatus.InApproval, batch.TerminalLevel);

            var otForms = activeFormIds.Count == 0
                ? new List<OtForm>()
                : (await _unitOfWork.OtForms.FindWithIncludesAsync(
                    x => activeFormIds.Contains(x.Id), x => x.Group!, x => x.Reason, x => x.OtCase))
                    .OrderBy(x => x.Id).ToList();

            var employeesByFormId = activeFormIds.Count == 0
                ? new Dictionary<int, List<OtFormEmployee>>()
                : (await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                    x => activeFormIds.Contains(x.OtFormId) && !x.IsRemoved, x => x.Employee))
                    .GroupBy(x => x.OtFormId)
                    .ToDictionary(g => g.Key, g => g.ToList());

            // Trưởng phòng cần thấy "Yêu cầu hỗ trợ khác" (ăn uống/xe đưa đón/phòng copy) như màn Chi
            // tiết đơn thường — trước đây batch chỉ có bảng nhân viên rút gọn (2026-08-08).
            var processPartsByFormId = activeFormIds.Count == 0
                ? new Dictionary<int, ProcessPart>()
                : (await _unitOfWork.ProcessParts.FindAsync(x => activeFormIds.Contains(x.OtFormId)))
                    .ToDictionary(x => x.OtFormId);

            var mealSettings = await _attendanceSettingService.GetAsync();
            var (scopeNameVn, scopeNameJp) = await ResolveBatchScopeNameAsync(batch);

            return new OtFormBatchDto
            {
                Id = batch.Id,
                TerminalLevel = batch.TerminalLevel,
                DepartmentId = batch.DepartmentId,
                ScopeNameVn = scopeNameVn,
                ScopeNameJp = scopeNameJp,
                BatchDate = batch.BatchDate,
                Status = batch.Status,
                CreatedAt = batch.CreatedAt,
                ProcessedAt = batch.ProcessedAt,
                ProcessedByUserName = batch.ProcessedByUserName,
                ProcessedByFullName = batch.ProcessedByFullName,
                OtForms = otForms.Select(f => new OtFormBatchItemDto
                {
                    OtFormId = f.Id,
                    GroupNameVn = f.Group != null ? f.Group.GroupNameVn : null,
                    GroupNameJp = f.Group != null ? f.Group.GroupNameJp : null,
                    IsProductionForm = f.IsProductionForm,
                    ReasonNameVn = f.Reason.ReasonNameVn,
                    ReasonNameJp = f.Reason.ReasonNameJp,
                    OtCaseCode = f.OtCase.Code,
                    Date = f.Date,
                    StartTime = f.StartTime,
                    EndTime = f.EndTime,
                    SubReason = f.SubReason,
                    TotalHour = f.TotalHour,
                    CreatedByUserName = f.CreatedByUserName,
                    CreatedByFullName = f.CreatedByFullName,
                    NumberOfEmployee = f.NumberOfEmployee,
                    ProcessPart = !processPartsByFormId.TryGetValue(f.Id, out var pp) ? null : new ProcessPartDto
                    {
                        IsEat = pp.IsEat,
                        MainTicketCount = pp.MainTicketCount,
                        SecondaryTicketCount = pp.SecondaryTicketCount,
                        MilkCount = pp.MilkCount,
                        IsTransportation = pp.IsTransportation,
                        IsUseCopyRoom = pp.IsUseCopyRoom,
                        AnotherSuggestionVn = pp.AnotherSuggestionVn,
                        AnotherSuggestionJp = pp.AnotherSuggestionJp
                    },
                    Employees = !employeesByFormId.TryGetValue(f.Id, out var emps)
                        ? new List<OtFormEmployeeDto>()
                        : emps.Select(x => new OtFormEmployeeDto
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
                            CustomMonthlyOtHourLimit = x.Employee.CustomMonthlyOtHourLimit,
                            CustomYearlyOtHourLimit = x.Employee.CustomYearlyOtHourLimit,
                            MealTicketType = (int)CalculateMealTicketType(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                            ActualHours = CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                            DidEat = x.DidEat,
                            IsRemoved = x.IsRemoved,
                            RemovedByUserName = x.RemovedByUserName,
                            RemovedByFullName = x.RemovedByFullName,
                            RemovedAtLevel = x.RemovedAtLevel,
                            RemovedAt = x.RemovedAt,
                            RemoveReason = x.RemoveReason,
                            CongDoanSnapshot = x.CongDoanSnapshot,
                            TaskNameSnapshot = x.TaskNameSnapshot,
                            BlockCodeSnapshot = x.BlockCodeSnapshot,
                            TeamCodeSnapshot = x.TeamCodeSnapshot,
                            ShiftTeamCodeSnapshot = x.ShiftTeamCodeSnapshot
                        }).ToList()
                }).ToList()
            };
        }

        public async Task<OtFormBatchDto> ProcessBatchAsync(int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == batchId, x => x.Department!);
            batch.OrThrowNotFound("Đơn tổng", batchId);

            if (batch!.Status != (int)OtFormBatchStatus.Pending)
                throw new DomainException("Đơn tổng này đã được xử lý xong.");

            var activeFormIds = await GetActiveFormIdsForBatchAsync(
                x => !x.IsDeleted && x.OtFormBatchId == batchId && x.Status == (int)OtFormStatus.InApproval, batch.TerminalLevel);

            if (activeFormIds.Count == 0)
            {
                // Mọi đơn thành viên đã được xử lý lẻ tay ngoài luồng batch — tự đóng, không cần
                // request.Forms khớp gì cả (đằng nào cũng không còn đơn nào để duyệt).
                batch.Status = (int)OtFormBatchStatus.Processed;
                batch.ProcessedAt = TimeHelper.GetCurrentUtcTime();
                _unitOfWork.OtFormBatches.Update(batch);
                await _unitOfWork.SaveChangesAsync();
                return await BuildBatchDtoAsync(batch);
            }

            var requestedFormIds = request.Forms.Select(x => x.OtFormId).ToList();
            if (requestedFormIds.Count != requestedFormIds.Distinct().Count())
                throw new DomainException("Danh sách đơn có mã trùng lặp.");
            if (!requestedFormIds.ToHashSet().SetEquals(activeFormIds))
                throw new DomainException("Danh sách đơn gửi lên không khớp với danh sách đơn còn hiệu lực của đơn tổng này — vui lòng tải lại trang.");

            // Validate fail-fast TRƯỚC khi ghi bất cứ gì (không dùng transaction DB — đúng tiền lệ
            // codebase, xem ApproveAsync/RejectAsync — nên phải chặn hết lỗi có thể lường trước ở đây).
            var currentStepByFormId = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => activeFormIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.StepOrder).First());

            var activeEmployeeCountByFormId = (await _unitOfWork.OtFormEmployees.FindAsync(
                x => activeFormIds.Contains(x.OtFormId) && !x.IsRemoved))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var item in request.Forms)
            {
                if (!currentStepByFormId.TryGetValue(item.OtFormId, out var step) || !step.Candidates.Any(c => c.UserName == approverUserName))
                    throw new DomainException($"Bạn không được phân quyền duyệt đơn #{item.OtFormId} ở bước hiện tại của đơn này.");

                if (item.Decision == (int)OtFormBatchFormDecision.Reject)
                {
                    if (string.IsNullOrWhiteSpace(item.RejectReason))
                        throw new DomainException($"Đơn #{item.OtFormId}: lý do từ chối không được để trống.");
                }
                else
                {
                    var excludedCount = item.ExcludedEmployeeIds?.Count ?? 0;
                    var activeCount = activeEmployeeCountByFormId.GetValueOrDefault(item.OtFormId);
                    if (excludedCount >= activeCount)
                        throw new DomainException(
                            $"Đơn #{item.OtFormId}: loại hết toàn bộ nhân viên sẽ khiến đơn còn 0 người — hãy dùng Từ chối thay vì loại hết.");
                }
            }

            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            // Xử lý từng đơn — tái dùng nguyên vẹn RejectAsync/RemoveEmployeeAsync/ApproveAsync đã có,
            // mỗi đơn tiếp tục đúng luồng hiện hành (cộng lũy kế, gửi mail cấp kế tiếp nếu còn) không
            // đổi 1 dòng logic duyệt/từ chối.
            foreach (var item in request.Forms)
            {
                if (item.Decision == (int)OtFormBatchFormDecision.Reject)
                {
                    await RejectAsync(item.OtFormId, approverUserName, approverFullName, new RejectOtFormDto
                    {
                        Comment = item.RejectReason!,
                        SecondaryPassword = request.SecondaryPassword
                    });
                    continue;
                }

                if (item.ExcludedEmployeeIds != null)
                {
                    foreach (var employeeId in item.ExcludedEmployeeIds)
                    {
                        // Gọi thẳng phần lõi (2026-09-04, sau khi bỏ wrapper RemoveEmployeeAsync trong-app —
                        // xem docs/attendance-module.md §Cây chức vụ & Cây duyệt (mục Sửa đơn)) — mật khẩu cấp 2 đã
                        // verify 1 lần ở trên (dòng ~1990) cho cả batch nên truyền null để khỏi verify lại.
                        await RemoveEmployeeCoreAsync(
                            item.OtFormId, approverUserName, approverFullName, isAdmin: false,
                            employeeId, "Loại khi duyệt Đơn tổng", secondaryPassword: null);
                    }

                    // 1 mail per form listing every employee removed in this pass, not 1 per employee.
                    QueueEmployeesRemovedNotification(item.OtFormId, item.ExcludedEmployeeIds.ToList());
                }

                await ApproveAsync(item.OtFormId, approverUserName, approverFullName, new ApproveOtFormDto
                {
                    SecondaryPassword = request.SecondaryPassword
                });
            }

            batch.Status = (int)OtFormBatchStatus.Processed;
            batch.ProcessedAt = TimeHelper.GetCurrentUtcTime();
            batch.ProcessedByUserName = approverUserName;
            batch.ProcessedByFullName = approverFullName;
            _unitOfWork.OtFormBatches.Update(batch);
            await _unitOfWork.SaveChangesAsync();

            return await BuildBatchDtoAsync(batch);
        }

        // === Kênh email cho "Đơn tổng" — cùng nguyên tắc token-là-xác-thực-duy-nhất như OtForm lẻ. ===

        public async Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveBatchEmailTokenAsync(token, requireUnused: false);
            return await GetBatchByIdAsync(emailToken.OtFormBatchId);
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

        // Gửi mail tóm tắt cho TẤT CẢ candidate của bước ở TerminalLevel của batch, gộp theo UserName
        // (1 người có thể là candidate của nhiều đơn trong cùng batch — chỉ nhận 1 mail, không lặp
        // lại) — mirror NotifyEligibleApproversAsync (đơn lẻ) nhưng gộp nhiều đơn vào 1 email.
        private async Task NotifyBatchApproversAsync(OtFormBatch batch, List<OtForm> activeForms, bool isReminder)
        {
            if (activeForms.Count == 0) return;

            var formIds = activeForms.Select(x => x.Id).ToHashSet();
            var candidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => formIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending
                    && x.TerminalLevelSnapshot == batch.TerminalLevel,
                x => x.Candidates))
                .SelectMany(x => x.Candidates)
                .GroupBy(x => x.UserName)
                .Select(g => g.First())
                .ToList();

            if (candidates.Count == 0) return;

            var (scopeNameVn, scopeNameJp) = await ResolveBatchScopeNameAsync(batch);
            var scopeName = FormatBilingual(scopeNameVn, scopeNameJp);
            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var employeeCount = (await _unitOfWork.OtFormEmployees.FindAsync(x => formIds.Contains(x.OtFormId) && !x.IsRemoved)).Count;
            var totalHour = activeForms.Sum(x => x.TotalHour);
            var hasNewToken = false;

            foreach (var candidate in candidates)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(candidate.UserName, EmailModules.Attendance);
                if (string.IsNullOrWhiteSpace(email)) continue;

                var emailToken = new OtFormBatchEmailToken
                {
                    OtFormBatchId = batch.Id,
                    ApproverUserName = candidate.UserName,
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
                        ["OtFormBatchId"] = batch.Id.ToString(),
                        ["ApproverFullName"] = fullName ?? candidate.UserName,
                        ["FormCount"] = activeForms.Count.ToString(),
                        ["ScopeName"] = scopeName,
                        ["BatchDate"] = batch.BatchDate.ToString("dd/MM/yyyy"),
                        ["EmployeeCount"] = employeeCount.ToString(),
                        ["TotalHour"] = totalHour.ToString("0.##"),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    });

                    var subjectPrefix = isReminder ? "[Nhắc nhở] " : "";
                    await _emailService.SendAsync(
                        email, $"{subjectPrefix}Đơn tổng #{batch.Id} ({activeForms.Count} đơn) đang chờ bạn duyệt - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // Thiếu file template là lỗi deploy — bỏ qua gửi mail cho người này, không chặn
                    // nghiệp vụ chính (cùng nguyên tắc NotifyEligibleApproversAsync).
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        // Gọi bởi OtFormBatchBackgroundService (mặc định 15:00 hằng ngày, xem Program.cs):
        // (a) gom đơn CHƯA từng vào batch, hiện đúng 1 trong 3 bước quản lý → tạo batch mới (Department
        //     Manager gom theo từng Department; WorkshopManager/GeneralDirector gom company-wide, 1
        //     batch/cấp/ngày vì candidate 2 cấp này vốn không lọc theo Department), gửi mail lần đầu;
        //     (b) với batch cũ còn Pending: hết đơn hiệu lực → tự đóng (không mail), còn đơn hiệu lực →
        //     gửi mail nhắc (IsReminder=true), KHÔNG gộp thêm đơn mới vào batch cũ.
        public async Task RunDailyBatchSweepAsync()
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var today = DateOnly.FromDateTime(now);

            var newFormRows = await GetNewFormsAtManagerStepAsync();

            var newBatches = new List<(OtFormBatch Batch, List<OtForm> Forms)>();

            if (newFormRows.Count > 0)
            {
                var newFormIds = newFormRows.Select(x => x.OtFormId).ToHashSet();
                var newFormsById = (await _unitOfWork.OtForms.FindAsync(x => newFormIds.Contains(x.Id))).ToDictionary(x => x.Id);

                // DepartmentManager gom theo (TerminalLevel, DepartmentId); WorkshopManager/GeneralDirector
                // company-wide nên nhóm theo TerminalLevel với DepartmentId=null (key dùng int.MinValue để
                // đại diện "null" trong GroupBy, không ảnh hưởng gì ngoài phạm vi vòng lặp này).
                var groups = newFormRows.GroupBy(r => (
                    TerminalLevel: r.TerminalLevel,
                    DepartmentId: r.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager ? r.DepartmentId : (int?)null));

                foreach (var group in groups)
                {
                    var newBatch = new OtFormBatch
                    {
                        TerminalLevel = group.Key.TerminalLevel,
                        DepartmentId = group.Key.DepartmentId,
                        BatchDate = today,
                        Status = (int)OtFormBatchStatus.Pending,
                        CreatedAt = now
                    };
                    await _unitOfWork.OtFormBatches.AddAsync(newBatch);

                    var groupForms = group.Select(r => newFormsById[r.OtFormId]).ToList();
                    foreach (var form in groupForms)
                    {
                        form.OtFormBatch = newBatch;
                        _unitOfWork.OtForms.Update(form);
                    }

                    newBatches.Add((newBatch, groupForms));
                }

                await _unitOfWork.SaveChangesAsync();
            }

            foreach (var (batch, forms) in newBatches)
                await NotifyBatchApproversAsync(batch, forms, isReminder: false);

            var newBatchIds = newBatches.Select(x => x.Batch.Id).ToHashSet();
            var pendingBatches = await _unitOfWork.OtFormBatches.FindAsync(x => x.Status == (int)OtFormBatchStatus.Pending);

            foreach (var batch in pendingBatches)
            {
                // Batch vừa tạo ở bước (a) trong CHÍNH lần chạy này đã nhận mail lần đầu rồi, khỏi nhắc lại ngay.
                if (newBatchIds.Contains(batch.Id)) continue;

                var activeFormIds = await GetActiveFormIdsForBatchAsync(
                    x => !x.IsDeleted && x.OtFormBatchId == batch.Id && x.Status == (int)OtFormStatus.InApproval, batch.TerminalLevel);

                if (activeFormIds.Count == 0)
                {
                    batch.Status = (int)OtFormBatchStatus.Processed;
                    batch.ProcessedAt = now;
                    _unitOfWork.OtFormBatches.Update(batch);
                    continue;
                }

                var activeForms = (await _unitOfWork.OtForms.FindAsync(x => activeFormIds.Contains(x.Id))).ToList();
                await NotifyBatchApproversAsync(batch, activeForms, isReminder: true);
            }

            await _unitOfWork.SaveChangesAsync();
        }
    }
}
