# Hướng dẫn tích hợp API "Kiểm tra Server" (ServerCheck) — cho app Android (Flutter)

> Tài liệu này viết riêng cho đội phát triển app Flutter quét QR kiểm tra phòng server hằng ngày,
> tự chứa đủ thông tin để tích hợp mà không cần đọc thêm tài liệu nào khác của hệ thống YEV Management.
> Nếu có sai khác giữa tài liệu này và response thật của server, **tin theo response thật** và báo lại
> cho đội Backend (`docs/docs-be/asset-api-fe.md §7d` là nguồn chân lý gốc phía backend).

## 1. Bối cảnh nghiệp vụ

Mỗi ngày nhân viên phải kiểm tra phòng server — trước đây ghi bằng tay vào tờ giấy checksheet. Cách
kiểm tra **chia làm 3 nhóm** (cập nhật 2026-09-26):

| Nhóm | Thiết bị | Cách kiểm tra | Cờ `requiresScan` |
|---|---|---|---|
| **Phải quét QR** | Chỉ máy loại **IDR** (iDRAC/SAN — máy vật lý thật sự nằm trong phòng server, nhân viên nhìn đèn tín hiệu rồi quét QR) | Quét QR từng máy | `true` |
| **Tự ping** | SVR, SWT (switch), UPS, NAS… — Admin chỉ **tick "kiểm tra hằng ngày"**, không có QR để quét | **Không quét.** Khi bấm "Kết thúc phiên", **server tự ping** IP của từng máy: đạt → OK, không đạt → NG (kèm ghi chú IP lỗi) | `false` |
| **Máy lạnh** | Không còn là thiết bị | Là **1 mục xác nhận thủ công** ("Máy lạnh") — nhân viên tự bấm OK/NG | (nằm trong `manualResults`, không phải `items`) |

Ngoài ra vẫn có các mục xác nhận thủ công khác (âm thanh/mùi/nhiệt độ, gửi/nhận mail, backup, 2 mục network
có nút "Kiểm tra network").

Toàn bộ nghiệp vụ gói trong **1 phiên kiểm tra/ngày** (`ServerCheckSession`):
1. Nhân viên đăng nhập → bấm "Bắt đầu phiên quét" → hệ thống snapshot toàn bộ thiết bị đã tick hôm nay.
2. Nhân viên đi vòng phòng server, quét lần lượt từng mã QR của **máy IDR** (`requiresScan=true`) → mỗi lần quét gọi 1 API.
   Máy `requiresScan=false` **không quét**, app chỉ liệt kê ở khối riêng "Tự kiểm tra".
3. Quét xong (hoặc bỏ dở), vào màn hình tổng kết: xác nhận OK/NG cho các mục thủ công (gồm cả "Máy lạnh") +
   (tuỳ chọn) bấm nút "Kiểm tra network" → bấm "Kết thúc phiên" → server tự ping các máy `requiresScan=false`
   rồi khoá phiên hôm nay, không sửa được nữa.

Mỗi ngày chỉ tạo được **1 phiên duy nhất**. Nếu app bị tắt/crash giữa chừng, mở lại gọi `POST /start`
lại sẽ nhận về **đúng phiên đang dở**, không mất dữ liệu đã quét.

## 2. Base URL & môi trường

- **Dev/thực tế hiện tại**: `http://10.45.1.181:8081` — lấy chuẩn từ
  `CompanySystem.HostApi/Properties/launchSettings.json` phía backend, **có thể đổi** khi đội hạ tầng
  cấp IP tĩnh khác cho server — hỏi lại đội Backend trước khi build bản release.
- Tất cả endpoint dưới đây có tiền tố `/api`. Ví dụ endpoint đầy đủ:
  `http://10.45.1.181:8081/api/ServerCheck/today`.
- Không có HTTPS ở giai đoạn hiện tại (mạng LAN nội bộ công ty) — app phải cho phép gọi `http://` (Android
  cần khai báo `usesCleartextTraffic="true"` hoặc Network Security Config cho phép domain/IP này).
- Không có Swagger/OpenAPI public cho môi trường ngoài Development — nếu cần xem thử trực tiếp, dùng
  trình duyệt trên máy trong mạng công ty mở `http://10.45.1.181:8081/scalar/v1`.

## 3. Đăng nhập (Auth)

App Android **không chạy trong domain Windows** nên **không dùng** được `windows-login` (Negotiate/SSO).
Dùng endpoint đăng nhập bằng form:

