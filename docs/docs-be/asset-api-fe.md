# asset-api-fe.md — API Asset cho Frontend

> Hợp đồng API quản lý Thiết bị/PC. Implementation: [asset-module.md](asset-module.md).

- **Base URL (Dev)**: `http://10.45.1.155:8081` (theo `CompanySystem.HostApi/Properties/launchSettings.json` — đây là nguồn chuẩn; giá trị cũ `http://localhost:5000` đã không còn dùng, port đổi từ `8080` ngày 2026-08-26) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Asset.Device.View`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- **Content-Type**: `application/json` cho request có body.

---

## MỤC LỤC ĐỌC NHANH

| Cần gì | Mục |
|---|---|
| Quy ước chung (envelope, phân trang, lỗi, pattern CRUD) — **dùng chung cho cả 3 module** | §1 |
| Master data: Branch/Supplier/DeviceType/SoftwareGroup/DeviceDepartment | §2 |
| Software · IpPrefix & IpAddress | §3, §4 |
| **Device** (grid-list, filter, import, QR, báo cáo…) | §5 |
| DeviceConfiguration · DeviceSoftware · AuditTrail | §6, §7, §7b |
| **AI Chat** (`POST /api/AiChat/stream`, NDJSON) | §7c |
| **ServerCheck** (kiểm tra Server hằng ngày qua QR) | §7d |
| **Inventory** (kiểm kê thiết bị theo xưởng qua quét mã) | §7e |
| **AppRelease** (quản lý bản cập nhật app Flutter "YEV Scan") | §7f |
| Bảng tổng hợp endpoint · checklist màn "Chi tiết thiết bị" | §8, §9 |


## 1. Quy ước chung
### 1.1 Envelope — mọi response (kể cả lỗi) bọc `ApiResponse<T>` (camelCase):
```json
{ "isSuccess": true, "message": "...", "data": {}, "errors": null, "timestamp": "..." }
```
Luôn đọc `data`. `errors`: `string[]|null` (thường khi validate fail).

### 1.2 Phân trang — `grid-list` trả `data` lồng thêm 1 tầng:
```json
{ "data": { "data": [/* item[] Ở ĐÂY */], "pageIndex":1, "pageSize":50,
  "totalCount":5202, "totalPages":105, "hasNextPage":true, "hasPreviousPage":false } }
```
> Item ở `response.data.data`, **không phải** `.data.items`.

### 1.3 Mã lỗi HTTP
`200` OK · `201` Create (+header Location) · `400` validate/`DomainException` (message tiếng Việt) · `404` `NotFoundException` · `401` thiếu/sai/hết hạn token (120') · `403` thiếu permission · `500` lỗi hệ thống. FE check `isSuccess` trước, hiện `message`(+`errors`).

### 1.4 Pattern CRUD cơ bản
```
GET /api/{Entity}/grid-list?pageIndex=1&pageSize=50&keyword=  → PagedResponse
GET /api/{Entity}/all                                          → Dto[] (active, cho dropdown)
GET /api/{Entity}/{id}   POST   PUT /{id} (body có Id khớp)   DELETE /{id} (xóa mềm)
```
**Sort mặc định** (không có tham số tùy chỉnh): `Branch`/`Supplier`/`SoftwareGroup`/`Software` theo Code/Name; **`DeviceType`/`DeviceGroup`/`DeviceDepartment` theo `Id` tăng dần**.

## 2. Master data đơn giản (Branch/Supplier/DeviceType/SoftwareGroup/DeviceDepartment)
5 entity cấu trúc DTO giống nhau, chỉ đổi tên field Code/Name:
| Entity | Route | Code | Name |
|---|---|---|---|
| Branch | `/api/Branch` | `branchCode` | `branchName` |
| Supplier | `/api/Supplier` | `supplierCode` | `supplierName` |
| DeviceType | `/api/DeviceType` | `typeCode` | `typeName` |
| SoftwareGroup | `/api/SoftwareGroup` | `groupCode` | `groupName` |
| DeviceDepartment | `/api/DeviceDepartment` | `departmentCode` | `departmentName` |

DTO: `{id, code, name}`. POST/PUT body có Code+Name (`[Required]`), PUT thêm `id` khớp URL. 400 nếu Code trùng.

**`DeviceType` có thêm 2 field** (2026-09-16, phục vụ §7d): `serverCheckCategory?: number` (0=Server/1=Network/2=Ups; máy lạnh không còn là category, `null`=không thuộc phạm vi kiểm tra hằng ngày) + `serverCheckCategoryText?: string` (read-only). `includedInInventory?: boolean` (2026-09-26: `true` = loại này được đưa vào đợt kiểm kê thiết bị §7e, mặc định `true`; Create/Update gửi kèm) · `requiresQrScan?: boolean` (2026-09-26: `true` = nhân viên phải quét QR máy loại này — chỉ `IDR`; `false` = BE tự ping lúc kết thúc phiên, xem asset-module.md §1.19; cũng ghi đè trực tiếp như field trên). POST/PUT `DeviceType` nhận thêm `serverCheckCategory?: number|null` + `requiresQrScan?: boolean` — **ghi đè trực tiếp** (không phải "giữ nguyên nếu bỏ trống"): gửi `null`/bỏ field này (JS `undefined` serialize thành thiếu field, BE default `null`) sẽ **xóa** khỏi phạm vi kiểm tra hằng ngày nếu DeviceType đó từng được gán.

### 2.1 DeviceGroup (Nhóm) — thuộc 1 Bộ phận
`/api/DeviceGroup`: grid-list, all, {id}, POST, PUT, DELETE. Mỗi Nhóm **bắt buộc thuộc 1 `DeviceDepartment`**.
```jsonc
// GET {id} → { id, groupCode, groupName, departmentId, departmentName }
// POST body: { departmentId[Required], groupCode, groupName }
// → 400 "Mã nhóm 'OF' đã tồn tại trong bộ phận '...'." nếu trùng CÙNG Bộ phận (khác Bộ phận được trùng)
```
**Cascading dropdown**: `GET /api/DeviceGroup/all?departmentId={id}` (+`grid-list?departmentId=`) lọc theo Bộ phận. Luồng form Device/Nhóm:
1. Dropdown "Bộ phận" từ `GET /api/DeviceDepartment/all`.
2. Dropdown "Nhóm" **disable tới khi chọn Bộ phận** → gọi `all?departmentId=`.
3. **Đổi Bộ phận → xóa lựa chọn Nhóm** rồi gọi lại.
4. Submit: chọn Nhóm thì bắt buộc gửi `departmentId` là cha (thiếu/sai → 400).

## 3. Software — `/api/Software`
`SoftwareDto`: `{id, softwareCode, softwareName, softwareType?, publisher?, softwareQuantity?, softwarePriority?, softwareGroupId, softwareGroupName}`. POST/PUT: `softwareCode`/`softwareName`/`softwareGroupId` `[Required]` (`softwareGroupId` sai → 404).

## 4. IpPrefix & IpAddress
### 4.1 IpPrefix — `/api/IpPrefix`
```jsonc
// GET {id} → data
{ "id":28, "prefix":"1.1.1", "branchId":2, "branchName":"...",
  "subnetMask":"255.255.255.0", "gateway":"...", "preferredDns":"...", "alternateDns":"...",
  "description":null, "usedIpCount":12, "availableIpCount":242 }
// grid-list/all sort theo GIÁ TRỊ IP (10.45.2 trước 10.45.10)
```
- **POST tự sinh 254 IpAddress con** (`n=1..254`, Status=0 — bỏ `.0` network và `.255` broadcast). Body: `prefix[Required, regex 3 octet]`, `branchId[Required]`, +mạng. Message: "...đã sinh 254 địa chỉ IP."
- **PUT** — sửa Chi nhánh + cấu hình mạng, **không có `prefix`** trong body (bất biến). Body: `id`, `branchId[Required]`, subnetMask/gateway/DNS/description.
- **Validate mạng** (POST/PUT, 400 nếu sai): `branchId` tồn tại; field mạng phải IPv4 hợp lệ; `gateway` trong network 3-octet của prefix + cùng subnet + không trùng `.0`/`.255`.
- **DELETE** chặn nếu còn IP con đang gán Device; nếu không → **cascade xóa toàn bộ IP con chưa dùng** (FE cảnh báo).
- Dải cũ có thể `branchId=null` — nhắc admin cập nhật qua PUT.

### 4.2 IpAddress — `/api/IpAddress`
**Enum `status`**: `0` Available (`deviceCode`=null) · `1` AssignedExternal (không DeviceId, `deviceCode`="Khác") · `2` Assigned (có DeviceId, mã thật).
`statusText` server tự dịch, **thống nhất mọi endpoint**: `0`→`"Chưa sử dụng"`, `1`→`"Đã sử dụng (khác)"`, `2`→`"Đã sử dụng"` (grid-list, available, `/{id}` giờ trả cùng một text — trước đây grid trả "Chưa gán/Đã gán"). FE hiển thị thẳng `statusText`, chỉ dùng số `status` khi gửi lên hoặc style badge.
> Bất biến: `status=2` ⟺ có `deviceId`; `0/1` ⟺ không.
```jsonc
// GET grid-list?...&status=0&isInUse=&deviceId= → data.data[] (sort theo GIÁ TRỊ IP)
{ "id":6989, "ipAddress":"1.1.1.104", "deviceId":null, "deviceCode":null, "ipPrefixId":28,
  "prefix":"1.1.1", "prefixSubnetMask":"...", "prefixGateway":"...", "prefixPreferredDns":"...",
  "prefixAlternateDns":"...", "status":0, "statusText":"Chưa sử dụng", "note":null }
```
- **PUT `/bulk-status` — đổi trạng thái NHIỀU IP cùng lúc** (tick chọn trên grid). Body:
```jsonc
{ "ids":[6989,6990,6991], "status":1, "updateNote":false, "note":null }
```
  - `status` chỉ nhận `0` hoặc `1`; gửi `2` → **400** (status 2 chỉ đến từ assign/unassign).
  - `updateNote`: `false` (mặc định) → **giữ nguyên note riêng của từng IP**; `true` → ghi đè `note` cho toàn bộ IP cập nhật được (gửi `null` để xoá trắng).
  - **Không fail cả lô**: IP không tồn tại / đang gắn thiết bị sẽ bị **bỏ qua** và liệt kê lại. Response `data`:
```jsonc
{ "updatedCount":2, "status":1, "statusText":"Đã sử dụng (khác)",
  "skippedIpAddresses":[ { "id":6991, "ipAddress":"1.1.1.106",
    "reason":"Đang gán cho thiết bị PC-001, vui lòng gỡ gán trước khi đổi trạng thái." } ] }
