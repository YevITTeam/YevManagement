# asset-api-fe.md — Tài liệu API module Asset cho Frontend

> Tài liệu này viết cho đội FE dựng giao diện quản lý Thiết bị/PC. Chỉ mô tả
> hợp đồng API (request/response, validate, enum, luật nghiệp vụ ảnh hưởng UI)
> — không đi vào chi tiết code backend. Muốn hiểu implementation, xem
> [asset-module.md](asset-module.md).

- **Base URL (Development)**: `http://localhost:5000`
- **Swagger/Scalar UI**: `http://localhost:5000/scalar/v1` (chỉ chạy ở Development, xem trực tiếp toàn bộ schema tại đây)
- **Auth**: toàn bộ endpoint Asset **bắt buộc** gửi
  `Authorization: Bearer <token>` (JWT lấy từ `POST /api/Auth/windows-login`, xem
  [identity-api-fe.md](identity-api-fe.md)), **và** user phải có permission tương
  ứng (vd `Asset.Device.View` để gọi `GET /api/Device/grid-list`) — thiếu token →
  401, có token nhưng thiếu permission → 403. Danh sách mã permission theo từng
  entity xem [identity-module.md](identity-module.md) §9. FE nên dựa vào
  `user.permissions` (trả về từ `windows-login`) để ẩn/hiện nút bấm tương ứng.
- **Content-Type**: `application/json` cho mọi request có body (POST/PUT).

---

## 1. Quy ước chung — BẮT BUỘC đọc trước khi tích hợp

### 1.1. Envelope response

Mọi response (kể cả lỗi) đều bọc trong `ApiResponse<T>`, field camelCase:

```json
{
  "isSuccess": true,
  "message": "Lấy danh sách thiết bị thành công.",
  "data": { /* T, tuỳ endpoint */ },
  "errors": null,
  "timestamp": "2026-07-09T02:33:30.3048558Z"
}
```

- Luôn đọc `data` để lấy dữ liệu thật, không đọc thẳng root response.
- `errors`: `string[] | null` — danh sách lỗi chi tiết (thường có khi validate DataAnnotations thất bại).

### 1.2. Response phân trang — `PagedResponse<T>`

Các endpoint `grid-list` trả `data` là **1 object lồng thêm 1 tầng** (không phải mảng thẳng):

```json
{
  "isSuccess": true,
  "data": {
    "data": [ /* T[] — mảng item thật nằm ở đây */ ],
    "pageIndex": 1,
    "pageSize": 50,
    "totalCount": 5202,
    "totalPages": 105,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

> Lưu ý dễ nhầm: mảng item nằm ở `response.data.data`, **không phải** `response.data.items`.

### 1.3. Mã lỗi HTTP

| Status | Khi nào xảy ra | `message` mẫu |
|---|---|---|
| 200 | Thành công (kể cả PUT/DELETE) | tuỳ endpoint |
| 201 | Create thành công (`POST`) — kèm header `Location` | "Thêm ... thành công." |
| 400 | Validate DataAnnotations sai, hoặc `DomainException` (lỗi nghiệp vụ: trùng mã, IP đã dùng...) | thông báo tiếng Việt cụ thể |
| 404 | `NotFoundException` — Id không tồn tại | `"{Entity} with ID (x) not exist."` |
| 401 | Thiếu/token JWT sai hoặc hết hạn (120 phút) | — |
| 403 | Có token hợp lệ nhưng user (qua Role) không có permission cho hành động này | — |
| 500 | Lỗi hệ thống không lường trước | "An unexpected error occurred on the server." |

FE nên check `response.isSuccess` trước, nếu `false` thì hiển thị `message` (+ `errors` nếu có) cho người dùng, bất kể status code.

### 1.4. Pattern route chung cho CRUD cơ bản

Hầu hết entity master-data (Branch, Supplier, DeviceType, SoftwareGroup, Software) theo đúng 1 pattern:

```
GET    /api/{Entity}/grid-list?pageIndex=1&pageSize=50&keyword=xxx   → PagedResponse<{Entity}Dto>
GET    /api/{Entity}/all                                              → {Entity}Dto[] (rút gọn, active)
GET    /api/{Entity}/{id}                                             → {Entity}Dto
POST   /api/{Entity}                                                  → tạo, trả 201 + {Entity}Dto
PUT    /api/{Entity}/{id}                                             → sửa, body phải có Id khớp param
DELETE /api/{Entity}/{id}                                              → xoá mềm (IsDeleted=true)
```

`GET /all` dùng để đổ dropdown/select (không phân trang, chỉ bản ghi active). `GET /grid-list` dùng cho bảng danh sách có phân trang.

---

## 2. Master data đơn giản (Branch / Supplier / DeviceType / SoftwareGroup / DeviceGroup / DeviceDepartment)

6 entity này **cấu trúc DTO giống hệt nhau** — chỉ đổi tên field:

| Entity | Route | Trường Code | Trường Name |
|---|---|---|---|
| Branch (Chi nhánh) | `/api/Branch` | `branchCode` | `branchName` |
| Supplier (Nhà cung cấp) | `/api/Supplier` | `supplierCode` | `supplierName` |
| DeviceType (Loại thiết bị) | `/api/DeviceType` | `typeCode` | `typeName` |
| SoftwareGroup (Nhóm phần mềm) | `/api/SoftwareGroup` | `groupCode` | `groupName` |
| DeviceGroup (Nhóm) | `/api/DeviceGroup` | `groupCode` | `groupName` |
| DeviceDepartment (Bộ phận) | `/api/DeviceDepartment` | `departmentCode` | `departmentName` |

`DeviceGroup`/`DeviceDepartment` dùng để gán "thiết bị đang ở chỗ nào" trên
`Device.groupId`/`departmentId` (xem mục 5.5) — mới tạo, chỉ seed sẵn 1 dòng
mặc định (`code="MD"`, `name="Mặc định"`) mỗi bảng; Admin tự thêm danh sách
Nhóm/Bộ phận thật qua các endpoint CRUD dưới đây.

**Ví dụ Branch** (áp dụng tương tự cho 5 entity còn lại, chỉ đổi tên field):

```jsonc
// GET /api/Branch/{id} → data
{ "id": 9, "branchCode": "TAM", "branchName": "Chi nhánh Tạm thời (Migrate)" }

// POST /api/Branch — body
{ "branchCode": "HN01", "branchName": "Chi nhánh Hà Nội" }
// → 400 DomainException nếu branchCode đã tồn tại

// PUT /api/Branch/{id} — body (id trong body phải khớp {id} trên URL)
{ "id": 9, "branchCode": "TAM", "branchName": "Chi nhánh Tạm thời (đã sửa)" }
```

Validate: cả `Code` và `Name` đều `[Required]`.

---

## 3. Software (Phần mềm) — master data phức tạp hơn 1 chút

`/api/Software` — có `grid-list`, `all`, `{id}`, POST, PUT, DELETE.

```jsonc
// GET /api/Software/{id} → data
{
  "id": 96,
  "softwareCode": "7ZIP",
  "softwareName": "7Zip",
  "softwareType": "Free",       // nullable
  "publisher": null,             // nullable
  "softwareQuantity": null,      // nullable, số lượng license mua
  "softwarePriority": null,      // nullable
  "softwareGroupId": 1,
  "softwareGroupName": "Chưa phân nhóm"  // server tự gộp tên nhóm, FE không cần gọi thêm API
}

