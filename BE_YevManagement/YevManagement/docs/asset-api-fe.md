# asset-api-fe.md — Tài liệu API module Asset cho Frontend

> Tài liệu này viết cho đội FE dựng giao diện quản lý Thiết bị/PC. Chỉ mô tả
> hợp đồng API (request/response, validate, enum, luật nghiệp vụ ảnh hưởng UI)
> — không đi vào chi tiết code backend. Muốn hiểu implementation, xem
> [asset-module.md](asset-module.md).

- **Base URL (Development)**: `http://localhost:5000`
- **Swagger/Scalar UI**: `http://localhost:5000/scalar/v1` (chỉ chạy ở Development, xem trực tiếp toàn bộ schema tại đây)
- **Auth**: toàn bộ endpoint Asset hiện đang `[AllowAnonymous]` — **không cần** gửi `Authorization: Bearer <token>`. Sẽ siết quyền trong tương lai, FE nên chừa chỗ gắn token sẵn.
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
| 401/403 | Chưa áp dụng cho module Asset (đang AllowAnonymous) | — |
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

## 2. Master data đơn giản (Branch / Supplier / DeviceType / SoftwareGroup)

4 entity này **cấu trúc DTO giống hệt nhau** — chỉ đổi tên field:

| Entity | Route | Trường Code | Trường Name |
|---|---|---|---|
| Branch (Chi nhánh) | `/api/Branch` | `branchCode` | `branchName` |
| Supplier (Nhà cung cấp) | `/api/Supplier` | `supplierCode` | `supplierName` |
| DeviceType (Loại thiết bị) | `/api/DeviceType` | `typeCode` | `typeName` |
| SoftwareGroup (Nhóm phần mềm) | `/api/SoftwareGroup` | `groupCode` | `groupName` |

**Ví dụ Branch** (áp dụng tương tự cho 3 entity còn lại, chỉ đổi tên field):

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
  "ipAddressCount": 255              // số IpAddress con hiện có
}
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

- **Không thể sửa `prefix`** sau khi tạo — `UpdateIpPrefixDto` không có field `prefix`, chỉ sửa được `SubnetMask/Gateway/DNS/Description`. Đổi prefix phải xoá + tạo lại.
- **Xoá bị chặn** (400 `DomainException`) nếu còn `IpAddress` con chưa xoá — FE nên hiện thông báo rõ, không cho user tưởng lỗi hệ thống.
- Sửa `SubnetMask/Gateway/DNS` ở đây tự "cascade" hiển thị cho toàn bộ IP con (vì IpAddress chỉ tham chiếu `IpPrefixId`, không lưu lặp lại các field này).

### 4.2. IpAddress — `/api/IpAddress`

**Enum `Status`** (dùng để hiển thị badge màu trên UI):

| Giá trị | Tên | Ý nghĩa | Có thể chọn khi Create/Update Device? |
|---|---|---|---|
| `0` | Available | Chưa gán | ✅ Có thể chọn |
| `1` | Assigned | Đã gán cho 1 Device | ❌ Không (server tự set khi gán) |
| `2` | Reserved | Giữ chỗ | ❌ |
| `3` | Disabled | Ngưng dùng | ❌ |

> `Status` **KHÔNG** cho client tự đặt tuỳ ý ở Create/Update IpAddress trực tiếp — server tự derive theo `DeviceId` (có `DeviceId` → luôn `Assigned`, gỡ `DeviceId` → luôn `Available`). Field `Status` trong request Create/Update chỉ có tác dụng cho `Reserved`/`Disabled` (không gắn Device).

```jsonc
// GET /api/IpAddress/grid-list?pageIndex=1&pageSize=50&keyword=&status=0&deviceId= → data.data[]
{
  "id": 6989,
  "ipAddress": "1.1.1.104",
  "serverIp": null,
  "deviceId": null,
  "deviceCode": null,
  "ipPrefixId": 28,
  "prefix": "1.1.1",
  "prefixSubnetMask": "255.255.255.0",
  "prefixGateway": "192.168.60.150",
  "prefixPreferredDns": "0.45.1.2",
  "prefixAlternateDns": "9.7.6.5",
  "status": 0,
  "statusText": "Chưa gán",
  "note": null
}
```

**Query params `grid-list`** (không có tham số `all` — bảng IP quá lớn để load hết):
`pageIndex`, `pageSize`, `keyword`, `status` (lọc theo enum trên), `deviceId`.

**Danh sách "IP còn trống" để FE làm picker chọn IP khi tạo/sửa Device** — 2 cách (2026-07-09, thêm cách 2):
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

Query: `pageIndex`, `pageSize`, `deviceCode`, `manager`, `purchaseDate` (string, match theo `Contains`), `ipAddress`, `supplierName`, `note`, `isOutsourced` (bool, thêm 2026-07-09), `serialNumber` (string, `Contains`) và `isUseUsb` (bool, exact match) — 2 field này thêm cùng đợt 2026-07-09.