```
  - `message` đã sẵn câu tiếng Việt để toast; FE nên hiện thêm bảng `skippedIpAddresses` khi mảng này khác rỗng. Nhớ refresh grid sau khi gọi.
- **PUT `/{id}` — CHỈ đổi `status`+`note`. Không có POST/DELETE thủ công** (IP sinh/dọn qua IpPrefix). Body `{id, status, note}`. Luật: IP đang gắn (`status=2`) chỉ đổi `note` (gửi status khác → 400 "gỡ gán trước"); IP chưa gắn chỉ đặt `status`=`0`/`1` (gửi `2` → 400).
- **Query grid-list** (không có `all`): `pageIndex/pageSize/keyword/status/isInUse/deviceId`. `isInUse` bool: `true`→`status!=0`, `false`→`status=0`, kết hợp AND với `status`.
- **IP còn trống** (picker chọn IP cho Device): `GET /grid-list?status=0` (phân trang) hoặc `GET /available?keyword=` (không phân trang, `data:IpAddressDto[]` thẳng, sort `ipAddress` A-Z).
- **Gán/gỡ thủ công**: `PUT /{id}/assign` body `{deviceId}`, `PUT /{id}/unassign` (không body). Thường không cần — gán qua Device (mục 5).

## 5. Device — `/api/Device` (không có `/all`)
### 5.1 Enum `status`: `0` PendingUse "Chờ sử dụng" · `1` InUse "Đang sử dụng" · `2` PendingLiquidation "Chờ thanh lý" · `3` Liquidated "Đã thanh lý".
`statusText` server tự dịch — FE chỉ hiển thị. Chỉ cần enum số khi **gửi** `status` hoặc style badge.

### 5.2 `GET /grid-list`
Query: `pageIndex/pageSize`, `deviceCode/manager/supplierName`(Contains), `purchaseDate`(parse rồi so khớp đúng ngày, không phải Contains chuỗi — FE luôn gửi ISO date đầy đủ từ `input type="date"`), `ipAddress`/`email`(Contains any), `groupId`/`departmentId`/`branchId`/`deviceTypeId`(exact), `note`, `isOutsourced`, `serialNumber`(Contains), `isUseUsb`(exact), `requiresDailyCheck`(exact, 2026-09-22 — lọc máy đã tick "Cần kiểm tra hằng ngày (QR)", dùng gom nhanh danh sách in QR cho phòng server, asset-module.md §1.19/§1.21), `status`(exact, enum §5.1), `expiryDate`(`expirationDate <= expiryDate`), `sortDeviceCodeAscending?`(null→`purchaseDate` giảm; true/false→`deviceCode` tăng/giảm, ghi đè mặc định), `sortIpAddressAscending?`(true/false→sort theo GIÁ TRỊ IPv4 tăng/giảm — tăng dùng IP nhỏ nhất của máy, giảm dùng IP lớn nhất, máy không có IP luôn cuối; ưu tiên hơn `sortDeviceCodeAscending`).
2026-07-30: thêm `branchId/deviceTypeId/status/expiryDate` — trước đó FE phải tải `pageSize=5000` rồi tự lọc+tự phân trang ở client (chậm, và sai khi tổng số thiết bị vượt 5000).
```jsonc
// data.data[]
{ "id":16925, "deviceCode":"YDF-216", "deviceName":"DA", "branchName":"...", "supplierName":"...",
  "deviceTypeName":"Desktop", "groupName":null, "departmentName":null, "ipAddresses":[],
  "purchaseDate":"...", "manager":"...", "expirationDate":"...", "note":"...", "emails":["..."],
  "status":0, "statusText":"Chờ sử dụng", "isOutsourced":false, "serialNumber":null, "isUseUsb":false,
  "requiresDailyCheck":false }  // 2026-09-17: máy nằm trong phòng server, có dán QR → vào phiên quét ngày (7d.2)
```

### 5.2b `GET /available?keyword=`
Không phân trang, `data:DeviceGridDto[]`, lọc `status=0`+`!IsDeleted`, `keyword` Contains `deviceCode`. Dùng chọn máy mới khi "chuyển máy" (5.9).

### 5.3 `GET /{id}` — chi tiết (không kèm config/software)
```jsonc
{ "id":17982, "deviceCode":"...", "deviceName":"...", "deviceTypeId":11, "deviceTypeName":"...",
  "supplierId":2, "supplierName":"...", "branchId":9, "branchName":"...",
  "groupId":null, "groupName":null, "departmentId":null, "departmentName":null,
  "manager":"...", "purchaseDate":"...", "depreciationMonths":36,
  "expirationDate":"...",  // server tự tính = purchaseDate + depreciationMonths
  "isOutsourced":false, "status":1, "statusText":"...", "note":"...",
  "serialNumber":"SN-001", "isUseUsb":false, "requiresDailyCheck":false,
  "suggestedNewDeviceId":null,   // máy MỚI gợi ý thay CHÍNH máy này (khi xem máy CŨ), 5.9/5.10
  "suggestedNewDeviceCode":null,
  "ipAddresses":[{ "id":6989, "ipAddress":"1.1.1.104" }],  // nhiều IP
  "emails":[{ "id":501, "email":"...", "note":null }] }    // nhiều email
```

### 5.4 `GET /{id}/detail` — API tổng hợp (màn chi tiết)
```jsonc
{ "device": {/* DeviceDto 5.3 */}, "configuration": {/* mục 6, null nếu chưa có */}, "softwares": [/* mục 7 */] }
```
`configuration:null` **không phải lỗi** → FE dựa vào để POST(tạo)/PUT(sửa) config.

### 5.4b In mã QR hàng loạt — `POST /api/Device/qr-labels`
Tick nhiều máy trên grid → in tem QR một lượt. **BE chỉ trả dữ liệu, FE tự vẽ QR** (dùng thư viện JS như `qrcode`/`qrcode.react`...) và **tự dàn layout in** (khổ tem tuỳ FE). In 1 máy = gửi list 1 phần tử.
```jsonc
// body
{ "ids":[17982, 17983, 17984] }
// data — GIỮ ĐÚNG thứ tự ids gửi lên; máy không tồn tại/đã xóa bị bỏ qua
[ { "deviceId":17982, "deviceCode":"YDC-1877", "deviceName":"Máy kế toán",
    "deviceTypeName":"PC", "branchName":"TAM", "supplierName":"...", "manager":"...",
    "serialNumber":"5CD5354PGJ", "statusText":"Đang sử dụng", "purchaseDate":"...",
    "qrPayload":"YDC-1877\nMáy kế toán\nSN: 5CD5354PGJ\nXưởng: TAM" } ]
```
- **`qrPayload`** = chuỗi cần mã hoá vào QR (BE dựng sẵn). **Dòng 1 luôn là mã máy** (`deviceCode`) — camera điện thoại quét ra cả khối đọc được, còn app nội bộ (nếu có sau này) tách dòng 1 để tra cứu. Vì là web **nội bộ** nên KHÔNG dùng deep-link URL (điện thoại không mở được).
- **User chọn field in**: response trả **đủ field** (mã/tên/loại/xưởng/NCC/người dùng/serial/trạng thái/ngày mua) → FE cho user tick field nào in ra chữ trên tem. Nếu user cũng muốn đổi field **trong QR**, FE tự dựng lại `qrPayload` từ các field này **nhưng phải giữ dòng 1 = `deviceCode`** (để app nội bộ còn tách được).
- Permission: `Asset.Device.View`.

### 5.5 `POST /api/Device`
```jsonc
{ "deviceCode":"...[Required]unique", "deviceName":"[Required]", "deviceTypeId":11[Required],
  "supplierId":2[Required], "branchId":9[Required],
  "groupId":null, "departmentId":null,   // optional, gán Nhóm bắt buộc kèm departmentId cha (2.1)
  "manager":"",  // tuỳ chọn (2026-08-01) — máy chưa dùng thì chưa biết ai quản lý, mặc định ""
  "emails":[{ "email":"[EmailAddress]", "note":null }],  // tuỳ chọn (2026-08-01), cho phép mảng rỗng []
  "purchaseDate":"...[Required]", "depreciationMonths":36,  // [Required][Range(1,600)]
  "isOutsourced":false, "status":0,  // [Range(0,3)], default 0
  "note":"...[Required]",  // bắt buộc (2026-08-01) — thay cho manager/emails, giải thích tình trạng máy
  "serialNumber":"...",  // nullable [StringLength(100)], unique nếu có
  "isUseUsb":false,
  "requiresDailyCheck":false,  // 2026-09-17, default false — tick khi máy nằm trong phòng server & có dán QR (7d.2)
  "ipAddressIds":[6989],  // IP đang Available, server tự set Assigned
  "suggestedNewDeviceId":null }  // Id máy MỚI thay chính device này (import tự set, xem 5.10)
