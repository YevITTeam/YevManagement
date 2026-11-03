using System.Collections.Concurrent;
using System.Linq.Expressions;
using Microsoft.Extensions.DependencyInjection;
using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using static Attendance.Application.Services.MealTicketCalculator;
using AccumulatedByEmployee = System.Collections.Generic.Dictionary<int, (decimal Day, decimal Month, decimal Year)>;

namespace Attendance.Application.Services
{
    public class OtFormService : BaseService<IAttendanceUnitOfWork>, IOtFormService
    {
        // Shared by all list endpoints.
        private static readonly Expression<Func<OtForm, OtFormListItemDto>> ToListItemDto = x => new OtFormListItemDto
        {
            Id = x.Id,
            GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
            GroupNameJp = x.Group != null ? x.Group.GroupNameJp : null,
            IsProductionForm = x.IsProductionForm,
            DepartmentNameVn = x.Department.DepartmentNameVn,
            WorkshopNameVn = x.Workshop.WorkshopNameVn,
            DepartmentNameJp = x.Department.DepartmentNameJp,
            OtCaseCode = x.OtCase.Code,
            OtCaseDescription = x.OtCase.Description,
            OtCaseDescriptionJp = x.OtCase.DescriptionJp,
            Date = x.Date,
            TotalHour = x.TotalHour,
            NumberOfEmployee = x.NumberOfEmployee,
            CreatedByUserName = x.CreatedByUserName,
            CreatedByFullName = x.CreatedByFullName,
            Status = x.Status,
            // Production forms are editable per step while InApproval; office forms keep the stricter rule.
            IsEditable = x.Status == (int)OtFormStatus.InApproval &&
                (x.IsProductionForm || !x.ApprovalSteps.Any(s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Approved
                    && s.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None)),
            ApprovalSummary = x.OtFormApprovalHistories
                .Where(h => !h.OtFormApprovalStep.IsDeleted)
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

        // Date range is inclusive.
        private static IQueryable<OtForm> ApplyListFilters(IQueryable<OtForm> query, DateOnly? fromDate, DateOnly? toDate, int? status)
        {
            if (fromDate.HasValue) query = query.Where(x => x.Date >= fromDate.Value);
            if (toDate.HasValue) query = query.Where(x => x.Date <= toDate.Value);
            if (status.HasValue) query = query.Where(x => x.Status == status.Value);
            return query;
        }

        // Harmless for production forms, which also carry a DepartmentId.
        private static IQueryable<OtForm> ApplyOfficeFilter(IQueryable<OtForm> query, int? groupId, int? departmentId, int? workshopId, bool? isProductionForm)
        {
            if (groupId.HasValue) query = query.Where(x => x.GroupId == groupId.Value);
            if (departmentId.HasValue) query = query.Where(x => x.DepartmentId == departmentId.Value);
            if (workshopId.HasValue) query = query.Where(x => x.WorkshopId == workshopId.Value);
            if (isProductionForm.HasValue) query = query.Where(x => x.IsProductionForm == isProductionForm.Value);
            return query;
        }

        // Compares against the snapshots on OtFormEmployee, not live ProductionEmployee, to respect create-time state.
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

        private readonly IOtFormNotificationService _notificationService;
        private readonly ISecondaryPasswordService _secondaryPasswordService;
        private readonly IAttendanceSettingService _attendanceSettingService;
        private readonly IJobTitleApprovalChainService _jobTitleApprovalChainService;
        private readonly IBackgroundTaskQueue _taskQueue;

        public OtFormService(
            IAttendanceUnitOfWork unitOfWork,
            IOtFormNotificationService notificationService,
            ISecondaryPasswordService secondaryPasswordService,
            IAttendanceSettingService attendanceSettingService,
            IJobTitleApprovalChainService jobTitleApprovalChainService,
            IBackgroundTaskQueue taskQueue) : base(unitOfWork)
        {
            _notificationService = notificationService;
            _secondaryPasswordService = secondaryPasswordService;
            _attendanceSettingService = attendanceSettingService;
            _jobTitleApprovalChainService = jobTitleApprovalChainService;
            _taskQueue = taskQueue;
        }

        // Callers have already saved the business change, so mail is queued to avoid waiting on SMTP.
        // Pass ids only: the request DI scope is disposed before the job runs.
        // Set while RunAtomicallyAsync runs: mails wait for the commit so a rolled-back change never sends one.
        private List<Func<IOtFormNotificationService, Task>>? _deferredNotifications;

        private void QueueNotification(Func<IOtFormNotificationService, Task> send)
        {
            if (_deferredNotifications != null)
            {
                _deferredNotifications.Add(send);
                return;
            }
            _taskQueue.QueueBackgroundWorkItem(async (sp, _) => await send(sp.GetRequiredService<IOtFormNotificationService>()));
        }

        // Several single-form flows as one unit (multi-group create, batch approval): all or nothing, mail after commit.
        private async Task<T> RunAtomicallyAsync<T>(Func<Task<T>> work)
        {
            var deferred = _deferredNotifications = new();
            T result;
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                result = await work();
                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
            finally
            {
                _deferredNotifications = null;
            }

            foreach (var send in deferred) QueueNotification(send);
            return result;
        }

        private void QueueStepApprovalNotification(int otFormId, int otFormApprovalStepId) =>
            QueueNotification(n => n.SendStepApprovalNotificationAsync(otFormId, otFormApprovalStepId));

        // The creator (not the approvers) hears when the form is approved or rejected, or employees are removed from it.
        private void QueueRejectedNotification(int otFormId) =>
            QueueNotification(n => n.SendRejectedNotificationAsync(otFormId));

        private void QueueApprovedNotification(int otFormId) =>
            QueueNotification(n => n.SendApprovedNotificationAsync(otFormId));

        private void QueueEmployeesRemovedNotification(int otFormId, List<int> employeeIds)
        {
            if (employeeIds.Count == 0) return;
            QueueNotification(n => n.SendEmployeesRemovedNotificationAsync(otFormId, employeeIds));
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.CreatedByUserName == userName);
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId, workshopId, isProductionForm);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // A form is "mine" when I am a candidate of its current step: the Pending step with the smallest StepOrder.
        // Resolved in SQL so history (completed forms) never loads; this also backs the sidebar badge poll.
        private async Task<List<int>> GetMyCurrentPendingFormIdsAsync(string approverUserName)
        {
            var actingUserNames = (await GetActiveDelegatorsAsync(approverUserName)).Keys.Append(approverUserName).ToList();
            var pendingSteps = _unitOfWork.OtFormApprovalSteps.GetQueryable()
                .Where(s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending);

            var formIds = await _unitOfWork.OtFormApprovalStepCandidates.SelectAsync(
                predicate: c => actingUserNames.Contains(c.UserName)
                    && !c.OtFormApprovalStep.IsDeleted
                    && c.OtFormApprovalStep.Status == (int)OtFormApprovalStepStatus.Pending
                    && !pendingSteps.Any(s => s.OtFormId == c.OtFormApprovalStep.OtFormId && s.StepOrder < c.OtFormApprovalStep.StepOrder),
                selector: c => c.OtFormApprovalStep.OtFormId);

            return formIds.Distinct().ToList();
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, int pageIndex, int pageSize,
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null)
        {
            var myCurrentFormIds = await GetMyCurrentPendingFormIdsAsync(approverUserName);

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval && myCurrentFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId, workshopId, isProductionForm);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderBy(x => x.Date);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // Separate post-paging query: string.Join/Distinct in the shared ToListItemDto expression risks failing SQL translation.
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