```
POST /api/Auth/login
Content-Type: application/json

{ "userName": "n.van.a", "password": "..." }
```

- `userName` **không kèm domain** (không phải `YEV\n.van.a`, chỉ phần sau dấu `\`).
- Backend tự xác thực với Active Directory thật (không có hệ mật khẩu riêng, không lưu password).
- Sai tài khoản/mật khẩu → response `isSuccess: false`, message chung "Tên đăng nhập hoặc mật khẩu không đúng."
  (không phân biệt "sai username" hay "sai password" — không tự hiện chi tiết hơn ở UI).

**Response thành công** (`data`):

```jsonc
{
  "user": {
    "id": 12,
    "userName": "YEV\\n.van.a",
    "fullName": "Nguyen Van A",
    "deviceName": "DESKTOP-ABC123",      // nullable, chỉ để hiển thị, không dùng để định danh
    "email": "n.van.a@yazaki.com",       // nullable
    "roles": ["Basic"],
    "permissions": ["Asset.ServerCheck.Scan", "Asset.ServerCheck.View", "..."]
  },
  "token": "eyJhbGciOi..."               // JWT — dùng cho MỌI request sau
}
```

Lưu `token` an toàn trên máy (`flutter_secure_storage` khuyến nghị). Mọi request tiếp theo gắn header:

```
Authorization: Bearer <token>
```

- **Token hết hạn sau 120 phút.** Không cần gọi lại `/login` mỗi lần — gọi `GET /api/Auth/me` (chỉ cần
  Bearer, không cần permission) để lấy lại `user` + **JWT mới đã gia hạn thêm 120 phút**, response `data`
  shape y hệt `/login` (`{ user, token }`). Nên gọi định kỳ (vd mỗi 30 phút khi app đang mở) hoặc bắt lỗi
  `401` ở bất kỳ API nào → thử `GET /Auth/me` 1 lần → còn lỗi mới bắt đăng nhập lại từ đầu.
- Người dùng phải được **Admin cấp quyền** `Asset.ServerCheck.Scan` (để quét + kết thúc phiên) và
  `Asset.ServerCheck.View` (để xem lại phiên/báo cáo) trước — thiếu quyền thì API vẫn trả `401` (thiếu/hỏng
  token) hoặc **`403`** (đủ token nhưng thiếu quyền). Nếu tài khoản test bị 403 khi gọi các API bên dưới,
  báo Admin hệ thống gán quyền chứ không phải lỗi tích hợp.

## 4. Envelope response chung

**Mọi** response (kể cả lỗi) đều bọc theo dạng:

```jsonc
{
  "isSuccess": true,
  "message": "Bắt đầu phiên kiểm tra thành công.",
  "data": { /* ... */ },
  "errors": null,          // string[] | null — thường có giá trị khi validate fail (400)
  "timestamp": "2026-09-17T08:05:00Z"
}
```

App luôn đọc `isSuccess` trước, lấy dữ liệu ở `data`; khi `isSuccess=false` hiện `message` (đã là tiếng
Việt, dùng được thẳng cho toast/dialog).

**Mã lỗi HTTP:**

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 400 | Lỗi nghiệp vụ/validate (vd mã QR không thuộc phạm vi hôm nay, phiên đã kết thúc) — đọc `message` |
| 401 | Thiếu/sai/hết hạn token → thử `GET /Auth/me`, còn lỗi thì bắt đăng nhập lại |
| 403 | Có token nhưng tài khoản thiếu permission (`Asset.ServerCheck.Scan`/`View`) |
| 404 | Không tìm thấy tài nguyên (vd `sessionId` sai) |
| 500 | Lỗi hệ thống — hiện thông báo chung, báo Backend |

## 5. Luồng nghiệp vụ tổng quát

```
[Mở app] → POST /Auth/login (hoặc GET /Auth/me nếu còn token)
        → GET /ServerCheck/today
            ├─ null                      → hiện màn "Bắt đầu phiên quét"
            ├─ status=0 (InProgress)     → vào thẳng màn quét, load lại items đã có
            └─ status=1 (Completed)      → hiện "Hôm nay đã kiểm tra xong", cho xem lại (không quét được nữa)

[Bấm "Bắt đầu"] → POST /ServerCheck/start → nhận ServerCheckSessionDto (có sẵn "items" đủ, máy IDR đang chưa quét)
        → vào màn quét

[Màn quét] (lặp lại)
    → mỗi lần quét được QR: POST /ServerCheck/{id}/scan { "deviceCode": "<dòng 1 của QR>" }
    → cập nhật dòng thiết bị đó trên UI theo response (status=OK, scannedAt, scannedBy)
    → quét sai/không thuộc phạm vi hôm nay, hoặc quét máy requiresScan=false → 400 → rung máy/beep lỗi, KHÔNG chặn quét tiếp mã khác

[Bấm "Kết thúc phiên"] (khi đã quét xong hoặc muốn dừng)
    → GET /ServerCheck/manual-items                  (lấy danh sách mục xác nhận tay, hiện đang 8 mục — gồm "Máy lạnh")
    → (tuỳ chọn) GET /ServerCheck/network-ping        (bấm nút "Kiểm tra network" để auto ping)
    → hiện form cho user xác nhận OK/NG từng mục thủ công + ghi chú lý do NG cho máy IDR còn "Chưa quét"
    → POST /ServerCheck/{id}/end { items: [...], manualResults: [...] }   (CHẬM: server ping các máy tự-ping, ~10–60 giây → hiện loading, tăng timeout)
    → nhận lại ServerCheckSessionDto với status=1 (Completed) → khoá, không quét/kết thúc lại được nữa
```

## 6. Chi tiết từng endpoint

Tất cả endpoint dưới đây thuộc `/api/ServerCheck`, cần header `Authorization: Bearer <token>`.

### 6.0 `GET /api/ServerCheckAssignment/me` — xưởng của mình (BẮT BUỘC gọi trước tiên)

> **Cập nhật 2026-09-21:** mỗi người được Admin **phân công đúng 1 xưởng**; app **không có ô chọn xưởng**, không gửi xưởng lên server — server tự dùng xưởng của tài khoản đang đăng nhập. Ngoài quyền `Asset.ServerCheck.Scan` (role **"Kiểm tra Server"**), tài khoản phải được phân công xưởng.

- Permission: `Asset.ServerCheck.Scan`.
- Response `data`: `{ "id", "userId", "userName", "fullName", "branchId", "branchName" }` hoặc **`null`** nếu chưa được phân công.
- `data == null` → **chặn toàn bộ màn quét**, hiện "Tài khoản của bạn chưa được phân công xưởng kiểm tra server. Vui lòng liên hệ Admin." (không gọi tiếp `/today`, `/start`).
- Có `data` → hiện tên xưởng (`branchName`) nổi bật trên đầu màn hình để người quét biết mình đang quét xưởng nào. `GET /today`, `POST /start`, `scan`, `end` sau đó **không cần và không được** truyền xưởng.
- `POST /start` cũng tự trả 400 với cùng thông điệp nếu chưa phân công; `scan`/`end` trên phiên của xưởng khác → 400. Phiên (`ServerCheckSessionDto`) giờ có thêm `branchId`, `branchName`.
- Giới hạn "1 phiên/ngày" nay tính **theo từng xưởng**.

### 6.1 `GET /today` — kiểm tra hôm nay đã có phiên chưa

Permission: `Asset.ServerCheck.View`. Không tham số.

- `data: null` → hôm nay **chưa bấm "Bắt đầu"**.
- `data: ServerCheckSessionDto` → xem field `status`:
  - `0` = `InProgress` (đang quét dở, kể cả vừa mới bắt đầu) → app vào thẳng màn quét, load `items` hiện có.
  - `1` = `Completed` (đã kết thúc, khoá) → app hiện màn "đã hoàn thành hôm nay", không cho quét/kết thúc nữa.

Gọi API này **mỗi lần mở app** (sau khi có token) để biết vào màn nào, tránh tình trạng bấm "Bắt đầu" 2 lần.

### 6.2 `POST /start` — bắt đầu phiên quét hôm nay

Permission: `Asset.ServerCheck.Scan`. Không body.

- Nếu hôm nay **chưa có phiên** → tạo mới, snapshot toàn bộ thiết bị cần quét (xem điều kiện ở dưới),
  trả về `status=0`, `items` đủ danh sách nhưng tất cả đang `status=0` ("Chưa quét").
- Nếu hôm nay **đã có phiên `InProgress`** (vd app bị tắt giữa chừng) → trả lại **nguyên phiên đó**
  (giữ nguyên các item đã quét), **không** tạo phiên mới, không mất dữ liệu.
- Nếu hôm nay **đã `Completed`** → **400** `"Đã hoàn thành phiên kiểm tra hôm nay."` — app nên điều hướng
  sang màn xem lại (không có nút quét).
- Danh sách thiết bị nằm trong phiên = thiết bị đang dùng, được Admin **tick sẵn** "kiểm tra hằng ngày" —
  **không phải mọi server trong hệ thống**. Mỗi item có cờ `requiresScan`: `true` = phải quét QR (máy IDR),
  `false` = không quét, server tự ping lúc kết thúc. Nếu `items` rỗng, đó là do **Admin chưa cấu hình xong**,
  không phải lỗi app — báo lại cho quản trị hệ thống YEV, không phải bug Flutter.
- **`totalCount`/`scannedCount` chỉ đếm máy `requiresScan=true`** (tiến độ quét). Số item `requiresScan=false`
  không nằm trong tiến độ — đừng lấy `items.length` làm mẫu số.

**`ServerCheckSessionDto`** (dùng chung cho `/start`, `GET /{id}`, `GET /today`, `POST /{id}/end`):

```jsonc
{
  "id": 12,
  "checkDate": "2026-09-17T00:00:00",
  "startedAt": "2026-09-17T08:05:00",
  "startedBy": "n.van.a",
  "endedAt": null,                 // có giá trị khi status=1
  "endedBy": null,
  "status": 0,                     // 0=InProgress, 1=Completed
  "statusText": "Đang quét",       // đã dịch sẵn tiếng Việt, hiện thẳng lên UI
  "totalCount": 9,                 // tổng số thiết bị PHẢI QUÉT hôm nay (chỉ item requiresScan=true)
  "scannedCount": 3,               // số máy phải quét đã quét OK (chỉ item requiresScan=true)
  "items": [
    {
      "id": 101,
      "deviceId": 55,
      "deviceCode": "SRV-01",             // MÃ QUÉT — dòng 1 của QR, dùng để so khớp khi quét
      "deviceName": "Server File",
      "category": 0,                      // 0=Server, 1=Network, 2=Ups
      "categoryText": "Server",           // đã dịch sẵn
      "requiresScan": true,               // true = phải quét QR (IDR); false = KHÔNG quét, server tự ping lúc kết thúc
      "scannedAt": "2026-09-17T08:06:12", // null nếu chưa quét
      "scannedBy": "n.van.a",             // null nếu chưa quét
      "status": 1,                        // 0=Pending(chưa quét), 1=Ok, 2=Ng
      "statusText": "OK",
      "note": null
    },
    {
      "id": 102, "deviceId": 60, "deviceCode": "SWT-01", "deviceName": "Switch core",
      "category": 1, "categoryText": "Network", "requiresScan": false,   // không quét — chờ tự ping lúc kết thúc
      "scannedAt": null, "scannedBy": null, "status": 0, "statusText": "Chưa quét", "note": null
    }
  ],
  "manualResults": [
    {
      "manualItemId": 1,
      "manualItemName": "Tình trạng âm thanh, mùi, nhiệt độ",
      "status": 0,                        // 0=Pending, 1=Ok, 2=Ng
      "statusText": "Chưa quét",
      "note": null,
      "confirmedBy": null,
      "confirmedAt": null
    }
    // ... đủ 8 mục (gồm "Máy lạnh"), xem 6.5
  ]
}
```

`items`/`manualResults` **luôn có mặt đầy đủ ngay từ `/start`** (đã snapshot hết, không phải chỉ những gì
đã quét) — app render danh sách đủ ngay khi bắt đầu, rồi cập nhật từng dòng khi có sự kiện quét.

### 6.3 `POST /{id}/scan` — quét 1 mã QR

Permission: `Asset.ServerCheck.Scan`. `{id}` = `ServerCheckSessionDto.id` của phiên đang mở (từ `/start`
hoặc `/today`).

```jsonc
// Request body
{ "deviceCode": "SRV-01" }
```

- `deviceCode` = **dòng đầu tiên** của nội dung QR — QR dán trên thiết bị có nhiều dòng thông tin
  (mã máy/tên/serial/xưởng...) nhưng **dòng 1 luôn cố định là mã máy**, tách lấy dòng 1 trước khi gửi lên
  (không gửi nguyên khối text quét được).
- Response thành công → `ServerCheckItemDto` (đúng dòng vừa cập nhật, cùng shape 1 phần tử `items` ở 6.2)
  với `status=1` (OK), `scannedAt`/`scannedBy` đã điền.
- **Idempotent**: quét lại 1 máy đã OK vẫn `200 OK`, chỉ cập nhật lại giờ quét, không lỗi, không tăng đếm gì bất thường.
- **Mã không thuộc phạm vi hôm nay** (quét sai mã, quét nhầm thiết bị không nằm trong danh sách, hoặc
  mã không tồn tại) → **400**. Đây là API gọi liên tục khi đi quét nhanh — app nên có **1 ô input luôn giữ
  focus**, nhận input từ đầu đọc QR (hoạt động như bàn phím), Enter tự submit rồi xoá ô + focus lại ngay,
  kèm rung máy + tiếng "beep lỗi" khi 400 vì người quét thường không nhìn màn hình liên tục.
- **Máy `requiresScan=false`** (SVR/SWT/UPS/NAS… — không cần quét) mà bị quét → **400**
  `"Thiết bị '...' không cần quét QR — hệ thống tự ping khi kết thúc phiên."`. Xử lý như quét sai (rung + beep),
  không phải lỗi app.
- Phiên đã `Completed` (đã bấm kết thúc) → 400, không quét được nữa.

### 6.4 `POST /{id}/end` — kết thúc phiên

Permission: `Asset.ServerCheck.Scan`. Đây là API **khoá phiên hôm nay** — gọi xong không quét/sửa được nữa.

**Trước khi gọi**, app phải chuẩn bị đủ 2 phần từ dữ liệu hiện có (không cần gọi thêm API khác để lấy,
trừ khi muốn cho user OK/NG dựa theo kết quả ping — xem 6.6):

```jsonc
// Request body
{
  "items": [
    // CHỈ liệt kê những item còn "status=0" (Pending, chưa quét) mà user muốn ghi chú lý do —
    // item đã OK thì KHÔNG cần gửi (server tự bỏ qua nếu có gửi kèm).
    { "serverCheckItemId": 102, "note": "Không thấy đèn nguồn, nghi hỏng dây" }
  ],
  "manualResults": [
    // BẮT BUỘC đủ TOÀN BỘ manualItemId đang active (lấy từ GET /manual-items, 6.5) — thiếu 1 mục → 400.
    { "manualItemId": 1, "status": 1, "note": null },              // 1=Ok
    { "manualItemId": 2, "status": 1, "note": null },
    { "manualItemId": 3, "status": 1, "note": null },
    { "manualItemId": 4, "status": 2, "note": "Không gửi được mail ra ngoài lúc 8h20" }  // 2=Ng, note nên ghi lý do
  ]
}
```

- `status` trong `manualResults` chỉ nhận `1`(Ok) hoặc `2`(Ng) — không phải `0` (0 chỉ là trạng thái mặc
  định lúc chưa xác nhận, không được gửi lên).
- Thiếu bất kỳ `manualItemId` nào đang active → **400** `"Vui lòng xác nhận đủ toàn bộ mục kiểm tra thủ công."`
  — app nên disable nút "Kết thúc" tới khi user đã chọn OK/NG cho **tất cả** dòng trong `manual-items`.
- Item **`requiresScan=true`** còn `Pending` (chưa quét) mà **không** được liệt kê trong `items` của body này
  → server tự chuyển sang **NG** không ghi chú. Nên nhắc user quét đủ trước khi kết thúc, nhưng không chặn
  cứng (cho phép kết thúc dở nếu thật sự có máy hỏng đầu đọc QR/không quét được).
- `items` trong body **chỉ nên chứa máy `requiresScan=true` còn Pending** (để ghi chú lý do). Máy
  `requiresScan=false` **không cần gửi** — server tự xử lý: **ping mọi IP đang gán cho máy** (đạt ≥8/10 lần
  mới tính OK) → tất cả IP đạt = `Ok`, có IP lỗi = `Ng` + note `"Không ping được: <ip>"`; máy chưa gán IP nào
  = `Ng` + note `"Chưa có IP để ping"`. Kết quả này vào các cột Server/Network/UPS của báo cáo.
- ⚠️ **Request này CHẬM** (ping xong mới trả, thường 10–60 giây tuỳ số máy): app phải hiện loading + **khoá nút
  bấm** để khỏi gửi lặp, và đặt `receiveTimeout` của HTTP client **≥ 120 giây** cho riêng API này. Trước khi
  bấm xác nhận nên hiện dòng báo trước "N thiết bị không cần quét sẽ được hệ thống tự ping (có thể mất vài chục giây)".
- Thành công → trả về `ServerCheckSessionDto` với `status=1` (`Completed`) — dùng để cập nhật UI ngay,
  không cần gọi lại `/today`.
- Gọi `/scan` hoặc `/end` lần nữa trên phiên đã Completed → **400**.

### 6.5 `GET /manual-items` — danh sách mục xác nhận thủ công

Permission: `Asset.ServerCheck.Scan`. Không tham số. Dữ liệu **không đổi giữa các ngày** — app có thể
cache trong phiên làm việc, không cần gọi lại liên tục.

```jsonc
[
  { "id": 1, "name": "Tình trạng âm thanh, mùi, nhiệt độ", "displayOrder": 1, "usesNetworkPing": false },
  { "id": 2, "name": "Network - Factory", "displayOrder": 2, "usesNetworkPing": true },
  { "id": 3, "name": "Network - Server", "displayOrder": 3, "usesNetworkPing": true },
  { "id": 4, "name": "Gởi nhận Mail", "displayOrder": 4, "usesNetworkPing": false },
  { "id": 5, "name": "Backup - File Srv", "displayOrder": 5, "usesNetworkPing": false },
  { "id": 6, "name": "Backup - OES", "displayOrder": 6, "usesNetworkPing": false },
  { "id": 7, "name": "Backup - Domain", "displayOrder": 7, "usesNetworkPing": false },
  { "id": 8, "name": "Máy lạnh", "displayOrder": 8, "usesNetworkPing": false, "isAirConditioner": true }
]
// (mọi phần tử đều có field isAirConditioner; chỉ mục "Máy lạnh" là true, các mục khác false — rút gọn ở trên)
```

- **App phải render động theo danh sách trả về** (sort theo `displayOrder`), **không hardcode** số lượng
  mục hay tên — Backend có thể thêm/bớt mục bằng migration mà không đổi API, hiện tại là 7 dòng nhưng
  con số này **có thể đổi trong tương lai**.
- **"Máy lạnh"** (`isAirConditioner: true`) là mục tick tay như mọi mục thủ công khác (OK/NG + ghi chú khi NG) —
  máy lạnh không còn là thiết bị trong `items`, không quét, không ping. Cứ render chung trong danh sách mục thủ công.
- 2 dòng có `usesNetworkPing: true` (hiện là "Network - Factory"/"Network - Server") — app hiện thêm 1 nút
  **"Kiểm tra network"** cạnh 2 mục này, gọi API 6.6 khi bấm, rồi tự động điền OK/NG cho **cả 2 dòng** đó
  theo kết quả trả về (user vẫn sửa tay lại được trước khi bấm "Kết thúc"). Các mục còn lại (`false`) chỉ
  có 2 nút OK/NG để user tự chọn bằng tay như bình thường.

### 6.6 `GET /network-ping` — tự động ping kiểm tra mạng

Permission: `Asset.ServerCheck.Scan`. Không tham số, không ghi dữ liệu — **gọi lại bao nhiêu lần cũng được**
(dùng cho nút "Kiểm tra lại" sau khi xử lý sự cố tại chỗ).

Backend tự ping toàn bộ IP đang gán cho thiết bị Server/Network/UPS **đã được Admin tick "kiểm tra hằng ngày"**
(gồm cả máy IDR phải quét — với IDR ping chỉ để tham khảo), theo xưởng của tài khoản đang đăng nhập (app không
cần truyền chi nhánh). Đây là bản **xem trước** để điền 2 mục "Network - Factory/Server"; việc chốt OK/NG cho
từng máy tự-ping vẫn do `POST /{id}/end` làm (6.4).

```jsonc
{
  "totalCount": 55,
  "reachableCount": 29,
  "allReachable": false,
  "items": [
    { "ipAddress": "10.45.1.4", "deviceId": 3, "deviceCode": "SERVER-003", "deviceName": "vndahubcas001",
      "category": 0, "categoryText": "Server", "reachable": false, "roundtripMs": null },
    { "ipAddress": "10.45.1.16", "deviceId": 10, "deviceCode": "SERVER-010", "deviceName": "vndamb002",
      "category": 0, "categoryText": "Server", "reachable": true, "roundtripMs": 2 }
  ]
}
```

Cách dùng gợi ý:
- `allReachable: true` → tự set `status=1` (Ok) cho 2 mục `usesNetworkPing` trong `manualResults`.
- `allReachable: false` → tự set `status=2` (Ng), tự điền `note` liệt kê các máy lỗi, ví dụ:
  `"SERVER-003 (10.45.1.4); SERVER-XYZ (10.45.1.9)"` (nối các `item.reachable=false` bằng `"; "`,
  format `"{deviceCode} ({ipAddress})"`) — cho user xem trực tiếp máy nào mất kết nối để xử lý tại chỗ,
  vẫn cho sửa tay OK/NG/ghi chú trước khi kết thúc phiên.

### 6.7 Các endpoint khác (không bắt buộc cho app quét, chỉ để tham khảo)

Nếu app Flutter còn muốn làm thêm màn "Xem lại lịch sử"/"Báo cáo" (không phải luồng quét chính):

- `GET /grid-list?pageIndex=&pageSize=&fromDate=&toDate=` (permission `Asset.ServerCheck.View`) — danh
  sách phiên theo trang, `items`/`manualResults` trả **rỗng** (chỉ có `checkDate/status/startedBy/endedBy/
  totalCount/scannedCount`) — bấm vào 1 dòng thì gọi `GET /{id}` lấy đủ chi tiết (shape giống 6.2).
- `GET /report?fromDate=&toDate=` (permission `Asset.ServerCheck.View`) — dữ liệu tổng hợp dạng báo cáo
  in ấn (không phải nhu cầu chính của app quét — bỏ qua nếu không làm màn báo cáo).

## 7. Bảng tra enum

**`ServerCheckCategory`** (field `category` trong `items`):

| Giá trị | Tên | `categoryText` |
|---|---|---|
| 0 | Server | "Server" |
| 1 | Network | "Network" |
| 2 | Ups | "UPS" |

> Không còn giá trị `3` (máy lạnh đã bỏ khỏi danh mục thiết bị, chuyển thành mục thủ công — xem 6.5).

**`ServerCheckItemStatus`** (field `status` trong `items` và `manualResults`):

| Giá trị | Tên | `statusText` (items) |
|---|---|---|
| 0 | Pending | "Chưa quét" |
| 1 | Ok | "OK" |
| 2 | Ng | "NG" |

**`ServerCheckSessionStatus`** (field `status` trong session):

| Giá trị | Tên | `statusText` |
|---|---|---|
| 0 | InProgress | "Đang quét" |
| 1 | Completed | "Đã hoàn thành" |

> Các field `*Text` đã được server dịch sẵn tiếng Việt — app **nên hiện thẳng `*Text`** thay vì tự map số
> sang chữ, để nếu Backend đổi câu chữ thì app không cần build lại.

## 8. Lỗi thường gặp khi tích hợp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Login 400 dù đúng tài khoản | Gửi `userName` kèm domain (`YEV\...`) | Chỉ gửi phần sau dấu `\` |
| Mọi API trả 401 dù vừa login | Thiếu header `Authorization: Bearer <token>`, hoặc token đã quá 120 phút | Kiểm tra header; thử `GET /Auth/me` để gia hạn |
| Login/get thành công nhưng `/ServerCheck/*` trả 403 | Tài khoản chưa được Admin cấp `Asset.ServerCheck.Scan`/`View` | Không phải lỗi app — báo Admin hệ thống YEV |
| `POST /start` trả `items` rỗng (hoặc `totalCount: 0` dù có item) | `items` rỗng: Admin chưa tick "kiểm tra hằng ngày" cho thiết bị nào. `totalCount: 0` mà `items` vẫn có: chưa có loại thiết bị nào được bật "Phải quét QR" (chỉ IDR) — toàn bộ máy sẽ tự ping | Không phải lỗi app — báo Admin cấu hình |
| Quét máy SVR/SWT/UPS/NAS trả 400 "không cần quét QR" | Máy đó `requiresScan=false`, chỉ tự ping lúc kết thúc | Đúng thiết kế — đừng cho quét, đừng hiện checkbox/vòng tròn "chưa quét" cho máy này |
| `POST /{id}/end` bị timeout dù server vẫn xử lý | Server ping các máy tự-ping trong request nên chậm hơn trước nhiều | Tăng `receiveTimeout` ≥ 120s; nếu vẫn timeout, gọi `GET /today` xem phiên đã `status=1` chưa trước khi cho thử lại |
| Quét đúng mã in trên thiết bị vẫn 400 "không thuộc phạm vi" | Thiết bị đó chưa được Admin tick cờ quét QR (có thể là server ảo/thiết bị không nằm trong phòng), hoặc quét nhầm ngày (mã không đổi nhưng thiết bị chưa được thêm) | Đối chiếu lại danh sách `items` của phiên hiện tại, không tự ý bỏ qua lỗi |
| `POST /{id}/end` báo thiếu mục thủ công dù đã chọn hết trên UI | `manualItemId` gửi lên không khớp `id` mới nhất từ `GET /manual-items` (đã cache cũ trong khi Backend vừa thêm/đổi mục) | Gọi lại `GET /manual-items` trước khi build request `/end`, đừng hardcode danh sách cũ |
| Quét/kết thúc phiên trả 400 dù trước đó hoạt động bình thường | Phiên đã bị **người khác** kết thúc trước (vd 2 nhân viên cùng dùng 1 tài khoản/2 máy) — chỉ 1 phiên/ngày | Gọi lại `GET /today` để đồng bộ trạng thái mới nhất, không giữ state cũ trong app quá lâu |

## 9. Gợi ý UX cho máy quét

- Màn hình quét nên có **1 ô input ẩn/luôn giữ focus** nhận ký tự từ đầu đọc QR (hoạt động như bàn phím
  vật lý gõ nhanh + Enter) — không bắt buộc phải dùng camera preview nếu thiết bị có đầu đọc laser
  chuyên dụng (TC21/TC22); nếu dùng camera thường (điện thoại phổ thông) thì decode QR bằng thư viện
  (vd `mobile_scanner`) rồi tách lấy dòng 1 trước khi gọi API 6.3.
- Quét sai/ngoài phạm vi (400) nên phản hồi **ngay lập tức bằng âm thanh + rung**, không hiện dialog chặn
  luồng — người dùng đang thao tác nhanh, tay cầm máy quét không nhìn màn hình liên tục.
- Hiện rõ tiến độ `scannedCount / totalCount` ở đầu màn hình quét (chỉ tính máy `requiresScan=true`), danh sách
  bên dưới **chỉ liệt kê máy phải quét**, highlight thiết bị vừa quét được (theo `deviceId` trong response 6.3).
  Máy `requiresScan=false` để ở **khối riêng "Tự kiểm tra"** phía dưới: chỉ tên + loại, **không** có vòng tròn/dấu tick trạng thái.
- Cho phép **thoát app giữa chừng** — mở lại chỉ cần gọi `GET /today` rồi `POST /start` là khôi phục đúng
  tiến độ, không cần tự lưu state phiên quét trên máy.

## 10. Checklist trước khi tích hợp xong

1. Đăng nhập bằng `/api/Auth/login`, lưu token, gắn `Authorization: Bearer` cho mọi request `/ServerCheck/*`.
2. Xử lý `401` bằng thử gia hạn qua `/Auth/me` trước khi bắt đăng nhập lại.
3. Vào app → luôn gọi `GET /today` trước để quyết định vào màn nào (bắt đầu mới / tiếp tục quét / đã xong hôm nay).
4. Quét theo API 6.3, xử lý lỗi 400 bằng phản hồi tức thời (âm thanh/rung), không hardcode danh sách mã QR ở app.
4b. Tách `items` theo `requiresScan`: quét + tính tiến độ chỉ với `true`; `false` hiện ở khối "Tự kiểm tra", không quét.
5. Màn kết thúc: gọi `GET /manual-items` **mỗi lần** (không hardcode 8 mục, gồm cả "Máy lạnh"), bắt buộc user chọn đủ OK/NG mọi mục trước khi cho bấm "Kết thúc". Danh sách "chưa quét, ghi chú lý do" chỉ gồm máy `requiresScan=true`. `POST /end` chậm → loading + timeout ≥ 120s.
6. Có nút "Kiểm tra network" gọi 6.6 (xem trước), tự điền kết quả 2 mục network nhưng vẫn cho sửa tay.
7. Test thử với tài khoản **có đủ** `Asset.ServerCheck.Scan` + `Asset.ServerCheck.View`, và thử cả tài khoản **thiếu quyền** để chắc chắn app hiện đúng thông báo 403 (không crash).