```
> **KHÔNG gửi `expirationDate`** (server tự tính). `ipAddressIds` chứa Id không `Available`/trùng → 400. `serialNumber` trùng (kể cả soft-deleted) → 400. `emails` không unique. `suggestedNewDeviceId` phải tồn tại `!IsDeleted` (404), không tự trỏ mình (400, chỉ PUT). `groupId`/`departmentId` tồn tại `!IsDeleted` (404); gửi `groupId` bắt buộc `departmentId` cha đúng (400).
> **`status` là `PendingLiquidation(2)`/`Liquidated(3)`** (2026-08-22): `ipAddressIds` gửi lên bị **bỏ qua**, server không gán IP nào cho máy — máy Chờ thanh lý/Đã thanh lý không giữ IP.

### 5.6 `PUT /{id}` — body giống Create + `id` khớp URL (sai → 400). Diff:
- `ipAddressIds`: bỏ khỏi mảng → gỡ về `Available`; thêm mới → phải `Available` → `Assigned`; giữ → không đụng. `[]` → gỡ hết. **Nếu `status` là `PendingLiquidation(2)`/`Liquidated(3)`** (2026-08-22): bỏ qua `ipAddressIds` gửi lên, server tự **gỡ hết** IP đang gắn thay vì sync theo danh sách.
- `emails`: khớp `email` (trim/case-insensitive) → giữ `id`+update `note`; mới → thêm; mất → soft-delete.

### 5.7 `DELETE /{id}` — soft-delete, gỡ IP về `Available`. **Không** tự xóa Config/Software.

### 5.8 Báo cáo — `GET /api/Report/device-list?DeviceTypeIds=&BranchId=&DepartmentId=&GroupId=&Status=&Keyword=`
Controller riêng `/api/Report`. Không phân trang, `data` mảng thẳng. Filter optional, kết hợp AND: `DeviceTypeIds` lặp key (`?DeviceTypeIds=1&DeviceTypeIds=3`, khớp bất kỳ loại nào trong danh sách; bỏ trống = không lọc loại), `BranchId`, `DepartmentId`, `GroupId` (Nhóm đã thuộc 1 Bộ phận nên FE chọn Bộ phận trước rồi mới chọn Nhóm), `Status` (`0` Chưa sử dụng / `1` Đang sử dụng; bỏ trống = cả hai), `Keyword` Contains `deviceCode`/`deviceName` (dialog xuất PDF không còn ô này, chỉ AI Chat dùng). Chỉ trả thiết bị **"Chờ sử dụng"/"Đang sử dụng"** (`PendingUse`/`InUse`) — thiết bị chờ thanh lý/đã thanh lý không xuất hiện trong báo cáo.
```jsonc
// data[] — sort deviceCode A-Z, stt đánh lại
{ "stt":1, "deviceCode":"...", "deviceName":"...", "deviceTypeName":"...", "serialNumber":null,
  "ipAddress":null,  // nhiều IP nối ", "
  "email":null,      // nhiều email nối ", "
  "manager":"...", "branchName":"...", "departmentName":null, "groupName":null, "supplierName":"...",
  "purchaseDate":"...", "expirationDate":"...", "isExpired":false,  // FE map O/X
  "financialPeriod":86 }
```
**Xuất Excel** — `GET /api/Report/device-list/export?<cùng filter>&title=` (`Asset.Report.View`): trả file `.xlsx` (không bọc `ApiResponse`, FE đọc bằng `getForBlob`), cùng cột/dữ liệu với `device-list`; `title` ghi vào tiêu đề sheet (tuỳ chọn). Tên file BE gợi ý: `DanhSachThietBi_yyyyMMdd.xlsx`.
**`financialPeriod`** ("Kỳ T/C"): từ `expirationDate`, năm tài chính Yazaki 1/7→30/6, đánh số từ 1941. `expirationDate=2026-10-01` → tháng≥7 → `2026−1940=86`. `null` nếu `expirationDate` null.

### 5.8b Thống kê báo cáo — `GET /api/Report/device-summary`
Cho màn dashboard "Báo cáo thiết bị" (`yev-frontend` `DeviceReport.tsx`) — KPI + phân bổ trạng thái/chi nhánh/loại + danh sách sắp/đã hết hạn, tính sẵn bằng `COUNT`/`GROUP BY` ở SQL. Không tham số. Cùng phạm vi thiết bị với 5.8 (`PendingUse`/`InUse`).
Thay cho cách cũ FE tự tải toàn bộ `Device/grid-list` (nhiều trang `pageSize=1000`) rồi cộng dồn trong bộ nhớ — quá chậm khi DB có hàng nghìn thiết bị.
```jsonc
// data
{ "totalCount":3136, "inUseCount":2429, "pendingUseCount":707,
  // Số dòng trong expiringDevices có daysRemaining >= 0 (chưa quá hạn).
  "expiringSoonCount":110,
  "branchDistribution":[{ "label":"DĨ AN", "count":1100 }, ...],   // top 6, giảm dần theo count
  "deviceTypeDistribution":[{ "label":"Desktop", "count":1799 }, ...], // top 6
  "expiringDevices":[
    // Toàn bộ thiết bị hết hạn trong 90 ngày tới HOẶC đã quá hạn (daysRemaining âm), sort theo expirationDate tăng dần.
    { "id":1, "deviceCode":"OAG-002", "deviceName":"...", "branchName":"DĨ AN", "manager":"Ms Ngoc",
      "expirationDate":"2005-01-01T00:00:00", "daysRemaining":-7881 }
  ] }
```
Cửa sổ cảnh báo 90 ngày là hằng số cứng ở BE (`DeviceService.ReportExpiryWindowDays`) — FE có hằng số tương ứng (`EXPIRY_WINDOW_DAYS` trong `DeviceReport.tsx`) chỉ để hiển thị chữ, phải sửa cả 2 nơi nếu đổi.

### 5.9 Chuyển máy — `POST /api/TransferHistory`
Chuyển từ máy cũ sang máy mới **đã có trong hệ thống**. **1 API làm toàn bộ nghiệp vụ.**
```jsonc
// body: { oldDeviceId[Required], newDeviceId[Required, ≠old→400], note? }
```
Server tự: **IP** cũ→mới (IP mới đang giữ không thuộc cũ → gỡ `Available`); **Email** cũ→mới (giữ email mới, trùng nội dung bỏ dòng cũ); **DeviceSoftware** cũ→mới (giữ `installDate`/`licenseKey`, trùng → giữ bản mới); **ghi đè** `branchId`/`manager`/`isOutsourced`/`isUseUsb` mới=cũ (**KHÔNG** chuyển `deviceTypeId`/`supplierId`/`purchaseDate`/`expirationDate`/`depreciationMonths`/`deviceCode`/`deviceName`/`serialNumber`/`note`/config); **status cũ**→`0` (hoặc `2` nếu đã hết hạn); **status mới**→`1`. Config không đụng. Response = `TransferHistoryDto`.

**Tự điền máy mới gợi ý**: `GET /api/Device/{oldDeviceId}/replacement-suggestion` → `data` (`{id, deviceCode, deviceName}` hoặc `null`). Đến từ cột "MQL Cũ" lúc import (5.10), **lưu lâu dài trong DB trên máy cũ** (`suggestedNewDeviceId`) — mở "Chuyển máy" bất kỳ lúc nào vẫn lấy lại được (không phụ thuộc `pendingTransfers` của response import). Dùng để điền sẵn `newDeviceId`, user vẫn đổi qua `GET /api/Device/available`.

**Lịch sử**: `GET /api/TransferHistory/device/{deviceId}` → `data[]` sort `transferDate` mới nhất trước. Không có API sửa/xóa.

### 5.10 Import Device từ Excel — `/api/DeviceImport` (2 bước preview/confirm)
Mẫu **13 cột đúng thứ tự, dòng 1 header**:
| Cột | Excel | → field | Bắt buộc |
|---|---|---|---|
| A | MQL | `deviceCode` (mới → tạo; đã có + đang "Chờ sử dụng" → **cập nhật**) | ✅ |
| B | Xưởng | **Mã** Chi nhánh (`branchCode`) | ✅ |
| C | Loại Thiết Bị | **Mã** Loại (`deviceTypeCode`) | ✅ |
| D | Nhà Cung Cấp | **Mã** NCC (`supplierCode`) | ✅ |
| E | Ngày Mua | `purchaseDate` | ✅ |
| F | Ghi Chú | `note` | ✗ |
| G | Số SerialNumber | `serialNumber` (unique nếu có) | ✗ |
| H–L | Hãng/Model/CPU/RAM/Ổ Cứng | `DeviceConfiguration.Maker/Model/Cpu/Ram/HardDrive` | ✗ |
| M | MQL Cũ | máy bị thay | ✗ |
> ⚠️ **Đổi 2026-07-23**: cột C nhập **MÃ Loại Thiết Bị** (`typeCode`) thay vì Tên — cả B/C/D giờ đều là MÃ (không phân biệt hoa/thường). Field trong JSON đổi tên `deviceTypeName` → **`deviceTypeCode`**. Không khớp → lỗi preview (server không tự tạo mới).

**Upsert theo MQL (2026-07-23)**: MQL đã tồn tại **không còn là lỗi** —
> - máy đó đang **"Chờ sử dụng" (status 0)** → dòng đó **cập nhật** máy cũ (`isUpdate=true`, `resolvedExistingDeviceId` = Id máy);
> - máy đó ở trạng thái khác (Đang sử dụng/Chờ thanh lý/Đã thanh lý) → **lỗi dòng**, không ghi đè;
> - máy đó đã bị xóa mềm → lỗi dòng.
>
> Khi cập nhật: **ghi đè** Xưởng/Loại/NCC/Ngày Mua (+ tính lại `expirationDate` theo `depreciationMonths` sẵn có); **chỉ ghi đè khi ô không rỗng** với Ghi Chú/Serial; **không đụng** `deviceName`, `manager`, emails, IP, `depreciationMonths`, `status`, nhóm/bộ phận. Cấu hình H–L: đã có config → chỉ đè 5 field đó khi ô không rỗng; chưa có → tạo mới.
> H–L: dòng có ≥1 cột khác rỗng → Confirm tạo kèm `DeviceConfiguration` (chỉ 5 field, còn lại trống).
> "Ngày Mua": ô Date thật → đọc trực tiếp; ô text → chỉ nhận `dd/MM/yyyy` (VD `01/07/2026`). Khác/trống → lỗi.

Field `[Required]` Excel không có → mặc định: `deviceName`=`deviceCode`, `depreciationMonths`=**60**, `status`=`0`. (FE nhắc user sửa lại sau.) `manager`/`emails` luôn để trống (tuỳ chọn từ 2026-08-01, không riêng gì import). Cột "Ghi Chú" trống → `note`="" (Note `[Required]` trên `CreateDeviceDto` chỉ áp dụng cho form nhập tay qua controller, nhánh import gọi service trực tiếp nên không bị chặn — nhưng vẫn nên nhập Ghi Chú trong Excel để tránh máy trống ghi chú).

**"MQL Cũ" chỉ GỢI Ý, không tự chuyển**: phải khớp 1 thiết bị `!IsDeleted` (không → lỗi), Confirm chỉ tạo máy mới + trả `pendingTransfers` + lưu DB (tra lại qua `replacement-suggestion` 5.9). FE điền sẵn màn "Chuyển máy", user tự bấm "Chuyển".

**Preview** — `POST /preview` (`multipart/form-data`, field `file`, `.xlsx`/`.csv`):
```jsonc
// data
{ "rows":[
    { "rowNumber":2, "deviceCode":"...", "branchCode":"TAM", "deviceTypeCode":"PC", "supplierCode":"DTH",
      "purchaseDate":"...", "note":"...", "serialNumber":null, "maker":"Dell", "model":"...", "cpu":"...",
      "ram":"...", "hardDrive":"...", "oldDeviceCode":null,
      "resolvedBranchId":8, "resolvedDeviceTypeId":11, "resolvedSupplierId":2, "resolvedOldDeviceId":null,
      "resolvedExistingDeviceId":null, "isUpdate":false,   // true = dòng này sẽ CẬP NHẬT máy có sẵn
      "isValid":true, "errors":[] },
    { "rowNumber":3, ..., "isValid":false, "errors":["Không tìm thấy Xưởng có mã 'ZZZ'."] }
  ], "totalRows":2, "validRows":1, "invalidRows":1 }
