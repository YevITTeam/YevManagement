# attendance-aichat-be-huong-dan.md — Trợ lý AI lập đơn tăng ca (Attendance AI Chat)

> ✅ **ĐÃ TRIỂN KHAI (2026-07-29)**. Endpoint: `POST /api/AttendanceAiChat/stream`, permission
> `Attendance.AiChat.Use` (migration `AddAttendanceAiChatPermission`, hiện chỉ gán Admin). Hợp đồng FE
> cuối cùng: [attendance-api-fe.md §10](attendance-api-fe.md). Xem
> [attendance-module.md](attendance-module.md) (mục `AttendanceAiChatController`) cho vị trí code.
>
> Đây là tính năng **song song** với [ai-chat-be-huong-dan.md](ai-chat-be-huong-dan.md) (AI Chat của
> Asset — 17 tool tra cứu, chỉ đọc) chứ **không phải** mở rộng của tính năng đó — 2 endpoint, 2
> permission, 2 orchestrator, 2 system prompt hoàn toàn tách biệt, chỉ dùng chung phần hạ tầng gọi
> Ollama (§1). Lý do tách hoàn toàn: (1) giữ đúng ranh giới module Clean Architecture (Asset không
> được biết Attendance và ngược lại — CLAUDE.md §3.2); (2) đây là **tool ghi dữ liệu đầu tiên** của
> toàn bộ tính năng AI Chat, cần cô lập rủi ro khỏi 17 tool đọc-only của Asset đang ổn định.

## 0. Vì sao đây không phải "thêm 1 tool" đơn giản

Toàn bộ 17 tool của Asset AI Chat cố tình chỉ đọc (xem `ai-chat-be-huong-dan.md §5`, dòng đầu class
comment "16/17 read-only tools"). Tính năng này có đúng **1 tool ghi**: `create_ot_form_draft`, gọi
thẳng `OtFormService.CreateAsync` (không business logic mới, không bypass validate/scope nào đã có).
Rủi ro khác hẳn tra cứu sai:

- **`OtForm` không có endpoint xoá** — đơn tạo sai chỉ sửa được (`PUT /api/OtForm/{id}`, còn Draft/Pending),
  không xoá được. Đây là lý do cơ chế xác nhận trước khi ghi (§4) phải là **cấu trúc**, không chỉ dựa
  system prompt.
- **`NotifyEligibleApproversAsync` chạy vô điều kiện sau mọi lần tạo thành công** — gửi email THẬT cho
  Trưởng nhóm phụ trách Group/Department đó (best-effort, nuốt lỗi SMTP, nhưng không có cách tắt).
  Đơn Draft **không hề "im lặng"**.
- **Model nội bộ đã chứng minh không đáng tin cậy nhiều lần** khi xây Asset AI Chat: từ chối gọi tool
  khi cần (`ai-chat-be-huong-dan.md §13`), bịa kết quả sau khi hứa suông không thực hiện (`§14`). Với
  17 tool đọc, hậu quả tệ nhất là câu trả lời sai. Với tool ghi này, hậu quả tệ nhất là 1 bản ghi
  nghiệp vụ thật + 1 email thật gửi nhầm.

## 1. Hạ tầng dùng chung với Asset AI Chat — chuyển sang Shared.*

`IOllamaChatClient`/`OllamaChatClient`/các wire DTO (`OllamaMessageWire`/`OllamaToolCallWire`/
`OllamaToolCallFunctionWire`/`OllamaChatChunkWire`/`OllamaJson`) đã **chuyển** từ `Asset.Application`/
`Asset.Infrastructure` sang `Shared.Application`/`Shared.Infrastructure` (2026-07-29) — lý do: từ nay
có 2 consumer thật (Asset + Attendance), duplicate 2 bản HTTP client/NDJSON parser nghĩa là phải sửa
lỗi song song mỗi lần (đã tốn 3 vòng sửa lỗi cho bản Asset chỉ trong 1 phiên làm việc trước đó).

Thay đổi chữ ký duy nhất khi move: `StreamChatAsync(List<OllamaMessageWire> messages, JsonNode tools, bool think, CancellationToken)`
— thêm tham số `tools` vì trước đó `OllamaChatClient` hard-code `AiChatToolDefinitions.Tools` (class
tool schema của riêng Asset) ngay trong Infrastructure, không thể dùng chung được. Giờ mỗi module tự
truyền catalogue tool của mình (`AiChatToolDefinitions.Tools.DeepClone()` bên Asset,
`AttendanceAiChatToolDefinitions.Tools.DeepClone()` bên đây).

