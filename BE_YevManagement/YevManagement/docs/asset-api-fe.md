# asset-api-fe.md — API Asset cho Frontend

> Hợp đồng API quản lý Thiết bị/PC. Implementation: [asset-module.md](asset-module.md).

- **Base URL (Dev)**: `http://localhost:5000` · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Asset.Device.View`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- **Content-Type**: `application/json` cho request có body.

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
  "description":null, "usedIpCount":12, "availableIpCount":243 }
// grid-list/all sort theo GIÁ TRỊ IP (10.45.2 trước 10.45.10)
```
- **POST tự sinh 255 IpAddress con** (`n=1..255`, Status=0). Body: `prefix[Required, regex 3 octet]`, `branchId[Required]`, +mạng. Message: "...đã sinh 255 địa chỉ IP."
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
Query: `pageIndex/pageSize`, `deviceCode/manager/supplierName`(Contains), `purchaseDate`(Contains), `ipAddress`/`email`(Contains any), `groupId`/`departmentId`(exact), `note`, `isOutsourced`, `serialNumber`(Contains), `isUseUsb`(exact), `sortDeviceCodeAscending?`(null→`purchaseDate` giảm; true/false→`deviceCode` tăng/giảm, ghi đè mặc định).
```jsonc
// data.data[]
{ "id":16925, "deviceCode":"YDF-216", "deviceName":"DA", "branchName":"...", "supplierName":"...",
  "deviceTypeName":"Desktop", "groupName":null, "departmentName":null, "ipAddresses":[],
  "purchaseDate":"...", "manager":"...", "expirationDate":"...", "note":"...", "emails":["..."],
  "status":0, "statusText":"Chờ sử dụng", "isOutsourced":false, "serialNumber":null, "isUseUsb":false }
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
  "serialNumber":"SN-001", "isUseUsb":false,
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

### 5.5 `POST /api/Device`
```jsonc
{ "deviceCode":"...[Required]unique", "deviceName":"[Required]", "deviceTypeId":11[Required],
  "supplierId":2[Required], "branchId":9[Required],
  "groupId":null, "departmentId":null,   // optional, gán Nhóm bắt buộc kèm departmentId cha (2.1)
  "manager":"[Required]", "emails":[{ "email":"[Required][EmailAddress]", "note":null }],  // [Required][MinLength(1)]
  "purchaseDate":"...[Required]", "depreciationMonths":36,  // [Required][Range(1,600)]
  "isOutsourced":false, "status":0,  // [Range(0,3)], default 0
  "note":null, "serialNumber":"...",  // nullable [StringLength(100)], unique nếu có
  "isUseUsb":false, "ipAddressIds":[6989],  // IP đang Available, server tự set Assigned
  "suggestedNewDeviceId":null }  // Id máy MỚI thay chính device này (import tự set, xem 5.10)
```
> **KHÔNG gửi `expirationDate`** (server tự tính). `ipAddressIds` chứa Id không `Available`/trùng → 400. `serialNumber` trùng (kể cả soft-deleted) → 400. `emails` không unique. `suggestedNewDeviceId` phải tồn tại `!IsDeleted` (404), không tự trỏ mình (400, chỉ PUT). `groupId`/`departmentId` tồn tại `!IsDeleted` (404); gửi `groupId` bắt buộc `departmentId` cha đúng (400).

### 5.6 `PUT /{id}` — body giống Create + `id` khớp URL (sai → 400). Diff:
- `ipAddressIds`: bỏ khỏi mảng → gỡ về `Available`; thêm mới → phải `Available` → `Assigned`; giữ → không đụng. `[]` → gỡ hết.
- `emails`: khớp `email` (trim/case-insensitive) → giữ `id`+update `note`; mới → thêm; mất → soft-delete.

### 5.7 `DELETE /{id}` — soft-delete, gỡ IP về `Available`. **Không** tự xóa Config/Software.

### 5.8 Báo cáo — `GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=`
Controller riêng `/api/Report`. Không phân trang, `data` mảng thẳng. Filter optional (`keyword` Contains `deviceCode`/`deviceName`).
```jsonc
// data[] — sort deviceCode A-Z, stt đánh lại
{ "stt":1, "deviceCode":"...", "deviceName":"...", "ipAddress":null,  // nhiều IP nối ", "
  "purchaseDate":"...", "expirationDate":"...", "isExpired":false,  // FE map O/X
  "financialPeriod":86, "note":"..." }
