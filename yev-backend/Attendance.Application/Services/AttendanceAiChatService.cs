using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Attendance.Application.Dtos.AiChat;
using Attendance.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;

namespace Attendance.Application.Services
{
    // Stateless: the FE resends the whole history each turn. Differs from Asset's AiChatService because the
    // single write tool (create_ot_form_draft) sits behind a confirmation gate.
    public class AttendanceAiChatService : IAttendanceAiChatService
    {
        // Separate from Asset's MaxToolRounds: create + report + a promise retry need more rounds,
        // and each extra round is a slow full model call Asset's read-only flow doesn't need.
        private const int DefaultMaxToolRounds = 5;

        public const string DefaultSystemPrompt =
            "Bạn là trợ lý AI nội bộ hỗ trợ lập đơn tăng ca (OT Form) cho công ty. QUY TẮC NGÔN NGỮ (quan " +
            "trọng nhất, luôn tuân theo): LUÔN LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng " +
            "ngôn ngữ khác hoặc dữ liệu tool trả về có chứa ngôn ngữ khác — tuyệt đối không chêm ngôn ngữ " +
            "khác vào câu trả lời.\n\n" +
            "QUY TẮC DÙNG DỮ LIỆU CÓ SẴN (quan trọng nhất): ngay dưới system prompt này có 1 tin nhắn " +
            "'DỮ LIỆU THẬT CỦA HỆ THỐNG' chứa SẴN toàn bộ danh sách cần thiết đã tra cứu từ cơ sở dữ liệu: " +
            "Nhóm/Bộ phận người dùng được phép tạo đơn, danh sách nhân viên trong Nhóm, toàn bộ Trường hợp " +
            "OT, toàn bộ Lý do tăng ca — mỗi dòng đều kèm id THẬT. PHẢI lấy mọi id và mọi lựa chọn TỪ ĐÚNG " +
            "danh sách đó. TUYỆT ĐỐI KHÔNG được: bịa thêm lựa chọn không có trong danh sách; bịa hoặc suy " +
            "đoán id; đoán id theo thứ tự xuất hiện (vd không được cho rằng 'TH1' có id 1 — phải đọc đúng " +
            "số ghi ở dòng tương ứng). Vì dữ liệu đã có sẵn, KHÔNG cần gọi tool tra cứu cho những mục này " +
            "nữa. Nếu người dùng nói 1 tên KHÔNG có trong danh sách, phải nói thẳng là không tìm thấy và " +
            "đưa ra các lựa chọn gần đúng CÓ THẬT trong danh sách, không tự tạo mục mới.\n\n" +
            "QUY TẮC BẮT BUỘC LIỆT KÊ LỰA CHỌN (không được bỏ qua): TUYỆT ĐỐI không bao giờ hỏi 1 câu " +
            "kiểu 'bạn chọn Trường hợp OT nào', 'ai tham gia tăng ca', 'nhân viên nào' rồi để trống chờ " +
            "người dùng tự nhớ — mỗi câu hỏi như vậy PHẢI đi kèm ngay danh sách lựa chọn CÓ THẬT lấy từ " +
            "'DỮ LIỆU THẬT CỦA HỆ THỐNG'. Cụ thể: (a) khi hỏi Trường hợp OT, PHẢI liệt kê ĐẦY ĐỦ tất cả " +
            "các Trường hợp OT trong dữ liệu, mỗi dòng ghi mã + mô tả thật (vd 'TH1 — Tăng ca ngày " +
            "thường'), không được viết 'ví dụ:...' rồi bỏ lửng. (b) khi hỏi nhân viên tham gia, PHẢI liệt " +
            "kê ĐẦY ĐỦ tên từng nhân viên trong Nhóm theo dạng danh sách có đánh số thứ tự, để người dùng " +
            "chỉ cần trả lời bằng số hoặc tên; TUYỆT ĐỐI không hỏi 'nhân viên nào' khi chưa liệt kê. " +
            "(c) khi hỏi Lý do tăng ca (danh sách rất dài), hỏi người dùng mô tả ngắn công việc rồi tự lọc " +
            "và liệt kê 5-10 Lý do phù hợp nhất CÓ THẬT trong dữ liệu kèm số thứ tự để họ chọn — không " +
            "liệt kê toàn bộ, cũng không bỏ trống. Nguyên tắc: người dùng chỉ cần CHỌN, không bao giờ phải " +
            "tự nhớ hay tự gõ đúng tên. Riêng Nhóm/Bộ phận nếu chỉ có 1 lựa chọn thì dùng luôn, không hỏi.\n\n" +
            "QUY TẮC TRA CỨU BỔ SUNG: chỉ dùng tool tra cứu (search_departments/search_groups/" +
            "search_reasons/search_ot_cases/search_employees_by_group/get_my_create_scopes) khi cần thứ " +
            "KHÔNG có trong dữ liệu sẵn ở trên — điển hình là khi bạn là Admin không bị giới hạn Nhóm, " +
            "hoặc cần nhân viên của 1 Nhóm khác. Khi đó vẫn TUYỆT ĐỐI không được bịa id.\n\n" +
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

