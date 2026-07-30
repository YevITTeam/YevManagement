# ai-chat-be-huong-dan.md — Chuyển AI Chat (tool-calling) từ FE sang BE

> ✅ **ĐÃ TRIỂN KHAI (2026-07-24)**, khớp với spec dưới đây. Xem
> [asset-module.md §1.18](asset-module.md) (chi tiết code/kiến trúc, **nguồn xác thực khi có sai
> khác với file này**) và [asset-api-fe.md §7c](asset-api-fe.md) (hợp đồng FE cuối cùng). Endpoint:
> `POST /api/AiChat/stream`, permission `Asset.AiChat.Use` (đã seed + gán `Admin`).
>
> **Cập nhật 2026-07-27** (fix chậm + tool-calling không ổn định — xem asset-module.md §1.18 để biết
> chi tiết): (1) bản đầu tiên KHÔNG stream đúng như pseudocode §4 mô tả — gom hết cả round rồi mới
> gửi 1 lần, đã sửa; (2) payload gọi Ollama thêm `"options":{"temperature":0.3}` (không có trong ví
> dụ payload gốc ở §3 dưới đây); (3) `HttpClient.Timeout` nâng 120s → 300s (cấu hình được).
>
> **Cập nhật 2026-07-27 (2)**: thêm tool thứ 17 `get_ip_prefix_usage` — tra cứu IP nào đang dùng/còn
> trống trong 1 dải mạng (§5, §6). Hàm mới `IpAddressService.GetPrefixUsageAsync` (`IIpAddressService`,
> `Asset.Application/Services/IpAddressService.cs`), không đụng `IpAddressFilterRequest`/`grid-list`
> hiện có.
>
> **Cập nhật 2026-07-27 (3)**: thêm nút "Xem chi tiết thiết bị" (dòng NDJSON mới `{"type":"device"}`)
> + toggle bật/tắt suy luận sâu (field request mới `think?: boolean`), và redesign UI
> `AiChatBox.tsx` (bubble/avatar/toolbar/gợi ý câu hỏi, nút sao chép câu trả lời) — chi tiết ở §11.
> Đổi model & gửi ảnh **hoãn lại**: server Ollama hiện chỉ có 1 model, không có capability `"vision"`.
>
> **Cập nhật 2026-07-27 (4)**: fix bug gõ mã thiết bị thiếu gạch ngang (`"ydc 9875"` → tool báo
> không tìm thấy dù thiết bị tồn tại là `"ydc-9875"`) — chuẩn hoá `deviceCode` bằng regex trước khi
> tra cứu thay vì chỉ dựa vào system prompt. Chi tiết §12.
>
> **Cập nhật 2026-07-27 (5)**: fix tiếp bug khác cùng luồng — model hỏi lại "mã thiết bị chính xác
> là gì" thay vì gọi tool luôn dù người dùng đã cung cấp đủ (`"ydc 9875"`). Thêm rule mới vào
> `DefaultSystemPrompt` (§9) cấm hỏi lại trước khi thử gọi tool. Chi tiết §13.
>
> **Cập nhật 2026-07-29**: fix bug nghiêm trọng hơn — model TỰ BỊA kết quả tra cứu (vd tự nói "đã
> gọi tool, IP là 10.20.30.150" trong khi chưa hề gọi tool nào) sau khi 1 lượt trước đó của chính nó
> chỉ hứa suông "tôi sẽ tra cứu ngay bây giờ" mà không thực sự gọi tool. Thêm rule "KHÔNG BỊA KẾT
> QUẢ TRA CỨU" vào `DefaultSystemPrompt` (§9) + guard cấu trúc ở `AiChatService` phát hiện lời hứa
> chưa thực hiện trong lịch sử và tự chèn 1 tin nhắn `system` nhắc nhở trước khi gọi Ollama lại. Chi
> tiết §14.
>
> **Cập nhật 2026-07-29 (2)**: `IOllamaChatClient`/`OllamaChatClient`/wire DTO (`OllamaMessageWire`
> v.v.) đã **chuyển từ `Asset.Application`/`Asset.Infrastructure` sang `Shared.Application`/
> `Shared.Infrastructure`** — lý do: Attendance module vừa có tính năng AI Chat riêng
> ([attendance-aichat-be-huong-dan.md](attendance-aichat-be-huong-dan.md), tạo đơn tăng ca qua hội
> thoại), cần dùng chung hạ tầng gọi Ollama thay vì fork 1 bản. Thay đổi chữ ký duy nhất:
> `StreamChatAsync` nhận thêm tham số `JsonNode tools` (trước đó hard-code
> `AiChatToolDefinitions.Tools` ngay trong Infrastructure) — `AiChatService.cs` giờ tự truyền
> `AiChatToolDefinitions.Tools.DeepClone()` ở call site. Hành vi/API bên ngoài (endpoint
> `POST /api/AiChat/stream`, hợp đồng NDJSON) **không đổi gì** — đã regression-test lại bằng
> `dotnet build` + gọi thật `POST /api/AiChat/stream`, trả lời đúng như trước khi refactor.

> Hướng dẫn cho đội BE (.NET) triển khai lại phần "Chat với AI" đang chạy tạm ở FE
> (`src/modules/ai-chat/`) thành 1 endpoint BE thật. Đọc kèm [asset-api-fe.md](asset-api-fe.md)
> để đối chiếu field/route của các API Asset mà tool bên dưới sẽ gọi.

## 0. Vì sao chuyển, và vì sao BẮT BUỘC phải là BE .NET

- **Production build của FE là static export** (`next.config.ts` có `output: "export"`, hiện tạm
  comment ở máy dev cho tiện — bản build thật vẫn export). Static export = **không có Node server
  chạy ở production**, nên **không thể** thêm 1 Next.js API route làm lớp trung gian — lựa chọn
  chỉ có "chạy thẳng trên trình duyệt" (hiện tại) hoặc "BE .NET thật".
- Cách hiện tại (FE gọi thẳng Ollama + tự thực thi tool bằng cách gọi ngược lại BE .NET qua HTTP
  từ trình duyệt) có 3 vấn đề: (1) địa chỉ server Ollama nội bộ lộ thẳng trong bundle JS, ai trong
  mạng LAN cũng gọi thẳng được, không qua kiểm soát; (2) không audit/rate-limit được ai dùng AI bao
  nhiêu; (3) việc "gọi tool" phải vòng qua HTTP (browser → BE → DB) thay vì BE tự gọi service nội
  bộ của chính nó.

## 1. Kiến trúc hiện tại ở FE (để đối chiếu khi viết lại)

```
Browser ──stream──▶ Ollama /api/chat (10.45.6.70:11434, lộ thẳng ra ngoài)
   │                     │ model quyết định gọi tool (JSON tool_calls)
   │◀────────────────────┘
   ├─ thực thi tool: Browser tự gọi lại BE .NET qua HTTP (DeviceApi.getXxx, BranchApi.getXxx...)
   ├─ đẩy kết quả tool (role "tool") vào lại messages[]
   └─ gọi lại Ollama /api/chat lần 2 để model chốt câu trả lời (lặp tối đa 3 lượt)
```

Code nguồn tham khảo (sẽ bị thay thế/rút gọn khi BE đảm nhiệm):
- [chat.api.ts](../src/modules/ai-chat/api/chat.api.ts) — gọi thẳng `/api/chat` của Ollama.
- [deviceTools.ts](../src/modules/ai-chat/lib/deviceTools.ts) — khai báo 16 tool + thực thi bằng
  cách gọi các `XxxApi` (tức gọi HTTP sang BE .NET) của module `pc-management`.
- [ChatBox.tsx](../src/modules/ai-chat/components/ChatBox.tsx) — vòng lặp tool-calling phía client
  (state `historyRef`, `MAX_TOOL_ROUNDS = 3`).

## 2. Kiến trúc đề xuất sau khi chuyển

```
Browser ──stream──▶ BE .NET (endpoint mới, có Bearer token như mọi API khác)
                        │
                        ├─ BE gọi Ollama /api/chat (địa chỉ nội bộ, KHÔNG lộ ra FE nữa)
                        ├─ model chọn tool → BE gọi thẳng service/repository nội bộ
                        │   (KHÔNG cần tự gọi HTTP vào chính mình)
                        ├─ lặp tối đa 3 lượt như cũ
                        └─ BE stream kết quả (đã rút gọn, xem mục 7) về Browser
```

FE sau khi chuyển chỉ còn: gửi 1 request, đọc stream, hiển thị — không còn giữ logic tool-calling
(xem mục 8).

## 3. Hợp đồng với Ollama (dependency ngoài — giữ nguyên khi chuyển, chỉ đổi *ai* gọi)

- Endpoint: `POST http://<ollama-host>:11434/api/chat` (host/model nên đưa vào `appsettings`, có
  thể đổi môi trường mà không cần build lại — hiện FE đang hard-code qua biến môi trường
  `NEXT_PUBLIC_AI_CHAT_API_URL` / `NEXT_PUBLIC_AI_CHAT_MODEL`, xem giá trị hiện tại trong
  `.env.local`).
- Request body:
  ```jsonc
  {
    "model": "gemma4:e2b",       // đổi được, hiện là model "thinking" (Qwen/Gemma dạng suy luận)
    "messages": [ /* xem field bên dưới */ ],
    "tools": [ /* mục 5 */ ],     // bỏ trống nếu lượt gọi không cần tool
    "stream": true,
    "think": false                 // XEM LƯU Ý DƯỚI — bắt buộc set false
  }
  ```
- **`"think": false` là bắt buộc, không phải tối ưu tuỳ chọn.** Model hiện tại là dạng "thinking"
  (sinh chain-of-thought ẩn trước khi trả lời/gọi tool). Đã đo thực tế: cùng 1 câu hỏi, có
  thinking mất **~19 giây**, tắt thinking chỉ **~2.5 giây** (kết quả cuối giống hệt nhau). Model
  không hỗ trợ "thinking" sẽ tự bỏ qua field này, không lỗi — nên cứ luôn gửi `false`.
- **KHÔNG dùng `format` (structured output) cùng lúc với `tools`.** Đã test: khi bật cả 2, model
  không còn trả `message.tool_calls` đúng cấu trúc nữa mà nhét 1 chuỗi JSON méo (sai tên field)
  vào `message.content` — vòng lặp tool-calling sẽ đọc nhầm là "model không gọi tool".
- `messages[]` — mỗi phần tử:
  ```ts
  { role: "system" | "user" | "assistant" | "tool", content: string, tool_calls?: ToolCall[] }
  ```
  `tool_calls` chỉ xuất hiện ở message role `"assistant"` khi model chọn gọi tool.
- Response là **NDJSON** (mỗi dòng 1 JSON, kết thúc `\n`), không phải 1 JSON envelope duy nhất:
  ```jsonc
  {"model":"...", "created_at":"...", "message":{"role":"assistant","content":"..."}, "done":false}
  ```
  Dòng cuối có `"done": true` kèm thống kê (`eval_count`, `total_duration`...).
- **⚠️ Vị trí `tool_calls` trong stream KHÔNG cố định — đây là bug thực tế đã gặp và phải tránh khi
  viết lại ở BE:**
  - Có model (đã test: `qwen-dich-thuat`) trả `tool_calls` ở **đúng chunk cuối cùng** (`done:true`).
  - Có model (đã test: `gemma4:e2b`, dạng "thinking") trả `tool_calls` ở **1 chunk giữa dòng**
    (`done:false`), sau đó **còn thêm 1 chunk rỗng cuối cùng** (`done:true`, không có `tool_calls`).
  - ⇒ Khi đọc stream, **phải giữ lại `tool_calls` từ bất kỳ chunk nào có nó khác rỗng**, không
    được chỉ đọc từ chunk cuối cùng nhận được (chunk rỗng phía sau sẽ ghi đè mất). Xem cách FE xử
    lý ở [ChatBox.tsx](../src/modules/ai-chat/components/ChatBox.tsx) (biến `toolCallsBox`).

## 4. Vòng lặp tool-calling (orchestration) — pseudocode

```
MAX_TOOL_ROUNDS = 3   // chặn model gọi tool lặp vô hạn

messages = [system, ...history, { role: "user", content: userMessage }]
toolsUsed = []

for round in 1..MAX_TOOL_ROUNDS:
    (streamedText, toolCalls) = CallOllamaChat(messages, tools=DEVICE_TOOLS)
    // streamedText: nối dần message.content qua các chunk, stream thẳng ra client trong lúc chờ
    // toolCalls: xem mục 3 — thu thập xuyên suốt stream, không chỉ đọc chunk cuối

    if toolCalls rỗng:
        messages.push({ role: "assistant", content: streamedText })
        break   // xong, đây là câu trả lời cuối cùng

    messages.push({ role: "assistant", content: streamedText, tool_calls: toolCalls })
    for call in toolCalls:
        toolsUsed.push(call.function.name)
        result = ExecuteTool(call.function.name, call.function.arguments)  // mục 5, gọi service nội bộ
        messages.push({ role: "tool", content: JSON.stringify(result) })
    // lặp lại vòng for để model đọc kết quả tool và chốt câu trả lời (hoặc gọi tiếp tool khác)
```

Lưu ý khi hiện thực bằng C#: mỗi tool PHẢI bọc try/catch riêng, trả lỗi dạng
`{"error": "..."}` vào message `"tool"` thay vì throw — throw sẽ làm gãy cả vòng hỏi-đáp giữa
chừng (xem cách FE làm trong `runDeviceTool`).

## 5. Danh mục tool — CHỈ ĐỌC, không tool nào được phép gọi create/update/delete

> ⚠️ **ĐÃ LỖI THỜI MỘT PHẦN (2026-07-30)**: mục này mô tả catalogue **17 tool** ban đầu. Catalogue thực
> tế đang chạy chỉ còn **7 tool** — 10 tool đã bị bỏ khỏi `AiChatToolDefinitions.cs` để giảm prompt-eval
> (xem **§16** để biết danh sách giữ/bỏ, lý do, và cách phục hồi). Mục này được giữ lại vì vẫn là tài
> liệu chính xác về *cách map từng tool sang service nội bộ*, kể cả các tool đang tắt (executor case của
> chúng vẫn còn trong code). **Nguồn chân lý về tool nào đang bật là `AiChatToolDefinitions.cs`**, không
> phải bảng dưới đây.

Nguyên tắc: mỗi tool ứng với đúng 1 câu hỏi tra cứu, gọi thẳng **service/repository nội bộ** của
BE (không tự gọi HTTP vào chính mình). Cột "Route tương đương" đối chiếu [asset-api-fe.md](asset-api-fe.md)
để khớp field/query — dùng cho việc map sang service, không có nghĩa là BE phải gọi qua HTTP.

| Tool | Route tương đương | Ghi chú |
|---|---|---|
| `search_devices` | `GET /api/Device/grid-list` | Lọc `deviceCode/manager/ipAddress/email/supplierName`, `pageSize=10` |
| `get_device_detail` | `GET /api/Device/{id}/detail` | Chỉ nhận `deviceCode` → resolve `id` trước (mục 6) |
| `get_device_transfer_history` | `GET /api/TransferHistory/device/{deviceId}` | Resolve `deviceCode` → `id` trước |
| `get_device_change_history` | `GET /api/AuditTrail/record?tableName=Device&recordId={id}` | Resolve `deviceCode` → `id` trước |
| `search_device_types` | `GET /api/DeviceType/grid-list` | |
| `search_device_groups` | `GET /api/DeviceGroup/grid-list` | |
| `search_device_departments` | `GET /api/DeviceDepartment/grid-list` | |
| `search_software` | `GET /api/Software/grid-list` | |
| `search_ip_addresses` | `GET /api/IpAddress/grid-list` | Có `deviceCode` thì resolve → `deviceId` trước khi lọc |
| `search_branches` | `GET /api/Branch/grid-list` | |
| `search_suppliers` | `GET /api/Supplier/grid-list` | |
| `search_software_groups` | `GET /api/SoftwareGroup/grid-list` | |
| `search_ip_prefixes` | `GET /api/IpPrefix/grid-list` | |
| `get_ip_prefix_usage` | *(không có route sẵn — hàm mới `IpAddressService.GetPrefixUsageAsync`, 2026-07-27)* | Nhận **đúng** 1 dải mạng 3 octet (vd `10.45.1`), trả IP nào đang gán cho thiết bị nào + IP nào còn trống, kèm tổng số đã dùng/còn trống. **Không** resolve gần đúng như mục 6 — khớp chính xác chuỗi `Prefix`, không thấy thì báo lỗi (tránh báo nhầm dải mạng do `Contains` bắt dính "10.45.1" vào cả "10.45.10"/"10.45.11"...). |
| `get_device_report` | `GET /api/Report/device-list` | Nhận **tên** loại thiết bị/chi nhánh → resolve sang `deviceTypeId`/`branchId` (mục 6) |
| `get_asset_settings` | `GET /api/AssetSetting` | Không tham số |
| `search_audit_trail` | `GET /api/AuditTrail/grid-list` | Nhật ký **toàn hệ thống**, khác `get_device_change_history` (chỉ 1 thiết bị) |

Tất cả tool đều **giới hạn tối đa 10 kết quả** (`MAX_RESULTS = 10` ở FE) — giữ nguyên khi viết lại
để tránh nhét quá nhiều token vào context của model. `get_ip_prefix_usage` áp dụng cùng giới hạn cho
cả 2 danh sách (`usedIpAddresses`/`availableIpAddresses`) nhưng vẫn trả `usedCount`/`availableCount`
tính trên **toàn bộ** tập trước khi cắt, để model không nói sai tổng số khi danh sách bị rút gọn.

### JSON Schema đầy đủ (16 tool đầu copy nguyên từ [deviceTools.ts](../src/modules/ai-chat/lib/deviceTools.ts);
`get_ip_prefix_usage` thêm sau khi chuyển sang BE — 2026-07-27, không tồn tại ở bản FE cũ — gửi nguyên
trong field `tools` của request Ollama)