**`sortDeviceCodeAscending`** (bool, optional, thêm 2026-07-10): không truyền (hoặc bỏ trống) → giữ mặc định sort theo `purchaseDate` giảm dần (mới mua nhất lên đầu); truyền `true` → sort theo `deviceCode` tăng dần; truyền `false` → sort theo `deviceCode` giảm dần. Khi tham số này có giá trị, nó **ghi đè hoàn toàn** sort mặc định theo `purchaseDate`.

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
  "ipAddress": null,               // IP chính đang gắn (chuỗi hoặc null)
  "purchaseDate": "2026-06-01T00:00:00",
  "manager": "Chưa xác định",
  "expirationDate": "2031-06-01T00:00:00",
  "note": "...",
  "email": "no-email@domain.com",
  "status": 0,
  "statusText": "Chờ sử dụng",
  "isOutsourced": false,
  "serialNumber": null,             // nullable, unique khi có giá trị
  "isUseUsb": false
}
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
  "manager": "Nguyen Van Demo",
  "email": "demo.device@company.com",
  "purchaseDate": "2026-01-15T00:00:00",
  "depreciationMonths": 36,
  "expirationDate": "2029-01-15T00:00:00",   // server tự tính = purchaseDate + depreciationMonths
  "isOutsourced": false,
  "status": 1, "statusText": "Đang sử dụng",
  "note": "...",
  "serialNumber": "SN-DEMO-001",   // nullable, unique khi có giá trị (2026-07-09)
  "isUseUsb": false,                // 2026-07-09
  "ipAddressId": 6989,     // IP chính đang gắn, null nếu chưa gán
  "ipAddress": "1.1.1.104"
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
  "manager": "Nguyễn Văn Test",       // [Required]
  "email": "test.qa@company.com",     // [Required][EmailAddress]
  "purchaseDate": "2026-01-15T00:00:00",  // [Required]
  "depreciationMonths": 36,           // [Required][Range(1,600)]
  "isOutsourced": false,
  "status": 0,                        // [Range(0,3)], mặc định 0 nếu không gửi
  "note": "Ghi chú tuỳ chọn",         // nullable
  "serialNumber": "SN-TEST-001",      // nullable, [StringLength(100)], phải unique nếu có giá trị (2026-07-09)
  "isUseUsb": false,                  // 2026-07-09, mặc định false nếu không gửi
  "ipAddressId": 6989                 // nullable — Id 1 IpAddress đang Status=0 Available; server tự gán + set Assigned
}
```

> **KHÔNG gửi `expirationDate`** — server luôn tự tính `purchaseDate + depreciationMonths` tháng, gửi lên sẽ bị bỏ qua (DTO không có field này).
> Nếu `ipAddressId` trỏ tới IP không phải `Available` → 400 `DomainException` ("Địa chỉ IP đã được sử dụng...").
> Nếu `serialNumber` khớp với Device khác đã có (kể cả đã soft-delete) → 400 `DomainException` ("Số Serial '...' đã tồn tại."). Để trống/`null` thì không bị check trùng (nhiều Device có thể cùng `serialNumber=null`).

### 5.6. Sửa Device — `PUT /api/Device/{id}`

Body giống hệt Create + thêm `id` (phải khớp `{id}` trên URL, sai → 400 "Id không khớp."). Đổi `ipAddressId`:
- Gửi Id IP khác đang gắn → IP cũ tự gỡ về `Available`, IP mới tự chuyển `Assigned`.
- Gửi `null` → gỡ IP hiện tại, không gán IP nào.

### 5.7. Xoá Device — `DELETE /api/Device/{id}`

Soft-delete (`IsDeleted=true`). Mọi IP đang gắn tự động gỡ về `Available`. **Không** tự xoá `DeviceConfiguration`/`DeviceSoftware` liên quan — nếu cần dọn sạch, gọi thêm API xoá riêng.

### 5.8. Báo cáo in ấn — `GET /api/Report/device-list` (2026-07-09)

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
    "ipAddress": null,
    "purchaseDate": "2021-10-01T00:00:00",
    "expirationDate": "2026-10-01T00:00:00",
    "isExpired": false,           // true nếu expirationDate đã qua (so với hôm nay UTC) — FE tự map thành ký hiệu O/X
    "financialPeriod": 86,        // "Kỳ T/C" — xem công thức bên dưới
    "note": "Không xác định ngày mua"
  }
]
```

**Cột "Kỳ T/C" (`financialPeriod`)**: tính từ `expirationDate` (Hạn sử dụng), theo năm tài chính Yazaki chạy **1/7 → 30/6 năm sau**, đánh số liên tục từ 1941 (năm thành lập Yazaki Corporation). Ví dụ `expirationDate=2026-10-01` → tháng 10 ≥ 7 → năm tài chính bắt đầu 2026 → kỳ `2026 − 1940 = 86`. `financialPeriod` là `null` nếu `expirationDate` là `null`.

