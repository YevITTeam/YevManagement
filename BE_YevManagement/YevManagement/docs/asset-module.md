# asset-module.md — Module Asset (Quản lý Thiết bị / PC)

> **ĐANG PHÁT TRIỂN.** CRUD đầy đủ hầu hết entity; AuditTrail chưa có Application/Api. Đọc [architecture-core.md](architecture-core.md) trước. Doc FE: [asset-api-fe.md](asset-api-fe.md).

- **DB**: `YevPCManagement` (conn `PCManagementConnection`). **DbContext**: `AssetDbContext`.
- DB scaffold từ hệ cũ → tên bảng/cột/constraint **tiếng Việt** (vd `Device`→`PK_ThietBis`, `IX_ThietBis_MaMay`). Giữ quy ước này khi map entity mới. Folder typo giữ nguyên: `Dtos/Suplliers/`.

## 1. Domain Models (`Asset.Domain/Entities/`)
| Entity | Thuộc tính chính | Quan hệ | Soft-del |
|---|---|---|---|
| `Device` | `DeviceCode`(unique), `DeviceName`, `DeviceTypeId`, `SupplierId`, `BranchId`, `GroupId?`, `DepartmentId?`, `Manager`, `PurchaseDate`, `DepreciationMonths`, `ExpirationDate?`(tính, §1.5), `IsOutsourced`, `Status`(§1.4), `Note?`, `SerialNumber?`(unique khi có, §1.11), `IsUseUsb`, `SuggestedNewDeviceId?`(tự tham chiếu, §1.8) | N-1 Branch/DeviceType/Supplier/DeviceGroup?/DeviceDepartment?/SuggestedNewDevice?; 1-1 DeviceConfiguration; 1-N IpAddresses/DeviceEmails/DeviceSoftwares/TransferHistory | **Có** |
| `DeviceEmail` | `DeviceId`, `Email`, `Note?` | N-1 Device | **Có** |
| `Branch` | `BranchCode`(unique), `BranchName` | 1-N Devices | **Có** |
| `DeviceGroup` | `GroupCode`(unique **trong 1 Bộ phận**, §1.14), `GroupName`, `DepartmentId`(bắt buộc) | N-1 DeviceDepartment, 1-N Devices | **Có** |
| `DeviceDepartment` | `DepartmentCode`(unique), `DepartmentName` | 1-N DeviceGroups/Devices | **Có** |
| `Supplier` | `SupplierCode`(unique), `SupplierName` | 1-N Devices | **Có** |
| `DeviceType` | `TypeCode`(unique), `TypeName` | 1-N Devices | **Có** |
| `IpAddress` | `IpAddress1`(unique toàn cục, cột `IpAddress`), `DeviceId?`, `IpPrefixId`(bắt buộc), `Status`(§1.1), `Note?` | N-1 Device?/IpPrefix | **Có** |
| `IpPrefix` | `Prefix`(unique toàn cục, vd `10.45.1`), `BranchId?`, `SubnetMask?`, `Gateway?`, `PreferredDns?`, `AlternateDns?`, `Description?` | N-1 Branch?, 1-N IpAddress | **Có** |
| `DeviceConfiguration` | 20 field linh kiện (`Cpu/Ram/HardDrive/Os/Vga/Mainboard/Monitor/Mouse/Keyboard/Headphone/Speaker/Ups/Psu/Maker/Model/PowerAdapter/WirelessCard/Nic/Other`) + `Note?` | 1-1 Device (`DeviceId` unique); 1-1 Initial; 1-N History | Không |
| `DeviceConfigurationInitial` | Snapshot bất biến 20 field + `CreatedAt` | 1-1 DeviceConfiguration | Không (xóa cứng qua action) |
| `DeviceConfigurationHistory` | Snapshot 20 field + `EditedAt`, `EditedBy` | N-1 DeviceConfiguration | Không (audit log) |
| `DeviceSoftware` | **khoá kép** `(DeviceId, SoftwareId)`, `InstallDate`, `LicenseKey?` | N-1 Device/Software | Không |
| `Software` | `SoftwareCode`(unique), `SoftwareName`, `SoftwareType?`, `Publisher?`, `SoftwareQuantity?`, `SoftwarePriority?`, `SoftwareGroupId` | N-1 SoftwareGroup, 1-N DeviceSoftwares | **Có** |
| `SoftwareGroup` | `GroupCode`(unique), `GroupName` | 1-N Softwares | **Có** |
| `TransferHistory` | `OldDeviceId`, `NewDeviceId`, `TransferDate`, `Note?` (FK bắt buộc, `ClientSetNull`) | N-1 Old/NewDevice | Không |
| `AssetSetting` | `LiquidationAfterMonths` (§1.16) | — | Không |
| `AuditTrail` | `Id(long)`, `TableName`, `RecordId`, `RecordName?`, `AffectedCount`, `Action`, `OldValues?`, `NewValues?`, `ChangedBy`, `ChangedAt` (ns `Asset.Domain.Models`) | — | Không |

> `DeviceSoftware` không có `Id` đơn → tìm bằng `FirstOrDefaultAsync(DeviceId+SoftwareId)`, xóa cứng.

### 1.1. `IpAddress.Status` — enum `IpAddressStatus`
`0=Available` (chưa gán), `1=AssignedExternal` (gán nhưng không có DeviceId, thiết bị ngoài — `DeviceCode`="Khác"), `2=Assigned` (có DeviceId thật).
**Bất biến**: `Assigned(2)` ⟺ `DeviceId != null`; `Available(0)/AssignedExternal(1)` ⟺ `DeviceId == null`.
Server tự derive: gán→`2`+DeviceId; gỡ→`0`+null. `IpAddressService.UpdateAsync` (chỉ `Status`+`Note`) chỉ cho `0↔1` khi IP chưa gắn; IP đang gắn chỉ đổi `Note`.
**`StatusText` chỉ có MỘT nguồn duy nhất** (2026-07-23): `IpAddressStatusExtensions` (`Asset.Domain/Enums`) — `"Chưa sử dụng"` / `"Đã sử dụng (khác)"` / `"Đã sử dụng"` / fallback `"Không xác định"` (bộ chữ do người dùng chốt). Trước đó text bị lặp 3 chỗ trong `IpAddressService` với 2 cách gọi khác nhau (grid ghi "Chưa gán", màn chi tiết ghi "Chưa sử dụng"). Vì projection EF (`Expression<Func<>>`) không gọi được method C#, **các API list gán `StatusText` SAU khi materialize** (vòng `foreach` ngay trước `OrderBy`), không viết ternary trong `Select`. Message của `DomainException` trong `UpdateAsync` cũng nội suy từ helper này để text lỗi luôn khớp với text trên UI.
> Unique index `IX_DiaChiIPs_DiaChi` (`IpAddress1`) và `IX_TienToIPs_TienTo` (`Prefix`) **không lọc `IsDeleted`** → mọi check trùng phải so trên **toàn bộ** bản ghi kể cả đã soft-delete.

