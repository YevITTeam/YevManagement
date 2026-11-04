using System.Net;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    public class OtFormNotificationService : BaseService<IAttendanceUnitOfWork>, IOtFormNotificationService
    {
        private const int EmailApprovalTokenExpiryDays = 3;

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IAttendanceMailLogService _mailLogService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public OtFormNotificationService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IAttendanceMailLogService mailLogService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _mailLogService = mailLogService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
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

        public async Task SendApprovedNotificationAsync(int otFormId)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == otFormId);
            if (otForm == null || otForm.Status != (int)OtFormStatus.Completed) return;

            var approval = (await _unitOfWork.OtFormApprovalHistories.FindAsync(
                x => x.OtFormId == otFormId && x.Action == (int)ApprovalAction.Approved))
                .OrderByDescending(x => x.ActionAt).FirstOrDefault();
            if (approval == null || approval.ApproverUserName == otForm.CreatedByUserName) return;

            var detailBlock = BuildRequesterDetailRow("NGƯỜI DUYỆT CUỐI", "最終承認者",
                WebUtility.HtmlEncode(approval.ApproverFullName ?? approval.ApproverUserName), ApprovedAccentColor, ApprovedBlockBackground);

            await SendRequesterNotificationAsync(
                otForm,
                actorFullName: approval.ApproverFullName ?? approval.ApproverUserName,
                subject: $"[ĐÃ DUYỆT] Đơn tăng ca #{otForm.Id} đã được duyệt - YevManagement",
                statusLabelVn: "ĐƠN TĂNG CA ĐÃ ĐƯỢC DUYỆT", statusLabelJp: "残業申請が承認されました",
                introVn: "Đơn tăng ca bạn đã lập đã được duyệt hoàn tất.",
                introJp: "作成された残業申請の承認が完了しました。",
                detailBlock, ApprovedAccentColor);
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
            if (string.IsNullOrWhiteSpace(email))
            {
                await _mailLogService.LogSkippedAsync(otForm.CreatedByUserName, subject);
                return;
            }

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

                await _mailLogService.SendAsync(otForm.CreatedByUserName, email, subject, html);
            }
            catch (FileNotFoundException)
            {
                // A missing template file is a deployment error — must not break the business flow.
            }
        }

        private const string RejectedAccentColor = "#c0182b";
        private const string EmployeesRemovedAccentColor = "#b45309";
        private const string ApprovedAccentColor = "#15803d";
        private const string ApprovedBlockBackground = "#f0f9f3";

        // 1 full-width highlighted row (accent left border) of the outcome-specific block;
        // valueHtml must already be HTML-encoded.
        private static string BuildRequesterDetailRow(string labelVn, string labelJp, string valueHtml, string accentColor, string backgroundColor = "#fbf3f4") =>
            $"<tr><td colspan=\"2\" style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; padding:14px 16px; background-color:{backgroundColor}; border-left:4px solid {accentColor}; border-bottom:1px solid #e7e9ee;\">" +
            "<span style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; display:block; font-size:11px; letter-spacing:0.5px; color:#9aa2b1; mso-line-height-rule:exactly; line-height:16px;\">" +
            $"{labelVn}&nbsp;/&nbsp;{labelJp}</span>" +
            $"<span style=\"font-family:'Times New Roman', 'Liberation Serif', Georgia, serif; display:block; font-size:15px; font-weight:bold; color:{accentColor}; margin-top:4px; mso-line-height-rule:exactly; line-height:22px;\">" +
            $"{valueHtml}</span></td></tr>";

        // Never throws on missing email or SMTP errors: mail is a supplementary channel.
        private async Task NotifyEligibleApproversAsync(OtForm otForm, OtFormApprovalStep step)
        {
            if (step.Candidates.Count == 0) return;

            var recipients = await GetMailRecipientsAsync(step.Candidates.Select(c => c.UserName));
            if (await SendApprovalMailsAsync(otForm, step, recipients))
                await _unitOfWork.SaveChangesAsync();
        }

        // Candidates plus anyone currently covering one of them by delegation (CoveredFullName = the delegator).
        private async Task<List<(string UserName, string? CoveredFullName)>> GetMailRecipientsAsync(IEnumerable<string> candidateUserNames)
        {
            var candidates = candidateUserNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var covering = await _unitOfWork.ApprovalDelegations.SelectAsync(
                predicate: d => !d.IsDeleted && d.FromDate <= today && d.ToDate >= today
                    && d.DelegateEmployee.UserName != null && candidates.Contains(d.DelegatorEmployee.UserName!),
                selector: d => new { Delegate = d.DelegateEmployee.UserName!, d.DelegatorEmployee.LastName, d.DelegatorEmployee.FirstName });

            var recipients = candidates.Select(c => (UserName: c, CoveredFullName: (string?)null)).ToList();
            foreach (var row in covering)
            {
                if (!recipients.Any(r => string.Equals(r.UserName, row.Delegate, StringComparison.OrdinalIgnoreCase)))
                    recipients.Add((row.Delegate, $"{row.LastName} {row.FirstName}"));
            }
            return recipients;
        }

        // Wording of one notification mail; the renderer substitutes raw text, so names are HTML-encoded here.
        private sealed record MailWording(string StatusLabel, string IntroVn, string IntroJp, string SubjectTail)
        {
            public void AddTo(Dictionary<string, string> placeholders)
            {
                placeholders["StatusLabel"] = StatusLabel;
                placeholders["IntroVn"] = IntroVn;
                placeholders["IntroJp"] = IntroJp;
            }
        }

        // coveredFullName = the delegator when the recipient is only covering them; null for a direct candidate.
        private static MailWording BuildApprovalWording(string? coveredFullName, int otFormId, string requesterFullName)
        {
            if (coveredFullName == null)
            {
                return new MailWording(
                    "CHỜ PHÊ DUYỆT&nbsp;&nbsp;·&nbsp;&nbsp;承認待ち",
                    "Hệ thống ghi nhận một đơn yêu cầu tăng ca đang chờ sự phê duyệt của bạn. Vui lòng xem thông tin chi tiết bên dưới.",
                    "残業申請が届いており、あなたの承認をお待ちしています。詳細は下記よりご確認ください。",
                    "đang chờ bạn duyệt");
            }

            var name = WebUtility.HtmlEncode(coveredFullName);
            return new MailWording(
                "CHỜ DUYỆT THAY&nbsp;&nbsp;·&nbsp;&nbsp;代理承認待ち",
                $"Bạn được <b>{name}</b> ủy quyền duyệt thay. Đơn yêu cầu tăng ca bên dưới đang chờ phê duyệt, bạn có thể duyệt hoặc từ chối thay {name}. Vui lòng xem thông tin chi tiết bên dưới.",
                $"<b>{name}</b>様より承認の代理を委任されています。下記の残業申請が承認待ちです。{name}様の代理として承認または却下できます。詳細は下記よりご確認ください。",
                $"đang chờ bạn duyệt thay {coveredFullName}");
        }

        private static MailWording BuildBatchWording(string? coveredFullName, int batchId, int formCount, string scopeName)
        {
            if (coveredFullName == null)
            {
                return new MailWording(
                    "ĐƠN TỔNG&nbsp;&nbsp;·&nbsp;&nbsp;CHỜ PHÊ DUYỆT&nbsp;&nbsp;·&nbsp;&nbsp;一括承認待ち",
                    $"Hệ thống đã gom {formCount} đơn tăng ca thuộc phạm vi {scopeName} thành 1 đơn tổng, đang chờ bạn phê duyệt 1 lần. Vui lòng xem thông tin chi tiết bên dưới.",
                    $"{scopeName}の残業申請{formCount}件が一括申請としてまとめられ、あなたの承認をお待ちしています。詳細は下記よりご確認ください。",
                    "đang chờ bạn duyệt");
            }

            var name = WebUtility.HtmlEncode(coveredFullName);
            return new MailWording(
                "ĐƠN TỔNG&nbsp;&nbsp;·&nbsp;&nbsp;CHỜ DUYỆT THAY&nbsp;&nbsp;·&nbsp;&nbsp;一括代理承認待ち",
                $"Bạn được <b>{name}</b> ủy quyền duyệt thay. Hệ thống đã gom {formCount} đơn tăng ca thuộc phạm vi {scopeName} thành 1 đơn tổng đang chờ phê duyệt, bạn có thể duyệt thay {name} 1 lần. Vui lòng xem thông tin chi tiết bên dưới.",
                $"<b>{name}</b>様より承認の代理を委任されています。{scopeName}の残業申請{formCount}件が一括申請としてまとめられ、承認待ちです。{name}様の代理として一括で承認できます。詳細は下記よりご確認ください。",
                $"đang chờ bạn duyệt thay {coveredFullName}");
        }

        // True when at least one token was added; the caller owns SaveChanges.
        private async Task<bool> SendApprovalMailsAsync(
            OtForm otForm, OtFormApprovalStep step, List<(string UserName, string? CoveredFullName)> recipients)
        {
            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var hasNewToken = false;

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == otForm.GroupId);
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == otForm.DepartmentId);
            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == otForm.ReasonId);
            var departmentName = FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp);
            var groupName = FormatBilingual(group?.GroupNameVn, group?.GroupNameJp);
            var reasonName = FormatBilingual(reason?.ReasonNameVn, reason?.ReasonNameJp);

            foreach (var recipient in recipients)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(recipient.UserName, EmailModules.Attendance);
                if (string.IsNullOrWhiteSpace(email))
                {
                    await _mailLogService.LogSkippedAsync(recipient.UserName, $"Đơn tăng ca #{otForm.Id} chờ duyệt - YevManagement");
                    continue;
                }

                var emailToken = new OtFormApprovalEmailToken
                {
                    OtFormId = otForm.Id,
                    ApproverUserName = recipient.UserName,
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
                    var requesterName = otForm.CreatedByFullName ?? otForm.CreatedByUserName;
                    var wording = BuildApprovalWording(recipient.CoveredFullName, otForm.Id, requesterName);
                    var placeholders = new Dictionary<string, string>
                    {
                        ["ApproverFullName"] = fullName ?? recipient.UserName,
                        ["OtFormId"] = otForm.Id.ToString(),
                        ["RequesterFullName"] = requesterName,
                        ["DepartmentName"] = departmentName,
                        ["GroupName"] = groupName,
                        ["ReasonName"] = reasonName,
                        ["OtFormDate"] = otForm.Date.ToString("dd/MM/yyyy"),
                        ["OtFormTime"] = $"{otForm.StartTime:HH\\:mm} - {otForm.EndTime:HH\\:mm}",
                        ["TotalHour"] = otForm.TotalHour.ToString("0.##"),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    };
                    wording.AddTo(placeholders);
                    var html = _emailTemplateRenderer.Render("OtForm/ApprovalNotification.html", placeholders);

                    await _mailLogService.SendAsync(recipient.UserName, email, $"Đơn tăng ca #{otForm.Id} {wording.SubjectTail} - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // A missing template file is a deployment error — skip sending to this person rather
                    // than blocking the whole notification flow.
                }
            }

            return hasNewToken;
        }

        // Vietnamese is always shown; Japanese is appended only when the master data has it filled in.
        private static string FormatBilingual(string? nameVn, string? nameJp)
        {
            if (string.IsNullOrWhiteSpace(nameVn)) return "-";
            return string.IsNullOrWhiteSpace(nameJp) ? nameVn : $"{nameVn} / {nameJp}";
        }

        public async Task NotifyBatchApproversAsync(OtFormBatch batch, List<OtForm> activeForms, (string Vn, string? Jp) scopeName, bool isReminder)
        {
            if (activeForms.Count == 0) return;

            var formIds = activeForms.Select(x => x.Id).ToHashSet();
            var candidateUserNames = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => formIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending
                    && x.TerminalLevelSnapshot == batch.TerminalLevel,
                x => x.Candidates))
                .SelectMany(x => x.Candidates)
                .Select(x => x.UserName);

            var recipients = await GetMailRecipientsAsync(candidateUserNames);
            if (recipients.Count == 0) return;

            var scopeNameText = FormatBilingual(scopeName.Vn, scopeName.Jp);
            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var employeeCount = (await _unitOfWork.OtFormEmployees.FindAsync(x => formIds.Contains(x.OtFormId) && !x.IsRemoved)).Count;
            var totalHour = activeForms.Sum(x => x.TotalHour);
            var hasNewToken = false;

            foreach (var recipient in recipients)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(recipient.UserName, EmailModules.Attendance);
                if (string.IsNullOrWhiteSpace(email))
                {
                    await _mailLogService.LogSkippedAsync(recipient.UserName, $"Đơn tổng #{batch.Id} ({activeForms.Count} đơn) chờ duyệt - YevManagement");
                    continue;
                }

                var emailToken = new OtFormBatchEmailToken
                {
                    OtFormBatchId = batch.Id,
                    ApproverUserName = recipient.UserName,
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
                    var wording = BuildBatchWording(recipient.CoveredFullName, batch.Id, activeForms.Count, scopeNameText);
                    var placeholders = new Dictionary<string, string>
                    {
                        ["OtFormBatchId"] = batch.Id.ToString(),
                        ["ApproverFullName"] = fullName ?? recipient.UserName,
                        ["FormCount"] = activeForms.Count.ToString(),
                        ["ScopeName"] = scopeNameText,
                        ["BatchDate"] = batch.BatchDate.ToString("dd/MM/yyyy"),
                        ["EmployeeCount"] = employeeCount.ToString(),
                        ["TotalHour"] = totalHour.ToString("0.##"),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    };
                    wording.AddTo(placeholders);
                    var html = _emailTemplateRenderer.Render("OtForm/BatchApprovalNotification.html", placeholders);

                    var subjectPrefix = isReminder ? "[Nhắc nhở] " : "";
                    await _mailLogService.SendAsync(
                        recipient.UserName, email, $"{subjectPrefix}Đơn tổng #{batch.Id} ({activeForms.Count} đơn) {wording.SubjectTail} - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // A missing template is a deployment error; skip this recipient instead of blocking the flow.
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        // Mails the delegate for steps already waiting on the delegator (mails sent before the delegation
        // existed). Manager-level steps are skipped: the daily batch mail covers them.
        public async Task SendDelegationBackfillNotificationsAsync(int delegationId)
        {
            var delegation = (await _unitOfWork.ApprovalDelegations.FindWithIncludesAsync(
                x => x.Id == delegationId && !x.IsDeleted, x => x.DelegatorEmployee, x => x.DelegateEmployee)).FirstOrDefault();
            if (delegation?.DelegatorEmployee.UserName == null || delegation.DelegateEmployee.UserName == null) return;

            var now = TimeHelper.GetCurrentUtcTime();
            var today = DateOnly.FromDateTime(now);
            if (delegation.FromDate > today || delegation.ToDate < today) return;

            var delegatorUserName = delegation.DelegatorEmployee.UserName;
            var delegateUserName = delegation.DelegateEmployee.UserName;
            var delegatorFullName = $"{delegation.DelegatorEmployee.LastName} {delegation.DelegatorEmployee.FirstName}";

            var delegatorSteps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending
                    && x.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None
                    && x.OtForm.Status == (int)OtFormStatus.InApproval && !x.OtForm.IsDeleted
                    && x.Candidates.Any(c => c.UserName == delegatorUserName),
                x => x.Candidates);
            if (delegatorSteps.Count == 0) return;

            // A form's current step is its lowest pending one, which may not be the delegator's step.
            var formIds = delegatorSteps.Select(x => x.OtFormId).Distinct().ToList();
            var lowestPendingByForm = (await _unitOfWork.OtFormApprovalSteps.FindAsync(
                x => formIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.Min(x => x.StepOrder));

            var hasNewToken = false;
            foreach (var step in delegatorSteps.Where(x => lowestPendingByForm[x.OtFormId] == x.StepOrder))
            {
                if (step.Candidates.Any(c => string.Equals(c.UserName, delegateUserName, StringComparison.OrdinalIgnoreCase)))
                    continue;

                var alreadyMailed = (await _unitOfWork.OtFormApprovalEmailTokens.FindAsync(
                    x => x.OtFormApprovalStepId == step.Id && x.ApproverUserName == delegateUserName
                        && x.UsedAt == null && x.ExpiresAt > now)).Count > 0;
                if (alreadyMailed) continue;

                var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == step.OtFormId);
                if (otForm == null) continue;

                var recipients = new List<(string UserName, string? CoveredFullName)> { (delegateUserName, delegatorFullName) };
                hasNewToken |= await SendApprovalMailsAsync(otForm, step, recipients);
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }
    }
}
