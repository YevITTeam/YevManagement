using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using Attendance.Application.Dtos.AiChat;
using Attendance.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;

namespace Attendance.Application.Services
{
    // Orchestrates 1 chat turn against Ollama with tool-calling for OT-form creation (mirrors Asset's
    // AiChatService — docs/docs-be/ai-chat-be-huong-dan.md §4/§14, adapted here in
    // docs/docs-be/attendance-aichat-be-huong-dan.md). Stateless — the FE resends the whole history
    // every turn, nothing is persisted server-side. Unlike Asset's version, this feature has exactly 1
    // WRITE tool (create_ot_form_draft) — see the confirmation gate below (§B3 of the plan), which is
    // the reason this orchestrator cannot just be a copy-paste of Asset's.
    public class AttendanceAiChatService : IAttendanceAiChatService
    {
        // Same knob as Asset's AiChatService — shared config key, tuned once for both features.
        private const int DefaultMaxToolRounds = 3;

        public const string DefaultSystemPrompt =
            "Bạn là trợ lý AI nội bộ hỗ trợ lập đơn tăng ca (OT Form) cho công ty. QUY TẮC NGÔN NGỮ (quan " +
            "trọng nhất, luôn tuân theo): LUÔN LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng " +
            "ngôn ngữ khác hoặc dữ liệu tool trả về có chứa ngôn ngữ khác — tuyệt đối không chêm ngôn ngữ " +
            "khác vào câu trả lời.\n\n" +
            "QUY TẮC TRA CỨU: khi cần biết Nhóm/Bộ phận/Lý do/Trường hợp OT/Nhân viên nào, PHẢI dùng tool " +
            "tra cứu phù hợp (search_departments/search_groups/search_reasons/search_ot_cases/" +
            "search_employees_by_group/get_my_create_scopes) để lấy id THẬT, TUYỆT ĐỐI không tự bịa số id. " +
            "Nếu người dùng đã cung cấp đủ tên Nhóm/Bộ phận/Lý do/Trường hợp OT, PHẢI gọi ngay tool tra cứu " +
            "tương ứng thay vì hỏi lại; được phép gọi nhiều tool tra cứu cùng lúc trong 1 lượt.\n\n" +
            "QUY TẮC KHÔNG BẮT NGƯỜI DÙNG NHỚ MÃ/ID: người dùng KHÔNG biết và KHÔNG được yêu cầu phải biết " +
            "id hay mã số của Nhóm, Bộ phận, Lý do, hay Trường hợp OT. TUYỆT ĐỐI không hỏi người dùng cung " +
            "cấp mã/id (vd không được hỏi 'mã Bộ phận của bạn là gì') — chỉ được hỏi bằng tên/mô tả tự nhiên " +
            "(vd 'bạn thuộc Nhóm nào', 'lý do tăng ca là gì'), rồi TỰ gọi tool tra cứu để tìm id thật khớp " +
            "với tên đó. Ngay khi cuộc trò chuyện chuyển sang ý định lập đơn (dù người dùng chưa nói chi " +
            "tiết gì), PHẢI gọi get_my_create_scopes NGAY LẬP TỨC — TRƯỚC cả khi hỏi bất kỳ câu nào khác — " +
            "để biết trước Nhóm/Bộ phận người này được phép tạo đơn. Nếu kết quả chỉ có đúng 1 Nhóm/Bộ phận, " +
            "PHẢI dùng luôn Nhóm/Bộ phận đó, TUYỆT ĐỐI không hỏi lại người dùng chọn Nhóm/Bộ phận (vì họ chỉ " +
            "có duy nhất 1 lựa chọn hợp lệ). Nếu có nhiều lựa chọn, liệt kê TÊN các lựa chọn đó (không phải " +
            "id) để người dùng chọn bằng tên.\n\n" +
            "QUY TẮC KHÔNG BỊA KẾT QUẢ: TUYỆT ĐỐI không được nói 'tôi đã gọi tool', 'kết quả tra cứu là...', " +
            "'đã tạo đơn thành công' hay đưa ra bất kỳ số liệu/id cụ thể nào nếu KHÔNG có tin nhắn kết quả " +
            "tool thật sự nằm ngay phía trên trong lượt trả lời hiện tại. Một tin nhắn trợ lý TRƯỚC ĐÓ (ở " +
            "lượt chat cũ) nói 'tôi sẽ tạo đơn ngay bây giờ' KHÔNG phải là bằng chứng việc đó đã xảy ra — " +
            "nếu không thấy kết quả tool thật đi kèm, nghĩa là việc đó CHƯA từng được thực hiện, PHẢI gọi " +
            "lại tool ngay bây giờ thay vì tiếp tục câu chuyện như thể đã có kết quả. Bịa số liệu hoặc bịa " +
            "việc đã tạo đơn để trả lời cho có là lỗi nghiêm trọng hơn nhiều so với việc thừa nhận chưa làm " +
            "được.\n\n" +
            "QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL: nếu bạn cần dùng kết quả tool vừa nhận được để gọi " +
            "thêm 1 tool khác, PHẢI gọi tool đó NGAY trong cùng lượt trả lời này — tuyệt đối KHÔNG được viết " +
            "thành lời hứa kiểu 'tôi sẽ tạo...', 'bây giờ tôi sẽ...', 'xin chờ trong giây lát' rồi kết thúc " +
            "câu trả lời mà không thực sự gọi tool, vì hệ thống CHỈ thực thi tool khi bạn gọi tool thật, " +
            "không đọc được câu chữ mô tả ý định.\n\n" +
            "QUY TẮC XÁC NHẬN TRƯỚC KHI TẠO ĐƠN (quan trọng nhất với tool create_ot_form_draft — đây là " +
            "tool DUY NHẤT có thể ghi dữ liệu thật): trước khi gọi tool này, PHẢI trình bày đầy đủ tóm tắt " +
            "đơn dự định tạo (Nhóm, Bộ phận, Lý do, Trường hợp OT, ngày, giờ bắt đầu/kết thúc, danh sách " +
            "nhân viên kèm giờ kết thúc riêng từng người, thông tin ăn/xe đưa đón nếu có) rồi hỏi người " +
            "dùng xác nhận rõ ràng. TUYỆT ĐỐI KHÔNG được gọi tool create_ot_form_draft trong CÙNG lượt vừa " +
            "trình bày tóm tắt đó — phải chờ người dùng tự trả lời xác nhận ở lượt kế tiếp. Hệ thống sẽ tự " +
            "động chặn việc tạo đơn nếu chưa nhận được xác nhận thật từ người dùng, kể cả khi bạn đã gọi " +
            "tool — nên tuyệt đối không tự cho rằng đã có xác nhận nếu người dùng chưa thực sự trả lời " +
            "khẳng định.";