### 1.2. IpPrefix ↔ IpAddress
`SubnetMask/Gateway/PreferredDns/AlternateDns` sống ở `IpPrefix` (mỗi dòng = 1 subnet 3-octet). `IpAddress.IpPrefixId` bắt buộc → sửa field mạng ở Prefix hiển thị cho toàn bộ IP con qua JOIN.
- **Create Prefix tự sinh 255 IpAddress con** (`n=1..255`, `Available`) trong `IpPrefixService.CreateAsync` (không có `generate-range`).
- **Không Create/Delete thủ công từng IpAddress**: controller còn `grid-list`/`available`/`{id}`/`PUT{id}`(Status+Note)/`PUT bulk-status`/`assign`/`unassign`. `CreateAsync/DeleteAsync` không tồn tại.

### 1.2b. `PUT /api/IpAddress/bulk-status` — đổi trạng thái nhiều IP (2026-07-23)
`BulkUpdateStatusAsync(BulkUpdateIpAddressStatusRequestDto{Ids, Status, UpdateNote, Note?})` — tick nhiều IP trên grid rồi đổi trạng thái 1 lần. Permission dùng lại `Asset.IpAddress.Update` (không thêm permission mới).
- **Giữ nguyên bất biến §1.1**: chỉ nhận `Status` = `0`/`1`; gửi `2` → `DomainException` (Assigned do hệ thống tự đặt qua assign/unassign).
- **Skip-and-report** (giống `Device bulk-delete`, không fail cả lô): Id không tồn tại/đã soft-delete → skip; IP đang gắn thiết bị (`DeviceId != null`) → skip kèm mã máy. Kết quả `BulkUpdateIpAddressStatusResultDto{UpdatedCount, Status, StatusText, SkippedIpAddresses:[{Id, IpAddress?, Reason}]}`.
- **`Note` chỉ bị đụng khi `UpdateNote = true`** (đổi trạng thái hàng loạt không được âm thầm xoá note riêng của từng IP); khi `true` thì `Note` (kể cả null) áp cho toàn bộ IP cập nhật được.
- **1 `SaveChangesAsync` duy nhất** cho cả lô → audit trail chỉ sinh **1 dòng gộp** (§1.17) thay vì N dòng.
- ⚠️ **Không** `Include(x => x.Device)`: `FindWithIncludesAsync` là tracking, mà `GenericRepository.Update()` → `DbSet.Update()` đánh dấu Modified **cả graph** ⇒ Device bị ghi đè + lọt vào audit. Mã máy cho message skip được query riêng bằng `SelectAsync`, chỉ khi thực sự có dòng bị skip.
- **Prefix có Update**: `UpdateIpPrefixDto` (`Id`/`BranchId[Required]`/`SubnetMask?`/`Gateway?`/DNS/`Description?`) — **không có `Prefix`** (3-octet bất biến sau tạo, đổi phải xóa+tạo lại). `UpdateAsync` chạy lại `ValidateNetworkSettings` + validate `BranchId` tồn tại.
- **`IpPrefix.BranchId`**: mỗi dải gán 1 Chi nhánh. Cột DB **nullable** (dải cũ để `null`) nhưng `CreateIpPrefixDto.BranchId` **`[Required]`**. Validate qua `ValidateBranchIdAsync`.
- **`ValidateNetworkSettings`** (`Shared.Application/Helper/NetworkHelper.cs`: `IsValidIpv4`/`GetNetworkClass`/`IsSameSubnet`): field mạng nếu có phải IPv4 hợp lệ; `Gateway` thuộc network 3-octet của Prefix, cùng subnet theo mask, không trùng `.0`/`.255`.
- **`DeleteAsync`**: chặn (`DomainException`) nếu còn IP con **đang gắn Device**; nếu không → **cascade soft-delete toàn bộ IP con chưa dùng** cùng Prefix.

### 1.3. Sort lưới IP theo giá trị số
`IpPrefix` và `IpAddress` grid/available sort theo **giá trị IP** (không phải chuỗi) qua `NetworkHelper.ToSortableKey` (pack 4 octet → `long`). `GetPagedAsync` (cả 2) **materialize DTO rồi sort+phân trang trong bộ nhớ** (bảng nội bộ, quy mô vừa).

### 1.4. `Device.Status` — enum `DeviceStatus`
`0=PendingUse`, `1=InUse`, `2=PendingLiquidation`, `3=Liquidated`.

### 1.5. `Device.ExpirationDate` — field tính
Server luôn set `= PurchaseDate.AddMonths(DepreciationMonths)` trong Create/Update. DTO **không nhận** từ client (chỉ nhận `DepreciationMonths`).

### 1.6. Device hỗ trợ nhiều IP + nhiều Email
- **Nhiều IP** (bỏ "IP chính"): Create/Update nhận `IpAddressIds:List<int>` (mỗi Id phải `Available`, không trùng). `UpdateAsync` gọi `SyncIpAddressesAsync` (diff: bỏ→`Available`, thêm→validate `Available` rồi gán, giữ→không đụng). Xóa Device → gỡ hết IP về `Available`. `DeviceDto.IpAddresses`=`List<DeviceIpAddressDto>`; `DeviceGridDto.IpAddresses`=`List<string>`.
- **Nhiều Email**: bảng `DeviceEmails` (không unique — 1 email dùng chung nhiều Device). Create/Update nhận `Emails:List<DeviceEmailInputDto>` (`Email[Required][EmailAddress]`, `Note?`). `UpdateAsync` gọi `SyncEmailsAsync` (so khớp `Email` trim/case-insensitive: mất→soft-delete, khớp→update `Note`, mới→Add). Xóa Device → soft-delete email theo.
- **Filter**: `DeviceFilterRequest.IpAddress?`/`Email?` (Contains, khớp bất kỳ IP/email qua `.Any(!IsDeleted)`).
- **Hệ luỵ**: `TransferHistory` chuyển toàn bộ IP máy cũ→mới; import Tanium chỉ "cướp" IP đó, không đụng IP khác của Device.

