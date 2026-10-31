using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Attendance.Application.Dtos.AiChat;
using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;

namespace Attendance.Application.Services
{
    // Delegates to existing Attendance services only; the write tool calls the same IOtFormService.CreateAsync
    // as the manual screen so every validation applies identically.
    public class AttendanceAiChatToolExecutorService : IAttendanceAiChatToolExecutorService
    {
        // Per-group employee lists can be larger than Asset's cap of 10.
        private const int MaxResults = 30;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            // The default encoder escapes diacritics as \uXXXX, which the model then copies into its replies;
            // this JSON never reaches HTML so relaxed escaping is safe.
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
                // Turn validation failures into a tool error the model can relay instead of crashing the stream.
                result = new { error = ex.Message };
            }

            return new AttendanceAiChatToolExecutionResult
            {
                Json = JsonSerializer.Serialize(result, JsonOptions),
                CreatedOtFormId = createdOtFormId
            };
        }

        // Plain text, not JSON: the model reproduces "id 1 = TH1" more reliably from flat lines and it costs fewer tokens.
        public async Task<string> BuildReferenceContextAsync(AttendanceAiChatCallerContext caller, CancellationToken cancellationToken)
        {
            var builder = new StringBuilder();
            builder.Append("DỮ LIỆU THẬT CỦA HỆ THỐNG (đã tra cứu sẵn cho lượt này — dùng TRỰC TIẾP, ")
                   .Append("KHÔNG cần gọi tool tra cứu, KHÔNG được bịa thêm lựa chọn nào ngoài danh sách dưới đây):\n");
            builder.Append($"- Hôm nay là {DateTime.Today:yyyy-MM-dd} (dùng để quy đổi 'hôm nay'/'ngày mai'/'thứ X').\n");

            try
            {
                var scopes = await _otFormService.GetMyCreateScopesAsync(caller.UserName, caller.IsAdmin);

                if (scopes.Count == 0)
                {
                    // Admin scope is unbounded, so nothing to pre-fetch; lookup tools cover it.
                    builder.Append(caller.IsAdmin
                        ? "- Phạm vi tạo đơn: bạn là Admin nên KHÔNG bị giới hạn Nhóm/Bộ phận. Vì vậy PHẢI dùng tool search_departments/search_groups để tìm Nhóm/Bộ phận người dùng nêu, rồi search_employees_by_group để lấy nhân viên.\n"
                        : "- Phạm vi tạo đơn: KHÔNG có Nhóm/Bộ phận nào. Người dùng này không được phép tạo đơn tăng ca — hãy nói rõ điều đó và không tạo đơn.\n");
                }
                else
                {
                    builder.Append("- Nhóm/Bộ phận người dùng được phép tạo đơn");
                    builder.Append(scopes.Count == 1
                        ? " (chỉ có DUY NHẤT 1 lựa chọn — dùng luôn, KHÔNG hỏi lại người dùng):\n"
                        : $" ({scopes.Count} lựa chọn — hỏi người dùng chọn bằng TÊN):\n");
                    foreach (var scope in scopes)
                    {
                        builder.Append($"  · groupId={scope.GroupId} \"{scope.GroupNameVn}\" ")
                               .Append($"thuộc departmentId={scope.DepartmentId} \"{scope.DepartmentNameVn}\"\n");
                    }

                    // With several scopes the target group is unknown, and dumping every roster would bloat the prompt.
                    if (scopes.Count == 1)
                    {
                        var employees = await _employeeService.GetByGroupIdAsync(scopes[0].GroupId);
                        builder.Append($"- Nhân viên thuộc Nhóm \"{scopes[0].GroupNameVn}\" ")
                               .Append($"({employees.Count} người — chỉ được chọn trong danh sách này):\n");
                        foreach (var employee in employees)
                        {
                            builder.Append($"  · employeeId={employee.Id} \"{employee.LastName} {employee.FirstName}\" ")
                                   .Append($"(mã NV {employee.Code}, đã tăng ca tháng này {employee.MonthToDate}h, năm nay {employee.YearToDate}h)\n");
                        }
                    }
                }

                var otCases = await _otCaseService.GetAllActiveAsync();
                builder.Append($"- Trường hợp OT ({otCases.Count} lựa chọn, KHÔNG có lựa chọn nào khác):\n");
                foreach (var otCase in otCases)
                {
                    builder.Append($"  · otCaseId={otCase.Id} \"{otCase.Code}\" = {otCase.Description} ")
                           .Append($"(cần chữ ký: {(otCase.RequireSignature ? "có" : "không")}, cấp duyệt cuối: {otCase.RequiredApprovalLevel})\n");
                }

                var reasons = await _reasonService.GetAllActiveAsync();
                builder.Append($"- Lý do tăng ca ({reasons.Count} lựa chọn, KHÔNG có lựa chọn nào khác):\n");
                foreach (var reason in reasons)
                    builder.Append($"  · reasonId={reason.Id} \"{reason.ReasonNameVn}\"\n");
            }
            catch (Exception ex)
            {
                // Tell the model to use tools instead of trusting a partial list it would otherwise "complete" by inventing entries.
                builder.Append($"- CẢNH BÁO: không tra cứu được đầy đủ dữ liệu tham chiếu ({ex.Message}). ")
                       .Append("Danh sách phía trên có thể THIẾU — với những mục còn thiếu PHẢI gọi tool tra cứu tương ứng, TUYỆT ĐỐI không tự bịa.\n");
            }

            return builder.ToString();
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

        // CreatedOtFormId is only for the FE deep-link event, never sent to the model.
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

            // Trimmed summary keeps the nested employee/history payload out of the model context.
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