```
FE render `rows`, tô đỏ `isValid=false`. Nút Confirm **không cần disable** khi có lỗi (dòng lỗi tự bỏ qua).

**Confirm** — `POST /confirm` (JSON, gửi lại `rows` field thô, server tự tra lại). **Validate lại từ đầu, dòng lỗi BỎ QUA không chặn batch**:
```jsonc
// data
{ "createdCount":1, "createdDeviceIds":[17996], "updatedCount":2, "updatedDeviceIds":[17800,17801],
  "createdConfigCount":1, "updatedConfigCount":1,
  "pendingTransfers":[{ "newDeviceId":17996, "newDeviceCode":"...", "oldDeviceId":17500, "oldDeviceCode":"..." }],
  "skippedCount":1, "skippedRows":[{ "rowNumber":3, "deviceCode":"...", "errors":["..."] }] }
```
FE hiện "Đã tạo N, cập nhật K, bỏ qua M dòng lỗi". Response 400 chỉ khi lỗi hệ thống. Permission chung `Asset.Device.Create`. Chưa có file mẫu tải.

## 6. DeviceConfiguration — `/api/DeviceConfiguration` (không grid-list/all, tra theo deviceId)
```jsonc
// GET /by-device/{deviceId} → data (null nếu chưa có)
{ "id":2330, "deviceId":17982, "deviceCode":"...", "mainboard":"...", "cpu":"...", "ram":"...",
  "hardDrive":"...", "monitor":"...", "mouse":"...", "keyboard":"...", "headphone":null, "speaker":null,
  "ups":null, "psu":"...", "os":"...", "vga":"...", "maker":"...", "model":"...", "powerAdapter":null,
  "wirelessCard":"...", "nic":"...", "other":null, "note":null }
```
18 field linh kiện đều optional string, chỉ `deviceId` `[Required]` khi tạo.
- `POST` — 1 lần/device (gọi lại → 400, dùng PUT). `PUT /{id}` — không đổi `deviceId`. `DELETE /{id}` — xóa cứng, cascade Initial + History.
- **6.1 Cấu hình ban đầu**: `GET /{configId}/initial` (→`Dto|null`), `DELETE /initial/{id}`. Tự sinh lúc POST, không có API tạo/sửa.
- **6.2 Lịch sử sửa chữa**: `GET /{configId}/history` → `Dto[]` (mới nhất trước, 18 field + `editedAt`/`editedBy`). Chỉ sinh dòng nếu thực sự đổi field. Tự động 100%.

### 6.3 Import cấu hình Tanium — `/api/DeviceConfigurationImport` (preview/confirm)
**CHỈ cập nhật** Device đã có (không tạo mới). Mẫu **9 cột — format mới 2026-07-23**, đúng thứ tự:
| Cột | Tanium | → field |
|---|---|---|
| A | Computer Name | tách ra mã/tên máy |
| B | Tanium Client IP Address | gán IP |
| C | Last Logged In User | **bỏ qua** |
| D | Manufacturer | `maker` |
| E | Model | `model` |
| F | **Computer Serial Number** | **`Device.SerialNumber`** (mới) |
| G | CPU | `cpu` |
| H | **Total Memory** (tên cũ "RAM") | `ram` |
| I | Size | `hardDrive` |
> ⚠️ File xuất theo **format cũ 8 cột** (không có Computer Serial Number) sẽ đọc **lệch cột** — phải xuất lại theo format mới.
> **Chỉ import 5 họ**: `YDC`/`YLC`/`YDF`/`AC`/`TYC`. Không khớp (gồm **họ `DA`**, `DESKTOP-*`, `ACLF/ACELF/ALF`...) → **loại thầm lặng** (`outOfScopeSkippedCount`).

**Tách Computer Name → Mã/Tên** (server tự): (1) bỏ hậu tố `.yev.vn`, tách `-`. (2) `YDC/YLC/YDF/TYC`+số → Mã chèn `-` (`YDC1877`→`YDC-1877`), Tên=phần còn lại. (3) `AC`+số+≤1 chữ (`AC90B`) → Mã=nối 2 đoạn (`AC90B-2446`), Tên=Mã, phần còn lại bỏ. (4) còn lại (gồm `DA-*`) → loại.

Mã không khớp Device → lỗi preview. Trùng mã trong file → lỗi cả 2 (không tự lấy dòng cuối). Cột bất kỳ có `"TSE-Error"` → lỗi.

**Preview** `POST /preview` (`.xlsx`/`.csv`):
```jsonc
// data
{ "rows":[
    { "rowNumber":2, "computerName":"YDC9999-TESTCFG.yev.vn", "taniumIpAddress":"1.1.1.168",
      "manufacturer":"Dell", "model":"...", "serialNumber":"5CD5354PGJ", "cpu":"...", "ram":"16384 MB", "size":"477 GB",
      "parsedDeviceCode":"YDC-9999", "parsedDeviceName":"TESTCFG",  // hiển thị để user kiểm tra tách đúng
      "resolvedDeviceId":18001, "resolvedIpAddressId":7053, "resolvedSerialNumber":"5CD5354PGJ",  // null = sẽ KHÔNG ghi serial
      "isValid":true, "errors":[], "warnings":[] },
    { "rowNumber":4, ..., "resolvedIpAddressId":null, "isValid":true, "errors":[],
      "warnings":["Không tìm thấy địa chỉ IP '...' — sẽ không cập nhật IP..."] }
  ], "totalRows":3, "validRows":2, "invalidRows":1, "outOfScopeSkippedCount":137 }
```
`warnings` **không** chặn dòng (tô vàng; phổ biến: IP Tanium không khớp → config vẫn cập nhật, chỉ bỏ IP). Nút xác nhận disable khi `invalidRows>0`.

**Confirm** `POST /confirm` (gửi lại `rows` field thô). **Atomic — còn lỗi thì không ghi gì**, 400 `"Dòng {n}: {lý do}"`:
```jsonc
// data
{ "createdConfigCount":1, "updatedConfigCount":0, "ipReassignedCount":1, "serialUpdatedCount":1,
  "updatedDeviceIds":[18001] }
```
**Luật gán IP** (`taniumIpAddress`): trống→bỏ qua; chỉ gán khi IP còn `Available` (`ipReassignedCount` = số IP đã gán); IP đang được Device khác / thiết bị ngoài dùng, lặp trong file, hoặc không khớp→**không chặn**, +`warnings`, bỏ IP. IP khác của Device đang import **không** bị gỡ.
**Luật ghi Serial** (`serialNumber`, 2026-07-23): trống→bỏ qua; serial đang thuộc **Device khác** hoặc **lặp nhiều dòng trong file** → **không chặn dòng**, chỉ +`warnings` và bỏ ghi serial (`resolvedSerialNumber=null`); còn lại → ghi đè `Device.SerialNumber` (Tanium đọc thẳng từ máy nên tin hơn giá trị nhập tay). Cột serial chứa `"TSE-Error"` cũng làm hỏng dòng như các cột khác. **Update không đè field khác**: Device có config → chỉ đè 5 field Tanium (chỉ khi ô không rỗng), field khác giữ nguyên; chưa có → tạo mới (kèm Initial 6.1). Permission chung `Asset.DeviceConfiguration.Update`.

**Báo cáo đối chiếu** `POST /missing-devices-report` (2026-07-27, `multipart/form-data` field `file` — cùng file Tanium, **không** cần đã gọi `/preview` trước; kèm field `prefixes` = chuỗi tiền tố mã máy phân cách dấu phẩy, FE cho người dùng tự nhập, mặc định gợi ý `"YDC,YDF,YLC"`, rỗng = không lọc). So Device đang **`Status = InUse`** + `DeviceCode` khớp 1 trong `prefixes` trong hệ thống với danh sách máy khớp được trong file (Tanium chỉ quét máy đang bật nên chỉ so trên `InUse`, `PendingUse`/`PendingLiquidation`/`Liquidated` không tính). Response **không phải `ApiResponse<T>`** — trả thẳng file `.xlsx` (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), FE đọc `response.blob()`. Đếm số thiết bị thiếu qua header **`X-Missing-Device-Count`** (đọc bằng `response.headers.get("x-missing-device-count")` — phải đọc từ **response gốc của `fetch`**, không phải qua wrapper đã parse JSON như các API khác) và tên file gợi ý qua `Content-Disposition` (`response.headers.get("content-disposition")`, parse `filename="..."`). Lỗi trước khi ghi file (thiếu file upload) vẫn trả JSON `ApiResponse<object>` bình thường như mọi lỗi khác. Permission chung `Asset.DeviceConfiguration.Update`.

### 6.4 Import thanh lý hàng loạt — `/api/DeviceLiquidationImport` (preview/confirm)
Upload file **1 cột `Mã máy`** (dòng 1 header, `.xlsx`/`.csv`) để chuyển hàng loạt thiết bị sang **"Đã thanh lý"**.
> **Chỉ thanh lý được máy đang "Chờ thanh lý" (status 2)**. Máy đã thanh lý → lỗi "đã được thanh lý trước đó"; trạng thái khác → lỗi kèm tên trạng thái hiện tại; không tìm thấy mã / trùng mã trong file → lỗi dòng.
> Thanh lý xong máy **bị gỡ hết IP** (IP về "Chưa sử dụng") và **ẩn email** — nhưng máy **vẫn còn** để tra cứu (chỉ đổi status, không xóa).

**Preview** `POST /preview` (`multipart/form-data`, field `file`):
```jsonc
// data
{ "rows":[
    { "rowNumber":2, "deviceCode":"YDC-1877", "resolvedDeviceId":18001,
      "currentStatus":2, "currentStatusText":"Chờ thanh lý", "isValid":true, "errors":[] },
    { "rowNumber":3, "deviceCode":"YDC-9999", "resolvedDeviceId":18010,
      "currentStatus":1, "currentStatusText":"Đang sử dụng", "isValid":false,
      "errors":["Thiết bị 'YDC-9999' đang ở trạng thái 'Đang sử dụng', chỉ thanh lý được thiết bị đang 'Chờ thanh lý'."] }
  ], "totalRows":2, "validRows":1, "invalidRows":1 }