// POST /api/Software — body
{
  "softwareCode": "OFFICE365",
  "softwareName": "Microsoft Office 365",
  "softwareType": "Subscription",
  "publisher": "Microsoft",
  "softwareQuantity": 50,
  "softwarePriority": 1,
  "softwareGroupId": 1   // [Required] — phải là Id có thật trong SoftwareGroup, sai → 404
}
```

Validate: `softwareCode`, `softwareName`, `softwareGroupId` `[Required]`.

---

## 4. IpPrefix (Dải mạng con) & IpAddress (Địa chỉ IP)

### 4.1. IpPrefix — `/api/IpPrefix`

```jsonc
// GET /api/IpPrefix/{id} → data
{
  "id": 28,
  "prefix": "1.1.1",                 // 3 octet, không có octet thứ 4
  "subnetMask": "255.255.255.0",
  "gateway": "192.168.60.150",
  "preferredDns": "0.45.1.2",
  "alternateDns": "9.7.6.5",
  "description": null,
  "usedIpCount": 12,                 // số IP đang sử dụng trong dải (status != 0)
  "availableIpCount": 243            // số IP chưa sử dụng trong dải (status = 0)
}
// grid-list / all: kết quả sort theo GIÁ TRỊ IP (10.45.2 trước 10.45.10), không sort chuỗi.
```

**Tạo mới prefix (POST) tự động sinh 255 IpAddress con** (`n=1..255`, `Status=0 Available`) — FE chỉ cần 1 lần gọi, không cần thêm action "generate range":

```jsonc
// POST /api/IpPrefix — body
{
  "prefix": "10.50.2",   // [Required] regex đúng 3 octet, vd "10.50.2"
  "subnetMask": "255.255.255.0",
  "gateway": "10.50.2.1",
  "preferredDns": "8.8.8.8",
  "alternateDns": "8.8.4.4",
  "description": "Dải mạng phòng IT"
}
// → message: "Thêm prefix thành công, đã sinh 255 địa chỉ IP."
```

- **Không có PUT (Update) cho IpPrefix** — toàn bộ field cố định ngay lúc tạo; muốn đổi phải xoá + tạo lại.
- **Validate cấu hình mạng khi tạo** — POST bị chặn (400 `DomainException`) nếu:
  - `subnetMask`/`gateway`/`preferredDns`/`alternateDns` (field nào có nhập) **không phải IPv4 hợp lệ** (đúng 4 octet 0–255).
  - `gateway` **không nằm trong dải mạng** của `prefix` (phải cùng network 3-octet, vd prefix `10.50.2` thì gateway phải là `10.50.2.x`), hoặc không cùng subnet theo `subnetMask`, hoặc trùng địa chỉ `.0`/`.255`.
  - FE nên validate sơ bộ phía client trước (báo lỗi ngay từng field) để trải nghiệm mượt, nhưng server vẫn là nguồn chặn cuối.
- **Xoá (DELETE) bị chặn** (400 `DomainException`) nếu còn `IpAddress` con **đang gán cho Device**. Nếu không còn IP nào đang dùng, xoá Prefix sẽ **cascade xoá luôn toàn bộ IP con chưa dùng** — FE nên cảnh báo rõ hệ quả này trước khi xoá (mất luôn cả dải, không chỉ prefix).

### 4.2. IpAddress — `/api/IpAddress`

**Enum `Status`** (dùng để hiển thị badge màu trên UI):

| Giá trị | Tên | Ý nghĩa | `deviceCode` hiển thị |
|---|---|---|---|
| `0` | Available | Chưa gán (IP còn trống) | `null` |
| `1` | AssignedExternal | Đã gán nhưng **không có** DeviceId (thiết bị ngoài hệ thống) | **`"Khác"`** |
| `2` | Assigned | Đã gán và **có** DeviceId (thiết bị trong hệ thống) | mã thiết bị thật |

> **Bất biến:** `status=2` ⟺ IP có `deviceId`; `status=0/1` ⟺ IP **không** có `deviceId`. Với `status=1`, server trả `deviceCode="Khác"` (không có thiết bị thật để tra) và `deviceId=null`.
>
> **Sửa IP (PUT) — CHỈ đổi được `status` + `note`**. **Không có POST (thêm) / DELETE (xoá) tay từng IP**: IP chỉ sinh hàng loạt qua `POST /api/IpPrefix` (255 địa chỉ/prefix) và dọn theo qua `DELETE /api/IpPrefix/{id}`.
> ```
> PUT /api/IpAddress/{id}   body: { "id": 6989, "status": 1, "note": "..." }
> ```
> Luật đổi `status` qua PUT:
> - IP **đang gắn thiết bị** (`deviceId != null`, `status=2`): chỉ đổi được `note`; gửi `status` khác `2` → 400 "vui lòng gỡ gán trước khi đổi trạng thái".
> - IP **chưa gắn** (`deviceId = null`): chỉ cho đặt `status` = `0` (Chưa gán) hoặc `1` (Đã gán khác); gửi `status=2` → 400 (không có thiết bị thì không thể "Đã gán").
> - Dùng để đánh dấu tay 1 IP là "đang dùng bởi thiết bị ngoài" (0→1) hoặc trả về trống (1→0). Gán cho thiết bị **trong** hệ thống thì đi qua `assign`/luồng Device (tự set `status=2`).

```jsonc
// GET /api/IpAddress/grid-list?pageIndex=1&pageSize=50&keyword=&status=0&isInUse=&deviceId= → data.data[]
// Kết quả sort theo GIÁ TRỊ IP (10.45.2 trước 10.45.10), không phải sort chuỗi.
{
  "id": 6989,
  "ipAddress": "1.1.1.104",          // không có field "serverIp"
  "deviceId": null,
  "deviceCode": null,                // "Khác" khi status=1; mã thiết bị khi status=2
  "ipPrefixId": 28,
  "prefix": "1.1.1",
  "prefixSubnetMask": "255.255.255.0",
  "prefixGateway": "192.168.60.150",
  "prefixPreferredDns": "0.45.1.2",
  "prefixAlternateDns": "9.7.6.5",
  "status": 0,
  "statusText": "Chưa gán",          // 0→"Chưa gán", 1→"Đã gán (khác)", 2→"Đã gán"
  "note": null
}
```

**Query params `grid-list`** (không có tham số `all` — bảng IP quá lớn để load hết):
`pageIndex`, `pageSize`, `keyword`, `status` (lọc theo enum trên), `isInUse`, `deviceId`.
`isInUse` (bool) là bộ lọc gộp đang/chưa sử dụng: `true`→IP đang dùng
(`status != 0`), `false`→IP chưa dùng (`status = 0`), bỏ trống→không lọc. Có thể kết
hợp với `status` (AND). Danh sách luôn sort theo **giá trị IP** (không phải sort chuỗi).

**Danh sách "IP còn trống" để FE làm picker chọn IP khi tạo/sửa Device** — 2 cách:
```
GET /api/IpAddress/grid-list?status=0&keyword=&pageIndex=1&pageSize=50   // có phân trang
GET /api/IpAddress/available?keyword=                                    // không phân trang, trả thẳng mảng
```

`GET /api/IpAddress/available` trả thẳng `data: IpAddressDto[]` (không bọc `PagedResponse`), luôn lọc `status=0 Available`, sort theo `ipAddress` A-Z, `keyword` match `Contains` trên `ipAddress`. Dùng cho dropdown/autocomplete gọn — nếu cần phân trang/lọc thêm theo `deviceId` thì vẫn dùng `grid-list`.

**Gán/gỡ IP thủ công** (ngoài luồng tạo/sửa Device):
```
PUT /api/IpAddress/{id}/assign   body: { "deviceId": 123 }
PUT /api/IpAddress/{id}/unassign  (không cần body)
```

> Thực tế thường không cần gọi 2 API này trực tiếp — luồng chính là gán IP **thông qua Device** (xem mục 5), Service tự lo việc gán/gỡ IP kèm theo.

---

## 5. Device (Thiết bị) — entity trung tâm

Route `/api/Device`. **Không có** `GET /all` (danh sách quá lớn, luôn dùng `grid-list`).

### 5.1. Enum `Status` (trạng thái thiết bị)

| Giá trị | Tên | Text hiển thị |
|---|---|---|
| `0` | PendingUse | "Chờ sử dụng" |
| `1` | InUse | "Đang sử dụng" |
| `2` | PendingLiquidation | "Chờ thanh lý" |
| `3` | Liquidated | "Đã thanh lý" |

`statusText` server đã tự dịch sẵn trong mọi response — FE **không cần** tự map enum, chỉ cần hiển thị `statusText`. Chỉ cần enum số khi **gửi** field `status` lên server (Create/Update) hoặc khi cần style màu badge theo `status`.

### 5.2. `GET /api/Device/grid-list` — danh sách (bảng chính)

Query: `pageIndex`, `pageSize`, `deviceCode`, `manager`, `supplierName` (3 field này match theo `Contains`), `purchaseDate` (string, match theo `Contains`), `ipAddress`, `email`, `groupId`/`departmentId` (int, exact match — lọc thiết bị theo Nhóm/Bộ phận), `note`, `isOutsourced` (bool), `serialNumber` (string, `Contains`), `isUseUsb` (bool, exact match).

> **`ipAddress`/`email`**: match `Contains` trên **bất kỳ** IP/email nào của Device (Device có thể có nhiều IP + nhiều email — xem mục 5.3/5.5).

**`sortDeviceCodeAscending`** (bool, optional): không truyền (hoặc bỏ trống) → giữ mặc định sort theo `purchaseDate` giảm dần (mới mua nhất lên đầu); truyền `true` → sort theo `deviceCode` tăng dần; truyền `false` → sort theo `deviceCode` giảm dần. Khi tham số này có giá trị, nó **ghi đè hoàn toàn** sort mặc định theo `purchaseDate`.

```
GET /api/Device/grid-list?pageIndex=1&pageSize=50&sortDeviceCodeAscending=true   // mã thiết bị tăng dần
GET /api/Device/grid-list?pageIndex=1&pageSize=50&sortDeviceCodeAscending=false  // mã thiết bị giảm dần
```

```jsonc
// data.data[]
{
  "id": 16925,
  "deviceCode": "YDF-216",
  "deviceName": "DA",
  "branchName": "Chi nhánh Tạm thời (Migrate)",
  "supplierName": "Mai Trung",
  "deviceTypeName": "Desktop",
  "groupName": null,                // tên Nhóm nếu đã gán, null nếu chưa (xem mục 5.5)
  "departmentName": null,           // tên Bộ phận nếu đã gán, null nếu chưa
  "ipAddresses": [],               // mảng IP đang gắn (có thể rỗng, có thể nhiều hơn 1)
  "purchaseDate": "2026-06-01T00:00:00",
  "manager": "Chưa xác định",
  "expirationDate": "2031-06-01T00:00:00",
  "note": "...",
  "emails": ["no-email@domain.com"], // mảng email
  "status": 0,
  "statusText": "Chờ sử dụng",
  "isOutsourced": false,
  "serialNumber": null,             // nullable, unique khi có giá trị
  "isUseUsb": false
}
```

### 5.2b. Chọn máy mới khi "đổi thiết bị" — `GET /api/Device/available?keyword=`

Không phân trang, trả thẳng `data: DeviceGridDto[]` (cùng shape với item trong
`grid-list` ở mục 5.2) — luôn lọc `status=0` ("Chờ sử dụng") và chưa xoá,
`keyword` (optional) match `Contains` trên `deviceCode`. Dùng để FE dựng
dropdown/picker chọn máy mới khi thực hiện nghiệp vụ "chuyển máy" (mục 5.9) —
chỉ những máy đang "Chờ sử dụng" mới hợp lý để nhận bàn giao.

```
GET /api/Device/available?keyword=YDF
```

### 5.3. `GET /api/Device/{id}` — chi tiết 1 device (không kèm cấu hình/phần mềm)

```jsonc
{
  "id": 17982,
  "deviceCode": "DEMO-DEV-001",
  "deviceName": "May Demo Day Du Du Lieu",
  "deviceTypeId": 11, "deviceTypeName": "Access Point",
  "supplierId": 2, "supplierName": "Đỉnh Thiên",
  "branchId": 9, "branchName": "Chi nhánh Tạm thời (Migrate)",
  "groupId": null, "groupName": null,             // Nhóm, null nếu chưa gán
  "departmentId": null, "departmentName": null,   // Bộ phận, null nếu chưa gán
  "manager": "Nguyen Van Demo",
  "purchaseDate": "2026-01-15T00:00:00",
  "depreciationMonths": 36,
  "expirationDate": "2029-01-15T00:00:00",   // server tự tính = purchaseDate + depreciationMonths
  "isOutsourced": false,
  "status": 1, "statusText": "Đang sử dụng",
  "note": "...",
  "serialNumber": "SN-DEMO-001",   // nullable, unique khi có giá trị
  "isUseUsb": false,
  "replacesOldDeviceId": null,      // máy này dự tính thay thế cho máy nào (gợi ý từ import Excel, xem mục 5.9/5.10), null nếu không có
  "replacesOldDeviceCode": null,    // mã của replacesOldDeviceId, chỉ có giá trị khi replacesOldDeviceId khác null
  "ipAddresses": [                  // có thể nhiều IP
    { "id": 6989, "ipAddress": "1.1.1.104" }
  ],
  "emails": [                       // có thể nhiều email
    { "id": 501, "email": "demo.device@company.com", "note": null }
  ]
}
```

### 5.4. `GET /api/Device/{id}/detail` — **API tổng hợp, dùng cho màn hình chi tiết Device**

Gộp sẵn 3 thứ trong 1 lần gọi — FE mở màn "Chi tiết thiết bị" chỉ cần gọi API này thay vì 3 API riêng:

```jsonc
{
  "device": { /* giống DeviceDto ở mục 5.3 */ },
  "configuration": { /* DeviceConfigurationDto, xem mục 6 — null nếu Device chưa có cấu hình (bình thường, không phải lỗi) */ },
  "softwares": [ /* DeviceSoftwareDto[], xem mục 7 */ ]
}
```

> `configuration: null` **không phải lỗi** — nghĩa là thiết bị này chưa được nhập cấu hình phần cứng. FE nên dựa vào `null` để quyết định hiện form "Tạo cấu hình" (POST) hay "Sửa cấu hình" (PUT).

### 5.5. Tạo Device — `POST /api/Device`

```jsonc
{
  "deviceCode": "TEST-DEV-001",      // [Required] unique
  "deviceName": "Máy test QA",       // [Required]
  "deviceTypeId": 11,                 // [Required] Id thật từ /api/DeviceType/all
  "supplierId": 2,                    // [Required] Id thật từ /api/Supplier/all
  "branchId": 9,                      // [Required] Id thật từ /api/Branch/all
  "groupId": null,                    // optional — Id thật từ /api/DeviceGroup/all nếu có gán, null nếu bỏ trống
  "departmentId": null,               // optional — Id thật từ /api/DeviceDepartment/all nếu có gán, null nếu bỏ trống
  "manager": "Nguyễn Văn Test",       // [Required]
  "emails": [                         // [Required][MinLength(1)]
    { "email": "test.qa@company.com", "note": null }   // mỗi item [Required][EmailAddress]
  ],
  "purchaseDate": "2026-01-15T00:00:00",  // [Required]
  "depreciationMonths": 36,           // [Required][Range(1,600)]
  "isOutsourced": false,
  "status": 0,                        // [Range(0,3)], mặc định 0 nếu không gửi
  "note": "Ghi chú tuỳ chọn",         // nullable
  "serialNumber": "SN-TEST-001",      // nullable, [StringLength(100)], phải unique nếu có giá trị
  "isUseUsb": false,                  // mặc định false nếu không gửi
  "ipAddressIds": [6989],             // mảng Id IpAddress đang Status=0 Available (có thể rỗng []); server tự gán + set Assigned cho từng IP
  "replacesOldDeviceId": null         // nullable — Id máy cũ mà thiết bị này dự tính thay thế; server tự set field này khi import Excel (mục 5.10), FE thường không cần gửi tay trừ khi muốn sửa/tạo gợi ý thủ công
}
```

> **KHÔNG gửi `expirationDate`** — server luôn tự tính `purchaseDate + depreciationMonths` tháng, gửi lên sẽ bị bỏ qua (DTO không có field này).
> Nếu 1 Id trong `ipAddressIds` trỏ tới IP không phải `Available`, hoặc `ipAddressIds` có Id trùng lặp → 400 `DomainException`.
> Nếu `serialNumber` khớp với Device khác đã có (kể cả đã soft-delete) → 400 `DomainException` ("Số Serial '...' đã tồn tại."). Để trống/`null` thì không bị check trùng (nhiều Device có thể cùng `serialNumber=null`).
> `emails` **không** yêu cầu unique — nhiều Device có thể dùng chung 1 email.
> Nếu `replacesOldDeviceId` được gửi: máy cũ phải tồn tại (`!IsDeleted`) → 404 nếu không tìm thấy; khi sửa (`PUT`) không được trỏ về chính `id` của bản thân → 400 `DomainException`.
> Nếu `groupId`/`departmentId` được gửi (khác `null`): phải là Id có thật và chưa xoá (`!IsDeleted`) → 404 nếu không tìm thấy. Bỏ trống (`null`) là hợp lệ — không bắt buộc gán Nhóm/Bộ phận.

### 5.6. Sửa Device — `PUT /api/Device/{id}`

Body giống hệt Create + thêm `id` (phải khớp `{id}` trên URL, sai → 400 "Id không khớp."). Server **đối chiếu diff** thay vì thay hết:
- `ipAddressIds`: IP nào đang gắn mà không còn trong mảng mới → tự gỡ về `Available`. IP mới trong mảng mà trước đó Device chưa có → phải đang `Available`, tự chuyển `Assigned`. IP đã gắn sẵn và vẫn còn trong mảng → giữ nguyên, không đụng tới. Gửi `[]` → gỡ hết IP hiện tại.
- `emails`: entry khớp theo `email` (so khớp không phân biệt hoa/thường, đã trim) với entry đang có → giữ nguyên `id`, chỉ cập nhật `note` nếu đổi. Entry mới → thêm. Entry cũ không còn trong danh sách gửi lên → xoá (soft-delete).

### 5.7. Xoá Device — `DELETE /api/Device/{id}`

Soft-delete (`IsDeleted=true`). Mọi IP đang gắn tự động gỡ về `Available`. **Không** tự xoá `DeviceConfiguration`/`DeviceSoftware` liên quan — nếu cần dọn sạch, gọi thêm API xoá riêng.

### 5.8. Báo cáo in ấn — `GET /api/Report/device-list`

**Lưu ý: nằm ở controller riêng `/api/Report`, không phải `/api/Device`** — vì đây là báo cáo, không phải CRUD thiết bị; các loại báo cáo khác sau này (thống kê phần mềm, tổng số thiết bị toàn công ty...) sẽ gom chung dưới `/api/Report/*`.

Dùng cho màn hình/nút "In danh sách thiết bị" kiểu báo cáo giấy (vd "DANH SÁCH DESKTOP TOÀN CÔNG TY"). **Khác `grid-list`**: không phân trang, trả thẳng toàn bộ kết quả khớp filter trong `data` (mảng, không có `pageIndex`/`totalCount`).

```
GET /api/Report/device-list?deviceTypeId=1&branchId=&keyword=
```

- `deviceTypeId` (optional) — lọc theo loại thiết bị, vd `1` = Desktop (lấy Id thật từ `GET /api/DeviceType/all`).
- `branchId` (optional) — lọc theo chi nhánh, để trống = toàn công ty.
- `keyword` (optional) — match `Contains` trên `deviceCode` hoặc `deviceName`.

```jsonc
// data[] — sort theo deviceCode A-Z, stt đánh số lại theo đúng thứ tự trả về
[
  {
    "stt": 1,
    "deviceCode": "10SXC92",
    "deviceName": "MP-ENG",
    "ipAddress": null,            // nếu Device có nhiều IP, các IP được nối bằng ", " trong 1 string
    "purchaseDate": "2021-10-01T00:00:00",
    "expirationDate": "2026-10-01T00:00:00",
    "isExpired": false,           // true nếu expirationDate đã qua (so với hôm nay UTC) — FE tự map thành ký hiệu O/X
    "financialPeriod": 86,        // "Kỳ T/C" — xem công thức bên dưới
    "note": "Không xác định ngày mua"
  }
]
```

**Cột "Kỳ T/C" (`financialPeriod`)**: tính từ `expirationDate` (Hạn sử dụng), theo năm tài chính Yazaki chạy **1/7 → 30/6 năm sau**, đánh số liên tục từ 1941 (năm thành lập Yazaki Corporation). Ví dụ `expirationDate=2026-10-01` → tháng 10 ≥ 7 → năm tài chính bắt đầu 2026 → kỳ `2026 − 1940 = 86`. `financialPeriod` là `null` nếu `expirationDate` là `null`.

### 5.9. Chuyển máy — `POST /api/TransferHistory`

Dùng khi người dùng chuyển từ 1 thiết bị đang dùng (máy cũ) sang 1 thiết bị mới **đã có sẵn trong hệ thống** (tạo trước qua `POST /api/Device` bình thường). Đây là **1 API duy nhất thực hiện toàn bộ nghiệp vụ** — FE không cần tự gọi nhiều API để di chuyển IP/phần mềm/đổi trạng thái.

```jsonc
// POST /api/TransferHistory — body
{
  "oldDeviceId": 17984,       // [Required]
  "newDeviceId": 17985,       // [Required], phải khác oldDeviceId (400 nếu trùng)
  "note": "Máy cũ hỏng ổ cứng, thay máy mới"   // nullable
}
```

**Server tự động xử lý** (FE không cần làm gì thêm sau khi gọi API này):
- **Toàn bộ IP đang gắn**: IP đang gắn máy cũ → chuyển sang máy mới. IP nào máy mới đang giữ sẵn mà không thuộc máy cũ → tự gỡ về `Available` (đúng luật "1 IP không được gắn nhiều thiết bị").
- **Email (`DeviceEmail`)**: toàn bộ email của máy cũ → chuyển sang máy mới (giữ nguyên `note`). Không có ràng buộc unique như IP nên email sẵn có của máy mới **được giữ nguyên**, không bị gỡ. Nếu trùng đúng nội dung email đã có ở máy mới thì bỏ dòng cũ (không tạo trùng).
- **Phần mềm cài (`DeviceSoftware`)**: toàn bộ phần mềm đang cài ở máy cũ **chuyển hẳn** sang máy mới (giữ nguyên `installDate`/`licenseKey`). Nếu máy mới đã cài sẵn đúng phần mềm đó rồi → giữ bản ghi của máy mới, bỏ bản ghi cũ (không tạo trùng).
- **Dữ liệu vai trò/vị trí sử dụng của máy**: chỉ
  `branchId`/`manager`/`isOutsourced`/`isUseUsb` của máy cũ **ghi đè** lên máy
  mới (dữ liệu gắn theo vị trí/người dùng đang thao tác trên máy). **KHÔNG
  chuyển** (máy mới giữ nguyên dữ liệu vật lý/riêng của chính nó): `deviceTypeId`,
  `supplierId`, `purchaseDate`, `expirationDate`, `depreciationMonths` (mỗi máy
  vật lý có ngày mua/nhà cung cấp/loại/khấu hao riêng), `deviceCode`,
  `deviceName`, `serialNumber`, `note`, cấu hình phần cứng (`DeviceConfiguration`).
- **Cấu hình phần cứng (`DeviceConfiguration`)**: **không** chuyển — máy mới có cấu hình phần cứng riêng của nó (nhập/sửa qua API `DeviceConfiguration` như bình thường).
- **Trạng thái máy cũ**: tự đổi thành `status=0` ("Chờ sử dụng"), **trừ khi** máy cũ đã hết hạn sử dụng (`expirationDate` đã qua) thì tự đổi thành `status=2` ("Chờ thanh lý") luôn.
- **Trạng thái máy mới**: tự đổi thành `status=1` ("Đang sử dụng") — FE **không cần** gọi thêm `PUT /api/Device/{id}` để đổi status máy mới sau khi chuyển xong.

```jsonc
// Response — data
{
  "id": 3,
  "oldDeviceId": 17984,
  "oldDeviceCode": "TEST-TRANSFER-OLD-EXP",
  "oldDeviceName": "...",
  "newDeviceId": 17985,
  "newDeviceCode": "TEST-TRANSFER-NEW-1",
  "newDeviceName": "...",
  "transferDate": "2026-07-09T09:43:57.115857Z",
  "note": "..."
}
```

**Gợi ý luồng UI "đổi thiết bị"**: chọn máy cũ (thiết bị đang thao tác) →
`GET /api/Device/available?keyword=` (mục 5.2b) để user chọn máy mới trong số
các máy "Chờ sử dụng" → `POST /api/TransferHistory` với `oldDeviceId`/`newDeviceId`.

**Tự điền sẵn máy mới gợi ý** — khi mở màn "Chuyển máy" trên 1 máy cũ, gọi thêm:
```
GET /api/Device/{oldDeviceId}/replacement-suggestion
```
trả về (`data`, có thể `null` nếu không có gợi ý):
```jsonc
{
  "id": 17985,
  "deviceCode": "YDF-011",
  "deviceName": "YDF-011"
}
```
Gợi ý này đến từ cột "MQL Cũ" lúc import Excel máy mới (mục 5.10) — dùng để
**điền sẵn** `newDeviceId` trên form, người dùng vẫn xem/đổi được sang máy khác
qua picker `GET /api/Device/available?keyword=` như bình thường trước khi bấm
"Chuyển". Gợi ý được **lưu lại lâu dài trong DB**, không chỉ tồn tại 1 lần lúc
import — nếu FE bỏ qua `pendingTransfers` trong response Confirm của bước
import (VD người dùng đóng màn import mà chưa mở "Chuyển máy" ngay), gợi ý
không bị mất, mở lại màn "Chuyển máy" trên máy cũ đó bất kỳ lúc nào sau này vẫn
tự lấy lại được qua API này. Khuyến nghị: FE có thể bỏ qua `pendingTransfers`
trong response Confirm và luôn gọi API tra cứu này khi mở màn "Chuyển máy".
Không gọi API này thì form vẫn hoạt động bình thường (chỉ là để đỡ phải gõ tay
lại cái đã biết trước từ lúc import).

**Xem lịch sử chuyển máy của 1 thiết bị** (dù thiết bị đó từng đóng vai trò máy cũ hay máy mới):
```
GET /api/TransferHistory/device/{deviceId}
```
Trả `data[]` sort theo `transferDate` mới nhất trước. **Không có** API sửa/xoá `TransferHistory` — đây là log lịch sử, mỗi lần chuyển máy tạo 1 dòng cố định.

### 5.10. Import Device hàng loạt từ Excel — `/api/DeviceImport`

Dùng khi người dùng có sẵn file Excel (theo đúng mẫu công ty đang dùng để thêm thiết bị mới) và muốn thêm hàng loạt thay vì tạo tay từng cái. **Bắt buộc quy trình 2 bước — xem trước rồi mới xác nhận**, không có API ghi thẳng file vào DB.

**Mẫu file Excel — 13 cột cố định theo đúng thứ tự, dòng 1 là header** (server luôn bỏ qua dòng 1, ghi gì cũng được):

| Cột | Tên trong Excel | Map sang field | Bắt buộc? |
|---|---|---|---|
| A | MQL | Mã thiết bị mới (`deviceCode`) | ✅ Bắt buộc — phải **chưa tồn tại** trong hệ thống |
| B | Xưởng | Tên Chi nhánh — khớp `branchName` có sẵn | ✅ Bắt buộc |
| C | Loại Thiết Bị | Tên Loại thiết bị — khớp `typeName` có sẵn | ✅ Bắt buộc |
| D | Nhà Cung Cấp | Tên Nhà cung cấp — khớp `supplierName` có sẵn | ✅ Bắt buộc |
| E | Ngày Mua | Ngày mua (`purchaseDate`) | ✅ Bắt buộc — xem định dạng bên dưới |
| F | Ghi Chú | Ghi chú (`note`) | Không bắt buộc |
| G | Số SerialNumber | Số serial (`serialNumber`) | Không bắt buộc — phải unique nếu có nhập |
| H | Hãng | Hãng sản xuất (`maker`, ghi vào `DeviceConfiguration.Maker`) | Không bắt buộc |
| I | Model | Model (`model`, ghi vào `DeviceConfiguration.Model`) | Không bắt buộc |
| J | CPU | CPU (`cpu`, ghi vào `DeviceConfiguration.Cpu`) | Không bắt buộc |
| K | RAM | RAM (`ram`, ghi vào `DeviceConfiguration.Ram`) | Không bắt buộc |
| L | Ổ Cứng | Ổ cứng (`hardDrive`, ghi vào `DeviceConfiguration.HardDrive`) | Không bắt buộc |
| M | MQL Cũ | Mã thiết bị **bị thay thế** bởi thiết bị mới này | Không bắt buộc |

> Cột B/C/D là **TÊN** (text), không phải Id — server tự tra theo tên (không phân biệt hoa/thường). **Không tự tạo mới** nếu chưa có sẵn — không khớp tên nào thì dòng đó báo lỗi ở bước preview, chặn import.

> **5 cột cấu hình H–L (Hãng/Model/CPU/RAM/Ổ Cứng) hoàn toàn tuỳ chọn**: nếu dòng có **ít nhất 1** trong 5 cột này khác rỗng, bước Confirm tự tạo kèm 1 `DeviceConfiguration` cho thiết bị vừa tạo (chỉ set đúng 5 field này, các field cấu hình khác — Mainboard/OS/VGA/...— để trống, sửa lại sau qua màn hình "Cập nhật cấu hình"). Nếu cả 5 cột đều rỗng thì không tạo `DeviceConfiguration` gì cả.

**Định dạng cột "Ngày Mua"**:
- Ô Excel là **Date thật** → đọc đúng luôn, không cần lo định dạng hiển thị.
- Ô là **text** → chỉ nhận **đúng 1 định dạng** `dd/MM/yyyy` (VD `01/07/2026`, luôn có số 0 ở đầu ngày/tháng nếu <10). Định dạng khác (kể cả `1/7/2026` thiếu số 0, hay ISO `2026-07-01`) hoặc để trống → báo lỗi "Thiếu hoặc sai định dạng Ngày Mua".

**Field Device `[Required]` mà Excel không có cột tương ứng** — server tự đặt mặc định:

| Field | Giá trị mặc định |
|---|---|
| `deviceName` | = giống `deviceCode` (MQL) |
| `manager` | Chuỗi rỗng |
| `emails` | Mảng rỗng `[]` (file mẫu không có cột email) |
| `depreciationMonths` | **60 tháng** (cố định) |
| `status` | `0` — Chờ sử dụng |

→ FE nên nhắc người dùng: sau khi import, vào từng thiết bị sửa lại `Tên thiết bị`/`Người quản lý`/`Email`/`Số tháng khấu hao` nếu cần chính xác hơn mặc định.

**Cột "MQL Cũ" — chỉ là GỢI Ý chuyển máy, KHÔNG tự thực hiện**: nếu dòng có giá
trị này, `MQL Cũ` vẫn phải khớp đúng 1 thiết bị **đang có sẵn, chưa xoá**
(không khớp thì báo lỗi dòng đó ở cả preview lẫn confirm), nhưng bước Confirm
**không** tự gọi nghiệp vụ "chuyển máy" — chỉ tạo thiết bị mới, rồi trả về gợi
ý trong `pendingTransfers` (xem response bên dưới). Lý do: lúc import chỉ là
dự tính máy cũ nào sẽ được thay, thực tế lắp đặt có thể đổi ý, nên FE dùng gợi
ý này để **điền sẵn (nhưng cho sửa)** ô "Thiết bị cũ" trên màn hình "Chuyển
máy" — người dùng phải tự bấm nút "Chuyển" thì mới thật sự gọi
`POST /api/TransferHistory` (mục 5.9, nghiệp vụ không đổi, chỉ đổi thời điểm
gọi). Gợi ý này cũng được **lưu lại lâu dài**, tra lại bất kỳ lúc nào qua
`GET /api/Device/{oldDeviceId}/replacement-suggestion` (mục 5.9) — không nhất
thiết phải giữ state từ response Confirm.

**Bước 1 — Preview (chỉ đọc, không ghi DB)**: `POST /api/DeviceImport/preview` — `multipart/form-data`, field file tên `file`. Nhận cả file `.xlsx` lẫn `.csv` (server tự nhận diện theo đuôi file, CSV tự nhận diện dấu phân cách `,`/`;`).

```jsonc
// Response — data
{
  "rows": [
    {
      "rowNumber": 2,                    // số dòng trong Excel — dùng để tô đúng dòng lỗi trên UI
      "deviceCode": "TEST-IMPORT-001",
      "branchName": "CONFIRM",
      "deviceTypeName": "Access Point",
      "supplierName": "Đỉnh Thiên",
      "purchaseDate": "2026-01-01T00:00:00",
      "note": "Ghi chú...",
      "serialNumber": null,
      "maker": "Dell",                    // 5 field cấu hình tuỳ chọn
      "model": "OptiPlex 7010",
      "cpu": "Core i5-13500",
      "ram": "16GB",
      "hardDrive": "512GB SSD",
      "oldDeviceCode": null,
      "resolvedBranchId": 8,              // server đã tra sẵn Id — FE không cần tự tra
      "resolvedDeviceTypeId": 11,
      "resolvedSupplierId": 2,
      "resolvedOldDeviceId": null,
      "isValid": true,
      "errors": []
    },
    {
      "rowNumber": 3,
      "deviceCode": "TEST-IMPORT-002",
      "branchName": "Xưởng không tồn tại",
      "deviceTypeName": "Access Point",
      "supplierName": "Đỉnh Thiên",
      "purchaseDate": "2026-01-01T00:00:00",
      "note": null, "serialNumber": null,
      "maker": null, "model": null, "cpu": null, "ram": null, "hardDrive": null,
      "oldDeviceCode": null,
      "resolvedBranchId": null, "resolvedDeviceTypeId": 11, "resolvedSupplierId": 2, "resolvedOldDeviceId": null,
      "isValid": false,
      "errors": ["Không tìm thấy Xưởng 'Xưởng không tồn tại'."]
    }
  ],
  "totalRows": 2,
  "validRows": 1,
  "invalidRows": 1
}
```

FE render bảng preview theo `rows`, tô đỏ các dòng `isValid=false` kèm nội dung `errors`, để người dùng sửa lại file Excel gốc rồi upload/preview lại. Nút "Xác nhận import" **không cần disable** khi `invalidRows > 0`: FE có thể để người dùng bấm Confirm ngay cả khi còn dòng lỗi, các dòng lỗi sẽ tự bị bỏ qua, chỉ dòng hợp lệ được tạo (xem Confirm bên dưới).

**Bước 2 — Confirm (ghi DB thật)**: `POST /api/DeviceImport/confirm` — `Content-Type: application/json`, body gửi lại **đúng mảng `rows`** vừa nhận từ bước preview (chỉ cần các field thô, không cần gửi `resolvedXxxId`/`isValid`/`errors` — server tự tra lại từ đầu theo dữ liệu DB hiện tại, không tin Id do FE gửi lên):

```jsonc
// Request body
{
  "rows": [
    {
      "rowNumber": 2,
      "deviceCode": "TEST-IMPORT-001",
      "branchName": "CONFIRM",
      "deviceTypeName": "Access Point",
      "supplierName": "Đỉnh Thiên",
      "purchaseDate": "2026-01-01T00:00:00",
      "note": "Ghi chú...",
      "serialNumber": null,
      "maker": "Dell", "model": "OptiPlex 7010", "cpu": "Core i5-13500", "ram": "16GB", "hardDrive": "512GB SSD",
      "oldDeviceCode": null
    }
  ]
}
```

```jsonc
// Response — data (thành công)
{
  "createdCount": 1,
  "createdDeviceIds": [17996],
  "createdConfigCount": 1,            // số Device vừa tạo có kèm DeviceConfiguration
  "pendingTransfers": [               // gợi ý "chuyển máy" từ cột MQL Cũ — CHƯA chuyển thật
    {
      "newDeviceId": 17996,
      "newDeviceCode": "TEST-IMPORT-001",
      "oldDeviceId": 17500,
      "oldDeviceCode": "TEST-OLD-001"
    }
  ],
  "skippedCount": 1,                  // số dòng bị bỏ qua vì còn lỗi validate
  "skippedRows": [
    {
      "rowNumber": 3,
      "deviceCode": "TEST-IMPORT-002",
      "errors": ["Không tìm thấy Xưởng 'Xưởng không tồn tại'."]
    }
  ]
}
```

> FE nên điều hướng người dùng sang màn hình "Chuyển máy" ngay sau khi confirm, dùng `pendingTransfers` để **điền sẵn** danh sách (mỗi dòng = 1 cặp máy cũ/máy mới, cho phép sửa `newDeviceId` nếu người dùng muốn đổi ý), người dùng bấm "Chuyển" từng dòng (hoặc hàng loạt) mới thật sự gọi `POST /api/TransferHistory`.

**Confirm luôn validate lại từ đầu** theo dữ liệu DB tại thời điểm bấm xác nhận (phòng trường hợp có gì đó đổi khác so với lúc xem preview — VD người khác vừa tạo trùng `MQL`). **Dòng lỗi bị bỏ qua, KHÔNG chặn cả batch**: chỉ những dòng hợp lệ được tạo Device (kèm `DeviceConfiguration` nếu có), dòng lỗi trả về trong `skippedRows`/`skippedCount` của response 200 bình thường — FE hiển thị thông báo dạng "Đã tạo N thiết bị, bỏ qua M dòng lỗi" và liệt kê `skippedRows` cho người dùng biết dòng nào cần sửa lại rồi import bù sau. Response 400 (`errors: string[]`, dạng `"Dòng {n}: {lý do}"`) chỉ còn xảy ra khi lỗi hệ thống ngoài dự kiến khi ghi các dòng hợp lệ (không phải do dòng lỗi validate).

**Quyền**: dùng chung permission `Asset.Device.Create` cho cả `preview` và `confirm` (không tách permission riêng cho import).

**Giới hạn hiện tại**: chỉ hỗ trợ **tạo mới**, chưa hỗ trợ cập nhật Device đã tồn tại qua Excel — `MQL` trùng thiết bị đang có (kể cả đã xoá mềm) luôn báo lỗi, không ghi đè. Chưa có endpoint tải file Excel mẫu — dùng file mẫu công ty hiện có sẵn.

---

## 6. DeviceConfiguration (Cấu hình phần cứng)

Route `/api/DeviceConfiguration`. **Không có** `grid-list`/`all` — luôn tra theo `deviceId`.

```jsonc
// GET /api/DeviceConfiguration/by-device/{deviceId} → data (null nếu chưa có cấu hình)
{
  "id": 2330,
  "deviceId": 17982,
  "deviceCode": "DEMO-DEV-001",
  "mainboard": "ASUS Prime B660M-A", "cpu": "Intel Core i5-12400",
  "ram": "16GB DDR4", "hardDrive": "512GB SSD",
  "monitor": "Dell 24 inch FHD", "mouse": "Logitech M100", "keyboard": "Logitech K120",
  "headphone": null, "speaker": null, "ups": null, "psu": "500W",
  "os": "Windows 11 Pro", "vga": "Intel UHD Graphics 730",
  "maker": "Dell", "model": "OptiPlex 7010 SFF",
  "powerAdapter": null, "wirelessCard": "Intel AX201", "nic": "Intel I219-LM",
  "other": null, "note": null
}
```

Tất cả 18 field linh kiện (`cpu/ram/hardDrive/os/vga/mainboard/monitor/mouse/keyboard/headphone/speaker/ups/psu/maker/model/powerAdapter/wirelessCard/nic`) đều **optional string**, chỉ `deviceId` là `[Required]` khi tạo.

- `POST` — chỉ tạo được 1 lần/device (gọi lại khi đã có → 400 `DomainException`, FE phải dùng `PUT` để sửa).
- `PUT /api/DeviceConfiguration/{id}` — **không đổi được `deviceId`** sau khi tạo (gửi khác đi → 400).
- `DELETE /api/DeviceConfiguration/{id}` — xoá cứng, cascade xoá luôn "Cấu hình ban đầu" + toàn bộ "Lịch sử sửa chữa" bên dưới.

### 6.1. "Cấu hình ban đầu" (snapshot bất biến lúc tạo)

```
GET /api/DeviceConfiguration/{configId}/initial     → DeviceConfigurationInitialDto | null
DELETE /api/DeviceConfiguration/initial/{id}         → xoá riêng snapshot này (dùng khi nhập nhầm lúc tạo)
```

Tự động sinh khi `POST` cấu hình lần đầu — **không có API để client tạo/sửa trực tiếp**. Dùng để FE hiển thị "so sánh với lúc mới nhận máy".

### 6.2. "Lịch sử sửa chữa / thay thế" (audit log diff-based)

```
GET /api/DeviceConfiguration/{configId}/history   → DeviceConfigurationHistoryDto[] (mới nhất trước)
```

Mỗi phần tử = 18 field linh kiện tại thời điểm sửa + `editedAt` + `editedBy`. **Chỉ sinh dòng mới nếu thực sự có field thay đổi** — `PUT` mà không đổi gì thì không tạo thêm dòng lịch sử (FE gọi PUT thoải mái không sợ spam log). Không có API tạo/sửa trực tiếp entity này (tự động 100%).

### 6.3. Import cấu hình hàng loạt từ file kiểm kê Tanium — `/api/DeviceConfigurationImport`

Dùng khi phòng IT có sẵn file xuất từ Tanium (agent quét toàn bộ máy tính công ty) và muốn cập nhật hàng loạt cấu hình phần cứng thay vì sửa tay từng máy. **Khác hẳn mục 5.10** — feature này **CHỈ cập nhật** thiết bị **đã có sẵn** trong hệ thống, **không tự tạo Device mới** (file Tanium không có Xưởng/Loại thiết bị/Nhà cung cấp/Ngày mua nên không đủ dữ liệu để tạo Device hợp lệ). Cùng quy trình 2 bước bắt buộc như mục 5.10 — xem trước rồi mới xác nhận.

**Mẫu file Tanium — 8 cột, dòng 1 là header:**

| Cột | Tên trong Excel | Map sang field | Ghi chú |
|---|---|---|---|
| A | Computer Name | Tách thành Mã + Tên thiết bị | Xem thuật toán tách bên dưới |
| B | Tanium Client IP Address | Gán làm IP cho Device | Optional — để trống thì bỏ qua, không lỗi |
| C | Last Logged In User | **Bỏ qua hoàn toàn** | Không lưu vào đâu |
| D | Manufacturer | `maker` | |
| E | Model | `model` | |
| F | CPU | `cpu` | |
| G | RAM | `ram` | |
| H | Size | `hardDrive` | |

> **Chỉ import đúng 5 "họ" mã**: `YDC`, `YLC`, `YDF`, `AC`, `TYC`. Computer Name không khớp 1 trong 5 họ này (VD `Mayhethong`, `BTTB-ATO-xx`, `QAKENSA-MAE-xx`, `DESKTOP-xxxxxxx`, `NUC0xx`, `ACLF/ACELF/ALF-xx`, `YCM-xx`, `yazaki-xx`, các server/VM, và **toàn bộ họ `DA`** — cả `DA-<serial>` lẫn `DA-ENG-<serial>`...) → **loại thầm lặng, không đưa vào `rows`** trả về (không phải lỗi) — xem `outOfScopeSkippedCount` trong response Preview.

**Thuật toán tách "Computer Name" → Mã/Tên thiết bị** (server tự làm, FE không cần tự tách):
1. Bỏ hậu tố domain (`.yev.vn`) nếu có, tách theo dấu `-`.
2. Đoạn đầu khớp 1 trong 4 tiền tố `YDC`/`YLC`/`YDF`/`TYC` theo sau bởi số (số có thể rỗng) → Mã = chèn dấu `-` (`YDC1877` → `YDC-1877`), Tên = phần còn lại (VD `TVCBSX`).
3. Đoạn đầu khớp `AC` + số + tối đa 1 chữ cuối (VD `AC81`, `AC90`, `AC90A/B/D/E`, `AC95`) → mã gốc coi như đã có dấu `-` sẵn: Mã = nối 2 đoạn đầu (`AC90B-2446`), Tên = giống Mã, phần còn lại (VD `-J19`) bị bỏ. **Không khớp** `ACLF`/`ACELF`/`ALF` (chữ ngay sau "AC", khác họ — bị loại theo mục allowlist trên).
4. Còn lại (không khớp bước 2–3, bao gồm cả `DA-<serial>` và `DA-ENG-<serial>`) → ngoài phạm vi, loại thầm lặng.

> Ví dụ: `YDC1877-TVCBSX.yev.vn` → Mã `YDC-1877`, Tên `TVCBSX`. `AC90B-2446-J19` → Mã `AC90B-2446`, Tên `AC90B-2446`. `DA-4CE0203DK7.yev.vn` → ngoài phạm vi, bị loại. `DA-ENG-2ZR9MV3.yev.vn` → ngoài phạm vi, bị loại.

**Mã không khớp Device nào đang có** → dòng đó báo lỗi ở Preview, **không tự tạo Device mới**. **Trùng mã trong cùng file** → báo lỗi cả 2 dòng, **không tự động lấy dòng cuối** — dữ liệu thật cho thấy có Computer Name họ AC bị dùng lại cho các máy vật lý khác nhau theo thời gian, nên chặn để người dùng tự kiểm tra là an toàn hơn tự đoán. **Dòng lỗi Tanium** (bất kỳ cột nào có giá trị bắt đầu bằng `"TSE-Error"` — agent quét lỗi, không thu thập được dữ liệu) → tự động phát hiện, báo lỗi dòng đó, không update gì.

**Bước 1 — Preview**: `POST /api/DeviceConfigurationImport/preview` (`multipart/form-data`, field `file`). Nhận cả `.xlsx` lẫn `.csv` (file kiểm kê Tanium thường xuất mặc định dạng CSV, không cần tự convert sang Excel trước khi upload).

```jsonc
// Response — data
{
  "rows": [
    {
      "rowNumber": 2,
      "computerName": "YDC9999-TESTCFG.yev.vn",
      "taniumIpAddress": "1.1.1.168",
      "manufacturer": "Dell Inc.",
      "model": "OptiPlex 7090",
      "cpu": "Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz",
      "ram": "16384 MB",
      "size": "512 GB",
      "parsedDeviceCode": "YDC-9999",       // Mã tách được — chỉ để hiển thị, FE không cần dùng lại
      "parsedDeviceName": "TESTCFG",
      "resolvedDeviceId": 18001,             // server đã tra ra Device — FE không cần tự tra
      "resolvedIpAddressId": 7053,
      "isValid": true,
      "errors": [],
      "warnings": []
    },
    {
      "rowNumber": 3,
      "computerName": "ZZZ9999-NOTFOUND.yev.vn",
      "taniumIpAddress": null,
      "manufacturer": "HP", "model": "...", "cpu": "...", "ram": "...", "size": "...",
      "parsedDeviceCode": "ZZZ-9999", "parsedDeviceName": "NOTFOUND",
      "resolvedDeviceId": null, "resolvedIpAddressId": null,
      "isValid": false,
      "errors": ["Không tìm thấy thiết bị có mã 'ZZZ-9999'."],
      "warnings": []
    },
    {
      "rowNumber": 4,
      "computerName": "TYC011-MPTVDT.yev.vn",
      "taniumIpAddress": "10.45.3.183",
      "manufacturer": "Microsoft Corporation", "model": "Surface Go 4", "cpu": "Intel(R) N200", "ram": "8017 MB", "size": "119 GB",
      "parsedDeviceCode": "TYC-011", "parsedDeviceName": "MPTVDT",
      "resolvedDeviceId": 18055, "resolvedIpAddressId": null,
      "isValid": true,
      "errors": [],
      "warnings": ["Không tìm thấy địa chỉ IP '10.45.3.183' trong hệ thống — sẽ không cập nhật IP cho thiết bị này."]
    }
  ],
  "totalRows": 3,
  "validRows": 2,
  "invalidRows": 1,
  "outOfScopeSkippedCount": 137   // số dòng Computer Name không thuộc 5 họ mã, đã bị loại trước khi vào "rows"
}
```

FE render bảng preview theo `rows` (nên hiện cả `parsedDeviceCode`/`parsedDeviceName` để người dùng biết server đã hiểu đúng Computer Name hay chưa), tô đỏ dòng `isValid=false` kèm `errors`. `warnings` **không** chặn dòng (dòng vẫn `isValid=true`, vẫn confirm được) — nên tô vàng/hiện icon cảnh báo riêng, phổ biến nhất là case IP Tanium không khớp IP nào trong hệ thống (dòng 4 ở ví dụ trên: cấu hình máy vẫn được cập nhật, chỉ riêng IP là bị bỏ qua). Nút xác nhận chỉ cần disable khi `invalidRows > 0`. Có thể hiện thêm dòng ghi chú kiểu "Đã bỏ qua {outOfScopeSkippedCount} máy ngoài phạm vi (không thuộc mã YDC/YLC/YDF/AC/TYC)" để người dùng không thắc mắc vì sao tổng số dòng preview ít hơn số dòng trong file gốc.

**Bước 2 — Confirm**: `POST /api/DeviceConfigurationImport/confirm` — body gửi lại nguyên `rows` (chỉ cần field thô: `computerName/taniumIpAddress/manufacturer/model/cpu/ram/size`, không cần gửi `parsedXxx`/`resolvedXxx` — server tự resolve lại từ đầu):

```jsonc
// Response — data (thành công)
{
  "createdConfigCount": 1,    // số Device chưa có Configuration, được tạo mới
  "updatedConfigCount": 0,    // số Device đã có Configuration, được cập nhật
  "ipReassignedCount": 1,     // số dòng có gán/đổi IP thực sự
  "updatedDeviceIds": [18001]
}
```

**Luật gán IP theo `taniumIpAddress`** — quan trọng vì ảnh hưởng dữ liệu IP thật:
- Để trống → bỏ qua, chỉ update cấu hình phần cứng, không đụng IP, không cảnh báo.
- Khớp được `IpAddress` nào đó trong hệ thống (bất kể IP đó đang chưa gán, đang gán cho **thiết bị khác**, giữ chỗ hay ngưng dùng) → **luôn** gán IP đó cho thiết bị đang import, kể cả phải "cướp" lại từ thiết bị khác đang giữ nó. Các IP khác **đã gán sẵn cho chính thiết bị đang import** KHÔNG bị gỡ (Tanium chỉ được thêm vào, không thay thế — Device hỗ trợ nhiều IP).
- **Không khớp** `IpAddress` nào trong hệ thống → **không chặn dòng** — Cpu/Ram/Model/cấu hình vẫn được tạo/cập nhật bình thường, chỉ riêng IP bị bỏ qua và thêm 1 thông báo vào `warnings` của dòng đó.

**Update cấu hình không đè mất dữ liệu khác**: nếu thiết bị đã có `DeviceConfiguration` từ trước, import chỉ ghi đè đúng 5 field lấy được từ Tanium (`cpu/ram/hardDrive/maker/model`, và **chỉ đè nếu ô Excel không rỗng** — cột trống thì giữ nguyên giá trị cũ), toàn bộ field khác (`mainboard/monitor/mouse/os/vga/...`) **giữ nguyên**, không bị xoá. Nếu thiết bị **chưa có** cấu hình → tạo mới bình thường (kèm sinh "Cấu hình ban đầu" như mục 6.1).

> **Confirm cũng validate lại từ đầu** và **atomic** giống mục 5.10 — còn dòng lỗi thì không ghi gì cả, trả 400 với `errors: string[]` dạng `"Dòng {n}: {lý do}"`.

**Quyền**: dùng chung permission `Asset.DeviceConfiguration.Update` cho cả `preview` và `confirm`.

---

## 7. DeviceSoftware (Phần mềm cài trên thiết bị) — bao gồm màn hình picker checkbox

Route `/api/DeviceSoftware`. Đây là bảng trung gian, khoá là cặp `(deviceId, softwareId)` — không có `Id` riêng.

### 7.1. Danh sách phần mềm đã cài — `GET /api/DeviceSoftware/device/{deviceId}`

```jsonc
// data[]
{
  "deviceId": 17982,
  "softwareId": 96,
  "softwareName": "7Zip",     // server tự gộp tên, FE không cần gọi thêm API Software
  "installDate": "2026-07-09T00:00:00",
  "licenseKey": "DEMO-KEY-2026"
}
```

### 7.2. Thêm / sửa / xoá **1 phần mềm** (thao tác đơn lẻ)

```
POST   /api/DeviceSoftware        body: { deviceId, softwareId, installDate?, licenseKey? }
PUT    /api/DeviceSoftware        body: { deviceId, softwareId, installDate, licenseKey }
DELETE /api/DeviceSoftware/device/{deviceId}/software/{softwareId}
```
`POST` báo lỗi 400 nếu phần mềm đã cài sẵn trên device đó (không cho trùng).

### 7.3. Picker checkbox-list — `GET /api/DeviceSoftware/picker/{deviceId}`

**Dùng để dựng đúng UI dạng "Update software to Equipment"** (bảng checkbox tick nhiều phần mềm, tick sẵn cái đã cài):

```jsonc
// data[] — TOÀN BỘ software (chưa xoá), sắp xếp: đã tick lên trước, rồi theo tên A-Z
[
  { "softwareId": 96, "softwareCode": "7ZIP", "softwareName": "7Zip", "isSelected": true },
  { "softwareId": 130, "softwareCode": "FXRD", "softwareName": "Foxit PDF Reader", "isSelected": true },
  { "softwareId": 97, "softwareCode": "ACELF", "softwareName": "ACELF", "isSelected": false },
  ...
]
```
FE bind `isSelected` thẳng vào checkbox — không cần tự so sánh với danh sách đã cài.

### 7.4. Lưu hàng loạt sau khi tick — `PUT /api/DeviceSoftware/sync`

Đây là API **duy nhất cần gọi** khi người dùng bấm "Ok" trên dialog picker — gửi lên toàn bộ trạng thái tick hiện tại, KHÔNG cần tự tính diff phía FE:

```jsonc
// Request body
{
  "deviceId": 17982,
  "items": [
    { "softwareId": 96 },                                              // giữ tick, không đổi key/date cũ
    { "softwareId": 97 },                                              // giữ tick, không đổi key/date cũ
    { "softwareId": 130, "licenseKey": "KEY-FOXIT-C3", "installDate": "2026-07-09T00:00:00" }  // mới tick → cần key/date riêng
  ]
}
```

**Quy tắc xử lý (server tự lo, FE chỉ cần gửi đúng danh sách đang tick):**
1. `items` = **toàn bộ** `softwareId` đang được tick sau cùng (không phải chỉ phần thay đổi).
2. Phần mềm có trong `items` mà **chưa cài** → server tạo mới, dùng `licenseKey`/`installDate` **của chính item đó** (`installDate` bỏ trống → server lấy giờ hiện tại UTC).
3. Phần mềm đang cài mà **không còn** trong `items` (bị bỏ tick) → server **gỡ hẳn** (xoá cứng).
4. Phần mềm **giữ nguyên tick** (đã cài từ trước, vẫn có mặt trong `items`) → server **không đụng vào** bản ghi cũ, dù item đó có gửi kèm `licenseKey`/`installDate` mới — FE gửi thêm 2 field này cho phần mềm cũ cũng vô nghĩa, chỉ có tác dụng với phần mềm **mới tick**. Muốn sửa key/date của 1 phần mềm cụ thể đã cài, dùng API đơn lẻ ở mục 7.2 (`PUT /api/DeviceSoftware`).
5. Mỗi `softwareId` trong `items` không được trùng lặp — trùng → 400.
6. `softwareId` không tồn tại/đã bị xoá → 400 "Danh sách phần mềm chọn không hợp lệ."

```jsonc
// Response — data = danh sách phần mềm SAU khi đồng bộ (dùng để refresh UI ngay, không cần gọi lại GET)
[
  { "deviceId": 17982, "softwareId": 96, "softwareName": "7Zip", "installDate": "2026-07-09T00:00:00", "licenseKey": "DEMO-KEY-2026" },
  { "deviceId": 17982, "softwareId": 97, "softwareName": "ACELF", "installDate": "2026-07-09T00:00:00", "licenseKey": "DEMO-KEY-2026" },
  { "deviceId": 17982, "softwareId": 130, "softwareName": "Foxit PDF Reader", "installDate": "2026-07-09T03:02:46.29", "licenseKey": "KEY-FOXIT-C3" }
]
```

**Gợi ý luồng UI dialog picker:**
1. Mở dialog → `GET /api/DeviceSoftware/picker/{deviceId}` → render checkbox-list theo `isSelected`.
2. User tick/bỏ tick tự do trên UI (client-side, chưa gọi API).
3. Với mỗi phần mềm **mới được tick** (chưa có trong danh sách gốc lúc mở dialog), hiện thêm 2 ô nhập `LicenseKey`/`InstallDate` (có thể để trống).
4. Bấm "Ok" → build `items` = toàn bộ software đang tick lúc này (mỗi item kèm `softwareId`, và `licenseKey`/`installDate` **chỉ cần điền cho phần mềm mới tick** — phần mềm cũ giữ tick thì gửi item chỉ có `softwareId` cũng được, server bỏ qua 2 field kia).
5. Gọi `PUT /api/DeviceSoftware/sync` 1 lần duy nhất.

---

## 8. Tổng hợp toàn bộ endpoint (tra cứu nhanh)

| Method | Route | Mô tả |
|---|---|---|
| GET | `/api/Branch/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Chi nhánh |
| GET | `/api/DeviceGroup/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Nhóm (gán trên Device.groupId) |
| GET | `/api/DeviceDepartment/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Bộ phận (gán trên Device.departmentId) |
| GET | `/api/Supplier/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Nhà cung cấp |
| GET | `/api/DeviceType/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Loại thiết bị |
| GET | `/api/SoftwareGroup/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Nhóm phần mềm |
| GET | `/api/Software/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Phần mềm (danh mục) |
| GET | `/api/IpPrefix/grid-list`, `/all`, `/{id}` — POST (tự sinh 255 IP), DELETE `/{id}` (cascade IP con chưa dùng; **không có PUT**) | Dải mạng |
| GET | `/api/IpAddress/grid-list?...`, `/available?keyword=` (không phân trang), `/{id}` (không có `/all`) — PUT `/{id}` (chỉ đổi status+note), PUT `/{id}/assign`, PUT `/{id}/unassign` (**không có POST/DELETE thủ công**) | Địa chỉ IP |
| GET | `/api/Device/grid-list?...` (không có `/all`), `/available?keyword=` (không phân trang, máy `Chờ sử dụng`), `/{id}`, `/{id}/detail`, `/{id}/replacement-suggestion` (gợi ý máy thay thế cho màn "Chuyển máy") — POST, PUT `/{id}`, DELETE `/{id}` | Thiết bị |
| GET | `/api/Report/device-list?deviceTypeId=&branchId=&keyword=` (không phân trang) | Báo cáo in ấn (controller riêng, sẽ gom thêm các báo cáo khác) |
| POST | `/api/TransferHistory` — GET `/api/TransferHistory/device/{deviceId}` | Chuyển máy (di chuyển IP + email + phần mềm + toàn bộ dữ liệu vai trò/sử dụng, đổi trạng thái máy cũ) |
| POST | `/api/DeviceImport/preview` (multipart file, không ghi DB), `/api/DeviceImport/confirm` | Import Device hàng loạt từ Excel, có bước xem trước |
| GET | `/api/DeviceConfiguration/by-device/{deviceId}` — POST, PUT `/{id}`, DELETE `/{id}`, GET `/{configId}/initial`, DELETE `/initial/{id}`, GET `/{configId}/history` | Cấu hình phần cứng |
| POST | `/api/DeviceConfigurationImport/preview` (multipart file, không ghi DB), `/api/DeviceConfigurationImport/confirm` | Import cấu hình hàng loạt từ file Tanium, chỉ update Device có sẵn |
| GET | `/api/DeviceSoftware/device/{deviceId}` — POST, PUT, DELETE `/device/{deviceId}/software/{softwareId}`, GET `/picker/{deviceId}`, PUT `/sync` | Phần mềm cài trên thiết bị |

---

## 9. Checklist khi FE dựng màn hình "Chi tiết thiết bị"

1. `GET /api/Device/{id}/detail` — 1 lần gọi lấy đủ Device + Configuration (có thể null) + Software list.
2. Nếu `configuration == null` → hiện form trống, nút "Lưu" gọi `POST /api/DeviceConfiguration`. Ngược lại hiện form đã điền, nút "Lưu" gọi `PUT /api/DeviceConfiguration/{id}`.
3. Dropdown chọn `deviceTypeId`/`supplierId`/`branchId` khi tạo/sửa Device → gọi `GET /api/{Entity}/all` (không phân trang).
4. Dropdown/picker chọn IP khi tạo/sửa Device → `GET /api/IpAddress/available?keyword=` (gọn, không phân trang) hoặc `GET /api/IpAddress/grid-list?status=0&keyword=` (có phân trang).
5. Dialog quản lý phần mềm → `GET /api/DeviceSoftware/picker/{deviceId}` để mở, `PUT /api/DeviceSoftware/sync` để lưu (xem mục 7.4).
6. Xem lịch sử sửa chữa cấu hình → `GET /api/DeviceConfiguration/{configId}/history` (cần có `configId` từ bước 1).
7. Màn "Đổi thiết bị" → chọn máy mới qua `GET /api/Device/available?keyword=` (chỉ máy `Chờ sử dụng`), gọi `POST /api/TransferHistory` — server tự lo di chuyển IP/phần mềm + đổi trạng thái cả 2 máy (mục 5.9).
8. Màn "Import Excel" (thêm Device mới) → upload file vào `POST /api/DeviceImport/preview`, render bảng preview theo `rows`/`errors`, disable nút xác nhận nếu `invalidRows > 0`; bấm xác nhận → gửi lại nguyên `rows` vào `POST /api/DeviceImport/confirm` (mục 5.10). Nếu response có `pendingTransfers`, điều hướng/điền sẵn danh sách đó sang màn "Đổi thiết bị" (mục 7) — **không** tự gọi `POST /api/TransferHistory`, để người dùng tự bấm "Chuyển" từng dòng (cho sửa `newDeviceId` nếu cần).
9. Màn "Import cấu hình từ Tanium" (chỉ update Device có sẵn) → cùng pattern preview/confirm như mục 8, dùng `POST /api/DeviceConfigurationImport/preview` + `.../confirm` (mục 6.3) — nên hiện thêm `parsedDeviceCode`/`parsedDeviceName` trong bảng preview để người dùng kiểm tra server tách đúng mã từ Computer Name hay chưa.
