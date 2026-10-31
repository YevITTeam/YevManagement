using System.Globalization;
using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;
using Workflow.Application.Dtos.WorkflowRequests;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;
using Workflow.Domain.Enums;

namespace Workflow.Application.Services
{
    // Entities are queried by FK rather than .Include because IGenericRepository supports only one Include level,
    // not enough for Request -> Steps -> Participants.
    public class WorkflowRequestService : BaseService<IWorkflowUnitOfWork>, IWorkflowRequestService
    {
        private static readonly JsonElement NullElement = JsonDocument.Parse("null").RootElement;

        // BuildFormSchemaJson serializes outside the response pipeline, so camelCase must be set here to match the rest of the DTO.
        private static readonly JsonSerializerOptions CamelCaseOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        private static readonly Expression<Func<WorkflowRequest, WorkflowRequestListItemDto>> ToListItemDtoExpr = x => new WorkflowRequestListItemDto
        {
            Id = x.Id,
            RequestCode = x.RequestCode,
            FormDefinitionId = x.FormDefinitionId,
            FormDefinitionNameVn = x.FormDefinition.NameVn,
            Status = x.Status,
            CurrentStepOrder = x.CurrentStepOrder,
            CreatedByEmployeeId = x.CreatedByEmployeeId,
            CreatedByEmployeeName = x.CreatedByEmployee.FullName,
            CreatedAt = x.CreatedAt,
            SubmittedAt = x.SubmittedAt,
            CompletedAt = x.CompletedAt
        };

        private readonly IWorkflowAttachmentStorage _attachmentStorage;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public WorkflowRequestService(
            IWorkflowUnitOfWork unitOfWork,
            IWorkflowAttachmentStorage attachmentStorage,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _attachmentStorage = attachmentStorage;
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
        }

        public async Task<List<AvailableFormDto>> GetAvailableFormsAsync(int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var query = _unitOfWork.FormDefinitions.GetQueryable(false, x => x.FormCategory)
                .Where(x => !x.IsDeleted && x.IsPublished)
                .OrderBy(x => x.NameVn);
            var forms = await _unitOfWork.FormDefinitions.ToListAsync(query, x => new AvailableFormDto
            {
                Id = x.Id,
                Code = x.Code,
                NameVn = x.NameVn,
                NameJp = x.NameJp,
                FormCategoryNameVn = x.FormCategory.NameVn,
                AllowAttachment = x.AllowAttachment,
                RequireAttachment = x.RequireAttachment
            });

            var result = new List<AvailableFormDto>();
            foreach (var form in forms)
            {
                if (await HasFormAccessAsync(form.Id, currentEmployeeId))
                    result.Add(form);
            }
            return result;
        }

        public async Task<WorkflowRequestFormSchemaDto> GetFormSchemaAsync(int formDefinitionId, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            if (!form.IsPublished)
                throw new DomainException("Form chưa được publish, không thể điền đơn.");
            await GuardFormAccessAsync(form.Id, currentEmployeeId);

            var fieldsQuery = _unitOfWork.FormFields.GetQueryable(false, x => x.FormDataSource!)
                .Where(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)
                .OrderBy(x => x.SortOrder);
            var fields = await _unitOfWork.FormFields.ToListAsync(fieldsQuery, x => new FormFieldDto
            {
                Id = x.Id,
                FormDefinitionId = x.FormDefinitionId,
                FieldKey = x.FieldKey,
                LabelVn = x.LabelVn,
                LabelJp = x.LabelJp,
                DataType = x.DataType,
                IsRequired = x.IsRequired,
                SortOrder = x.SortOrder,
                ColumnSpan = x.ColumnSpan,
                Placeholder = x.Placeholder,
                DefaultValue = x.DefaultValue,
                OptionsJson = x.OptionsJson,
                MinValue = x.MinValue,
                MaxValue = x.MaxValue,
                MaxLength = x.MaxLength,
                HelpTextVn = x.HelpTextVn,
                FormDataSourceId = x.FormDataSourceId,
                FormDataSourceNameVn = x.FormDataSource != null ? x.FormDataSource.NameVn : null,
                AutoNumberPattern = x.AutoNumberPattern,
                DefaultVisible = x.DefaultVisible,
                IsReadOnly = x.IsReadOnly
            });

            var conditionsQuery = _unitOfWork.FormFieldConditions.GetQueryable(false, x => x.TargetField, x => x.SourceField)
                .Where(x => !x.IsDeleted && x.TargetField.FormDefinitionId == formDefinitionId)
                .OrderBy(x => x.SortOrder);
            var conditions = await _unitOfWork.FormFieldConditions.ToListAsync(conditionsQuery, x => new FormFieldConditionDto
            {
                Id = x.Id,
                TargetFieldId = x.TargetFieldId,
                TargetFieldLabelVn = x.TargetField.LabelVn,
                SourceFieldId = x.SourceFieldId,
                SourceFieldLabelVn = x.SourceField.LabelVn,
                Operator = x.Operator,
                CompareValue = x.CompareValue,
                CompareValue2 = x.CompareValue2,
                Effect = x.Effect,
                LogicGroup = x.LogicGroup,
                SortOrder = x.SortOrder
            });

            return new WorkflowRequestFormSchemaDto
            {
                FormDefinitionId = form.Id,
                Code = form.Code,
                NameVn = form.NameVn,
                NameJp = form.NameJp,
                Description = form.Description,
                AllowAttachment = form.AllowAttachment,
                RequireAttachment = form.RequireAttachment,
                LayoutHtml = form.LayoutHtml,
                Fields = fields,
                Conditions = conditions
            };
        }

        public async Task<MyEmployeeDto> GetMyEmployeeAsync(int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var employee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            return new MyEmployeeDto { Id = employee.Id, EmployeeCode = employee.EmployeeCode, FullName = employee.FullName };
        }

        public async Task<WorkflowRequestDto> CreateDraftAsync(CreateWorkflowRequestDraftDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(request.FormDefinitionId)).OrThrowNotFound("Form", request.FormDefinitionId);

            if (!form.IsPublished)
                throw new DomainException("Form chưa được publish, không thể tạo đơn.");

            await GuardFormAccessAsync(form.Id, currentEmployeeId);