### 1.7. Báo cáo "DANH SÁCH DESKTOP" — `GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=`
Controller riêng `ReportController` (gom báo cáo tương lai). Trả thẳng `List<DeviceReportItemDto>` (**không phân trang**): `Stt`(đánh lại theo `OrderBy(DeviceCode)`), `DeviceCode`, `DeviceName`, `IpAddress`(toàn bộ IP nối `", "`), `PurchaseDate`, `ExpirationDate`, `IsExpired`(`ExpirationDate < hôm nay UTC`), `FinancialPeriod`, `Note`. Filter optional.
**Kỳ tài chính (`FinancialPeriod`)**: tính từ `ExpirationDate` (không phải PurchaseDate). Năm tài chính Yazaki **1/7→30/6**, đánh số từ 1941:
```
fiscalYearStartYear = ExpirationDate.Month >= 7 ? ExpirationDate.Year : ExpirationDate.Year - 1
FinancialPeriod = fiscalYearStartYear - 1940
```
(vd `01-Oct-2026`→86). Không lưu DB, tính on-the-fly trong `Expression<Func<>>` (EF dịch SQL). Dùng `ToListAsync(query, selector)` (không phân trang).

### 1.8. "Chuyển máy" — `TransferHistory`
`POST /api/TransferHistory` (`CreateTransferHistoryDto`: `OldDeviceId`/`NewDeviceId`[Required], `Note?`) — **1 hành động tổng hợp** qua `TransferHistoryService.TransferAsync`:
1. Validate `Old != New` + cả 2 tồn tại.
2. **Chuyển toàn bộ IP** Old→New (IP New đang giữ mà không thuộc Old → gỡ về `Available`).
3. **Chuyển Email**: re-point `DeviceId` Old→New (không cần gỡ vì không unique; trùng nội dung với New → soft-delete dòng cũ).
4. **Chuyển DeviceSoftware**: re-point `DeviceId` (giữ `InstallDate`/`LicenseKey`); trùng khoá kép ở New → giữ New, xóa cứng Old.
5. **Copy 6 field vị trí/người dùng** Old→New (ghi đè): `BranchId`/`Manager`/`IsOutsourced`/`IsUseUsb`/`GroupId`/`DepartmentId`(2026-07-16, bổ sung Nhóm+Bộ phận). **KHÔNG copy** (thuộc tính vật lý của New): `DeviceTypeId`/`SupplierId`/`PurchaseDate`/`ExpirationDate`/`DepreciationMonths`/`DeviceCode`/`DeviceName`/`SerialNumber`/`Note`/`DeviceConfiguration`.
6. **Status Old** → `PendingUse(0)`, trừ khi Old đã hết hạn (`IsExpired`) → `PendingLiquidation(2)`.
6b. **Status New** → `InUse(1)` tự động.
7. `DeviceConfiguration` **không đụng** (không copy, không xóa).
8. Tạo 1 `TransferHistory`. **Không có API sửa/xóa** (audit log).

**Chọn máy mới**: `GET /api/Device/available?keyword=` (không phân trang, trả `List<DeviceGridDto>`, lọc `PendingUse(0)`+`!IsDeleted`+`DeviceCode.Contains`).

**Gợi ý "máy thay thế"**: `Device.SuggestedNewDeviceId` (int?, tự tham chiếu, `ClientSetNull`) = "máy CŨ này dự tính thay bởi máy có Id này". `DeviceImportService.ConfirmAsync` set qua `SetSuggestedNewDeviceAsync(oldId, newId)` (giữ gợi ý mới nhất). Field có ở Create/Update DTO (validate máy mới tồn tại `!IsDeleted` + không tự trỏ mình).
`GET /api/Device/{oldDeviceId}/replacement-suggestion` (`Asset.Device.View`) → `DeviceReplacementSuggestionDto?{Id, DeviceCode, DeviceName}` (đọc thẳng `oldDevice.SuggestedNewDevice`; chỉ trả nếu máy mới còn `!IsDeleted` + `PendingUse`, ngược lại `null`). `DeviceDto` trả kèm `SuggestedNewDeviceId`/`SuggestedNewDeviceCode`.
`GET /api/TransferHistory/device/{deviceId}` → `List<TransferHistoryDto>` (cả vai trò cũ/mới, sort `TransferDate` mới nhất trước).

### 1.9. Import Device từ Excel/CSV — `/api/DeviceImport` (`preview`/`confirm`, 2 bước)
Mẫu **13 cột đúng thứ tự**, dòng 1 header: `MQL`, `Xưởng`(mã), `Loại Thiết Bị`(**mã**), `Nhà Cung Cấp`(mã), `Ngày Mua`, `Ghi Chú`, `Số SerialNumber`, `Hãng`, `Model`, `CPU`, `RAM`, `Ổ Cứng`, `MQL Cũ`.
- **5 cột config (Hãng/Model/CPU/RAM/Ổ Cứng)**: tùy chọn → map `DeviceConfiguration.Maker/Model/Cpu/Ram/HardDrive`. Confirm: dòng có ≥1 cột khác rỗng → tạo kèm `DeviceConfiguration` (luôn `CreateAsync`). `CreatedConfigCount` đếm.
- **"Ngày Mua"**: ô Date thật → đọc trực tiếp; ô text → chỉ nhận `dd/MM/yyyy` (`TryParseExact` + InvariantCulture, hằng `PurchaseDateFormat`). Định dạng khác/trống → lỗi.
- **`.xlsx` + `.csv`**: `PreviewAsync` chọn `ParseXlsx`(ClosedXML)/`ParseCsv` theo đuôi (`CsvFileHelper.HasCsvExtension`). `CsvFileHelper` (`Shared.Application/Helper/`, tự viết): tự nhận `,`/`;`, hỗ trợ quote+escape `""`, UTF-8 BOM. File hỏng → `DomainException`(400).
- **Preview** (chỉ đọc): parse+validate+resolve tên→Id, trả `DeviceImportPreviewResultDto{Rows, TotalRows, ValidRows, InvalidRows}`, mỗi row có `IsValid`/`Errors`.
- **Confirm** (`ConfirmDeviceImportDto{Rows}` field thô, server tự tra lại): **validate lại từ đầu**. **Dòng lỗi BỎ QUA, không chặn batch** — chỉ dòng hợp lệ tạo Device trong 1 transaction. Kết quả `DeviceImportConfirmResultDto.SkippedRows`(`RowNumber`/`DeviceCode`/`Errors`)+`SkippedCount`. Mỗi dòng hợp lệ:
  - Gọi `IDeviceService.CreateAsync`. Field `[Required]` Excel không có → mặc định: `DeviceName`=`MQL`, `Manager`="", `Emails`=[], `DepreciationMonths`=**60** (`DefaultDepreciationMonths`), `Status`=`PendingUse`.
  - Có `MQL Cũ`: **KHÔNG** tự chuyển máy — thêm gợi ý `PendingTransfers` + lưu DB qua `SetSuggestedNewDeviceAsync` (§1.8). FE tự bấm "Chuyển".