```json
[
  {
    "type": "function",
    "function": {
      "name": "search_devices",
      "description": "Tra cứu DANH SÁCH thiết bị (PC) theo mã thiết bị, người quản lý, địa chỉ IP, email hoặc tên nhà cung cấp. Trả về tối đa 10 kết quả gần đúng nhất. Dùng khi chưa biết chính xác mã thiết bị hoặc cần liệt kê nhiều máy.",
      "parameters": {
        "type": "object",
        "properties": {
          "deviceCode": { "type": "string", "description": "Mã thiết bị (tìm gần đúng)" },
          "manager": { "type": "string", "description": "Tên người quản lý/đang sử dụng thiết bị" },
          "ipAddress": { "type": "string", "description": "Địa chỉ IP của thiết bị" },
          "email": { "type": "string", "description": "Email gắn với thiết bị" },
          "supplierName": { "type": "string", "description": "Tên nhà cung cấp" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_device_detail",
      "description": "Lấy THÔNG TIN CHI TIẾT đầy đủ của ĐÚNG 1 thiết bị theo mã thiết bị: thông tin chung (chi nhánh, nhà cung cấp, loại máy, nhóm/bộ phận, người quản lý, email, IP, ngày mua, hạn khấu hao, trạng thái...), cấu hình phần cứng (CPU/RAM/ổ cứng/màn hình...) và danh sách phần mềm đã cài. Dùng khi đã biết chính xác mã thiết bị và cần biết đầy đủ thông tin về máy đó.",
      "parameters": {
        "type": "object",
        "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem chi tiết" } },
        "required": ["deviceCode"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_device_transfer_history",
      "description": "Lấy lịch sử chuyển giao/đổi máy (thiết bị cũ → thiết bị mới) liên quan tới 1 thiết bị theo mã thiết bị.",
      "parameters": {
        "type": "object",
        "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem lịch sử chuyển giao" } },
        "required": ["deviceCode"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_device_change_history",
      "description": "Lấy lịch sử thay đổi (tạo mới/sửa/xoá/khôi phục) của 1 thiết bị theo mã thiết bị, kèm ai sửa và sửa lúc nào.",
      "parameters": {
        "type": "object",
        "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem lịch sử thay đổi" } },
        "required": ["deviceCode"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_device_types",
      "description": "Tra cứu danh sách loại thiết bị (vd Laptop, Desktop, Màn hình...) theo từ khoá.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã loại thiết bị" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_device_groups",
      "description": "Tra cứu danh sách Nhóm thiết bị theo từ khoá tên/mã nhóm.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhóm" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_device_departments",
      "description": "Tra cứu danh sách Bộ phận quản lý thiết bị theo từ khoá tên/mã bộ phận.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã bộ phận" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_software",
      "description": "Tra cứu danh sách phần mềm trong danh mục (không phải phần mềm đã cài trên máy nào) theo từ khoá tên/mã phần mềm.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã phần mềm" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_ip_addresses",
      "description": "Tra cứu địa chỉ IP theo từ khoá (địa chỉ IP/ghi chú) hoặc theo mã thiết bị đang được gán IP đó.",
      "parameters": {
        "type": "object",
        "properties": {
          "keyword": { "type": "string", "description": "Từ khoá địa chỉ IP hoặc ghi chú" },
          "deviceCode": { "type": "string", "description": "Mã thiết bị đang được gán IP" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_branches",
      "description": "Tra cứu danh sách chi nhánh theo từ khoá tên hoặc mã chi nhánh.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã chi nhánh" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_suppliers",
      "description": "Tra cứu danh sách nhà cung cấp thiết bị theo từ khoá tên hoặc mã nhà cung cấp.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhà cung cấp" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_software_groups",
      "description": "Tra cứu danh sách Nhóm phần mềm (danh mục phân loại phần mềm) theo từ khoá tên/mã nhóm.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhóm phần mềm" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_ip_prefixes",
      "description": "Tra cứu danh sách dải mạng (subnet/IP prefix) theo từ khoá — gồm chi nhánh sở hữu, subnet mask, gateway, DNS, số IP đã dùng/còn trống trong dải.",
      "parameters": {
        "type": "object",
        "properties": { "keyword": { "type": "string", "description": "Từ khoá dải mạng hoặc mô tả" } },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_ip_prefix_usage",
      "description": "Lấy tình trạng sử dụng của 1 dải mạng (IP prefix, dạng 3 octet vd \"10.45.1\"): IP nào đang được gán cho thiết bị nào, và IP nào còn trống chưa sử dụng, kèm tổng số IP đã dùng/còn trống. Dùng khi hỏi kiểu \"dải 10.45.1 còn IP nào trống\", \"IP nào trong dải 10.45.1 đang được dùng\". Muốn tra 1 địa chỉ IP cụ thể hoặc theo mã thiết bị thì dùng search_ip_addresses thay vì tool này.",
      "parameters": {
        "type": "object",
        "properties": { "prefix": { "type": "string", "description": "Dải mạng 3 octet cần tra cứu, vd \"10.45.1\"" } },
        "required": ["prefix"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_device_report",
      "description": "Lấy BÁO CÁO danh sách thiết bị phục vụ thống kê/kế toán: ngày mua, hạn khấu hao, tình trạng đã hết hạn hay chưa, kỳ tài chính — lọc theo loại thiết bị và/hoặc chi nhánh. Dùng khi người dùng hỏi kiểu tổng hợp/báo cáo (vd \"máy nào sắp hết khấu hao\", \"báo cáo thiết bị chi nhánh X\") thay vì hỏi 1 máy cụ thể.",
      "parameters": {
        "type": "object",
        "properties": {
          "deviceTypeName": { "type": "string", "description": "Tên loại thiết bị cần lọc (vd Laptop)" },
          "branchName": { "type": "string", "description": "Tên chi nhánh cần lọc" },
          "keyword": { "type": "string", "description": "Từ khoá mã/tên thiết bị" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_asset_settings",
      "description": "Lấy cấu hình chung của hệ thống quản lý thiết bị — hiện có: sau bao nhiêu tháng kể từ khi thiết bị hết hạn sử dụng thì tự động chuyển sang trạng thái \"Chờ thanh lý\".",
      "parameters": { "type": "object", "properties": {}, "required": [] }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_audit_trail",
      "description": "Tra cứu NHẬT KÝ THAY ĐỔI (lịch sử tạo mới/sửa/xoá/khôi phục) trên toàn hệ thống quản lý thiết bị, không giới hạn ở 1 thiết bị cụ thể — dùng khi hỏi kiểu \"ai vừa sửa gì\", \"hôm nay có thay đổi gì\". Muốn xem lịch sử của riêng 1 thiết bị thì dùng get_device_change_history thay vì tool này.",
      "parameters": {
        "type": "object",
        "properties": {
          "tableName": { "type": "string", "description": "Tên bảng dữ liệu cần lọc, vd \"Device\", \"Branch\", \"Supplier\"" },
          "action": { "type": "string", "description": "Loại thao tác: Create, Update, Delete hoặc Restore" },
          "changedBy": { "type": "string", "description": "Tên người thực hiện thay đổi" },
          "fromDate": { "type": "string", "description": "Từ ngày (yyyy-MM-dd)" },
          "toDate": { "type": "string", "description": "Đến ngày (yyyy-MM-dd)" }
        },
        "required": []
      }
    }
  }
]
```

