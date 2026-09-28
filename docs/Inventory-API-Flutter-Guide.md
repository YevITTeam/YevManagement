# Hướng dẫn tích hợp API "Kiểm kê thiết bị" (Inventory) — cho app mobile

> Tài liệu này viết riêng cho đội phát triển app mobile quét mã kiểm kê thiết bị theo xưởng, tự chứa đủ
> thông tin để tích hợp mà không cần đọc thêm tài liệu nào khác của hệ thống YEV Management. Nếu có sai
> khác giữa tài liệu này và response thật của server, **tin theo response thật** và báo lại cho đội
> Backend (`docs/docs-be/asset-module.md §1.22` là nguồn chân lý gốc phía backend).
>
> Tính năng này **độc lập** với "Kiểm tra Server" (`ServerCheck`, xem `ServerCheck-API-Flutter-Guide.md`)
> dù cùng mô hình quét mã theo phiên — 2 nghiệp vụ khác mục đích, khác bảng dữ liệu, khác quyền/role.
> Nếu app dùng chung 1 codebase cho cả 2 tính năng, đừng gộp state/API client của chúng lại với nhau.

## 1. Bối cảnh nghiệp vụ

Định kỳ (quý/năm, công ty tự quyết — **hệ thống không ép tần suất**), mỗi xưởng cần kiểm kê lại toàn bộ
thiết bị đang có để đối chiếu với dữ liệu trong hệ thống. App mobile thay việc kiểm đếm thủ công bằng
**quét mã thiết bị** (QR dán sẵn trên máy, dùng lại tem đã in cho mục đích khác — dòng 1 luôn là mã máy)
lần lượt từng thiết bị trong xưởng.

Khác với "Kiểm tra Server" (kiểm tra vận hành hằng ngày cho 1 nhóm thiết bị hẹp trong phòng server):
Inventory quét **toàn bộ thiết bị đang dùng của cả xưởng**, theo **đợt** chứ không phải hằng ngày, và
**nhiều nhân viên có thể cùng quét chung 1 đợt** (vì 1 xưởng có quá nhiều máy ở nhiều nơi, không thể để
1 người quét hết).

Toàn bộ nghiệp vụ gói trong **1 phiên kiểm kê** (`InventorySession`) mỗi xưởng:
1. Nhân viên đăng nhập → bấm "Bắt đầu kiểm kê" → hệ thống snapshot toàn bộ thiết bị của xưởng mình.
   Nếu xưởng đã có người khác mở phiên rồi, hệ thống trả lại **đúng phiên đang chạy** đó — nhiều nhân
   viên gán cùng 1 xưởng đều làm việc trên **1 phiên chung**.
2. Nhân viên đi khắp xưởng, quét lần lượt từng mã thiết bị → mỗi lần quét gọi 1 API.
3. Quét xong (hoặc muốn dừng vì hết giờ), vào màn tổng kết: ghi chú lý do cho các máy chưa tìm thấy →
   bấm "Kết thúc phiên" → khoá phiên, không sửa được nữa.

**Không giới hạn 1 phiên/ngày** như ServerCheck — chỉ giới hạn **1 xưởng không có quá 1 phiên đang chạy
cùng lúc**. Nếu app bị tắt/crash giữa chừng, mở lại gọi `POST /start` sẽ nhận về đúng phiên đang dở,
không mất dữ liệu đã quét.

## 2. Base URL & môi trường

- **Hiện tại**: `http://10.45.1.155:8081` — lấy chuẩn từ
  `CompanySystem.HostApi/Properties/launchSettings.json` phía backend (đổi từ `:8080` ngày 2026-08-26,
  **có thể đổi tiếp** khi đội hạ tầng cấp IP tĩnh khác — hỏi lại đội Backend trước khi build bản release,
  đừng tin bất kỳ IP nào ghi trong tài liệu cũ hơn ngày đó).
- Tất cả endpoint dưới đây có tiền tố `/api`. Ví dụ endpoint đầy đủ:
  `http://10.45.1.155:8081/api/Inventory/current`.
- Không có HTTPS ở giai đoạn hiện tại (mạng LAN nội bộ công ty) — app phải cho phép gọi `http://` (Android
  cần khai báo `usesCleartextTraffic="true"` hoặc Network Security Config cho phép domain/IP này).