- **Validate/resolve** (`ValidateAndResolveRowsAsync`): **cả 3 cột tra cứu đều khớp MÃ** — `Branch.BranchCode`/`DeviceType.TypeCode`/`Supplier.SupplierCode` (2026-07-23: `Loại Thiết Bị` đổi từ Tên sang Mã, `DeviceImportRowDto.DeviceTypeName` → **`DeviceTypeCode`** — breaking với FE). Không khớp → **không tự tạo**, báo lỗi. `MQL Cũ` phải khớp `Device.DeviceCode` `!IsDeleted`. Lỗi khác: thiếu `MQL`/`Ngày Mua`, trùng `MQL`/Serial trong file, Serial trùng **thiết bị khác** trong DB, `MQL Cũ`=`MQL` mới, `MQL Cũ` dùng nhiều dòng.
- **Upsert theo `MQL`** (2026-07-23): MQL đã tồn tại không còn là lỗi tuyệt đối —
  - còn `PendingUse(0)` → dòng đó **cập nhật** thiết bị cũ; `ResolvedExistingDeviceId` = Id máy, `IsUpdate` = true (computed) để FE phân biệt tạo/cập nhật ngay ở Preview;
  - trạng thái khác → lỗi dòng `"...đang ở trạng thái 'X', chỉ cập nhật được thiết bị đang 'Chờ sử dụng'."` (text lấy từ `DeviceStatusExtensions`);
  - đã soft-delete → lỗi dòng (unique index `DeviceCode` là global, không thể tạo lại).
  - Nhánh update = `UpdateExistingDeviceFromRowAsync`, **KHÔNG** gọi `DeviceService.UpdateAsync` vì hàm đó sync `Emails`/`IpAddressIds` theo request mà file Excel không có 2 thứ này ⇒ sẽ xoá sạch. Ghi đè: `BranchId/DeviceTypeId/SupplierId/PurchaseDate` (+ tính lại `ExpirationDate` theo `DepreciationMonths` hiện có). Ghi đè **chỉ khi ô không rỗng**: `Note`/`SerialNumber`. **Không đụng**: `DeviceName`/`Manager`/emails/IP/`DepreciationMonths`/`Status`/`GroupId`/`DepartmentId`/`IsOutsourced`/`IsUseUsb`. Config: dùng chung `UpsertConfigurationFromRowAsync` (đã có config → đè 5 field khi không rỗng, giữ nguyên field khác; chưa có → tạo mới).
  - Serial check loại trừ chính thiết bị đang cập nhật (`existingSerial.Id != existingDeviceId`).
  - Kết quả bổ sung `UpdatedCount`/`UpdatedDeviceIds`/`UpdatedConfigCount`.
- **Giới hạn**: chưa có file mẫu tải.

### 1.10. Import Cấu hình từ file Tanium — `/api/DeviceConfigurationImport` (`preview`/`confirm`)
Chỉ **cập nhật** `DeviceConfiguration` cho Device **đã tồn tại** (không tạo Device mới). Controller/Service riêng.
- Mẫu **9 cột — format mới 2026-07-23**: `Computer Name`, `Tanium Client IP Address`, `Last Logged In User`(**bỏ qua**), `Manufacturer`→Maker, `Model`, **`Computer Serial Number`→`Device.SerialNumber`**, `CPU`→Cpu, `Total Memory`→Ram (cột này trước tên là `RAM`), `Size`→HardDrive. File theo **format cũ 8 cột đọc sẽ lệch cột** — không hỗ trợ song song.
- **Ghi Serial** (2026-07-23): serial ghi vào **Device**, không phải DeviceConfiguration. `SerialNumber` là unique-khi-có nên nếu serial đang thuộc **Device khác**, hoặc **lặp ở nhiều dòng trong file** (sẽ vỡ unique index giữa transaction) → chỉ `Warnings` + bỏ ghi serial (`ResolvedSerialNumber=null`), **không chặn dòng** — cùng triết lý với quy tắc IP. Còn lại ghi đè giá trị cũ (Tanium đọc trực tiếp từ máy, tin hơn nhập tay). `UpdateDeviceSerialNumberAsync` chỉ `Update()`, `SaveChanges` do bước config phía sau gánh (giống `ReassignDeviceIpAsync`). Kết quả bổ sung `SerialUpdatedCount`. Cột serial cũng nằm trong tầm kiểm tra `"TSE-Error"`.
- **Chỉ import 5 họ**: `YDC`/`YLC`/`YDF`/`AC`/`TYC`. Không khớp (kể cả **toàn bộ họ `DA`**, `Mayhethong`, `DESKTOP-*`, `ACLF/ACELF/ALF`, ...) → **loại thầm lặng** (`OutOfScopeSkippedCount`).
- **Tách Computer Name → Mã/Tên** (`ParseComputerName`): (1) bỏ hậu tố domain sau `.`, tách theo `-`. (2) đoạn đầu = `YDC/YLC/YDF/TYC`+số (số có thể rỗng) → Mã chèn `-` (`YDC1877`→`YDC-1877`), Tên = phần còn lại. (3) đoạn đầu khớp `^AC\d+[A-Za-z]?$` (`AC81`/`AC90A`) → **họ AC**: Mã = nối 2 đoạn đầu (`AC90B-2446`), Tên = Mã, đoạn còn lại bỏ. (4) còn lại (gồm họ `DA`) → loại.
- Không khớp Device → lỗi Preview (không tạo mới). Trùng mã trong file → lỗi cả 2 dòng (không tự lấy dòng cuối). Dòng có `"TSE-Error"` → lỗi.
- **Gán IP** (`Tanium Client IP Address`, chỉ khi có giá trị): tra `IpAddress.IpAddress1` `!IsDeleted`. Khớp → **luôn** gán (cướp từ Device khác); **không** khớp → **không chặn**, thêm `Warnings`, config vẫn chạy. `ReassignDeviceIpAsync`: **KHÔNG gỡ IP khác của Device đang import** (chỉ thêm).
- **Update config không đè field khác**: Device đã có config → chỉ đè 5 field Tanium (`Cpu/Ram/HardDrive/Maker/Model`, chỉ khi mới không rỗng), field khác copy nguyên (DTO yêu cầu gửi đủ). Chưa có → tạo mới (kèm Initial).
- Confirm: 1 transaction, validate lại, còn lỗi → **không ghi gì**, `DomainException` `"Dòng {n}: {lý do}"`. Permission chung `Asset.DeviceConfiguration.Update`.