DI: `CompanySystem.HostApi/Configurations/DependencyInjection.cs` chỉ có **1 dòng**
`AddHttpClient<IOllamaChatClient, OllamaChatClient>(...)` — dùng chung cho cả `AiChatService` (Asset)
và `AttendanceAiChatService` (đây), cùng đọc `AiChatSettings:OllamaBaseUrl`/`TimeoutSeconds`/`Model`/
`Temperature`/`MaxToolRounds` từ `appsettings.json` (không có mục config riêng cho Attendance — cùng 1
Ollama server, cùng 1 model).

**Regression check đã chạy sau khi move** (2026-07-29): `dotnet build` sạch, gọi lại
`POST /api/AiChat/stream` (Asset) với câu hỏi tra cứu đơn giản — stream trả lời đúng như trước khi
refactor, không đổi hành vi.

## 2. Kiến trúc riêng của Attendance AI Chat

```
AttendanceAiChatController (Attendance.Api)
   — đọc CurrentUserName/CurrentFullName/User.IsInRole("Admin") NGAY TẠI ĐÂY (khác AiChatController
     của Asset — không cần biết ai đang hỏi vì 17 tool kia toàn đọc), đóng gói vào
     AttendanceAiChatCallerContext rồi truyền xuống orchestrator.
   ▼
AttendanceAiChatService (Attendance.Application) — vòng lặp tool-calling, y hệt cấu trúc AiChatService
   của Asset (stream content ngay, gom tool_calls từ mọi chunk không rỗng, MaxToolRounds) + thêm cổng
   xác nhận cấu trúc (§4) quanh riêng tool create_ot_form_draft.
   │
   ├──▶ IOllamaChatClient (Shared) — gọi Ollama thật
   │
   └──▶ IAttendanceAiChatToolExecutorService (Attendance.Application)
            dispatch 7 tool → gọi thẳng IDepartmentService/IGroupService/IReasonService/IOtCaseService/
            IEmployeeService/IOtFormService (toàn bộ đã có sẵn, không service mới ngoài GetPrefixUsageAsync
            kiểu Asset — ở đây không cần thêm hàm nào cả, dùng nguyên interface hiện có)
```

> **Quan trọng (từ 2026-07-30)**: 6 tool tra cứu KHÔNG còn là đường chính để lấy dữ liệu danh mục
> nữa — dữ liệu được **nạp sẵn vào context mỗi lượt** qua `BuildReferenceContextAsync` (§16). Tool tra
> cứu chỉ còn là đường dự phòng cho trường hợp Admin (không giới hạn Nhóm) hoặc cần Nhóm khác.

## 3. Danh mục 7 tool

Định nghĩa đầy đủ ở `Attendance.Application/Dtos/AiChat/AttendanceAiChatToolDefinitions.cs`
(raw-string JSON, cùng pattern `AiChatToolDefinitions.cs` của Asset).

| Tool | Gọi tới | Ghi/Đọc |
|---|---|---|
| `search_departments` | `IDepartmentService.GetAllActiveAsync()` (lọc keyword phía executor) | Đọc |
| `search_groups` | `IGroupService.GetAllActiveAsync()`/`GetByDepartmentIdAsync(id)` | Đọc |
| `search_reasons` | `IReasonService.GetAllActiveAsync()` | Đọc |
| `search_ot_cases` | `IOtCaseService.GetAllActiveAsync()` | Đọc |
| `search_employees_by_group` | `IEmployeeService.GetByGroupIdAsync(groupId)` | Đọc |
| `get_my_create_scopes` | `IOtFormService.GetMyCreateScopesAsync(caller.UserName, caller.IsAdmin)` — không tham số, luôn theo danh tính người đang chat. **Phải gọi ĐẦU TIÊN ngay khi người dùng ngỏ ý lập đơn** (2026-07-29, xem changelog) — đa số người dùng chỉ có đúng 1 Nhóm/Bộ phận nên AI không cần hỏi lại. **Admin trả về rỗng = KHÔNG giới hạn** (không phải không được phép ở đâu cả) | Đọc |
| `create_ot_form_draft` | `IOtFormService.CreateAsync(caller.UserName, caller.FullName, caller.IsAdmin, dto)` | **GHI** — tool duy nhất |

