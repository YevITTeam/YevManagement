using System.Linq.Expressions;
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

        public async Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.CreatedByUserName == userName);
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
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
            DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var myCurrentFormIds = await GetMyCurrentPendingFormIdsAsync(approverUserName);

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval && myCurrentFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderBy(x => x.Date);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
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
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var actedFormIds = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => h.ApproverUserName == userName, h => h.OtFormId);
            var distinctFormIds = actedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyParticipationsAsync(
            string userName, int pageIndex, int pageSize, DateOnly? fromDate = null, DateOnly? toDate = null, int? status = null)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted);
            if (employee == null)
                return new PagedResponse<OtFormListItemDto>(new List<OtFormListItemDto>(), 0, pageIndex, pageSize);

            var participatedFormIds = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.EmployeeId == employee.Id, x => x.OtFormId);
            var distinctFormIds = participatedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group!, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id));
            query = ApplyListFilters(query, fromDate, toDate, status).OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDto);
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

            // Kiểm tra trùng giờ tăng ca — 1 nhân viên không được xuất hiện trong 2 đơn tăng ca có
            // giờ chồng chéo trong cùng 1 ngày. Chỉ xét các đơn chưa bị xóa và chưa bị từ chối.
            var employeeEndTimes = request.Employees.ToDictionary(x => x.EmployeeId, x => x.EndTime);
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, request.StartTime, employeeEndTimes, excludeFormId: null);

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
        // §Đơn theo chuyền. Không có Group để check "ai được tạo đơn cho Group này" như Mode A.
        //
        // Sửa 2026-08-28 (theo yêu cầu người dùng): quy tắc CŨ bắt creator phải nằm trong chính danh
        // sách nhân viên của đơn ("có tăng ca") — sai bản chất, chặn nhầm Line Leader lập đơn hộ cả
        // Line mà chính họ không tăng ca hôm đó. Quy tắc MỚI: Admin luôn được tạo; người thường phải
        // là Line Leader thật (ProductionEmployee.IsLeader=true) của ÍT NHẤT 1 Line có mặt trong đơn —
        // không cần chính họ có tên trong danh sách tăng ca.
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

                var orderLineIds = (await _unitOfWork.ProductionEmployees.SelectAsync(
                    predicate: x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted,
                    selector: x => x.ProductionLineId))
                    .Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();

                var isLineLeaderOfAnyLine = orderLineIds.Count > 0 && (await _unitOfWork.ProductionEmployees.FindAsync(
                    x => x.EmployeeId == creatorEmployee.Id && x.IsLeader && !x.IsDeleted
                        && x.ProductionLineId.HasValue && orderLineIds.Contains(x.ProductionLineId.Value))).Count > 0;

                if (!isLineLeaderOfAnyLine)
                    throw new DomainException("Bạn phải là Line Leader của ít nhất 1 Line trong danh sách nhân viên mới được tạo đơn này.");
            }

            // Nhóm ca bắt buộc trước khi tạo đơn (2026-08-28, theo yêu cầu người dùng) — phòng vệ thêm
            // cho dữ liệu cũ/nhập tay ngoài Import; Import đã chặn "Thiếu mã NHOM" từ 2026-08-24 (xem
            // ProductionEmployeeImportService.ValidateAndResolveRowsAsync) nên trường hợp này hiếm gặp.
            var productionEmployeesForCheck = await _unitOfWork.ProductionEmployees.FindAsync(
                x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted);
            var missingShiftTeam = productionEmployeesForCheck.Where(x => x.ShiftTeamId == null).Select(x => x.EmployeeCode).ToList();
            if (missingShiftTeam.Count > 0)
                throw new DomainException($"Nhân viên chưa có Nhóm ca, cần cập nhật trước khi tạo đơn: {string.Join(", ", missingShiftTeam)}.");

            var validatedEmployees = await ValidateEmployeesAsync(null, request.StartTime, request.EndTime, request.Employees);

            var employeeEndTimes = request.Employees.ToDictionary(x => x.EmployeeId, x => x.EndTime);
            await EnsureNoOverlappingOtFormsAsync(
                validatedEmployees, request.Date, request.StartTime, employeeEndTimes, excludeFormId: null);

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

        // Phần đuôi dùng chung cho cả 2 kiểu tạo đơn (2026-08-24) — thêm OtForm/OtFormEmployee(kèm
        // snapshot ProductionEmployee nếu có)/ProcessPart/chuỗi bước duyệt, lưu, rồi cộng luỹ kế ngay
        // nếu Completed hoặc báo email cho bước đầu tiên nếu còn InApproval.
        private async Task<OtFormDto> FinalizeCreateAsync(
            OtForm newOtForm, CreateOtFormDto request, ResolveApprovalChainResultDto chainResult,
            Dictionary<int, ProductionEmployee>? productionEmployeesByEmployeeId)
        {
            await _unitOfWork.OtForms.AddAsync(newOtForm);

            var mealSettings = await _attendanceSettingService.GetAsync();

            // Chặn CỨNG trước khi ghi bất kỳ gì — vượt giới hạn ngày/tháng/năm của bất kỳ nhân viên nào
            // thì từ chối tạo cả đơn (2026-08-26, xem ValidateOtHourLimitsAsync).
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(request.StartTime, x.EndTime, x.DidEat, mealSettings));
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
                    StartTime = request.StartTime,
                    EndTime = item.EndTime,
                    DidEat = item.DidEat,
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
                if (firstStepWithCandidates != null)
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

        public async Task<OtFormDto> UpdateAsync(int id, string currentUserName, string? currentFullName, bool isAdmin, UpdateOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể sửa.");

            // Giai đoạn 5 (2026-08-27, theo yêu cầu người dùng — xem attendance-module.md §Chế tạo):
            // quyền sửa đơn "theo chuyền" đi theo TỪNG BƯỚC duyệt — ai đang là candidate của bước
            // Pending hiện tại thì sửa được (giống hệt ai được duyệt bước đó), KHÔNG còn giới hạn "chỉ
            // người tạo, chỉ trước khi có bước nào Approved" như đơn theo Nhóm. Bước trước đã ký thì
            // GIỮ NGUYÊN chữ ký cũ khi có sửa ở bước sau (đã chốt với người dùng — không huỷ/bắt ký
            // lại), nhưng chính bước ĐÃ ký đó bị khoá lại — chỉ bước đang Pending mới sửa được (khớp
            // đúng "Line Leader ký xong không sửa được nữa" nhưng Group Leader/Team Leader ở bước sau
            // vẫn sửa được cho tới khi TỰ HỌ ký). Không có Admin bypass — cùng nguyên tắc với
            // LoadFormAndCurrentStepAsync (Approve/Reject).
            if (otForm.IsProductionForm)
            {
                var currentStep = await GetCurrentPendingStepAsync(id);
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
            // chế với ApproveAsync/RejectAsync.
            await _secondaryPasswordService.VerifyAsync(currentUserName, request.SecondaryPassword);

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

            var mealSettings = await _attendanceSettingService.GetAsync();

            // Chặn CỨNG nếu giờ sửa lại khiến ai đó vượt ngày/tháng/năm — excludeFormId: otForm.Id vì
            // các dòng OtFormEmployee hiện có của CHÍNH đơn này đang bị thay thế/sửa, không được cộng
            // dồn ngược lại với giá trị cũ của chính nó (xem ValidateOtHourLimitsAsync).
            var newHoursByEmployeeId = request.Employees.ToDictionary(
                x => x.EmployeeId, x => CalculateOtHours(otForm.StartTime, x.EndTime, x.DidEat, mealSettings));
            await ValidateOtHourLimitsAsync(otForm.Date, newHoursByEmployeeId, mealSettings, excludeFormId: otForm.Id);

            var activeByEmployeeId = activeEmployees.ToDictionary(x => x.EmployeeId);
            foreach (var item in request.Employees)
            {
                var existing = activeByEmployeeId[item.EmployeeId];
                var code = employeeCodeById.GetValueOrDefault(item.EmployeeId, item.EmployeeId.ToString());

                // Log lại từng field thực sự đổi (2026-08-28, theo yêu cầu người dùng — xem OtFormEditLog).
                if (existing.EndTime != item.EndTime)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.TimeChanged,
                        item.EmployeeId, code, "EndTime", existing.EndTime.ToString("HH:mm"), item.EndTime.ToString("HH:mm"));
                if (existing.DidEat != item.DidEat)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.TimeChanged,
                        item.EmployeeId, code, "DidEat", existing.DidEat ? "Có ăn" : "Không ăn", item.DidEat ? "Có ăn" : "Không ăn");
                if (existing.NoteVn != item.NoteVn)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.NoteChanged,
                        item.EmployeeId, code, "NoteVn", existing.NoteVn, item.NoteVn);
                if (existing.NoteJp != item.NoteJp)
                    await LogEditAsync(otForm.Id, currentUserName, currentFullName, OtFormEditActionType.NoteChanged,
                        item.EmployeeId, code, "NoteJp", existing.NoteJp, item.NoteJp);

                existing.EndTime = item.EndTime;
                existing.DidEat = item.DidEat;
                existing.NoteVn = item.NoteVn;
                existing.NoteJp = item.NoteJp;
                _unitOfWork.OtFormEmployees.Update(existing);
            }

            await RecalculateMealTicketCountsAsync(otForm.Id, activeEmployees, mealSettings);

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(otForm.Id);
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
                if (nextStepWithCandidates != null)
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

        public async Task<OtFormDto> RemoveEmployeeAsync(
            int id, string userName, string? fullName, bool isAdmin, RemoveOtFormEmployeeDto request)
        {
            return await RemoveEmployeeCoreAsync(id, userName, fullName, isAdmin, request.EmployeeId, request.Reason, request.SecondaryPassword);
        }

        public async Task<OtFormDto> RemoveEmployeeByEmailTokenAsync(string token, RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);

            // secondaryPassword: null — kênh email KHÔNG cần mật khẩu cấp 2 (quyết định riêng, không đổi
            // theo yêu cầu 2026-08-28, xem RemoveOtFormEmployeeDto).
            return await RemoveEmployeeCoreAsync(
                emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName,
                isAdmin: false, request.EmployeeId, request.Reason, secondaryPassword: null);
        }

        // Thêm 1 nhân viên vào đơn đang chờ xử lý ở đúng bước mình được phân quyền — chiều ngược của
        // RemoveEmployeeCoreAsync (2026-08-28, theo yêu cầu người dùng). Validate tương tự lúc tạo đơn:
        // giới hạn giờ, trùng giờ OT, giới hạn ngày/tháng/năm, Nhóm ca (nếu đơn theo chuyền). Nhân viên
        // trước đó đã bị loại khỏi CHÍNH đơn này (IsRemoved=true) được thêm lại bằng cách tái dùng đúng
        // dòng cũ (giữ nguyên khoá chính OtFormId+EmployeeId), không tạo dòng mới.
        public async Task<OtFormDto> AddEmployeeAsync(
            int id, string userName, string? fullName, bool isAdmin, AddOtFormEmployeeDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtFormEmployees);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.InApproval)
                throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể thêm nhân viên vào đơn nữa.");

            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => x.OtFormId == id && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending, x => x.Candidates);
            var currentStep = pendingSteps.OrderBy(x => x.StepOrder).FirstOrDefault();

            if (!isAdmin)
            {
                if (currentStep == null || !currentStep.Candidates.Any(c => c.UserName == userName))
                    throw new DomainException("Bạn không được phân quyền ở bước mà đơn này đang chờ, nên không thể thêm nhân viên vào đơn.");
            }

            await _secondaryPasswordService.VerifyAsync(userName, request.SecondaryPassword);

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == request.EmployeeId && !x.IsDeleted);
            employee.OrThrowNotFound("Nhân viên", request.EmployeeId);

            var existing = otForm.OtFormEmployees.FirstOrDefault(x => x.EmployeeId == request.EmployeeId);
            if (existing != null && !existing.IsRemoved)
                throw new DomainException($"Nhân viên '{employee!.Code}' đã có trong đơn.");

            if (request.EndTime <= otForm.StartTime || request.EndTime > otForm.EndTime)
                throw new DomainException(
                    $"Giờ kết thúc OT phải sau giờ bắt đầu ({otForm.StartTime:HH:mm}) và không được vượt quá giờ kết thúc của đơn ({otForm.EndTime:HH:mm}).");

            ProductionEmployee? productionEmployee = null;
            if (otForm.IsProductionForm)
            {
                productionEmployee = await _unitOfWork.ProductionEmployees.FirstOrDefaultAsync(
                    x => x.EmployeeId == request.EmployeeId && !x.IsDeleted);
                if (productionEmployee == null)
                    throw new DomainException($"Nhân viên '{employee!.Code}' không có trong danh sách nhân sự dưới chuyền.");
                // Nhóm ca bắt buộc (2026-08-28) — xem ghi chú tương tự ở CreateProductionFormAsync.
                if (productionEmployee.ShiftTeamId == null)
                    throw new DomainException($"Nhân viên '{employee!.Code}' chưa có Nhóm ca, cần cập nhật trước khi thêm vào đơn.");
            }
            else if (otForm.GroupId.HasValue && employee!.GroupId != otForm.GroupId.Value)
            {
                throw new DomainException($"Nhân viên '{employee.Code}' không thuộc Nhóm của đơn này.");
            }

            var mealSettings = await _attendanceSettingService.GetAsync();
            var hours = CalculateOtHours(otForm.StartTime, request.EndTime, request.DidEat, mealSettings);
            await ValidateOtHourLimitsAsync(
                otForm.Date, new Dictionary<int, decimal> { [request.EmployeeId] = hours }, mealSettings, excludeFormId: otForm.Id);

            await EnsureNoOverlappingOtFormsAsync(
                new List<Employee> { employee! }, otForm.Date, otForm.StartTime,
                new Dictionary<int, TimeOnly> { [request.EmployeeId] = request.EndTime }, excludeFormId: otForm.Id);

            var projectedByEmployee = await ComputeAccumulatedHoursBatchAsync(
                new[] { request.EmployeeId }, otForm.Date, mealSettings, excludeFormId: otForm.Id);
            var (_, projectedMonthBefore, projectedYearBefore) =
                projectedByEmployee.TryGetValue(request.EmployeeId, out var projected) ? projected : (0m, 0m, 0m);

            OtFormEmployee affectedRow;
            if (existing != null)
            {
                existing.IsRemoved = false;
                existing.RemovedByUserName = null;
                existing.RemovedByFullName = null;
                existing.RemovedAtLevel = null;
                existing.RemovedAt = null;
                existing.RemoveReason = null;
                existing.EndTime = request.EndTime;
                existing.DidEat = request.DidEat;
                existing.NoteVn = request.NoteVn;
                existing.NoteJp = request.NoteJp;
                _unitOfWork.OtFormEmployees.Update(existing);
                affectedRow = existing;
            }
            else
            {
                affectedRow = new OtFormEmployee
                {
                    OtForm = otForm,
                    EmployeeId = request.EmployeeId,
                    StartTime = otForm.StartTime,
                    EndTime = request.EndTime,
                    DidEat = request.DidEat,
                    NoteVn = request.NoteVn,
                    NoteJp = request.NoteJp,
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

            await LogEditAsync(otForm.Id, userName, fullName, OtFormEditActionType.EmployeeAdded,
                request.EmployeeId, employee!.Code, null, null, $"{request.EndTime:HH:mm}");

            var remainingActiveEmployees = otForm.OtFormEmployees
                .Where(x => !x.IsRemoved && x.EmployeeId != request.EmployeeId)
                .Append(affectedRow)
                .ToList();
            await RecalculateMealTicketCountsAsync(otForm.Id, remainingActiveEmployees, mealSettings);

            otForm.NumberOfEmployee = remainingActiveEmployees.Count;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(otForm.Id);
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
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(candidate.UserName);
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

        private async Task EnsureNoOverlappingOtFormsAsync(
            List<Employee> employees, DateOnly date, TimeOnly formStartTime, Dictionary<int, TimeOnly> employeeEndTimes, int? excludeFormId)
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
        // MainTicketCount/SecondaryTicketCount, giữ nguyên MilkCount (luôn nhập tay). Không làm gì nếu
        // đơn chưa từng bật "Ăn uống" lúc tạo (không có ProcessPart).
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

        // === Lũy kế DỰ KIẾN (2026-08-06, tính-lúc-đọc từ 2026-08-19, batch từ 2026-08-19b) ===
        //
        // Không còn lưu trên Employee — tính trực tiếp từ OtFormEmployee/OtForm mỗi khi cần (ở đây: lúc
        // snapshot vào OtFormEmployee.MonthToDate/YearToDate khi tạo đơn mới). Scope theo targetDate =
        // NGÀY TRÊN ĐƠN đang xét (không phải hôm nay thực tế) — khớp đúng ý nghĩa "đã có bao nhiêu giờ
        // Dự kiến của ĐÚNG tháng mà đơn này rơi vào". !IsRemoved + Status != Rejected + !IsDeleted =
        // đơn còn "đang treo" (kể cả Completed — vẫn tính, xem docs/attendance-module.md §Lũy kế Dự kiến).
        //
        // Nhận CẢ DANH SÁCH employeeId, fetch 1 lượt duy nhất (mirror batch-fetch ledger đã có ở
        // AccumulateEmployeeHoursAsync) — tránh N+1 khi đơn có nhiều người (CreateAsync trước đây gọi
        // hàm này riêng cho từng người trong vòng lặp, N nhân viên = N query).
        // excludeFormId: bỏ qua chính đơn đang sửa khi tính "trước" (UpdateAsync sửa giờ của các dòng
        // đã tồn tại trên CHÍNH đơn này — không được cộng dồn ngược lại với chính nó). Create truyền
        // null vì đơn chưa tồn tại, không có gì để loại trừ.
        private async Task<Dictionary<int, (decimal Day, decimal Month, decimal Year)>> ComputeAccumulatedHoursBatchAsync(
            IEnumerable<int> employeeIds, DateOnly targetDate, AttendanceSettingDto mealSettings, int? excludeFormId = null)
        {
            var employeeIdList = employeeIds.Distinct().ToList();

            var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIdList.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.OtForm.IsDeleted && x.OtForm.Date.Year == targetDate.Year
                     && (excludeFormId == null || x.OtFormId != excludeFormId.Value),
                x => x.OtForm);

            return rows.GroupBy(x => x.EmployeeId).ToDictionary(
                g => g.Key,
                g => (
                    Day: g.Where(x => x.OtForm.Date == targetDate)
                        .Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)),
                    Month: g.Where(x => x.OtForm.Date.Month == targetDate.Month)
                        .Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings)),
                    Year: g.Sum(x => CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings))
                ));
        }

        // Chặn CỨNG tạo/sửa đơn nếu bất kỳ nhân viên nào vượt giới hạn ngày/tháng/năm SAU KHI cộng
        // thêm giờ của đơn đang tạo/sửa (2026-08-26, theo yêu cầu người dùng — đảo ngược hành vi cũ
        // "chỉ cảnh báo đỏ trên UI" của Monthly/YearlyOtHourLimit). "Ngày" cộng dồn theo TẤT CẢ ca OT
        // của nhân viên đó trong đúng ngày (nhiều đơn/nhiều ca cộng lại), không phải riêng lẻ từng ca.
        // Không tự động loại nhân viên khỏi đơn — ném lỗi liệt kê đủ tên, buộc người tạo/sửa đơn tự bỏ
        // bớt (Update) hoặc bỏ chọn (Create) rồi thao tác lại.
        // Ngày dùng CHUNG 1 mốc cho mọi người (AttendanceSetting.DailyOtHourLimit), KHÔNG override được
        // per-employee (đã chốt với người dùng — "Ngày" không nằm trong 2 mốc cho phép gia hạn riêng).
        // Tháng/Năm ưu tiên mốc riêng Employee.CustomMonthlyOtHourLimit/CustomYearlyOtHourLimit nếu đã
        // gán (2026-08-26, "gia hạn" cao hơn mặc định cho từng người — thường dùng cho công nhân dưới
        // chuyền), rơi về mặc định chung nếu chưa gán. Message theo đúng mẫu người dùng yêu cầu: "Nhân
        // viên mã {code} quá ..." — mirror ở FE (CreateOtFormPage.tsx) để cảnh báo SỚM cùng câu chữ.
        private async Task ValidateOtHourLimitsAsync(
            DateOnly date, Dictionary<int, decimal> newHoursByEmployeeId, AttendanceSettingDto settings, int? excludeFormId)
        {
            if (newHoursByEmployeeId.Count == 0) return;

            var accumulated = await ComputeAccumulatedHoursBatchAsync(newHoursByEmployeeId.Keys, date, settings, excludeFormId);
            var employeesById = (await _unitOfWork.Employees.FindAsync(x => newHoursByEmployeeId.Keys.Contains(x.Id)))
                .ToDictionary(x => x.Id);

            var violations = new List<string>();
            foreach (var (employeeId, newHours) in newHoursByEmployeeId)
            {
                var (dayBefore, monthBefore, yearBefore) = accumulated.TryGetValue(employeeId, out var acc) ? acc : (0m, 0m, 0m);
                var employee = employeesById.GetValueOrDefault(employeeId);
                var code = employee?.Code ?? employeeId.ToString();
                var monthlyLimit = employee?.CustomMonthlyOtHourLimit ?? settings.MonthlyOtHourLimit;
                var yearlyLimit = employee?.CustomYearlyOtHourLimit ?? settings.YearlyOtHourLimit;

                var dayAfter = dayBefore + newHours;
                var monthAfter = monthBefore + newHours;
                var yearAfter = yearBefore + newHours;

                if (dayAfter > settings.DailyOtHourLimit)
                    violations.Add($"Nhân viên mã {code} quá giới hạn OT ngày ({dayAfter:0.##}h > {settings.DailyOtHourLimit:0.##}h)");
                if (monthAfter > monthlyLimit)
                    violations.Add($"Nhân viên mã {code} quá giới hạn OT tháng ({monthAfter:0.##}h > {monthlyLimit:0.##}h)");
                if (yearAfter > yearlyLimit)
                    violations.Add($"Nhân viên mã {code} quá giới hạn OT năm ({yearAfter:0.##}h > {yearlyLimit:0.##}h)");
            }

            if (violations.Count > 0)
                throw new DomainException(string.Join("; ", violations) + ". Vui lòng loại khỏi đơn hoặc giảm giờ OT rồi thử lại.");
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
        // nhất) đúng là bước "Trưởng phòng" — điều kiện chung cho gom mới/còn hiệu lực/tự đóng batch.
        private async Task<List<int>> GetFormIdsAtDepartmentManagerStepAsync(Expression<Func<OtForm, bool>> formFilter)
        {
            var formIds = (await _unitOfWork.OtForms.SelectAsync(predicate: formFilter, selector: x => x.Id)).ToHashSet();
            if (formIds.Count == 0) return new List<int>();

            var pendingSteps = await _unitOfWork.OtFormApprovalSteps.SelectAsync(
                predicate: s => !s.IsDeleted && s.Status == (int)OtFormApprovalStepStatus.Pending && formIds.Contains(s.OtFormId),
                selector: s => new { s.OtFormId, s.StepOrder, s.TerminalLevelSnapshot });

            return pendingSteps
                .GroupBy(s => s.OtFormId)
                .Where(g => g.OrderBy(s => s.StepOrder).First().TerminalLevelSnapshot == (int)JobTitleTerminalLevel.DepartmentManager)
                .Select(g => g.Key)
                .ToList();
        }

        public async Task<PagedResponse<OtFormBatchListItemDto>> GetBatchesAsync(string userName, bool isAdmin, int pageIndex, int pageSize)
        {
            var query = _unitOfWork.OtFormBatches.GetQueryable(false, x => x.Department);

            if (!isAdmin)
            {
                // Chỉ Admin thấy hết — người thường chỉ thấy Đơn tổng của Phòng ban mà mình đang là
                // candidate ở bước Trưởng phòng của ÍT NHẤT 1 đơn nào đó (không nhất thiết đơn còn
                // trong batch này, chỉ cần từng là candidate hợp lệ ở đúng cấp đó).
                var myDepartmentIds = (await _unitOfWork.OtFormApprovalStepCandidates.SelectAsync(
                    predicate: c => c.UserName == userName
                        && c.OtFormApprovalStep.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.DepartmentManager,
                    selector: c => c.OtFormApprovalStep.OtForm.DepartmentId))
                    .Distinct().ToHashSet();
                query = query.Where(x => myDepartmentIds.Contains(x.DepartmentId));
            }

            query = query.OrderByDescending(x => x.Id);

            return await _unitOfWork.OtFormBatches.ToPagedResponseAsync(query, pageIndex, pageSize, x => new OtFormBatchListItemDto
            {
                Id = x.Id,
                DepartmentId = x.DepartmentId,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                DepartmentNameJp = x.Department.DepartmentNameJp,
                BatchDate = x.BatchDate,
                Status = x.Status,
                FormCount = x.OtForms.Count(f => !f.IsDeleted),
                EmployeeCount = x.OtForms.Where(f => !f.IsDeleted).SelectMany(f => f.OtFormEmployees).Count(e => !e.IsRemoved),
                TotalHour = x.OtForms.Where(f => !f.IsDeleted).Sum(f => f.TotalHour),
                CreatedAt = x.CreatedAt,
                ProcessedAt = x.ProcessedAt,
                ProcessedByFullName = x.ProcessedByFullName
            });
        }

        public async Task<OtFormBatchDto> GetBatchByIdAsync(int id)
        {
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == id, x => x.Department);
            batch.OrThrowNotFound("Đơn tổng", id);
            return await BuildBatchDtoAsync(batch!);
        }

        // otForms chỉ còn các đơn VẪN CÒN hiệu lực xử lý (đang chờ đúng bước Trưởng phòng) — đơn nào đã
        // bị duyệt/từ chối lẻ tay ngoài luồng batch thì rơi khỏi danh sách này (không xoá liên kết
        // OtFormBatchId, chỉ đơn giản không còn hiển thị như "chờ xử lý" ở đây nữa).
        private async Task<OtFormBatchDto> BuildBatchDtoAsync(OtFormBatch batch)
        {
            var activeFormIds = await GetFormIdsAtDepartmentManagerStepAsync(
                x => !x.IsDeleted && x.OtFormBatchId == batch.Id && x.Status == (int)OtFormStatus.InApproval);

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
            var batch = await _unitOfWork.OtFormBatches.FirstOrDefaultAsync(x => x.Id == batchId, x => x.Department);
            batch.OrThrowNotFound("Đơn tổng", batchId);

            if (batch!.Status != (int)OtFormBatchStatus.Pending)
                throw new DomainException("Đơn tổng này đã được xử lý xong.");

            var activeFormIds = await GetFormIdsAtDepartmentManagerStepAsync(
                x => !x.IsDeleted && x.OtFormBatchId == batchId && x.Status == (int)OtFormStatus.InApproval);

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
                        await RemoveEmployeeAsync(item.OtFormId, approverUserName, approverFullName, isAdmin: false, new RemoveOtFormEmployeeDto
                        {
                            EmployeeId = employeeId,
                            Reason = "Loại khi duyệt Đơn tổng"
                        });
                    }
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

        // Gửi mail tóm tắt cho TẤT CẢ candidate của bước Trưởng phòng, gộp theo UserName (1 người có
        // thể là candidate của nhiều đơn trong cùng batch — chỉ nhận 1 mail, không lặp lại) — mirror
        // NotifyEligibleApproversAsync (đơn lẻ) nhưng gộp nhiều đơn vào 1 email.
        private async Task NotifyBatchApproversAsync(OtFormBatch batch, List<OtForm> activeForms, bool isReminder)
        {
            if (activeForms.Count == 0) return;

            var formIds = activeForms.Select(x => x.Id).ToHashSet();
            var candidates = (await _unitOfWork.OtFormApprovalSteps.FindWithIncludesAsync(
                x => formIds.Contains(x.OtFormId) && !x.IsDeleted && x.Status == (int)OtFormApprovalStepStatus.Pending
                    && x.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.DepartmentManager,
                x => x.Candidates))
                .SelectMany(x => x.Candidates)
                .GroupBy(x => x.UserName)
                .Select(g => g.First())
                .ToList();

            if (candidates.Count == 0) return;

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == batch.DepartmentId);
            var departmentName = FormatBilingual(department?.DepartmentNameVn, department?.DepartmentNameJp);
            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();
            var employeeCount = (await _unitOfWork.OtFormEmployees.FindAsync(x => formIds.Contains(x.OtFormId) && !x.IsRemoved)).Count;
            var totalHour = activeForms.Sum(x => x.TotalHour);
            var hasNewToken = false;

            foreach (var candidate in candidates)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(candidate.UserName);
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
                        ["DepartmentName"] = departmentName,
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
        // (a) gom đơn CHƯA từng vào batch, hiện đúng bước Trưởng phòng → tạo batch mới theo Department,
        //     gửi mail lần đầu; (b) với batch cũ còn Pending: hết đơn hiệu lực → tự đóng (không mail),
        //     còn đơn hiệu lực → gửi mail nhắc (IsReminder=true), KHÔNG gộp thêm đơn mới vào batch cũ.
        public async Task RunDailyBatchSweepAsync()
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var today = DateOnly.FromDateTime(now);

            var newFormIds = await GetFormIdsAtDepartmentManagerStepAsync(
                x => !x.IsDeleted && x.OtFormBatchId == null && x.Status == (int)OtFormStatus.InApproval);

            var newBatches = new List<(OtFormBatch Batch, List<OtForm> Forms)>();

            if (newFormIds.Count > 0)
            {
                var newForms = (await _unitOfWork.OtForms.FindAsync(x => newFormIds.Contains(x.Id))).ToList();

                foreach (var group in newForms.GroupBy(x => x.DepartmentId))
                {
                    var newBatch = new OtFormBatch
                    {
                        DepartmentId = group.Key,
                        BatchDate = today,
                        Status = (int)OtFormBatchStatus.Pending,
                        CreatedAt = now
                    };
                    await _unitOfWork.OtFormBatches.AddAsync(newBatch);

                    var groupForms = group.ToList();
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

                var activeFormIds = await GetFormIdsAtDepartmentManagerStepAsync(
                    x => !x.IsDeleted && x.OtFormBatchId == batch.Id && x.Status == (int)OtFormStatus.InApproval);

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
