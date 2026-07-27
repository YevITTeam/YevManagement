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

## 5. Danh mục 16 tool — CHỈ ĐỌC, không tool nào được phép gọi create/update/delete

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
| `get_device_report` | `GET /api/Report/device-list` | Nhận **tên** loại thiết bị/chi nhánh → resolve sang `deviceTypeId`/`branchId` (mục 6) |
| `get_asset_settings` | `GET /api/AssetSetting` | Không tham số |
| `search_audit_trail` | `GET /api/AuditTrail/grid-list` | Nhật ký **toàn hệ thống**, khác `get_device_change_history` (chỉ 1 thiết bị) |

Tất cả tool đều **giới hạn tối đa 10 kết quả** (`MAX_RESULTS = 10` ở FE) — giữ nguyên khi viết lại
để tránh nhét quá nhiều token vào context của model.

### JSON Schema đầy đủ (copy nguyên từ [deviceTools.ts](../src/modules/ai-chat/lib/deviceTools.ts), gửi nguyên trong field `tools` của request Ollama)

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

## 9. System prompt mặc định (copy nguyên văn từ FE, BE có thể giữ làm default)

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
muốn thay đổi dữ liệu, hướng dẫn họ thao tác trên hệ thống thay vì tự nhận đã thực hiện.
```

Nguồn: hằng số `DEFAULT_SYSTEM_PROMPT` trong [ChatBox.tsx](../src/modules/ai-chat/components/ChatBox.tsx).
FE hiện cho người dùng sửa system prompt qua 1 khung UI (nút "System prompt" trên header chat) —
nếu giữ tính năng này, field `systemPrompt` ở request (mục 7) chính là giá trị người dùng sửa.

## 10. Việc chưa cần làm ngay (ghi nhận để làm sau, không nằm trong phạm vi bản đầu)

- Rate-limit / quota theo user (tránh 1 người spam chatbot chiếm hết tài nguyên Ollama).
- Log/audit riêng cho AI chat (khác `AuditTrail` hiện tại — cái đó chỉ ghi thay đổi CRUD).
- Cho phép đổi model/host qua `AssetSetting` hoặc màn cấu hình riêng thay vì hard-code
  `appsettings`, để đổi model không cần deploy lại BE.
- Model hiện tại (`gemma4:e2b`) đôi lúc lẫn vài từ tiếng Anh/Trung hoặc trả sai lệch nhẹ so với dữ
  liệu tool (đã thấy khi test) — chất lượng phụ thuộc model, không phải lỗi kiến trúc, không cần
  xử lý ở BE.