## 6. Resolve tên → id (bắt buộc cho 1 số tool)

Model/người dùng chỉ biết **tên/mã** (`deviceCode`, tên loại thiết bị, tên chi nhánh...), nhưng
API chi tiết cần **id** dạng số. Trước khi gọi service thật, resolve theo pattern: tìm gần đúng
(`Keyword`/`DeviceCode` contains), ưu tiên khớp chính xác (không phân biệt hoa/thường), nếu không
có khớp chính xác thì lấy kết quả gần đúng đầu tiên; không có kết quả nào → trả lỗi
`{"error": "Không tìm thấy ... \"<tên>\"."}` vào message tool thay vì để tool crash.

Cần 3 hàm resolve (xem code mẫu TypeScript trong `deviceTools.ts` — `resolveDeviceIdByCode`,
`resolveDeviceTypeIdByName`, `resolveBranchIdByName`):
- `deviceCode → deviceId` — dùng cho `get_device_detail`, `get_device_transfer_history`,
  `get_device_change_history`, `search_ip_addresses` (khi có tham số `deviceCode`).
- `tên loại thiết bị → deviceTypeId` — dùng cho `get_device_report`.
- `tên chi nhánh → branchId` — dùng cho `get_device_report`.

**Chuẩn hoá `deviceCode` trước khi resolve (2026-07-27, §12)**: mọi `DeviceCode` thật trong hệ thống
là "chữ-dấu gạch ngang-số" (vd `ydc-9875`), nhưng người dùng gõ trong chat (và cả model) hay bỏ/gõ
sai dấu gạch: `"ydc 9875"`, `"ydc_9875"`, `"ydc9875"`. Prompt mặc định (§9) đã dặn model tự chuẩn
hoá, nhưng model nhỏ chạy local không tuân theo ổn định — nên chuẩn hoá quyết định (deterministic)
ngay ở `AiChatToolExecutorService.GetDeviceCodeArg` bằng regex `^([A-Za-z]+)[\s_-]*([0-9]+)$` →
`{chữ}-{số}`, áp dụng cho **mọi** tham số `deviceCode` đọc từ tool call (`search_devices`,
`get_device_detail`, `get_device_transfer_history`, `get_device_change_history`,
`search_ip_addresses`). Regex neo `^...$` 2 đầu nên **chỉ** biến đổi chuỗi đúng dạng "toàn chữ rồi
toàn số" — mã không khớp dạng đó (vd có chữ xen giữa số) bị bỏ qua nguyên trạng thay vì liều sửa sai
(`DeviceCode` không có validate format ở `CreateDeviceDto`, không đảm bảo 100% mọi mã đều theo đúng
quy ước 2 phần này).

