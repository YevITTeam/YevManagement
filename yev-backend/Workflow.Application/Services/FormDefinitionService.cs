using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.FormAccesses;
using Workflow.Application.Dtos.FormDefinitions;
using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;
using Workflow.Application.Dtos.FormRoutes;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;
using Workflow.Domain.Enums;

namespace Workflow.Application.Services
{
    public class FormDefinitionService : BaseService<IWorkflowUnitOfWork>, IFormDefinitionService
    {
        public FormDefinitionService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<FormDefinitionDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.FormDefinitions
                .GetQueryable(false, x => x.FormCategory, x => x.CreatedByEmployee, x => x.UpdatedByEmployee!)
                .Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.NameVn.Contains(keyword));
            }

            return await _unitOfWork.FormDefinitions.ToPagedResponseAsync(
                query.OrderByDescending(x => x.CreatedAt),
                pageIndex,
                pageSize,
                x => new FormDefinitionDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    FormCategoryId = x.FormCategoryId,
                    FormCategoryNameVn = x.FormCategory.NameVn,
                    Description = x.Description,
                    Version = x.Version,
                    IsPublished = x.IsPublished,
                    AllowAttachment = x.AllowAttachment,
                    RequireAttachment = x.RequireAttachment,
                    CodePrefix = x.CodePrefix,
                    RouteConditionType = x.RouteConditionType,
                    RouteNumericFieldKey = x.RouteNumericFieldKey,
                    RouteClassFieldKey = x.RouteClassFieldKey,
                    CreatedByEmployeeId = x.CreatedByEmployeeId,
                    CreatedByEmployeeName = x.CreatedByEmployee.FullName,
                    UpdatedByEmployeeId = x.UpdatedByEmployeeId,
                    UpdatedByEmployeeName = x.UpdatedByEmployee != null ? x.UpdatedByEmployee.FullName : null,
                    CreatedAt = x.CreatedAt,
                    UpdatedAt = x.UpdatedAt
                }
            );
        }

        public async Task<FormDefinitionDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.FormDefinitions.FirstOrDefaultAsync(
                x => x.Id == id, x => x.FormCategory, x => x.CreatedByEmployee, x => x.UpdatedByEmployee!))
                .OrThrowNotFound("Form", id);
            return ToDto(entity);
        }

        public async Task<FormDefinitionDto> CreateAsync(CreateFormDefinitionDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            var exists = await _unitOfWork.FormDefinitions.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã form", request.Code, x => x.IsDeleted);

            (await _unitOfWork.FormCategories.GetByIdAsync(request.FormCategoryId)).OrThrowNotFound("Danh mục form", request.FormCategoryId);

            GuardRouteFieldKeys(request.RouteConditionType, request.RouteNumericFieldKey, request.RouteClassFieldKey);

            var now = TimeHelper.GetCurrentUtcTime();
            var entity = new FormDefinition
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                FormCategoryId = request.FormCategoryId,
                Description = request.Description,
                Version = 1,
                IsPublished = false,
                AllowAttachment = request.AllowAttachment,
                RequireAttachment = request.RequireAttachment,
                CodePrefix = request.CodePrefix,
                RouteConditionType = request.RouteConditionType,
                RouteNumericFieldKey = request.RouteNumericFieldKey,
                RouteClassFieldKey = request.RouteClassFieldKey,
                CreatedByEmployeeId = currentEmployeeId,
                UpdatedByEmployeeId = null,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            await _unitOfWork.FormDefinitions.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(entity.Id);
        }

        public async Task UpdateAsync(UpdateFormDefinitionDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            var entity = (await _unitOfWork.FormDefinitions.GetByIdAsync(request.Id)).OrThrowNotFound("Form", request.Id);

            var exists = await _unitOfWork.FormDefinitions.FirstOrDefaultAsync(
                x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã form", request.Code, x => x.IsDeleted);

            (await _unitOfWork.FormCategories.GetByIdAsync(request.FormCategoryId)).OrThrowNotFound("Danh mục form", request.FormCategoryId);

            // RouteConditionType bất biến (workflow-module.md §3.2) — không nằm trong UpdateDto, chỉ
            // re-validate 2 field key theo đúng kiểu đã chốt lúc tạo.
            GuardRouteFieldKeys(entity.RouteConditionType, request.RouteNumericFieldKey, request.RouteClassFieldKey);

            entity.Code = request.Code;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;
            entity.FormCategoryId = request.FormCategoryId;
            entity.Description = request.Description;
            entity.AllowAttachment = request.AllowAttachment;
            entity.RequireAttachment = request.RequireAttachment;
            entity.CodePrefix = request.CodePrefix;
            entity.RouteNumericFieldKey = request.RouteNumericFieldKey;
            entity.RouteClassFieldKey = request.RouteClassFieldKey;
            entity.UpdatedByEmployeeId = currentEmployeeId;
            entity.UpdatedAt = TimeHelper.GetCurrentUtcTime();

            _unitOfWork.FormDefinitions.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.FormDefinitions.GetByIdAsync(id)).OrThrowNotFound("Form", id);

            if (entity.IsPublished)
                throw new DomainException("Không thể xóa form đã publish.");

            entity.IsDeleted = true;

            _unitOfWork.FormDefinitions.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        // LayoutHtml là lớp trình bày thuần tuý (workflow-module.md §1.5) — tách khỏi UpdateAsync để
        // designer "Nhập từ Word" lưu layout độc lập với thông tin cơ bản của form, giống cách
        // fields/conditions/accesses/routes đã có endpoint bulk-replace riêng.
        public async Task<FormDefinitionDto> UpdateLayoutAsync(int formDefinitionId, UpdateFormDefinitionLayoutDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            var entity = (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            entity.LayoutHtml = request.LayoutHtml;
            entity.UpdatedByEmployeeId = currentEmployeeId;
            entity.UpdatedAt = TimeHelper.GetCurrentUtcTime();

            _unitOfWork.FormDefinitions.Update(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(formDefinitionId);
        }

        public async Task<List<FormFieldDto>> GetFieldsAsync(int formDefinitionId)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var query = _unitOfWork.FormFields.GetQueryable(false, x => x.FormDataSource!)
                .Where(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)
                .OrderBy(x => x.SortOrder);

            return await _unitOfWork.FormFields.ToListAsync(query, x => new FormFieldDto
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
        }

        // KHÔNG xoá-tất-tạo-lại như các pattern "replace" khác trong module: FormFieldConditions trỏ
        // Id thẳng vào FormFields (TargetFieldId Cascade / SourceFieldId Restrict, workflow-module.md
        // §3.2) — xoá-tạo-lại sẽ đổi Id liên tục và làm gãy tham chiếu đã cấu hình trước đó. Merge
        // theo Item.Id: có Id + khớp field hiện có -> update tại chỗ; không có Id -> tạo mới; field cũ
        // không còn trong danh sách gửi lên -> xoá (trừ khi đang là SourceFieldId của condition khác).
        public async Task<List<FormFieldDto>> ReplaceFieldsAsync(int formDefinitionId, ReplaceFormFieldsDto request)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var duplicateKey = request.Items
                .GroupBy(x => x.FieldKey, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateKey is not null)
                throw new DomainException($"FieldKey '{duplicateKey.Key}' bị lặp lại trong danh sách gửi lên.");

            foreach (var dataSourceId in request.Items.Where(x => x.FormDataSourceId is not null).Select(x => x.FormDataSourceId!.Value).Distinct())
            {
                (await _unitOfWork.FormDataSources.GetByIdAsync(dataSourceId)).OrThrowNotFound("Nguồn dữ liệu", dataSourceId);
            }

            var existing = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)).ToList();
            var existingById = existing.ToDictionary(x => x.Id);

            var incomingIds = request.Items.Where(x => x.Id is not null).Select(x => x.Id!.Value).ToHashSet();
            foreach (var id in incomingIds)
            {
                if (!existingById.ContainsKey(id))
                    throw new DomainException($"Ô nhập Id={id} không thuộc form này.");
            }

            foreach (var field in existing.Where(x => !incomingIds.Contains(x.Id)))
            {
                var blockingSourceCondition = await _unitOfWork.FormFieldConditions.FirstOrDefaultAsync(
                    c => c.SourceFieldId == field.Id && !c.IsDeleted);
                if (blockingSourceCondition is not null)
                    throw new DomainException($"Không thể xóa ô '{field.LabelVn}' vì đang được 1 điều kiện hiển thị khác dùng làm nguồn giá trị.");

                // Also block when the field is a condition's TARGET — otherwise the FK's DB-level
                // cascade delete would silently remove that condition with no warning to the designer.
                var blockingTargetCondition = await _unitOfWork.FormFieldConditions.FirstOrDefaultAsync(
                    c => c.TargetFieldId == field.Id && !c.IsDeleted);
                if (blockingTargetCondition is not null)
                    throw new DomainException($"Không thể xóa ô '{field.LabelVn}' vì đang là ô đích của 1 điều kiện hiển thị khác.");

                _unitOfWork.FormFields.Delete(field);
            }

            // SortOrder do BE tự gán = vị trí trong mảng gửi lên, không tin SortOrder FE gửi lên —
            // tránh lệch giữa nhiều lần lưu khi FE tính toán sai.
            var sortOrder = 0;
            foreach (var item in request.Items)
            {
                if (item.Id is int existingId && existingById.TryGetValue(existingId, out var entity))
                {
                    entity.FieldKey = item.FieldKey;
                    entity.LabelVn = item.LabelVn;
                    entity.LabelJp = item.LabelJp;
                    entity.DataType = item.DataType;
                    entity.IsRequired = item.IsRequired;
                    entity.SortOrder = sortOrder;
                    entity.ColumnSpan = item.ColumnSpan;
                    entity.Placeholder = item.Placeholder;
                    entity.DefaultValue = item.DefaultValue;
                    entity.OptionsJson = item.OptionsJson;
                    entity.MinValue = item.MinValue;
                    entity.MaxValue = item.MaxValue;
                    entity.MaxLength = item.MaxLength;
                    entity.HelpTextVn = item.HelpTextVn;
                    entity.FormDataSourceId = item.FormDataSourceId;
                    entity.AutoNumberPattern = item.AutoNumberPattern;
                    entity.DefaultVisible = item.DefaultVisible;
                    entity.IsReadOnly = item.IsReadOnly;

                    _unitOfWork.FormFields.Update(entity);
                }
                else
                {
                    await _unitOfWork.FormFields.AddAsync(new FormField
                    {
                        FormDefinitionId = formDefinitionId,
                        FieldKey = item.FieldKey,
                        LabelVn = item.LabelVn,
                        LabelJp = item.LabelJp,
                        DataType = item.DataType,
                        IsRequired = item.IsRequired,
                        SortOrder = sortOrder,
                        ColumnSpan = item.ColumnSpan,
                        Placeholder = item.Placeholder,
                        DefaultValue = item.DefaultValue,
                        OptionsJson = item.OptionsJson,
                        MinValue = item.MinValue,
                        MaxValue = item.MaxValue,
                        MaxLength = item.MaxLength,
                        HelpTextVn = item.HelpTextVn,
                        FormDataSourceId = item.FormDataSourceId,
                        AutoNumberPattern = item.AutoNumberPattern,
                        DefaultVisible = item.DefaultVisible,
                        IsReadOnly = item.IsReadOnly,
                        IsDeleted = false
                    });
                }
                sortOrder++;
            }

            await _unitOfWork.SaveChangesAsync();

            return await GetFieldsAsync(formDefinitionId);
        }

        public async Task<List<FormFieldConditionDto>> GetConditionsAsync(int formDefinitionId)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var query = _unitOfWork.FormFieldConditions.GetQueryable(false, x => x.TargetField, x => x.SourceField)
                .Where(x => !x.IsDeleted && x.TargetField.FormDefinitionId == formDefinitionId)
                .OrderBy(x => x.SortOrder);

            return await _unitOfWork.FormFieldConditions.ToListAsync(query, x => new FormFieldConditionDto
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
        }

        // Không bảng nào tham chiếu Id của FormFieldConditions -> đúng pattern xoá-tất-tạo-lại như
        // FormCategoryCoordinators/EmployeeOrgUnits, khác hẳn ReplaceFieldsAsync ở trên.
        public async Task<List<FormFieldConditionDto>> ReplaceConditionsAsync(int formDefinitionId, ReplaceFormFieldConditionsDto request)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var formFieldIds = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted))
                .Select(x => x.Id)
                .ToHashSet();

            foreach (var item in request.Items)
            {
                if (item.TargetFieldId == item.SourceFieldId)
                    throw new DomainException("Ô bị điều khiển và ô mang giá trị điều kiện không được trùng nhau.");

                if (!formFieldIds.Contains(item.TargetFieldId))
                    throw new DomainException($"Ô Id={item.TargetFieldId} không thuộc form này.");

                if (!formFieldIds.Contains(item.SourceFieldId))
                    throw new DomainException($"Ô Id={item.SourceFieldId} không thuộc form này.");

                GuardCompareValues(item.Operator, item.CompareValue, item.CompareValue2);
            }

            GuardNoCycle(request.Items.Select(x => (Source: x.SourceFieldId, Target: x.TargetFieldId)).ToList());

            var existing = await _unitOfWork.FormFieldConditions.FindWithIncludesAsync(
                x => !x.IsDeleted && x.TargetField.FormDefinitionId == formDefinitionId, x => x.TargetField);
            foreach (var item in existing)
            {
                _unitOfWork.FormFieldConditions.Delete(item);
            }

            var sortOrder = 0;
            foreach (var item in request.Items)
            {
                await _unitOfWork.FormFieldConditions.AddAsync(new FormFieldCondition
                {
                    TargetFieldId = item.TargetFieldId,
                    SourceFieldId = item.SourceFieldId,
                    Operator = item.Operator,
                    CompareValue = item.CompareValue,
                    CompareValue2 = item.CompareValue2,
                    Effect = item.Effect,
                    LogicGroup = item.LogicGroup,
                    SortOrder = sortOrder,
                    IsDeleted = false
                });
                sortOrder++;
            }

            await _unitOfWork.SaveChangesAsync();

            return await GetConditionsAsync(formDefinitionId);
        }

        private static void GuardCompareValues(ConditionOperator op, string? compareValue, string? compareValue2)
        {
            switch (op)
            {
                case ConditionOperator.IsEmpty:
                case ConditionOperator.IsNotEmpty:
                    break;
                case ConditionOperator.Between:
                    if (string.IsNullOrWhiteSpace(compareValue) || string.IsNullOrWhiteSpace(compareValue2))
                        throw new DomainException("Toán tử \"Trong khoảng\" cần đủ cả 2 giá trị so sánh.");
                    break;
                default:
                    if (string.IsNullOrWhiteSpace(compareValue))
                        throw new DomainException("Toán tử này cần giá trị so sánh.");
                    break;
            }
        }

        // Dựng đồ thị cạnh SourceFieldId -> TargetFieldId (workflow-module.md §5.3: "Service PHẢI
        // chặn vòng lặp khi lưu") rồi DFS 3 màu (unvisited/visiting/visited) để phát hiện chu trình.
        // Chạy trên TOÀN BỘ danh sách gửi lên trong 1 lượt lưu, không chỉ từng cặp riêng lẻ — 1 chu
        // trình có thể đi qua nhiều điều kiện khác nhau (A->B->C->A).
        private static void GuardNoCycle(List<(int Source, int Target)> edges)
        {
            var adjacency = edges
                .GroupBy(e => e.Source)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Target).Distinct().ToList());

            var state = new Dictionary<int, int>();

            bool HasCycle(int node)
            {
                state[node] = 1;
                if (adjacency.TryGetValue(node, out var neighbors))
                {
                    foreach (var next in neighbors)
                    {
                        state.TryGetValue(next, out var nextState);
                        if (nextState == 1) return true;
                        if (nextState == 0 && HasCycle(next)) return true;
                    }
                }
                state[node] = 2;
                return false;
            }

            foreach (var node in adjacency.Keys)
            {
                state.TryGetValue(node, out var currentState);
                if (currentState == 0 && HasCycle(node))
                {
                    throw new DomainException(
                        "Cấu hình điều kiện tạo thành vòng lặp (một ô phụ thuộc ngược lại chính nó qua các điều kiện khác) — form sẽ treo khi hiển thị. Vui lòng kiểm tra lại.");
                }
            }
        }

        public async Task<List<FormAccessDto>> GetAccessesAsync(int formDefinitionId)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var items = await _unitOfWork.FormAccesses.FindWithIncludesAsync(
                x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted, x => x.OrgUnit!, x => x.Employee!);

            return items
                .Select(x => new FormAccessDto
                {
                    Id = x.Id,
                    TargetType = x.TargetType,
                    RoleId = x.RoleId,
                    OrgUnitId = x.OrgUnitId,
                    OrgUnitNameVn = x.OrgUnit?.NameVn,
                    EmployeeId = x.EmployeeId,
                    EmployeeFullName = x.Employee?.FullName
                })
                .ToList();
        }

        // Không bảng nào tham chiếu Id của FormAccesses -> xoá-tất-tạo-lại như FormCategoryCoordinators,
        // không phải merge-theo-Id như FormFields (workflow-module.md §3.2).
        public async Task<List<FormAccessDto>> ReplaceAccessesAsync(int formDefinitionId, ReplaceFormAccessesDto request)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            foreach (var item in request.Items)
            {
                GuardExactlyOneTarget(item.TargetType, item.RoleId, item.OrgUnitId, item.EmployeeId);

                if (item.OrgUnitId is not null)
                    (await _unitOfWork.OrgUnits.GetByIdAsync(item.OrgUnitId.Value)).OrThrowNotFound("Đơn vị tổ chức", item.OrgUnitId.Value);

                if (item.EmployeeId is not null)
                    (await _unitOfWork.Employees.GetByIdAsync(item.EmployeeId.Value)).OrThrowNotFound("Nhân sự", item.EmployeeId.Value);
            }

            var existing = await _unitOfWork.FormAccesses.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted);
            foreach (var item in existing)
            {
                _unitOfWork.FormAccesses.Delete(item);
            }

            var newItems = request.Items
                .Select(item => new FormAccess
                {
                    FormDefinitionId = formDefinitionId,
                    TargetType = item.TargetType,
                    RoleId = item.RoleId,
                    OrgUnitId = item.OrgUnitId,
                    EmployeeId = item.EmployeeId,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.FormAccesses.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            return await GetAccessesAsync(formDefinitionId);
        }

        private static void GuardExactlyOneTarget(AccessTargetType targetType, int? roleId, int? orgUnitId, int? employeeId)
        {
            var filledCount = new[] { roleId is not null, orgUnitId is not null, employeeId is not null }.Count(x => x);
            if (filledCount != 1)
                throw new DomainException("Mỗi dòng phân quyền tạo đơn phải có đúng 1 đối tượng đích (Role / Đơn vị / Nhân sự).");

            var matchesTargetType = targetType switch
            {
                AccessTargetType.Role => roleId is not null,
                AccessTargetType.OrgUnit => orgUnitId is not null,
                AccessTargetType.Employee => employeeId is not null,
                _ => false
            };
            if (!matchesTargetType)
                throw new DomainException("Loại đối tượng (TargetType) không khớp với cột đích được điền.");
        }

        public async Task<List<FormRouteDto>> GetRoutesAsync(int formDefinitionId)
        {
            (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var query = _unitOfWork.FormRoutes.GetQueryable(false)
                .Where(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)
                .OrderBy(x => x.SortOrder);

            return await _unitOfWork.FormRoutes.ToListAsync(query, x => new FormRouteDto
            {
                Id = x.Id,
                NameVn = x.NameVn,
                NameJp = x.NameJp,
                SortOrder = x.SortOrder,
                MinValue = x.MinValue,
                MaxValue = x.MaxValue,
                ClassValue = x.ClassValue,
                IsDefault = x.IsDefault,
                Steps = x.FormApprovalSteps
                    .Where(s => !s.IsDeleted)
                    .OrderBy(s => s.StepOrder)
                    .Select(s => new FormApprovalStepDto
                    {
                        Id = s.Id,
                        StepOrder = s.StepOrder,
                        NameVn = s.NameVn,
                        NameJp = s.NameJp,
                        StepType = s.StepType,
                        OrgUnitScope = s.OrgUnitScope,
                        OrgUnitId = s.OrgUnitId,
                        OrgUnitNameVn = s.OrgUnit != null ? s.OrgUnit.NameVn : null,
                        ApproverMode = s.ApproverMode,
                        RequireSignature = s.RequireSignature,
                        AllowSendBack = s.AllowSendBack,
                        AllowAddApprover = s.AllowAddApprover,
                        Participants = s.FormApprovalStepParticipants
                            .Where(p => !p.IsDeleted)
                            .OrderBy(p => p.SortOrder)
                            .Select(p => new FormApprovalStepParticipantDto
                            {
                                Id = p.Id,
                                ParticipantSource = p.ParticipantSource,
                                EmployeeId = p.EmployeeId,
                                EmployeeFullName = p.Employee != null ? p.Employee.FullName : null,
                                JobTitleId = p.JobTitleId,
                                JobTitleNameVn = p.JobTitle != null ? p.JobTitle.NameVn : null,
                                ParticipantRole = p.ParticipantRole,
                                SortOrder = p.SortOrder
                            })
                            .ToList()
                    })
                    .ToList()
            });
        }

        // Merge FormRoutes theo Id (như FormFields ở Pha 2C) vì WorkflowRequests.FormRouteId (Pha 3B)
        // sẽ là FK thật Restrict trỏ vào đây — route đã dùng bởi 1 đơn thật không được đổi Id.
        // FormApprovalSteps/FormApprovalStepParticipants thì luôn xoá-tất-tạo-lại (không bảng nào
        // tham chiếu Id của chúng — WorkflowRequestSteps chỉ snapshot GIÁ TRỊ, không FK ngược).
        public async Task<ReplaceFormRoutesResultDto> ReplaceRoutesAsync(int formDefinitionId, ReplaceFormRoutesDto request)
        {
            var form = (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            GuardRouteStructure(form.RouteConditionType, request.Items);

            foreach (var routeItem in request.Items)
            {
                GuardRouteFields(form.RouteConditionType, routeItem);

                if (routeItem.Steps.Count == 0)
                    throw new DomainException($"Nhánh '{routeItem.NameVn}' phải có ít nhất 1 bước duyệt.");

                foreach (var stepItem in routeItem.Steps)
                {
                    await GuardStepAsync(stepItem);
                }

                await GuardOrgLevelChainAsync(routeItem.NameVn, routeItem.Steps);
            }

            var duplicateClassValue = request.Items
                .Where(x => !string.IsNullOrWhiteSpace(x.ClassValue))
                .GroupBy(x => x.ClassValue, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateClassValue is not null)
                throw new DomainException($"Giá trị phân loại '{duplicateClassValue.Key}' bị lặp lại giữa các nhánh.");

            var existing = (await _unitOfWork.FormRoutes.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)).ToList();
            var existingById = existing.ToDictionary(x => x.Id);

            var incomingIds = request.Items.Where(x => x.Id is not null).Select(x => x.Id!.Value).ToHashSet();
            foreach (var id in incomingIds)
            {
                if (!existingById.ContainsKey(id))
                    throw new DomainException($"Nhánh Id={id} không thuộc form này.");
            }

            foreach (var route in existing.Where(x => !incomingIds.Contains(x.Id)))
            {
                // Guard bổ sung ở Pha 3B-1 (đúng chỗ TODO đã đánh dấu từ Pha 3A) — WorkflowRequests giờ
                // đã tồn tại, chặn xoá route còn đơn thật đang tham chiếu FormRouteId.
                var inUse = await _unitOfWork.WorkflowRequests.FirstOrDefaultAsync(x => x.FormRouteId == route.Id);
                if (inUse is not null)
                    throw new DomainException($"Không thể xóa nhánh '{route.NameVn}' vì đang có đơn tham chiếu tới nhánh này.");

                _unitOfWork.FormRoutes.Delete(route);
            }

            var sortOrder = 0;
            foreach (var item in request.Items)
            {
                if (item.Id is int existingId && existingById.TryGetValue(existingId, out var routeEntity))
                {
                    routeEntity.NameVn = item.NameVn;
                    routeEntity.NameJp = item.NameJp;
                    routeEntity.SortOrder = sortOrder;
                    routeEntity.MinValue = item.MinValue;
                    routeEntity.MaxValue = item.MaxValue;
                    routeEntity.ClassValue = item.ClassValue;
                    routeEntity.IsDefault = item.IsDefault;
                    _unitOfWork.FormRoutes.Update(routeEntity);

                    var oldSteps = await _unitOfWork.FormApprovalSteps.FindAsync(s => s.FormRouteId == routeEntity.Id);
                    foreach (var oldStep in oldSteps)
                    {
                        _unitOfWork.FormApprovalSteps.Delete(oldStep);
                    }

                    var newSteps = BuildStepEntities(item.Steps);
                    foreach (var step in newSteps)
                    {
                        step.FormRouteId = routeEntity.Id;
                    }
                    await _unitOfWork.FormApprovalSteps.AddRangeAsync(newSteps);
                }
                else
                {
                    var newRoute = new FormRoute
                    {
                        FormDefinitionId = formDefinitionId,
                        NameVn = item.NameVn,
                        NameJp = item.NameJp,
                        SortOrder = sortOrder,
                        MinValue = item.MinValue,
                        MaxValue = item.MaxValue,
                        ClassValue = item.ClassValue,
                        IsDefault = item.IsDefault,
                        IsDeleted = false,
                        FormApprovalSteps = BuildStepEntities(item.Steps)
                    };
                    await _unitOfWork.FormRoutes.AddAsync(newRoute);
                }
                sortOrder++;
            }

            await _unitOfWork.SaveChangesAsync();

            var warning = form.RouteConditionType is RouteConditionType.NumericRange or RouteConditionType.Both
                ? BuildNumericRangeWarning(request.Items)
                : null;

            return new ReplaceFormRoutesResultDto
            {
                Routes = await GetRoutesAsync(formDefinitionId),
                Warning = warning
            };
        }

        private static List<FormApprovalStep> BuildStepEntities(List<ReplaceFormApprovalStepItemDto> stepItems)
        {
            var stepOrder = 0;
            var result = new List<FormApprovalStep>();
            foreach (var stepItem in stepItems)
            {
                var participantOrder = 0;
                var step = new FormApprovalStep
                {
                    StepOrder = stepOrder,
                    NameVn = stepItem.NameVn,
                    NameJp = stepItem.NameJp,
                    StepType = stepItem.StepType,
                    OrgUnitScope = stepItem.OrgUnitScope,
                    OrgUnitId = stepItem.OrgUnitId,
                    ApproverMode = stepItem.ApproverMode,
                    RequireSignature = stepItem.RequireSignature,
                    AllowSendBack = stepItem.AllowSendBack,
                    AllowAddApprover = stepItem.AllowAddApprover,
                    IsDeleted = false,
                    FormApprovalStepParticipants = stepItem.Participants.Select(p => new FormApprovalStepParticipant
                    {
                        ParticipantSource = p.ParticipantSource,
                        EmployeeId = p.EmployeeId,
                        JobTitleId = p.JobTitleId,
                        ParticipantRole = p.ParticipantRole,
                        SortOrder = participantOrder++,
                        IsDeleted = false
                    }).ToList()
                };
                result.Add(step);
                stepOrder++;
            }
            return result;
        }

        // RouteConditionType = None không có khái niệm "thêm nhánh sau" — cấu trúc chỉ có đúng 1
        // nhánh, và nhánh đó bắt buộc IsDefault (workflow-module.md §5.2). Mọi kiểu khác chỉ chặn
        // "quá nhiều IsDefault", KHÔNG bắt buộc phải CÓ IsDefault lúc lưu — "không có nhánh mặc định"
        // là luật lúc NỘP đơn (Pha 3B), không phải điều kiện để lưu cấu hình.
        private static void GuardRouteStructure(RouteConditionType routeConditionType, List<ReplaceFormRouteItemDto> items)
        {
            if (routeConditionType == RouteConditionType.None)
            {
                if (items.Count != 1 || !items[0].IsDefault)
                    throw new DomainException("Kiểu điều kiện rẽ nhánh \"Không rẽ nhánh\" yêu cầu đúng 1 nhánh duy nhất và nhánh đó phải là nhánh mặc định.");
            }

            var defaultCount = items.Count(x => x.IsDefault);
            if (defaultCount > 1)
                throw new DomainException("Chỉ được có tối đa 1 nhánh mặc định.");
        }

        // Nhánh IsDefault=true là nhánh DỰ PHÒNG dùng khi không khớp nhánh nào khác (§5.2) — không cần
        // tự có Min/Max/ClassValue riêng, nên miễn 2 luật bắt buộc dưới đây cho nhánh mặc định.
        private static void GuardRouteFields(RouteConditionType routeConditionType, ReplaceFormRouteItemDto route)
        {
            if (route.IsDefault)
                return;

            if (routeConditionType is RouteConditionType.NumericRange or RouteConditionType.Both)
            {
                if (route.MinValue is null && route.MaxValue is null)
                    throw new DomainException($"Nhánh '{route.NameVn}' cần ít nhất giá trị nhỏ nhất hoặc lớn nhất (khoảng số).");
            }

            if (routeConditionType is RouteConditionType.ClassValue or RouteConditionType.Both)
            {
                if (string.IsNullOrWhiteSpace(route.ClassValue))
                    throw new DomainException($"Nhánh '{route.NameVn}' cần giá trị phân loại.");
            }
        }

        private async Task GuardStepAsync(ReplaceFormApprovalStepItemDto step)
        {
            if (step.OrgUnitScope == OrgUnitScope.Fixed)
            {
                if (step.OrgUnitId is null)
                    throw new DomainException($"Bước '{step.NameVn}' dùng phạm vi đơn vị cố định phải chọn đơn vị tổ chức.");
                (await _unitOfWork.OrgUnits.GetByIdAsync(step.OrgUnitId.Value)).OrThrowNotFound("Đơn vị tổ chức", step.OrgUnitId.Value);
            }
            else if (step.OrgUnitId is not null)
            {
                throw new DomainException($"Bước '{step.NameVn}' dùng phạm vi đơn vị theo người nộp thì không được chọn đơn vị cố định.");
            }

            if (!step.Participants.Any(p => p.ParticipantRole == ParticipantRole.Approver))
                throw new DomainException($"Bước '{step.NameVn}' phải có ít nhất 1 người duyệt (Approver).");

            var seen = new HashSet<(int Kind, int Id)>();
            foreach (var participant in step.Participants)
            {
                GuardParticipantTarget(participant.ParticipantSource, participant.EmployeeId, participant.JobTitleId);

                if (participant.EmployeeId is not null)
                {
                    var employee = (await _unitOfWork.Employees.GetByIdAsync(participant.EmployeeId.Value)).OrThrowNotFound("Nhân sự", participant.EmployeeId.Value);
                    if (participant.ParticipantRole == ParticipantRole.Approver && employee.UserId is null)
                        throw new DomainException($"Nhân sự '{employee.FullName}' chưa liên kết tài khoản đăng nhập, không thể làm người duyệt.");

                    if (!seen.Add((1, participant.EmployeeId.Value)))
                        throw new DomainException($"Bước '{step.NameVn}' có nhân sự bị lặp lại trong danh sách người duyệt.");
                }
                else if (participant.JobTitleId is not null)
                {
                    var jobTitle = (await _unitOfWork.JobTitles.GetByIdAsync(participant.JobTitleId.Value)).OrThrowNotFound("Chức danh", participant.JobTitleId.Value);

                    // Chức danh phổ thông (IsUniquePerOrgUnit=false) có thể nhiều người cùng giữ tại 1
                    // đơn vị — ResolveStepParticipantsAsync chỉ lấy 1 người bất kỳ (FirstOrDefault),
                    // route sẽ không xác định. Chặn dùng làm mốc Approver, Viewer vẫn cho phép (chỉ để
                    // hiển thị, không cần xác định). Chốt 2026-08-26, workflow-module.md §10.
                    if (participant.ParticipantRole == ParticipantRole.Approver && !jobTitle.IsUniquePerOrgUnit)
                        throw new DomainException($"Bước '{step.NameVn}': chức danh '{jobTitle.NameVn}' là chức danh phổ thông (nhiều người cùng giữ), không dùng làm người duyệt được — chỉ chức danh duy nhất/đơn vị (vd Trưởng phòng) mới route đúng.");

                    if (!seen.Add((2, participant.JobTitleId.Value)))
                        throw new DomainException($"Bước '{step.NameVn}' có chức danh bị lặp lại trong danh sách người duyệt.");
                }
            }
        }

        // "Duyệt đủ cấp tổ chức" (workflow-module.md §5.x, chốt 2026-08-29) — KHÔNG phải suy luận
        // runtime (§1.6 vẫn giữ nguyên, ResolveStepParticipantsAsync §5.5 không đổi gì): đây thuần là
        // ràng buộc lúc LƯU cấu hình route. Chỉ xét bước OrgUnitScope=Fixed (có OrgUnitId cụ thể ngay
        // lúc thiết kế) — bước ApplicantUnit không có đơn vị xác định trước khi nộp đơn nên bỏ qua.
        // Nếu route có ≥2 bước Fixed nằm trên CÙNG 1 nhánh cha-con của cây tổ chức, bắt buộc đủ bước
        // cho MỌI đơn vị tổ tiên nằm giữa 2 đầu, và thứ tự bước phải tăng dần từ đơn vị sâu (cấp thấp)
        // lên đơn vị cao. 2 bước Fixed KHÔNG có quan hệ tổ tiên-con cháu (vd 2 phòng ban duyệt song
        // song) bị bỏ qua — không phải lỗi cấu hình.
        private async Task GuardOrgLevelChainAsync(string routeName, List<ReplaceFormApprovalStepItemDto> steps)
        {
            var fixedSteps = steps
                .Select((s, index) => (Step: s, Index: index))
                .Where(x => x.Step.OrgUnitScope == OrgUnitScope.Fixed && x.Step.OrgUnitId is not null)
                .ToList();

            if (fixedSteps.Count < 2)
                return;

            var allUnits = (await _unitOfWork.OrgUnits.SelectAsync(
                x => !x.IsDeleted,
                x => new { x.Id, x.ParentId, x.OrgLevelId, x.NameVn })).ToDictionary(x => x.Id);
            var allLevels = (await _unitOfWork.OrgLevels.SelectAsync(
                x => !x.IsDeleted,
                x => new { x.Id, x.LevelNumber })).ToDictionary(x => x.Id);

            var deepest = fixedSteps
                .OrderByDescending(x => allLevels[allUnits[x.Step.OrgUnitId!.Value].OrgLevelId].LevelNumber)
                .First();

            var chainUnitIds = new List<int>();
            int? cursor = deepest.Step.OrgUnitId!.Value;
            var guard = 0;
            while (cursor is not null && guard++ < 50)
            {
                chainUnitIds.Add(cursor.Value);
                cursor = allUnits[cursor.Value].ParentId;
            }

            var otherFixedOnChain = fixedSteps
                .Where(x => x.Index != deepest.Index && chainUnitIds.Contains(x.Step.OrgUnitId!.Value))
                .ToList();
            if (otherFixedOnChain.Count == 0)
                return;

            var topOnChain = otherFixedOnChain
                .OrderBy(x => allLevels[allUnits[x.Step.OrgUnitId!.Value].OrgLevelId].LevelNumber)
                .First();

            var deepPos = chainUnitIds.IndexOf(deepest.Step.OrgUnitId!.Value);
            var topPos = chainUnitIds.IndexOf(topOnChain.Step.OrgUnitId!.Value);
            var requiredChain = chainUnitIds.Skip(deepPos).Take(topPos - deepPos + 1).ToList();

            var fixedUnitIdsInRoute = fixedSteps.Select(x => x.Step.OrgUnitId!.Value).ToHashSet();
            var missing = requiredChain.Where(id => !fixedUnitIdsInRoute.Contains(id)).ToList();
            if (missing.Count > 0)
            {
                var missingNames = string.Join(", ", missing.Select(id => $"'{allUnits[id].NameVn}'"));
                throw new DomainException(
                    $"Nhánh '{routeName}': đã chọn duyệt tới cấp '{allUnits[topOnChain.Step.OrgUnitId!.Value].NameVn}' " +
                    $"nhưng còn thiếu bước duyệt ở (các) đơn vị trung gian: {missingNames}. Phải duyệt đủ từng cấp từ " +
                    $"'{allUnits[deepest.Step.OrgUnitId!.Value].NameVn}' lên tới " +
                    $"'{allUnits[topOnChain.Step.OrgUnitId!.Value].NameVn}', không được bỏ qua cấp nào.");
            }

            var stepIndexByUnitId = fixedSteps.ToDictionary(x => x.Step.OrgUnitId!.Value, x => x.Index);
            for (var i = 0; i + 1 < requiredChain.Count; i++)
            {
                var lowerIndex = stepIndexByUnitId[requiredChain[i]];
                var upperIndex = stepIndexByUnitId[requiredChain[i + 1]];
                if (lowerIndex >= upperIndex)
                {
                    throw new DomainException(
                        $"Nhánh '{routeName}': bước duyệt của đơn vị '{allUnits[requiredChain[i]].NameVn}' phải đứng " +
                        $"TRƯỚC bước duyệt của đơn vị cấp trên '{allUnits[requiredChain[i + 1]].NameVn}' (duyệt từ dưới lên).");
                }
            }
        }

        private static void GuardParticipantTarget(ParticipantSource source, int? employeeId, int? jobTitleId)
        {
            var filledCount = new[] { employeeId is not null, jobTitleId is not null }.Count(x => x);
            if (filledCount != 1)
                throw new DomainException("Mỗi người duyệt/xem phải có đúng 1 đối tượng đích (Nhân sự hoặc Chức danh).");

            var matchesSource = source switch
            {
                ParticipantSource.Employee => employeeId is not null,
                ParticipantSource.JobTitle => jobTitleId is not null,
                _ => false
            };
            if (!matchesSource)
                throw new DomainException("Nguồn người duyệt (ParticipantSource) không khớp với cột đích được điền.");
        }

        // Cảnh báo KHÔNG chặn lưu (workflow-module.md §5.2: "cảnh báo nếu các khoảng chồng nhau hoặc
        // để hở") — chỉ xét route có Min/Max, bỏ qua route IsDefault (đó là nhánh dự phòng, không
        // tham gia so khớp khoảng). Khớp đúng luật resolve ở §5.2: MinValue <= v < MaxValue.
        private static string? BuildNumericRangeWarning(List<ReplaceFormRouteItemDto> items)
        {
            var ranges = items
                .Where(x => !x.IsDefault && (x.MinValue is not null || x.MaxValue is not null))
                .Select(x => (Name: x.NameVn, Min: x.MinValue ?? decimal.MinValue, Max: x.MaxValue ?? decimal.MaxValue))
                .OrderBy(x => x.Min)
                .ToList();

            var warnings = new List<string>();
            for (var i = 0; i < ranges.Count; i++)
            {
                for (var j = i + 1; j < ranges.Count; j++)
                {
                    if (ranges[i].Max > ranges[j].Min)
                        warnings.Add($"khoảng nhánh '{ranges[i].Name}' và '{ranges[j].Name}' chồng nhau");
                }
            }
            for (var i = 0; i + 1 < ranges.Count; i++)
            {
                if (ranges[i].Max < ranges[i + 1].Min)
                    warnings.Add($"để hở giữa nhánh '{ranges[i].Name}' và '{ranges[i + 1].Name}'");
            }

            return warnings.Count > 0 ? $"Cảnh báo cấu hình khoảng số: {string.Join("; ", warnings)}." : null;
        }

        // Version chỉ tăng khi PUBLISH LẠI (đã publish từ trước, gọi lần nữa sau khi sửa cấu hình) —
        // lần publish đầu tiên giữ nguyên Version=1 mặc định (workflow-module.md §3.2: "tăng mỗi lần
        // publish lại"). Không có endpoint unpublish trong roadmap nên "gọi /publish khi đã publish"
        // luôn có nghĩa là "vừa sửa xong, publish lại".
        public async Task<FormDefinitionDto> PublishAsync(int formDefinitionId, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            var entity = (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var hasAnyField = await _unitOfWork.FormFields.FirstOrDefaultAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted);
            if (hasAnyField is null)
                throw new DomainException("Form chưa có ô nhập nào, không thể publish.");

            // ReplaceRoutesAsync guarantees every saved route already has >=1 step, so checking route
            // existence here is enough to prevent publishing a form no submission could ever route.
            var hasAnyRoute = await _unitOfWork.FormRoutes.FirstOrDefaultAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted);
            if (hasAnyRoute is null)
                throw new DomainException("Form chưa cấu hình nhánh duyệt nào, không thể publish.");

            if (entity.IsPublished)
                entity.Version += 1;
            else
                entity.IsPublished = true;

            entity.UpdatedByEmployeeId = currentEmployeeId;
            entity.UpdatedAt = TimeHelper.GetCurrentUtcTime();

            _unitOfWork.FormDefinitions.Update(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(formDefinitionId);
        }

        // Copies FormFields + FormFieldConditions + FormRoutes/FormApprovalSteps/
        // FormApprovalStepParticipants into a brand-new FormDefinition. Does NOT copy FormAccesses
        // (§3.2, see CloneFormDefinitionDto) — access is configured per form, never inherited.
        // Needs several intermediate SaveChangesAsync calls to get real Ids for the new route/step/
        // field before creating their children; a mid-way failure leaves orphaned rows under clone.Id,
        // but since that's a fresh unpublished form, the admin can just delete it and retry.
        public async Task<FormDefinitionDto> CloneAsync(int formDefinitionId, CloneFormDefinitionDto request, int? currentUserId)
        {
            var currentEmployeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);

            var source = (await _unitOfWork.FormDefinitions.GetByIdAsync(formDefinitionId)).OrThrowNotFound("Form", formDefinitionId);

            var exists = await _unitOfWork.FormDefinitions.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã form", request.Code, x => x.IsDeleted);

            var now = TimeHelper.GetCurrentUtcTime();
            var clone = new FormDefinition
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                FormCategoryId = source.FormCategoryId,
                Description = source.Description,
                Version = 1,
                IsPublished = false,
                AllowAttachment = source.AllowAttachment,
                RequireAttachment = source.RequireAttachment,
                CodePrefix = source.CodePrefix,
                RouteConditionType = source.RouteConditionType,
                RouteNumericFieldKey = source.RouteNumericFieldKey,
                RouteClassFieldKey = source.RouteClassFieldKey,
                LayoutHtml = source.LayoutHtml,
                CreatedByEmployeeId = currentEmployeeId,
                UpdatedByEmployeeId = null,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            await _unitOfWork.FormDefinitions.AddAsync(clone);
            await _unitOfWork.SaveChangesAsync(); // cần clone.Id thật trước khi tạo FormFields con

            var sourceFields = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted)).ToList();

            foreach (var field in sourceFields)
            {
                var newField = new FormField
                {
                    FormDefinitionId = clone.Id,
                    FieldKey = field.FieldKey,
                    LabelVn = field.LabelVn,
                    LabelJp = field.LabelJp,
                    DataType = field.DataType,
                    IsRequired = field.IsRequired,
                    SortOrder = field.SortOrder,
                    ColumnSpan = field.ColumnSpan,
                    Placeholder = field.Placeholder,
                    DefaultValue = field.DefaultValue,
                    OptionsJson = field.OptionsJson,
                    MinValue = field.MinValue,
                    MaxValue = field.MaxValue,
                    MaxLength = field.MaxLength,
                    HelpTextVn = field.HelpTextVn,
                    FormDataSourceId = field.FormDataSourceId,
                    AutoNumberPattern = field.AutoNumberPattern,
                    DefaultVisible = field.DefaultVisible,
                    IsReadOnly = field.IsReadOnly,
                    IsDeleted = false
                };
                await _unitOfWork.FormFields.AddAsync(newField);
            }

            // FieldKey là UNIQUE (FormDefinitionId, FieldKey) nên dùng làm khoá remap Source/Target
            // sang Id mới thay vì phải giữ tham chiếu object EF (an toàn hơn qua nhiều lần SaveChanges).
            await _unitOfWork.SaveChangesAsync(); // cần Id thật của FormFields mới trước khi remap FormFieldConditions

            var newFields = (await _unitOfWork.FormFields.FindAsync(x => x.FormDefinitionId == clone.Id && !x.IsDeleted)).ToList();
            var keyToNewId = newFields.ToDictionary(x => x.FieldKey, x => x.Id, StringComparer.OrdinalIgnoreCase);
            var keyBySourceId = sourceFields.ToDictionary(x => x.Id, x => x.FieldKey);

            var sourceFieldIds = sourceFields.Select(x => x.Id).ToList();
            var sourceConditions = await _unitOfWork.FormFieldConditions.FindAsync(
                x => !x.IsDeleted && sourceFieldIds.Contains(x.TargetFieldId));

            foreach (var condition in sourceConditions)
            {
                if (!keyBySourceId.TryGetValue(condition.TargetFieldId, out var targetKey) ||
                    !keyBySourceId.TryGetValue(condition.SourceFieldId, out var sourceKey) ||
                    !keyToNewId.TryGetValue(targetKey, out var newTargetId) ||
                    !keyToNewId.TryGetValue(sourceKey, out var newSourceId))
                {
                    continue;
                }

                await _unitOfWork.FormFieldConditions.AddAsync(new FormFieldCondition
                {
                    TargetFieldId = newTargetId,
                    SourceFieldId = newSourceId,
                    Operator = condition.Operator,
                    CompareValue = condition.CompareValue,
                    CompareValue2 = condition.CompareValue2,
                    Effect = condition.Effect,
                    LogicGroup = condition.LogicGroup,
                    SortOrder = condition.SortOrder,
                    IsDeleted = false
                });
            }

            // Copy FormRoutes + FormApprovalSteps + FormApprovalStepParticipants so the clone can
            // actually be published and routed, not just look complete.
            var sourceRoutes = (await _unitOfWork.FormRoutes.FindAsync(x => x.FormDefinitionId == formDefinitionId && !x.IsDeleted))
                .OrderBy(x => x.SortOrder).ToList();
            foreach (var route in sourceRoutes)
            {
                var newRoute = new FormRoute
                {
                    FormDefinitionId = clone.Id,
                    NameVn = route.NameVn,
                    NameJp = route.NameJp,
                    SortOrder = route.SortOrder,
                    MinValue = route.MinValue,
                    MaxValue = route.MaxValue,
                    ClassValue = route.ClassValue,
                    IsDefault = route.IsDefault,
                    IsDeleted = false
                };
                await _unitOfWork.FormRoutes.AddAsync(newRoute);
                await _unitOfWork.SaveChangesAsync(); // need newRoute.Id before creating its steps

                var sourceSteps = (await _unitOfWork.FormApprovalSteps.FindAsync(s => s.FormRouteId == route.Id))
                    .OrderBy(s => s.StepOrder).ToList();
                foreach (var step in sourceSteps)
                {
                    var newStep = new FormApprovalStep
                    {
                        FormRouteId = newRoute.Id,
                        StepOrder = step.StepOrder,
                        NameVn = step.NameVn,
                        NameJp = step.NameJp,
                        StepType = step.StepType,
                        OrgUnitScope = step.OrgUnitScope,
                        OrgUnitId = step.OrgUnitId,
                        ApproverMode = step.ApproverMode,
                        RequireSignature = step.RequireSignature,
                        AllowSendBack = step.AllowSendBack,
                        AllowAddApprover = step.AllowAddApprover,
                        IsDeleted = false
                    };
                    await _unitOfWork.FormApprovalSteps.AddAsync(newStep);
                    await _unitOfWork.SaveChangesAsync(); // need newStep.Id before creating its participants

                    var sourceParticipants = await _unitOfWork.FormApprovalStepParticipants.FindAsync(p => p.FormApprovalStepId == step.Id);
                    foreach (var participant in sourceParticipants)
                    {
                        await _unitOfWork.FormApprovalStepParticipants.AddAsync(new FormApprovalStepParticipant
                        {
                            FormApprovalStepId = newStep.Id,
                            ParticipantSource = participant.ParticipantSource,
                            EmployeeId = participant.EmployeeId,
                            JobTitleId = participant.JobTitleId,
                            ParticipantRole = participant.ParticipantRole,
                            SortOrder = participant.SortOrder,
                            IsDeleted = false
                        });
                    }
                }
            }

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(clone.Id);
        }

        // Employees.UserId -> Identity.Users.Id là điểm neo cross-DB duy nhất (workflow-module.md
        // §1.4) — nếu tài khoản đang đăng nhập chưa được gán vào bất kỳ hồ sơ Employee nào thì không
        // có CreatedByEmployeeId hợp lệ để ghi, phải chặn ngay chứ không ghi tạm bằng giá trị giả.
        private async Task<int> ResolveCurrentEmployeeIdAsync(int? currentUserId)
        {
            if (currentUserId is null)
                throw new DomainException("Không xác định được người dùng hiện tại. Vui lòng đăng nhập lại.");

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserId == currentUserId && !x.IsDeleted);
            if (employee is null)
                throw new DomainException("Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự nào trong Workflow, không thể thực hiện thao tác này.");

            return employee.Id;
        }

        // FormFields chưa scaffold ở Pha 2B (workflow-module.md §8 Pha 2C) nên chưa thể xác thực
        // RouteNumericFieldKey/RouteClassFieldKey trỏ đúng vào 1 FieldKey thật — chỉ validate ở mức
        // "có nhập hay chưa" theo đúng RouteConditionType đã chọn. Nâng cấp thành picker thật khi có
        // FormFields.
        private static void GuardRouteFieldKeys(RouteConditionType type, string? numericFieldKey, string? classFieldKey)
        {
            if ((type == RouteConditionType.NumericRange || type == RouteConditionType.Both) && string.IsNullOrWhiteSpace(numericFieldKey))
                throw new DomainException("Kiểu điều kiện rẽ nhánh này yêu cầu chọn ô mang giá trị số.");

            if ((type == RouteConditionType.ClassValue || type == RouteConditionType.Both) && string.IsNullOrWhiteSpace(classFieldKey))
                throw new DomainException("Kiểu điều kiện rẽ nhánh này yêu cầu chọn ô mang giá trị phân loại.");
        }

        private static FormDefinitionDto ToDto(FormDefinition x) => new()
        {
            Id = x.Id,
            Code = x.Code,
            NameVn = x.NameVn,
            NameJp = x.NameJp,
            FormCategoryId = x.FormCategoryId,
            FormCategoryNameVn = x.FormCategory?.NameVn ?? "",
            Description = x.Description,
            Version = x.Version,
            IsPublished = x.IsPublished,
            AllowAttachment = x.AllowAttachment,
            RequireAttachment = x.RequireAttachment,
            CodePrefix = x.CodePrefix,
            RouteConditionType = x.RouteConditionType,
            RouteNumericFieldKey = x.RouteNumericFieldKey,
            RouteClassFieldKey = x.RouteClassFieldKey,
            LayoutHtml = x.LayoutHtml,
            CreatedByEmployeeId = x.CreatedByEmployeeId,
            CreatedByEmployeeName = x.CreatedByEmployee?.FullName ?? "",
            UpdatedByEmployeeId = x.UpdatedByEmployeeId,
            UpdatedByEmployeeName = x.UpdatedByEmployee?.FullName,
            CreatedAt = x.CreatedAt,
            UpdatedAt = x.UpdatedAt
        };
    }
}