`create_ot_form_draft` nhận đủ field như `CreateOtFormDto` thật (không rút gọn): `groupId`,
`departmentId`, `reasonId`, `otCaseId`, `startTime`/`endTime` (HH:mm), `subReason?`, `totalHour`,
`date` (yyyy-MM-dd), `employees[]` (mỗi item `employeeId`, `endTime` riêng, `noteVn?`/`noteJp?`),
`processPart?` (đủ field: ăn/xe đưa đón/copy/3 loại phiếu). `groupId`/`departmentId`/`reasonId`/
`otCaseId`/`employeeId` PHẢI lấy từ tool tra cứu ở trên — description của tool nói rõ điều này, nhưng
đây chỉ là prompt-level, không có validate nào ở tầng BE chặn model tự bịa id (nếu id không tồn tại,
`CreateAsync` tự ném `NotFoundException`/`DomainException`, được executor bắt và trả về JSON lỗi cho
model đọc lại — không crash stream).

## 4. Cơ chế xác nhận trước khi ghi (quan trọng nhất — không chỉ dựa system prompt)

2 lớp, cả 2 trong `AttendanceAiChatService.cs`:

1. **Prompt-level**: `DefaultSystemPrompt` có rule "QUY TẮC XÁC NHẬN TRƯỚC KHI TẠO ĐƠN" — bắt buộc
   trình bày tóm tắt đầy đủ rồi hỏi xác nhận, KHÔNG gọi tool trong CÙNG lượt vừa trình bày tóm tắt.
   Đây là lớp **cần nhưng không đủ**, vì model nhỏ đã chứng minh không tuân theo prompt ổn định (§0).
2. **Structural-level (lớp chặn thật)**: `ConfirmationPattern` — regex khớp các từ khẳng định ngắn ở
   **ĐẦU tin nhắn CỦA NGƯỜI DÙNG** (`request.Message`, KHÔNG phải câu chữ model tự sinh):
   ```
   ^\s*(đồng ý|dong y|xác nhận|xac nhan|ok(ay)?|được|duoc|tạo đi|tao di|yes|confirm)\b
   ```
   Trước khi thực thi bất kỳ `tool_calls` nào tên `create_ot_form_draft`, orchestrator kiểm tra pattern
   này khớp `request.Message` của lượt hiện tại hay không. **Không khớp** → KHÔNG chuyển tool call cho
   executor, tự tổng hợp 1 message `role:"tool"` báo lỗi "chưa xác nhận", tiếp tục vòng lặp — model
   phải trình bày lại và chờ xác nhận thật.

   Điểm mấu chốt: cơ chế này **không thể bị model tự vượt qua** kể cả khi nó hallucinate là đã có xác
   nhận (đúng kiểu lỗi đã thấy ở `ai-chat-be-huong-dan.md §14`) — điều kiện dựa trên tin nhắn CHÍNH
   NGƯỜI DÙNG gõ ở đúng lượt đó, model không tự tạo ra được. Model có gọi `tool_calls` cho
   `create_ot_form_draft` bao nhiêu lần cũng không thực thi được nếu người dùng chưa thực sự xác nhận
   ở lượt đó.
3. `UnfulfilledPromisePattern` (port từ Asset, thêm `tạo` vào nhóm động từ hứa suông:
   `sẽ\s+(thực hiện|tra cứu|kiểm tra|gọi|tạo)`) — vẫn áp dụng y hệt Asset: nếu tin nhắn cuối trong
   history là lời hứa suông không kèm tool call, tự chèn 1 system message nhắc nhở trước lượt mới.

**Giới hạn đã biết**: regex xác nhận chỉ bắt các cụm khẳng định thường gặp, không phải NLP hoàn chỉnh
— người dùng xác nhận bằng cách diễn đạt lạ không khớp regex sẽ bị hỏi lại (an toàn, chấp nhận được).
Rủi ro còn lại: 1 tin nhắn dài bắt đầu bằng "Ok nhưng..." vẫn khớp regex dù ý người dùng chưa hẳn là
xác nhận — chấp nhận đánh đổi này vì hướng an toàn hơn (thà hỏi lại nhầm còn hơn tạo nhầm).

