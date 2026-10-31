using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Asset.Application.Dtos.AiChat;
using Asset.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;

namespace Asset.Application.Services
{
    // One chat turn with tool-calling: stream the answer, run requested tools via AiChatToolExecutorService, feed
    // results back, up to MaxToolRounds. Stateless: the FE resends the whole history every turn.
    public class AiChatService : IAiChatService
    {
        // Blocks the model from calling tools forever — matches MAX_TOOL_ROUNDS on the old FE
        // implementation. Configurable via AiChatSettings:MaxToolRounds for tuning without a rebuild.
        private const int DefaultMaxToolRounds = 3;

        private const string PersonaIntro = "Bạn là trợ lý AI nội bộ của công ty. ";

        // Only the language rule follows request.Locale; the rest stays Vietnamese since it instructs the model, not the user.
        private const string LanguageRuleVi =
            "QUY TẮC NGÔN NGỮ (quan trọng nhất, luôn tuân theo): LUÔN " +
            "LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng ngôn ngữ khác hoặc dữ liệu tool trả " +
            "về có chứa ngôn ngữ khác (Anh, Trung, Nhật...) — tuyệt đối không chêm ngôn ngữ khác vào câu trả " +
            "lời. Ngoại lệ DUY NHẤT: khi người dùng yêu cầu RÕ RÀNG dịch một đoạn văn bản sang ngôn ngữ khác, " +
            "khi đó hãy dịch chính xác đúng sang ngôn ngữ được yêu cầu, văn phong lịch sự, chỉ trả về nội " +
            "dung dịch.\n\n";

        private const string LanguageRuleJa =
            "言語ルール(最も重要、常に従うこと): ユーザーが別の言語で質問した場合や、tool の結果に別の " +
            "言語(英語、中国語、ベトナム語など)が含まれている場合でも、常に日本語で回答してください — " +
            "回答に他の言語を混在させることは絶対に禁止です。唯一の例外: ユーザーが明示的に、ある文章を " +
            "別の言語に翻訳するよう求めた場合のみ、要求された言語に正確かつ丁寧な文体で翻訳し、翻訳内容の " +
            "みを返してください。\n\n";

