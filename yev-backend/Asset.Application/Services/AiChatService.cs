using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using Asset.Application.Dtos.AiChat;
using Asset.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;
using Shared.Application.Dtos.AiChat;
using Shared.Application.Interfaces.External;

namespace Asset.Application.Services
{
    // Orchestrates 1 chat turn against Ollama with tool-calling (docs/ai-chat-be-huong-dan.md §4):
    // stream Ollama's answer, execute any tool the model asks for by calling straight into internal
    // Application services (AiChatToolExecutorService), feed the result back, repeat up to
    // MaxToolRounds times. Stateless — the FE resends the whole history every turn, nothing is
    // persisted server-side.
    public class AiChatService : IAiChatService
    {
        // Blocks the model from calling tools forever — matches MAX_TOOL_ROUNDS on the old FE
        // implementation. Configurable via AiChatSettings:MaxToolRounds for tuning without a rebuild.
        private const int DefaultMaxToolRounds = 3;

        public const string DefaultSystemPrompt =
            "Bạn là trợ lý AI nội bộ của công ty. QUY TẮC NGÔN NGỮ (quan trọng nhất, luôn tuân theo): LUÔN " +
            "LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng ngôn ngữ khác hoặc dữ liệu tool trả " +
            "về có chứa ngôn ngữ khác (Anh, Trung, Nhật...) — tuyệt đối không chêm ngôn ngữ khác vào câu trả " +
            "lời. Ngoại lệ DUY NHẤT: khi người dùng yêu cầu RÕ RÀNG dịch một đoạn văn bản sang ngôn ngữ khác, " +
            "khi đó hãy dịch chính xác đúng sang ngôn ngữ được yêu cầu, văn phong lịch sự, chỉ trả về nội " +
            "dung dịch.\n\n" +
            "QUY TẮC TRA CỨU: khi người dùng hỏi thông tin thiết bị (chi tiết máy, cấu hình, phần mềm đã " +
            "cài, lịch sử chuyển giao/thay đổi, IP), hoặc thông tin chi nhánh, nhà cung cấp, loại/nhóm/bộ " +
            "phận thiết bị, PHẢI dùng tool tra cứu phù hợp để lấy dữ liệu thật, không tự bịa số liệu. Nếu câu " +
            "hỏi cần nhiều loại dữ liệu khác nhau, được phép gọi nhiều tool cùng lúc trong 1 lượt thay vì hỏi " +
            "lại người dùng. Các tool chỉ tra cứu (đọc dữ liệu), không thể thêm/sửa/xoá — nếu người dùng " +
            "muốn thay đổi dữ liệu, hướng dẫn họ thao tác trên hệ thống thay vì tự nhận đã thực hiện." +
            "Dữ lấy từ DB phải trả dạng ngôn ngữ nguyên bản ví dụ như: bảng Group có trưởng GroupName là Office "+
            "thì không được phép dịch thành thiết bị văn phòng mà phải trả lại nguyên trạng. Ngoài ra mã thiết tự động hiểu " +
            "ydc 9923 là ydc-9923 này vì mã sẽ được chia thành 2 phần bên chữ bên số được ngăn cách bởi dấu - \n\n" +
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
            "QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL: nếu bạn cần dùng kết quả tool vừa nhận được để gọi thêm " +
            "1 tool khác (vd đã có deviceId từ search_ip_addresses, giờ cần gọi get_device_detail), PHẢI gọi " +
            "tool đó NGAY trong cùng lượt trả lời này — tuyệt đối KHÔNG được viết thành lời hứa kiểu 'tôi sẽ " +
            "dùng...', 'bây giờ tôi sẽ...', 'xin chờ trong giây lát' rồi kết thúc câu trả lời mà không thực sự " +
            "gọi tool, vì hệ thống CHỈ thực thi tool khi bạn gọi tool thật, không đọc được câu chữ mô tả ý " +
            "định. Nếu chưa gọi tool thành công để lấy dữ liệu, TUYỆT ĐỐI không được khẳng định là đã có hoặc " +
            "sắp có kết quả, và không được tự bịa số liệu để hoàn thành những gì đã nói trước đó — nếu không " +
            "chắc, hãy gọi lại tool cần thiết ngay trong lượt hiện tại thay vì suy đoán.";