**Đã verify qua HTTP thật với JWT thật (2026-07-29)**: 3 lượt hội thoại — lượt 1 đề xuất tạo đơn (chưa
xác nhận) → không tool call nào cho `create_ot_form_draft`; lượt 2 gõ "Dong y, tao di" nhưng model tự
chọn hỏi lại tóm tắt lần cuối (hành vi thận trọng, không phải lỗi); lượt 3 xác nhận sau tóm tắt →
tool `create_ot_form_draft` được gọi thật, tạo đơn `#18` (Status=Draft, đúng Group/Department/Reason/
OtCase/nhân viên như yêu cầu), `IsEditable=true`, `approvalHistories` rỗng (chưa ai ký) — verify lại
qua `GET /api/OtForm/18` khớp 100% dữ liệu đã gõ.

## 5. Threading danh tính người dùng (khác Asset AI Chat)

`Attendance.Application` không có `IHttpContextAccessor` ở bất kỳ đâu — mọi method cần biết "ai đang
gọi" đều nhận qua tham số string/bool tường minh (đúng pattern `OtFormController.Create` →
`OtFormService.CreateAsync(createdByUserName, createdByFullName, isAdmin, request)`). Tính năng này
theo đúng pattern đó:

- `AttendanceAiChatController.Stream` tự đọc `CurrentUserName`/`CurrentFullName`/`User.IsInRole("Admin")`
  (helper có sẵn từ `BaseController`), đóng gói vào `AttendanceAiChatCallerContext { UserName, FullName, IsAdmin }`.
- `AttendanceAiChatCallerContext` truyền xuống `IAttendanceAiChatService.StreamChatAsync(request, caller, cancellationToken)`
  → `IAttendanceAiChatToolExecutorService.ExecuteAsync(toolName, arguments, caller, cancellationToken)`
  — khác Asset's `ExecuteAsync(toolName, arguments, cancellationToken)` (không cần biết ai hỏi vì toàn
  bộ 17 tool chỉ đọc).
- `get_my_create_scopes` và `create_ot_form_draft` là 2 tool thật sự dùng `caller` — 5 tool tra cứu
  còn lại nhận `caller` nhưng không dùng tới (không có ý nghĩa gì để lọc kết quả theo người hỏi).

## 6. System prompt mặc định (copy nguyên văn từ `AttendanceAiChatService.DefaultSystemPrompt` — nguồn
xác thực là code)