### 1.11. `SerialNumber` + `IsUseUsb`
`SerialNumber?` (max 100, **unique khi có** — index filtered `WHERE SerialNumber IS NOT NULL`, cho nhiều `null`), `IsUseUsb` (bool, default false). Create/Update check trùng `SerialNumber` bằng `DomainException` (chỉ khi khác rỗng + có thay đổi). Có trong `DeviceFilterRequest`/`DeviceGridDto`/`DeviceDto`/Create-Update DTO.

### 1.12. `DeviceConfiguration` — phạm vi
Chỉ CRUD cơ bản + 6 field chung (`Maker/Model/PowerAdapter/WirelessCard/Nic/Other`). **KHÔNG làm field riêng theo loại** (máy in/mạng — hệ cũ hầu như không nhập). Không cần `DeviceType.Category`.

### 1.13. "Cấu hình ban đầu" + "Sửa chữa/Thay thế"
2 bảng `DeviceConfigurationInitials`/`Histories`:
- **Initial**: `CreateAsync` tự copy 20 field → snapshot bất biến (Update không đụng). Xóa qua `DELETE /api/DeviceConfiguration/initial/{id}`.
- **History**: `UpdateAsync` so 20 field cũ/mới; chỉ tạo 1 dòng (giá trị mới + `EditedAt`/`EditedBy`) nếu ≥1 field đổi.
- **`EditedBy`**: `HttpContext.User.Identity.Name` (claim JWT) qua `IHttpContextAccessor`, fallback `"Unknown"`. Cần `<FrameworkReference Include="Microsoft.AspNetCore.App"/>` trong `Asset.Application.csproj`.
- Cả 2 có FK `OnDelete(Cascade)` tới DeviceConfiguration. Không có Create/Update DTO (tự sinh).

### 1.14. DeviceGroup (Nhóm) + DeviceDepartment (Bộ phận) — 1 Bộ phận N Nhóm
- **Sort**: `DeviceType`/`DeviceGroup`/`DeviceDepartment` (grid+all) → `OrderBy(Id)` (giữ thứ tự import). `Branch`/`Supplier`/`SoftwareGroup`/`Software` sort Code/Name.
- `DeviceDepartment` = master độc lập. `DeviceGroup.DepartmentId` **bắt buộc** (mỗi Nhóm 1 Bộ phận cha). `Device.GroupId`/`DepartmentId` vẫn **nullable**.
- **Ràng buộc gán Device** (`ValidateGroupAndDepartmentAsync`): gửi `GroupId` → **bắt buộc** kèm `DepartmentId` đúng là cha (`DomainException` nếu thiếu/không khớp). `DepartmentId` gửi độc lập được.
- **`GroupCode` unique trong 1 Bộ phận** (index `IX_Nhoms_BoPhanId_MaNhom`): 2 Bộ phận có thể cùng mã `"OF"`. Check trùng theo `(DepartmentId, GroupCode)`, lỗi kèm tên Bộ phận.
- **Cascading dropdown**: `GET /api/DeviceGroup/all?departmentId=` (+ `grid-list?departmentId=`), optional. FE: chọn Bộ phận trước, đổi Bộ phận → xóa lựa chọn Nhóm.

### 1.15. Xóa Device (đơn + hàng loạt) — xóa MỀM, chỉ `PendingLiquidation`
Cả `DELETE /api/Device/{id}` (`DeleteAsync`) và `POST /api/Device/bulk-delete` (`BulkDeleteDeviceRequestDto{Ids}`, `BulkDeleteAsync`) — permission `Asset.Device.Delete` — **chỉ cho xóa thiết bị đang `PendingLiquidation(2)`** (Chờ thanh lý); trạng thái khác → `DELETE` đơn ném `DomainException("Chỉ có thể xóa thiết bị đang chờ thanh lý.")`, bulk bỏ qua (`SkippedDevices`).
Cơ chế xóa mềm dùng chung: set `IsDeleted = true` + gỡ hết `IpAddress` đang gắn (`DeviceId = null`, `Status = Available`) + soft-delete `DeviceEmail`. Bulk gộp theo `deletableIds` rồi 1 Save; kết quả `BulkDeleteDeviceResultDto{DeletedCount, SkippedDevices:[{Id,DeviceCode,Reason}]}` (`Reason`="Không tìm thấy thiết bị."/"Chỉ có thể xóa thiết bị đang chờ thanh lý.").
> Xóa mềm (không cứng) vì `TransferHistory.OldDeviceId`/`NewDeviceId` FK bắt buộc (không nullable) — xóa cứng Device từng chuyển máy sẽ vi phạm FK.

### 1.16. `AssetSetting` + tự chuyển "Chờ thanh lý → Đã thanh lý"
Bảng `AssetSettings` (seed 1 dòng `Id=1, LiquidationAfterMonths=2`) — cấu hình runtime. `AssetSettingService` tự "get-or-create" nếu bảng trống.
- `GET /api/AssetSetting` (`Asset.Setting.View`) / `PUT /api/AssetSetting` (`Asset.Setting.Update`, `UpdateAssetSettingDto{LiquidationAfterMonths[Range(1,120)]}`) — thao tác 1 dòng, không Id trên route.
- **`DeviceLiquidationBackgroundService`** (`HostApi/BackgroundServices/`, `AddHostedService`) chạy **1 lần/ngày** (00:30 theo `TimeHelper.GetCurrentUtcTime()`), scope riêng:
  1. Device `PendingUse(0)`/`InUse(1)`, `!IsDeleted`, `ExpirationDate < hôm nay` → `PendingLiquidation(2)`.
  2. Device `PendingLiquidation(2)`, `ExpirationDate.AddMonths(LiquidationAfterMonths) < hôm nay` → `Liquidated(3)`. **Mốc tính từ `ExpirationDate`** (không phải lúc vào trạng thái chờ).
  3. 1 Save cho cả 2 bước. Lỗi log qua `ILogger`, không crash, thử lại hôm sau.