        // Same scoping as GetPendingApprovalsAsync.
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
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null)
        {
            var actedFormIds = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => h.ApproverUserName == userName, h => h.OtFormId);
            var distinctFormIds = actedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId, workshopId, isProductionForm);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null)
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
            query = ApplyOfficeFilter(query, groupId, departmentId, workshopId, isProductionForm);
            query = await ApplyProductionFilterAsync(query, productionLineId, productionTeamId, productionShiftTeamId);
            query = query.OrderByDescending(x => x.Id);

            var result = await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
            await EnrichWithProductionLineInfoAsync(result.Data);
            return result;
        }

        // Gated by Attendance.OTForm.ViewAll (Admin only).
        public async Task<PagedResponse<OtFormListItemDto>> GetAllFormsAsync(
            int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null,
            int? groupId = null, int? departmentId = null,
            int? productionLineId = null, int? productionTeamId = null, int? productionShiftTeamId = null, int? workshopId = null, bool? isProductionForm = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted);
            query = ApplyListFilters(query, fromDate, toDate, status);
            query = ApplyOfficeFilter(query, groupId, departmentId, workshopId, isProductionForm);
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

            // History of steps dropped by a re-submission stays in the DB but no longer shows on the form.
            var histories = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                predicate: x => x.OtFormId == id && !x.OtFormApprovalStep.IsDeleted,
                selector: x => new OtFormApprovalHistoryDto
                {
                    ApproverUserName = x.ApproverUserName,
                    ApproverFullName = x.ApproverFullName,
                    OnBehalfOfUserName = x.OnBehalfOfUserName,
                    OnBehalfOfFullName = x.OnBehalfOfFullName,
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
            var delegatesByDelegator = await GetActiveDelegatesByDelegatorAsync(
                orderedSteps.Where(x => x.Status == (int)OtFormApprovalStepStatus.Pending).SelectMany(x => x.Candidates).Select(c => c.UserName));

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

            // See ToListItemDto.IsEditable.
            var isEditable = otForm!.Status == (int)OtFormStatus.InApproval &&
                (otForm.IsProductionForm || orderedSteps.All(s =>
                    s.Status != (int)OtFormApprovalStepStatus.Approved || s.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None));

            var mealSettings = await _attendanceSettingService.GetAsync();
            var resubmit = isEditable ? null : await ResolveResubmitAsync(otForm, orderedSteps);
            var accumulation = await GetFormAccumulationAsync(otForm, employees, mealSettings);

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
                OtCaseDescription = otForm.OtCase.Description,
                OtCaseDescriptionJp = otForm.OtCase.DescriptionJp,
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
                ResubmitKind = (int?)resubmit?.Kind,
                ResubmitUserNames = resubmit?.UserNames.ToList() ?? new List<string>(),
                ResubmitDeadline = resubmit?.Deadline,
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
                    MonthToDate = accumulation[x.EmployeeId].Month + CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                    YearToDate = accumulation[x.EmployeeId].Year + CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
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
                    }).ToList(),
                    Delegates = s.Status != (int)OtFormApprovalStepStatus.Pending
                        ? new List<OtFormApprovalStepDelegateDto>()
                        : s.Candidates
                            .SelectMany(c => delegatesByDelegator.GetValueOrDefault(c.UserName) ?? new List<string>(),
                                (c, delegateName) => new OtFormApprovalStepDelegateDto { DelegatorUserName = c.UserName, DelegateFullName = delegateName })
                            .ToList()
                }).ToList()
            };
        }

        // Delegator account -> full names of the people covering them today.
        private async Task<Dictionary<string, List<string>>> GetActiveDelegatesByDelegatorAsync(IEnumerable<string> delegatorUserNames)
        {
            var names = delegatorUserNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (names.Count == 0) return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var rows = await _unitOfWork.ApprovalDelegations.SelectAsync(
                predicate: d => !d.IsDeleted && d.FromDate <= today && d.ToDate >= today && names.Contains(d.DelegatorEmployee.UserName!),
                selector: d => new { Delegator = d.DelegatorEmployee.UserName!, d.DelegateEmployee.LastName, d.DelegateEmployee.FirstName });

            return rows
                .GroupBy(r => r.Delegator, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Select(r => $"{r.LastName} {r.FirstName}").ToList(), StringComparer.OrdinalIgnoreCase);
        }

        // ponytail: in-process per-date locks, valid while the API runs as a single instance; use a DB
        // applock (sp_getapplock) if it is ever scaled out.
        private static readonly ConcurrentDictionary<DateOnly, SemaphoreSlim> DateLocks = new();

        // Serializes limit/overlap checks with the save for one OT date, so two concurrent forms
        // cannot both pass the daily limit or the overlap check.
        private static async Task<IDisposable> AcquireDateLockAsync(DateOnly date)
        {
            var gate = DateLocks.GetOrAdd(date, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            return new DateLockReleaser(gate);
        }

        private sealed class DateLockReleaser(SemaphoreSlim gate) : IDisposable
        {
            public void Dispose() => gate.Release();
        }

        public async Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            using var dateLock = await AcquireDateLockAsync(request.Date);
            return await CreateCoreAsync(createdByUserName, createdByFullName, isAdmin, request);
        }

        // One office form per group, all or nothing: any failure rolls every form back and names the group.
        public async Task<List<OtFormDto>> CreateManyAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateManyOtFormsDto request)
        {
            if (request.Forms.Count == 0)
                throw new DomainException("Chưa chọn Nhóm nào.");
            if (request.Forms.Any(x => x.IsProductionForm || !x.GroupId.HasValue))
                throw new DomainException("Tạo nhiều đơn chỉ áp dụng cho đơn theo Nhóm.");
            if (request.Forms.Select(x => x.GroupId).Distinct().Count() != request.Forms.Count)
                throw new DomainException("Mỗi Nhóm chỉ được một đơn.");
            var date = request.Forms[0].Date;
            if (request.Forms.Any(x => x.Date != date))
                throw new DomainException("Các đơn phải cùng ngày.");

            // Checked once up front so a wrong password isn't reported against the first group.
            await _secondaryPasswordService.VerifyAsync(createdByUserName, request.SecondaryPassword);

            var groupNames = (await _unitOfWork.Groups.SelectAsync(
                    x => request.Forms.Select(f => f.GroupId!.Value).Contains(x.Id), x => new { x.Id, x.GroupNameVn }))
                .ToDictionary(x => x.Id, x => x.GroupNameVn);

            using var dateLock = await AcquireDateLockAsync(date);
            return await RunAtomicallyAsync(async () =>
            {
                var created = new List<OtFormDto>();
                foreach (var form in request.Forms)
                {
                    form.SecondaryPassword = request.SecondaryPassword;
                    try
                    {
                        created.Add(await CreateCoreAsync(createdByUserName, createdByFullName, isAdmin, form));
                    }
                    catch (DomainException ex) when (request.Forms.Count > 1)
                    {
                        throw new DomainException($"Nhóm {groupNames.GetValueOrDefault(form.GroupId!.Value, form.GroupId.ToString())}: {ex.Message}");
                    }
                }
                return created;
            });
        }

        private async Task<OtFormDto> CreateCoreAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            // Overnight shifts aren't supported; checked first because later validation compares TimeOnly values directly.
            if (request.EndTime <= request.StartTime)
                throw new DomainException("Giờ kết thúc phải sau giờ bắt đầu (không hỗ trợ ca qua đêm).");

            EnsureDateNotTooFarBack(request.Date, (await _attendanceSettingService.GetAsync()).BackdateDays);

            if (request.Employees.Select(x => x.EmployeeId).Distinct().Count() != request.Employees.Count)
                throw new DomainException("Danh sách nhân viên có mã trùng lặp.");

            // Verified before any other work, same as approve/reject.
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

            // Only members of the group (or Admin) may create; the creator employee also drives chain resolution.
            var creatorEmployee = await EnsureCanCreateOrEditForScopeAsync(createdByUserName, isAdmin, groupId);

            var validatedEmployees = await ValidateEmployeesAsync(groupId, request.StartTime, request.EndTime, request.Employees);

            var accumulated = await EnsureOtCaseMatchesRulesAsync(request, forceMeal: !group.AllowEatLater, otCase!);

            // An employee may not appear in two overlapping non-rejected forms on the same day.
            var employeeTimes = request.Employees.ToDictionary(
                x => x.EmployeeId, x => (x.StartTime ?? request.StartTime, x.EndTime));
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, employeeTimes, excludeFormId: null);

            // Admin-created forms count as lowest level. An incomplete chain doesn't block creation: the form waits at the
            // step lacking candidates and ApprovalChainWarning tells the FE.
            var chainResult = await _jobTitleApprovalChainService.ResolveChainForCreationAsync(
                creatorEmployee?.Id, groupId, request.DepartmentId, group.WorkshopId, request.OtCaseId);

            var creatorSignatureImage = await ResolveCreatorSelfSignAsync(createdByUserName, chainResult);

            var newOtForm = new OtForm
            {
                GroupId = groupId,
                IsProductionForm = false,
                DepartmentId = request.DepartmentId,
                WorkshopId = group.WorkshopId,
                ReasonId = request.ReasonId,
                OtCaseId = request.OtCaseId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                SubReason = request.SubReason,
                TotalHour = Math.Round((decimal)(request.EndTime - request.StartTime).TotalHours, 2),
                Date = request.Date,
                NumberOfEmployee = request.Employees.Count,
                CreatedByUserName = createdByUserName,
                CreatedByFullName = createdByFullName,
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                CreatorSignatureImage = creatorSignatureImage,
                // Complete immediately only when there are no steps AND IsComplete: IsComplete alone also means "chain ready",
                // and an unconfigured department (no steps, IsComplete=false) must stay InApproval.
                Status = (chainResult.Steps.Count == 0 && chainResult.IsComplete)
                    ? (int)OtFormStatus.Completed
                    : (int)OtFormStatus.InApproval,
                ApprovalChainWarning = chainResult.Warning,
                IsDeleted = false
            };

            return await FinalizeCreateAsync(newOtForm, request, chainResult, accumulated, productionEmployeesByEmployeeId: null, forceMeal: !group.AllowEatLater);
        }

        // Who may create production forms is decided by the Attendance.OTForm.CreateProduction permission;
        // non-Admins still need a linked Employee to resolve the chain.
        // A production form has no group of its own: its workshop is the one all participants belong to.
        private async Task<int> ResolveProductionWorkshopIdAsync(List<int> employeeIds)
        {
            var workshopIds = (await _unitOfWork.Employees.SelectAsync(
                predicate: x => employeeIds.Contains(x.Id) && x.Group != null,
                selector: x => x.Group!.WorkshopId))
                .Distinct()
                .ToList();
            if (workshopIds.Count == 0)
                throw new DomainException("Không xác định được Xưởng của các nhân viên trong đơn.");
            if (workshopIds.Count > 1)
                throw new DomainException("Đơn theo chuyền chỉ được gồm nhân viên cùng một Xưởng.");
            return workshopIds[0];
        }

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

            // Defensive check for legacy/manual data; import already rejects rows without a shift team.
            var productionEmployeesForCheck = await _unitOfWork.ProductionEmployees.FindAsync(
                x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted);
            var notOnRoster = employeeIds.Except(productionEmployeesForCheck.Select(x => x.EmployeeId!.Value)).ToList();
            if (notOnRoster.Count > 0)
            {
                var codes = await _unitOfWork.Employees.SelectAsync(x => notOnRoster.Contains(x.Id), x => x.Code);
                throw new DomainException($"Nhân viên không có trong danh sách nhân sự dưới chuyền: {string.Join(", ", codes)}.");
            }
            var missingShiftTeam = productionEmployeesForCheck.Where(x => x.ShiftTeamId == null).Select(x => x.EmployeeCode).ToList();
            if (missingShiftTeam.Count > 0)
                throw new DomainException($"Nhân viên chưa có Nhóm ca, cần cập nhật trước khi tạo đơn: {string.Join(", ", missingShiftTeam)}.");

            // Non-Admins may only include lines they lead, and every line on the form must match (not just one of them).
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

            var accumulated = await EnsureOtCaseMatchesRulesAsync(request, forceMeal: true, otCase!);

            var employeeTimes = request.Employees.ToDictionary(
                x => x.EmployeeId, x => (x.StartTime ?? request.StartTime, x.EndTime));
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, employeeTimes, excludeFormId: null);

            var workshopId = await ResolveProductionWorkshopIdAsync(employeeIds);

            var chainResult = await _jobTitleApprovalChainService.ResolveChainForProductionCreationAsync(
                creatorEmployee?.Id, request.DepartmentId, workshopId, employeeIds, request.OtCaseId);

            var creatorSignatureImage = await ResolveCreatorSelfSignAsync(createdByUserName, chainResult);

            var newOtForm = new OtForm
            {
                GroupId = null,
                IsProductionForm = true,
                DepartmentId = request.DepartmentId,
                WorkshopId = workshopId,
                ReasonId = request.ReasonId,
                OtCaseId = request.OtCaseId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                SubReason = request.SubReason,
                TotalHour = Math.Round((decimal)(request.EndTime - request.StartTime).TotalHours, 2),
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

            // ProductionEmployee changes daily, so its create-time state is snapshotted on OtFormEmployee.
            var productionEmployeesByEmployeeId = (await _unitOfWork.ProductionEmployees.FindAsync(
                x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted))
                .ToDictionary(x => x.EmployeeId!.Value);

            return await FinalizeCreateAsync(newOtForm, request, chainResult, accumulated, productionEmployeesByEmployeeId, forceMeal: true);
        }

        // When the creator outranks every mandatory signer, they sign the "requester" box themselves;
        // creation is blocked without a stored signature.
        private async Task<byte[]?> ResolveCreatorSelfSignAsync(string createdByUserName, ResolveApprovalChainResultDto chainResult)
        {
            if (!chainResult.RequiresCreatorSelfSign) return null;

            var creatorSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == createdByUserName);
            if (creatorSignature == null)
                throw new DomainException("Bạn đang ở cấp cao nhất trong chuỗi duyệt trung gian — đơn cần chữ ký của chính bạn ở ô \"Người đề nghị\". Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước khi tạo đơn.");
            return creatorSignature.SignatureImage;
        }

        // Meal is mandatory on production forms and on groups that disallow eating later; otherwise DidEat=true still means eating during the shift (deducted).
        private static bool ResolveDidEat(bool forceMeal, bool requestedDidEat) => forceMeal || requestedDidEat;

        private async Task<OtFormDto> FinalizeCreateAsync(
            OtForm newOtForm, CreateOtFormDto request, ResolveApprovalChainResultDto chainResult,
            AccumulatedByEmployee accumulated, Dictionary<int, ProductionEmployee>? productionEmployeesByEmployeeId, bool forceMeal)
        {
            await _unitOfWork.OtForms.AddAsync(newOtForm);

            var mealSettings = await _attendanceSettingService.GetAsync();

            var didEatByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => ResolveDidEat(forceMeal, x.DidEat));

            // Hard block before writing anything when any employee exceeds a daily limit.
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(x.StartTime ?? request.StartTime, x.EndTime, didEatByEmployeeId[x.EmployeeId], mealSettings));
            await ValidateOtHourLimitsAsync(request.Date, newHoursByEmployeeId, mealSettings, accumulated);

            var createdRows = new List<OtFormEmployee>();
            foreach (var item in request.Employees)
            {
                ProductionEmployee? pe = null;
                productionEmployeesByEmployeeId?.TryGetValue(item.EmployeeId, out pe);

                var createdRow = new OtFormEmployee
                {
                    OtForm = newOtForm,
                    EmployeeId = item.EmployeeId,
                    StartTime = item.StartTime ?? request.StartTime,
                    EndTime = item.EndTime,
                    DidEat = didEatByEmployeeId[item.EmployeeId],
                    NoteVn = item.NoteVn,
                    NoteJp = item.NoteJp,
                    CongDoanSnapshot = pe?.CongDoan,
                    TaskNameSnapshot = pe?.TaskName,
                    BlockCodeSnapshot = pe?.BlockCode,
                    TeamCodeSnapshot = pe?.TeamCode,
                    ShiftTeamCodeSnapshot = pe?.ShiftTeamCode
                };
                createdRows.Add(createdRow);
                await _unitOfWork.OtFormEmployees.AddAsync(createdRow);
            }

            // ProcessPart is always created because the meal flag is mandatory; other items stay optional.
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

            // All steps start Pending; the current one is the lowest StepOrder.
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

            // One save: the form, its rows and (when it completes at creation) the ledger land together.
            if (newOtForm.Status == (int)OtFormStatus.Completed)
                await AccumulateEmployeeHoursAsync(newOtForm, createdRows);

            await _unitOfWork.SaveChangesAsync();

            if (newOtForm.Status != (int)OtFormStatus.Completed && firstCreatedStep != null)
            {
                var firstStepWithCandidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                    x => x.Id == firstCreatedStep.Id, x => x.Candidates)).FirstOrDefault();
                // Manager-level steps get only the daily batch mail to avoid duplicates; intermediate steps still mail immediately.
                if (firstStepWithCandidates != null && firstStepWithCandidates.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None)
                    QueueStepApprovalNotification(newOtForm.Id, firstStepWithCandidates.Id);
            }

            return await GetByIdAsync(newOtForm.Id);
        }

        // Returns the employee when they belong to the group or were granted it (GroupOtFormCreator), null for Admin
        // (treated as lowest level in chain resolution).
        private async Task<Employee?> EnsureCanCreateOrEditForScopeAsync(string userName, bool isAdmin, int groupId)
        {
            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.UserName == userName && !x.IsDeleted, x => x.JobTitle!);

            var allowed = callerEmployee != null && (callerEmployee.GroupId == groupId
                || (await _unitOfWork.GroupOtFormCreators.SelectAsync(
                    x => x.GroupId == groupId && x.EmployeeId == callerEmployee.Id, x => x.Id)).Count > 0);

            if (!allowed && !isAdmin)
                throw new DomainException("Bạn chỉ được tạo/sửa đơn cho Nhóm của mình hoặc Nhóm được cấp thêm. Liên hệ Admin nếu tài khoản chưa liên kết đúng nhân viên/nhóm.");

            return allowed ? callerEmployee : null;
        }

        // The caller's own group plus groups granted through GroupOtFormCreator.
        public async Task<List<MyCreateScopeItemDto>> GetMyCreateScopesAsync(string userName, bool isAdmin)
        {
            if (isAdmin) return new List<MyCreateScopeItemDto>();

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (callerEmployee == null) return new List<MyCreateScopeItemDto>();

            var grantedGroupIds = await _unitOfWork.GroupOtFormCreators.SelectAsync(x => x.EmployeeId == callerEmployee.Id, x => x.GroupId);
            var groupIds = grantedGroupIds.Append(callerEmployee.GroupId ?? 0).ToList();

            var scopes = await _unitOfWork.Groups.SelectAsync(
                x => groupIds.Contains(x.Id) && !x.IsDeleted,
                x => new MyCreateScopeItemDto
                {
                    GroupId = x.Id,
                    GroupNameVn = x.GroupNameVn,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn
                });
            // Own group first so a single-scope user keeps today's prefilled, locked form.
            return scopes.OrderBy(x => x.GroupId == callerEmployee.GroupId ? 0 : 1).ThenBy(x => x.GroupNameVn).ToList();
        }

        // Lets FE prefill and lock the Team/Line/Shift-team dropdowns; empty for Admin and non-leaders.
        // Only rows with all three FKs resolved count.
        public async Task<List<MyProductionCreateScopeItemDto>> GetMyProductionCreateScopesAsync(string userName, bool isAdmin)
        {
            if (isAdmin) return new List<MyProductionCreateScopeItemDto>();

            var callerEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.UserName == userName && !x.IsDeleted, x => x.Group!);
            if (callerEmployee == null) return new List<MyProductionCreateScopeItemDto>();

            // Line Leaders are usually assigned via Group, so fall back to Group.DepartmentId.
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

            // A leader may appear on several rows for the same combination; collapse to one.
            return leaderRows
                .GroupBy(x => (x.ProductionLineId, x.TeamId, x.ShiftTeamId))
                .Select(g => g.First())
                .ToList();
        }

        public async Task<OtFormDto> UpdateAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request)
        {
            var dates = (await _unitOfWork.OtForms.SelectAsync(x => x.Id == id && !x.IsDeleted, x => x.Date)).ToList();
            if (request.Header != null) dates.Add(request.Header.Date);

            // Ascending order keeps two-date locks deadlock-free.
            var locks = new List<IDisposable>();
            try
            {
                foreach (var date in dates.Distinct().Order())
                    locks.Add(await AcquireDateLockAsync(date));
                return await UpdateCoreAsync(id, currentUserName, currentFullName, isAdmin, request);
            }
            finally
            {
                foreach (var gate in locks) gate.Dispose();
            }
        }

        private async Task<OtFormDto> UpdateCoreAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var steps = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == id && !x.IsDeleted, x => x.Candidates)).ToList();
            var currentStep = steps.Where(x => x.Status == (int)OtFormApprovalStepStatus.Pending).MinBy(x => x.StepOrder);
            var isOfficeForm = !otForm!.IsProductionForm;
            Employee? creatorEmployee = null;

            var isManagerSigned = steps.Any(x => x.Status == (int)OtFormApprovalStepStatus.Approved
                && x.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None);
            var resubmit = isOfficeForm && (otForm.Status != (int)OtFormStatus.InApproval || isManagerSigned)
                ? await ResolveResubmitAsync(otForm, steps)
                : null;
            if (resubmit == null && otForm.Status != (int)OtFormStatus.InApproval)
                throw new DomainException(otForm.Status == (int)OtFormStatus.Completed && isOfficeForm
                    ? "Đơn đã hoàn tất quá thời hạn được trình ký lại, không thể sửa."
                    : "Đơn đã xử lý xong (hoàn tất/từ chối), không thể sửa.");

            var resubmitReason = request.ResubmitReason?.Trim();
            if (resubmit != null && string.IsNullOrEmpty(resubmitReason))
                throw new DomainException("Vui lòng nhập lý do trình ký lại.");

            // Re-sign: the editor's own flagged step is signed again when they hold it.
            OtFormApprovalStep? resignStep = null;
            string? resignDelegatorUserName = null, resignDelegatorFullName = null;
            byte[]? resignSignature = null;

            // Production forms: whoever holds the current pending step may edit (no Admin bypass), earlier
            // signatures stay. Office forms: only the creator, until a Manager-level step has approved.
            if (otForm.IsProductionForm)
            {
                if (request.Header != null)
                    throw new DomainException("Đơn theo chuyền không sửa được thông tin chung của đơn.");
                if (currentStep == null)
                    throw new DomainException("Đơn không còn bước duyệt nào đang chờ xử lý (dữ liệu không nhất quán, liên hệ Admin).");
                if (!MatchStepActor(currentStep, currentUserName, await GetActiveDelegatorsAsync(currentUserName)).IsActor)
                    throw new DomainException($"Bạn không phải người được chỉ định xử lý bước hiện tại (Chức vụ '{currentStep.JobTitleNameSnapshot}') của đơn này, không thể sửa.");
            }
            else if (resubmit?.Kind == OtFormResubmitKind.Resign)
            {
                resignStep = steps.FirstOrDefault(x => x.Id == resubmit.SignStepId);
                var match = resignStep == null
                    ? (false, null, null)
                    : MatchStepActor(resignStep, currentUserName, await GetActiveDelegatorsAsync(currentUserName));
                if (!match.IsActor && !isAdmin && !resubmit.UserNames.Contains(currentUserName))
                    throw new DomainException("Bạn không có quyền trình ký lại đơn này (chỉ người giữ bước được tích \"Trình ký lại\" trên cây duyệt Nhóm, hoặc Admin).");
                // Restarting the chain: the editor approves again in turn instead of signing now.
                if (!match.IsActor || !resubmit.SkipsIntermediate) resignStep = null;
                (_, resignDelegatorUserName, resignDelegatorFullName) = match;

                if (resignStep?.RequiresSignatureSnapshot == true)
                {
                    resignSignature = (await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == currentUserName))?.SignatureImage
                        ?? throw new DomainException("Bước của bạn bắt buộc phải ký. Vui lòng đăng ký chữ ký trước khi trình ký lại.");
                }

                // The chain is re-resolved from the creator, whoever edits.
                creatorEmployee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == otForm.CreatedByUserName && !x.IsDeleted);
            }
            else
            {
                if (!string.Equals(otForm.CreatedByUserName, currentUserName, StringComparison.OrdinalIgnoreCase))
                    throw new DomainException("Bạn chỉ có thể sửa đơn do chính mình tạo.");

                if (resubmit == null && isManagerSigned)
                    throw new DomainException("Đơn đã được cấp Manager trở lên duyệt, không thể sửa nữa.");

                if (otForm.GroupId.HasValue)
                    creatorEmployee = await EnsureCanCreateOrEditForScopeAsync(currentUserName, isAdmin, otForm.GroupId.Value);
            }

            await _secondaryPasswordService.VerifyAsync(currentUserName, request.SecondaryPassword);

            var header = request.Header;
            var formDate = header?.Date ?? otForm.Date;
            var formStart = header?.StartTime ?? otForm.StartTime;
            var formEnd = header?.EndTime ?? otForm.EndTime;
            if (formEnd <= formStart)
                throw new DomainException("Giờ kết thúc phải sau giờ bắt đầu (không hỗ trợ ca qua đêm).");
            if (formDate != otForm.Date)
                EnsureDateNotTooFarBack(formDate, (await _attendanceSettingService.GetAsync()).BackdateDays);

            Reason? newReason = null;
            if (header != null)
            {
                newReason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == header.ReasonId && !x.IsDeleted);
                newReason.OrThrowNotFound("Lý do", header.ReasonId);
            }

            var activeEmployees = otForm.OtFormEmployees.Where(x => !x.IsRemoved).ToList();
            var activeEmployeeIds = activeEmployees.Select(x => x.EmployeeId).ToHashSet();
            var activeByEmployeeId = activeEmployees.ToDictionary(x => x.EmployeeId);
            var requestedEmployeeIds = request.Employees.Select(x => x.EmployeeId).ToHashSet();

            if (requestedEmployeeIds.Count != request.Employees.Count)
                throw new DomainException("Danh sách nhân viên có mã trùng lặp.");

            // toAdd = brand-new or previously removed from this form; toKeep = still on the form.
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
                x => x.StartTime ?? (activeByEmployeeId.TryGetValue(x.EmployeeId, out var row) ? row.StartTime : formStart));

            foreach (var item in request.Employees)
            {
                var code = employeeCodeById.GetValueOrDefault(item.EmployeeId, item.EmployeeId.ToString());
                EnsureEmployeeTimeWithinForm(code, startTimeByEmployeeId[item.EmployeeId], item.EndTime, formStart, formEnd);
            }

            // Added employees of a production form must share a Line/shift team with the rest of the form;
            // office forms keep every member inside the form's Group.
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
            else if (isOfficeForm && otForm.GroupId.HasValue)
            {
                foreach (var employeeId in toAddIds)
                {
                    var employee = employeesById[employeeId];
                    if (employee.GroupId != otForm.GroupId.Value)
                        throw new DomainException($"Nhân viên '{employee.Code}' không thuộc Nhóm của đơn này.");
                }
            }

            var mealSettings = await _attendanceSettingService.GetAsync();

            // A completed form leaves the ledger until it is signed off again; a later rejection then counts nothing.
            if (otForm.Status == (int)OtFormStatus.Completed)
                await AccumulateEmployeeHoursAsync(otForm, activeEmployees, sign: -1);

            var forceMeal = otForm.IsProductionForm
                || (await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == otForm.GroupId))?.AllowEatLater == false;
            var didEatByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => ResolveDidEat(forceMeal, x.DidEat));

            // excludeFormId: this form's own rows are being replaced, so they must not count against their new hours.
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(startTimeByEmployeeId[x.EmployeeId], x.EndTime, didEatByEmployeeId[x.EmployeeId], mealSettings));
            var accumulated = await ComputeAccumulatedHoursBatchAsync(newHoursByEmployeeId.Keys, formDate, mealSettings, excludeFormId: otForm.Id);
            await ValidateOtHourLimitsAsync(formDate, newHoursByEmployeeId, mealSettings, accumulated);

            // Office forms re-derive the OT case from date + hours (as at creation); production forms keep
            // theirs and may not be pushed past the month/year limit unless already TH3.
            OtCase? newOtCase = null;
            if (isOfficeForm)
            {
                var exceedsTh3 = await ExceedsMonthYearLimitAsync(newHoursByEmployeeId, mealSettings, accumulated);
                var expectedCode = exceedsTh3 ? "TH3" : (await IsNonWorkingDayAsync(formDate) ? "TH2" : "TH1");
                newOtCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Code == expectedCode && !x.IsDeleted);
                if (newOtCase == null)
                    throw new DomainException($"Chưa cấu hình Trường hợp OT '{expectedCode}'.");
            }
            else
            {
                var currentOtCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otForm.OtCaseId);
                if (currentOtCase?.Code != "TH3"
                    && await ExceedsMonthYearLimitAsync(newHoursByEmployeeId, mealSettings, accumulated))
                    throw new DomainException("Giờ sửa khiến có nhân viên vượt giới hạn OT tháng/năm, đơn này phải là TH3. Vui lòng giảm giờ hoặc tạo đơn TH3 mới.");
            }

            // Every member: kept rows may have new times too.
            var overlapEmployeeIds = requestedEmployeeIds;
            if (overlapEmployeeIds.Count > 0)
            {
                var overlapEmployees = overlapEmployeeIds.Select(eid => employeesById[eid]).ToList();
                var overlapTimes = request.Employees.Where(x => overlapEmployeeIds.Contains(x.EmployeeId))
                    .ToDictionary(x => x.EmployeeId, x => (startTimeByEmployeeId[x.EmployeeId], x.EndTime));
                await EnsureNoOverlappingOtFormsAsync(overlapEmployees, formDate, overlapTimes, excludeFormId: otForm.Id);
            }

            // Apply: removals, additions, then kept rows (each touches different rows).

            // The creator takes someone off their own form without a reason; anyone else must give one.
            var isCreator = string.Equals(otForm.CreatedByUserName, currentUserName, StringComparison.OrdinalIgnoreCase);
            foreach (var employeeId in removedEmployeeIds)
            {
                var target = activeByEmployeeId[employeeId];
                var reason = request.RemovedEmployees.First(x => x.EmployeeId == employeeId).Reason?.Trim();
                if (string.IsNullOrEmpty(reason))
                {
                    if (!isCreator) throw new DomainException("Lý do loại nhân viên khỏi đơn không được để trống.");
                    reason = null;
                }

                target.IsRemoved = true;
                target.RemovedByUserName = currentUserName;
                target.RemovedByFullName = currentFullName;
                target.RemovedAtLevel = isCreator ? null : currentStep?.StepOrder;
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

                // Re-adding someone removed from this same form reuses the old row (keeps the OtFormId+EmployeeId key).
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

            if (header != null)
                await ApplyOfficeHeaderAsync(otForm, header, newReason!, currentUserName, currentFullName);

            var caseChanged = newOtCase != null && newOtCase.Id != otForm.OtCaseId;
            if (caseChanged)
            {
                var oldCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otForm.OtCaseId);
                await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.FormInfoChanged,
                    null, null, "OtCase", oldCase?.Code, newOtCase!.Code);
                otForm.OtCaseId = newOtCase.Id;
            }

            var restartsChain = resubmit != null && (resubmit.Kind == OtFormResubmitKind.AfterReject || !resubmit.SkipsIntermediate);
            if (resubmit != null)
            {
                await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.Resubmitted,
                    null, null, null, null, resubmitReason);
                var wasRejected = otForm.Status == (int)OtFormStatus.Rejected;
                otForm.Status = (int)OtFormStatus.InApproval;
                // Back into the next daily batch sweep for the Manager.
                otForm.OtFormBatchId = null;
                if (restartsChain)
                    foreach (var step in steps) SoftDeleteStep(step);
                else
                {
                    await ReopenManagerStepsAsync(steps, wasRejected);
                    await ResignGroupStepsAsync(otForm.Id, steps, resubmitReason!, resignStep == null ? null : new OtFormApprovalHistory
                    {
                        OtFormApprovalStepId = resignStep.Id,
                        ApproverUserName = currentUserName,
                        ApproverFullName = currentFullName,
                        OnBehalfOfUserName = resignDelegatorUserName,
                        OnBehalfOfFullName = resignDelegatorFullName,
                        SignatureImage = resignSignature
                    });
                }
            }

            var chainCompleted = caseChanged || restartsChain
                ? await ReconcileApprovalChainAsync(otForm, creatorEmployee?.Id, steps)
                : false;

            await RecalculateMealTicketCountsAsync(otForm.Id, finalActiveEmployees, mealSettings);

            otForm.NumberOfEmployee = finalActiveEmployees.Count;
            if (chainCompleted)
            {
                otForm.Status = (int)OtFormStatus.Completed;
                await AccumulateEmployeeHoursAsync(otForm, finalActiveEmployees);
            }
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            if (chainCompleted) QueueApprovedNotification(otForm.Id);
            else if (resubmit != null)
            {
                // Manager-level steps are reached by the daily batch mail instead.
                var nextStep = await GetCurrentPendingStepAsync(otForm.Id);
                if (nextStep != null && nextStep.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None)
                    QueueStepApprovalNotification(otForm.Id, nextStep.Id);
            }

            // Skipped in the background job when the remover is the form's own creator.
            QueueEmployeesRemovedNotification(otForm.Id, removedEmployeeIds.ToList());

            return await GetByIdAsync(otForm.Id);
        }

        // Applies the editable general info of an office form and logs each field that really changed.
        private async Task ApplyOfficeHeaderAsync(
            OtForm otForm, UpdateOtFormHeaderDto header, Reason newReason, string userName, string? fullName)
        {
            Task Log(string field, string? oldValue, string? newValue) =>
                oldValue == newValue
                    ? Task.CompletedTask
                    : LogEditAsync(otForm.Id, userName, fullName, OtFormEditActionType.FormInfoChanged, null, null, field, oldValue, newValue);

            await Log("Date", otForm.Date.ToString("dd/MM/yyyy"), header.Date.ToString("dd/MM/yyyy"));
            await Log("FormStartTime", otForm.StartTime.ToString("HH:mm"), header.StartTime.ToString("HH:mm"));
            await Log("FormEndTime", otForm.EndTime.ToString("HH:mm"), header.EndTime.ToString("HH:mm"));

            var newSubReason = string.IsNullOrWhiteSpace(header.SubReason) ? null : header.SubReason.Trim();
            if (otForm.ReasonId != newReason.Id)
            {
                var oldReason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == otForm.ReasonId);
                await Log("Reason", oldReason?.ReasonNameVn, newReason.ReasonNameVn);
            }
            await Log("SubReason", otForm.SubReason, newSubReason);

            otForm.Date = header.Date;
            otForm.StartTime = header.StartTime;
            otForm.EndTime = header.EndTime;
            otForm.ReasonId = newReason.Id;
            otForm.SubReason = newSubReason;
            otForm.TotalHour = Math.Round((decimal)(header.EndTime - header.StartTime).TotalHours, 2);

            var processPart = await _unitOfWork.ProcessParts.FirstOrDefaultAsync(x => x.OtFormId == otForm.Id);
            if (processPart == null || header.ProcessPart == null) return;

            var requested = header.ProcessPart;
            await Log("MilkCount", processPart.MilkCount.ToString(), requested.MilkCount.ToString());
            await Log("IsTransportation", processPart.IsTransportation ? "Có" : "Không", requested.IsTransportation ? "Có" : "Không");
            await Log("IsUseCopyRoom", processPart.IsUseCopyRoom ? "Có" : "Không", requested.IsUseCopyRoom ? "Có" : "Không");
            await Log("AnotherSuggestionVn", processPart.AnotherSuggestionVn, requested.AnotherSuggestionVn);
            await Log("AnotherSuggestionJp", processPart.AnotherSuggestionJp, requested.AnotherSuggestionJp);

            processPart.MilkCount = requested.MilkCount;
            processPart.IsTransportation = requested.IsTransportation;
            processPart.IsUseCopyRoom = requested.IsUseCopyRoom;
            processPart.AnotherSuggestionVn = requested.AnotherSuggestionVn;
            processPart.AnotherSuggestionJp = requested.AnotherSuggestionJp;
            _unitOfWork.ProcessParts.Update(processPart);
        }

        // Re-resolves the chain after the OT case (hence the required approval level) changed. Approved steps
        // are kept as they are, pending ones are refreshed/added/dropped. True = nothing is left to approve.
        private async Task<bool> ReconcileApprovalChainAsync(OtForm otForm, int? creatorEmployeeId, List<OtFormApprovalStep> steps)
        {
            var chain = await _jobTitleApprovalChainService.ResolveChainForCreationAsync(
                creatorEmployeeId, otForm.GroupId!.Value, otForm.DepartmentId, otForm.WorkshopId, otForm.OtCaseId);
            otForm.ApprovalChainWarning = chain.Warning;

            // No configured chain: leave the existing steps instead of stranding the form without any.
            if (chain.Steps.Count == 0 && !chain.IsComplete)
            {
                if (!steps.Any(x => !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending))
                    throw new DomainException("Nhóm/Bộ phận của đơn chưa có cây duyệt nên không thể trình lại. Liên hệ người phụ trách cây duyệt hoặc Admin.");
                return false;
            }

            var existingSteps = steps.Where(x => !x.IsDeleted).ToList();
            var stepByJobTitleId = existingSteps.GroupBy(x => x.JobTitleId).ToDictionary(g => g.Key, g => g.OrderBy(x => x.StepOrder).First());

            // By reference: re-sign copies are not saved yet, so they all share Id 0.
            var keptSteps = new HashSet<OtFormApprovalStep>();
            var pendingCount = 0;
            foreach (var step in chain.Steps)
            {
                if (stepByJobTitleId.TryGetValue(step.JobTitleId, out var row))
                {
                    keptSteps.Add(row);
                    row.StepOrder = step.StepOrder;
                    if (row.Status == (int)OtFormApprovalStepStatus.Approved)
                    {
                        _unitOfWork.OtFormApprovalSteps.Update(row);
                        continue;
                    }

                    row.RequiresSignatureSnapshot = step.RequiresSignature;
                    row.IsResponsibleSnapshot = step.IsResponsible;
                    row.TerminalLevelSnapshot = step.TerminalLevel;
                    _unitOfWork.OtFormApprovalSteps.Update(row);
                    foreach (var candidate in row.Candidates.ToList()) _unitOfWork.OtFormApprovalStepCandidates.Delete(candidate);
                    row.Candidates.Clear();
                    // Navigation, not Id: the row may be a not-yet-saved re-sign copy.
                    foreach (var candidate in step.Candidates)
                        await _unitOfWork.OtFormApprovalStepCandidates.AddAsync(new OtFormApprovalStepCandidate
                        {
                            OtFormApprovalStep = row, EmployeeId = candidate.EmployeeId, UserName = candidate.UserName, FullName = candidate.FullName
                        });
                    pendingCount++;
                    continue;
                }

                var newStep = new OtFormApprovalStep
                {
                    OtForm = otForm,
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
                foreach (var candidate in step.Candidates)
                    await _unitOfWork.OtFormApprovalStepCandidates.AddAsync(new OtFormApprovalStepCandidate
                    {
                        OtFormApprovalStep = newStep, EmployeeId = candidate.EmployeeId, UserName = candidate.UserName, FullName = candidate.FullName
                    });
                pendingCount++;
            }

            foreach (var row in existingSteps.Where(x => !keptSteps.Contains(x) && x.Status == (int)OtFormApprovalStepStatus.Pending))
            {
                row.IsDeleted = true;
                _unitOfWork.OtFormApprovalSteps.Update(row);
            }

            return pendingCount == 0;
        }

        private void SoftDeleteStep(OtFormApprovalStep step)
        {
            step.IsDeleted = true;
            _unitOfWork.OtFormApprovalSteps.Update(step);
        }

        // Straight-to-Manager re-submission: the first signed Manager-level step reopens and later ones keep their
        // approval; after a rejection every Manager-level step reopens. A reopened row is dropped with its signature.
        private async Task ReopenManagerStepsAsync(List<OtFormApprovalStep> steps, bool afterReject)
        {
            var terminalSteps = steps.Where(x => !x.IsDeleted && x.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None)
                .OrderBy(x => x.StepOrder).ToList();
            var toReopen = afterReject
                ? terminalSteps.Where(x => x.Status != (int)OtFormApprovalStepStatus.Pending).ToList()
                : terminalSteps.Where(x => x.Status == (int)OtFormApprovalStepStatus.Approved).Take(1).ToList();

            foreach (var signed in toReopen)
            {
                SoftDeleteStep(signed);
                var copy = new OtFormApprovalStep
                {
                    OtFormId = signed.OtFormId,
                    StepOrder = signed.StepOrder,
                    JobTitleId = signed.JobTitleId,
                    JobTitleCodeSnapshot = signed.JobTitleCodeSnapshot,
                    JobTitleNameSnapshot = signed.JobTitleNameSnapshot,
                    RequiresSignatureSnapshot = signed.RequiresSignatureSnapshot,
                    IsResponsibleSnapshot = signed.IsResponsibleSnapshot,
                    TerminalLevelSnapshot = signed.TerminalLevelSnapshot,
                    Status = (int)OtFormApprovalStepStatus.Pending,
                    Candidates = signed.Candidates.Select(c => new OtFormApprovalStepCandidate
                    {
                        EmployeeId = c.EmployeeId, UserName = c.UserName, FullName = c.FullName
                    }).ToList()
                };
                await _unitOfWork.OtFormApprovalSteps.AddAsync(copy);
                steps.Add(copy);
            }
        }

        // Straight-to-Manager re-submission skips the group steps, so each approved one is signed again now: by the
        // editor on their own step (editorEntry), otherwise by its last signer with their current signature.
        private async Task ResignGroupStepsAsync(int otFormId, List<OtFormApprovalStep> steps, string reason, OtFormApprovalHistory? editorEntry)
        {
            var groupSteps = steps.Where(x => !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Approved
                && x.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None).ToList();
            var stepIds = groupSteps.Select(x => x.Id).ToHashSet();
            var lastSigned = (await _unitOfWork.OtFormApprovalHistories.FindAsync(
                    x => x.OtFormId == otFormId && x.Action == (int)ApprovalAction.Approved && stepIds.Contains(x.OtFormApprovalStepId)))
                .GroupBy(x => x.OtFormApprovalStepId)
                .ToDictionary(g => g.Key, g => g.MaxBy(x => x.ActionAt)!);
            var signerNames = lastSigned.Values.Select(x => x.ApproverUserName).Distinct().ToList();
            var currentSignatures = (await _unitOfWork.UserSignatures.SelectAsync(
                    x => signerNames.Contains(x.UserName), x => new { x.UserName, x.SignatureImage }))
                .ToDictionary(x => x.UserName, x => x.SignatureImage, StringComparer.OrdinalIgnoreCase);

            var now = TimeHelper.GetCurrentUtcTime();
            foreach (var step in groupSteps)
            {
                var entry = editorEntry?.OtFormApprovalStepId == step.Id ? editorEntry : null;
                if (entry == null)
                {
                    if (!lastSigned.TryGetValue(step.Id, out var previous)) continue;
                    entry = new OtFormApprovalHistory
                    {
                        OtFormApprovalStepId = step.Id,
                        ApproverUserName = previous.ApproverUserName,
                        ApproverFullName = previous.ApproverFullName,
                        OnBehalfOfUserName = previous.OnBehalfOfUserName,
                        OnBehalfOfFullName = previous.OnBehalfOfFullName,
                        SignatureImage = step.RequiresSignatureSnapshot
                            ? currentSignatures.GetValueOrDefault(previous.ApproverUserName) ?? previous.SignatureImage
                            : null
                    };
                }
                entry.OtFormId = otFormId;
                entry.Action = (int)ApprovalAction.Approved;
                entry.Comment = reason;
                entry.ActionAt = now;
                await _unitOfWork.OtFormApprovalHistories.AddAsync(entry);
            }
        }

        private sealed record ResubmitInfo(OtFormResubmitKind Kind, HashSet<string> UserNames, DateTime? Deadline, int? SignStepId, bool SkipsIntermediate);

        // Office form that normal editing no longer covers. Manager-signed, or rejected at a Manager-level step in a group
        // with a CanResubmit step: holders of that step (the creator when it was skipped for their rank; Admin too).
        // Any other rejection: the creator restarts the chain. Completed: only within ResubmitWindowDays. Null = none.
        private async Task<ResubmitInfo?> ResolveResubmitAsync(OtForm otForm, IReadOnlyList<OtFormApprovalStep> steps)
        {
            if (otForm.IsProductionForm || !otForm.GroupId.HasValue) return null;

            var creatorRestart = new ResubmitInfo(OtFormResubmitKind.AfterReject,
                new HashSet<string>(StringComparer.OrdinalIgnoreCase) { otForm.CreatedByUserName }, null, null, false);
            var isRejected = otForm.Status == (int)OtFormStatus.Rejected;
            if (isRejected)
            {
                if (!steps.Any(x => !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Rejected
                        && x.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None))
                    return creatorRestart;
            }
            else if (!steps.Any(x => !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Approved
                    && x.TerminalLevelSnapshot != (int)JobTitleTerminalLevel.None))
                return null;

            DateTime? deadline = null;
            if (otForm.Status == (int)OtFormStatus.Completed)
            {
                var approvedAt = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                    x => x.OtFormId == otForm.Id && x.Action == (int)ApprovalAction.Approved, x => (DateTime?)x.ActionAt);
                deadline = (approvedAt.Max() ?? otForm.CreatedAt).AddDays((await _attendanceSettingService.GetAsync()).ResubmitWindowDays);
                if (TimeHelper.GetCurrentUtcTime() > deadline) return null;
            }

            var flagged = (await _unitOfWork.GroupApprovalSteps.SelectAsync(
                    x => x.GroupId == otForm.GroupId.Value && !x.IsDeleted && x.CanResubmit,
                    x => new { x.JobTitleId, x.StepOrder, x.ResubmitSkipsIntermediate }))
                .OrderBy(x => x.StepOrder).ToList();
            if (isRejected && flagged.Count == 0) return creatorRestart;

            var flaggedJobTitleIds = flagged.Select(x => x.JobTitleId).ToHashSet();
            var signStep = steps.Where(x => !x.IsDeleted && flaggedJobTitleIds.Contains(x.JobTitleId)
                && x.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None).MinBy(x => x.StepOrder);
            var userNames = signStep != null
                ? signStep.Candidates.Select(c => c.UserName).ToHashSet(StringComparer.OrdinalIgnoreCase)
                : flaggedJobTitleIds.Count > 0
                    ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { otForm.CreatedByUserName }
                    : new HashSet<string>();
            // A group without any flagged step (Admin only) keeps going straight back to the Manager.
            var skipsIntermediate = flagged.Count == 0
                || (flagged.FirstOrDefault(x => x.JobTitleId == signStep?.JobTitleId) ?? flagged[0]).ResubmitSkipsIntermediate;
            return new ResubmitInfo(OtFormResubmitKind.Resign, userNames, deadline, signStep?.Id, skipsIntermediate);
        }

        private static void EnsureDateNotTooFarBack(DateOnly date, int backdateDays)
        {
            var earliest = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime()).AddDays(-backdateDays);
            if (date < earliest)
                throw new DomainException($"Chỉ được làm đơn cho ngày từ {earliest:dd/MM/yyyy} trở đi (lùi tối đa {backdateDays} ngày).");
        }

        // Added employees must share (Line, shift team) with at least one remaining employee; mixed lines are allowed.
        // Skipped when no original employee remains after this save's removals.
        private static void EnsureAddedEmployeeMatchesFormScope(
            Employee employee, ProductionEmployee productionEmployee, HashSet<(string? BlockCode, string? ShiftTeamCode)> baselinePairs)
        {
            if (baselinePairs.Count == 0) return;

            var pair = (productionEmployee.BlockCode, productionEmployee.ShiftTeamCode);
            if (!baselinePairs.Contains(pair))
                throw new DomainException($"Nhân viên '{employee.Code}' không thuộc Line/Nhóm ca của đơn này.");
        }

        // Shared by approve/reject and UpdateAsync, since production-form edit rights follow the current step.
        private async Task<OtFormApprovalStep?> GetCurrentPendingStepAsync(int otFormId)
        {
            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == otFormId && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates);
            return pendingSteps.OrderBy(x => x.StepOrder).FirstOrDefault();
        }

        // Active delegators of userName (account -> full name); the delegate may act wherever a delegator is a candidate.
        private async Task<Dictionary<string, string>> GetActiveDelegatorsAsync(string userName)
        {
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var rows = await _unitOfWork.ApprovalDelegations.SelectAsync(
                predicate: d => !d.IsDeleted && d.DelegateEmployee.UserName == userName
                    && d.DelegatorEmployee.UserName != null && d.FromDate <= today && d.ToDate >= today,
                selector: d => new { UserName = d.DelegatorEmployee.UserName!, d.DelegatorEmployee.LastName, d.DelegatorEmployee.FirstName });
            return rows.GroupBy(r => r.UserName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => $"{g.First().LastName} {g.First().FirstName}", StringComparer.OrdinalIgnoreCase);
        }

        // A direct candidacy wins over delegation; otherwise the covered candidate (delegator) is returned.
        // Case-insensitive: Windows login yields "YEV\x" while imported accounts are often stored as "yev\x".
        private static (bool IsActor, string? DelegatorUserName, string? DelegatorFullName) MatchStepActor(
            OtFormApprovalStep step, string userName, Dictionary<string, string> delegators)
        {
            if (step.Candidates.Any(c => string.Equals(c.UserName, userName, StringComparison.OrdinalIgnoreCase))) return (true, null, null);

            var covered = step.Candidates.FirstOrDefault(c => delegators.ContainsKey(c.UserName));
            return covered == null ? (false, null, null) : (true, covered.UserName, covered.FullName);
        }

        // No Admin bypass: only a candidate of the current step (or their delegate) may approve or reject.
        private async Task<(OtForm otForm, OtFormApprovalStep currentStep, string? delegatorUserName, string? delegatorFullName)> LoadFormAndCurrentStepAsync(
            int id, string approverUserName)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể duyệt/từ chối thêm.");

            var currentStep = await GetCurrentPendingStepAsync(id);
            if (currentStep == null)
                throw new DomainException("Đơn không còn bước duyệt nào đang chờ xử lý (dữ liệu không nhất quán, liên hệ Admin).");

            var match = MatchStepActor(currentStep, approverUserName, await GetActiveDelegatorsAsync(approverUserName));
            if (!match.IsActor)
                throw new DomainException($"Bạn không phải người được chỉ định duyệt bước hiện tại (Chức vụ '{currentStep.JobTitleNameSnapshot}') của đơn này.");

            // A delegate signing their own form would let one person both raise and approve it.
            if (match.DelegatorUserName != null && string.Equals(otForm.CreatedByUserName, approverUserName, StringComparison.OrdinalIgnoreCase))
                throw new DomainException("Bạn là người tạo đơn nên không thể duyệt thay (ủy quyền) cho bước này. Người ủy quyền phải tự duyệt.");

            return (otForm, currentStep, match.DelegatorUserName, match.DelegatorFullName);
        }

        public async Task ApproveAsync(int id, string approverUserName, string? approverFullName, ApproveOtFormDto request)
        {
            var (otForm, currentStep, delegatorUserName, delegatorFullName) = await LoadFormAndCurrentStepAsync(id, approverUserName);

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
                OnBehalfOfUserName = delegatorUserName,
                OnBehalfOfFullName = delegatorFullName,
                Action = (int)ApprovalAction.Approved,
                Comment = request.Comment,
                SignatureImage = signatureImage,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            currentStep.Status = (int)OtFormApprovalStepStatus.Approved;
            _unitOfWork.OtFormApprovalSteps.Update(currentStep);

            var remainingPending = await _unitOfWork.OtFormApprovalSteps.FindAsync(
                x => x.OtFormId == otForm.Id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending && x.Id != currentStep.Id);

            // Always touched: its rowversion makes an edit saved meanwhile fail instead of being overwritten.
            _unitOfWork.OtForms.Update(otForm);

            if (remainingPending.Count == 0)
            {
                otForm.Status = (int)OtFormStatus.Completed;
                var activeRows = await _unitOfWork.OtFormEmployees.FindAsync(x => x.OtFormId == otForm.Id && !x.IsRemoved);
                await AccumulateEmployeeHoursAsync(otForm, activeRows);
            }
            else
            {
                // Moving up to another manager level (TH2/TH3): leave the old batch so the next sweep gathers it for that level.
                var nextLevel = remainingPending.MinBy(x => x.StepOrder)!.TerminalLevelSnapshot;
                if (nextLevel != (int)JobTitleTerminalLevel.None && nextLevel != currentStep.TerminalLevelSnapshot)
                {
                    otForm.OtFormBatch = null;
                    otForm.OtFormBatchId = null;
                }
            }

            await _unitOfWork.SaveChangesAsync();

            // Mail the next step's candidates, or tell the creator the form is fully approved.
            if (remainingPending.Count == 0)
                QueueApprovedNotification(otForm.Id);
            else
            {
                var nextStepId = remainingPending.OrderBy(x => x.StepOrder).First().Id;
                var nextStepWithCandidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                    x => x.Id == nextStepId, x => x.Candidates)).FirstOrDefault();
                // Manager-level steps rely on the daily batch mail, same as CreateAsync.
                if (nextStepWithCandidates != null && nextStepWithCandidates.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None)
                    QueueStepApprovalNotification(otForm.Id, nextStepWithCandidates.Id);
            }
        }

        public async Task RejectAsync(int id, string approverUserName, string? approverFullName, RejectOtFormDto request)
        {
            var (otForm, currentStep, delegatorUserName, delegatorFullName) = await LoadFormAndCurrentStepAsync(id, approverUserName);

            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                OtFormApprovalStepId = currentStep.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                OnBehalfOfUserName = delegatorUserName,
                OnBehalfOfFullName = delegatorFullName,
                Action = (int)ApprovalAction.Rejected,
                Comment = request.Comment,
                ActionAt = TimeHelper.GetCurrentUtcTime()
            });

            currentStep.Status = (int)OtFormApprovalStepStatus.Rejected;
            _unitOfWork.OtFormApprovalSteps.Update(currentStep);

            // Skip remaining Pending steps so the form leaves everyone's pending list.
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

        // Reuses ApproveAsync per form so all validation applies; each form succeeds or fails independently.
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

        public async Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);

            var result = await RemoveEmployeeCoreAsync(
                emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName,
                isAdmin: false, request.EmployeeId, request.Reason, request.SecondaryPassword);

            QueueEmployeesRemovedNotification(emailToken.OtFormId, new List<int> { request.EmployeeId });
            return result;
        }

        // Same RemoveEmployeeCoreAsync as the email channel; no SecondaryPassword required.
        public async Task<OtFormDto> RemoveEmployeeAsync(
            int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request)
        {
            var result = await RemoveEmployeeCoreAsync(
                id, userName, fullName, isAdmin, request.EmployeeId, request.Reason, secondaryPassword: null);

            QueueEmployeesRemovedNotification(id, new List<int> { request.EmployeeId });
            return result;
        }

        // For permanently stuck forms. Completed is blocked because its hours are in the payroll ledger;
        // other statuses only have projected totals computed on read, so nothing needs reversing.
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

            if (!isAdmin)
            {
                if (currentStep == null || !MatchStepActor(currentStep, userName, await GetActiveDelegatorsAsync(userName)).IsActor)
                    throw new DomainException("Bạn không được phân quyền ở bước mà đơn này đang chờ, nên không thể loại nhân viên khỏi đơn.");
            }

            // null = in-app channel, already authenticated by JWT.
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

            // Saved by the flow's own SaveChanges, so the decision, the used token and the queued mail can't drift apart.
            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await ApproveAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);
        }

        public async Task RejectByEmailTokenAsync(string token, RejectOtFormDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await RejectAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);
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

        private async Task<List<Employee>> ValidateEmployeesAsync(
            int? groupId, TimeOnly formStartTime, TimeOnly formEndTime, List<CreateOtFormEmployeeItemDto> items)
        {
            var employeeIds = items.Select(x => x.EmployeeId).ToList();
            var employees = await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id) && !x.IsDeleted);
            if (employees.Count != employeeIds.Distinct().Count())
                throw new DomainException("Có nhân viên không tồn tại hoặc đã bị xóa trong danh sách.");

            // No fixed group on production forms; their scope is inferred per step.
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
                    $"Không thể lưu đơn — các nhân viên sau đã có đơn tăng ca trùng giờ trong ngày {date:dd/MM/yyyy}: " +
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

        // IsEarlyMealWindowOt/CalculateOtHours/CalculateMealTicketType live in MealTicketCalculator, shared with reports.
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

        // Call after any post-create change to employees/DidEat; MilkCount is manual and left alone.
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

        // Not called from CreateAsync: CreatedByUserName/CreatedAt already record creation.
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

        // Writes only the ledger; readers sum it by today's real month/year, so future-dated forms show up only in their month.
        // Rows are passed explicitly so a form completing at creation accumulates in the same save. sign = -1 reverses it.
        private async Task AccumulateEmployeeHoursAsync(OtForm otForm, IReadOnlyCollection<OtFormEmployee> otFormEmployees, int sign = 1)
        {
            var mealSettings = await _attendanceSettingService.GetAsync();

            // Keyed by EmployeeId only: every row belongs to the same form, hence the same Year/Month.
            var employeeIds = otFormEmployees.Select(x => x.EmployeeId).ToList();

            // Sign-off freezes the actual accumulation before this form; must run before the ledger takes its hours.
            if (sign > 0)
            {
                var frozen = await ComputeFormAccumulationAsync(employeeIds, otForm.Date, otForm.Id, mealSettings, includePending: false);
                foreach (var row in otFormEmployees)
                {
                    row.MonthToDate = frozen[row.EmployeeId].Month;
                    row.YearToDate = frozen[row.EmployeeId].Year;
                }
            }
            var existingLedgerRows = (await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => employeeIds.Contains(x.EmployeeId) && x.Year == otForm.Date.Year && x.Month == otForm.Date.Month))
                .ToDictionary(x => x.EmployeeId);

            foreach (var otFormEmployee in otFormEmployees)
            {
                var hours = sign > 0
                    ? CalculateOtHours(otFormEmployee.StartTime, otFormEmployee.EndTime, otFormEmployee.DidEat, mealSettings)
                    : -(otFormEmployee.LedgerHours
                        ?? CalculateOtHours(otFormEmployee.StartTime, otFormEmployee.EndTime, otFormEmployee.DidEat, mealSettings));
                otFormEmployee.LedgerHours = sign > 0 ? hours : null;

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

        // Accumulation up to `date`, excluding the form itself: ledger minus completed forms dated after `date` in that month
        // (the ledger has no per-day figure, so imported hours count from the start of their month), plus, when includePending,
        // other in-approval forms dated on or before `date`.
        private async Task<Dictionary<int, (decimal Month, decimal Year)>> ComputeFormAccumulationAsync(
            IEnumerable<int> employeeIds, DateOnly date, int excludeFormId, AttendanceSettingDto mealSettings, bool includePending)
        {
            var ids = employeeIds.Distinct().ToList();
            var rows = await _unitOfWork.OtFormEmployees.SelectAsync(
                predicate: x => ids.Contains(x.EmployeeId) && !x.IsRemoved && x.OtFormId != excludeFormId && !x.OtForm.IsDeleted
                    && x.OtForm.Date.Year == date.Year && x.OtForm.Date.Month <= date.Month
                    && ((x.OtForm.Status == (int)OtFormStatus.InApproval && x.OtForm.Date <= date)
                        || (x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date > date && x.OtForm.Date.Month == date.Month)),
                selector: x => new { x.EmployeeId, x.OtFormId, x.StartTime, x.EndTime, x.DidEat, x.OtForm.Date, x.OtForm.Status });
            // Tracking query on purpose: an edited Completed form has already been taken out of the ledger in memory.
            var ledger = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => ids.Contains(x.EmployeeId) && x.Year == date.Year && x.Month <= date.Month);

            var rowsByEmployee = rows.ToLookup(x => x.EmployeeId);
            var ledgerByEmployee = ledger.ToLookup(x => x.EmployeeId);
            return ids.ToDictionary(id => id, id =>
            {
                var forms = rowsByEmployee[id]
                    .Select(x => (x.Date, x.Status, Hours: CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)))
                    .ToList();
                // Completed rows here are only those dated after `date`, so they are subtracted.
                var completedLater = forms.Where(x => x.Status == (int)OtFormStatus.Completed).Sum(x => x.Hours);
                var pending = includePending ? forms.Where(x => x.Status == (int)OtFormStatus.InApproval).ToList() : new();
                var employeeLedger = ledgerByEmployee[id].ToList();
                return (
                    employeeLedger.Where(x => x.Month == date.Month).Sum(x => x.TotalHours) - completedLater
                        + pending.Where(x => x.Date.Month == date.Month).Sum(x => x.Hours),
                    employeeLedger.Sum(x => x.TotalHours) - completedLater + pending.Sum(x => x.Hours));
            });
        }

        // Completed forms keep the actual figure frozen at sign-off; any other form is computed live including other
        // pending forms, so rejecting one of those never leaves a stale number on a form still being approved.
        private async Task<Dictionary<int, (decimal Month, decimal Year)>> GetFormAccumulationAsync(
            OtForm otForm, IReadOnlyCollection<OtFormEmployee> rows, AttendanceSettingDto mealSettings)
        {
            if (otForm.Status == (int)OtFormStatus.Completed)
                return rows.ToDictionary(x => x.EmployeeId, x => (x.MonthToDate, x.YearToDate));
            return await ComputeFormAccumulationAsync(rows.Select(x => x.EmployeeId), otForm.Date, otForm.Id, mealSettings, includePending: true);
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
            DateOnly date, Dictionary<int, decimal> newHoursByEmployeeId, AttendanceSettingDto settings, AccumulatedByEmployee accumulated)
        {
            if (newHoursByEmployeeId.Count == 0) return;

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

        // A year with no calendar rows yet falls back to Sundays only, mirroring WorkCalendarService.GetByYearAsync.
        private async Task<bool> IsNonWorkingDayAsync(DateOnly date)
        {
            if ((await _unitOfWork.WorkCalendarDays.FindAsync(x => x.Date == date)).Count > 0) return true;
            if (date.DayOfWeek != DayOfWeek.Sunday) return false;

            var yearStart = new DateOnly(date.Year, 1, 1);
            var nextYearStart = yearStart.AddYears(1);
            var calendarImported = (await _unitOfWork.WorkCalendarDays.SelectAsync(
                x => x.Date >= yearStart && x.Date < nextYearStart, x => x.Id)).Count > 0;
            return !calendarImported;
        }

        // True when any employee's month or year accumulation, including this form's hours, passes
        // MonthlyOtHourLimit/YearlyOtHourLimit (the employee's custom limit wins when set). Such a form must be TH3.
        private async Task<bool> ExceedsMonthYearLimitAsync(
            Dictionary<int, decimal> newHoursByEmployeeId, AttendanceSettingDto settings, AccumulatedByEmployee accumulated)
        {
            if (newHoursByEmployeeId.Count == 0) return false;

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
        // from the derived case. Returns the accumulation it computed so the create flow reuses it.
        private async Task<AccumulatedByEmployee> EnsureOtCaseMatchesRulesAsync(CreateOtFormDto request, bool forceMeal, OtCase requestedCase)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId,
                x => CalculateOtHours(x.StartTime ?? request.StartTime, x.EndTime, ResolveDidEat(forceMeal, x.DidEat), settings));
            var accumulated = await ComputeAccumulatedHoursBatchAsync(newHoursByEmployeeId.Keys, request.Date, settings);
            var exceedsTh3 = await ExceedsMonthYearLimitAsync(newHoursByEmployeeId, settings, accumulated);

            var expectedCode = exceedsTh3 ? "TH3" : (await IsNonWorkingDayAsync(request.Date) ? "TH2" : "TH1");
            if (!string.Equals(requestedCase.Code, expectedCode, StringComparison.OrdinalIgnoreCase))
            {
                var reason = exceedsTh3
                    ? "có nhân viên vượt giới hạn OT tháng/năm"
                    : $"ngày {request.Date:dd/MM/yyyy} là {(expectedCode == "TH2" ? "ngày nghỉ" : "ngày làm việc")}";
                throw new DomainException($"Trường hợp OT phải là {expectedCode} vì {reason}.");
            }

            return accumulated;
        }

        // === Batch forms ("Don tong") ===
        // Only forms whose current step is a manager level are batched; processing reuses ApproveAsync/RejectAsync.

        // Forms matching the filter whose current pending step is at the given TerminalLevel.
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

        // Forms not yet batched whose current step is a manager level; DepartmentManager batches per (department, workshop),
        // the two company-wide levels have one batch per level since their candidates aren't department-filtered.
        private async Task<List<(int OtFormId, int DepartmentId, int WorkshopId, int TerminalLevel)>> GetNewFormsAtManagerStepAsync()
        {
            var candidateForms = await _unitOfWork.OtForms.SelectAsync(
                predicate: x => !x.IsDeleted && x.OtFormBatchId == null && x.Status == (int)OtFormStatus.InApproval,
                selector: x => new { x.Id, x.DepartmentId, x.WorkshopId });
            if (candidateForms.Count == 0) return new List<(int, int, int, int)>();

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
                .Select(f => (f.Id, f.DepartmentId, f.WorkshopId, levelByFormId[f.Id]))
                .ToList();
        }

        // JobTitle has no Japanese name, so company-wide scopes are Vietnamese only.
        private async Task<(string ScopeNameVn, string? ScopeNameJp)> ResolveBatchScopeNameAsync(OtFormBatch batch)
        {
            if (batch.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
            {
                var department = batch.Department ?? await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == batch.DepartmentId!.Value);
                var workshop = batch.Workshop ?? (batch.WorkshopId.HasValue ? await _unitOfWork.Workshops.GetByIdAsync(batch.WorkshopId.Value) : null);
                return (JoinWithWorkshop(department?.DepartmentNameVn, workshop?.WorkshopNameVn),
                    department?.DepartmentNameJp == null ? null : JoinWithWorkshop(department.DepartmentNameJp, workshop?.WorkshopNameJp ?? workshop?.WorkshopNameVn));
            }

            var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.TerminalLevel == batch.TerminalLevel && !x.IsDeleted);
            return (jobTitle?.Name ?? "", null);
        }

        private static string JoinWithWorkshop(string? name, string? workshopName) =>
            string.IsNullOrEmpty(workshopName) ? name ?? "" : $"{name} · {workshopName}";

        private async Task<OtFormBatchDto> GetBatchByIdAsync(int id)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == id, x => x.Department!, x => x.Workshop!);
            batch.OrThrowNotFound("Đơn tổng", id);
            return await BuildBatchDtoAsync(batch!);
        }

        // Forms handled individually outside the batch drop out of this list but keep their OtFormBatchId.
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

            var processPartsByFormId = activeFormIds.Count == 0
                ? new Dictionary<int, ProcessPart>()
                : (await _unitOfWork.ProcessParts.FindAsync(x => activeFormIds.Contains(x.OtFormId)))
                    .ToDictionary(x => x.OtFormId);

            var mealSettings = await _attendanceSettingService.GetAsync();
            var (scopeNameVn, scopeNameJp) = await ResolveBatchScopeNameAsync(batch);
            var accumulationByFormId = new Dictionary<int, Dictionary<int, (decimal Month, decimal Year)>>();
            foreach (var f in otForms)
                accumulationByFormId[f.Id] = await GetFormAccumulationAsync(f, employeesByFormId.GetValueOrDefault(f.Id) ?? new List<OtFormEmployee>(), mealSettings);

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
                    OtCaseDescription = f.OtCase.Description,
                    OtCaseDescriptionJp = f.OtCase.DescriptionJp,
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
                            MonthToDate = accumulationByFormId[f.Id][x.EmployeeId].Month + CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
                            YearToDate = accumulationByFormId[f.Id][x.EmployeeId].Year + CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings),
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

        private async Task<OtFormBatchDto> ProcessBatchAsync(int batchId, string approverUserName, string? approverFullName, ProcessOtFormBatchDto request)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == batchId, x => x.Department!, x => x.Workshop!);
            batch.OrThrowNotFound("Đơn tổng", batchId);

            if (batch!.Status != (int)OtFormBatchStatus.Pending)
                throw new DomainException("Đơn tổng này đã được xử lý xong.");

            var activeFormIds = await GetActiveFormIdsForBatchAsync(
                x => !x.IsDeleted && x.OtFormBatchId == batchId && x.Status == (int)OtFormStatus.InApproval, batch.TerminalLevel);

            if (activeFormIds.Count == 0)
            {
                // Every member was handled individually, so the batch closes itself.
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

            // Validated up front for clear errors; the writes below still run in one transaction.
            var currentStepByFormId = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => activeFormIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.StepOrder).First());

            var activeEmployeeCountByFormId = (await _unitOfWork.OtFormEmployees.FindAsync(
                x => activeFormIds.Contains(x.OtFormId) && !x.IsRemoved))
                .GroupBy(x => x.OtFormId)
                .ToDictionary(g => g.Key, g => g.Count());

            var delegators = await GetActiveDelegatorsAsync(approverUserName);
            foreach (var item in request.Forms)
            {
                if (!currentStepByFormId.TryGetValue(item.OtFormId, out var step) || !MatchStepActor(step, approverUserName, delegators).IsActor)
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

            // Outside the transaction so a wrong guess is still counted when it rolls back.
            await _secondaryPasswordService.VerifyAsync(approverUserName, request.SecondaryPassword);

            // Reuse the single-form flows unchanged (accumulation, next-level mail).
            await RunAtomicallyAsync(async () =>
            {
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
                            // The secondary password was verified once for the whole batch above, so pass null.
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
                return true;
            });

            return await BuildBatchDtoAsync(batch);
        }

        // === Email channel for batches: the token is the only credential ===

        public async Task<OtFormBatchDto> GetBatchByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveBatchEmailTokenAsync(token, requireUnused: false);
            return await GetBatchByIdAsync(emailToken.OtFormBatchId);
        }

        public async Task<OtFormBatchDto> ProcessBatchByEmailTokenAsync(string token, ProcessOtFormBatchDto request)
        {
            var emailToken = await ResolveBatchEmailTokenAsync(token, requireUnused: true);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.OtFormBatchEmailTokens.Update(emailToken);
            return await ProcessBatchAsync(emailToken.OtFormBatchId, emailToken.ApproverUserName, emailToken.ApproverFullName, request);
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

        // New forms join the scope's still-pending batch so each approver gets one mail per scope per day;
        // a batch that gained no forms is sent as a reminder, an empty one closes silently.
        public async Task RunDailyBatchSweepAsync()
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var today = DateOnly.FromDateTime(now);

            var pendingBatches = (await _unitOfWork.OtFormBatches.FindAsync(x => x.Status == (int)OtFormBatchStatus.Pending))
                .OrderBy(x => x.Id).ToList();

            // Same-scope pending batches are folded into the oldest so each approver gets one mail per scope.
            var openBatchByScope = new Dictionary<(int, int?, int?), OtFormBatch>();
            var keepIdByDuplicateId = new Dictionary<int, int>();
            foreach (var batch in pendingBatches)
            {
                var scope = (batch.TerminalLevel, batch.DepartmentId, batch.WorkshopId);
                if (openBatchByScope.TryGetValue(scope, out var keep)) keepIdByDuplicateId[batch.Id] = keep.Id;
                else openBatchByScope[scope] = batch;
            }
            if (keepIdByDuplicateId.Count > 0)
            {
                var duplicateIds = keepIdByDuplicateId.Keys.ToList();
                foreach (var form in await _unitOfWork.OtForms.FindAsync(x => x.OtFormBatchId != null && duplicateIds.Contains(x.OtFormBatchId.Value)))
                {
                    form.OtFormBatchId = keepIdByDuplicateId[form.OtFormBatchId!.Value];
                    _unitOfWork.OtForms.Update(form);
                }
                foreach (var duplicate in pendingBatches.Where(x => keepIdByDuplicateId.ContainsKey(x.Id)))
                {
                    duplicate.Status = (int)OtFormBatchStatus.Processed;
                    duplicate.ProcessedAt = now;
                    _unitOfWork.OtFormBatches.Update(duplicate);
                }
                pendingBatches.RemoveAll(x => keepIdByDuplicateId.ContainsKey(x.Id));
                await _unitOfWork.SaveChangesAsync();
            }

            var batchesWithNewForms = new HashSet<OtFormBatch>();

            var newFormRows = await GetNewFormsAtManagerStepAsync();
            if (newFormRows.Count > 0)
            {
                var newFormIds = newFormRows.Select(x => x.OtFormId).ToHashSet();
                var newFormsById = (await _unitOfWork.OtForms.FindAsync(x => newFormIds.Contains(x.Id))).ToDictionary(x => x.Id);

                var groups = newFormRows.GroupBy(r => (
                    TerminalLevel: r.TerminalLevel,
                    DepartmentId: r.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager ? r.DepartmentId : (int?)null,
                    WorkshopId: r.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager ? r.WorkshopId : (int?)null));

                foreach (var group in groups)
                {
                    var isNewBatch = !openBatchByScope.TryGetValue(group.Key, out var batch);
                    if (isNewBatch)
                    {
                        batch = new OtFormBatch
                        {
                            TerminalLevel = group.Key.TerminalLevel,
                            DepartmentId = group.Key.DepartmentId,
                            WorkshopId = group.Key.WorkshopId,
                            BatchDate = today,
                            Status = (int)OtFormBatchStatus.Pending,
                            CreatedAt = now
                        };
                        await _unitOfWork.OtFormBatches.AddAsync(batch);
                        pendingBatches.Add(batch);
                    }

                    foreach (var r in group)
                    {
                        var form = newFormsById[r.OtFormId];
                        // Existing batches are linked by id so the untracked batch isn't re-attached through the form.
                        if (isNewBatch) form.OtFormBatch = batch; else form.OtFormBatchId = batch!.Id;
                        _unitOfWork.OtForms.Update(form);
                    }

                    batchesWithNewForms.Add(batch!);
                }

                await _unitOfWork.SaveChangesAsync();
            }

            foreach (var batch in pendingBatches)
            {
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
                await _notificationService.NotifyBatchApproversAsync(batch, activeForms, await ResolveBatchScopeNameAsync(batch),
                    isReminder: !batchesWithNewForms.Contains(batch));
            }

            // Delegations that start today were not active when earlier step mails went out.
            var startingToday = await _unitOfWork.ApprovalDelegations.SelectAsync(
                predicate: d => !d.IsDeleted && d.FromDate == today, selector: d => d.Id);
            foreach (var delegationId in startingToday)
                await _notificationService.SendDelegationBackfillNotificationsAsync(delegationId);

            var setting = (await _unitOfWork.AttendanceSettings.GetAllAsync()).FirstOrDefault();
            if (setting != null)
            {
                setting.LastBatchSweepDate = today;
                _unitOfWork.AttendanceSettings.Update(setting);
            }

            await _unitOfWork.SaveChangesAsync();
        }
    }
}