```
Bạn là trợ lý AI nội bộ hỗ trợ lập đơn tăng ca (OT Form) cho công ty. QUY TẮC NGÔN NGỮ (quan
trọng nhất, luôn tuân theo): LUÔN LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng
ngôn ngữ khác hoặc dữ liệu tool trả về có chứa ngôn ngữ khác — tuyệt đối không chêm ngôn ngữ
khác vào câu trả lời.

QUY TẮC TRA CỨU: khi cần biết Nhóm/Bộ phận/Lý do/Trường hợp OT/Nhân viên nào, PHẢI dùng tool
tra cứu phù hợp (search_departments/search_groups/search_reasons/search_ot_cases/
search_employees_by_group/get_my_create_scopes) để lấy id THẬT, TUYỆT ĐỐI không tự bịa số id.
Nếu người dùng đã cung cấp đủ tên Nhóm/Bộ phận/Lý do/Trường hợp OT, PHẢI gọi ngay tool tra cứu
tương ứng thay vì hỏi lại; được phép gọi nhiều tool tra cứu cùng lúc trong 1 lượt.

QUY TẮC KHÔNG BẮT NGƯỜI DÙNG TỰ NHỚ: người dùng KHÔNG nhớ hết id/mã số của Nhóm, Bộ phận, Lý
do, Trường hợp OT, cũng KHÔNG nhớ hết tên đầy đủ của mọi đồng nghiệp trong Nhóm — TUYỆT ĐỐI
không hỏi mở kiểu 'mã Bộ phận của bạn là gì', 'lý do tăng ca của bạn là gì', 'ai tham gia tăng
ca' mà không kèm gợi ý cụ thể, vì người dùng có thể không trả lời được. Quy trình bắt buộc:
(1) Ngay khi cuộc trò chuyện chuyển sang ý định lập đơn (dù người dùng chưa nói chi tiết gì),
PHẢI gọi get_my_create_scopes NGAY LẬP TỨC — TRƯỚC cả khi hỏi bất kỳ câu nào khác — để biết
trước Nhóm/Bộ phận người này được phép tạo đơn; nếu chỉ có đúng 1 lựa chọn thì PHẢI dùng luôn,
không hỏi lại; nếu nhiều lựa chọn thì liệt kê TÊN (không phải id) để người dùng chọn. (2) Khi
cần biết Lý do tăng ca hoặc Trường hợp OT, PHẢI gọi search_reasons/search_ot_cases TRƯỚC rồi
trình bày danh sách tên/mô tả ngắn gọn lấy được để người dùng chọn bằng cách nói lại tên hoặc
số thứ tự — không hỏi trước khi có danh sách trong tay. (3) Ngay khi đã biết groupId, PHẢI gọi
search_employees_by_group và liệt kê TOÀN BỘ tên nhân viên trong Nhóm đó để người dùng chọn ai
tham gia tăng ca (được chọn nhiều người) — không hỏi 'ai tham gia' khi chưa có danh sách để
gợi ý. Nguyên tắc chung: mọi lựa chọn thuộc danh mục có sẵn trong hệ thống PHẢI được tra cứu và
trình bày dưới dạng gợi ý cụ thể trước khi hỏi, không bao giờ hỏi mở và chờ người dùng tự nhớ.

QUY TẮC KHÔNG BỊA KẾT QUẢ: TUYỆT ĐỐI không được nói 'tôi đã gọi tool', 'kết quả tra cứu là...',
'đã tạo đơn thành công' hay đưa ra bất kỳ số liệu/id cụ thể nào nếu KHÔNG có tin nhắn kết quả
tool thật sự nằm ngay phía trên trong lượt trả lời hiện tại. Một tin nhắn trợ lý TRƯỚC ĐÓ (ở
lượt chat cũ) nói 'tôi sẽ tạo đơn ngay bây giờ' KHÔNG phải là bằng chứng việc đó đã xảy ra —
nếu không thấy kết quả tool thật đi kèm, nghĩa là việc đó CHƯA từng được thực hiện, PHẢI gọi
lại tool ngay bây giờ thay vì tiếp tục câu chuyện như thể đã có kết quả. Bịa số liệu hoặc bịa
việc đã tạo đơn để trả lời cho có là lỗi nghiêm trọng hơn nhiều so với việc thừa nhận chưa làm
được.

QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL: nếu bạn cần dùng kết quả tool vừa nhận được để gọi
thêm 1 tool khác, PHẢI gọi tool đó NGAY trong cùng lượt trả lời này — tuyệt đối KHÔNG được viết
thành lời hứa kiểu 'tôi sẽ tạo...', 'bây giờ tôi sẽ...', 'xin chờ trong giây lát' rồi kết thúc
câu trả lời mà không thực sự gọi tool, vì hệ thống CHỈ thực thi tool khi bạn gọi tool thật,
không đọc được câu chữ mô tả ý định.

QUY TẮC XÁC NHẬN TRƯỚC KHI TẠO ĐƠN (quan trọng nhất với tool create_ot_form_draft — đây là
tool DUY NHẤT có thể ghi dữ liệu thật): trước khi gọi tool này, PHẢI trình bày đầy đủ tóm tắt
đơn dự định tạo (Nhóm, Bộ phận, Lý do, Trường hợp OT, ngày, giờ bắt đầu/kết thúc, danh sách
nhân viên kèm giờ kết thúc riêng từng người, thông tin ăn/xe đưa đón nếu có) rồi hỏi người
dùng xác nhận rõ ràng. TUYỆT ĐỐI KHÔNG được gọi tool create_ot_form_draft trong CÙNG lượt vừa
trình bày tóm tắt đó — phải chờ người dùng tự trả lời xác nhận ở lượt kế tiếp. Hệ thống sẽ tự
động chặn việc tạo đơn nếu chưa nhận được xác nhận thật từ người dùng, kể cả khi bạn đã gọi
tool — nên tuyệt đối không tự cho rằng đã có xác nhận nếu người dùng chưa thực sự trả lời
khẳng định.
```

## 7. Frontend