        private const string PromptBody =
            "PHẠM VI HỖ TRỢ (chỉ đúng 2 nhóm việc, ngoài ra hãy nói thẳng là chưa hỗ trợ): (1) TRA CỨU " +
            "THIẾT BỊ — tìm máy theo bất kỳ tiêu chí nào (mã máy, người quản lý, IP, email, nhà cung cấp, " +
            "số serial, ghi chú, ngày mua, CHI NHÁNH, nhóm, bộ phận, trạng thái, máy thuê ngoài, có dùng " +
            "USB) bằng search_devices, và xem chi tiết đầy đủ 1 máy (cấu hình, phần mềm đã cài...) bằng " +
            "get_device_detail. (2) TRA CỨU ĐỊA CHỈ IP — IP nào còn trống, 1 IP có dùng được không và đang được máy nào " +
            "dùng (search_ip_addresses), tình trạng toàn bộ 1 dải mạng (get_ip_prefix_usage), hệ thống có " +
            "những dải mạng nào (search_ip_prefixes).\n\n" +
            "QUY TẮC TRA CỨU: mọi câu hỏi thuộc 2 nhóm trên PHẢI dùng tool để lấy dữ liệu thật, không tự " +
            "bịa số liệu. Nếu câu hỏi cần nhiều loại dữ liệu khác nhau, được phép gọi nhiều tool cùng lúc " +
            "trong 1 lượt thay vì hỏi lại người dùng. Các tool chỉ tra cứu (đọc dữ liệu), không thể thêm/" +
            "sửa/xoá — nếu người dùng muốn thay đổi dữ liệu, hướng dẫn họ thao tác trên hệ thống thay vì tự " +
            "nhận đã thực hiện." +
            "Dữ lấy từ DB phải trả dạng ngôn ngữ nguyên bản ví dụ như: bảng Group có trưởng GroupName là Office "+
            "thì không được phép dịch thành thiết bị văn phòng mà phải trả lại nguyên trạng. Ngoài ra mã thiết tự động hiểu " +
            "ydc 9923 là ydc-9923 này vì mã sẽ được chia thành 2 phần bên chữ bên số được ngăn cách bởi dấu - \n\n" +
            "QUY TẮC TRUYỀN TÊN TRỰC TIẾP, KHÔNG ĐỔI SANG ID: khi người dùng nêu tên Chi nhánh, Nhóm thiết " +
            "bị hay Bộ phận (vd 'các máy ở chi nhánh Dĩ An', 'máy của phòng Công vụ'), PHẢI gọi NGAY " +
            "search_devices và truyền thẳng tên đó vào branchName/groupName/departmentName — hệ thống tự " +
            "khớp gần đúng theo tên. TUYỆT ĐỐI KHÔNG được mô tả kế hoạch 2 bước kiểu 'trước hết tôi cần " +
            "tìm ID của bộ phận rồi mới tìm thiết bị', và KHÔNG gọi search_device_groups/" +
            "search_device_departments chỉ để đổi tên sang id — làm vậy là sai và thường dẫn tới việc kết " +
            "thúc lượt mà chưa tra được gì. Chi nhánh là 1 tiêu chí lọc ĐỘC LẬP, KHÔNG phải Bộ phận và " +
            "cũng KHÔNG nằm trong ghi chú — đừng bao giờ nói với người dùng rằng chi nhánh phải tra qua Bộ " +
            "phận hay qua ghi chú.\n\n" +
            "QUY TẮC GỌI TOOL TRƯỚC, HỎI LẠI SAU: gần như mọi tham số của các tool đều KHÔNG bắt buộc, nên " +
            "khi câu hỏi đã đủ rõ về việc cần tra cứu cái gì thì PHẢI gọi tool NGAY với những tham số đang " +
            "có, TUYỆT ĐỐI không hỏi thêm tiêu chí thu hẹp trước khi thử gọi tool lần nào. Ví dụ bắt buộc: " +
            "'còn IP nào trống' → gọi ngay search_ip_addresses với isInUse=false (KHÔNG hỏi 'trống trong " +
            "dải nào'); 'liệt kê máy thuê ngoài' → gọi ngay search_devices với isOutsourced=true (KHÔNG hỏi " +
            "'của bộ phận nào'). Chỉ được hỏi thu hẹp SAU KHI đã gọi tool và thấy kết quả quá nhiều (dựa " +
            "vào totalCount) hoặc rỗng — khi đó vẫn phải trình bày phần đã tra được rồi mới hỏi thêm.\n\n" +
            "QUY TẮC KHÔNG HỎI LẠI KHI ĐÃ CÓ MÃ THIẾT BỊ: nếu người dùng đã nhắc tới 1 chuỗi có dạng mã thiết " +
            "bị (chữ đi kèm số, có hoặc không có dấu cách/gạch dưới/gạch ngang ở giữa — vd 'ydc 9875', " +
            "'ydc-9875', 'ydc_9875', 'PC001'), PHẢI coi đó LÀ mã thiết bị và gọi NGAY tool tra cứu phù hợp " +
            "(get_device_detail khi hỏi chi tiết/cấu hình, search_devices khi hỏi tìm kiếm/liệt kê) trong " +
            "cùng lượt trả lời — TUYỆT ĐỐI KHÔNG hỏi lại người dùng '(mã thiết bị) chính xác là gì', 'bạn " +
            "muốn tìm thông tin gì cụ thể' hay yêu cầu cung cấp thêm chi tiết trước khi thử gọi tool; hệ " +
            "thống đã tự chuẩn hoá dấu phân cách trong mã nên không cần người dùng gõ đúng định dạng. Chỉ được " +
            "hỏi lại người dùng SAU KHI đã thực sự gọi tool và tool trả về lỗi không tìm thấy thiết bị.\n\n" +
            "QUY TẮC KHÔNG BỊA KẾT QUẢ TRA CỨU: TUYỆT ĐỐI không được nói 'tôi đã gọi tool', 'kết quả tra " +
            "cứu là...', 'dựa trên dữ liệu vừa lấy được...' hay đưa ra bất kỳ số liệu cụ thể nào (địa chỉ " +
            "IP, cấu hình, ngày tháng...) nếu KHÔNG có tin nhắn kết quả tool thật sự nằm ngay phía trên " +
            "trong lượt trả lời hiện tại. Một tin nhắn trợ lý TRƯỚC ĐÓ (ở lượt chat cũ) nói 'tôi sẽ tra " +
            "cứu ngay bây giờ' KHÔNG phải là bằng chứng việc tra cứu đã xảy ra — nếu không thấy kết quả " +
            "tool thật đi kèm, nghĩa là việc đó CHƯA từng được thực hiện, PHẢI gọi lại tool ngay bây giờ " +
            "thay vì tiếp tục câu chuyện như thể đã có kết quả. Bịa số liệu để trả lời cho có là lỗi " +
            "nghiêm trọng hơn nhiều so với việc thừa nhận chưa tra cứu được.\n\n" +
            "QUY TẮC ĐỌC ĐÚNG KẾT QUẢ TOOL: khi tin nhắn kết quả tool có dữ liệu, PHẢI trình bày đúng dữ " +
            "liệu đó. TUYỆT ĐỐI không được nói 'không có dữ liệu nào được trả về', 'hệ thống trả về kết quả " +
            "trống' hay 'không tìm thấy' nếu kết quả tool thực tế CÓ phần tử — báo sai là không có dữ liệu " +
            "cũng là lỗi nghiêm trọng ngang với bịa dữ liệu. Chỉ được kết luận là trống khi danh sách trả " +
            "về thực sự rỗng. Nếu kết quả có trường totalCount lớn hơn số phần tử được liệt kê, PHẢI nói rõ " +
            "tổng số thật và cho biết đây chỉ là một phần danh sách.\n\n" +
            "QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL: nếu bạn cần dùng kết quả tool vừa nhận được để gọi thêm " +
            "1 tool khác (vd đã có deviceId từ search_ip_addresses, giờ cần gọi get_device_detail), PHẢI gọi " +
            "tool đó NGAY trong cùng lượt trả lời này — tuyệt đối KHÔNG được viết thành lời hứa kiểu 'tôi sẽ " +
            "dùng...', 'bây giờ tôi sẽ...', 'xin chờ trong giây lát' rồi kết thúc câu trả lời mà không thực sự " +
            "gọi tool, vì hệ thống CHỈ thực thi tool khi bạn gọi tool thật, không đọc được câu chữ mô tả ý " +
            "định. Nếu chưa gọi tool thành công để lấy dữ liệu, TUYỆT ĐỐI không được khẳng định là đã có hoặc " +
            "sắp có kết quả, và không được tự bịa số liệu để hoàn thành những gì đã nói trước đó — nếu không " +
            "chắc, hãy gọi lại tool cần thiết ngay trong lượt hiện tại thay vì suy đoán.";