**Ngoại lệ:** `get_ip_prefix_usage` **không** theo pattern gần đúng ở trên — `prefix` phải khớp
**chính xác** chuỗi `IpPrefix.Prefix` (không `Contains`), vì `Contains("10.45.1")` sẽ dính luôn
"10.45.10"/"10.45.11"/... (mọi prefix có "10.45.1" làm tiền tố chuỗi) → báo nhầm dữ liệu dải mạng
khác cho model. Không có kết quả khớp chính xác → trả lỗi `{"error": "Không tìm thấy dải mạng ..."}`
thay vì đoán dải gần giống.

## 7. Hợp đồng endpoint đề xuất cho FE gọi (BE tự thiết kế lại nếu cần, đây chỉ là gợi ý)

```
POST /api/AiChat/stream
Authorization: Bearer <token>     (như mọi API khác — cân nhắc thêm permission riêng, vd Asset.AiChat.Use)
Content-Type: application/json
```

Request:
```jsonc
{
  "message": "câu hỏi mới của người dùng",
  "history": [                              // toàn bộ lịch sử hội thoại trước đó (FE vẫn giữ, gửi lại mỗi lượt)
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "systemPrompt": "..."                     // optional — người dùng có thể sửa qua UI (mục 9); bỏ trống thì BE dùng default
}
```

**Response nên là NDJSON đã RÚT GỌN** (không trả thẳng format thô của Ollama — che hết chi tiết
tool-calling nội bộ, FE chỉ cần biết hiển thị gì):
```jsonc
{"type":"content","text":"chunk chữ"}       // nối dần vào bubble, lặp nhiều dòng
{"type":"tool","name":"search_devices"}     // BE thông báo đang tra cứu tool nào → FE hiện badge
{"type":"done"}                             // hết, đóng stream
{"type":"error","message":"..."}            // có lỗi, FE hiện toast
```
Lợi ích: FE không còn phụ thuộc vào việc BE dùng Ollama hay LLM runtime nào khác phía sau — chỉ
cần đọc đúng 4 dạng dòng trên. Đây là điểm cải thiện thật sự so với kiến trúc hiện tại (FE hiện
đang phải hiểu nguyên cấu trúc chunk của Ollama).

Về **lưu lịch sử hội thoại**: đề xuất giữ đơn giản như hiện tại — FE giữ history, gửi lại nguyên
mảng mỗi lượt (stateless ở BE, không cần thêm bảng lưu hội thoại). Muốn nâng cấp lên lưu theo
`conversationId` phía server (ẩn hẳn history khỏi client, phục vụ audit) thì làm sau, không cần
thiết ngay ở bản đầu.

## 8. Việc cần đổi ở FE khi endpoint BE sẵn sàng