`yev-frontend/src/modules/attendance-ai-chat/` — module **top-level mới**, song song
`modules/ai-chat/` (Asset), KHÔNG lồng trong `modules/attendance/` (component chat có pattern hoàn
toàn khác CRUD form thường của Attendance). Tái dùng nguyên `modules/ai-chat/lib/ai-chat-stream.ts`'s
`readAiChatStream` (đã đổi thành generic `<TEvent = AiChatStreamEvent>` — thay đổi tương thích ngược,
không phá vỡ chỗ gọi cũ bên Asset) và `modules/ai-chat/components/MarkdownMessage.tsx` qua import
thẳng, không fork. `components/AttendanceAiChatBox.tsx` fork từ `AiChatBox.tsx`: đổi `TOOL_LABELS`
cho 7 tool, đổi sự kiện `device`→`otform` (nút "Xem đơn vừa tạo" điều hướng `/ot/forms/edit?id=`),
thêm dải cảnh báo cố định "xác nhận sẽ tạo THẬT + gửi THẬT email" ngay dưới header (không để cảm giác
"chỉ là xem trước"). Route mới `/ot/ai-chat` (`app/[locale]/(ot-manager)/ot/ai-chat/page.tsx`), thêm
vào `OtManagerSidebar.tsx` (permission `Attendance.AiChat.Use`) và tile ở `ot/page.tsx` (**có** gate
permission, khác 2 tile cũ không gate — vì permission này hiện chỉ Admin có, hiện tile cho người
không có quyền sẽ dẫn tới lỗi 403 vô nghĩa).

## 8. Việc chưa làm / cân nhắc sau

- Gán `Attendance.AiChat.Use` cho Role "Trưởng nhóm"/"Nhân viên" (2 role hiện có
  `Attendance.OTForm.Create`) — cố tình chưa làm ở migration đầu, chờ verify ổn với Admin trước.
- Regex `ConfirmationPattern` mới bắt tiếng Việt phổ biến — nếu thấy người dùng thật xác nhận bằng
  cách diễn đạt khác không khớp, bổ sung thêm cụm vào regex (không đổi cấu trúc).
- Chưa test luồng khi model đưa `employeeId` không cùng Group với `groupId` đã chọn (nhánh
  `ValidateEmployeesAsync` trong `OtFormService.CreateAsync` sẽ ném `DomainException`, executor bắt
  và trả JSON lỗi — về lý thuyết đã đúng theo review code, nhưng chưa có transcript thật ghi nhận).

**Cập nhật 2026-07-29**: người dùng test thật gặp 2 vấn đề, cả 2 đã sửa (áp dụng đồng thời cho cả
Attendance và Asset AI Chat vì cùng chung 1 lỗi cấu trúc trong orchestrator):
1. **Model hứa suông 2 lượt liên tiếp** ("để tôi tra cứu giúp bạn" → không gọi tool → người dùng hỏi
   lại → vẫn chỉ xin lỗi + hứa lại) — nguyên nhân: vòng lặp orchestrator kết thúc lượt ngay khi model
   trả lời text mà không có `tool_calls`, guard chống-hứa-suông cũ chỉ kiểm tra ở đầu lượt KẾ TIẾP nên
   không ép được model gọi tool ngay. Đã thêm auto-retry CÙNG LƯỢT: nếu text khớp
   `UnfulfilledPromisePattern` mà không có `tool_calls`, tự nhúng 1 system message nhắc nhở và gọi lại
   model ngay trong cùng request (tối đa `MaxPromiseRetries = 2` lần) thay vì trả `done` và chờ người
   dùng tự nhắc.
2. **Bắt người dùng tự nhớ mã Nhóm/Bộ phận** — model hỏi tên/mã Nhóm-Bộ phận-Trường hợp OT ngay từ
   đầu thay vì tự tra cứu, dù `get_my_create_scopes` đã đủ dữ liệu (tên + id) để tự động chọn khi
   người dùng chỉ có 1 lựa chọn hợp lệ. Đã thêm quy tắc mới "QUY TẮC KHÔNG BẮT NGƯỜI DÙNG NHỚ MÃ/ID"
   (§6) + sửa mô tả tool `get_my_create_scopes` (§3) yêu cầu gọi tool này ĐẦU TIÊN ngay khi người
   dùng ngỏ ý lập đơn, dùng luôn nếu chỉ có 1 lựa chọn, chỉ hỏi lại bằng TÊN nếu có nhiều lựa chọn.