        // Matches an assistant reply that promises to act ("tôi sẽ tạo đơn ngay bây giờ", "để tôi kiểm
        // tra", "xin chờ trong giây lát"...) without actually calling a tool — ported from Asset's
        // AiChatService (docs/ai-chat-be-huong-dan.md §14), "tạo" added to the verb list since the
        // write tool here can be promised-but-not-called the same way a lookup can.
        private static readonly Regex UnfulfilledPromisePattern = new(
            @"(sẽ\s+(thực hiện|tra cứu|kiểm tra|gọi|tạo)|ngay bây giờ|trong giây lát|xin chờ|để tôi\s+(kiểm tra|tra cứu))",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Structural confirmation gate (docs §B3) — the actual write-safety mechanism, NOT just a
        // prompt rule. Matches a short, unambiguous affirmative at the START of the user's own current
        // message (never the model's text — the model cannot manufacture this). Anchored to the start
        // on purpose: a long message that merely contains "ok" somewhere in the middle must NOT count,
        // only a message that IS an affirmative should.
        private static readonly Regex ConfirmationPattern = new(
            @"^\s*(đồng ý|dong y|xác nhận|xac nhan|ok(ay)?|được|duoc|tạo đi|tao di|yes|confirm)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly IOllamaChatClient _ollamaChatClient;
        private readonly IAttendanceAiChatToolExecutorService _toolExecutor;
        private readonly IConfiguration _configuration;

        public AttendanceAiChatService(
            IOllamaChatClient ollamaChatClient,
            IAttendanceAiChatToolExecutorService toolExecutor,
            IConfiguration configuration)
        {
            _ollamaChatClient = ollamaChatClient;
            _toolExecutor = toolExecutor;
            _configuration = configuration;
        }

        public async IAsyncEnumerable<AttendanceAiChatStreamEventDto> StreamChatAsync(
            AttendanceAiChatRequestDto request,
            AttendanceAiChatCallerContext caller,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var maxRounds = _configuration.GetValue<int?>("AiChatSettings:MaxToolRounds") ?? DefaultMaxToolRounds;
            var think = request.Think ?? false;

            // At most 1 OT form is ever created per conversation turn (the confirmation gate only lets
            // create_ot_form_draft through once the user has confirmed a specific proposal) — a single
            // nullable tracker is enough, unlike Asset's HashSet for potentially many device refs.
            int? emittedOtFormId = null;

            // Bounds the same-turn auto-retry below (separate from maxRounds' tool-call budget) — a
            // model that just keeps promising instead of calling a tool must not be allowed to silently
            // burn every round on empty talk; after this many nudges we give up and end the turn normally.
            const int MaxPromiseRetries = 2;
            var promiseRetriesUsed = 0;

            var messages = new List<OllamaMessageWire>
            {
                new()
                {
                    Role = "system",
                    Content = string.IsNullOrWhiteSpace(request.SystemPrompt) ? DefaultSystemPrompt : request.SystemPrompt
                }
            };
            foreach (var historyMessage in request.History)
                messages.Add(new OllamaMessageWire { Role = historyMessage.Role, Content = historyMessage.Content });

            // Same unfulfilled-promise guard as Asset's AiChatService (docs §14) — "tool" messages are
            // never persisted/resent by the FE, so if a PAST turn's assistant reply was just a promise
            // that ended the round without any real tool_calls, nothing in the resent history proves
            // anything happened. Detect that shape and inject an explicit correction.
            var lastHistoryMessage = request.History.Count > 0 ? request.History[^1] : null;
            if (lastHistoryMessage != null &&
                lastHistoryMessage.Role == "assistant" &&
                UnfulfilledPromisePattern.IsMatch(lastHistoryMessage.Content ?? ""))
            {
                messages.Add(new OllamaMessageWire
                {
                    Role = "system",
                    Content = "LƯU Ý HỆ THỐNG: tin nhắn trợ lý ngay phía trên có nhắc sẽ thực hiện/tạo đơn " +
                              "nhưng KHÔNG có tool nào thực sự được gọi trong lượt đó — việc đó CHƯA từng " +
                              "xảy ra. Nếu câu hỏi hiện tại của người dùng liên quan tới việc này, PHẢI gọi " +
                              "tool phù hợp NGAY trong lượt trả lời này, TUYỆT ĐỐI không giả định là đã có " +
                              "kết quả hay bịa số liệu/việc đã tạo đơn."
                });
            }

            messages.Add(new OllamaMessageWire { Role = "user", Content = request.Message });

            for (var round = 0; round < maxRounds; round++)
            {
                var contentBuilder = new StringBuilder();
                List<OllamaToolCallWire>? toolCalls = null;
                AttendanceAiChatStreamEventDto? streamError = null;

                // DeepClone() is mandatory — AttendanceAiChatToolDefinitions.Tools is a shared static
                // node and a JsonNode can only ever be attached to 1 parent.
                var enumerator = _ollamaChatClient
                    .StreamChatAsync(messages, AttendanceAiChatToolDefinitions.Tools.DeepClone(), think, cancellationToken)
                    .GetAsyncEnumerator(cancellationToken);
                try
                {
                    while (true)
                    {
                        bool hasNext;
                        try
                        {
                            hasNext = await enumerator.MoveNextAsync();
                        }
                        catch (Exception ex)
                        {
                            streamError = AttendanceAiChatStreamEventDto.Error($"Không thể kết nối tới máy chủ AI: {ex.Message}");
                            break;
                        }

                        if (!hasNext) break;

                        var chunk = enumerator.Current;
                        if (!string.IsNullOrEmpty(chunk.Message?.Content))
                        {
                            contentBuilder.Append(chunk.Message!.Content);
                            // Stream straight to the client as soon as it arrives (same fix as Asset's
                            // AiChatService — see its 2026-07-27 comment for the full rationale).
                            yield return AttendanceAiChatStreamEventDto.Content(chunk.Message!.Content);
                        }

                        // tool_calls position is NOT fixed in the stream — keep whatever we've seen so
                        // far, never let a later empty chunk erase it.
                        if (chunk.Message?.ToolCalls is { Count: > 0 })
                            toolCalls = chunk.Message.ToolCalls;
                    }
                }
                finally
                {
                    await enumerator.DisposeAsync();
                }

                if (streamError != null)
                {
                    yield return streamError;
                    yield break;
                }

                var text = contentBuilder.ToString();

                if (toolCalls == null || toolCalls.Count == 0)
                {
                    messages.Add(new OllamaMessageWire { Role = "assistant", Content = text });

                    // Same-turn version of the cross-turn guard above: don't hand control back to the
                    // user on a bare promise — the model has already proven (in production use) that it
                    // will just repeat the promise again next turn instead of calling the tool. Force
                    // another model round right now, within the same HTTP request, up to
                    // MaxPromiseRetries times.
                    if (UnfulfilledPromisePattern.IsMatch(text) && promiseRetriesUsed < MaxPromiseRetries && round < maxRounds - 1)
                    {
                        promiseRetriesUsed++;
                        messages.Add(new OllamaMessageWire
                        {
                            Role = "system",
                            Content = "LƯU Ý HỆ THỐNG: câu trả lời bạn vừa viết chỉ là lời hứa ('sẽ tra cứu', " +
                                      "'ngay bây giờ', 'xin chờ'...) và KHÔNG có tool nào thực sự được gọi. " +
                                      "PHẢI gọi tool phù hợp NGAY trong lượt này — TUYỆT ĐỐI không lặp lại lời " +
                                      "hứa, không xin lỗi, không xin chờ thêm."
                        });
                        continue;
                    }

                    yield return AttendanceAiChatStreamEventDto.Done();
                    yield break;
                }

                messages.Add(new OllamaMessageWire { Role = "assistant", Content = text, ToolCalls = toolCalls });

                foreach (var call in toolCalls)
                {
                    yield return AttendanceAiChatStreamEventDto.Tool(call.Function.Name);

                    AttendanceAiChatToolExecutionResult toolResult;

                    // Structural confirmation gate (docs §B3) — the ONLY write tool is blocked unless
                    // the user's OWN current-turn message (never the model's own text) carries an
                    // unambiguous affirmative. This defeats the exact proven failure mode from
                    // ai-chat-be-huong-dan.md §14: a small model confidently acting on its own
                    // hallucinated belief that it received confirmation. The model can emit
                    // `tool_calls` for create_ot_form_draft all it wants — it still won't execute
                    // unless the human actually said so this turn.
                    if (call.Function.Name == "create_ot_form_draft" && !ConfirmationPattern.IsMatch(request.Message))
                    {
                        toolResult = new AttendanceAiChatToolExecutionResult
                        {
                            Json = "{\"error\":\"Chưa nhận được xác nhận rõ ràng từ người dùng ở lượt này — " +
                                   "KHÔNG tạo đơn. Hãy trình bày lại đầy đủ tóm tắt đơn và chờ người dùng " +
                                   "xác nhận bằng 1 câu khẳng định rõ ràng (vd 'đồng ý', 'xác nhận', 'tạo đi').\"}"
                        };
                    }
                    else
                    {
                        try
                        {
                            toolResult = await _toolExecutor.ExecuteAsync(call.Function.Name, call.Function.Arguments, caller, cancellationToken);
                        }
                        catch (Exception ex)
                        {
                            // Defense-in-depth: the executor already catches its own errors, this only
                            // guards against something failing before that (e.g. serialization).
                            toolResult = new AttendanceAiChatToolExecutionResult { Json = $"{{\"error\":\"Lỗi khi thực thi tool: {ex.Message}\"}}" };
                        }
                    }

                    messages.Add(new OllamaMessageWire { Role = "tool", Content = toolResult.Json });

                    // Deep-link button for the FE (§C) — pure metadata, never part of the message
                    // history sent back to Ollama.
                    if (toolResult.CreatedOtFormId != null && emittedOtFormId == null)
                    {
                        emittedOtFormId = toolResult.CreatedOtFormId;
                        yield return AttendanceAiChatStreamEventDto.OtForm(toolResult.CreatedOtFormId.Value);
                    }
                }

                // Loop again so the model reads the tool result(s) and either answers or calls more tools.
            }

            yield return AttendanceAiChatStreamEventDto.Error("Đã đạt giới hạn số lần gọi công cụ, vui lòng thử lại với yêu cầu cụ thể hơn.");
        }
    }
}