- [chat.api.ts](../src/modules/ai-chat/api/chat.api.ts): đổi `AI_CHAT_API_URL` trỏ về BE
  (`${NEXT_PUBLIC_API_URL}/AiChat/stream`) thay vì gọi thẳng Ollama; bỏ field `tools`/`think` (BE
  tự quản lý); đổi parser NDJSON sang đọc 4 dạng dòng ở mục 7 thay vì `ChatCompletionStreamChunk`
  thô của Ollama.
- [deviceTools.ts](../src/modules/ai-chat/lib/deviceTools.ts): **xoá hẳn khỏi FE** — toàn bộ logic
  chuyển sang BE.
- [ChatBox.tsx](../src/modules/ai-chat/components/ChatBox.tsx): bỏ vòng lặp tool-calling
  (`MAX_TOOL_ROUNDS`, `toolCallsBox`...) — chỉ còn gọi 1 lần endpoint BE, đọc stream, cập nhật UI;
  `toolsUsed` lấy trực tiếp từ dòng `{"type":"tool", ...}` BE gửi về.

## 9. System prompt mặc định (copy nguyên văn từ `AiChatService.DefaultSystemPrompt` — nguồn xác thực
là code, cập nhật lần cuối 2026-07-29 khi thêm mục "KHÔNG BỊA KẾT QUẢ TRA CỨU" ở §14)

```
Bạn là trợ lý AI nội bộ của công ty. QUY TẮC NGÔN NGỮ (quan trọng nhất, luôn tuân theo): LUÔN
LUÔN trả lời bằng tiếng Việt, kể cả khi người dùng hỏi bằng ngôn ngữ khác hoặc dữ liệu tool trả
về có chứa ngôn ngữ khác (Anh, Trung, Nhật...) — tuyệt đối không chêm ngôn ngữ khác vào câu trả
lời. Ngoại lệ DUY NHẤT: khi người dùng yêu cầu RÕ RÀNG dịch một đoạn văn bản sang ngôn ngữ khác,
khi đó hãy dịch chính xác đúng sang ngôn ngữ được yêu cầu, văn phong lịch sự, chỉ trả về nội
dung dịch.

QUY TẮC TRA CỨU: khi người dùng hỏi thông tin thiết bị (chi tiết máy, cấu hình, phần mềm đã
cài, lịch sử chuyển giao/thay đổi, IP), hoặc thông tin chi nhánh, nhà cung cấp, loại/nhóm/bộ
phận thiết bị, PHẢI dùng tool tra cứu phù hợp để lấy dữ liệu thật, không tự bịa số liệu. Nếu câu
hỏi cần nhiều loại dữ liệu khác nhau, được phép gọi nhiều tool cùng lúc trong 1 lượt thay vì hỏi
lại người dùng. Các tool chỉ tra cứu (đọc dữ liệu), không thể thêm/sửa/xoá — nếu người dùng
muốn thay đổi dữ liệu, hướng dẫn họ thao tác trên hệ thống thay vì tự nhận đã thực hiện.Dữ lấy
từ DB phải trả dạng ngôn ngữ nguyên bản ví dụ như: bảng Group có trưởng GroupName là Office thì
không được phép dịch thành thiết bị văn phòng mà phải trả lại nguyên trạng. Ngoài ra mã thiết tự
động hiểu ydc 9923 là ydc-9923 này vì mã sẽ được chia thành 2 phần bên chữ bên số được ngăn cách
bởi dấu -

QUY TẮC KHÔNG HỎI LẠI KHI ĐÃ CÓ MÃ THIẾT BỊ: nếu người dùng đã nhắc tới 1 chuỗi có dạng mã thiết
bị (chữ đi kèm số, có hoặc không có dấu cách/gạch dưới/gạch ngang ở giữa — vd 'ydc 9875',
'ydc-9875', 'ydc_9875', 'PC001'), PHẢI coi đó LÀ mã thiết bị và gọi NGAY tool tra cứu phù hợp
(get_device_detail khi hỏi chi tiết/cấu hình, search_devices khi hỏi tìm kiếm/liệt kê) trong
cùng lượt trả lời — TUYỆT ĐỐI KHÔNG hỏi lại người dùng '(mã thiết bị) chính xác là gì', 'bạn
muốn tìm thông tin gì cụ thể' hay yêu cầu cung cấp thêm chi tiết trước khi thử gọi tool; hệ
thống đã tự chuẩn hoá dấu phân cách trong mã nên không cần người dùng gõ đúng định dạng. Chỉ được
hỏi lại người dùng SAU KHI đã thực sự gọi tool và tool trả về lỗi không tìm thấy thiết bị.

QUY TẮC KHÔNG BỊA KẾT QUẢ TRA CỨU: TUYỆT ĐỐI không được nói 'tôi đã gọi tool', 'kết quả tra cứu
là...', 'dựa trên dữ liệu vừa lấy được...' hay đưa ra bất kỳ số liệu cụ thể nào (địa chỉ IP, cấu
hình, ngày tháng...) nếu KHÔNG có tin nhắn kết quả tool thật sự nằm ngay phía trên trong lượt trả
lời hiện tại. Một tin nhắn trợ lý TRƯỚC ĐÓ (ở lượt chat cũ) nói 'tôi sẽ tra cứu ngay bây giờ'
KHÔNG phải là bằng chứng việc tra cứu đã xảy ra — nếu không thấy kết quả tool thật đi kèm, nghĩa là
việc đó CHƯA từng được thực hiện, PHẢI gọi lại tool ngay bây giờ thay vì tiếp tục câu chuyện như
thể đã có kết quả. Bịa số liệu để trả lời cho có là lỗi nghiêm trọng hơn nhiều so với việc thừa
nhận chưa tra cứu được.

QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL: nếu bạn cần dùng kết quả tool vừa nhận được để gọi thêm
1 tool khác (vd đã có deviceId từ search_ip_addresses, giờ cần gọi get_device_detail), PHẢI gọi
tool đó NGAY trong cùng lượt trả lời này — tuyệt đối KHÔNG được viết thành lời hứa kiểu 'tôi sẽ
dùng...', 'bây giờ tôi sẽ...', 'xin chờ trong giây lát' rồi kết thúc câu trả lời mà không thực sự
gọi tool, vì hệ thống CHỈ thực thi tool khi bạn gọi tool thật, không đọc được câu chữ mô tả ý
định. Nếu chưa gọi tool thành công để lấy dữ liệu, TUYỆT ĐỐI không được khẳng định là đã có hoặc
sắp có kết quả, và không được tự bịa số liệu để hoàn thành những gì đã nói trước đó — nếu không
chắc, hãy gọi lại tool cần thiết ngay trong lượt hiện tại thay vì suy đoán.
```

Nguồn: hằng số `AiChatService.DefaultSystemPrompt` (`Asset.Application/Services/AiChatService.cs`) —
đây là bản đã lên BE thật, KHÔNG còn phải `DEFAULT_SYSTEM_PROMPT` ở `ChatBox.tsx` (file đó đã xoá
khỏi FE khi chuyển sang BE, xem §8). FE có thể gửi `systemPrompt` khác qua request (mục 7) để override,
nhưng hiện `AiChatBox.tsx` không có UI cho việc này (đã bỏ khi redesign 2026-07-27, xem §11).

## 10. Việc chưa cần làm ngay (ghi nhận để làm sau, không nằm trong phạm vi bản đầu)

- Rate-limit / quota theo user (tránh 1 người spam chatbot chiếm hết tài nguyên Ollama).
- Log/audit riêng cho AI chat (khác `AuditTrail` hiện tại — cái đó chỉ ghi thay đổi CRUD).
- Cho phép đổi model/host qua `AssetSetting` hoặc màn cấu hình riêng thay vì hard-code
  `appsettings`, để đổi model không cần deploy lại BE.
- Model hiện tại (`gemma4:e2b`) đôi lúc lẫn vài từ tiếng Anh/Trung hoặc trả sai lệch nhẹ so với dữ
  liệu tool (đã thấy khi test) — chất lượng phụ thuộc model, không phải lỗi kiến trúc, không cần
  xử lý ở BE.
