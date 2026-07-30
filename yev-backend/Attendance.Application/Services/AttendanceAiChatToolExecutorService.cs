using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Attendance.Application.Dtos.AiChat;
using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;

namespace Attendance.Application.Services
{
    // Implements the 6 read-only lookup tools + 1 write tool from
    // docs/docs-be/attendance-aichat-be-huong-dan.md §5 by calling straight into the existing
    // Attendance Application services — no repository access of its own, no duplicated business rules.
    // The only write path (create_ot_form_draft) calls the exact same IOtFormService.CreateAsync the
    // manual "Tạo đơn tăng ca" screen uses, so every validation rule there (scope check, employee/group
    // match, EndTime bounds...) applies identically regardless of who/what calls it.
    public class AttendanceAiChatToolExecutorService : IAttendanceAiChatToolExecutorService
    {
        // Master-data lists here (Department/Group/Reason/OtCase) are naturally small; Employee lists
        // per Group can be bigger than Asset's per-tool cap, so this is a bit more generous than
        // Asset's MaxResults=10.
        private const int MaxResults = 30;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            // Same reasoning as Asset's AiChatToolExecutorService: the default encoder escapes all
            // non-ASCII as \uXXXX, which a small local model then mimics literally in its own free
            // text afterwards (Vietnamese diacritics showing up as raw escape codes on the FE). This
            // JSON only ever becomes a "tool" message's plain-text content sent back to Ollama, never
            // embedded in HTML, so the extra escaping protection is pure downside here.
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        private readonly IDepartmentService _departmentService;
        private readonly IGroupService _groupService;
        private readonly IReasonService _reasonService;
        private readonly IOtCaseService _otCaseService;
        private readonly IEmployeeService _employeeService;
        private readonly IOtFormService _otFormService;

        public AttendanceAiChatToolExecutorService(
            IDepartmentService departmentService,
            IGroupService groupService,
            IReasonService reasonService,
            IOtCaseService otCaseService,
            IEmployeeService employeeService,
            IOtFormService otFormService)
        {
            _departmentService = departmentService;
            _groupService = groupService;
            _reasonService = reasonService;
            _otCaseService = otCaseService;
            _employeeService = employeeService;
            _otFormService = otFormService;
        }

        public async Task<AttendanceAiChatToolExecutionResult> ExecuteAsync(
            string toolName, JsonElement arguments, AttendanceAiChatCallerContext caller, CancellationToken cancellationToken)
        {
            object result;
            int? createdOtFormId = null;

            try
            {
                if (toolName == "create_ot_form_draft")
                {
                    var (createResult, otFormId) = await CreateOtFormDraftAsync(arguments, caller);
                    result = createResult;
                    createdOtFormId = otFormId;
                }
                else
                {
                    result = toolName switch
                    {
                        "search_departments" => await SearchDepartmentsAsync(arguments),
                        "search_groups" => await SearchGroupsAsync(arguments),
                        "search_reasons" => await SearchReasonsAsync(arguments),
                        "search_ot_cases" => await SearchOtCasesAsync(arguments),
                        "search_employees_by_group" => await SearchEmployeesByGroupAsync(arguments),
                        "get_my_create_scopes" => await _otFormService.GetMyCreateScopesAsync(caller.UserName, caller.IsAdmin),
                        _ => new { error = $"Không hỗ trợ tool '{toolName}'." }
                    };
                }
            }
            catch (Exception ex)
            {
                // Catches DomainException/NotFoundException thrown deep inside OtFormService.CreateAsync
                // (scope check, employee/group mismatch, EndTime bounds...) the same way Asset's
                // executor does — a validation failure becomes a normal tool-error the model can relay
                // and act on, not a crash of the whole stream.
                result = new { error = ex.Message };
            }

            return new AttendanceAiChatToolExecutionResult
            {
                Json = JsonSerializer.Serialize(result, JsonOptions),
                CreatedOtFormId = createdOtFormId
            };
        }

        private async Task<object> SearchDepartmentsAsync(JsonElement args)
        {
            var keyword = GetStringArg(args, "keyword");
            var all = await _departmentService.GetAllActiveAsync();
            var filtered = keyword == null
                ? all
                : all.Where(d => Contains(d.DepartmentNameVn, keyword) || Contains(d.DepartmentCode, keyword)).ToList();
            return filtered.Take(MaxResults).ToList();
        }