- Không có Swagger/OpenAPI public cho môi trường ngoài Development — nếu cần xem thử trực tiếp, dùng
  trình duyệt trên máy trong mạng công ty mở `http://10.45.1.155:8081/scalar/v1`.

## 3. Đăng nhập (Auth)

App mobile **không chạy trong domain Windows** nên **không dùng** được `windows-login` (Negotiate/SSO).
Dùng endpoint đăng nhập bằng form:

```
POST /api/Auth/login
Content-Type: application/json

{ "userName": "n.van.a", "password": "..." }
```

- `userName` **không kèm domain** (không phải `YEV\n.van.a`, chỉ phần sau dấu `\`).
- Backend tự xác thực với Active Directory thật (không có hệ mật khẩu riêng, không lưu password).
- Sai tài khoản/mật khẩu → response `isSuccess: false`, message chung "Tên đăng nhập hoặc mật khẩu không đúng."

**Response thành công** (`data`):

```jsonc
{
  "user": {
    "id": 12,
    "userName": "YEV\\n.van.a",
    "fullName": "Nguyen Van A",
    "deviceName": "DESKTOP-ABC123",      // nullable, chỉ để hiển thị
    "email": "n.van.a@yazaki.com",       // nullable
    "roles": ["Basic"],
    "permissions": ["Asset.Inventory.Scan", "Asset.Inventory.View", "..."]
  },
  "token": "eyJhbGciOi..."               // JWT — dùng cho MỌI request sau
}
```

Lưu `token` an toàn trên máy (`flutter_secure_storage` khuyến nghị). Mọi request tiếp theo gắn header:

```
Authorization: Bearer <token>
```

- **Token hết hạn sau 120 phút.** Gọi `GET /api/Auth/me` (chỉ cần Bearer, không cần permission) để lấy lại
  `user` + **JWT mới đã gia hạn thêm 120 phút**, response `data` shape y hệt `/login` (`{ user, token }`).
  Nên gọi định kỳ (vd mỗi 30 phút khi app đang mở) hoặc bắt lỗi `401` ở bất kỳ API nào → thử
  `GET /Auth/me` 1 lần → còn lỗi mới bắt đăng nhập lại từ đầu.
- Người dùng phải được **Admin cấp quyền** `Asset.Inventory.Scan` (để quét + kết thúc phiên) trước —
  thiếu quyền thì API trả **`403`** (đủ token nhưng thiếu quyền). Nếu tài khoản test bị 403, báo Admin
  hệ thống gán quyền (role **"Kiểm kê thiết bị"** đã có sẵn `Asset.Inventory.Scan`) chứ không phải lỗi
  tích hợp.

## 4. Envelope response chung

**Mọi** response (kể cả lỗi) đều bọc theo dạng:

```jsonc
{
  "isSuccess": true,
  "message": "Bắt đầu phiên kiểm kê thành công.",
  "data": { /* ... */ },
  "errors": null,          // string[] | null — thường có giá trị khi validate fail (400)
  "timestamp": "2026-09-23T08:05:00Z"
}
```

App luôn đọc `isSuccess` trước, lấy dữ liệu ở `data`; khi `isSuccess=false` hiện `message` (đã là tiếng
Việt, dùng được thẳng cho toast/dialog).

**Mã lỗi HTTP:**

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 400 | Lỗi nghiệp vụ/validate (vd mã không thuộc phạm vi xưởng đang kiểm kê, phiên đã kết thúc) — đọc `message` |
| 401 | Thiếu/sai/hết hạn token → thử `GET /Auth/me`, còn lỗi thì bắt đăng nhập lại |
| 403 | Có token nhưng tài khoản thiếu permission (`Asset.Inventory.Scan`) |
| 404 | Không tìm thấy tài nguyên (vd `sessionId` sai) |
| 500 | Lỗi hệ thống — hiện thông báo chung, báo Backend |

## 5. Luồng nghiệp vụ tổng quát

```
[Mở app] → POST /Auth/login (hoặc GET /Auth/me nếu còn token)
        → GET /InventoryAssignment/me
            ├─ null                → chặn hẳn, hiện "chưa được phân công xưởng"
            └─ có data             → hiện branchName, tiếp tục
        → GET /Inventory/current
            ├─ null                      → hiện màn "Bắt đầu kiểm kê"
            ├─ status=0 (InProgress)     → vào thẳng màn quét, load lại items đã có (của MÌNH hoặc
            │                              đồng nghiệp khác đã quét trước đó — phiên dùng chung)
            └─ status=1 (Completed)      → không xảy ra thực tế (phiên Completed thì current trả null),
                                            liệt kê để hoàn chỉnh state machine

[Bấm "Bắt đầu"] → POST /Inventory/start → nhận InventorySessionDto (đủ "items", tất cả status=0)
        → vào màn quét

[Màn quét] (lặp lại)
    → mỗi lần quét được mã: POST /Inventory/{id}/scan { "deviceCode": "<dòng 1 của QR>" }
    → cập nhật dòng thiết bị đó trên UI theo response (status=Found, scannedAt, scannedBy)
    → gọi lại GET /Inventory/current để đồng bộ (bắt các thiết bị đồng nghiệp khác vừa quét — xem §6.1)
    → quét sai/không thuộc phạm vi xưởng này → 400 → rung máy/beep lỗi, KHÔNG chặn quét tiếp mã khác,
      KHÔNG có khái niệm "quét thừa" — mã sai/ngoài phạm vi hoàn toàn không được ghi nhận

[Bấm "Kết thúc phiên"] (khi đã quét xong hoặc muốn dừng)
    → hiện danh sách item còn "Chưa tìm thấy" (status=0), cho nhập ghi chú lý do (tự do, không bắt buộc)
    → POST /Inventory/{id}/end { items: [...] }
    → nhận lại InventorySessionDto với status=1 (Completed) → khoá, không quét/kết thúc lại được nữa
```

## 6. Chi tiết từng endpoint

Tất cả endpoint dưới đây cần header `Authorization: Bearer <token>`.

### 6.0 `GET /api/InventoryAssignment/me` — xưởng của mình (BẮT BUỘC gọi trước tiên)

- Permission: `Asset.Inventory.Scan`.
- Response `data`: `{ "id", "userId", "userName", "fullName", "branchId", "branchName" }` hoặc **`null`**
  nếu chưa được phân công.
- `data == null` → **chặn toàn bộ màn quét**, hiện "Tài khoản của bạn chưa được phân công xưởng kiểm kê
  thiết bị. Vui lòng liên hệ Admin." (không gọi tiếp `/current`, `/start`).
- Có `data` → hiện tên xưởng (`branchName`) nổi bật trên đầu màn hình. App **không có ô chọn xưởng**,
  không gửi xưởng lên server ở bất kỳ API nào bên dưới — server tự dùng xưởng của tài khoản đang đăng
  nhập.
- **Khác ServerCheckAssignment**: nhiều tài khoản khác nhau có thể cùng được gán 1 xưởng (để cùng kiểm
  kê chung) — đừng giả định "mỗi xưởng chỉ có đúng 1 người phụ trách".

### 6.1 `GET /Inventory/current` — phiên đang chạy của xưởng mình

Permission: `Asset.Inventory.Scan`. Không tham số (không nhận `branchId` — luôn là xưởng của người gọi).

- `data: null` → xưởng này **chưa có phiên nào đang chạy**.
- `data: InventorySessionDto` với `status=0` (`InProgress`) → app vào thẳng màn quét, load `items` hiện
  có.
- Gọi API này **mỗi lần mở app** để biết vào màn nào. **Cũng nên gọi lại sau mỗi lần quét thành công**
  (thay vì tự cập nhật item trong state cục bộ) — vì phiên có thể có **nhiều người khác đang quét chung**
  cùng lúc, gọi lại `current` là cách duy nhất để thấy tiến độ mới nhất của cả nhóm.

### 6.2 `POST /start` — bắt đầu (hoặc tham gia) phiên kiểm kê

Permission: `Asset.Inventory.Scan`. Không body.

- Nếu xưởng **chưa có phiên đang chạy** → tạo mới, snapshot **thiết bị đang trong trạng thái "Đang sử
  dụng"** của xưởng, thuộc loại thiết bị được Admin bật "Đưa vào kiểm kê" (2026-09-23 — máy "Chờ sử dụng"/"Chờ thanh lý"/đã thanh lý **không** được đưa vào
  đợt kiểm kê), trả về `status=0`, `items` đủ danh sách nhưng tất cả đang `status=0` ("Chưa tìm thấy").
- Nếu xưởng **đã có phiên `InProgress`** (do chính mình hoặc **đồng nghiệp khác** mở trước) → trả lại
  **nguyên phiên đó** (giữ nguyên các item đã quét bởi bất kỳ ai), **không** tạo phiên mới — đây là cách
  nhiều người "tham gia" cùng 1 đợt kiểm kê.
- Response **không có trường "đã hoàn thành"** kiểu 400 như ServerCheck — vì Inventory không giới hạn
  1 phiên/ngày, phiên trước `Completed` thì `start` tiếp theo tạo phiên **mới** bình thường.

**`InventorySessionDto`** (dùng chung cho `/start`, `GET /current`, `GET /{id}`, `POST /{id}/end`):

```jsonc
{
  "id": 5,
  "branchId": 2,
  "branchName": "Xưởng Dĩ An",
  "startedAt": "2026-09-23T08:05:00",
  "startedBy": "n.van.a",
  "endedAt": null,                 // có giá trị khi status=1
  "endedBy": null,
  "status": 0,                     // 0=InProgress, 1=Completed
  "statusText": "Đang kiểm kê",    // đã dịch sẵn tiếng Việt, hiện thẳng lên UI
  "totalCount": 128,               // tổng số thiết bị cần kiểm kê của xưởng
  "foundCount": 40,                // số đã tìm thấy
  "missingCount": 0,               // số bị đánh dấu Missing — CHỈ có giá trị > 0 sau khi Completed
  "items": [
    {
      "id": 1001,
      "deviceId": 55,
      "deviceCode": "PC-0123",            // MÃ QUÉT — dòng 1 của QR, dùng để so khớp khi quét
      "deviceName": "Dell OptiPlex 7080",
      "deviceTypeName": "Desktop", // + manager, groupName, departmentName, serialNumber (đều nullable) — thông tin cơ bản để hiển thị/đối chiếu
      "scannedAt": "2026-09-23T08:12:03", // null nếu chưa quét
      "scannedBy": "n.van.a",             // null nếu chưa quét — có thể là NGƯỜI KHÁC trong cùng xưởng
      "status": 1,                        // 0=Pending(chưa tìm thấy), 1=Found, 2=Missing
      "statusText": "Đã tìm thấy",
      "note": null
    },
    {
      "id": 1002, "deviceId": 60, "deviceCode": "PC-0456", "deviceName": "HP EliteDesk 800",
      "scannedAt": null, "scannedBy": null, "status": 0, "statusText": "Chưa kiểm kê", "note": null
    }
  ]
}
```

`items` **luôn có mặt đầy đủ ngay từ `/start`** (đã snapshot hết) — app render danh sách đủ ngay khi bắt
đầu, rồi cập nhật khi có sự kiện quét (của mình hoặc đồng nghiệp, qua việc gọi lại `GET /current`).
**Không có field `category`/`manualResults`** như ServerCheck — Inventory không phân loại thiết bị,
không có mục xác nhận thủ công.

### 6.3 `POST /{id}/scan` — quét 1 mã thiết bị

Permission: `Asset.Inventory.Scan`. `{id}` = `InventorySessionDto.id` của phiên đang mở (từ `/start`
hoặc `/current`).

```jsonc
// Request body
{ "deviceCode": "PC-0123" }
```

- `deviceCode` = mã thiết bị (dòng đầu tiên nếu quét từ tem QR có nhiều dòng thông tin, giống ServerCheck).
- Response thành công → `InventorySessionItemDto` (đúng dòng vừa cập nhật) với `status=1` (Found),
  `scannedAt`/`scannedBy` đã điền.
- **Idempotent**: quét lại 1 máy đã `Found` vẫn `200 OK`, chỉ cập nhật lại giờ quét, không lỗi.
- **Mã không thuộc phạm vi xưởng đang kiểm kê** → **400**, **không ghi nhận gì cả** — áp dụng cho CẢ 2
  trường hợp: (a) mã không tồn tại trong hệ thống, (b) mã tồn tại nhưng thiết bị đó thuộc **xưởng khác**
  (hoặc mới chuyển vào xưởng này SAU khi phiên đã bắt đầu). App **không cần** và **không nên** phân biệt
  2 lý do này trong UI — chỉ cần báo "mã này không thuộc phạm vi kiểm kê" chung.
- Đây là API gọi liên tục khi đi quét nhanh — app nên có **1 ô input luôn giữ focus**, nhận input từ đầu
  đọc mã (hoạt động như bàn phím), Enter tự submit rồi xoá ô + focus lại ngay, kèm rung máy + tiếng "beep
  lỗi" khi 400 vì người quét thường không nhìn màn hình liên tục.
- Phiên đã `Completed` → 400, không quét được nữa.

### 6.4 `POST /{id}/end` — kết thúc phiên

Permission: `Asset.Inventory.Scan`. Đây là API **khoá phiên** — gọi xong không quét/sửa được nữa, và
bất kỳ ai trong xưởng cũng gọi được (không nhất thiết phải là người bấm "Bắt đầu").

```jsonc
// Request body
{
  "items": [
    // CHỈ liệt kê những item còn "status=0" (Pending, chưa tìm thấy) mà user muốn ghi chú lý do —
    // item đã Found thì KHÔNG cần gửi (server tự bỏ qua nếu có gửi kèm). Note không bắt buộc.
    { "inventorySessionItemId": 1002, "note": "Không tìm thấy tại vị trí ghi nhận, nghi đã chuyển đi" }
  ]
}
```

- Item nào còn `Pending` (chưa tìm thấy) mà **không** được liệt kê trong `items` của body này → server
  tự chuyển sang **Missing** không ghi chú. **Không có checklist bắt buộc nào khác** (khác ServerCheck
  không có "manualResults" phải xác nhận đủ).
- Thành công → trả về `InventorySessionDto` với `status=1` (`Completed`) — dùng để cập nhật UI ngay,
  không cần gọi lại `/current`.
- Gọi `/scan` hoặc `/end` lần nữa trên phiên đã `Completed` → **400**.

### 6.5 Các endpoint khác (không bắt buộc cho app quét, chỉ để tham khảo)

Nếu app mobile còn muốn làm thêm màn "Xem lại lịch sử"/"Báo cáo" — các endpoint này cần permission
`Asset.Inventory.View` (khác `Scan`, phải xin cấp thêm nếu cần):

- `GET /Inventory/{id}` (View) — chi tiết 1 phiên bất kỳ (không giới hạn xưởng của mình nếu có quyền View).
- `GET /Inventory/grid-list?pageIndex=&pageSize=&fromDate=&toDate=&branchId=` (View) — danh sách phiên
  theo trang.
- `GET /Inventory/{id}/export` (View) — tải file Excel danh sách thiết bị của phiên (không phải JSON).

## 7. Bảng tra enum

**`InventorySessionStatus`** (field `status` trong session):

| Giá trị | Tên | `statusText` |
|---|---|---|
| 0 | InProgress | "Đang kiểm kê" |
| 1 | Completed | "Đã hoàn thành" |

**`InventoryItemStatus`** (field `status` trong `items`):

| Giá trị | Tên | `statusText` |
|---|---|---|
| 0 | Pending | "Chưa kiểm kê" |
| 1 | Found | "Đã tìm thấy" |
| 2 | Missing | "Thiếu" |

> Các field `*Text` đã được server dịch sẵn tiếng Việt — app **nên hiện thẳng `*Text`** thay vì tự map số
> sang chữ, để nếu Backend đổi câu chữ thì app không cần build lại.

## 8. Lỗi thường gặp khi tích hợp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Login 400 dù đúng tài khoản | Gửi `userName` kèm domain (`YEV\...`) | Chỉ gửi phần sau dấu `\` |
| Mọi API trả 401 dù vừa login | Thiếu header `Authorization: Bearer <token>`, hoặc token đã quá 120 phút | Kiểm tra header; thử `GET /Auth/me` để gia hạn |
| Login thành công nhưng `/Inventory/*` trả 403 | Tài khoản chưa được Admin cấp `Asset.Inventory.Scan` (role "Kiểm kê thiết bị") | Không phải lỗi app — báo Admin hệ thống YEV |
| `GET /InventoryAssignment/me` trả `null` mãi dù Admin nói đã phân công | Token cũ phát trước khi được phân công — claim cấp lại lúc login, không phải theo thời gian thực | Yêu cầu user đăng xuất/đăng nhập lại (hoặc gọi `GET /Auth/me`) sau khi được phân công |
| Quét đúng mã in trên thiết bị vẫn 400 "không thuộc phạm vi" | Thiết bị đó thuộc **xưởng khác** với xưởng đang kiểm kê, hoặc vừa được thêm vào hệ thống/chuyển xưởng SAU khi phiên đã `start` | Không phải lỗi app — đối chiếu lại xưởng ghi nhận của thiết bị đó với Admin |
| `POST /start` trả về phiên có `items` khác với lần trước (nhiều/ít hơn) | Có **đồng nghiệp khác** cùng xưởng đã mở/đang dùng phiên đó — dữ liệu là **dùng chung**, không phải bug | Luôn coi `GET /current`/response của `/start` là nguồn dữ liệu mới nhất, không cache items lâu dài trên máy |
| Quét/kết thúc phiên trả 400 dù trước đó hoạt động bình thường | Phiên đã bị **người khác cùng xưởng** kết thúc trước | Gọi lại `GET /current` để đồng bộ trạng thái mới nhất, không giữ state cũ trong app quá lâu |

## 9. Gợi ý UX cho máy quét

- Màn hình quét nên có **1 ô input ẩn/luôn giữ focus** nhận ký tự từ đầu đọc mã (bàn phím vật lý gõ
  nhanh + Enter), hoặc decode QR bằng camera (vd `mobile_scanner`) rồi tách lấy dòng 1 trước khi gọi
  API §6.3.
- Quét sai/ngoài phạm vi (400) nên phản hồi **ngay lập tức bằng âm thanh + rung**, không hiện dialog
  chặn luồng.
- Hiện rõ tiến độ `foundCount / totalCount` ở đầu màn hình, danh sách bên dưới highlight thiết bị vừa
  quét (theo `deviceId`) — **nên tự động gọi lại `GET /current` theo chu kỳ** (vd mỗi 15-30 giây) khi
  màn quét đang mở, để thấy được cả tiến độ do đồng nghiệp khác vừa quét, không chỉ dựa vào response
  của chính lần quét của mình.
- Cho phép **thoát app giữa chừng** — mở lại chỉ cần gọi `GET /current` là khôi phục đúng tiến độ chung
  của cả xưởng, không cần tự lưu state phiên quét trên máy.

## 10. Checklist trước khi tích hợp xong

1. Đăng nhập bằng `/api/Auth/login`, lưu token, gắn `Authorization: Bearer` cho mọi request `/Inventory*`.
2. Xử lý `401` bằng thử gia hạn qua `/Auth/me` trước khi bắt đăng nhập lại.
3. Vào app → gọi `GET /InventoryAssignment/me` trước, chặn hẳn nếu `null`; có xưởng thì gọi tiếp
   `GET /Inventory/current` để quyết định vào màn nào.
4. Quét theo API §6.3, xử lý lỗi 400 bằng phản hồi tức thời (âm thanh/rung), không hardcode danh sách mã.
5. Sau mỗi lần quét (và định kỳ khi màn quét đang mở), gọi lại `GET /current` để đồng bộ tiến độ — **đừng**
   chỉ dựa vào response của chính lần quét vừa gọi, vì có thể có người khác cùng xưởng đang quét chung.
6. Màn kết thúc: cho nhập ghi chú tự do (không bắt buộc) cho từng item còn "Chưa tìm thấy", gọi
   `POST /{id}/end`.
7. Test thử với tài khoản **có** `Asset.Inventory.Scan`, và thử tài khoản **thiếu quyền**/**chưa được
   phân công xưởng** để chắc chắn app hiện đúng thông báo (không crash).
8. Nếu test với **2 tài khoản cùng được gán 1 xưởng**: xác nhận cả 2 cùng thấy và thao tác được trên
   **1 phiên chung**, không tạo ra 2 phiên riêng.