        // Matches an assistant reply that promises to look something up ("tôi sẽ tra cứu ngay bây giờ",
        // "để tôi kiểm tra", "xin chờ trong giây lát"...) without actually calling a tool — see the
        // unfulfilled-promise guard below and docs/ai-chat-be-huong-dan.md §14.
        private static readonly Regex UnfulfilledPromisePattern = new(
            @"(sẽ\s+(thực hiện|tra cứu|kiểm tra|gọi)|ngay bây giờ|trong giây lát|xin chờ|để tôi\s+(kiểm tra|tra cứu))",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly IOllamaChatClient _ollamaChatClient;
        private readonly IAiChatToolExecutorService _toolExecutor;
        private readonly IConfiguration _configuration;

        public AiChatService(
            IOllamaChatClient ollamaChatClient,
            IAiChatToolExecutorService toolExecutor,
            IConfiguration configuration)
        {
            _ollamaChatClient = ollamaChatClient;
            _toolExecutor = toolExecutor;
            _configuration = configuration;
        }

        public async IAsyncEnumerable<AiChatStreamEventDto> StreamChatAsync(
            AiChatRequestDto request,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var maxRounds = _configuration.GetValue<int?>("AiChatSettings:MaxToolRounds") ?? DefaultMaxToolRounds;
            var think = request.Think ?? false;

            // Emit each device deep-link button at most once per conversation turn, even if the model
            // looks the same device up through several tools/rounds (e.g. search_devices then
            // get_device_detail on the same result) — the FE dedupes on its side too, this just saves
            // a few redundant stream lines.
            var emittedDeviceIds = new HashSet<int>();

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

            // Guard against a reproduced small-model failure mode (docs §14): "tool" messages are never
            // persisted/resent by the FE (AiChatMessageDto only has user/assistant), so if a PAST turn's
            // assistant reply was just a promise ("tôi sẽ tra cứu ngay bây giờ") that ended the round
            // without any real tool_calls, nothing in the resent history proves the lookup happened —
            // yet the model tends to treat its own unfulfilled promise as already-done and fabricates a
            // plausible "result" in the next turn instead of calling the tool for real. Detect that
            // specific shape and inject an explicit correction so the new turn doesn't build on a false
            // premise.
            var lastHistoryMessage = request.History.Count > 0 ? request.History[^1] : null;
            if (lastHistoryMessage != null &&
                lastHistoryMessage.Role == "assistant" &&
                UnfulfilledPromisePattern.IsMatch(lastHistoryMessage.Content ?? ""))
            {
                messages.Add(new OllamaMessageWire
                {
                    Role = "system",
                    Content = "LƯU Ý HỆ THỐNG: tin nhắn trợ lý ngay phía trên có nhắc sẽ tra cứu/kiểm tra " +
                              "nhưng KHÔNG có tool nào thực sự được gọi trong lượt đó — việc tra cứu đó " +
                              "CHƯA từng xảy ra. Nếu câu hỏi hiện tại của người dùng liên quan tới việc tra " +
                              "cứu này, PHẢI gọi tool phù hợp NGAY trong lượt trả lời này, TUYỆT ĐỐI không " +
                              "giả định là đã có kết quả hay bịa số liệu."
                });
            }

            messages.Add(new OllamaMessageWire { Role = "user", Content = request.Message });

            for (var round = 0; round < maxRounds; round++)
            {
                var contentBuilder = new StringBuilder();
                List<OllamaToolCallWire>? toolCalls = null;
                AiChatStreamEventDto? streamError = null;

                // DeepClone() is mandatory — AiChatToolDefinitions.Tools is a shared static node and a
                // JsonNode can only ever be attached to 1 parent (see IOllamaChatClient's remark).
                var enumerator = _ollamaChatClient
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
                            // Đẩy ngay từng mẩu chữ ra FE khi vừa nhận được từ Ollama, đúng thiết kế gốc
                            // (ai-chat-be-huong-dan.md §4: "stream thẳng ra client trong lúc chờ") — TRƯỚC
                            // đây đoạn code này chỉ Append vào contentBuilder mà không yield, nên FE không
                            // nhận được gì cho tới khi CẢ round sinh xong (có thể vài-chục giây với model
                            // cục bộ), rồi mới nhận 1 cục text dồn hết 1 lần ở dòng bên dưới (đã xoá) — cảm
                            // giác "đứng hình rồi dump chữ" chính là nguyên nhân phản hồi có vẻ chậm
                            // (2026-07-27 fix). `yield return` hợp lệ ở đây vì nằm trong try-finally (không
                            // có catch) của vòng ngoài — không nằm trong try-catch của MoveNextAsync() phía
                            // trên.
                            yield return AiChatStreamEventDto.Content(chunk.Message!.Content);
                        }

                        // tool_calls position is NOT fixed in the stream (docs §3) — some models put
                        // it in the middle with more (empty) chunks after; keep whatever we've seen so
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

                    yield return AiChatStreamEventDto.Done();
                    yield break;
                }

                messages.Add(new OllamaMessageWire { Role = "assistant", Content = text, ToolCalls = toolCalls });

                foreach (var call in toolCalls)
                {
                    yield return AiChatStreamEventDto.Tool(call.Function.Name);

                    AiChatToolExecutionResult toolResult;
                    try
                    {
                        toolResult = await _toolExecutor.ExecuteAsync(call.Function.Name, call.Function.Arguments, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        // Defense-in-depth: AiChatToolExecutorService already catches its own errors,
                        // this only guards against something failing before that (e.g. serialization).
                        toolResult = new AiChatToolExecutionResult { Json = $"{{\"error\":\"Lỗi khi thực thi tool: {ex.Message}\"}}" };
                    }

                    messages.Add(new OllamaMessageWire { Role = "tool", Content = toolResult.Json });

                    // Device deep-link buttons (§11) — pure FE metadata, never part of the message
                    // history sent back to Ollama.
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