```
FE render `rows`, tô đỏ `isValid=false` (hiện `currentStatusText` để user biết vì sao). Nút Confirm **không cần disable** (dòng lỗi tự bỏ qua).

**Confirm** `POST /confirm` (JSON gửi lại `rows` field thô, server tra lại). **Validate lại, dòng lỗi BỎ QUA**:
```jsonc
// data
{ "liquidatedCount":1, "liquidatedDeviceIds":[18001], "releasedIpCount":2,
  "skippedCount":1, "skippedRows":[{ "rowNumber":3, "deviceCode":"YDC-9999", "errors":["..."] }] }
```
FE hiện "Đã thanh lý N, bỏ qua M dòng". Permission chung `Asset.Device.Update`. Chưa có file mẫu tải.

## 7. DeviceSoftware — `/api/DeviceSoftware` (khoá `(deviceId, softwareId)`, không Id riêng)
- **7.1 `GET /device/{deviceId}`** → `[{ deviceId, softwareId, softwareName, installDate, licenseKey }]`.
- **7.2 Đơn lẻ**: `POST` (`{deviceId, softwareId, installDate?, licenseKey?}`, 400 nếu đã cài), `PUT` (`{deviceId, softwareId, installDate, licenseKey}`), `DELETE /device/{deviceId}/software/{softwareId}`.
- **7.3 Picker** `GET /picker/{deviceId}` → `[{ softwareId, softwareCode, softwareName, isSelected }]` (toàn bộ software `!IsDeleted`, đã tick lên trước rồi A-Z). FE bind `isSelected` vào checkbox.
- **7.4 Sync** `PUT /sync` — API **duy nhất cần gọi** khi bấm "Ok" picker (không tự tính diff):
```jsonc
// body: { deviceId, items:[ {softwareId}, {softwareId, licenseKey, installDate} ] }
```
Luật: `items`=**toàn bộ** đang tick. Có trong items chưa cài → tạo mới (dùng key/date **của item đó**, `installDate` trống→UtcNow). Đang cài không còn trong items → **gỡ hẳn** (xóa cứng). **Giữ tick → không đụng** (dù gửi key/date mới — vô nghĩa; muốn sửa dùng 7.2 PUT). Trùng `softwareId` → 400. Id không tồn tại → 400. Response = danh sách sau đồng bộ (refresh UI ngay).

## 7b. AuditTrail — `/api/AuditTrail` (lịch sử Create/Update/Delete, ghi tự động, chỉ đọc)
Ai sửa/xóa gì, lúc nào — ghi tự động ở BE mỗi lần Create/Update/Delete bất kỳ entity Asset nào, FE **không cần gọi API nào để ghi log**, chỉ cần API xem lại.
- **7b.1 `GET /grid-list?pageIndex=&pageSize=&tableName=&recordId=&recordName=&action=&changedBy=&fromDate=&toDate=`** → phân trang chuẩn (§1.2). Mỗi dòng: `{ id, tableName, recordId, recordName, affectedCount, action, oldValues, newValues, changedBy, changedAt }`. `tableName` = tên entity C# (`"Device"`, `"Branch"`, `"DeviceGroup"`...), `action` ∈ `Create|Update|Delete|Restore`. `oldValues`/`newValues` là **chuỗi JSON** (object `{field: value}`, chỉ field thực sự đổi — FE tự `JSON.parse` nếu muốn hiển thị diff đẹp; `null` khi không áp dụng (vd `Create` không có `oldValues`)).
- **`recordName`** = **đối tượng bị tác động**, hiển thị thẳng lên grid (cột "Đối tượng"): `"PC-001 - Máy kế toán"`, `"192.168.1.5 (PC-001)"`, `"192.168.1.x"`... Filter `recordName` là **tìm gần đúng** (contains) — dùng làm ô search "tìm theo mã máy / IP".
- **`affectedCount`** = số bản ghi mà 1 dòng log đại diện. `1` = thao tác đơn lẻ (đọc `oldValues/newValues` như bình thường). `> 1` = **thao tác hàng loạt đã gộp** (vd tạo dải IP → 1 dòng `affectedCount=255`, `recordName="192.168.1.1 → 192.168.1.255 (255 bản ghi)"`); khi đó `oldValues=null` và `newValues` = `{ affectedCount, recordIds, recordNames, truncated }` (danh sách tên tối đa 50 phần tử, `truncated=true` nghĩa là còn nữa). FE nên hiện badge "×255" và list `recordNames` khi bung chi tiết.
- **7b.2 `GET /record?tableName=Device&recordId=5`** → `List` không phân trang, mới nhất trước — dùng cho tab "Lịch sử" trong màn chi tiết 1 bản ghi (vd 1 Device cụ thể).
- `changedBy` = username đăng nhập lúc thao tác; nền hệ thống tự chạy (vd `DeviceLiquidationBackgroundService`) → `"System"`.
- Permission `Asset.AuditTrail.View` — **cần Admin gán** cho role muốn xem (chưa role nào có sẵn ngoài `Admin`).

## 7c. AI Chat — `POST /api/AiChat/stream`
Chuyển từ "FE tự gọi Ollama + tự thực thi tool" sang "FE chỉ gọi 1 endpoint BE, đọc stream, hiển thị" — kiến trúc/code ở [asset-module.md §1.18](asset-module.md). Mục này là **hợp đồng cuối cùng đã lên production** (2 bổ sung backward-compatible ngày 2026-07-27 ghi ở dưới: field request `think` và dòng response `"type":"device"`).

**Request:**
```http
POST /api/AiChat/stream
Authorization: Bearer <token>
Content-Type: application/json
```
```jsonc
{
  "message": "PC-001 đang gắn IP nào?",
  "history": [                              // toàn bộ hội thoại trước đó — FE tự giữ, gửi lại mỗi lượt (BE không lưu gì)
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "systemPrompt": null,                     // optional — null/bỏ trống thì BE dùng prompt mặc định (§9 tài liệu trên)
  "think": false,                           // optional, 2026-07-27 — null/bỏ trống = false (mặc định nhanh, ~2-3s). true = model suy luận sâu hơn trước khi trả lời (chậm hơn ~1.7x, map sang `reasoning_effort:"high"` của LM Studio — xem asset-module.md §1.18)
  "locale": "vi"                            // optional, 2026-08-22 — locale UI hiện tại của FE ("vi" | "ja", lấy từ next-intl `useLocale()`). BE dùng để chọn ngôn ngữ trả lời trong prompt mặc định — khác "ja" (kể cả null/bỏ trống) → tiếng Việt. Bị BỎ QUA nếu `systemPrompt` đã được truyền tuỳ chỉnh.
}
```
`message` là `[Required]` — thiếu/rỗng → **400** theo format `ValidationProblemDetails` chuẩn của `[ApiController]` (khác `ApiResponse<T>` các API còn lại, vì lỗi này xảy ra TRƯỚC khi bắt đầu stream).

**Response** — `Content-Type: application/x-ndjson`, mỗi dòng 1 JSON kết thúc `\n`, đọc dần qua `ReadableStream`/`fetch` (không phải 1 JSON duy nhất, và **không phải JSON thô của Ollama** — BE đã rút gọn, chỉ 5 dạng dòng):
```jsonc
{"type":"content","text":"PC-001 "}         // 1 mẩu chữ, nối dần vào bubble trả lời — lặp nhiều dòng
{"type":"content","text":"đang gắn IP "}
{"type":"tool","name":"search_ip_addresses"} // BE đang tra cứu tool này — FE hiện badge "Đang tra cứu..."
{"type":"content","text":"192.168.1.10."}
{"type":"device","deviceId":123,"deviceCode":"PC-001"} // 2026-07-27 §11 — thiết bị model vừa tra cứu được (chỉ khi tool liên quan đến device có resolve ra id); FE dùng để hiện nút "Xem chi tiết" điều hướng `/pc/devices?id={deviceId}`. Có thể xuất hiện nhiều dòng (nhiều thiết bị) xen giữa các dòng "content"/"tool"
{"type":"done"}                              // hết, đóng kết nối — KHÔNG có "text" ở dòng này
{"type":"error","message":"..."}             // có lỗi (mất kết nối AI, quá số lần gọi tool...) — FE hiện toast, dừng đọc
```
- Field không áp dụng cho `type` đó **bị lược khỏi JSON** (không phải `null`) — check `"text" in obj` / optional chaining, không giả định field luôn có mặt.
- 1 lượt hỏi có thể có **nhiều dòng `"tool"`** (model gọi nhiều tool cùng lúc) và nhiều dòng `"content"` xen kẽ trước khi tới `"done"`.
- Nếu model gọi tool quá 3 lần liên tiếp mà không chốt câu trả lời → BE trả `{"type":"error","message":"Đã đạt giới hạn số lần gọi công cụ tra cứu..."}` thay vì treo mãi.
- **FE lưu lịch sử**: chỉ cần gộp các `"content"` của 1 lượt thành 1 `assistant` message rồi thêm vào mảng `history` gửi lần sau — **không** lưu các dòng `"tool"`/`"device"` (BE không cần và cũng không hiểu nếu FE gửi ngược lại role `"tool"`).
- BE tự quyết định gọi tool nào (danh sách tool ở spec §5) — FE không cần biết tool là gì, không cấu hình gì thêm. **Từ 2026-07-30 catalogue rút còn 7 tool**, tập trung 2 nhóm việc: tra cứu thiết bị (đủ mọi field như màn hình danh sách) và tra cứu IP (IP trống / IP này ai đang dùng / tình trạng cả dải) — danh sách tool ở `asset-module.md §1.18`. Gợi ý câu hỏi trên FE phải khớp đúng 2 nhóm này; lọc theo chi nhánh/nhóm/bộ phận truyền THẲNG TÊN nên không cần đổi tên sang id.
- Permission `Asset.AiChat.Use` — **đã gán sẵn cho role `Admin`**, role khác cần Admin gán thêm nếu muốn dùng chat AI. Nút "Xem chi tiết" từ dòng `"device"` là UX-only, ẩn ở FE nếu user không có `Asset.Device.View` — BE vẫn enforce permission đó khi FE thật sự điều hướng sang trang chi tiết thiết bị.

## 7d. ServerCheck — `/api/ServerCheck`
`ServerCheckItemDto` có thêm `requiresScan: boolean` (false = không quét, BE tự ping khi `POST /{id}/end`; `totalCount`/`scannedCount` của phiên chỉ đếm máy `requiresScan=true`). Thay checksheet giấy bằng quét QR trên máy TC21/TC22 — chi tiết nghiệp vụ: [asset-module.md §1.19](asset-module.md). Server/Máy lạnh/UPS/Network đều là `Device` bình thường (không entity riêng), QR dán lên vẫn dùng `POST /api/Device/qr-labels` (§5.4b) — điều kiện để vào phạm vi kiểm tra hằng ngày là `DeviceType` của nó có `serverCheckCategory` khác `null` (Admin tự cấu hình ở màn `DeviceType`, §2).

> ⚠️ **Từ 2026-09-21 phiên quét theo xưởng** (xem 7d.10 + asset-module.md §1.21): `ServerCheckSessionDto`/`ServerCheckReportRowDto` có thêm `branchId?/branchName?`; `POST /start` tự lấy xưởng của user (không nhận xưởng từ client, chưa phân công → 400); `scan`/`end` chỉ trên phiên xưởng mình; `GET /today`, `/grid-list`, `/report`, `/report/export` nhận thêm `branchId` (optional, chỉ có tác dụng với quyền `View` — người chỉ có `Scan` bị ép về xưởng mình).

**7d.1 `GET /today`** → `ServerCheckSessionDto | null`. `null` = hôm nay **chưa bấm "Bắt đầu"**. Có giá trị → xem `status` (`0`=`InProgress`, đang quét dở/vừa mới bắt đầu; `1`=`Completed`, đã khóa) để FE quyết định hiện màn "đang quét" hay "đã xong hôm nay".

**7d.2 `POST /start`** (không body, permission `Asset.ServerCheck.Scan`) → `ServerCheckSessionDto`. Gọi khi user bấm "Bắt đầu phiên quét" trên TC21/22 (đã đăng nhập trước qua `/api/Auth/login`, xem identity-api-fe.md §2c). Nếu hôm nay đã có phiên `InProgress` (vd trình duyệt đóng giữa chừng) → trả lại nguyên phiên đó, **không** tạo mới/mất dữ liệu đã quét. Đã `Completed` → 400 "Đã hoàn thành phiên kiểm tra hôm nay." — FE hiện thông báo, điều hướng sang xem báo cáo thay vì cho quét tiếp (**chỉ 1 phiên/ngày**, khóa cứng). Danh sách thiết bị snapshot vào phiên = Device `InUse` có `deviceType.serverCheckCategory != null` **và** `requiresDailyCheck = true` (cờ Admin tick trong form Thiết bị, 5.5/5.6). Quét QR là thao tác **vật lý** nên chỉ máy thật sự nằm trong phòng server mới vào danh sách — máy cùng loại nhưng là server ảo hoặc switch rải khắp nhà máy để cờ `false`, chúng chỉ nằm trong phạm vi ping (7d.8). **Không** lọc theo chi nhánh ở bước này (`serverCheckBranchId` chỉ áp dụng cho `network-ping`). Chưa tick cờ cho máy nào → phiên tạo ra rỗng (`totalCount:0`), FE nên báo Admin đi cấu hình thay vì hiện danh sách trắng.

```jsonc
// ServerCheckSessionDto
{
  "id": 12, "checkDate": "2026-09-16T00:00:00", "startedAt": "2026-09-16T08:05:00", "startedBy": "n.van.a",
  "endedAt": null, "endedBy": null, "status": 0, "statusText": "Đang quét",
  "totalCount": 9, "scannedCount": 3,
  "items": [
    { "id": 101, "deviceId": 55, "deviceCode": "SRV-01", "deviceName": "Server File", "category": 0, "categoryText": "Server",
      "scannedAt": "2026-09-16T08:06:12", "scannedBy": "n.van.a", "status": 1, "statusText": "OK", "note": null },
    { "id": 102, "deviceId": 60, "deviceCode": "SVR-01", "deviceName": "Server mẫu", "category": 0, "categoryText": "Server",
      "scannedAt": null, "scannedBy": null, "status": 0, "statusText": "Chưa quét", "note": null }
  ],
  "manualResults": [
    { "manualItemId": 1, "manualItemName": "Tình trạng âm thanh, mùi, nhiệt độ", "status": 0, "statusText": "Chưa quét", "note": null, "confirmedBy": null, "confirmedAt": null }
  ]
}
```
`items`/`manualResults` **luôn có mặt đầy đủ ngay từ lúc `start`** (snapshot toàn bộ thiết bị + 4 mục thủ công), không phải chỉ những gì đã quét — FE render list đủ, cập nhật từng dòng khi quét.

**7d.3 `POST /{id}/scan`** (`{ "deviceCode": "SRV-01" }`, permission `Asset.ServerCheck.Scan`) → `ServerCheckItemDto` (dòng vừa cập nhật). Đây là API **duy nhất** cần gọi lặp lại khi quét — trang "Quét kiểm tra" nên có 1 ô input luôn giữ focus, TC21/22 quét QR gõ ra `deviceCode` (dòng 1 QR) + Enter → submit ngay, xoá ô, focus lại. Quét lại 1 máy đã `OK` vẫn **200 OK** (idempotent, chỉ cập nhật giờ). Mã không thuộc phạm vi hôm nay (sai mã, hoặc DeviceType không bật `serverCheckCategory`) **hoặc thiết bị không cần quét (`requiresScan=false` — tự ping lúc `end`)** → 400, FE nên phát âm báo lỗi/rung máy vì user đang thao tác nhanh không nhìn màn hình liên tục.

**7d.4 `POST /{id}/end`** (permission `Asset.ServerCheck.Scan`) — bấm "Kết thúc phiên quét". Trước khi gọi, FE lấy `items` còn `status=0` (Pending, tức đối chiếu với `GET /{id}` mới nhất) hiện form cho user ghi chú lý do NG, và bắt buộc hiện đủ 4 mục từ `GET /manual-items` để user chọn OK/NG:
```jsonc
{
  "items": [ { "serverCheckItemId": 102, "note": "Không thấy đèn nguồn, nghi hỏng dây" } ],  // chỉ cần gửi item còn Pending; item đã OK bỏ qua không cần gửi
  "manualResults": [
    { "manualItemId": 1, "status": 1, "note": null },
    { "manualItemId": 2, "status": 1, "note": null },
    { "manualItemId": 3, "status": 1, "note": null },
    { "manualItemId": 4, "status": 2, "note": "Không gửi được mail ra ngoài lúc 8h20" }
  ]
}
```
Thiếu 1 trong 4 `manualItemId` đang active → 400 "Vui lòng xác nhận đủ toàn bộ mục kiểm tra thủ công." → response thành công trả `ServerCheckSessionDto` đã `status=1` (`Completed`), mọi item còn Pending đã chuyển `Ng`. **Sau khi gọi thành công, khóa hẳn** — gọi lại `/scan` hay `/end` trên session này đều 400.

**7d.5 `GET /manual-items`** → `List<{id, name, displayOrder, usesNetworkPing}>` — hiện **7 dòng** (2026-09-17 thêm 3 mục `Backup - File Srv`/`Backup - OES`/`Backup - Domain` cho khớp cột Backup trên tờ giấy), gọi lúc build form "Kết thúc phiên" (không đổi giữa các ngày, FE có thể cache trong phiên làm việc). `usesNetworkPing=true` chỉ ở đúng 2 dòng "Network - Factory"/"Network - Server" (§1.20) — FE dùng cờ này để hiện nút "Kiểm tra network" thay vì so khớp `name`. **FE phải render động theo danh sách trả về**, không hardcode số mục — mục mới có thể được seed thêm bằng migration mà không đổi API.

**7d.6 `GET /grid-list?pageIndex=&pageSize=&fromDate=&toDate=`** (permission `Asset.ServerCheck.View`) → phân trang chuẩn (§1.2) danh sách `ServerCheckSessionDto` **nhưng `items`/`manualResults` rỗng** (grid chỉ cần `checkDate/status/startedBy/endedBy/totalCount/scannedCount`) — bấm vào 1 dòng thì gọi tiếp `GET /{id}` lấy đủ chi tiết.

**7d.7 `GET /report?fromDate=&toDate=`** (permission `Asset.ServerCheck.View`) → `List<ServerCheckReportRowDto>`, dùng cho màn "In báo cáo" khớp layout Sheet1 gốc:
```jsonc
{
  "checkDate": "2026-09-16T00:00:00", "sessionId": 12, "sessionStatus": 1, "sessionStatusText": "Đã hoàn thành",
  "serverStatus": true, "serverNote": null,
  "networkStatus": null, "networkNote": null,           // null = chưa khai báo Device nào loại Network, KHÔNG phải lỗi
  "upsStatus": null, "upsNote": null,
  "airConditionerStatus": false, "airConditionerNote": "Không thấy đèn nguồn, nghi hỏng dây",
  "manualResults": [ /* 4 dòng, cấu trúc như ServerCheckManualResultDto ở 7d.2 */ ],
  "checkedBy": "n.van.a"
}
```
`*Status: boolean | null` — `null` = không áp dụng (chưa có thiết bị loại đó, **hoặc** phiên ngày đó còn `InProgress`/chưa kết thúc nên chưa có kết luận cuối); `true` = **toàn bộ** thiết bị loại đó trong ngày được quét; `false` = còn ít nhất 1 máy NG, `*Note` liệt kê `"{mã máy}: {ghi chú}"` các máy NG cách nhau `"; "`. FE tự map 4 cột `bool?` + `manualResults` vào đúng vị trí cột trên layout in Sheet1 (đèn báo Server/Network/UPS, Máy lạnh, rồi tới 4 mục thủ công theo `displayOrder`).

**7d.8 `GET /network-ping`** (không query, permission `Asset.ServerCheck.Scan`, 2026-09-17) → `NetworkPingResultDto`, gọi khi user bấm nút "Kiểm tra network" trong dialog "Kết thúc phiên" (thay xác nhận tay 2 mục "Network - Factory"/"Network - Server", §1.20). Backend tự ping IP của Device Server/Network/UPS đang `InUse` (bỏ Máy lạnh), lọc theo chi nhánh cấu hình ở `AssetSetting.serverCheckBranchId` (`null`=mọi chi nhánh, cùng field dùng cho `POST /start`, 7d.2) — FE không truyền tham số nào, chỉ hiện kết quả. Không ghi DB, có thể gọi lại nhiều lần ("Kiểm tra lại" sau khi xử lý tại chỗ):
```jsonc
{
  "totalCount": 55, "reachableCount": 29, "allReachable": false,
  "items": [
    { "ipAddress": "10.45.1.4", "deviceId": 3, "deviceCode": "SERVER-003", "deviceName": "vndahubcas001",
      "category": 0, "categoryText": "Server", "reachable": false, "roundtripMs": null },
    { "ipAddress": "10.45.1.16", "deviceId": 10, "deviceCode": "SERVER-010", "deviceName": "vndamb002",
      "category": 0, "categoryText": "Server", "reachable": true, "roundtripMs": 2 }
  ]
}
```
FE: `allReachable=true` → tự gán `status=1`(OK) cho **cả 2** mục `usesNetworkPing`; `false` → tự gán `status=2`(NG) + ghi chú liệt kê `"{deviceCode} ({ipAddress})"` các IP `reachable=false`, người dùng vẫn sửa tay được (OK/NG/note) trước khi bấm "Xác nhận kết thúc". Xem `AssetSetting` (§8) để đổi phạm vi chi nhánh.

**7d.9 `GET /report/export?fromDate=&toDate=`** (permission `Asset.ServerCheck.View`, 2026-09-18) — nút "Xuất Excel" trên màn báo cáo (7d.7). **Không phải `ApiResponse<T>`** (giống `missing-devices-report` ở §6.3) — trả thẳng file `.xlsx`, FE đọc bằng `getForBlob()` rồi tự tạo link tải (`URL.createObjectURL`). BE điền dữ liệu từ đúng logic `GetReportAsync` (7d.7) vào **file mẫu giấy gốc** `YEV–22–CV–IT-QD-810-FR-Check Sheet KT` (`Asset.Infrastructure/Templates/CheckSheetKiemTraHangNgayIT.xlsx`), không tự dựng bảng mới:
- Cột cố định theo đúng layout in sẵn: B/C/D = Đèn cảnh báo Server/Network/UPS (category aggregate), E = Máy lạnh, F..L = 7 mục thủ công theo **DisplayOrder** (không theo tên hay Id cụ thể — Id do DB sinh, có thể khác nhau giữa môi trường), M = Người kiểm, N = Ghi chú (tự gộp mọi lý do NG trong ngày, có prefix tên hạng mục).
- Số dòng dữ liệu (mẫu gốc có sẵn 26 dòng trống) được **co giãn động** theo đúng số ngày có phiên trong khoảng lọc — ít hơn 26 thì xoá bớt dòng thừa (phần chú thích/chữ ký ở cuối tự trồi lên), nhiều hơn thì tự chèn thêm dòng (copy style dòng cuối).
- Nếu `fromDate`/`toDate` nằm gọn trong **cùng 1 tháng**: cột ngày chỉ ghi số ngày (1, 2, 3...) và điền sẵn ô "Tháng"/"Năm" ở góc trên khớp bản gốc; trải dài nhiều tháng thì cột ngày ghi đủ `dd/MM/yyyy`, bỏ trống "Tháng"/"Năm" (không có chỗ cho khoảng nhiều tháng trên form 1 trang).
- Giá trị mỗi ô category/mục thủ công chỉ là `"OK"`/`"NG"`/rỗng (rỗng = phiên `InProgress` hoặc chưa có thiết bị loại đó/mục đó chưa tồn tại lúc phiên đó kết thúc) — không dùng ký hiệu ✓/× để tránh đoán sai quy ước, có thể đổi sau nếu người dùng muốn.
- Tên file gợi ý: `CheckSheet_KiemTraServer_{yyyyMMdd}.xlsx` (1 ngày) hoặc `..._{from}-{to}.xlsx` (khoảng ngày).

**7d.10 `/api/ServerCheckAssignment` — phân công user ↔ xưởng** (2026-09-21):

| Method | Path | Permission | Ghi chú |
|---|---|---|---|
| GET | `/api/ServerCheckAssignment` | `Asset.ServerCheck.Assign` | `List<ServerCheckAssignmentDto>` `{id,userId,userName,fullName,branchId,branchName}` |
| GET | `/api/ServerCheckAssignment/me` | `Asset.ServerCheck.Scan` | xưởng của **chính user đang đăng nhập**; `data:null` = chưa được phân công → app quét phải chặn, báo liên hệ Admin. Gọi **trước** `GET /today`/`POST /start` |
| PUT | `/api/ServerCheckAssignment` | `Asset.ServerCheck.Assign` | body `{userId, userName, fullName?, branchId}` — upsert theo `userId` (đã có thì đổi xưởng, mỗi user đúng 1 xưởng). `userId/userName/fullName` lấy từ `GET /api/Auth/get-all-users-with-roles` |
| DELETE | `/api/ServerCheckAssignment/{id}` | `Asset.ServerCheck.Assign` | bỏ phân công (xoá cứng) |

Điều kiện để 1 người quét được: có role **"Kiểm tra Server"** (chứa `Asset.ServerCheck.Scan`) **và** được phân công xưởng. Thiếu role → 403; thiếu phân công → 400 ở `POST /start` (và `data:null` ở `/me`).

## 7e. Inventory — `/api/Inventory`
Đối chiếu thực tế với dữ liệu hệ thống — chi tiết nghiệp vụ: [asset-module.md §1.22](asset-module.md). Khác `ServerCheck` (§7d): quét **toàn bộ Device** của 1 xưởng (không riêng nhóm thiết bị nào), theo **đợt** chứ không phải hằng ngày (không unique theo ngày, chỉ ràng buộc 1 xưởng không quá 1 phiên `InProgress` cùng lúc), và **nhiều user cùng xưởng thao tác chung 1 phiên**.

- **`GET /current`** (permission `Asset.Inventory.Scan`, không tham số) → `InventorySessionDto | null` — phiên `InProgress` của xưởng **chính người gọi** được phân công (không nhận `branchId`). Dùng cho màn quét kiosk; gọi lại sau mỗi lần quét để đồng bộ tiến độ (có thể do đồng nghiệp khác vừa quét).
- **`POST /start`** (không body) → `InventorySessionDto`. Xưởng lấy từ `GET /api/InventoryAssignment/me` (server tự resolve). Xưởng đã có phiên `InProgress` (do chính mình hoặc đồng nghiệp khác mở) → trả lại **nguyên phiên đó**, không tạo mới. Chưa được phân công xưởng → 400. Snapshot **chỉ** `Device.Status = InUse` ("Đang sử dụng") của xưởng **và** loại thiết bị có `includedInInventory = true` (máy `PendingUse`/`PendingLiquidation` không đưa vào).
```jsonc
// InventorySessionDto
{
  "id": 5, "branchId": 2, "branchName": "Xưởng Dĩ An",
  "startedAt": "2026-09-23T08:05:00", "startedBy": "n.van.a", "endedAt": null, "endedBy": null,
  "status": 0, "statusText": "Đang kiểm kê", "totalCount": 128, "foundCount": 40, "missingCount": 0,
  "items": [
    { "id": 1001, "deviceId": 55, "deviceCode": "PC-0123", "deviceName": "Dell OptiPlex 7080",
      "scannedAt": "2026-09-23T08:12:03", "scannedBy": "n.van.a", "status": 1, "statusText": "Đã tìm thấy", "note": null },
    { "id": 1002, "deviceId": 60, "deviceCode": "PC-0456", "deviceName": "HP EliteDesk 800",
      "scannedAt": null, "scannedBy": null, "status": 0, "statusText": "Chưa kiểm kê", "note": null }
  ]
}
```
- **`POST /{id}/scan`** (`{ "deviceCode": "PC-0123" }`, permission `Asset.Inventory.Scan`) → `InventorySessionItemDto` (dòng vừa cập nhật, `status=1` Found). Quét lại máy đã Found vẫn 200 (idempotent). Mã **không thuộc phạm vi xưởng đang kiểm kê** → 400, **không ghi nhận gì** — áp dụng cho cả 2 case: mã không tồn tại, hoặc thiết bị thuộc xưởng khác/mới chuyển vào sau khi đã `start` (FE không cần phân biệt 2 lý do).
- **`POST /{id}/end`** (permission `Asset.Inventory.Scan`) → `InventorySessionDto` đã `status=1` (`Completed`), khoá cứng. Body chỉ cần liệt kê item còn `Pending` muốn ghi chú (note tự do, không bắt buộc — **không có** checklist thủ công bắt buộc như ServerCheck):
```jsonc
{ "items": [ { "inventorySessionItemId": 1002, "note": "Không tìm thấy tại vị trí ghi nhận" } ] }
```
Item `Pending` không được liệt kê → server tự chuyển `Missing`, note `null`.
- **`GET /{id}`** (permission `Asset.Inventory.View`) → chi tiết 1 phiên bất kỳ (không giới hạn xưởng của mình).
- **`GET /grid-list?pageIndex=&pageSize=&fromDate=&toDate=&branchId=`** (permission `Asset.Inventory.View`) → phân trang `InventorySessionDto` nhưng `items` rỗng (như ServerCheck 7d.6).
- **Báo cáo** = danh sách thiết bị của 1 phiên: dùng `GET /{id}` (Inventory.View) — mỗi `items[]` có thêm `deviceTypeName`, `manager`, `groupName`, `departmentName`, `serialNumber` (đều `string | null`) bên cạnh `status/statusText/scannedBy/scannedAt/note`. Chọn phiên từ `grid-list`. (Đã bỏ `GET /report` + `/report/export` + `InventoryReportRowDto` cũ, 2026-09-26.)
- **`GET /{id}/export`** (permission `Asset.Inventory.View`) — trả file `.xlsx` 1 dòng/thiết bị của phiên (không phải `ApiResponse<T>`, đọc bằng `getForBlob()`). Khác ServerCheck: **không có file mẫu công ty**, BE tự dựng workbook mới (ClosedXML, layout tự do).
- **`/api/InventoryAssignment`** — phân công user↔xưởng, cùng shape `/api/ServerCheckAssignment` (7d.10) nhưng **route/permission riêng**: `GET` (`Asset.Inventory.Assign`) danh sách; `GET /me` (`Asset.Inventory.Scan`) xưởng của mình, `data:null`=chưa phân công; `PUT` (`Asset.Inventory.Assign`, upsert theo `userId`); `DELETE /{id}` (`Asset.Inventory.Assign`). **Khác ServerCheckAssignment**: nhiều user khác nhau được gán **CHUNG 1 xưởng** là bình thường (không unique theo `branchId`).

Role **"Kiểm kê thiết bị"** chứa `Asset.Inventory.Scan`. Xuất PDF (màn báo cáo web) dựng ở FE bằng `jspdf`, không qua BE.

## 7f. AppRelease — `/api/AppRelease`
Quản trị metadata bản phát hành app mobile nội bộ — chi tiết nghiệp vụ: [asset-module.md §1.23](asset-module.md). `apkUrl` chỉ là **string** — có thể là link ngoài dán tay (Drive...) hoặc link nội bộ do `POST /upload` sinh ra, FE/BE không phân biệt 2 loại. App mobile "YEV Scan" chỉ dùng `GET /latest` + tải file qua `apkUrl` trả về, không cần biết endpoint quản trị bên dưới.

- **`GET /latest`** — **`[AllowAnonymous]`, không cần token** (app gọi để kiểm tra cập nhật trước khi đăng nhập). → `AppReleaseDto | null` (`null` = chưa có bản nào). "Mới nhất" = `!isDeleted`, `versionCode` lớn nhất.
```jsonc
// AppReleaseDto
{ "id": 3, "versionCode": 4, "versionName": "1.3.0", "minVersionCode": 3,
  "apkUrl": "http://10.45.1.155:8081/api/AppRelease/download/b01fa4fe....apk", "changelog": "Sửa lỗi quét mã bị treo\nThêm màn lịch sử" }
```
App tự so `versionCode` hiện tại của mình với response: `< minVersionCode` → **bắt buộc** cập nhật (chặn dùng tiếp); nằm giữa `minVersionCode` và `versionCode` → **gợi ý** cập nhật (cho bỏ qua); `>= versionCode` → không cần làm gì. Logic so sánh này nằm ở **app Flutter**, BE chỉ trả dữ liệu thô.
- **`GET /grid-list?pageIndex=&pageSize=&keyword=`** (permission `Asset.AppRelease.Manage`) → phân trang chuẩn (§1.2); `keyword` lọc theo `versionName` (Contains).
- **`POST /api/AppRelease`** / **`PUT /{id}`** (permission `Asset.AppRelease.Manage`) — body `{ versionCode[Required], versionName[Required], minVersionCode[Required], apkUrl[Required], changelog? }`, PUT thêm `id` khớp URL. `versionCode` trùng (kể cả với bản ghi đã xoá mềm) → 400.
- **`DELETE /{id}`** (permission `Asset.AppRelease.Manage`) — xoá mềm.
- **`POST /upload`** (permission `Asset.AppRelease.Manage`, `multipart/form-data`, field `file`, giới hạn 300MB, chỉ nhận đuôi `.apk`) → `ApiResponse<string>`, `data` là URL tuyệt đối để dán vào `apkUrl` khi create/update — **không** tự lưu vào DB, không tự gắn với bản ghi nào. FE (`app-release.api.ts` → `AppReleaseApi.uploadApk`) dùng `api.postForm`.
- **`GET /download/{fileName}`** — **`[AllowAnonymous]`, không cần token**, trả file nhị phân trực tiếp (không bọc `ApiResponse<T>`), content-type `application/vnd.android.package-archive`. Đây chính là URL BE trả về từ `POST /upload` (cũng là giá trị `apkUrl` khi bản phát hành dùng file upload thay vì link ngoài).

## 8. Tổng hợp endpoint
| Route | Ghi chú |
|---|---|
| `/api/Branch`, `/api/Supplier`, `/api/DeviceType`, `/api/SoftwareGroup`, `/api/Software` | CRUD chuẩn (grid-list, all, {id}, POST, PUT, DELETE) |
| `/api/DeviceGroup` (`?departmentId=`), `/api/DeviceDepartment` | CRUD (Nhóm thuộc 1 Bộ phận) |
| `/api/IpPrefix` | CRUD; POST sinh 254 IP (`branchId` bắt buộc), PUT không sửa prefix, DELETE cascade |
| `/api/IpAddress` | grid-list, `available`, {id}, PUT{id}(status+note), PUT `bulk-status`(đổi status nhiều IP), `{id}/assign`, `{id}/unassign` (không POST/DELETE/all) |
| `/api/Device` | grid-list, `available`, {id}, `{id}/detail`, `{id}/replacement-suggestion`, `qr-labels`(POST, in QR hàng loạt 5.4b), POST, PUT, DELETE, `bulk-delete`. Không `all` |
| `/api/Report/device-list` | Báo cáo in ấn (không phân trang) |
| `/api/Report/device-summary` | Thống kê dashboard "Báo cáo thiết bị" (5.8b, không tham số) |
| `/api/TransferHistory` | POST(chuyển máy), `device/{deviceId}` |
| `/api/DeviceImport` | `preview`/`confirm` (Excel/CSV) |
| `/api/DeviceLiquidationImport` | `preview`/`confirm` — import 1 cột mã máy để thanh lý hàng loạt (6.4) |
| `/api/DeviceConfiguration` | `by-device/{deviceId}`, POST, PUT{id}, DELETE{id}, `{configId}/initial`, `initial/{id}`, `{configId}/history` |
| `/api/DeviceConfigurationImport` | `preview`/`confirm` (Tanium, chỉ update), `missing-devices-report` (trả file .xlsx, không phải `ApiResponse<T>`) |
| `/api/DeviceSoftware` | `device/{deviceId}`, POST, PUT, DELETE `device/{deviceId}/software/{softwareId}`, `picker/{deviceId}`, `sync` |
| `/api/AuditTrail` | `grid-list` (filter+phân trang), `record?tableName=&recordId=`. Chỉ đọc, ghi tự động ở BE |
| `/api/AiChat` | `stream`(POST, NDJSON, 7c) — trợ lý AI tra cứu, thay thế hoàn toàn cách gọi thẳng Ollama cũ ở FE |
| `/api/ServerCheck` | `today`, `start`(POST), `{id}`, `{id}/scan`(POST), `{id}/end`(POST), `manual-items`, `grid-list`, `report`, `report/export`(trả file .xlsx), `network-ping` (7d) — kiểm tra Server/Máy lạnh/UPS/Network hằng ngày qua QR + ping mạng |
| `/api/ServerCheckAssignment` | `GET`, `GET me`, `PUT`, `DELETE {id}` — phân công user ↔ xưởng cho kiểm tra server (7d.10) | `Asset.ServerCheck.Assign` (`me`: `.Scan`) |
| `/api/Inventory` | `current`, `start`(POST), `{id}`, `{id}/scan`(POST), `{id}/end`(POST), `grid-list`, `{id}/export`(trả file .xlsx) (7e) — kiểm kê thiết bị theo xưởng qua quét mã |
| `/api/InventoryAssignment` | `GET`, `GET me`, `PUT`, `DELETE {id}` — phân công user ↔ xưởng cho kiểm kê thiết bị (7e), nhiều user được gán chung 1 xưởng |
| `/api/AppRelease` | `latest`(**[AllowAnonymous]**), `grid-list`, POST, `PUT {id}`, `DELETE {id}`, `upload`(POST, multipart), `download/{fileName}`(**[AllowAnonymous]**, trả file nhị phân) (7f) — quản lý bản cập nhật app Flutter "YEV Scan", permission `Asset.AppRelease.Manage` (trừ `latest`/`download`) |
| `/api/AssetSetting` | GET, PUT — cấu hình 1 dòng duy nhất: `liquidationAfterMonths` (tự xóa mềm thiết bị đã thanh lý) + `serverCheckBranchId?` (phạm vi chi nhánh **chỉ** cho `ServerCheck/network-ping` 7d.8; danh sách quét QR lấy theo cờ `device.requiresDailyCheck`) |

`DELETE /api/Device/{id}` và `bulk-delete` (`POST /api/Device/bulk-delete`, `{ ids:[] }`, permission `Asset.Device.Delete`): xóa mềm, **chỉ** thiết bị `Liquidated(3)` "Đã thanh lý" (2026-08-22, đổi từ `PendingLiquidation(2)`); `DELETE {id}` trả lỗi 400 nếu sai trạng thái, `bulk-delete` bỏ qua và trả kết quả `{ deletedCount, skippedDevices:[{id,deviceCode,reason}] }`.

## 9. Checklist FE màn "Chi tiết thiết bị"
1. `GET /api/Device/{id}/detail` — 1 lần lấy đủ Device + Configuration(null?) + Software.
2. `configuration==null` → form trống, "Lưu"=POST config; ngược lại PUT `/{id}`.
3. Dropdown `deviceTypeId`/`supplierId`/`branchId` → `GET /api/{Entity}/all`.
4. Picker IP → `GET /api/IpAddress/available?keyword=` hoặc `grid-list?status=0`.
5. Dialog phần mềm → `picker/{deviceId}` mở, `sync` lưu (7.4).
6. Lịch sử sửa chữa → `GET /api/DeviceConfiguration/{configId}/history`.
7. "Đổi thiết bị" → `GET /api/Device/available` chọn máy mới → `POST /api/TransferHistory` (5.9).
8. "Import Excel" → `preview` → render `rows`/`errors` → `confirm`; có `pendingTransfers` → điền sẵn màn "Đổi thiết bị" (không tự gọi TransferHistory).
9. "Import Tanium" → cùng pattern (6.3), hiện `parsedDeviceCode`/`parsedDeviceName` để kiểm tra.