        // Detects replies that promise an action without calling a tool; includes the "create" verb for the write tool.
        private static readonly Regex UnfulfilledPromisePattern = new(
            @"(sẽ\s+(thực hiện|tra cứu|kiểm tra|gọi|tạo)|ngay bây giờ|trong giây lát|xin chờ|để tôi\s+(kiểm tra|tra cứu))",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Write-safety gate: only the user's own message can confirm, and it must START with the affirmative
        // so a long message merely containing "ok" doesn't count.
        private static readonly Regex ConfirmationPattern = new(
            @"^\s*(đồng ý|dong y|xác nhận|xac nhan|ok(ay)?|được|duoc|tạo đi|tao di|yes|confirm)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly ILlmChatClient _llmChatClient;
        private readonly IAttendanceAiChatToolExecutorService _toolExecutor;
        private readonly IConfiguration _configuration;

        public AttendanceAiChatService(
            ILlmChatClient llmChatClient,
            IAttendanceAiChatToolExecutorService toolExecutor,
            IConfiguration configuration)
        {
            _llmChatClient = llmChatClient;
            _toolExecutor = toolExecutor;
            _configuration = configuration;
        }

        public async IAsyncEnumerable<AttendanceAiChatStreamEventDto> StreamChatAsync(
            AttendanceAiChatRequestDto request,
            AttendanceAiChatCallerContext caller,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var maxRounds = _configuration.GetValue<int?>("AiChatSettings:AttendanceMaxToolRounds") ?? DefaultMaxToolRounds;
            var think = request.Think ?? false;

            // The confirmation gate allows at most one form per turn, so a single tracker suffices.
            int? emittedOtFormId = null;

            // Caps same-turn nudges so a model that keeps promising can't burn every round.
            const int MaxPromiseRetries = 2;
            var promiseRetriesUsed = 0;

            var messages = new List<ChatMessageWire>
            {
                new()
                {
                    Role = "system",
                    Content = string.IsNullOrWhiteSpace(request.SystemPrompt) ? DefaultSystemPrompt : request.SystemPrompt
                }
            };

            // Re-injected every turn because the FE only resends user/assistant messages; stops the model inventing ids.
            var referenceContext = await _toolExecutor.BuildReferenceContextAsync(caller, cancellationToken);
            messages.Add(new ChatMessageWire { Role = "system", Content = referenceContext });
            foreach (var historyMessage in request.History)
                messages.Add(new ChatMessageWire { Role = historyMessage.Role, Content = historyMessage.Content });

            // Tool messages aren't resent, so a past bare promise looks like nothing happened; inject a correction.
            var lastHistoryMessage = request.History.Count > 0 ? request.History[^1] : null;
            if (lastHistoryMessage != null &&
                lastHistoryMessage.Role == "assistant" &&
                UnfulfilledPromisePattern.IsMatch(lastHistoryMessage.Content ?? ""))
            {
                messages.Add(new ChatMessageWire
                {
                    Role = "system",
                    Content = "LƯU Ý HỆ THỐNG: tin nhắn trợ lý ngay phía trên có nhắc sẽ thực hiện/tạo đơn " +
                              "nhưng KHÔNG có tool nào thực sự được gọi trong lượt đó — việc đó CHƯA từng " +
                              "xảy ra. Nếu câu hỏi hiện tại của người dùng liên quan tới việc này, PHẢI gọi " +
                              "tool phù hợp NGAY trong lượt trả lời này, TUYỆT ĐỐI không giả định là đã có " +
                              "kết quả hay bịa số liệu/việc đã tạo đơn."
                });
            }

            messages.Add(new ChatMessageWire { Role = "user", Content = request.Message });

            for (var round = 0; round < maxRounds; round++)
            {
                var contentBuilder = new StringBuilder();
                List<ChatToolCallWire>? toolCalls = null;
                AttendanceAiChatStreamEventDto? streamError = null;

                // DeepClone is required: the shared static node can only have one parent.
                var enumerator = _llmChatClient
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
                            yield return AttendanceAiChatStreamEventDto.Content(chunk.Message!.Content);
                        }

                        // tool_calls can arrive in any chunk; never let a later empty chunk erase them.
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
                    messages.Add(new ChatMessageWire { Role = "assistant", Content = text });

                    // Force another round in the same request on a bare promise; otherwise the model repeats it next turn.
                    if (UnfulfilledPromisePattern.IsMatch(text) && promiseRetriesUsed < MaxPromiseRetries && round < maxRounds - 1)
                    {
                        promiseRetriesUsed++;
                        messages.Add(new ChatMessageWire
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

                messages.Add(new ChatMessageWire { Role = "assistant", Content = text, ToolCalls = toolCalls });

                foreach (var call in toolCalls)
                {
                    yield return AttendanceAiChatStreamEventDto.Tool(call.Function.Name);

                    AttendanceAiChatToolExecutionResult toolResult;

                    // Blocks the write tool unless the human's current message is an affirmative,
                    // so a model hallucinating confirmation can't create a form.
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
                            // LM Studio sends arguments as a JSON-encoded string; parse to the JsonElement the executor expects.
                            var argumentsJson = string.IsNullOrWhiteSpace(call.Function.Arguments) ? "{}" : call.Function.Arguments;
                            using var argumentsDoc = JsonDocument.Parse(argumentsJson);
                            toolResult = await _toolExecutor.ExecuteAsync(call.Function.Name, argumentsDoc.RootElement, caller, cancellationToken);
                        }
                        catch (Exception ex)
                        {
                            // Defense in depth for failures before the executor's own catch (e.g. serialization).
                            toolResult = new AttendanceAiChatToolExecutionResult { Json = $"{{\"error\":\"Lỗi khi thực thi tool: {ex.Message}\"}}" };
                        }
                    }

                    // ToolCallId must echo call.Id per the OpenAI wire format LM Studio uses.
                    messages.Add(new ChatMessageWire { Role = "tool", Content = toolResult.Json, ToolCallId = call.Id });

                    // FE deep-link metadata only; never sent back to the model.
                    if (toolResult.CreatedOtFormId != null && emittedOtFormId == null)
                    {
                        emittedOtFormId = toolResult.CreatedOtFormId;
                        yield return AttendanceAiChatStreamEventDto.OtForm(toolResult.CreatedOtFormId.Value);
                    }
                }

            }

            yield return AttendanceAiChatStreamEventDto.Error("Đã đạt giới hạn số lần gọi công cụ, vui lòng thử lại với yêu cầu cụ thể hơn.");
        }
    }
}