```
**`financialPeriod`** ("Kỳ T/C"): từ `expirationDate`, năm tài chính Yazaki 1/7→30/6, đánh số từ 1941. `expirationDate=2026-10-01` → tháng≥7 → `2026−1940=86`. `null` nếu `expirationDate` null.

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

Field `[Required]` Excel không có → mặc định: `deviceName`=`deviceCode`, `manager`="", `emails`=[], `depreciationMonths`=**60**, `status`=`0`. (FE nhắc user sửa lại sau.)

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
**Luật gán IP** (`taniumIpAddress`): trống→bỏ qua; khớp IP nào→**luôn** gán (cướp từ Device khác), IP khác của Device đang import **không** bị gỡ; không khớp→**không chặn**, +`warnings`.
**Luật ghi Serial** (`serialNumber`, 2026-07-23): trống→bỏ qua; serial đang thuộc **Device khác** hoặc **lặp nhiều dòng trong file** → **không chặn dòng**, chỉ +`warnings` và bỏ ghi serial (`resolvedSerialNumber=null`); còn lại → ghi đè `Device.SerialNumber` (Tanium đọc thẳng từ máy nên tin hơn giá trị nhập tay). Cột serial chứa `"TSE-Error"` cũng làm hỏng dòng như các cột khác. **Update không đè field khác**: Device có config → chỉ đè 5 field Tanium (chỉ khi ô không rỗng), field khác giữ nguyên; chưa có → tạo mới (kèm Initial 6.1). Permission chung `Asset.DeviceConfiguration.Update`.

### 6.4 Import thanh lý hàng loạt — `/api/DeviceLiquidationImport` (preview/confirm, 2026-07-23)
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

## 8. Tổng hợp endpoint
| Route | Ghi chú |
|---|---|
| `/api/Branch`, `/api/Supplier`, `/api/DeviceType`, `/api/SoftwareGroup`, `/api/Software` | CRUD chuẩn (grid-list, all, {id}, POST, PUT, DELETE) |
| `/api/DeviceGroup` (`?departmentId=`), `/api/DeviceDepartment` | CRUD (Nhóm thuộc 1 Bộ phận) |
| `/api/IpPrefix` | CRUD; POST sinh 255 IP (`branchId` bắt buộc), PUT không sửa prefix, DELETE cascade |
| `/api/IpAddress` | grid-list, `available`, {id}, PUT{id}(status+note), PUT `bulk-status`(đổi status nhiều IP), `{id}/assign`, `{id}/unassign` (không POST/DELETE/all) |
| `/api/Device` | grid-list, `available`, {id}, `{id}/detail`, `{id}/replacement-suggestion`, POST, PUT, DELETE, `bulk-delete`. Không `all` |
| `/api/Report/device-list` | Báo cáo in ấn (không phân trang) |
| `/api/TransferHistory` | POST(chuyển máy), `device/{deviceId}` |
| `/api/DeviceImport` | `preview`/`confirm` (Excel/CSV) |
| `/api/DeviceLiquidationImport` | `preview`/`confirm` — import 1 cột mã máy để thanh lý hàng loạt (6.4) |
| `/api/DeviceConfiguration` | `by-device/{deviceId}`, POST, PUT{id}, DELETE{id}, `{configId}/initial`, `initial/{id}`, `{configId}/history` |
| `/api/DeviceConfigurationImport` | `preview`/`confirm` (Tanium, chỉ update) |
| `/api/DeviceSoftware` | `device/{deviceId}`, POST, PUT, DELETE `device/{deviceId}/software/{softwareId}`, `picker/{deviceId}`, `sync` |
| `/api/AuditTrail` | `grid-list` (filter+phân trang), `record?tableName=&recordId=`. Chỉ đọc, ghi tự động ở BE |

`DELETE /api/Device/{id}` và `bulk-delete` (`POST /api/Device/bulk-delete`, `{ ids:[] }`, permission `Asset.Device.Delete`): xóa mềm, **chỉ** thiết bị `PendingLiquidation(2)` "Chờ thanh lý"; `DELETE {id}` trả lỗi 400 nếu sai trạng thái, `bulk-delete` bỏ qua và trả kết quả `{ deletedCount, skippedDevices:[{id,deviceCode,reason}] }`.

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