### 1.17. `AuditTrail` — ghi log Create/Update/Delete tự động (2026-07-16)
**Tự động, không cần sửa Service nào.** Chặn tại 1 điểm duy nhất: `AssetDbContext.SaveChangesAsync` override (`Asset.Infrastructure/Context/AssetDbContext.AuditTrail.cs`, partial class riêng — không đụng file scaffold `AssetDbContext.cs`) đọc `ChangeTracker.Entries()` trước/sau khi save để tự sinh `AuditTrail`. Entity mới thêm sau này **tự động được audit**, không cần nhớ gọi gì thêm.
- **Phạm vi**: toàn bộ entity qua `AssetDbContext` (Device, DeviceGroup, DeviceDepartment, Branch, Supplier, DeviceType, Software, SoftwareGroup, IpAddress, IpPrefix, DeviceConfiguration, DeviceEmail, DeviceSoftware, TransferHistory, AssetSetting...). **Loại trừ** 3 bảng tự thân đã là log/snapshot: `AuditTrail`, `DeviceConfigurationHistory`, `DeviceConfigurationInitial` (audit lồng audit vô nghĩa).
- **`Action`**: `Create` (`EntityState.Added`), `Update` (`Modified`, field thường đổi), `Delete` (`Modified` với `IsDeleted` false→true, **hoặc** `EntityState.Deleted` với entity hard-delete như `DeviceSoftware`/`TransferHistory`/`DeviceConfiguration`), `Restore` (`IsDeleted` true→false).
- **`OldValues`/`NewValues`**: JSON **diff-based** — chỉ field thực sự đổi (so `property.OriginalValue` vs `CurrentValue`, không dựa `IsModified` vì `GenericRepository.Update()` gọi `DbSet.Update()` đánh dấu Modified cả entity). `Modified` không đổi field nào thật (diff rỗng) → **không tạo** bản ghi audit. `Create`: `OldValues=null`, `NewValues`=toàn bộ field (kèm `Id` — lấy **sau** khi save đầu tiên vì cột identity chưa có giá trị lúc entity còn `Added`). `Delete` (hard): `OldValues`=toàn bộ field, `NewValues=null`.
- **`RecordId`**: cột khoá chính đầu tiên (đủ cho toàn bộ entity `int Id` đơn). Riêng `DeviceSoftware` (khoá kép `DeviceId+SoftwareId`) lấy `DeviceId` làm `RecordId`, `SoftwareId` vẫn nằm trong Old/NewValues nên không mất thông tin.
- **`RecordName`** *(2026-07-23)*: tên đọc được của đối tượng bị tác động, để đọc log không phải join ngược bảng gốc. Map trong `ResolveRecordName`: `Device`→`"MaMay - TenMay"`, `IpAddress`→`"192.168.1.5 (PC-001)"`, `IpPrefix`→`"192.168.1.x"`, các master data→`"Code - Name"`, `DeviceConfiguration/DeviceEmail/DeviceSoftware/TransferHistory`→kèm **mã thiết bị**. Các entity con chỉ có `DeviceId` được resolve sang `DeviceCode` bằng **1 query duy nhất** mỗi `SaveChanges` (`LoadDeviceCodesAsync`, chỉ chạy khi có entity loại đó). Tối đa 255 ký tự, cắt bớt nếu dài hơn.
- **Gộp thao tác hàng loạt (`AffectedCount`)** *(2026-07-23)*: các entry **cùng `TableName` + cùng `Action`** trong 1 `SaveChanges` được gộp thành **1 dòng** thay vì N dòng. Ví dụ tạo 1 dải IP = 1 dòng `IpAddress/Create` với `AffectedCount=255`, `RecordName="192.168.1.1 → 192.168.1.255 (255 bản ghi)"` (trước đây ra 255 dòng). Dòng gộp: `OldValues=null`, `NewValues` = JSON `{ AffectedCount, RecordIds, RecordNames, Truncated }` — danh sách cắt còn tối đa `MaxNamesInGroupedEntry = 50` phần tử (`Truncated=true` khi bị cắt). Dòng đơn lẻ (`AffectedCount=1`) vẫn giữ nguyên diff Old/NewValues đầy đủ như cũ.
- **Index**: `IX_AuditTrails_TableName_RecordId`, `IX_AuditTrails_ChangedAt` (migration `AddAuditTrailRecordNameAndAffectedCount`, đã apply 2026-07-23 — migration này cũng **xoá sạch log cũ** vì dữ liệu cũ thiếu `RecordName` và bị ngập do chưa gộp).
- **`ChangedBy`**: `HttpContext.User.Identity.Name` qua `IHttpContextAccessor` (constructor mới của `AssetDbContext`, DI tự resolve nhờ `AddHttpContextAccessor()` đã có sẵn). Không có HttpContext (vd `DeviceLiquidationBackgroundService` chạy nền lúc 00:30) → `"System"`.
- **2 lần `SaveChangesAsync`**: lần 1 lưu dữ liệu nghiệp vụ chính (để Added entity có Id); lần 2 lưu riêng các dòng `AuditTrail` vừa build. Lần 2 lỗi → chỉ log qua `ILogger`, **không** rollback/throw — audit là best-effort, không được làm mất dữ liệu nghiệp vụ đã lưu thành công.
- **API xem lại**: `AuditTrailService`/`AuditTrailController` (`Asset.Application/Asset.Api`) — `GET /api/AuditTrail/grid-list` (phân trang, filter `TableName/RecordId/RecordName/Action/ChangedBy/FromDate/ToDate`, sort `ChangedAt` mới nhất trước) + `GET /api/AuditTrail/record?tableName=&recordId=` (lịch sử 1 bản ghi cụ thể, vd xem toàn bộ log của 1 Device). Permission `Asset.AuditTrail.View` (seed migration `AddAssetAuditTrailPermission` bên Identity — **CHƯA apply**, chờ `dotnet ef database update` như các migration khác ở §5).
- **Bảng `AuditTrails` đã tồn tại sẵn trong DB thật** (không qua migration Asset nào — thuộc DB scaffold gốc), nên phần ghi log hoạt động ngay, không cần chờ migration nào bên Asset.