- **Đổi model** (chọn model khác qua UI) và **gửi ảnh** (multimodal/vision): quyết định hoãn lại
  ngày 2026-07-27 (đọc thêm ở §11) — server Ollama nội bộ (10.45.6.70:11434) tại thời điểm đó chỉ
  có **đúng 1 model** (`gemma4:e2b`, capabilities `["completion","tools","thinking"]`, **không** có
  `"vision"`) → chưa có model nào khác để đổi, và model hiện tại không đọc được ảnh. Làm lại 2 mục
  này khi server có thêm model (đặc biệt 1 model có `"vision"`); lúc đó cân nhắc thêm BE endpoint
  bọc `GET {OllamaBaseUrl}/api/tags` để FE liệt kê model thay vì hard-code.

## 11. Cập nhật 2026-07-27 (2): nút xem chi tiết thiết bị + bật/tắt suy luận sâu

Theo yêu cầu mở rộng UI AI Chat — 2 phần **đã làm**, đổi tương thích ngược (field mới, không phá vỡ
FE cũ nếu có):

- **Dòng NDJSON mới `{"type":"device"}`** (hợp đồng đầy đủ ở [asset-api-fe.md §7c](asset-api-fe.md)):
  `AiChatToolExecutorService.ExecuteAsync` giờ trả `AiChatToolExecutionResult{Json, DeviceReferences}`
  thay vì `string` trần — `Json` vẫn là nội dung đưa vào message `"tool"` gửi lại Ollama y như cũ,
  `DeviceReferences` (`List<AiChatDeviceReferenceDto>{Id, DeviceCode}`) là dữ liệu **chỉ dành cho
  FE**, không lộ vào context của model. 4 tool có thể sinh reference: `search_devices` (mỗi thiết bị
  tìm được), `get_device_detail`/`get_device_transfer_history`/`get_device_change_history` (thiết bị
  đã resolve từ `deviceCode`). `AiChatService` gom `emittedDeviceIds` (`HashSet<int>`) qua suốt 1 lượt
  hỏi để không phát trùng 1 thiết bị nhiều lần nếu model tra cứu nó qua nhiều tool/vòng khác nhau.
  FE (`AiChatBox.tsx`) hiện nút "Xem chi tiết {deviceCode}" dưới câu trả lời, điều hướng
  `/pc/devices?id={deviceId}` (route FE dùng query string, không phải `[id]` động — do static export,
  xem `app/[locale]/(pc-manager)/pc/devices/page.tsx`), ẩn nếu user không có `Asset.Device.View`.