        private async Task<object> SearchGroupsAsync(JsonElement args)
        {
            var departmentId = GetIntArg(args, "departmentId");
            var keyword = GetStringArg(args, "keyword");
            var all = departmentId != null
                ? await _groupService.GetByDepartmentIdAsync(departmentId.Value)
                : await _groupService.GetAllActiveAsync();
            var filtered = keyword == null
                ? all
                : all.Where(g => Contains(g.GroupNameVn, keyword) || Contains(g.GroupCode, keyword)).ToList();
            return filtered.Take(MaxResults).ToList();
        }

        private async Task<object> SearchReasonsAsync(JsonElement args)
        {
            var keyword = GetStringArg(args, "keyword");
            var all = await _reasonService.GetAllActiveAsync();
            var filtered = keyword == null ? all : all.Where(r => Contains(r.ReasonNameVn, keyword)).ToList();
            return filtered.Take(MaxResults).ToList();
        }

        private async Task<object> SearchOtCasesAsync(JsonElement args)
        {
            var keyword = GetStringArg(args, "keyword");
            var all = await _otCaseService.GetAllActiveAsync();
            var filtered = keyword == null
                ? all
                : all.Where(c => Contains(c.Code, keyword) || Contains(c.Description, keyword)).ToList();
            return filtered.Take(MaxResults).ToList();
        }

        private async Task<object> SearchEmployeesByGroupAsync(JsonElement args)
        {
            var groupId = GetIntArg(args, "groupId");
            if (groupId == null) return MissingArgError("groupId");

            var employees = await _employeeService.GetByGroupIdAsync(groupId.Value);
            return employees.Take(MaxResults).ToList();
        }