## 2. DTOs (`Asset.Application/Dtos/`)
- **Master data** (Branches/Suplliers/DeviceTypes/SoftwareGroups): `{Entity}Dto`(Id/Code/Name), `Create...`(+`[Required]`), `Update...`.
- **DeviceGroups**: `DeviceGroupDto`(+`DepartmentId`/`DepartmentName`), `Create/UpdateDeviceGroupDto`(`DepartmentId[Required]`+Code/Name).
- **DeviceDepartments**: cùng khuôn master.
- **Devices**:
  - `DeviceFilterRequest`: `PageIndex=1`, `PageSize=50`, filter `DeviceCode/Manager/SupplierName`(Contains), `PurchaseDate`(Contains), `IpAddress?`/`Email?`(Contains any), `GroupId?`/`DepartmentId?`(exact), `Note`(Contains), `IsOutsourced?`/`IsUseUsb?`(exact), `SerialNumber?`(Contains), `SortDeviceCodeAscending?`(null→`OrderByDescending(PurchaseDate)`; true/false→theo `DeviceCode`).
  - `DeviceGridDto`: tên Branch/Supplier/DeviceType + `GroupName?`/`DepartmentName?` + `IpAddresses:List<string>`/`Emails:List<string>` + `StatusText` + `IsOutsourced`/`SerialNumber?`/`IsUseUsb`.
  - `DeviceDto`: tên + `GroupId?/GroupName?/DepartmentId?/DepartmentName?` + `StatusText` + `IpAddresses:List<DeviceIpAddressDto>` + `Emails:List<DeviceEmailDto>` + `ExpirationDate` + `SerialNumber?/IsUseUsb` + `SuggestedNewDeviceId?/SuggestedNewDeviceCode?`.
  - `Create/UpdateDeviceDto`: `DeviceCode/DeviceName/Manager[Required]`, `Emails[Required][MinLength(1)]`, `DeviceTypeId/SupplierId/BranchId[Required]`, `GroupId?/DepartmentId?`(validate khi có), `PurchaseDate[Required]`, `DepreciationMonths[Required][Range(1,600)]`, `IsOutsourced`, `Status[Range(0,3)]`, `Note?`, `IpAddressIds:List<int>`, `SerialNumber?[StringLength(100)]`, `IsUseUsb`, `SuggestedNewDeviceId?`. **Không có** `ExpirationDate`.
  - `DeviceIpAddressDto`(Id/IpAddress), `DeviceEmailDto`(Id/Email/Note), `DeviceEmailInputDto`(Email/Note).
  - Báo cáo: `DeviceReportFilterRequest`(`DeviceTypeId?/BranchId?/Keyword?`), `DeviceReportItemDto` (§1.7, `IpAddress` là `string?` nối `", "`).
  - Bulk: `BulkDeleteDeviceRequestDto{Ids[Required][MinLength(1)]}`, `BulkDeleteSkippedDeviceDto`, `BulkDeleteDeviceResultDto`.
- **DeviceSoftwares**: `DeviceSoftwareDto`, `Create...`(+`[Required]`), `Update...`.
- **Softwares**: `SoftwareDto`(+`SoftwareGroupName`), `Create...`(+`[Required]` Code/Name/GroupId), `Update...`.
- **IpAddresses**: `IpAddressDto`(+`DeviceCode`="Khác" khi Status=1, `StatusText`, `Prefix*`, không `ServerIp`), `UpdateIpAddressDto`(`Id`/`Status`/`Note`), `BulkUpdateIpAddressStatusRequestDto`(`Ids[MinLength(1)]`/`Status[Range(0,2)]`/`UpdateNote`/`Note?`) + `BulkUpdateIpAddressStatusResultDto`/`...SkippedDto` (§1.2b), `IpAddressFilterRequest`(`Keyword/Status/IsInUse/DeviceId`, không `all`), `AssignIpAddressDto`(`DeviceId[Required]`). **Không** `CreateIpAddressDto`.
- **IpPrefixes**: `IpPrefixDto`(`UsedIpCount`/`AvailableIpCount`, `BranchId?`/`BranchName?`), `CreateIpPrefixDto`(`Prefix[Required][RegularExpression 3 octet]`, `BranchId[Required]`, +mạng), `UpdateIpPrefixDto`(không `Prefix`).
- **DeviceConfigurations**: `DeviceConfigurationDto`(+`DeviceCode`, 20 field), `Create...`(`DeviceId[Required]`, còn lại optional), `Update...`(+`Id`; `DeviceId` không dùng trong `UpdateAsync`), `DeviceConfigurationInitialDto`(+`CreatedAt`), `DeviceConfigurationHistoryDto`(+`EditedAt`/`EditedBy`) — 2 cuối tự sinh.
- **TransferHistories**: `TransferHistoryDto`(+Old/New Code/Name), `CreateTransferHistoryDto` — không Update/Delete.
- **AssetSettings**: `AssetSettingDto`, `UpdateAssetSettingDto`(`[Range(1,120)]`).

## 3. Repositories & UnitOfWork
`IAssetUnitOfWork` gom **18 repo**: `Devices, Branches, AssetSettings, DeviceGroups, DeviceDepartments, Softwares, SoftwareGroups, Suppliers, DeviceConfigurations, DeviceConfigurationInitials, DeviceConfigurationHistories, DeviceEmails, DeviceSoftwares, DeviceTypes, IpAddresses, IpPrefixes, TransferHistories, AuditTrails`. Tất cả **generic thuần** (rỗng). `AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>`.

## 4. Services & API — theo entity
> Hợp đồng API đầy đủ: [asset-api-fe.md](asset-api-fe.md). Toàn bộ 14 controller dùng `[RequirePermission("Module.Entity.Action")]` (danh sách mã: [identity-module.md](identity-module.md) §9).

| Entity | Controller/Route | CRUD | Permission |
|---|---|---|---|
| Branch | `/api/Branch` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.Branch.*` |
| DeviceGroup | `/api/DeviceGroup` | grid-list?departmentId=, all?departmentId=, {id}, POST, PUT, DELETE | `Asset.DeviceGroup.*` |
| DeviceDepartment | `/api/DeviceDepartment` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.DeviceDepartment.*` |
| Device | `/api/Device` | grid-list, `available`, {id}, `{id}/detail`, `{id}/replacement-suggestion`, POST, PUT, DELETE(mềm), `bulk-delete`(§1.15). **Không** `all` | `Asset.Device.*` |
| AssetSetting | `/api/AssetSetting` | GET, PUT (1 dòng) | `Asset.Setting.View/.Update` |
| Report | `/api/Report` | `device-list` | `Asset.Report.View` |
| DeviceType | `/api/DeviceType` | CRUD | `Asset.DeviceType.*` |
| Supplier | `/api/Supplier` | CRUD | `Asset.Supplier.*` |
| DeviceSoftware | `/api/DeviceSoftware` | GetByDevice, POST, PUT, DELETE, `picker/{deviceId}`, `sync`(PUT) | `Asset.DeviceSoftware.*` (picker→View, sync→Update) |
| Software | `/api/Software` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.Software.*` |
| SoftwareGroup | `/api/SoftwareGroup` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.SoftwareGroup.*` |
| IpAddress | `/api/IpAddress` | grid-list, `available`, {id}, PUT{id}(Status+Note), `bulk-status`(§1.2b), `{id}/assign`, `{id}/unassign`. **Không** POST/DELETE/all/generate-range | `Asset.IpAddress.View/.Update/.Assign` |
| IpPrefix | `/api/IpPrefix` | grid-list, all, {id}, POST(255 IP), PUT(BranchId+mạng), DELETE(cascade) | `Asset.IpPrefix.View/.Create/.Update/.Delete` |
| DeviceConfiguration | `/api/DeviceConfiguration` | `by-device/{deviceId}`(null nếu chưa có), POST, PUT, DELETE(cứng), `{configId}/initial`, `initial/{id}`(DELETE), `{configId}/history`. **Không** grid-list/all | `Asset.DeviceConfiguration.*` |
| TransferHistory | `/api/TransferHistory` | POST(chuyển máy), `device/{deviceId}`. **Không** PUT/DELETE | `Asset.TransferHistory.Create/.View` |
| DeviceImport | `/api/DeviceImport` | `preview`, `confirm` | `Asset.Device.Create` |
| DeviceConfigurationImport | `/api/DeviceConfigurationImport` | `preview`, `confirm` | `Asset.DeviceConfiguration.Update` |
| AuditTrail | `/api/AuditTrail` | `grid-list`(phân trang+filter), `record?tableName=&recordId=`. **Không** POST/PUT/DELETE (ghi tự động qua `SaveChangesAsync`, §1.17) | `Asset.AuditTrail.View` |