**Cập nhật 2026-07-29 (2)**: người dùng tiếp tục phản hồi là toàn bộ luồng chat vẫn đang bắt họ
"nhớ" thông tin để cung cấp cho AI — không chỉ mã Nhóm/Bộ phận (đã sửa ở trên) mà cả Lý do tăng
ca, Trường hợp OT, và tên đầy đủ của đồng nghiệp trong Nhóm để điền vào danh sách nhân viên tham
gia — những thứ người dùng thường không nhớ chính xác. Nguyên nhân: quy tắc §6 (bản trước) chỉ nói
"khi cần biết X thì gọi tool tra cứu để lấy id thật", tức là hướng dẫn AI tự tra để đừng BỊA id,
chứ không bắt buộc AI phải TRÌNH BÀY kết quả tra cứu đó dưới dạng danh sách gợi ý cho người dùng
CHỌN trước khi hỏi — nên model vẫn hỏi mở ("lý do tăng ca của bạn là gì?") và chờ người dùng tự
gõ đúng tên hợp lệ. Đã đổi quy tắc "QUY TẮC KHÔNG BẮT NGƯỜI DÙNG NHỚ MÃ/ID" (§6) thành "QUY TẮC
KHÔNG BẮT NGƯỜI DÙNG TỰ NHỚ" — mở rộng phạm vi + thêm quy trình 3 bước bắt buộc: (1) gọi
`get_my_create_scopes` trước tiên cho Nhóm/Bộ phận (như cũ); (2) gọi `search_reasons`/
`search_ot_cases` TRƯỚC khi hỏi Lý do/Trường hợp OT, trình bày danh sách cho người dùng chọn;
(3) ngay khi biết `groupId`, gọi `search_employees_by_group` và liệt kê TOÀN BỘ tên nhân viên
trong Nhóm để người dùng chọn ai tham gia — không hỏi trước khi có danh sách. Đồng thời sửa mô tả
3 tool `search_reasons`/`search_ot_cases`/`search_employees_by_group` (§3) nhấn mạnh "gọi tool này
NGAY, trước khi hỏi người dùng" để củng cố hành vi ở tầng tool-description, không chỉ system prompt.

## 16. Cập nhật 2026-07-30: nạp sẵn dữ liệu tham chiếu vào context (bỏ phụ thuộc tool tra cứu)

Đây là thay đổi kiến trúc **quan trọng nhất** của tính năng này. Nguồn: transcript thật của người dùng
cho thấy 3 lỗi cùng lúc, tất cả đều là hệ quả của việc **bắt model tự gọi tool để lấy dữ liệu danh mục**:

1. **Bịa nguyên danh sách kèm id SAI.** Model tự đưa ra danh sách Trường hợp OT hoàn toàn không tồn tại
   ("TH1: Tăng ca theo lịch làm việc", "TH2: Tăng ca đột xuất", "TH3: Tăng ca dự án đặc biệt"). Sau khi
   bị người dùng vặn, nó "tra lại" và ra danh sách đúng tên nhưng vẫn **gán sai id**: nói `TH1 (ID: 2)`
   trong khi DB thật `TH1 = id 1`, `id 2 = TH2 (Nghỉ ngày lễ/Chủ nhật)`. **Nếu lượt đó tạo đơn thật, đơn
   sẽ ghi sai Trường hợp OT mà không ai phát hiện** — nguy hiểm hơn mọi bug trước đó vì kết quả trông
   hợp lệ hoàn toàn. Model cũng bịa danh sách nhân viên bằng tên placeholder ("Nguyễn Văn A (ID: 101)").
2. **Đốt hết ngân sách tool round.** Luồng lập đơn cần ít nhất 4 lần tra cứu (scopes → reasons →
   ot_cases → employees) rồi mới tới `create_ot_form_draft`, trong khi `MaxToolRounds = 3` (dùng chung
   với Asset) → người dùng gặp "Đã đạt giới hạn số lần gọi công cụ" giữa lúc đang khai form.
3. **Mất trắng kết quả tra cứu giữa các lượt.** `AttendanceAiChatMessageDto` chỉ có role
   `user`/`assistant` — FE **không bao giờ** gửi lại message `role:"tool"`. Nên sang lượt sau, model
   không còn bằng chứng nào về dữ liệu đã tra, chỉ còn thấy chính câu văn nó từng viết → nó "nhớ" là đã
   có danh sách rồi và **tái tạo lại bằng cách bịa** thay vì tra lại. Đây là lý do gốc khiến 2 vòng sửa
   trước (chỉ siết system prompt + tool description) không thể khỏi hẳn: prompt không tạo ra được dữ liệu.