        // Returns (tool-result-object, created-OtForm-id-or-null) — the id is only used by
        // AttendanceAiChatService to emit the "otform" deep-link stream event, never sent to the model.
        private async Task<(object Result, int? CreatedOtFormId)> CreateOtFormDraftAsync(JsonElement args, AttendanceAiChatCallerContext caller)
        {
            var groupId = GetIntArg(args, "groupId");
            if (groupId == null) return (MissingArgError("groupId"), null);

            var departmentId = GetIntArg(args, "departmentId");
            if (departmentId == null) return (MissingArgError("departmentId"), null);

            var reasonId = GetIntArg(args, "reasonId");
            if (reasonId == null) return (MissingArgError("reasonId"), null);

            var otCaseId = GetIntArg(args, "otCaseId");
            if (otCaseId == null) return (MissingArgError("otCaseId"), null);

            var startTime = ParseTimeOnlyArg(args, "startTime");
            if (startTime == null) return (InvalidArgError("startTime", "HH:mm"), null);

            var endTime = ParseTimeOnlyArg(args, "endTime");
            if (endTime == null) return (InvalidArgError("endTime", "HH:mm"), null);

            var totalHour = GetDecimalArg(args, "totalHour");
            if (totalHour == null) return (MissingArgError("totalHour"), null);

            var date = ParseDateOnlyArg(args, "date");
            if (date == null) return (InvalidArgError("date", "yyyy-MM-dd"), null);

            if (!args.TryGetProperty("employees", out var employeesEl) || employeesEl.ValueKind != JsonValueKind.Array || employeesEl.GetArrayLength() == 0)
                return (new { error = "Danh sách nhân viên không được để trống." }, null);

            var employees = new List<CreateOtFormEmployeeItemDto>();
            foreach (var item in employeesEl.EnumerateArray())
            {
                var employeeId = GetIntArg(item, "employeeId");
                if (employeeId == null) return (new { error = "Mỗi nhân viên trong danh sách phải có employeeId." }, null);

                var employeeEndTime = ParseTimeOnlyArg(item, "endTime");
                if (employeeEndTime == null) return (new { error = $"Nhân viên employeeId={employeeId} thiếu endTime hợp lệ (HH:mm)." }, null);

                employees.Add(new CreateOtFormEmployeeItemDto
                {
                    EmployeeId = employeeId.Value,
                    EndTime = employeeEndTime.Value,
                    NoteVn = GetStringArg(item, "noteVn"),
                    NoteJp = GetStringArg(item, "noteJp")
                });
            }

            ProcessPartDto? processPart = null;
            if (args.TryGetProperty("processPart", out var processPartEl) && processPartEl.ValueKind == JsonValueKind.Object)
            {
                processPart = new ProcessPartDto
                {
                    IsEat = GetBoolArg(processPartEl, "isEat") ?? false,
                    MainTicketCount = GetIntArg(processPartEl, "mainTicketCount") ?? 0,
                    SecondaryTicketCount = GetIntArg(processPartEl, "secondaryTicketCount") ?? 0,
                    MilkCount = GetIntArg(processPartEl, "milkCount") ?? 0,
                    IsTransportation = GetBoolArg(processPartEl, "isTransportation") ?? false,
                    IsUseCopyRoom = GetBoolArg(processPartEl, "isUseCopyRoom") ?? false,
                    AnotherSuggestionVn = GetStringArg(processPartEl, "anotherSuggestionVn"),
                    AnotherSuggestionJp = GetStringArg(processPartEl, "anotherSuggestionJp")
                };
            }

            var dto = new CreateOtFormDto
            {
                GroupId = groupId.Value,
                DepartmentId = departmentId.Value,
                ReasonId = reasonId.Value,
                OtCaseId = otCaseId.Value,
                StartTime = startTime.Value,
                EndTime = endTime.Value,
                SubReason = GetStringArg(args, "subReason"),
                TotalHour = totalHour.Value,
                Date = date.Value,
                Employees = employees,
                ProcessPart = processPart
            };

            var created = await _otFormService.CreateAsync(caller.UserName, caller.FullName, caller.IsAdmin, dto);

            // Trimmed summary, not the full OtFormDto (avoids flooding context with the nested
            // employee/approval-history payload the model doesn't need to reference again).
            var summary = new
            {
                success = true,
                otFormId = created.Id,
                status = "Draft",
                groupNameVn = created.GroupNameVn,
                departmentNameVn = created.DepartmentNameVn,
                date = created.Date.ToString("yyyy-MM-dd"),
                totalHour = created.TotalHour,
                numberOfEmployee = created.NumberOfEmployee,
                message = $"Đã tạo đơn tăng ca nháp #{created.Id}, chờ Trưởng nhóm ký duyệt."
            };
            return (summary, created.Id);
        }

        private static bool Contains(string? haystack, string keyword) =>
            haystack != null && haystack.Contains(keyword, StringComparison.OrdinalIgnoreCase);

        private static object MissingArgError(string paramName) => new { error = $"Thiếu tham số '{paramName}'." };
        private static object InvalidArgError(string paramName, string expectedFormat) =>
            new { error = $"Tham số '{paramName}' không hợp lệ, cần đúng định dạng {expectedFormat}." };

        private static string? GetStringArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;
            if (value.ValueKind != JsonValueKind.String) return null;

            var raw = value.GetString();
            return string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();
        }

        private static int? GetIntArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;

            return value.ValueKind switch
            {
                JsonValueKind.Number when value.TryGetInt32(out var i) => i,
                JsonValueKind.String when int.TryParse(value.GetString(), out var i) => i,
                _ => null
            };
        }

        private static decimal? GetDecimalArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;

            return value.ValueKind switch
            {
                JsonValueKind.Number when value.TryGetDecimal(out var d) => d,
                JsonValueKind.String when decimal.TryParse(value.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => d,
                _ => null
            };
        }

        private static bool? GetBoolArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;

            return value.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.String when bool.TryParse(value.GetString(), out var b) => b,
                _ => null
            };
        }

        private static TimeOnly? ParseTimeOnlyArg(JsonElement args, string name)
        {
            var raw = GetStringArg(args, name);
            if (raw == null) return null;

            return TimeOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ? parsed : null;
        }

        private static DateOnly? ParseDateOnlyArg(JsonElement args, string name)
        {
            var raw = GetStringArg(args, name);
            if (raw == null) return null;

            return DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ? parsed : null;
        }
    }
}