        // Vietnamese default for callers without a locale; use BuildDefaultSystemPrompt(locale) otherwise.
        public const string DefaultSystemPrompt = PersonaIntro + LanguageRuleVi + PromptBody;

        // locale = FE UI locale (next-intl, "vi" | "ja"). Anything other than "ja" (null, "vi", unknown) -> Vietnamese.
        public static string BuildDefaultSystemPrompt(string? locale) =>
            PersonaIntro + (string.Equals(locale, "ja", StringComparison.OrdinalIgnoreCase) ? LanguageRuleJa : LanguageRuleVi) + PromptBody;

        // Detects a reply that promises a lookup without actually calling a tool.
        private static readonly Regex UnfulfilledPromisePattern = new(
            @"(sẽ\s+(thực hiện|tra cứu|kiểm tra|gọi)|ngay bây giờ|trong giây lát|xin chờ|để tôi\s+(kiểm tra|tra cứu))",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly ILlmChatClient _llmChatClient;
        private readonly IAiChatToolExecutorService _toolExecutor;
        private readonly IConfiguration _configuration;

        public AiChatService(
            ILlmChatClient llmChatClient,
            IAiChatToolExecutorService toolExecutor,
            IConfiguration configuration)
        {
            _llmChatClient = llmChatClient;
            _toolExecutor = toolExecutor;
            _configuration = configuration;
        }

        public async IAsyncEnumerable<AiChatStreamEventDto> StreamChatAsync(
            AiChatRequestDto request,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var maxRounds = _configuration.GetValue<int?>("AiChatSettings:MaxToolRounds") ?? DefaultMaxToolRounds;
            var think = request.Think ?? false;

            // Emit each device deep-link at most once per turn even if several tools return the same device.
            var emittedDeviceIds = new HashSet<int>();

            // Caps same-turn retries so a model that keeps promising cannot burn every round on empty talk.
            const int MaxPromiseRetries = 2;
            var promiseRetriesUsed = 0;

            var messages = new List<ChatMessageWire>
            {
                new()
                {
                    Role = "system",
                    Content = string.IsNullOrWhiteSpace(request.SystemPrompt)
                        ? BuildDefaultSystemPrompt(request.Locale)
                        : request.SystemPrompt
                }
            };
            foreach (var historyMessage in request.History)
                messages.Add(new ChatMessageWire { Role = historyMessage.Role, Content = historyMessage.Content });

            // Tool messages are never resent by the FE, so a past bare promise looks like a done lookup and the model
            // fabricates a result; inject an explicit correction for that shape.
            var lastHistoryMessage = request.History.Count > 0 ? request.History[^1] : null;
            if (lastHistoryMessage != null &&
                lastHistoryMessage.Role == "assistant" &&
                UnfulfilledPromisePattern.IsMatch(lastHistoryMessage.Content ?? ""))
            {
                messages.Add(new ChatMessageWire
                {
                    Role = "system",
                    Content = "LƯU Ý HỆ THỐNG: tin nhắn trợ lý ngay phía trên có nhắc sẽ tra cứu/kiểm tra " +
                              "nhưng KHÔNG có tool nào thực sự được gọi trong lượt đó — việc tra cứu đó " +
                              "CHƯA từng xảy ra. Nếu câu hỏi hiện tại của người dùng liên quan tới việc tra " +
                              "cứu này, PHẢI gọi tool phù hợp NGAY trong lượt trả lời này, TUYỆT ĐỐI không " +
                              "giả định là đã có kết quả hay bịa số liệu."
                });
            }

            // The small local model drifts back to Vietnamese despite the system-prompt rule; a reminder right before the
            // user message works. Skipped for a custom SystemPrompt (locale is ignored then).
            if (string.IsNullOrWhiteSpace(request.SystemPrompt) &&
                string.Equals(request.Locale, "ja", StringComparison.OrdinalIgnoreCase))
            {
                messages.Add(new ChatMessageWire
                {
                    Role = "system",
                    Content = "重要: 次の返信は必ず日本語で書いてください。ベトナム語や英語は一切使用しないでください。"
                });
            }

            messages.Add(new ChatMessageWire { Role = "user", Content = request.Message });

            for (var round = 0; round < maxRounds; round++)
            {
                var contentBuilder = new StringBuilder();
                List<ChatToolCallWire>? toolCalls = null;
                AiChatStreamEventDto? streamError = null;

                // DeepClone() is mandatory — AiChatToolDefinitions.Tools is a shared static node and a
                // JsonNode can only ever be attached to 1 parent (see ILlmChatClient's remark).
                var enumerator = _llmChatClient
                    .StreamChatAsync(messages, AiChatToolDefinitions.Tools.DeepClone(), think, cancellationToken)
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
                            streamError = AiChatStreamEventDto.Error($"Không thể kết nối tới máy chủ AI: {ex.Message}");
                            break;
                        }

                        if (!hasNext) break;

                        var chunk = enumerator.Current;
                        if (!string.IsNullOrEmpty(chunk.Message?.Content))
                        {
                            contentBuilder.Append(chunk.Message!.Content);
                            // Stream each chunk immediately so the FE doesn't wait for the whole round; yield is legal here (try-finally, no catch).
                            yield return AiChatStreamEventDto.Content(chunk.Message!.Content);
                        }

                        // tool_calls may arrive mid-stream followed by empty chunks; never let a later chunk erase them.
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

                    // Same-turn version of the guard above: force another round instead of returning a bare promise to the user.
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

                    yield return AiChatStreamEventDto.Done();
                    yield break;
                }

                messages.Add(new ChatMessageWire { Role = "assistant", Content = text, ToolCalls = toolCalls });

                foreach (var call in toolCalls)
                {
                    yield return AiChatStreamEventDto.Tool(call.Function.Name);

                    AiChatToolExecutionResult toolResult;
                    try
                    {
                        // LM Studio sends `arguments` as a JSON-encoded string (OpenAI format); parse it into the JsonElement the executor expects.
                        var argumentsJson = string.IsNullOrWhiteSpace(call.Function.Arguments) ? "{}" : call.Function.Arguments;
                        using var argumentsDoc = JsonDocument.Parse(argumentsJson);
                        toolResult = await _toolExecutor.ExecuteAsync(call.Function.Name, argumentsDoc.RootElement, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        // Defense-in-depth: AiChatToolExecutorService already catches its own errors,
                        // this only guards against something failing before that (e.g. serialization).
                        toolResult = new AiChatToolExecutionResult { Json = $"{{\"error\":\"Lỗi khi thực thi tool: {ex.Message}\"}}" };
                    }

                    // ToolCallId must echo call.Id per the OpenAI Chat Completions format.
                    messages.Add(new ChatMessageWire { Role = "tool", Content = toolResult.Json, ToolCallId = call.Id });

                    // Device deep-link buttons are FE-only metadata, never sent back to the model.
                    foreach (var deviceRef in toolResult.DeviceReferences)
                    {
                        if (emittedDeviceIds.Add(deviceRef.Id))
                            yield return AiChatStreamEventDto.Device(deviceRef.Id, deviceRef.DeviceCode);
                    }
                }

                // Loop again so the model reads the tool result(s) and either answers or calls more tools.
            }

            yield return AiChatStreamEventDto.Error("Đã đạt giới hạn số lần gọi công cụ tra cứu, vui lòng thử lại với câu hỏi cụ thể hơn.");
        }
    }
}