- **Field request mới `think?: boolean`**: `"think": false` trong `OllamaChatClient` đổi từ hard-code
  sang tham số `think` truyền vào (`AiChatRequestDto.Think ?? false` — mặc định giữ nguyên hành vi cũ
  vì model hiện tại (`gemma4:e2b`) có capability `"thinking"` thật, đo được ~15-20s khi bật so với
  ~2-3s khi tắt (§3) — bật là quyết định người dùng tự chọn đánh đổi tốc độ lấy chất lượng suy luận
  cho 1 câu hỏi cụ thể, không phải mặc định. FE thêm 1 toggle "Suy luận sâu" ở header (khóa khi đang
  stream, vì Ollama chỉ nhận `think` cố định cho cả request, không đổi giữa chừng 1 lượt).
- **Không đổi** endpoint, method, hay 4 dòng NDJSON gốc — chỉ thêm field/dòng mới, cả 2 optional ở
  phía request và additive ở phía response.

## 12. Cập nhật 2026-07-27 (4): chuẩn hoá `deviceCode` gõ tắt ("ydc 9875" → "ydc-9875")

Bug thực tế: người dùng gõ `"ydc 9875"` (cách bằng dấu cách thay vì gạch ngang) → tool tra cứu báo
không tìm thấy thiết bị, dù thiết bị tồn tại với mã `ydc-9875`. Nguyên nhân: `deviceCode` truyền
thẳng vào `Contains`/so khớp (mục 5, 6) — sai 1 ký tự phân cách là trật hoàn toàn, và dặn model tự
chuẩn hoá trong system prompt (mục 9, câu "mã sẽ được chia thành 2 phần...") không đủ tin cậy với
model nhỏ chạy local.

**Đã sửa** ở `AiChatToolExecutorService` (không đụng system prompt, giữ nguyên như 1 lớp phòng thủ
thứ 2): thêm `GetDeviceCodeArg(args, "deviceCode")` — wrap `GetStringArg` rồi chạy qua
`NormalizeDeviceCode`, regex `^([A-Za-z]+)[\s_-]*([0-9]+)$` → `"{chữ}-{số}"`. Áp dụng cho **mọi** nơi
đọc tham số `deviceCode` từ tool call: `search_devices`, `get_device_detail`,
`get_device_transfer_history`, `get_device_change_history`, `search_ip_addresses`. Xử lý được cả 3
kiểu gõ sai: cách bằng khoảng trắng (`"ydc 9875"`), gạch dưới (`"ydc_9875"`), dính liền không có
phân cách (`"ydc9875"`) — đều ra `"ydc-9875"`. Mã đã đúng định dạng (`"ydc-9875"`) khớp regex và bị
"thay" bằng chính nó, coi như no-op.

An toàn cho mã không theo đúng khuôn 2 phần: regex neo `^...$` cả 2 đầu, `([0-9]+)$` bắt buộc phần
đuôi phải **toàn số tới hết chuỗi** — mã kiểu `"R2D2-001"` không khớp (sau chữ "R" phần còn lại
`"2D2-001"` không toàn số) nên giữ nguyên, không có rủi ro sửa nhầm mã hợp lệ thành mã sai.

## 13. Cập nhật 2026-07-27 (5): model hỏi lại thay vì gọi tool khi đã có mã thiết bị

Bug thực tế phát hiện SAU §12 (khác nguyên nhân — §12 sửa xong vẫn còn lỗi này): người dùng gõ
`"tìm thông tin máy ydc 9875"` rồi `"Chi tiết đầy đủ"` — model **không gọi tool nào cả**, chỉ hỏi
lại kiểu "Bạn có mã thiết bị chính xác không?" dù đã có đủ thông tin để gọi `get_device_detail`
ngay. §12 chuẩn hoá đúng chuỗi `deviceCode` bên trong `AiChatToolExecutorService`, nhưng vô dụng
nếu model không hề phát sinh `tool_calls` — `AiChatService.StreamChatAsync` chỉ đọc `tool_calls` có
thật (mục 4), không đọc được câu chữ dạng "hỏi lại" để tự suy ra là model "ngần ngại" gọi tool.

**Đã sửa**: thêm đoạn mới vào `DefaultSystemPrompt` (§9) — "QUY TẮC KHÔNG HỎI LẠI KHI ĐÃ CÓ MÃ THIẾT
BỊ": bất kỳ chuỗi nào dạng chữ+số (có/không có dấu phân cách) mà người dùng nhắc tới đều PHẢI được
coi là mã thiết bị và gọi tool tra cứu (`get_device_detail`/`search_devices` tuỳ ngữ cảnh) **ngay**,
tuyệt đối không hỏi lại xác nhận trước; chỉ hỏi lại **sau khi** tool đã chạy và báo không tìm thấy.
Đây là prompt-level mitigation (giống hạn chế đã ghi ở `asset-module.md §1.18` về việc model đôi khi
"viết lời hứa thay vì gọi tool thật") — không đảm bảo 100% với model nhỏ (`gemma4:e2b`), nhưng cùng
với §12 (chuẩn hoá mã quyết định) đã che gần hết 2 lớp lỗi độc lập của cùng 1 luồng: model không
chịu gọi tool, và nếu chịu gọi thì gọi sai chuỗi mã.

## 14. Cập nhật 2026-07-29: model tự bịa kết quả tra cứu sau 1 lượt hứa suông

Bug nghiêm trọng hơn §13, phát hiện qua transcript thật của người dùng: hỏi
`"tìm thông tin máy ydc 9875 chi tiết đầy đủ"` → model gọi tool thật, trả lời đúng. Sau đó hỏi
`"IP đang dùng"` → model trả lời `"Để kiểm tra... tôi sẽ thực hiện tra cứu ngay bây giờ."` **không
kèm `tool_calls`** → round kết thúc, câu "hứa suông" này trở thành nội dung cuối cùng của lượt, được
commit vào history. Lượt kế tiếp (`"bạn tra ra chưa"`), model đọc lại chính câu hứa của mình trong
history và **tự bịa** ra một kết quả hợp lý ("Kết quả: IP là 10.20.30.150") thay vì gọi tool thật —
lặp lại y hệt kiểu này thêm 2 lượt nữa (kể cả sau khi bị người dùng vặn "bạn tự bịa ak"), chỉ dừng
bịa sau khi người dùng gõ thẳng "bạn chưa có gọi một tool nào hết á" + "hãy thực hiện đi".

**Nguyên nhân gốc**: `AiChatMessageDto` (hợp đồng FE↔BE) chỉ có role `user`/`assistant` — tin nhắn
`role: "tool"` là nội tại của 1 lần gọi `StreamChatAsync`, KHÔNG được FE lưu lại/gửi lại ở lượt sau
(xem comment ở `AiChatMessageDto.cs`). Vì vậy khi 1 lượt trước đó kết thúc bằng lời hứa suông (không
`tool_calls`), history gửi lại ở lượt sau **không hề có bằng chứng** việc tra cứu đã xảy ra hay chưa
— nhưng model (nhỏ, hay "tiếp nối câu chuyện" một cách tự tin) coi lời hứa của chính nó như thể đã
hoàn thành, rồi bịa số liệu để "hoàn tất" mạch hội thoại thay vì thừa nhận chưa làm.

**Đã sửa** (2 lớp, cả 2 ở `AiChatService.cs`):

1. **Prompt-level**: thêm đoạn "QUY TẮC KHÔNG BỊA KẾT QUẢ TRA CỨU" vào `DefaultSystemPrompt` (§9) —
   cấm khẳng định đã có kết quả/tự bịa số liệu nếu không có tin nhắn kết quả tool thật ngay phía
   trên trong lượt hiện tại; nói rõ 1 lời hứa ở lượt cũ KHÔNG phải bằng chứng đã tra cứu.
2. **Structural-level (mới, chắc hơn thuần prompt)**: `UnfulfilledPromisePattern` — regex khớp các
   cụm hứa suông tiếng Việt phổ biến (`"sẽ thực hiện/tra cứu/kiểm tra/gọi"`, `"ngay bây giờ"`,
   `"trong giây lát"`, `"xin chờ"`, `"để tôi kiểm tra/tra cứu"`). Khi build `messages` từ
   `request.History`, nếu tin nhắn **cuối cùng** là `role: assistant` và khớp regex này, tự động
   chèn thêm 1 tin nhắn `role: "system"` ngay trước tin nhắn `user` mới, nhắc thẳng: lượt trước
   chưa hề gọi tool thật, nếu câu hỏi hiện tại liên quan thì phải gọi tool ngay, không được bịa.
   Cách này không phụ thuộc hoàn toàn vào việc model "tự giác" tuân theo system prompt gốc — chủ
   động chèn lời nhắc đúng lúc lời hứa suông xuất hiện ở lượt liền trước, là điểm model dễ bịa nhất
   theo transcript thực tế.

Giới hạn đã biết: regex chỉ bắt các cụm hứa hẹn thường gặp bằng tiếng Việt, không phải NLP hoàn
chỉnh — model vẫn có thể hứa suông bằng cách diễn đạt khác không khớp regex, hoặc bịa kết quả ngay
trong CÙNG 1 lượt (round đầu tiên, chưa từng có lời hứa trước đó) mà không có cách nào phân biệt
cấu trúc với 1 câu trả lời hợp lệ không cần tool. Đây vẫn là hạn chế cố hữu của model nhỏ chạy nội
bộ, không phải lỗi có thể chặn 100% ở tầng BE.

## 15. Cập nhật 2026-07-29 (3): guard §14 chỉ chặn ở lượt SAU, không ép gọi tool ngay

Phát hiện qua transcript thật bên **Attendance AI Chat** (cùng orchestrator pattern với Asset, cùng
lỗi cấu trúc): người dùng hỏi "đang có những nhóm bộ phận nào" → model trả lời "để tôi tra cứu giúp
bạn nhé" không kèm `tool_calls` → round kết thúc, trả `done`. Người dùng hỏi tiếp "rồi nó đâu rồi" —
guard §14 phát hiện đúng lời hứa suông ở lượt trước và chèn system message nhắc nhở — nhưng model
**vẫn không gọi tool**, chỉ xin lỗi rồi hứa lại lần nữa ("tôi đang thực hiện tra cứu... xin chờ").
Nguyên nhân: guard §14 chỉ hoạt động ở ĐẦU lượt kế tiếp (dựa vào history), nó chèn được lời nhắc
nhưng không có cách nào ép model thực sự phát ra `tool_calls` ngay — nếu model tiếp tục chỉ trả lời
text, lượt đó lại kết thúc bằng `done` và quả bóng lại được đá về phía người dùng, có thể lặp vô hạn.

**Đã sửa**: thêm auto-retry **cùng lượt** (cùng 1 HTTP request) ở cả `AiChatService.cs` (Asset) và
`AttendanceAiChatService.cs` (Attendance) — trong nhánh `toolCalls == null` của vòng lặp round, nếu
`text` khớp `UnfulfilledPromisePattern`, thay vì `yield return Done(); yield break;` ngay, tự chèn 1
`system` message nhắc thẳng "câu trả lời vừa rồi chỉ là lời hứa, PHẢI gọi tool NGAY" rồi `continue`
sang round kế tiếp — model được gọi lại ngay, không cần người dùng tự gõ thêm 1 tin nhắn để nhắc.
Giới hạn bằng biến đếm riêng `promiseRetriesUsed` (tối đa `MaxPromiseRetries = 2`, tách khỏi ngân
sách `maxRounds` của việc gọi tool thật) — tránh trường hợp model cứng đầu chỉ lặp lại lời hứa chiếm
hết toàn bộ round mà không bao giờ gọi tool.

## 16. Cập nhật 2026-07-30: rút gọn còn 7 tool, tập trung vào tra cứu thiết bị + IP

Yêu cầu từ người dùng: chatbot Asset cần (1) tra cứu thiết bị bằng **đầy đủ các field như trên UI**,
(2) tìm IP đang trống, (3) 1 IP có dùng được không — nếu đang dùng thì máy nào đang dùng, (4) liệt kê
IP trong 1 dải và cái nào còn trống; **các tool khác không liên quan thì bỏ đi cho đỡ nặng**.

### 16.1 Bỏ 10 tool, giữ 7

Catalogue được re-send và re-evaluate **mỗi lượt**, và §12 đã đo được prompt-eval của schema 17 tool là
chi phí chi phối (~31s nguội / ~17-18s ấm trên Ollama chạy 100% CPU, `size_vram: 0`) — lớn hơn cả phần
sinh câu trả lời. Nên rút gọn catalogue là **fix hiệu năng**, không phải dọn dẹp hình thức.

| Giữ (7) | Vì sao |
|---|---|
| `search_devices` | Tra thiết bị — nay đủ field như UI (§16.2) |
| `get_device_detail` | Chi tiết 1 máy (cấu hình, phần mềm đã cài) |
| `search_device_groups` / `search_device_departments` | Đổi TÊN Nhóm/Bộ phận người dùng nói → `groupId`/`departmentId` thật cho `search_devices` |
| `search_ip_addresses` | Nhu cầu (2) + (3) — nay có lọc trống/đang dùng (§16.3) |
| `get_ip_prefix_usage` | Nhu cầu (4) — tổng quan cả dải, đếm trước khi cắt danh sách nên tổng luôn đúng |
| `search_ip_prefixes` | Biết hệ thống có những dải nào |

**Đã bỏ (10)**: `get_device_transfer_history`, `get_device_change_history`, `search_device_types`,
`search_software`, `search_software_groups`, `search_branches`, `search_suppliers`, `get_device_report`,
`get_asset_settings`, `search_audit_trail`.

> **Cách phục hồi**: các `case` tương ứng trong `AiChatToolExecutorService.ExecuteAsync` được **giữ
> nguyên có chủ ý** — muốn bật lại tool nào chỉ cần dán lại block JSON của nó vào
> `AiChatToolDefinitions.cs`, không phải viết lại code executor. Executor không tốn token nào; chỉ
> catalogue mới tốn.

Kết quả đo (đếm trực tiếp trên chuỗi `ToolsJson`): **10.766 → 7.656 ký tự (~3.076 → ~2.187 token), giảm
~29%**. Lưu ý: giảm ít hơn tỉ lệ 17→7 vì 2 tool được giữ lại đã được làm **giàu hơn nhiều** (13 tham số
cho `search_devices`, mô tả IP chi tiết) — chính phần bù này mới làm 4 nhu cầu chạy được.

### 16.2 `search_devices` giờ phủ đủ field của UI

Trước đây chỉ có 5 tham số (`deviceCode`/`manager`/`ipAddress`/`email`/`supplierName`) trong khi
`DeviceFilterRequest` có 13 → những câu người dùng trả lời được trên màn hình lại không trả lời được
trong chat. Nay map **1:1** với `DeviceFilterRequest`, thêm: `serialNumber`, `note`, `purchaseDate`,
`groupId`, `departmentId`, `isOutsourced`, `isUseUsb`, `sortDeviceCodeAscending`.

Thêm 2 helper `GetIntArg`/`GetBoolArg` vào executor (trước chỉ có `GetStringArg`/`ParseDateArg`). Cả 2
chấp nhận cả JSON scalar thật lẫn dạng chuỗi (`"6"`, `"true"`) vì model nhỏ hay trả về dạng chuỗi, và
trả `null` (không phải `0`/`false`) khi thiếu tham số — vì `0`/`false` ở đây **là giá trị lọc có nghĩa**
(`Status=0` = còn trống, `IsOutsourced=false` = máy công ty), đúng cảnh báo CLAUDE.md §4.4.

### 16.3 `search_ip_addresses` trả lời được cả 3 câu hỏi về IP

Thêm 2 tham số `isInUse` (bool) + `status` (int: 0 trống / 1 gán ngoài hệ thống / 2 gán trong hệ thống).
`IpAddressDto` vốn đã có `StatusText` + `DeviceCode` nên câu "IP này ai đang dùng" trả lời được ngay.
`Keyword` dùng `Contains` trên chuỗi IP nên truyền `"10.45.1."` là lọc được cả dải.

Đồng thời **đổi shape kết quả** từ mảng trần thành `{ totalCount, returnedCount, items }`: trả 10 IP mà
không nói tổng là 2775 thì câu trả lời thành ra sai lệch. System prompt có rule bắt buộc nói rõ tổng số
khi `totalCount` lớn hơn số phần tử liệt kê.

### 16.4 3 rule mới trong `DefaultSystemPrompt`

1. **PHẠM VI HỖ TRỢ** — nêu thẳng chỉ hỗ trợ 2 nhóm việc (tra thiết bị / tra IP), ngoài ra nói rõ chưa
   hỗ trợ. Rule cũ còn liệt kê "lịch sử chuyển giao", "chi nhánh", "nhà cung cấp" — những tool vừa bỏ.
2. **QUY TẮC GỌI TOOL TRƯỚC, HỎI LẠI SAU** — sửa lỗi thật: hỏi "tìm cho tôi những IP đang còn trống" →
   model **không gọi tool nào**, chỉ hỏi lại "trong dải mạng nào?", dù `search_ip_addresses` không có
   tham số nào bắt buộc. Rule mới: gần như mọi tham số đều optional nên phải gọi tool ngay với những gì
   đang có, chỉ được hỏi thu hẹp SAU KHI đã gọi và thấy kết quả quá nhiều/rỗng. (Cùng nội dung được nhắc
   lại trong `description` của `search_ip_addresses` để củng cố ở tầng tool schema.)
3. **QUY TẮC ĐỌC ĐÚNG KẾT QUẢ TOOL** — sửa lỗi thật, dạng ngược với §14: hỏi liệt kê chi nhánh + loại
   thiết bị, model gọi đúng `search_branches`/`search_device_types` nhưng lại trả lời "(Không có dữ liệu
   nào được trả về từ hệ thống.)", trong khi DB có **6 chi nhánh và 16 loại thiết bị** (đã xác minh bằng
   `GET /api/Branch/grid-list` → `totalCount: 6`, tức tool không lỗi — model **bịa ra việc không có dữ
   liệu**). Rule mới: báo sai là không có dữ liệu cũng nghiêm trọng ngang bịa dữ liệu.