**Pattern service mẫu để nhân bản:**
- **CRUD chuẩn** → `BranchService` (soft-delete, check trùng code, `OrThrowNotFound`, `ToPagedResponseAsync`, `GetAllActiveAsync` dùng `SelectAsync`).
- **Grid filter động** → `DeviceService.GetDevicesForGridAsync` (`GetQueryable(false, ...includes)`, `.Where(!IsDeleted)`, nối filter, sort, `ToPagedResponseAsync`).
- **Khoá kép** → `DeviceSoftwareService` (`FirstOrDefaultAsync(DeviceId&&SoftwareId)`, xóa cứng).
- **CRUD FK bắt buộc** → `SoftwareService` (`.Include(SoftwareGroup)`, validate `SoftwareGroupId` + `OrThrowNotFound`).
- **Read-only + Update hạn chế + assign/unassign** → `IpAddressService`. `StatusText`/`DeviceCode`="Khác" trong `Expression` phải viết ternary (EF→SQL, không gọi method C#).
- **Master tự sinh/dọn record con** → `IpPrefixService` (`Enumerable.Range` build 255 IP, `AddRangeAsync` 1 lần; `DeleteAsync` cascade soft-delete).
- **Field tính + quan hệ 1-N ngược chiều** → `DeviceService` (`SyncIpAddressesAsync`/`SyncEmailsAsync` truy cập thẳng `_unitOfWork.IpAddresses`, không gọi chéo service; `UpdateAsync` gom mọi thay đổi vào 1 Save; `CreateAsync` cần 2 Save).
- **1-1 optional trả `null`** → `DeviceConfigurationService.GetByDeviceIdAsync` (trả `null` thay vì `NotFoundException`; FE dựa `null` để POST/PUT).
- **Snapshot + audit diff** → `DeviceConfigurationService` (Initial lúc tạo, History diff-based).

**Picker + sync DeviceSoftware**: `GET /api/DeviceSoftware/picker/{deviceId}` → `List<SoftwarePickerDto>`(`SoftwareId/Code/Name/IsSelected`). `PUT /api/DeviceSoftware/sync` (`SyncDeviceSoftwareDto{DeviceId, Items:[{SoftwareId, InstallDate?, LicenseKey?}]}`) đồng bộ toàn bộ tick: có trong Items chưa cài→Add (dùng `InstallDate ?? UtcNow`+`LicenseKey` riêng item); đang cài không còn trong Items→RemoveRange(xóa cứng); **giữ tick→không đụng** (không ghi đè key/date). Validate không trùng `SoftwareId` + tồn tại. 1 Save.

**`GET /api/Device/{id}/detail`** → `DeviceDetailDto{Device, Configuration?, Softwares}` (compose 3 service, `DeviceService` inject `IDeviceConfigurationService`/`IDeviceSoftwareService`).

## 5. Trạng thái migration đối chiếu DB thật
| Migration | Trạng thái |
|---|---|
| `AddIpPrefix`, `AddDeviceFields`, `AddDeviceConfigurationFields`, `AddDeviceConfigurationHistory`, `AddDeviceUsbSerialFields`, `AddDeviceEmailsMultiIp`, `AddDeviceReplacesOldDevice`, `AddDeviceGroupAndDepartment` | **Đã apply** |
| `AddIpPrefixBranch`, `ChangeDeviceGroupDepartmentRelation` (9 Bộ phận/28 Nhóm), `RenameDeviceReplacementToSuggestedNewDevice` (đổi hướng tự tham chiếu + data-fixup) | **Đã apply** (2026-07-13) |
| `UpdateIpAddressStatusRemoveServerIp` (backfill Status enum 3 trạng thái, drop `ServerIP`) | **CHƯA apply** — chờ người dùng chạy sau review |
| `AddAssetSetting` (seed `LiquidationAfterMonths=2`) | Chưa apply — chờ deploy |

Ngoài ra: dữ liệu `Software`/`SoftwareGroup` đã sửa qua API CRUD (32 group + 95 software) — không phải migration.

**Bug đã biết (chưa fix)**: `SoftwareGroupService.UpdateAsync` so `GroupCode` cũ/mới **trong bộ nhớ** (case-sensitive) nhưng check trùng SQL collation **case-insensitive** → đổi `GroupCode` chỉ khác hoa/thường luôn 400 "đã tồn tại". Cần so case-insensitive (hoặc so `Id` bản ghi trùng ≠ `request.Id`).

## 6. Cần làm tiếp
1. ~~**AuditTrail**: chưa có Application/Api.~~ Đã xong (§1.17, 2026-07-16) — còn chờ apply migration `AddAssetAuditTrailPermission` (Identity) để permission `Asset.AuditTrail.View` có hiệu lực.
2. **Auth**: xong `[RequirePermission]`. Admin cần gán permission cho role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị`.
3. **Warning** `CS8602/8603/8604` (null deref/return) trong Service — nên dùng `OrThrowNotFound`.
4. **Field ngoài phạm vi Device** (Email 2/3, Sticky Notes) — chưa làm, cần hỏi trước (CLAUDE.md §4.2).
5. **`SoftwareGroupService` case-collation bug** (§5).

## 7. Checklist thêm entity mới
Đọc core + file này (nghiệp vụ mới chưa rõ → **hỏi trước** CLAUDE.md §4.2) → entity `partial class` + `IsDeleted` → DbSet + Fluent (constraint tiếng Việt) → `I<Entity>Repository`+impl rỗng + property vào `IAssetUnitOfWork`+`AssetUnitOfWork` → DTOs (`Create/Update`+DataAnnotations tiếng Việt) → Service `: BaseService<IAssetUnitOfWork>` (Scrutor tự DI) → Controller `: BaseController` + route pattern §4 + `[RequirePermission(...)]` (không cần chỉnh Program.cs) + thêm mã permission vào migration seed + gán `Admin` → migration `dotnet ef migrations add <Name> --project Asset.Infrastructure --startup-project CompanySystem.HostApi` → cập nhật §4/§5 doc này.