### 5.9. Chuyển máy — `POST /api/TransferHistory` (2026-07-09)

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
- **IP chính**: IP đang gắn máy cũ → chuyển sang máy mới. Nếu máy mới đang có sẵn 1 IP khác → IP đó tự gỡ về `Available` (đúng luật "1 IP không được gắn nhiều thiết bị").
- **Phần mềm cài (`DeviceSoftware`)**: toàn bộ phần mềm đang cài ở máy cũ **chuyển hẳn** sang máy mới (giữ nguyên `installDate`/`licenseKey`). Nếu máy mới đã cài sẵn đúng phần mềm đó rồi → giữ bản ghi của máy mới, bỏ bản ghi cũ (không tạo trùng).
- **Cấu hình phần cứng (`DeviceConfiguration`)**: **không** chuyển — máy mới có cấu hình phần cứng riêng của nó (nhập/sửa qua API `DeviceConfiguration` như bình thường).
- **Trạng thái máy cũ**: tự đổi thành `status=0` ("Chờ sử dụng"), **trừ khi** máy cũ đã hết hạn sử dụng (`expirationDate` đã qua) thì tự đổi thành `status=2` ("Chờ thanh lý") luôn.

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

**Xem lịch sử chuyển máy của 1 thiết bị** (dù thiết bị đó từng đóng vai trò máy cũ hay máy mới):
```
GET /api/TransferHistory/device/{deviceId}
```
Trả `data[]` sort theo `transferDate` mới nhất trước. **Không có** API sửa/xoá `TransferHistory` — đây là log lịch sử, mỗi lần chuyển máy tạo 1 dòng cố định.

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

### 7.3. Picker checkbox-list — `GET /api/DeviceSoftware/picker/{deviceId}` ⭐

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

### 7.4. Lưu hàng loạt sau khi tick — `PUT /api/DeviceSoftware/sync` ⭐

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
| GET | `/api/Supplier/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Nhà cung cấp |
| GET | `/api/DeviceType/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Loại thiết bị |
| GET | `/api/SoftwareGroup/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Nhóm phần mềm |
| GET | `/api/Software/grid-list`, `/all`, `/{id}` — POST, PUT `/{id}`, DELETE `/{id}` | Phần mềm (danh mục) |
| GET | `/api/IpPrefix/grid-list`, `/all`, `/{id}` — POST (tự sinh 255 IP), PUT `/{id}`, DELETE `/{id}` | Dải mạng |
| GET | `/api/IpAddress/grid-list?...`, `/available?keyword=` (không phân trang, mới 2026-07-09), `/{id}` (không có `/all`) — POST, PUT `/{id}`, DELETE `/{id}`, PUT `/{id}/assign`, PUT `/{id}/unassign` | Địa chỉ IP |
| GET | `/api/Device/grid-list?...` (không có `/all`), `/{id}`, `/{id}/detail` — POST, PUT `/{id}`, DELETE `/{id}` | Thiết bị |
| GET | `/api/Report/device-list?deviceTypeId=&branchId=&keyword=` (không phân trang, mới 2026-07-09) | Báo cáo in ấn (controller riêng, sẽ gom thêm các báo cáo khác) |
| POST | `/api/TransferHistory` (mới 2026-07-09) — GET `/api/TransferHistory/device/{deviceId}` | Chuyển máy (di chuyển IP + phần mềm, đổi trạng thái máy cũ) |
| GET | `/api/DeviceConfiguration/by-device/{deviceId}` — POST, PUT `/{id}`, DELETE `/{id}`, GET `/{configId}/initial`, DELETE `/initial/{id}`, GET `/{configId}/history` | Cấu hình phần cứng |
| GET | `/api/DeviceSoftware/device/{deviceId}` — POST, PUT, DELETE `/device/{deviceId}/software/{softwareId}`, GET `/picker/{deviceId}`, PUT `/sync` | Phần mềm cài trên thiết bị |

---

## 9. Checklist khi FE dựng màn hình "Chi tiết thiết bị"

1. `GET /api/Device/{id}/detail` — 1 lần gọi lấy đủ Device + Configuration (có thể null) + Software list.
2. Nếu `configuration == null` → hiện form trống, nút "Lưu" gọi `POST /api/DeviceConfiguration`. Ngược lại hiện form đã điền, nút "Lưu" gọi `PUT /api/DeviceConfiguration/{id}`.
3. Dropdown chọn `deviceTypeId`/`supplierId`/`branchId` khi tạo/sửa Device → gọi `GET /api/{Entity}/all` (không phân trang).
4. Dropdown/picker chọn IP khi tạo/sửa Device → `GET /api/IpAddress/available?keyword=` (gọn, không phân trang) hoặc `GET /api/IpAddress/grid-list?status=0&keyword=` (có phân trang).
5. Dialog quản lý phần mềm → `GET /api/DeviceSoftware/picker/{deviceId}` để mở, `PUT /api/DeviceSoftware/sync` để lưu (xem mục 7.4).
6. Xem lịch sử sửa chữa cấu hình → `GET /api/DeviceConfiguration/{configId}/history` (cần có `configId` từ bước 1).