### 16.5 Gợi ý trên FE phải khớp năng lực thật

`SUGGESTIONS` cũ trong `AiChatBox.tsx` hứa những thứ **không tool nào làm được**: "Có bao nhiêu thiết bị
đang chờ thanh lý?" (không có tool thống kê theo trạng thái — đã test, model đành hỏi lại) và "Liệt kê
thiết bị của chi nhánh Bình Dương" (`DeviceFilterRequest` **không có** filter chi nhánh, và cũng không
có chi nhánh nào tên Bình Dương — thật là CỦ CHI/DĨ AN/MỸ PHƯỚC). Bộ mới dùng dữ liệu có thật để bấm vào
là ra kết quả, và `TOOL_LABELS` cũng đã xoá nhãn của 10 tool đã bỏ.

### 16.6 Nghiệm thu — đối chiếu từng câu với API thật

| Nhu cầu | Câu hỏi test | Tool model gọi | Kết quả | Đối chiếu API |
|---|---|---|---|---|
| (4) IP trống trong dải | "Dải IP 10.45.1 còn bao nhiêu địa chỉ trống?" | `get_ip_prefix_usage` | 255 tổng, 0 trống | ✅ khớp (`Keyword=10.45.1.` → 255; `IsInUse=false` → 0) |
| (3) IP dùng được / ai dùng | "IP 10.45.1.20 có dùng được không, đang được máy nào dùng?" | `search_ip_addresses` | đang dùng, máy `YDC-09333` | ✅ khớp (status 2, deviceCode YDC-09333) |
| (1) field mới của UI | "Liệt kê các thiết bị thuê ngoài" | `search_devices` (`isOutsourced=true`) | 10 máy đầu | ✅ khớp thứ tự API (total 30) |
| (2) IP trống toàn hệ thống | "Tìm cho tôi những IP đang còn trống" | `search_ip_addresses` (`isInUse=false`) | **2775** IP trống, nói rõ chỉ liệt kê một phần | ✅ khớp chính xác (2775) |

Ghi chú về độ trễ: 4 lần đo lần lượt 150s / 47s / 89s / 141s — **không kết luận được** là nhanh hơn hay
chậm hơn trước, vì Ollama server dùng chung và §12 đã ghi nhận độ trễ biến động lớn do tranh chấp tải.
Con số đáng tin duy nhất là mức giảm schema ~29% ở §16.1.