**Cách sửa (đúng gốc, không phải siết prompt thêm)**: dữ liệu danh mục ở đây **nhỏ, tĩnh, và luôn cần** —
kiểm chứng bằng dữ liệu thật: phạm vi tạo đơn của 1 người thường **1** lựa chọn, Trường hợp OT **3**,
nhân viên 1 Nhóm **7**, Lý do **72** (chỉ tên). Tổng cộng ~83 dòng text ngắn. Loại dữ liệu như vậy phải
được **nạp thẳng vào context một cách tất định**, không đặt sau 1 tool call mà model có thể bỏ qua hoặc
nói dối về kết quả.

- Thêm `IAttendanceAiChatToolExecutorService.BuildReferenceContextAsync(caller, ct)` → trả về 1 block
  **plain text** (không phải JSON — model tái tạo "id 1 = TH1" chính xác hơn nhiều từ dòng phẳng có nhãn,
  lại tốn ít token hơn) gồm: ngày hôm nay (để quy đổi "ngày mai"), phạm vi tạo đơn (kèm `groupId`/
  `departmentId` thật), nhân viên của Nhóm (chỉ nạp khi có **đúng 1** phạm vi — nhiều phạm vi thì chưa
  biết Nhóm nào, nạp hết sẽ phình vô ích), toàn bộ Trường hợp OT, toàn bộ Lý do.
- `AttendanceAiChatService.StreamChatAsync` chèn block này thành 1 message `system` thứ hai, **mỗi lượt**
  (không dựa vào history vì history không mang theo dữ liệu tool — xem lỗi 3 ở trên).
- System prompt (§6) đổi trọng tâm: thêm "QUY TẮC DÙNG DỮ LIỆU CÓ SẴN" (lấy id từ đúng block dữ liệu,
  cấm suy đoán id theo thứ tự xuất hiện — chính là lỗi `TH1 → id 2`) và "QUY TẮC BẮT BUỘC LIỆT KÊ LỰA
  CHỌN" (không được hỏi suông "ai tham gia tăng ca" mà phải liệt kê sẵn danh sách đánh số). 6 tool tra
  cứu bị hạ xuống thành đường dự phòng (§3).
- Tách ngân sách round riêng: `AiChatSettings:AttendanceMaxToolRounds = 5` (mặc định code cũng 5), **không**
  nâng `MaxToolRounds` dùng chung — mỗi round là 1 lần gọi model đầy đủ (~20-30s trên Ollama chạy CPU),
  luồng read-only của Asset không cần headroom này.
- `BuildReferenceContextAsync` không bao giờ throw: lỗi tra cứu → giữ phần đã lấy được + chèn dòng CẢNH
  BÁO yêu cầu dùng tool cho phần thiếu (danh sách bị cắt dở chính là thứ model hay "hoàn thiện" bằng cách
  bịa thêm).

**Kết quả đo thật** (cùng câu hỏi "Tạo đơn tăng ca cho nhóm của tôi ngày 31/07/2026 từ 18:00 đến 20:00",
tài khoản có đúng 1 phạm vi = Công vụ - IT):

| | Trước | Sau |
|---|---|---|
| Số tool call để hỏi xong thông tin | 4+ (thường hết ngân sách) | **0** |
| Trường hợp OT | bịa danh sách, `TH1 → id 2` (SAI) | `otCaseId=1` TH1, `2` TH2, `3` TH3 — đúng DB |
| Nhân viên | bịa "Nguyễn Văn A (ID: 101)" | 7/7 người thật, đúng id, đúng thứ tự DB |
| Nhóm/Bộ phận | hỏi lại người dùng | tự nhận đúng `groupId=6`/`departmentId=6` |

Hạn chế còn lại: danh sách Lý do (72 mục) vẫn nạp full vào context nhưng model được yêu cầu hỏi mô tả
công việc rồi tự lọc 5-10 mục — nếu sau này số Lý do tăng nhiều (hàng trăm) nên cân nhắc lọc sẵn phía
server thay vì nạp hết. Việc tạo đơn thật vẫn giữ nguyên cổng xác nhận cấu trúc (§4), không nới lỏng.