            var fields = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == form.Id && !x.IsDeleted)).ToList();

            var now = TimeHelper.GetCurrentUtcTime();
            var entity = new WorkflowRequest
            {
                RequestCode = null,
                FormDefinitionId = form.Id,
                FormRouteId = null,
                RouteConditionSnapshot = null,
                FormVersion = form.Version,
                DataJson = NormalizeDraftDataJson(fields, request.DataJson),
                FormSchemaJson = null,
                Status = RequestStatus.Draft,
                CurrentStepOrder = 0,
                CreatedByEmployeeId = currentEmployeeId,
                CreatedByOrgUnitId = null,
                CreatedAt = now,
                IsDeleted = false
            };

            await _unitOfWork.WorkflowRequests.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(entity.Id, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> UpdateDraftAsync(int id, UpdateWorkflowRequestDraftDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.CreatedByEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo đơn mới được sửa đơn này.");
            // SentBack also allows editing DataJson before resubmitting (see ResubmitAsync).
            if (entity.Status is not (RequestStatus.Draft or RequestStatus.SentBack))
                throw new DomainException("Chỉ đơn ở trạng thái Nháp hoặc Trả về mới sửa được.");

            var fields = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == entity.FormDefinitionId && !x.IsDeleted)).ToList();
            entity.DataJson = NormalizeDraftDataJson(fields, request.DataJson);

            _unitOfWork.WorkflowRequests.Update(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(id, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> GetByIdAsync(int id, int? currentUserId, bool hasViewAll)
        {
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);
            await GuardCanViewRequestAsync(entity, currentUserId, hasViewAll);
            return await BuildDtoAsync(entity);
        }

        public async Task<PagedResponse<WorkflowRequestListItemDto>> GetMyRequestsAsync(int? currentUserId, int pageIndex, int pageSize, int? status)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var query = _unitOfWork.WorkflowRequests.GetQueryable(false, x => x.FormDefinition, x => x.CreatedByEmployee)
                .Where(x => !x.IsDeleted && x.CreatedByEmployeeId == currentEmployeeId);
            if (status is not null) query = query.Where(x => (int)x.Status == status.Value);

            return await _unitOfWork.WorkflowRequests.ToPagedResponseAsync(query.OrderByDescending(x => x.CreatedAt), pageIndex, pageSize, ToListItemDtoExpr);
        }

        public async Task<PagedResponse<WorkflowRequestListItemDto>> GetPendingMyApprovalAsync(int? currentUserId, int pageIndex, int pageSize)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var now = TimeHelper.GetCurrentUtcTime();

            var delegatedFromIds = (await _unitOfWork.ApprovalDelegations.FindAsync(
                d => d.DelegateEmployeeId == currentEmployeeId && !d.IsDeleted && d.FromDate <= now && d.ToDate >= now))
                .Select(d => d.DelegatorEmployeeId).Distinct().ToList();
            var actingForEmployeeIds = new List<int> { currentEmployeeId };
            actingForEmployeeIds.AddRange(delegatedFromIds);

            var pendingParticipants = await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(
                p => actingForEmployeeIds.Contains(p.EmployeeId) && p.ParticipantRole == ParticipantRole.Approver && p.ActedAt == null);
            var stepIds = pendingParticipants.Select(p => p.WorkflowRequestStepId).Distinct().ToList();

            var currentSteps = await _unitOfWork.WorkflowRequestSteps.FindAsync(s => stepIds.Contains(s.Id) && s.Status == StepStatus.Current);
            var requestIds = currentSteps.Select(s => s.WorkflowRequestId).Distinct().ToList();

            var query = _unitOfWork.WorkflowRequests.GetQueryable(false, x => x.FormDefinition, x => x.CreatedByEmployee)
                .Where(x => !x.IsDeleted && requestIds.Contains(x.Id))
                .OrderByDescending(x => x.SubmittedAt);

            return await _unitOfWork.WorkflowRequests.ToPagedResponseAsync(query, pageIndex, pageSize, ToListItemDtoExpr);
        }

        public async Task<PagedResponse<WorkflowRequestListItemDto>> GetVisibleToMeAsync(int? currentUserId, bool hasViewAll, int pageIndex, int pageSize, int? status)
        {
            IQueryable<WorkflowRequest> query;
            if (hasViewAll)
            {
                query = _unitOfWork.WorkflowRequests.GetQueryable(false, x => x.FormDefinition, x => x.CreatedByEmployee).Where(x => !x.IsDeleted);
            }
            else
            {
                var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
                var participantStepIds = (await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(p => p.EmployeeId == currentEmployeeId))
                    .Select(p => p.WorkflowRequestStepId).Distinct().ToList();
                var participantRequestIds = (await _unitOfWork.WorkflowRequestSteps.FindAsync(s => participantStepIds.Contains(s.Id)))
                    .Select(s => s.WorkflowRequestId).Distinct().ToList();

                query = _unitOfWork.WorkflowRequests.GetQueryable(false, x => x.FormDefinition, x => x.CreatedByEmployee)
                    .Where(x => !x.IsDeleted && (x.CreatedByEmployeeId == currentEmployeeId || participantRequestIds.Contains(x.Id)));
            }
            if (status is not null) query = query.Where(x => (int)x.Status == status.Value);

            return await _unitOfWork.WorkflowRequests.ToPagedResponseAsync(query.OrderByDescending(x => x.CreatedAt), pageIndex, pageSize, ToListItemDtoExpr);
        }

        // Runs in one explicit transaction; RequestCode comes from raw SQL with a row lock sharing the same connection.
        public async Task<WorkflowRequestDto> SubmitAsync(int id, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.CreatedByEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo đơn mới được nộp đơn này.");
            if (entity.Status != RequestStatus.Draft)
                throw new DomainException("Chỉ đơn ở trạng thái Nháp mới nộp được.");

            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(entity.FormDefinitionId)).OrThrowNotFound("Form", entity.FormDefinitionId);

            // 1. IsPublished
            if (!form.IsPublished)
                throw new DomainException("Form chưa được publish, không thể nộp đơn.");

            // 2. FormAccesses
            await GuardFormAccessAsync(form.Id, currentEmployeeId);

            // 2b. RequireAttachment
            if (form.RequireAttachment)
            {
                var hasAttachment = (await _unitOfWork.WorkflowAttachments.FindAsync(a => a.WorkflowRequestId == entity.Id && !a.IsDeleted)).Any();
                if (!hasAttachment)
                    throw new DomainException("Đơn này yêu cầu phải có ít nhất 1 file đính kèm trước khi nộp.");
            }

            // 3. Validate + normalize DataJson against FormFields, honoring show/hide/require conditions
            var fields = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == form.Id && !x.IsDeleted)).OrderBy(x => x.SortOrder).ToList();
            var conditions = await _unitOfWork.FormFieldConditions.FindWithIncludesAsync(
                x => !x.IsDeleted && x.TargetField.FormDefinitionId == form.Id, x => x.TargetField);

            var incomingData = ParseDataJson(entity.DataJson);
            var normalizedData = await ValidateAndNormalizeDataJsonAsync(fields, conditions, incomingData);

            // 4. Pick route
            var routes = (await _unitOfWork.FormRoutes.FindAsync(x => x.FormDefinitionId == form.Id && !x.IsDeleted)).ToList();
            var (selectedRoute, routeSnapshot) = SelectRoute(form.RouteConditionType, routes, normalizedData, form.RouteNumericFieldKey, form.RouteClassFieldKey);
            if (selectedRoute is null)
                throw new DomainException("Không xác định được nhánh duyệt phù hợp (thiếu nhánh mặc định trong cấu hình form).");

            var routeSteps = (await _unitOfWork.FormApprovalSteps.FindAsync(s => s.FormRouteId == selectedRoute.Id && !s.IsDeleted)).OrderBy(s => s.StepOrder).ToList();
            if (routeSteps.Count == 0)
                throw new DomainException("Nhánh duyệt được chọn chưa có bước duyệt nào.");

            var stepIds = routeSteps.Select(s => s.Id).ToList();
            var configParticipants = (await _unitOfWork.FormApprovalStepParticipants.FindAsync(p => stepIds.Contains(p.FormApprovalStepId) && !p.IsDeleted)).ToList();

            var now = TimeHelper.GetCurrentUtcTime();

            // 5. Resolve CreatedByOrgUnitId
            var primaryOrgUnit = await ResolvePrimaryOrgUnitAsync(currentEmployeeId, now);
            var applicantOrgUnitId = primaryOrgUnit?.OrgUnitId;

            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);

            // 6. Resolve approvers for every step before opening the transaction, so a rejection doesn't hold the sequence lock.
            var stepBuilds = new List<(FormApprovalStep Config, int NodeOrgUnitId, List<(int EmployeeId, ParticipantRole Role, string? ResolvedFromJobTitle)> Resolved)>();
            foreach (var step in routeSteps)
            {
                var (nodeOrgUnitId, resolved) = await ResolveStepParticipantsAsync(step, configParticipants, applicantOrgUnitId, now);
                stepBuilds.Add((step, nodeOrgUnitId, resolved));
            }

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // 6. RequestCode atomic
                var year = now.Year;
                var sequence = await _unitOfWork.WorkflowSequences.GetNextSequenceAsync(form.CodePrefix, year);
                entity.RequestCode = $"{form.CodePrefix}-{year}-{sequence:0000}";

                entity.DataJson = JsonSerializer.Serialize(normalizedData);
                // 7. FormSchemaJson snapshot
                entity.FormSchemaJson = BuildFormSchemaJson(fields, conditions, form.LayoutHtml);
                entity.FormRouteId = selectedRoute.Id;
                entity.RouteConditionSnapshot = routeSnapshot;
                entity.FormVersion = form.Version;
                entity.CreatedByOrgUnitId = applicantOrgUnitId;

                var minConfigStepOrder = routeSteps.Min(s => s.StepOrder);

                // 8. Create WorkflowRequestSteps + Participants
                var stepOrgUnitIds = stepBuilds.Select(b => b.NodeOrgUnitId).Distinct().ToList();
                var orgUnitsById = (await _unitOfWork.OrgUnits.FindAsync(x => stepOrgUnitIds.Contains(x.Id)))
                    .ToDictionary(x => x.Id);

                foreach (var build in stepBuilds)
                {
                    orgUnitsById.TryGetValue(build.NodeOrgUnitId, out var orgUnit);
                    // +1 offset: see WorkflowRequestStep.cs.
                    var snapshotStepOrder = build.Config.StepOrder + 1;
                    var wfStep = new WorkflowRequestStep
                    {
                        StepOrder = snapshotStepOrder,
                        StepNameSnapshot = build.Config.NameVn,
                        StepTypeSnapshot = build.Config.StepType,
                        OrgUnitNameSnapshot = orgUnit?.NameVn,
                        ApproverModeSnapshot = build.Config.ApproverMode,
                        RequireSignatureSnapshot = build.Config.RequireSignature,
                        AllowSendBackSnapshot = build.Config.AllowSendBack,
                        AllowAddApproverSnapshot = build.Config.AllowAddApprover,
                        Status = build.Config.StepOrder == minConfigStepOrder ? StepStatus.Current : StepStatus.Waiting,
                        IsAdHoc = false,
                        WorkflowRequestStepParticipants = build.Resolved.Select(r => new WorkflowRequestStepParticipant
                        {
                            EmployeeId = r.EmployeeId,
                            ParticipantRole = r.Role,
                            ResolvedFromJobTitle = r.ResolvedFromJobTitle
                        }).ToList()
                    };
                    entity.WorkflowRequestSteps.Add(wfStep);
                }

                // 9. Status/CurrentStepOrder
                entity.CurrentStepOrder = minConfigStepOrder + 1;
                entity.Status = RequestStatus.Submitted;
                entity.SubmittedAt = now;

                // 10. History Submit
                entity.WorkflowRequestHistories.Add(new WorkflowRequestHistory
                {
                    StepOrder = 0,
                    ActorEmployeeId = currentEmployeeId,
                    ActorNameSnapshot = currentEmployee.FullName,
                    Action = RequestAction.Submit,
                    ActionAt = now
                });

                _unitOfWork.WorkflowRequests.Update(entity);
                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            // Notify after commit so the transaction isn't held open during SMTP/template rendering.
            var firstCurrentStep = entity.WorkflowRequestSteps.FirstOrDefault(s => s.Status == StepStatus.Current);
            if (firstCurrentStep is not null)
                await NotifyStepApproversAsync(firstCurrentStep, entity);

            return await GetByIdAsync(entity.Id, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> ApproveAsync(int id, ApproveRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var (entity, currentStep) = await LoadPendingApprovalContextAsync(id);

            var now = TimeHelper.GetCurrentUtcTime();
            var (canAct, onBehalfOf) = await ResolveActingCapabilityAsync(currentStep.Id, entity.FormDefinitionId, currentEmployeeId, now, request.OnBehalfOfEmployeeId);
            if (!canAct)
                throw new DomainException("Bạn không có quyền duyệt bước hiện tại của đơn này.");

            return await ApplyApprovalAsync(entity, currentStep, currentEmployeeId, currentEmployee.FullName, onBehalfOf, request.Comment, request.SignatureImageBase64, currentUserId);
        }

        // The token is the credential (approver fixed at send time), so no delegation resolution. The real Current step is
        // reloaded rather than trusting the token's StepOrder; if someone already acted, ApplyApprovalAsync fails cleanly.
        public async Task<WorkflowRequestDto> ApproveByEmailTokenAsync(string token, EmailApproveRequestDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);
            var (entity, currentStep) = await LoadPendingApprovalContextAsync(emailToken.WorkflowRequestId);
            var actingEmployee = (await _unitOfWork.Employees.GetByIdAsync(emailToken.ApproverEmployeeId)).OrThrowNotFound("Nhân sự", emailToken.ApproverEmployeeId);

            // The public page has no signature picker, so use the stored EmployeeSignature when the step requires one.
            string? signatureImageBase64 = null;
            if (currentStep.RequireSignatureSnapshot)
            {
                var signature = await _unitOfWork.EmployeeSignatures.FirstOrDefaultAsync(x => x.EmployeeId == emailToken.ApproverEmployeeId);
                if (signature is null)
                    throw new DomainException("Bước duyệt này yêu cầu chữ ký nhưng bạn chưa đăng ký chữ ký điện tử — vui lòng đăng nhập và đăng ký tại \"Chữ ký của tôi\" trước khi duyệt qua email.");
                signatureImageBase64 = Convert.ToBase64String(signature!.SignatureImage);
            }

            var result = await ApplyApprovalAsync(entity, currentStep, emailToken.ApproverEmployeeId, actingEmployee!.FullName, null, request.Comment, signatureImageBase64, null);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.WorkflowRequestEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();

            return result;
        }

        public async Task<WorkflowRequestDto> RejectAsync(int id, RejectRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var (entity, currentStep) = await LoadPendingApprovalContextAsync(id);

            var now = TimeHelper.GetCurrentUtcTime();
            var (canAct, onBehalfOf) = await ResolveActingCapabilityAsync(currentStep.Id, entity.FormDefinitionId, currentEmployeeId, now, request.OnBehalfOfEmployeeId);
            if (!canAct)
                throw new DomainException("Bạn không có quyền từ chối bước hiện tại của đơn này.");

            return await ApplyRejectionAsync(entity, currentStep, currentEmployeeId, currentEmployee.FullName, onBehalfOf, request.Comment, currentUserId);
        }

        public async Task<WorkflowRequestDto> RejectByEmailTokenAsync(string token, EmailRejectRequestDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);
            var (entity, currentStep) = await LoadPendingApprovalContextAsync(emailToken.WorkflowRequestId);
            var actingEmployee = (await _unitOfWork.Employees.GetByIdAsync(emailToken.ApproverEmployeeId)).OrThrowNotFound("Nhân sự", emailToken.ApproverEmployeeId);

            var result = await ApplyRejectionAsync(entity, currentStep, emailToken.ApproverEmployeeId, actingEmployee!.FullName, null, request.Comment, null);

            emailToken.UsedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.WorkflowRequestEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();

            return result;
        }

        public async Task<WorkflowRequestDto> GetByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);
            return await GetByIdAsync(emailToken.WorkflowRequestId, null, true);
        }

        public async Task<WorkflowRequestDto> SendBackAsync(int id, SendBackRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.Status is not (RequestStatus.Submitted or RequestStatus.InProgress))
                throw new DomainException("Đơn không ở trạng thái chờ duyệt.");

            var steps = await LoadStepsAsync(id);
            var currentStep = steps.FirstOrDefault(s => s.StepOrder == entity.CurrentStepOrder && s.Status == StepStatus.Current)
                ?? throw new DomainException("Không tìm thấy bước duyệt hiện tại của đơn.");

            if (!currentStep.AllowSendBackSnapshot)
                throw new DomainException("Bước duyệt hiện tại không cho phép trả về.");

            if (request.TargetStepOrder < 0 || request.TargetStepOrder >= currentStep.StepOrder)
                throw new DomainException("Bước đích trả về không hợp lệ.");

            var now = TimeHelper.GetCurrentUtcTime();
            var (canAct, onBehalfOf) = await ResolveActingCapabilityAsync(currentStep.Id, entity.FormDefinitionId, currentEmployeeId, now, request.OnBehalfOfEmployeeId);
            if (!canAct)
                throw new DomainException("Bạn không có quyền trả về bước hiện tại của đơn này.");

            var affectedSteps = steps.Where(s => s.StepOrder >= request.TargetStepOrder).ToList();
            foreach (var s in affectedSteps)
            {
                s.Status = StepStatus.Waiting;
                s.ActedByEmployeeId = null;
                s.ActedAt = null;
                _unitOfWork.WorkflowRequestSteps.Update(s);
            }

            var affectedStepIds = affectedSteps.Select(s => s.Id).ToList();
            var participantsToReset = await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(p => affectedStepIds.Contains(p.WorkflowRequestStepId));
            foreach (var p in participantsToReset)
            {
                p.ActedAt = null;
                _unitOfWork.WorkflowRequestStepParticipants.Update(p);
            }

            entity.Status = RequestStatus.SentBack;
            entity.CurrentStepOrder = request.TargetStepOrder;
            _unitOfWork.WorkflowRequests.Update(entity);

            await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
            {
                WorkflowRequestId = entity.Id,
                StepOrder = currentStep.StepOrder,
                ActorEmployeeId = currentEmployeeId,
                OnBehalfOfEmployeeId = onBehalfOf,
                ActorNameSnapshot = currentEmployee.FullName,
                Action = RequestAction.SendBack,
                SentBackToStepOrder = request.TargetStepOrder,
                Comment = request.Comment,
                ActionAt = now
            });

            await _unitOfWork.SaveChangesAsync();
            return await GetByIdAsync(id, currentUserId, true);
        }

        // Pushes a SentBack request back into the approval flow. Does NOT re-resolve approvers — reuses
        // the WorkflowRequestSteps/Participants snapshot from the original Submit.
        public async Task<WorkflowRequestDto> ResubmitAsync(int id, ResubmitRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.CreatedByEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo đơn mới được nộp lại đơn này.");
            if (entity.Status != RequestStatus.SentBack)
                throw new DomainException("Chỉ đơn đang ở trạng thái Trả về mới nộp lại được.");

            var steps = await LoadStepsAsync(id);
            // CurrentStepOrder holds SentBackToStepOrder (0 = back to requester -> reactivate the
            // first step, since there is no real step 0).
            var reactivateStepOrder = entity.CurrentStepOrder == 0 ? steps.Min(s => s.StepOrder) : entity.CurrentStepOrder;
            var targetStep = steps.FirstOrDefault(s => s.StepOrder == reactivateStepOrder && s.Status == StepStatus.Waiting)
                ?? throw new DomainException("Không tìm thấy bước duyệt để nộp lại.");

            var now = TimeHelper.GetCurrentUtcTime();
            targetStep.Status = StepStatus.Current;
            targetStep.ActedByEmployeeId = null;
            targetStep.ActedAt = null;
            _unitOfWork.WorkflowRequestSteps.Update(targetStep);

            entity.CurrentStepOrder = reactivateStepOrder;
            entity.Status = RequestStatus.InProgress;
            _unitOfWork.WorkflowRequests.Update(entity);

            await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
            {
                WorkflowRequestId = entity.Id,
                StepOrder = reactivateStepOrder,
                ActorEmployeeId = currentEmployeeId,
                ActorNameSnapshot = currentEmployee.FullName,
                Action = RequestAction.Resubmit,
                Comment = request.Comment,
                ActionAt = now
            });

            await _unitOfWork.SaveChangesAsync();

            // Same as ApplyApprovalAsync: notify the step's approvers after saving.
            await NotifyStepApproversAsync(targetStep, entity);

            return await GetByIdAsync(id, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> AddApproverAsync(int id, AddApproverRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.Status is not (RequestStatus.Submitted or RequestStatus.InProgress))
                throw new DomainException("Đơn không ở trạng thái chờ duyệt.");

            var steps = await LoadStepsAsync(id);
            var currentStep = steps.FirstOrDefault(s => s.StepOrder == entity.CurrentStepOrder && s.Status == StepStatus.Current)
                ?? throw new DomainException("Không tìm thấy bước duyệt hiện tại của đơn.");

            if (!currentStep.AllowAddApproverSnapshot)
                throw new DomainException("Bước duyệt hiện tại không cho phép thêm người duyệt.");

            var now = TimeHelper.GetCurrentUtcTime();
            var (canAct, _) = await ResolveActingCapabilityAsync(currentStep.Id, entity.FormDefinitionId, currentEmployeeId, now, request.OnBehalfOfEmployeeId);
            if (!canAct)
                throw new DomainException("Bạn không có quyền thêm người duyệt ở bước hiện tại của đơn này.");

            if (request.InsertAfterStepOrder < currentStep.StepOrder)
                throw new DomainException("Chỉ được chèn người duyệt từ bước hiện tại trở đi.");

            var maxStepOrder = steps.Max(s => s.StepOrder);
            if (request.InsertAfterStepOrder > maxStepOrder)
                throw new DomainException("Vị trí chèn không hợp lệ.");

            var employee = (await _unitOfWork.Employees.GetByIdAsync(request.EmployeeId)).OrThrowNotFound("Nhân sự", request.EmployeeId);
            if (employee.UserId is null)
                throw new DomainException($"Nhân sự '{employee.FullName}' chưa liên kết tài khoản đăng nhập, không thể làm người duyệt.");

            var newStepOrder = request.InsertAfterStepOrder + 1;

            // Renumber from the highest StepOrder down to avoid hitting UNIQUE (WorkflowRequestId, StepOrder) mid-loop.
            foreach (var s in steps.Where(s => s.StepOrder >= newStepOrder).OrderByDescending(s => s.StepOrder))
            {
                s.StepOrder += 1;
                _unitOfWork.WorkflowRequestSteps.Update(s);
            }

            var newStep = new WorkflowRequestStep
            {
                WorkflowRequestId = entity.Id,
                StepOrder = newStepOrder,
                StepNameSnapshot = string.IsNullOrWhiteSpace(request.NameVn) ? $"Người duyệt bổ sung: {employee.FullName}" : request.NameVn,
                StepTypeSnapshot = StepType.Approve,
                OrgUnitNameSnapshot = null,
                ApproverModeSnapshot = ApproverMode.Any,
                RequireSignatureSnapshot = false,
                AllowSendBackSnapshot = true,
                AllowAddApproverSnapshot = false,
                Status = StepStatus.Waiting,
                IsAdHoc = true,
                InsertedByEmployeeId = currentEmployeeId
            };
            await _unitOfWork.WorkflowRequestSteps.AddAsync(newStep);
            await _unitOfWork.SaveChangesAsync();

            await _unitOfWork.WorkflowRequestStepParticipants.AddAsync(new WorkflowRequestStepParticipant
            {
                WorkflowRequestStepId = newStep.Id,
                EmployeeId = employee.Id,
                ParticipantRole = ParticipantRole.Approver,
                ResolvedFromJobTitle = null
            });

            await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
            {
                WorkflowRequestId = entity.Id,
                StepOrder = currentStep.StepOrder,
                ActorEmployeeId = currentEmployeeId,
                ActorNameSnapshot = currentEmployee.FullName,
                Action = RequestAction.AddApprover,
                Comment = $"Thêm người duyệt '{employee.FullName}' vào sau bước {request.InsertAfterStepOrder}.",
                ActionAt = now
            });

            await _unitOfWork.SaveChangesAsync();
            return await GetByIdAsync(id, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> CancelAsync(int id, CancelRequestDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var currentEmployee = (await _unitOfWork.Employees.GetByIdAsync(currentEmployeeId)).OrThrowNotFound("Nhân sự", currentEmployeeId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);

            if (entity.CreatedByEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo đơn mới được hủy đơn này.");
            if (entity.Status is RequestStatus.Approved or RequestStatus.Rejected or RequestStatus.Cancelled)
                throw new DomainException("Đơn đã ở trạng thái kết thúc, không thể hủy.");

            var now = TimeHelper.GetCurrentUtcTime();
            entity.Status = RequestStatus.Cancelled;
            entity.CompletedAt = now;
            _unitOfWork.WorkflowRequests.Update(entity);

            // The Current step must leave Current, otherwise the cancelled request still shows in "pending my approval".
            var currentStep = (await LoadStepsAsync(id)).FirstOrDefault(s => s.Status == StepStatus.Current);
            if (currentStep is not null)
            {
                currentStep.Status = StepStatus.Skipped;
                _unitOfWork.WorkflowRequestSteps.Update(currentStep);
            }

            await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
            {
                WorkflowRequestId = entity.Id,
                StepOrder = 0,
                ActorEmployeeId = currentEmployeeId,
                ActorNameSnapshot = currentEmployee.FullName,
                Action = RequestAction.Cancel,
                Comment = request.Reason,
                ActionAt = now
            });

            await _unitOfWork.SaveChangesAsync();
            return await GetByIdAsync(id, currentUserId, true);
        }

        // Owner may add/remove until the request ends; approvers can only view/download.
        public async Task<WorkflowRequestDto> UploadAttachmentAsync(int workflowRequestId, Stream content, string originalFileName, string contentType, long fileSizeBytes, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(workflowRequestId)).OrThrowNotFound("Đơn", workflowRequestId);
            GuardCanEditAttachments(entity, currentEmployeeId);

            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(entity.FormDefinitionId)).OrThrowNotFound("Form", entity.FormDefinitionId);
            if (!form.AllowAttachment)
                throw new DomainException("Loại đơn này không cho phép đính kèm file.");

            if (fileSizeBytes <= 0)
                throw new DomainException("File rỗng, không thể tải lên.");

            var settings = (await _unitOfWork.WorkflowSettings.GetByIdAsync(1)).OrThrowNotFound("Cấu hình Workflow", 1);

            var maxBytes = settings.MaxAttachmentSizeMb * 1024L * 1024L;
            if (fileSizeBytes > maxBytes)
                throw new DomainException($"File vượt quá dung lượng tối đa cho phép ({settings.MaxAttachmentSizeMb} MB).");

            var ext = Path.GetExtension(originalFileName);
            var allowedExts = settings.AllowedFileExtensions
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.ToLowerInvariant())
                .ToHashSet();
            if (string.IsNullOrEmpty(ext) || !allowedExts.Contains(ext.ToLowerInvariant()))
                throw new DomainException($"Định dạng file '{ext}' không được phép. Chỉ chấp nhận: {settings.AllowedFileExtensions}.");

            var currentCount = (await _unitOfWork.WorkflowAttachments.FindAsync(a => a.WorkflowRequestId == workflowRequestId && !a.IsDeleted)).Count;
            if (currentCount >= settings.MaxAttachmentPerRequest)
                throw new DomainException($"Đơn đã đạt số lượng file đính kèm tối đa ({settings.MaxAttachmentPerRequest} file).");

            var (storedFileName, relativePath) = await _attachmentStorage.SaveAsync(workflowRequestId, content, originalFileName);

            await _unitOfWork.WorkflowAttachments.AddAsync(new WorkflowAttachment
            {
                WorkflowRequestId = workflowRequestId,
                OriginalFileName = originalFileName,
                StoredFileName = storedFileName,
                RelativePath = relativePath,
                ContentType = contentType,
                FileSizeBytes = fileSizeBytes,
                UploadedByEmployeeId = currentEmployeeId,
                UploadedAt = TimeHelper.GetCurrentUtcTime()
            });
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(workflowRequestId, currentUserId, true);
        }

        public async Task<WorkflowRequestDto> DeleteAttachmentAsync(int attachmentId, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var attachment = (await _unitOfWork.WorkflowAttachments.GetByIdAsync(attachmentId)).OrThrowNotFound("File đính kèm", attachmentId);
            if (attachment.IsDeleted)
                throw new DomainException("File đính kèm này đã bị xoá.");

            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(attachment.WorkflowRequestId)).OrThrowNotFound("Đơn", attachment.WorkflowRequestId);
            GuardCanEditAttachments(entity, currentEmployeeId);

            attachment.IsDeleted = true;
            _unitOfWork.WorkflowAttachments.Update(attachment);
            await _unitOfWork.SaveChangesAsync();

            // Delete the file only after DB commit: a DB failure then keeps the file instead of leaving dangling metadata.
            _attachmentStorage.Delete(attachment.RelativePath);

            return await GetByIdAsync(entity.Id, currentUserId, true);
        }

        public async Task<WorkflowAttachmentDownloadDto> DownloadAttachmentAsync(int attachmentId, int? currentUserId, bool hasViewAll)
        {
            var attachment = (await _unitOfWork.WorkflowAttachments.GetByIdAsync(attachmentId)).OrThrowNotFound("File đính kèm", attachmentId);
            if (attachment.IsDeleted)
                throw new DomainException("File đính kèm này đã bị xoá.");

            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(attachment.WorkflowRequestId)).OrThrowNotFound("Đơn", attachment.WorkflowRequestId);
            await GuardCanViewRequestAsync(entity, currentUserId, hasViewAll);

            var physicalPath = _attachmentStorage.GetPhysicalPath(attachment.RelativePath);
            if (!File.Exists(physicalPath))
                throw new NotFoundException("File vật lý trên đĩa", attachmentId);

            return new WorkflowAttachmentDownloadDto
            {
                PhysicalPath = physicalPath,
                ContentType = attachment.ContentType,
                OriginalFileName = attachment.OriginalFileName
            };
        }

        // ===================== Helpers =====================

        // Viewers: creator, participants (incl. Viewer) or Request.ViewAll. hasViewAll must return before resolving the
        // employee: the email channel calls this with currentUserId = null.
        private async Task GuardCanViewRequestAsync(WorkflowRequest entity, int? currentUserId, bool hasViewAll)
        {
            if (hasViewAll) return;

            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            if (entity.CreatedByEmployeeId == currentEmployeeId) return;

            var steps = await LoadStepsAsync(entity.Id);
            var stepIds = steps.Select(s => s.Id).ToList();
            var isParticipant = (await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(
                p => stepIds.Contains(p.WorkflowRequestStepId) && p.EmployeeId == currentEmployeeId)).Any();
            if (!isParticipant)
                throw new DomainException("Bạn không có quyền xem đơn này.");
        }

        // Owner only, and only while the request is not finished.
        private static void GuardCanEditAttachments(WorkflowRequest entity, int currentEmployeeId)
        {
            if (entity.CreatedByEmployeeId != currentEmployeeId)
                throw new DomainException("Chỉ người tạo đơn mới được quản lý file đính kèm của đơn này.");
            if (entity.Status is RequestStatus.Approved or RequestStatus.Rejected or RequestStatus.Cancelled)
                throw new DomainException("Đơn đã ở trạng thái kết thúc, không thể thêm/xoá file đính kèm.");
        }

        private async Task<List<WorkflowRequestStep>> LoadStepsAsync(int workflowRequestId)
        {
            return (await _unitOfWork.WorkflowRequestSteps.FindAsync(s => s.WorkflowRequestId == workflowRequestId)).OrderBy(s => s.StepOrder).ToList();
        }

        private async Task<(WorkflowRequest Entity, WorkflowRequestStep CurrentStep)> LoadPendingApprovalContextAsync(int id)
        {
            var entity = (await _unitOfWork.WorkflowRequests.GetByIdAsync(id)).OrThrowNotFound("Đơn", id);
            if (entity.Status is not (RequestStatus.Submitted or RequestStatus.InProgress))
                throw new DomainException("Đơn không ở trạng thái chờ duyệt.");

            var steps = await LoadStepsAsync(id);
            var currentStep = steps.FirstOrDefault(s => s.StepOrder == entity.CurrentStepOrder && s.Status == StepStatus.Current)
                ?? throw new DomainException("Không tìm thấy bước duyệt hiện tại của đơn.");

            return (entity, currentStep);
        }

        // Shared by the JWT channel (actor already resolved, may act on behalf) and email channel (token fixes actor,
        // no delegation). currentUserId may be null since the DTO is read with hasViewAll = true.
        private async Task<WorkflowRequestDto> ApplyApprovalAsync(
            WorkflowRequest entity, WorkflowRequestStep currentStep, int actorEmployeeId, string actorFullName,
            int? onBehalfOfEmployeeId, string? comment, string? signatureImageBase64, int? currentUserId)
        {
            var now = TimeHelper.GetCurrentUtcTime();

            // Lock the request row so two concurrent approvals on an ApproverMode.All step can't both
            // read the participant list before either one's ActedAt update is visible to the other.
            WorkflowRequestStep? nextStep = null;
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                await _unitOfWork.WorkflowRequests.LockForUpdateAsync(entity.Id);

                var participants = (await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(
                    p => p.WorkflowRequestStepId == currentStep.Id && p.ParticipantRole == ParticipantRole.Approver)).ToList();

                var actingAsEmployeeId = onBehalfOfEmployeeId ?? actorEmployeeId;
                var actingParticipant = participants.FirstOrDefault(p => p.EmployeeId == actingAsEmployeeId)
                    ?? throw new DomainException("Không tìm thấy người duyệt tương ứng ở bước này.");
                if (actingParticipant.ActedAt is not null)
                    throw new DomainException("Bạn đã duyệt bước này rồi.");

                actingParticipant.ActedAt = now;
                _unitOfWork.WorkflowRequestStepParticipants.Update(actingParticipant);

                var stepDone = currentStep.ApproverModeSnapshot == ApproverMode.Any ||
                    participants.All(p => p.Id == actingParticipant.Id || p.ActedAt is not null);

                byte[]? signatureBytes = string.IsNullOrEmpty(signatureImageBase64) ? null : Convert.FromBase64String(signatureImageBase64);

                await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
                {
                    WorkflowRequestId = entity.Id,
                    StepOrder = currentStep.StepOrder,
                    ActorEmployeeId = actorEmployeeId,
                    OnBehalfOfEmployeeId = onBehalfOfEmployeeId,
                    ActorNameSnapshot = actorFullName,
                    Action = RequestAction.Approve,
                    Comment = comment,
                    SignatureImage = signatureBytes,
                    ActionAt = now
                });

                if (stepDone)
                {
                    currentStep.Status = StepStatus.Approved;
                    currentStep.ActedByEmployeeId = actorEmployeeId;
                    currentStep.ActedAt = now;
                    _unitOfWork.WorkflowRequestSteps.Update(currentStep);

                    var steps = await LoadStepsAsync(entity.Id);
                    nextStep = steps.Where(s => s.StepOrder > currentStep.StepOrder && s.Status == StepStatus.Waiting).OrderBy(s => s.StepOrder).FirstOrDefault();
                    if (nextStep is null)
                    {
                        entity.Status = RequestStatus.Approved;
                        entity.CompletedAt = now;
                    }
                    else
                    {
                        nextStep.Status = StepStatus.Current;
                        _unitOfWork.WorkflowRequestSteps.Update(nextStep);
                        entity.CurrentStepOrder = nextStep.StepOrder;
                        entity.Status = RequestStatus.InProgress;
                    }
                    _unitOfWork.WorkflowRequests.Update(entity);
                }

                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            // Notify the next step's approvers only after the transaction has committed.
            if (nextStep is not null)
                await NotifyStepApproversAsync(nextStep, entity);

            return await GetByIdAsync(entity.Id, currentUserId, true);
        }

        private async Task<WorkflowRequestDto> ApplyRejectionAsync(
            WorkflowRequest entity, WorkflowRequestStep currentStep, int actorEmployeeId, string actorFullName,
            int? onBehalfOfEmployeeId, string comment, int? currentUserId)
        {
            var now = TimeHelper.GetCurrentUtcTime();

            currentStep.Status = StepStatus.Rejected;
            currentStep.ActedByEmployeeId = actorEmployeeId;
            currentStep.ActedAt = now;
            _unitOfWork.WorkflowRequestSteps.Update(currentStep);

            entity.Status = RequestStatus.Rejected;
            entity.CompletedAt = now;
            _unitOfWork.WorkflowRequests.Update(entity);

            await _unitOfWork.WorkflowRequestHistories.AddAsync(new WorkflowRequestHistory
            {
                WorkflowRequestId = entity.Id,
                StepOrder = currentStep.StepOrder,
                ActorEmployeeId = actorEmployeeId,
                OnBehalfOfEmployeeId = onBehalfOfEmployeeId,
                ActorNameSnapshot = actorFullName,
                Action = RequestAction.Reject,
                Comment = comment,
                ActionAt = now
            });

            await _unitOfWork.SaveChangesAsync();
            return await GetByIdAsync(entity.Id, currentUserId, true);
        }

        // requireUnused = false only for viewing, so an already-used link can still be opened.
        private async Task<WorkflowRequestEmailToken> ResolveEmailTokenAsync(string token, bool requireUnused)
        {
            var emailToken = await _unitOfWork.WorkflowRequestEmailTokens.FirstOrDefaultAsync(x => x.Token == token);
            emailToken.OrThrowNotFound("Link duyệt đơn qua email", token);

            if (emailToken!.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link duyệt đơn qua email đã hết hạn.");
            if (requireUnused && emailToken.UsedAt != null)
                throw new DomainException("Link duyệt đơn này đã được sử dụng.");

            return emailToken;
        }

        // Never call inside an open transaction. Best-effort: one token per approver, those without Email are skipped
        // so one missing address can't block others or the main flow.
        private async Task NotifyStepApproversAsync(WorkflowRequestStep step, WorkflowRequest entity)
        {
            var participants = await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(
                p => p.WorkflowRequestStepId == step.Id && p.ParticipantRole == ParticipantRole.Approver);
            if (participants.Count == 0) return;

            var settings = await _unitOfWork.WorkflowSettings.GetByIdAsync(1);
            var expiryDays = settings?.EmailTokenExpiryDays ?? 7;
            var form = await _unitOfWork.FormDefinitions.GetByIdAsync(entity.FormDefinitionId);
            var creator = await _unitOfWork.Employees.GetByIdAsync(entity.CreatedByEmployeeId);
            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = TimeHelper.GetCurrentUtcTime();

            var participantEmployeeIds = participants.Select(p => p.EmployeeId).Distinct().ToList();
            var employeesById = (await _unitOfWork.Employees.FindAsync(x => participantEmployeeIds.Contains(x.Id)))
                .ToDictionary(x => x.Id);

            var recipients = new List<(Employee Employee, WorkflowRequestEmailToken Token)>();
            foreach (var participant in participants)
            {
                if (!employeesById.TryGetValue(participant.EmployeeId, out var employee) || string.IsNullOrWhiteSpace(employee.Email)) continue;

                var emailToken = new WorkflowRequestEmailToken
                {
                    WorkflowRequestId = entity.Id,
                    StepOrder = step.StepOrder,
                    ApproverEmployeeId = employee.Id,
                    Token = TokenHelper.GenerateSecureToken(),
                    ExpiresAt = now.AddDays(expiryDays),
                    CreatedAt = now
                };
                await _unitOfWork.WorkflowRequestEmailTokens.AddAsync(emailToken);
                recipients.Add((employee, emailToken));
            }

            if (recipients.Count == 0) return;
            await _unitOfWork.SaveChangesAsync();

            foreach (var (employee, emailToken) in recipients)
            {
                try
                {
                    var link = $"{baseUrl}/xac-nhan-don-quy-trinh?token={emailToken.Token}";
                    var html = _emailTemplateRenderer.Render("WorkflowRequest/ApprovalNotification.html", new Dictionary<string, string>
                    {
                        ["ApproverFullName"] = employee.FullName,
                        ["RequestCode"] = entity.RequestCode ?? "",
                        ["FormDefinitionNameVn"] = form?.NameVn ?? "",
                        ["CreatedByEmployeeName"] = creator?.FullName ?? "",
                        ["StepNameSnapshot"] = step.StepNameSnapshot,
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = expiryDays.ToString()
                    });

                    await _emailService.SendAsync(employee.Email!, $"Đơn {entity.RequestCode} đang chờ bạn duyệt - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // Missing template: skip this recipient without blocking the main flow.
                }
            }
        }

        // Roles live in Identity's DB, so role-based access is not validated here; only Employee and OrgUnit targets.
        private async Task GuardFormAccessAsync(int formDefinitionId, int currentEmployeeId)
        {
            if (!await HasFormAccessAsync(formDefinitionId, currentEmployeeId))
                throw new DomainException("Bạn không có quyền tạo đơn loại này.");
        }

        // Role targets are ignored (cross-DB). An access granted to an OrgUnit cascades to all descendant units,
        // so walk up the employee's unit via ParentId and match any ancestor (including itself).
        private async Task<bool> HasFormAccessAsync(int formDefinitionId, int currentEmployeeId)
        {
            var accesses = await _unitOfWork.FormAccesses.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted);
            if (accesses.Count == 0)
                return false;

            if (accesses.Any(x => x.TargetType == AccessTargetType.Employee && x.EmployeeId == currentEmployeeId))
                return true;

            var grantedOrgUnitIds = accesses
                .Where(x => x.TargetType == AccessTargetType.OrgUnit && x.OrgUnitId is int)
                .Select(x => x.OrgUnitId!.Value)
                .ToHashSet();
            if (grantedOrgUnitIds.Count == 0)
                return false;

            var employeeOrgUnitIds = (await _unitOfWork.EmployeeOrgUnits.FindAsync(x => x.EmployeeId == currentEmployeeId && !x.IsDeleted))
                .Select(x => x.OrgUnitId).Distinct().ToList();
            if (employeeOrgUnitIds.Count == 0)
                return false;

            var parentById = (await _unitOfWork.OrgUnits.FindAsync(x => !x.IsDeleted)).ToDictionary(x => x.Id, x => x.ParentId);

            foreach (var startId in employeeOrgUnitIds)
            {
                var current = (int?)startId;
                var hops = 0;
                while (current is int cur && hops++ < 50) // guards against corrupted ParentId cycles
                {
                    if (grantedOrgUnitIds.Contains(cur)) return true;
                    current = parentById.GetValueOrDefault(cur);
                }
            }
            return false;
        }

        private async Task<EmployeeOrgUnit?> ResolvePrimaryOrgUnitAsync(int employeeId, DateTime now)
        {
            var candidates = await _unitOfWork.EmployeeOrgUnits.FindAsync(x => x.EmployeeId == employeeId && x.IsPrimary && !x.IsDeleted);
            return candidates.FirstOrDefault(x => (x.ValidFrom == null || x.ValidFrom <= now) && (x.ValidTo == null || x.ValidTo >= now));
        }

        // Approvers must resolve to someone with a non-null UserId; missing Viewers are skipped.
        private async Task<(int NodeOrgUnitId, List<(int EmployeeId, ParticipantRole Role, string? ResolvedFromJobTitle)> Resolved)> ResolveStepParticipantsAsync(
            FormApprovalStep step, List<FormApprovalStepParticipant> configParticipants, int? applicantOrgUnitId, DateTime now)
        {
            var nodeOrgUnitId = step.OrgUnitScope == OrgUnitScope.Fixed ? step.OrgUnitId : applicantOrgUnitId;
            if (nodeOrgUnitId is null)
                throw new DomainException($"Bước '{step.NameVn}' cần xác định đơn vị tổ chức theo người nộp nhưng người nộp chưa có đơn vị chính còn hiệu lực.");

            var resolved = new List<(int, ParticipantRole, string?)>();
            foreach (var participant in configParticipants.Where(p => p.FormApprovalStepId == step.Id))
            {
                if (participant.ParticipantSource == ParticipantSource.Employee)
                {
                    var employee = (await _unitOfWork.Employees.GetByIdAsync(participant.EmployeeId!.Value)).OrThrowNotFound("Nhân sự", participant.EmployeeId!.Value);
                    if (participant.ParticipantRole == ParticipantRole.Approver && employee.UserId is null)
                        throw new DomainException($"Bước '{step.NameVn}': nhân sự '{employee.FullName}' chưa liên kết tài khoản đăng nhập, không thể duyệt.");
                    resolved.Add((employee.Id, participant.ParticipantRole, null));
                }
                else
                {
                    var candidates = await _unitOfWork.EmployeeOrgUnits.FindAsync(
                        x => x.OrgUnitId == nodeOrgUnitId && x.JobTitleId == participant.JobTitleId && !x.IsDeleted);
                    var effective = candidates.FirstOrDefault(x => (x.ValidFrom == null || x.ValidFrom <= now) && (x.ValidTo == null || x.ValidTo >= now));
                    if (effective is null)
                    {
                        if (participant.ParticipantRole == ParticipantRole.Approver)
                            throw new DomainException($"Bước '{step.NameVn}' không tìm được người giữ chức danh yêu cầu tại đơn vị tương ứng.");
                        continue;
                    }

                    var employee = (await _unitOfWork.Employees.GetByIdAsync(effective.EmployeeId)).OrThrowNotFound("Nhân sự", effective.EmployeeId);
                    if (!employee.IsActive || employee.IsDeleted)
                    {
                        if (participant.ParticipantRole == ParticipantRole.Approver)
                            throw new DomainException($"Bước '{step.NameVn}': người giữ chức danh tương ứng không còn hoạt động.");
                        continue;
                    }
                    if (participant.ParticipantRole == ParticipantRole.Approver && employee.UserId is null)
                        throw new DomainException($"Bước '{step.NameVn}': người giữ chức danh tương ứng ('{employee.FullName}') chưa liên kết tài khoản đăng nhập.");

                    var jobTitle = await _unitOfWork.JobTitles.GetByIdAsync(participant.JobTitleId!.Value);
                    resolved.Add((employee.Id, participant.ParticipantRole, jobTitle?.NameVn));
                }
            }

            if (!resolved.Any(r => r.Item2 == ParticipantRole.Approver))
                throw new DomainException($"Bước '{step.NameVn}' không resolve được người duyệt (Approver) nào.");

            return (nodeOrgUnitId.Value, resolved);
        }

        // First matching route by SortOrder, else the IsDefault route.
        private static (FormRoute? Route, string? Snapshot) SelectRoute(
            RouteConditionType type, List<FormRoute> routes, Dictionary<string, JsonElement> data, string? numericKey, string? classKey)
        {
            var ordered = routes.Where(r => !r.IsDefault).OrderBy(r => r.SortOrder).ToList();

            decimal? numericValue = null;
            if (type is RouteConditionType.NumericRange or RouteConditionType.Both && numericKey is not null &&
                data.TryGetValue(numericKey, out var numEl) && numEl.ValueKind == JsonValueKind.Number)
            {
                numericValue = numEl.GetDecimal();
            }

            string? classValue = null;
            if (type is RouteConditionType.ClassValue or RouteConditionType.Both && classKey is not null &&
                data.TryGetValue(classKey, out var classEl) && classEl.ValueKind == JsonValueKind.String)
            {
                classValue = classEl.GetString();
            }

            foreach (var route in ordered)
            {
                var numericMatch = type is not (RouteConditionType.NumericRange or RouteConditionType.Both) ||
                    (numericValue is not null && (route.MinValue is null || numericValue >= route.MinValue) && (route.MaxValue is null || numericValue < route.MaxValue));
                var classMatch = type is not (RouteConditionType.ClassValue or RouteConditionType.Both) ||
                    (classValue is not null && string.Equals(classValue, route.ClassValue, StringComparison.OrdinalIgnoreCase));

                if (numericMatch && classMatch)
                    return (route, BuildRouteSnapshot(numericValue, classValue));
            }

            var defaultRoute = routes.FirstOrDefault(r => r.IsDefault);
            return (defaultRoute, BuildRouteSnapshot(numericValue, classValue));
        }

        private static string? BuildRouteSnapshot(decimal? numericValue, string? classValue)
        {
            var parts = new List<string>();
            if (numericValue is not null) parts.Add($"Numeric={numericValue.Value.ToString(CultureInfo.InvariantCulture)}");
            if (classValue is not null) parts.Add($"Class={classValue}");
            return parts.Count == 0 ? null : string.Join("; ", parts);
        }

        // Can act as a direct Approver or as Delegate of an active delegation from an Approver (single level only).
        // requestedOnBehalfOfEmployeeId disambiguates when the caller is both, otherwise "approve on behalf" reads as a re-approve.
        private async Task<(bool CanAct, int? OnBehalfOfEmployeeId)> ResolveActingCapabilityAsync(
            int workflowRequestStepId, int formDefinitionId, int currentEmployeeId, DateTime now, int? requestedOnBehalfOfEmployeeId)
        {
            var participants = await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(
                p => p.WorkflowRequestStepId == workflowRequestStepId && p.ParticipantRole == ParticipantRole.Approver);

            if (requestedOnBehalfOfEmployeeId is null && participants.Any(p => p.EmployeeId == currentEmployeeId))
                return (true, null);

            var delegations = await _unitOfWork.ApprovalDelegations.FindAsync(
                d => d.DelegateEmployeeId == currentEmployeeId && !d.IsDeleted && d.FromDate <= now && d.ToDate >= now &&
                     (d.FormDefinitionId == null || d.FormDefinitionId == formDefinitionId) &&
                     (requestedOnBehalfOfEmployeeId == null || d.DelegatorEmployeeId == requestedOnBehalfOfEmployeeId));
            foreach (var d in delegations)
            {
                if (participants.Any(p => p.EmployeeId == d.DelegatorEmployeeId))
                    return (true, d.DelegatorEmployeeId);
            }

            return (false, null);
        }

        // Grouped by LogicGroup (AND within, OR across), evaluated separately per Effect.
        private static Dictionary<int, (bool Visible, bool Required, bool ReadOnly)> EvaluateConditions(
            List<FormField> fields, IReadOnlyList<FormFieldCondition> conditions, Dictionary<string, JsonElement> data)
        {
            var fieldsById = fields.ToDictionary(f => f.Id);
            var result = new Dictionary<int, (bool, bool, bool)>();

            bool EffectActive(List<FormFieldCondition> targetConditions, ConditionEffect effect)
            {
                var relevant = targetConditions.Where(c => c.Effect == effect).ToList();
                if (relevant.Count == 0) return false;
                return relevant.GroupBy(c => c.LogicGroup)
                    .Any(group => group.All(c => EvaluateSingleCondition(c, fieldsById, data)));
            }

            foreach (var field in fields)
            {
                var targetConditions = conditions.Where(c => c.TargetFieldId == field.Id).ToList();
                var showActive = EffectActive(targetConditions, ConditionEffect.Show);
                var hideActive = EffectActive(targetConditions, ConditionEffect.Hide);
                var requireActive = EffectActive(targetConditions, ConditionEffect.Require);
                var readOnlyActive = EffectActive(targetConditions, ConditionEffect.ReadOnly);

                var visible = field.DefaultVisible ? !hideActive : showActive;
                result[field.Id] = (visible, requireActive, readOnlyActive);
            }

            return result;
        }

        private static bool EvaluateSingleCondition(FormFieldCondition condition, Dictionary<int, FormField> fieldsById, Dictionary<string, JsonElement> data)
        {
            if (!fieldsById.TryGetValue(condition.SourceFieldId, out var sourceField)) return false;

            var hasValue = data.TryGetValue(sourceField.FieldKey, out var value) &&
                value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined;

            if (condition.Operator == ConditionOperator.IsEmpty)
                return !hasValue || (value.ValueKind == JsonValueKind.String && value.GetString() == "");
            if (condition.Operator == ConditionOperator.IsNotEmpty)
                return hasValue && !(value.ValueKind == JsonValueKind.String && value.GetString() == "");

            if (!hasValue) return false;

            if (sourceField.DataType is FieldDataType.Number or FieldDataType.Decimal)
            {
                if (value.ValueKind != JsonValueKind.Number) return false;
                var num = value.GetDecimal();
                return condition.Operator switch
                {
                    ConditionOperator.Equals => TryParseDecimal(condition.CompareValue, out var cv) && num == cv,
                    ConditionOperator.NotEquals => !(TryParseDecimal(condition.CompareValue, out var cv2) && num == cv2),
                    ConditionOperator.GreaterThan => TryParseDecimal(condition.CompareValue, out var cv3) && num > cv3,
                    ConditionOperator.LessThan => TryParseDecimal(condition.CompareValue, out var cv4) && num < cv4,
                    ConditionOperator.Between => TryParseDecimal(condition.CompareValue, out var min) && TryParseDecimal(condition.CompareValue2, out var max) && num >= min && num <= max,
                    _ => false
                };
            }

            var str = value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.GetRawText();
            return condition.Operator switch
            {
                // Case-insensitive, matching SelectRoute's ClassValue comparison on the same submitted data.
                ConditionOperator.Equals => string.Equals(str, condition.CompareValue, StringComparison.OrdinalIgnoreCase),
                ConditionOperator.NotEquals => !string.Equals(str, condition.CompareValue, StringComparison.OrdinalIgnoreCase),
                ConditionOperator.Contains => condition.CompareValue is not null && str.Contains(condition.CompareValue, StringComparison.OrdinalIgnoreCase),
                ConditionOperator.GreaterThan => condition.CompareValue is not null && string.CompareOrdinal(str, condition.CompareValue) > 0,
                ConditionOperator.LessThan => condition.CompareValue is not null && string.CompareOrdinal(str, condition.CompareValue) < 0,
                ConditionOperator.Between => condition.CompareValue is not null && condition.CompareValue2 is not null &&
                    string.CompareOrdinal(str, condition.CompareValue) >= 0 && string.CompareOrdinal(str, condition.CompareValue2) <= 0,
                _ => false
            };
        }

        private static bool TryParseDecimal(string? text, out decimal value) =>
            decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out value);

        // Full validation only on Submit; drafts keep whatever the client sent.
        private async Task<Dictionary<string, JsonElement>> ValidateAndNormalizeDataJsonAsync(
            List<FormField> fields, IReadOnlyList<FormFieldCondition> conditions, Dictionary<string, JsonElement> incoming)
        {
            var visibility = EvaluateConditions(fields, conditions, incoming);
            var normalized = new Dictionary<string, JsonElement>();
            var errors = new List<string>();

            foreach (var field in fields)
            {
                if (field.DataType == FieldDataType.Label) continue;

                var (visible, required, _) = visibility[field.Id];
                var hasValue = incoming.TryGetValue(field.FieldKey, out var value) &&
                    value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined;

                if (!visible)
                {
                    normalized[field.FieldKey] = NullElement;
                    continue;
                }

                var isRequired = field.IsRequired || required;
                if (!hasValue)
                {
                    if (isRequired) errors.Add($"'{field.LabelVn}' là bắt buộc.");
                    else normalized[field.FieldKey] = NullElement;
                    continue;
                }

                if (!IsValidJsonType(field.DataType, value))
                {
                    errors.Add($"'{field.LabelVn}' sai định dạng dữ liệu.");
                    continue;
                }

                normalized[field.FieldKey] = field.DataType switch
                {
                    FieldDataType.Employee or FieldDataType.OrgUnit => await NormalizeEmployeeOrOrgUnitValueAsync(field.DataType, value),
                    _ => value.Clone()
                };
            }

            if (errors.Count > 0)
                throw new DomainException(string.Join(" ", errors));

            return normalized;
        }

        private static bool IsValidJsonType(FieldDataType dataType, JsonElement value) => dataType switch
        {
            FieldDataType.Text or FieldDataType.TextArea or FieldDataType.Dropdown or FieldDataType.Radio or FieldDataType.Time => value.ValueKind == JsonValueKind.String,
            FieldDataType.Number or FieldDataType.Decimal => value.ValueKind == JsonValueKind.Number,
            FieldDataType.Date => value.ValueKind == JsonValueKind.String && DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", out _),
            FieldDataType.DateTime => value.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(value.GetString(), out _),
            FieldDataType.Checkbox => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
            FieldDataType.MultiSelect => value.ValueKind == JsonValueKind.Array,
            FieldDataType.Employee or FieldDataType.OrgUnit => value.ValueKind == JsonValueKind.Object,
            _ => true
        };

        // Code/name are looked up by id; names sent by the FE are not trusted.
        private async Task<JsonElement> NormalizeEmployeeOrOrgUnitValueAsync(FieldDataType dataType, JsonElement value)
        {
            if (!value.TryGetProperty("id", out var idEl) || idEl.ValueKind != JsonValueKind.Number)
                throw new DomainException("Giá trị Nhân sự/Đơn vị phải có 'id' hợp lệ.");
            var id = idEl.GetInt32();

            if (dataType == FieldDataType.Employee)
            {
                var employee = (await _unitOfWork.Employees.GetByIdAsync(id)).OrThrowNotFound("Nhân sự", id);
                return JsonSerializer.SerializeToElement(new { id = employee.Id, code = employee.EmployeeCode, name = employee.FullName });
            }

            var orgUnit = (await _unitOfWork.OrgUnits.GetByIdAsync(id)).OrThrowNotFound("Đơn vị tổ chức", id);
            return JsonSerializer.SerializeToElement(new { id = orgUnit.Id, code = orgUnit.Code, name = orgUnit.NameVn });
        }

        private static string NormalizeDraftDataJson(List<FormField> fields, Dictionary<string, JsonElement> incoming)
        {
            var result = new Dictionary<string, JsonElement>();
            foreach (var field in fields)
            {
                if (field.DataType == FieldDataType.Label) continue;
                result[field.FieldKey] = incoming.TryGetValue(field.FieldKey, out var v) ? v.Clone() : NullElement;
            }
            return JsonSerializer.Serialize(result);
        }

        private static Dictionary<string, JsonElement> ParseDataJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, JsonElement>();
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json) ?? new Dictionary<string, JsonElement>();
        }

        private static object? ParseJsonOrNull(string? json) => json is null ? null : JsonSerializer.Deserialize<JsonElement>(json);

        // Snapshot keyed by FieldKey, not Id, so it stays stable if field Ids change.
        private static string BuildFormSchemaJson(List<FormField> fields, IReadOnlyList<FormFieldCondition> conditions, string? layoutHtml)
        {
            var fieldKeyById = fields.ToDictionary(f => f.Id, f => f.FieldKey);

            var snapshot = new
            {
                Fields = fields.OrderBy(f => f.SortOrder).Select(f => new
                {
                    f.FieldKey,
                    f.LabelVn,
                    f.LabelJp,
                    f.DataType,
                    f.IsRequired,
                    f.SortOrder,
                    f.ColumnSpan,
                    f.OptionsJson,
                    f.FormDataSourceId,
                    f.DefaultVisible
                }).ToList(),
                Conditions = conditions.Select(c => new
                {
                    TargetFieldKey = fieldKeyById.GetValueOrDefault(c.TargetFieldId, ""),
                    SourceFieldKey = fieldKeyById.GetValueOrDefault(c.SourceFieldId, ""),
                    c.Operator,
                    c.CompareValue,
                    c.CompareValue2,
                    c.Effect,
                    c.LogicGroup
                }).ToList(),
                // Layout snapshot at submit so old requests always print as submitted; null = grid mode (Fields + ColumnSpan).
                LayoutHtml = layoutHtml
            };
            return JsonSerializer.Serialize(snapshot, CamelCaseOptions);
        }

        private async Task<WorkflowRequestDto> BuildDtoAsync(WorkflowRequest entity)
        {
            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(entity.FormDefinitionId)).OrThrowNotFound("Form", entity.FormDefinitionId);
            var creator = (await _unitOfWork.Employees.GetByIdAsync(entity.CreatedByEmployeeId)).OrThrowNotFound("Nhân sự", entity.CreatedByEmployeeId);
            var orgUnit = entity.CreatedByOrgUnitId is int ouId ? await _unitOfWork.OrgUnits.GetByIdAsync(ouId) : null;

            var steps = await LoadStepsAsync(entity.Id);
            var stepIds = steps.Select(s => s.Id).ToList();
            var participants = (await _unitOfWork.WorkflowRequestStepParticipants.FindAsync(p => stepIds.Contains(p.WorkflowRequestStepId))).ToList();

            var histories = (await _unitOfWork.WorkflowRequestHistories.FindAsync(h => h.WorkflowRequestId == entity.Id)).OrderBy(h => h.ActionAt).ToList();
            var attachments = (await _unitOfWork.WorkflowAttachments.FindAsync(a => a.WorkflowRequestId == entity.Id && !a.IsDeleted)).OrderBy(a => a.UploadedAt).ToList();

            var employeeIdsToLoad = participants.Select(p => p.EmployeeId)
                .Concat(steps.Where(s => s.ActedByEmployeeId is not null).Select(s => s.ActedByEmployeeId!.Value))
                .Concat(steps.Where(s => s.InsertedByEmployeeId is not null).Select(s => s.InsertedByEmployeeId!.Value))
                .Concat(histories.Select(h => h.ActorEmployeeId))
                .Concat(histories.Where(h => h.OnBehalfOfEmployeeId is not null).Select(h => h.OnBehalfOfEmployeeId!.Value))
                .Concat(attachments.Select(a => a.UploadedByEmployeeId))
                .Distinct()
                .ToList();
            var employeesById = (await _unitOfWork.Employees.FindAsync(e => employeeIdsToLoad.Contains(e.Id))).ToDictionary(e => e.Id);

            string? EmployeeName(int? eid) => eid is int id && employeesById.TryGetValue(id, out var e) ? e.FullName : null;

            return new WorkflowRequestDto
            {
                Id = entity.Id,
                RequestCode = entity.RequestCode,
                FormDefinitionId = entity.FormDefinitionId,
                FormDefinitionNameVn = form.NameVn,
                FormRouteId = entity.FormRouteId,
                RouteConditionSnapshot = entity.RouteConditionSnapshot,
                FormVersion = entity.FormVersion,
                DataJson = ParseJsonOrNull(entity.DataJson),
                FormSchemaJson = ParseJsonOrNull(entity.FormSchemaJson),
                Status = entity.Status,
                CurrentStepOrder = entity.CurrentStepOrder,
                CreatedByEmployeeId = entity.CreatedByEmployeeId,
                CreatedByEmployeeName = creator.FullName,
                CreatedByOrgUnitId = entity.CreatedByOrgUnitId,
                CreatedByOrgUnitNameVn = orgUnit?.NameVn,
                CreatedAt = entity.CreatedAt,
                SubmittedAt = entity.SubmittedAt,
                CompletedAt = entity.CompletedAt,
                Steps = steps.Select(s => new WorkflowRequestStepDto
                {
                    Id = s.Id,
                    StepOrder = s.StepOrder,
                    StepNameSnapshot = s.StepNameSnapshot,
                    StepTypeSnapshot = s.StepTypeSnapshot,
                    OrgUnitNameSnapshot = s.OrgUnitNameSnapshot,
                    ApproverModeSnapshot = s.ApproverModeSnapshot,
                    RequireSignatureSnapshot = s.RequireSignatureSnapshot,
                    AllowSendBackSnapshot = s.AllowSendBackSnapshot,
                    AllowAddApproverSnapshot = s.AllowAddApproverSnapshot,
                    Status = s.Status,
                    IsAdHoc = s.IsAdHoc,
                    InsertedByEmployeeId = s.InsertedByEmployeeId,
                    InsertedByEmployeeName = EmployeeName(s.InsertedByEmployeeId),
                    ActedByEmployeeId = s.ActedByEmployeeId,
                    ActedByEmployeeName = EmployeeName(s.ActedByEmployeeId),
                    ActedAt = s.ActedAt,
                    Participants = participants.Where(p => p.WorkflowRequestStepId == s.Id).Select(p => new WorkflowRequestStepParticipantDto
                    {
                        Id = p.Id,
                        EmployeeId = p.EmployeeId,
                        EmployeeFullName = EmployeeName(p.EmployeeId),
                        ParticipantRole = p.ParticipantRole,
                        ResolvedFromJobTitle = p.ResolvedFromJobTitle,
                        ActedAt = p.ActedAt
                    }).ToList()
                }).OrderBy(s => s.StepOrder).ToList(),
                Histories = histories.Select(h => new WorkflowRequestHistoryDto
                {
                    Id = h.Id,
                    StepOrder = h.StepOrder,
                    ActorEmployeeId = h.ActorEmployeeId,
                    ActorNameSnapshot = h.ActorNameSnapshot,
                    OnBehalfOfEmployeeId = h.OnBehalfOfEmployeeId,
                    OnBehalfOfEmployeeName = EmployeeName(h.OnBehalfOfEmployeeId),
                    Action = h.Action,
                    SentBackToStepOrder = h.SentBackToStepOrder,
                    Comment = h.Comment,
                    SignatureImageBase64 = h.SignatureImage is null ? null : Convert.ToBase64String(h.SignatureImage),
                    ActionAt = h.ActionAt
                }).ToList(),
                Attachments = attachments.Select(a => new WorkflowAttachmentDto
                {
                    Id = a.Id,
                    OriginalFileName = a.OriginalFileName,
                    ContentType = a.ContentType,
                    FileSizeBytes = a.FileSizeBytes,
                    UploadedByEmployeeId = a.UploadedByEmployeeId,
                    UploadedByEmployeeName = EmployeeName(a.UploadedByEmployeeId) ?? "",
                    UploadedAt = a.UploadedAt
                }).ToList()
            };
        }

        // Duplicated per Service on purpose: the module doesn't share private helpers across Services.
        private async Task<int> ResolveCurrentEmployeeIdAsync(int? currentUserId)
        {
            if (currentUserId is null)
                throw new DomainException("Không xác định được người dùng hiện tại. Vui lòng đăng nhập lại.");

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserId == currentUserId && !x.IsDeleted);
            if (employee is null)
                throw new DomainException("Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự nào trong Workflow, không thể thực hiện thao tác này.");

            return employee.Id;
        }
    }
}
