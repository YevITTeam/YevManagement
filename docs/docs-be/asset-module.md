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
- **Create Prefix tự sinh 254 IpAddress con** (`n=1..254`, `Available`) trong `IpPrefixService.CreateAsync` (không có `generate-range`); **không sinh `.0`** (network) và **`.255`** (broadcast) — 2 địa chỉ này không được dùng cho thiết bị.
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

### 1.4b. Đổi trạng thái Device tự động gỡ Ip/Software (2026-08-25, quyết định người dùng)
Một Device chỉ được coi là "đang giữ" Ip/Software khi thật sự `InUse`. `DeviceService.UpdateAsync` so `Status` cũ/mới để tự gỡ, **bỏ qua** `IpAddressIds` gửi kèm trong các trường hợp này:
- **`Status` mới = `PendingLiquidation`/`Liquidated`** (`IsLiquidationStatus`) → `ReleaseAllIpsAsync` (Ip về `Available`, `DeviceId=null`, đã có từ trước) **+ `ReleaseAllSoftwareAsync`** (xóa cứng toàn bộ `DeviceSoftware` của Device — mới thêm).
- **`Status` cũ = `InUse` và `Status` mới = `PendingUse`** (máy ngừng dùng, chưa gán lại) → chỉ `ReleaseAllIpsAsync`, **giữ nguyên Software** (còn dùng lại khi máy `InUse` trở lại).
- Trường hợp khác (kể cả `PendingLiquidation`→`PendingUse` revert) → `SyncIpAddressesAsync` như cũ.

`DeviceLiquidationImportService.ConfirmAsync` (§1.10b, `PendingLiquidation`→`Liquidated`) cũng gỡ Software (`ReleasedSoftwareCount` mới thêm vào `DeviceLiquidationImportConfirmResultDto`) — chủ yếu là lưới an toàn vì Device đáng lẽ đã được gỡ Software từ lúc vào `PendingLiquidation` qua `UpdateAsync` ở trên.

**Chặn tận gốc ở `DeviceSoftwareService` (2026-08-25, vá lỗ hổng phát hiện ngay sau khi thêm §1.4b)**: `IsLiquidationStatus` chuyển thành extension method dùng chung (`DeviceStatusExtensions.IsLiquidationStatus(this int)`, `Asset.Domain.Enums`) thay vì private method riêng trong `DeviceService`. `DeviceSoftwareService.CreateAsync`/`SyncAsync` (khi `Items.Count > 0`) đọc `Device.Status` trước, ném `DomainException` nếu `IsLiquidationStatus` — vì trước đó `/api/DeviceSoftware` không biết gì về `Device.Status`, gắn phần mềm cho máy đang "Chờ thanh lý" xong bị `ReleaseAllSoftwareAsync` xóa mất ngay lần Save Device kế tiếp (kể cả không đổi Status). `SyncAsync` vẫn cho phép gửi `Items` rỗng (dọn sạch) khi máy đang liquidation. FE `DeviceSoftwarePanel.tsx` disable nút "Cập nhật phần mềm" + hiện cảnh báo khi `deviceStatus` là 2/3 (chặn ở UI trước, BE vẫn là nguồn chân lý).
`DeviceService.DeleteAsync`/`BulkDeleteAsync` (chỉ xóa mềm máy `Liquidated`) cũng gọi thêm `ReleaseAllSoftwareAsync`/dọn `DeviceSoftware` hàng loạt — lưới an toàn cho máy đã ở `PendingLiquidation`/`Liquidated` **từ trước** khi có §1.4b (còn sót `DeviceSoftware` chưa gỡ), tránh để lại bản ghi mồ côi trỏ tới Device đã `IsDeleted`.

### 1.5. `Device.ExpirationDate` — field tính
Server luôn set `= PurchaseDate.AddMonths(DepreciationMonths)` trong Create/Update. DTO **không nhận** từ client (chỉ nhận `DepreciationMonths`).

### 1.6. Device hỗ trợ nhiều IP + nhiều Email
- **Nhiều IP** (bỏ "IP chính"): Create/Update nhận `IpAddressIds:List<int>` (mỗi Id phải `Available`, không trùng). `UpdateAsync` gọi `SyncIpAddressesAsync` (diff: bỏ→`Available`, thêm→validate `Available` rồi gán, giữ→không đụng). Xóa Device → gỡ hết IP về `Available`. `DeviceDto.IpAddresses`=`List<DeviceIpAddressDto>`; `DeviceGridDto.IpAddresses`=`List<string>`.
- **Nhiều Email**: bảng `DeviceEmails` (không unique — 1 email dùng chung nhiều Device). Create/Update nhận `Emails:List<DeviceEmailInputDto>` (`Email[Required][EmailAddress]`, `Note?`). `UpdateAsync` gọi `SyncEmailsAsync` (so khớp `Email` trim/case-insensitive: mất→soft-delete, khớp→update `Note`, mới→Add). Xóa Device → soft-delete email theo.
- **Filter**: `DeviceFilterRequest.IpAddress?`/`Email?` (Contains, khớp bất kỳ IP/email qua `.Any(!IsDeleted)`).
- **Hệ luỵ**: `TransferHistory` chuyển toàn bộ IP máy cũ→mới; import Tanium chỉ "cướp" IP đó, không đụng IP khác của Device.

### 1.7. Báo cáo "DANH SÁCH DESKTOP" — `GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=`
Controller riêng `ReportController` (gom báo cáo tương lai). Trả thẳng `List<DeviceReportItemDto>` (**không phân trang**): `Stt`(đánh lại theo `OrderBy(DeviceCode)`), `DeviceCode`, `DeviceName`, `IpAddress`(toàn bộ IP nối `", "`), `PurchaseDate`, `ExpirationDate`, `IsExpired`(`ExpirationDate < hôm nay UTC`), `FinancialPeriod`, `Note`. Filter optional.
**Chỉ lấy thiết bị `Status == PendingUse || Status == InUse`** (2026-07-29) — báo cáo dùng để thống kê thiết bị chờ sử dụng + đang vận hành, không tính thiết bị chờ thanh lý/đã thanh lý.
**Kỳ tài chính (`FinancialPeriod`)**: tính từ `ExpirationDate` (không phải PurchaseDate). Năm tài chính Yazaki **1/7→30/6**, đánh số từ 1941:
```
fiscalYearStartYear = ExpirationDate.Month >= 7 ? ExpirationDate.Year : ExpirationDate.Year - 1
FinancialPeriod = fiscalYearStartYear - 1940
```
(vd `01-Oct-2026`→86). Không lưu DB, tính on-the-fly trong `Expression<Func<>>` (EF dịch SQL). Dùng `ToListAsync(query, selector)` (không phân trang).

### 1.7b. Thống kê dashboard — `GET /api/Report/device-summary` (2026-07-30)
Cho màn `DeviceReport.tsx` (KPI + biểu đồ tròn trạng thái + top Chi nhánh/Loại thiết bị + bảng sắp/đã hết hạn). Không tham số, cùng phạm vi thiết bị với §1.7 (`PendingUse`/`InUse`).
`DeviceService.GetReportSummaryAsync()` — tính hoàn toàn bằng `COUNT`/`GROUP BY` qua `CountAsync`/`GroupCountAsync` mới thêm vào `IGenericRepository` (xem `architecture-core.md §1`), **không** tải nguyên bảng `Device` về rồi cộng dồn ở C#:
- `TotalCount`/`InUseCount`/`PendingUseCount`: `CountAsync(query)` + `CountAsync(query, status==InUse)`.
- `BranchDistribution`/`DeviceTypeDistribution`: `GroupCountAsync` theo `Branch.BranchName`/`DeviceType.TypeName`, top 6 (`OrderByDescending().Take(6)` sau khi group — tập kết quả chỉ vài chục dòng nên sort trong bộ nhớ, không cần đẩy xuống SQL).
- `ExpiringDevices`: thiết bị có `ExpirationDate <= hôm nay + 90 ngày` (hằng số `ReportExpiryWindowDays`, **phải khớp** `EXPIRY_WINDOW_DAYS` ở FE `DeviceReport.tsx`), gồm cả thiết bị đã quá hạn (`DaysRemaining` âm). `DaysRemaining` tính trong bộ nhớ sau khi `ToListAsync` (phép trừ ngày đơn giản, không đáng dịch sang SQL).
- `ExpiringSoonCount` = số dòng trong `ExpiringDevices` có `DaysRemaining >= 0`.
Trước 2026-07-30, FE tự tải toàn bộ `Device/grid-list` (nhiều trang `pageSize=1000` chạy song song) rồi cộng dồn trong `useMemo` — chậm (~1.5-2s, vài MB) khi DB có hàng nghìn thiết bị; endpoint này thay thế hoàn toàn cách đó.

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
  - Gọi `IDeviceService.CreateAsync`. Field `[Required]` Excel không có → mặc định: `DeviceName`=`MQL`, `DepreciationMonths`=**60** (`DefaultDepreciationMonths`), `Status`=`PendingUse`. `Manager`/`Emails` luôn để trống (tuỳ chọn từ 2026-08-01, không phải do thiếu cột Excel). `Note` lấy từ cột "Ghi Chú", rỗng thì mặc định `""` (Note `[Required]` trên DTO nhưng nhánh import nội bộ không chạy qua `ModelState`, không văng lỗi).
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

#### 1.10a. Báo cáo đối chiếu Tanium — `POST /api/DeviceConfigurationImport/missing-devices-report` (2026-07-27)
Yêu cầu người dùng: xuất file Excel liệt kê Device đang ghi nhận **`Status = InUse`** trong hệ thống nhưng **không xuất hiện** trong file Tanium vừa quét — để người import phát hiện lệch dữ liệu (máy đã tắt/thanh lý nhưng hệ thống chưa cập nhật, đổi tên máy sai quy ước khiến Tanium/hệ thống không khớp được, máy lỗi mạng không báo về Tanium...).
- **Chỉ so trên Device `Status = InUse(1)`** — quyết định người dùng: Tanium chỉ quét được máy đang bật/đang dùng thật sự, nên `PendingUse`/`PendingLiquidation`/`Liquidated` không có mặt trong file Tanium là chuyện bình thường, **không** phải sai lệch cần báo cáo.
- **"Đã được Tanium quét thấy"** = dòng trong file có Computer Name khớp được 1 Device có thật (`ResolvedDeviceId != null`), **bất kể dòng đó có lỗi ở field khác hay không** (VD trùng mã trong file, lỗi `"TSE-Error"` ở 1 cột) — máy vẫn rõ ràng có mặt trong lần quét, không tính là "thiếu". Dòng bị loại thầm lặng vì Computer Name ngoài 5 họ (§1.10) đương nhiên không khớp được Device nào — không ảnh hưởng tới việc tính "thiếu" cho các Device khác.
- **Đọc lại file độc lập với Preview/Confirm**: hành động chỉ đọc, tự parse lại file gửi lên (không cần đã bấm "Xem trước" trước, không nhận Id/mã từ client).
- **Lọc theo tiền tố mã máy (`prefixes`, form field, chuỗi phân cách dấu phẩy — 2026-07-27)**: người dùng tự nhập ở FE (mặc định gợi ý `YDC, YDF, YLC`, có thể sửa/xoá); chỉ Device có `DeviceCode` bắt đầu bằng 1 trong các tiền tố này mới được đối chiếu — tránh báo "thiếu" nhầm cho Device ngoài phạm vi Tanium quét. Rỗng = không lọc (lấy toàn bộ Device `InUse`).
- **Response không phải `ApiResponse<T>`** — trả thẳng file `.xlsx` (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), tên file `BaoCaoDoiChieuTanium_yyyyMMdd_HHmm.xlsx` (ASCII, tránh phải encode RFC 5987 cho Content-Disposition). Số lượng thiết bị thiếu trả qua header riêng **`X-Missing-Device-Count`** (FE đọc để toast tóm tắt, không phải mở file ra đếm) — header này (và `Content-Disposition`) phải nằm trong `WithExposedHeaders(...)` của CORS policy `AllowNextJs` (`CompanySystem.HostApi/Program.cs`) thì FE mới đọc được qua `fetch`. Nhánh lỗi trước khi ghi file (thiếu file upload) vẫn trả `ApiResponse<object>.Failure(...)` JSON bình thường.
- Cột báo cáo: STT, Mã máy, Tên máy, **Số seri** (`Device.SerialNumber`), Chi nhánh, Loại thiết bị, Nhóm, Bộ phận, Người quản lý, Địa chỉ IP, Ghi chú. Build bằng ClosedXML (`XLWorkbook`) — **lần đầu tiên** BE tự sinh file Excel để tải xuống (mọi chỗ dùng ClosedXML trước đây chỉ để **đọc** file import).
- Permission: dùng lại `Asset.DeviceConfiguration.Update` (như `preview`/`confirm`, không phải hành động tạo/xóa riêng → không seed permission mới).

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

### 1.15. Xóa Device (đơn + hàng loạt) — xóa MỀM, chỉ `Liquidated`
Cả `DELETE /api/Device/{id}` (`DeleteAsync`) và `POST /api/Device/bulk-delete` (`BulkDeleteDeviceRequestDto{Ids}`, `BulkDeleteAsync`) — permission `Asset.Device.Delete` — **chỉ cho xóa thiết bị đang `Liquidated(3)`** (Đã thanh lý — 2026-08-22, đổi từ `PendingLiquidation(2)` vì máy chờ thanh lý vẫn có thể còn dùng/hoàn tác, chỉ máy đã hoàn tất quy trình thanh lý mới an toàn để xóa); trạng thái khác → `DELETE` đơn ném `DomainException("Chỉ có thể xóa thiết bị đã thanh lý.")`, bulk bỏ qua (`SkippedDevices`).
Cơ chế xóa mềm dùng chung: set `IsDeleted = true` + gỡ hết `IpAddress` đang gắn (`DeviceId = null`, `Status = Available`) + soft-delete `DeviceEmail`. Bulk gộp theo `deletableIds` rồi 1 Save; kết quả `BulkDeleteDeviceResultDto{DeletedCount, SkippedDevices:[{Id,DeviceCode,Reason}]}` (`Reason`="Không tìm thấy thiết bị."/"Chỉ có thể xóa thiết bị đã thanh lý.").
> Xóa mềm (không cứng) vì `TransferHistory.OldDeviceId`/`NewDeviceId` FK bắt buộc (không nullable) — xóa cứng Device từng chuyển máy sẽ vi phạm FK.

### 1.16. `AssetSetting` + tự động xóa mềm Device đã thanh lý (định kỳ theo tháng, cấu hình được)
Bảng `AssetSettings` (seed 1 dòng `Id=1, LiquidationAfterMonths=2`) — cấu hình runtime. `AssetSettingService` tự "get-or-create" nếu bảng trống.
- `GET /api/AssetSetting` (`Asset.Setting.View`) / `PUT /api/AssetSetting` (`Asset.Setting.Update`, `UpdateAssetSettingDto{LiquidationAfterMonths[Range(1,120)]}`) — thao tác 1 dòng, không Id trên route. **`LiquidationAfterMonths` đổi nghĩa (2026-08-22)**: không còn là "số tháng chờ trước khi tự thanh lý" (tính năng đó đã bỏ, xem dưới) mà là **số tháng giữa 2 lần chạy job tự động xóa** mô tả bên dưới. `AssetSettingDto` trả cho FE chỉ có field này — `LastAutoDeleteRunAt` (xem dưới) là bookkeeping nội bộ, **không** expose qua API.
- **`DeviceLiquidationBackgroundService`** (`HostApi/BackgroundServices/`, `AddHostedService`) — vòng lặp ngoài vẫn **kiểm tra mỗi ngày** (00:30 theo `TimeHelper.GetCurrentUtcTime()`), nhưng **thân job chỉ thật sự chạy khi đến hạn** (2026-08-22, theo yêu cầu người dùng — thay hẳn "1 lần/ngày" bằng chu kỳ tháng cấu hình được):
  1. Đọc entity `AssetSetting` trực tiếp qua `unitOfWork.AssetSettings` (không qua `IAssetSettingService`, vì cần cả field nội bộ `LastAutoDeleteRunAt`). Không có dòng nào (lẽ ra không xảy ra vì đã seed) → log warning, bỏ qua lượt.
  2. **Tính hạn**: đến hạn nếu `LastAutoDeleteRunAt == null` (chưa chạy lần nào → chạy ngay) **hoặc** `LastAutoDeleteRunAt.AddMonths(LiquidationAfterMonths) <= hôm nay`. Chưa đến hạn → bỏ qua lượt, không làm gì.
  3. Đến hạn: quét mọi Device `Status == Liquidated(3)` và `!IsDeleted` (không điều kiện chờ nào khác — đủ điều kiện ngay khi vào `Liquidated`), với mỗi Device tìm được set `IsDeleted = true` + dọn dẹp giống hệt `DeviceService.DeleteAsync` (gỡ hết `IpAddress` đang gắn về `Available`, soft-delete `DeviceEmail`). Không có Device nào cũng tính là "đã chạy".
  4. Set `LastAutoDeleteRunAt = hôm nay` rồi 1 Save (cả Device/IP/Email lẫn AssetSetting). Lỗi log qua `ILogger`, không crash, thử lại hôm sau (không set `LastAutoDeleteRunAt` nên hạn giữ nguyên).
- Bỏ hẳn tính năng tự chuyển trạng thái `PendingUse/InUse → PendingLiquidation → Liquidated` (dùng `ExpirationDate` cũ) — chuyển trạng thái giờ chỉ còn thao tác thủ công (`DeviceService.UpdateAsync`) hoặc import thanh lý hàng loạt (§1.10b).

**Chuyển trạng thái thủ công cũng áp dụng cùng luật** (2026-08-22): `DeviceService.UpdateAsync` — nếu `request.Status` là `PendingLiquidation(2)`/`Liquidated(3)`, **bỏ qua** `IpAddressIds` gửi lên, ép gỡ hết IP hiện gắn (không sync theo danh sách IP người dùng chọn); `CreateAsync` tạo máy thẳng ở 1 trong 2 trạng thái này cũng **không gán** IP dù request có gửi kèm. Trạng thái khác (`PendingUse`/`InUse`) giữ hành vi sync IP như cũ.

### 1.10b. Import thanh lý hàng loạt — `/api/DeviceLiquidationImport` (`preview`/`confirm`, 2026-07-23)
Import file **1 cột `Mã máy` (MQL)**, dòng 1 header (`.xlsx`/`.csv`, dùng chung `CsvFileHelper`/ClosedXML) để chuyển hàng loạt Device sang `Liquidated(3)`. Service/Controller riêng, 2 bước như các import khác. `DeviceLiquidationImportService : BaseService` (không cần `DeviceService`, thao tác thẳng qua `_unitOfWork`).
- **Luật trạng thái nguồn** (quyết định người dùng): **CHỈ** máy đang `PendingLiquidation(2)` mới thanh lý được. Máy đã `Liquidated(3)` → lỗi "đã được thanh lý trước đó"; trạng thái khác (`PendingUse`/`InUse`) → lỗi "...đang ở trạng thái 'X', chỉ thanh lý được thiết bị đang 'Chờ thanh lý'." (text từ `DeviceStatusExtensions`). Không tìm thấy mã / đã soft-delete / trùng mã trong file → lỗi dòng.
- **Kèm dọn dẹp giống `DeviceService.DeleteAsync`**: máy thanh lý coi như không còn dùng → **gỡ hết IP** (`DeviceId=null`, `Status=Available`, đếm `ReleasedIpCount`) + **soft-delete `DeviceEmail`** + **xóa cứng hết `DeviceSoftware`** (đếm `ReleasedSoftwareCount`, §1.4b, 2026-08-25). (Khác `DeleteAsync`: KHÔNG set `IsDeleted` — máy vẫn còn để tra cứu, chỉ đổi `Status`.)
- **Preview** (chỉ đọc): trả `DeviceLiquidationImportPreviewResultDto{Rows, TotalRows, ValidRows, InvalidRows}`, mỗi row có `ResolvedDeviceId?`/`CurrentStatus?`/`CurrentStatusText?`/`IsValid`/`Errors`.
- **Confirm** (`ConfirmDeviceLiquidationImportDto{Rows}` field thô): **validate lại từ đầu**, dòng lỗi **BỎ QUA không chặn batch** (`SkippedRows`), dòng hợp lệ thanh lý trong 1 transaction. Có **re-check trong vòng lặp** (`device.Status != PendingLiquidation` sau khi load lại) phòng đổi trạng thái đồng thời. Kết quả `DeviceLiquidationImportConfirmResultDto{LiquidatedCount, LiquidatedDeviceIds, ReleasedIpCount, ReleasedSoftwareCount, SkippedCount, SkippedRows}`.
- **Permission**: dùng lại `Asset.Device.Update` (đổi trạng thái, không phải tạo/xóa → không seed permission mới).

### 1.16. In mã QR thiết bị — `POST /api/Device/qr-labels` (2026-07-23)
In tem QR hàng loạt cho các Device tick trên grid. **BE chỉ trả dữ liệu, FE tự vẽ QR + dàn layout in** (không thêm NuGet QR/PDF nào). `DeviceService.GetQrLabelsAsync`.
- **Request** `DeviceQrLabelRequestDto{Ids:List<int>}` — bulk-only (in 1 máy = gửi list 1 phần tử). Không có biến thể theo bộ lọc (chỉ theo lựa chọn, quyết định người dùng).
- **Response** `List<DeviceQrLabelDto>`: `DeviceId/DeviceCode/DeviceName/DeviceTypeName?/BranchName?/SupplierName?/Manager?/SerialNumber?/StatusText/PurchaseDate` + `QrPayload`. Trả **đầy đủ field** để user chọn in field nào; giữ **đúng thứ tự Ids** yêu cầu (SQL `IN` không giữ thứ tự → reorder trong bộ nhớ). Id không tồn tại/đã soft-delete → bỏ qua thầm lặng.
- **`QrPayload`** (nội dung mã hoá QR, do BE dựng sẵn — `BuildQrPayload`): text nhiều dòng, **dòng 1 LUÔN là `DeviceCode` trần** (app quét nội bộ tách dòng 1 để tra cứu; camera điện thoại thường quét ra cả khối đọc được, không cần mạng — hệ nội bộ nên deep-link web không mở được). Các dòng sau: `DeviceName`, `SN: {SerialNumber}`, `Xưởng: {BranchName}` (bỏ dòng nếu field rỗng). FE có thể dựng lại payload theo field user chọn **nhưng phải giữ dòng 1 = DeviceCode**.
- **Permission**: `Asset.Device.View` (chỉ đọc dữ liệu để in).

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
- **API xem lại**: `AuditTrailService`/`AuditTrailController` (`Asset.Application/Asset.Api`) — `GET /api/AuditTrail/grid-list` (phân trang, filter `TableName/RecordId/RecordName/Action/ChangedBy/FromDate/ToDate`, sort `ChangedAt` mới nhất trước) + `GET /api/AuditTrail/record?tableName=&recordId=` (lịch sử 1 bản ghi cụ thể, vd xem toàn bộ log của 1 Device). Permission `Asset.AuditTrail.View` (seed migration `AddAssetAuditTrailPermission` bên Identity — **đã apply**, xác nhận lại qua `dotnet ef migrations list` trên DB thật 2026-07-27).
- **Bảng `AuditTrails` đã tồn tại sẵn trong DB thật** (không qua migration Asset nào — thuộc DB scaffold gốc), nên phần ghi log hoạt động ngay, không cần chờ migration nào bên Asset.

### 1.18. AI Chat (tool-calling) — `POST /api/AiChat/stream` (2026-07-24)
Chuyển tính năng "Chat với AI" từ chạy tạm ở FE (gọi thẳng Ollama từ trình duyệt) sang BE thật, theo đúng spec [ai-chat-be-huong-dan.md](ai-chat-be-huong-dan.md) — đọc file đó trước nếu cần đối chiếu chi tiết (payload Ollama, danh mục tool, system prompt gốc). Mục này chỉ ghi lại **điểm khớp với kiến trúc thật** khi hiện thực.

> **Cập nhật 2026-07-30**: catalogue rút từ 17 → **7 tool**, tập trung 2 nhóm việc (tra cứu thiết bị đủ mọi field như UI + tra cứu IP: IP trống / IP này ai đang dùng / tình trạng cả dải). Các con số "17 tool" trong mục này là trạng thái lúc mới làm; xem [ai-chat-be-huong-dan.md §16](ai-chat-be-huong-dan.md) cho danh sách hiện hành và lý do. Executor vẫn giữ đủ case của 10 tool đã tắt nên bật lại chỉ cần dán JSON vào `AiChatToolDefinitions.cs`.
- **Vị trí code**: nằm trong `Asset.Application`/`Asset.Api`/`Asset.Infrastructure` (không tạo module riêng) — vì cả 17 tool đều gọi thẳng service Asset có sẵn, không có entity/DbContext mới nào.
  - `Asset.Application/Dtos/AiChat/`: `AiChatRequestDto`/`AiChatMessageDto` (hợp đồng FE), `AiChatStreamEventDto` (4 dạng dòng NDJSON trả về), `OllamaWireModels.cs` (`OllamaMessageWire`/`OllamaToolCallWire`/`OllamaChatChunkWire` — hợp đồng riêng với Ollama, **không** lộ ra FE), `AiChatToolDefinitions.cs` (JSON 17 tool, 16 tool đầu copy nguyên văn từ spec gốc + `get_ip_prefix_usage` thêm 2026-07-27, parse 1 lần thành `JsonNode` tĩnh).
  - `Asset.Application/Interfaces/External/IOllamaChatClient.cs` + `Asset.Infrastructure/External/OllamaChatClient.cs`: typed `HttpClient` gọi `POST {OllamaBaseUrl}/api/chat`, đọc NDJSON từng dòng bằng vòng `while ((line = await reader.ReadLineAsync(...)) != null)` (**không** check `reader.EndOfStream` trước — thuộc tính đó block đồng bộ chờ mạng, giữ luôn 1 thread pool trong lúc async, vi phạm analyzer `CA2024` và làm nặng thêm độ trễ khi nhiều người chat cùng lúc), `"think":false` **luôn** gửi cứng (bắt buộc theo spec §3, không phải tối ưu). Request có thêm `"options":{"temperature": AiChatSettings:Temperature}` (mặc định **0.3**, 2026-07-27) — hạ nhiệt độ so với mặc định Ollama (thường 0.7-0.8) để model bám sát quyết định "có nên gọi tool không" nhất quán hơn, giảm hiện tượng cùng 1 dạng câu hỏi lúc gọi đúng tool lúc lại tự bịa câu trả lời.
  - `AiChatService` (orchestrator, implement `IAiChatService`): vòng lặp tool-calling tối đa `AiChatSettings:MaxToolRounds` (mặc định 3) lượt. **Giữ `tool_calls` từ BẤT KỲ chunk nào khác rỗng** trong vòng `while` đọc stream — không chỉ lấy chunk cuối (đúng bug đã ghi trong spec §3: có model trả `tool_calls` giữa dòng rồi thêm 1 chunk rỗng `done:true` sau đó, chunk rỗng không được đè mất).
  - ⚠️ **Bug đã fix (2026-07-27)**: bản đầu tiên chỉ `contentBuilder.Append(...)` từng chunk `content` mà **không `yield return`** ngay — tích luỹ hết cả round (có thể vài-chục giây với model cục bộ) rồi mới gửi 1 cục text duy nhất ra FE, sai với chính thiết kế gốc ("stream thẳng ra client trong lúc chờ", spec §4). FE cảm giác "đứng hình rồi dump chữ" — đây là nguyên nhân chính khiến phản hồi có vẻ chậm dù model không hề chậm hơn trước. Đã sửa: `yield return AiChatStreamEventDto.Content(chunk.Message!.Content)` ngay trong vòng `while` đọc stream (hợp lệ vì nằm trong `try` chỉ có `finally`, không có `catch`, khác với `try` lồng bên trong bọc `MoveNextAsync()`) — `contentBuilder` vẫn giữ để dựng message `"assistant"` đưa vào lịch sử gửi lại Ollama, chỉ không còn là nguồn duy nhất gửi ra FE.
  - `AiChatToolExecutorService` (implement `IAiChatToolExecutorService`): dispatch 17 tool bằng cách gọi thẳng **service Application có sẵn** (`IDeviceService`, `IBranchService`, `ISupplierService`, `IDeviceTypeService`, `IDeviceGroupService`, `IDeviceDepartmentService`, `ISoftwareService`, `IIpAddressService`, `ISoftwareGroupService`, `IIpPrefixService`, `IAssetSettingService`, `IAuditTrailService`, `ITransferHistoryService`) — không tự viết lại query, không đụng repository/DbContext trực tiếp, tái dùng nguyên rule lọc `!IsDeleted`/soft-delete đã có sẵn trong từng service. **Không throw** — mọi lỗi (tool lạ, không tra được resolve, exception nội bộ) bọc thành `{"error": "..."}` trả vào message `"tool"`, đúng yêu cầu spec §4.
    - **`get_ip_prefix_usage`** (2026-07-27, tool thứ 17): gọi `IIpAddressService.GetPrefixUsageAsync(prefix)` — hàm mới, join thẳng `IpAddress`/`IpPrefix` lọc **khớp chính xác** `Prefix` (không `Contains`, khác pattern resolve gần đúng ở §6 spec — lý do xem `ai-chat-be-huong-dan.md` §6 "Ngoại lệ"), trả `IpPrefixUsageDto{TotalIpCount, UsedCount, AvailableCount, UsedIpAddresses, AvailableIpAddresses}`. Không đụng `IpAddressFilterRequest`/`grid-list` hiện có — DTO/hàm hoàn toàn mới, riêng cho AI Chat. Executor cắt `UsedIpAddresses`/`AvailableIpAddresses` còn tối đa 10 mỗi danh sách (cùng `MaxResults` như mọi tool khác) nhưng giữ nguyên `UsedCount`/`AvailableCount` tính trên toàn bộ trước khi cắt.
    - ⚠️ **Bug đã fix (2026-07-27)**: `JsonOptions` dùng để serialize kết quả tool ban đầu không set `Encoder`, nên `System.Text.Json` mặc định escape **mọi ký tự ngoài ASCII** thành `\uXXXX` — tiếng Việt có dấu trong JSON gửi vào message `"tool"` biến thành kiểu `"MỸ PHƯỚC"`. Model nhỏ (`gemma4:e2b`) đọc thấy dữ liệu tới đã ở dạng escape này rồi **bắt chước luôn định dạng đó** khi viết câu trả lời — kể cả với chữ nó tự bịa ra (không copy từ tool), ví dụ tự viết "Chưa xác định" cũng bị escape thành `"Chưa xác định"` — nên FE hiển thị nguyên `\uXXXX` thay vì chữ có dấu. Đã sửa: thêm `Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping` vào `JsonOptions` — an toàn vì chuỗi JSON này chỉ đi vào `content` (text thuần) của message gửi lại Ollama, **không** bao giờ render thẳng ra HTML nên không có rủi ro XSS khi tắt escaping mặc định.
    - Lưu ý: field bị thiếu (vd `Manager` là `null`) bị `WhenWritingNull` loại hẳn khỏi JSON tool result — model tự paraphrase thành "Chưa xác định" khi không thấy field đó, đây là hành vi hợp lý của model với dữ liệu thật sự trống trong DB, **không phải bug**.
  - ⚠️ **Hạn chế đã biết (2026-07-27), giảm nhẹ chứ chưa triệt để**: model đôi khi **viết lời hứa thay vì thực sự gọi tool** — vd sau khi có `deviceId` từ `search_ip_addresses`, thay vì set `tool_calls` để gọi `get_device_detail` ngay, model chỉ viết text kiểu "Bây giờ tôi sẽ dùng mã này để gọi `get_device_detail`..." rồi kết thúc round mà **không có `tool_calls` thật**. Vòng lặp ở `AiChatService.StreamChatAsync` chỉ đọc trường `tool_calls` có thật để quyết định tiếp tục hay dừng (§1.18 dòng vòng lặp `for (var round...)`), không đọc được ý định trong câu chữ, nên coi round đó là câu trả lời cuối và emit `Done`. Do thiết kế **stateless** (mỗi lượt chỉ nhận lại `history` dạng text hiển thị cho người dùng, không giữ lại tool result nội bộ của lượt trước — xem dòng build `messages` từ `request.History`), lời hứa chưa thực hiện đó bị "đóng băng" vào lịch sử; ở lượt hỏi tiếp theo model chỉ thấy lại lời hứa cũ, không có dữ liệu thật, và có thể tự bịa số liệu để "hoàn thành" thay vì gọi lại tool. Đã thêm đoạn "QUY TẮC BẮT BUỘC KHI CẦN GỌI THÊM TOOL" vào `DefaultSystemPrompt` cấm rõ kiểu trả lời này và cấm khẳng định dữ liệu khi chưa gọi tool thành công — nhưng đây là prompt-level mitigation, **không đảm bảo 100%** vì việc có set `tool_calls` hay không do chính model quyết định ở tầng inference, code phía BE không ép được. Nếu vẫn tái diễn thường xuyên với model hiện tại (`gemma4:e2b`), cân nhắc đổi model lớn hơn hoặc model được huấn luyện tốt hơn cho tool-calling.
  - **Resolve tên→id** (`ResolveDeviceIdByCodeAsync`/`ResolveDeviceTypeIdByNameAsync`/`ResolveBranchIdByNameAsync`, spec §6): gọi lại đúng service `GetPagedAsync`/`GetDevicesForGridAsync` với `Keyword`/`DeviceCode` (Contains), tìm khớp chính xác (`OrdinalIgnoreCase`) trước, không có thì lấy kết quả đầu; rỗng → lỗi `{"error": "Không tìm thấy..."}`.
  - **Giới hạn 10 kết quả/tool**: các tool paged (`search_*`) truyền thẳng `PageSize=10`; 2 tool không phân trang (`get_device_report`, lịch sử change/transfer) tự `.Take(10)` sau khi lấy về.
- **Endpoint**: `AiChatController : BaseController` (chỉ để dùng chung `[Route("api/[controller]")]`, **không** dùng `Success()/Fail()` — response là NDJSON stream ghi trực tiếp vào `Response.Body`, không phải 1 `ApiResponse<T>` duy nhất). Action trả `Task` (không phải `ActionResult`), set `Response.ContentType = "application/x-ndjson"`, ghi từng dòng + `FlushAsync` ngay khi có event. Exception xảy ra **sau khi** đã bắt đầu ghi stream **không được throw** (header đã gửi, `HandleExceptionMiddleware` không set lại status code được nữa) — bọc try/catch quanh toàn bộ vòng `await foreach`, lỗi giữa chừng ghi thành 1 dòng `{"type":"error",...}` rồi kết thúc bình thường thay vì để exception thoát ra ngoài.
- **Cấu hình** `appsettings.json` → `AiChatSettings{OllamaBaseUrl, Model, MaxToolRounds, Temperature, TimeoutSeconds}`. `HttpClient` đăng ký thủ công qua `AddHttpClient<IOllamaChatClient, OllamaChatClient>()` trong `CompanySystem.HostApi/Configurations/DependencyInjection.cs` — **không** được Scrutor tự quét (tên class `OllamaChatClient` kết thúc bằng `Client`, không khớp quy ước `Repository/UnitOfWork/Service` ở CLAUDE.md §3.4 luật 10) nên phải đăng ký tay, kèm `BaseAddress`/`Timeout`.
  - ⚠️ **`Timeout` nâng 120s → mặc định 300s, cấu hình qua `AiChatSettings:TimeoutSeconds`** (2026-07-27). `HttpClient.Timeout` áp cho **toàn bộ** thời gian đọc xong response, không chỉ tới lúc nhận header đầu (dù `OllamaChatClient` dùng `HttpCompletionOption.ResponseHeadersRead`) — 1 câu hỏi cần tới `MaxToolRounds` vòng, mỗi vòng là 1 `SendAsync` riêng (được cấp lại đủ `TimeoutSeconds`), nhưng model cục bộ trả lời dài hoặc máy chạy Ollama đang tải nặng vẫn có thể vượt mốc cũ 120s ở 1 vòng — khi đó `HttpClient` tự hủy nửa chừng, FE nhận lỗi kết nối dù model vẫn đang chạy bình thường. Đây là 1 nguyên nhân của hiện tượng "tool-calling lúc được lúc không": câu hỏi đơn giản (1 vòng, nhanh) luôn ổn, câu hỏi cần nhiều vòng gọi tool nối tiếp thì thỉnh thoảng bị cắt giữa chừng.
- **Permission**: `Asset.AiChat.Use` (migration seed `AddAssetAiChatPermission` bên Identity, **đã apply**, đã gán `Admin`) — cùng pattern migration seed permission với `Asset.AuditTrail.View`.
- **Việc CHƯA làm** (đúng phạm vi spec §10, không mở rộng thêm): rate-limit/quota theo user, log/audit riêng cho AI chat, đổi model/host qua UI thay vì `appsettings`, gửi ảnh (server chỉ có 1 model, không có capability `"vision"` — kiểm tra lại `GET {OllamaBaseUrl}/api/tags` khi cân nhắc làm).
- **Nút xem chi tiết thiết bị + toggle suy luận sâu** (2026-07-27, spec §11): `IAiChatToolExecutorService.ExecuteAsync` đổi kiểu trả về từ `Task<string>` sang `Task<AiChatToolExecutionResult>` (`Json` + `DeviceReferences`) để mang thêm id/mã thiết bị đã resolve ra ngoài mà không lộ vào context gửi Ollama; `AiChatService` phát dòng `{"type":"device"}` (dedupe theo `HashSet<int>` xuyên suốt 1 lượt hỏi) cho 4 tool liên quan thiết bị. `AiChatRequestDto.Think`/`IOllamaChatClient.StreamChatAsync` thêm tham số `think` thay cho hard-code `false` trong `OllamaChatClient`. FE `AiChatBox.tsx` redesign kèm nút "Xem chi tiết" (điều hướng `/pc/devices?id=`, ẩn nếu thiếu `Asset.Device.View`) và toggle "Suy luận sâu".
- **Chuẩn hoá `deviceCode` gõ tắt** (2026-07-27, spec §12): `AiChatToolExecutorService.GetDeviceCodeArg` chạy `deviceCode` đọc từ tool call qua regex `^([A-Za-z]+)[\s_-]*([0-9]+)$` → `"{chữ}-{số}"` trước khi search/resolve — sửa bug gõ `"ydc 9875"` (cách bằng khoảng trắng) không tra ra thiết bị `"ydc-9875"`, thay vì chỉ trông cậy system prompt (§9, model nhỏ không tuân theo ổn định).
- **Model hỏi lại thay vì gọi tool** (2026-07-27, spec §13): bug khác cùng luồng phát hiện SAU khi sửa mục trên — model không hề phát `tool_calls`, chỉ hỏi lại "mã thiết bị chính xác là gì" dù user đã gõ đủ (`"ydc 9875"`). Thêm rule "QUY TẮC KHÔNG HỎI LẠI KHI ĐÃ CÓ MÃ THIẾT BỊ" vào `AiChatService.DefaultSystemPrompt` — prompt-level mitigation, không sửa được ở code vì hệ thống chỉ đọc `tool_calls` thật, không đọc được ý định trong câu chữ (cùng hạn chế đã ghi ở dòng "viết lời hứa thay vì gọi tool" bên trên).
- **Model tự bịa kết quả tra cứu** (2026-07-29, spec §14): phát hiện qua transcript thật — 1 lượt trước model chỉ hứa suông "tôi sẽ tra cứu ngay bây giờ" (không `tool_calls`) → hứa đó bị commit vào history (vì `AiChatMessageDto` không có role `tool`, FE không lưu/gửi lại tool result); lượt sau model đọc lại lời hứa của chính nó và **tự bịa** số liệu ("IP là 10.20.30.150") thay vì gọi tool thật, lặp lại vài lượt liền cho tới khi user vặn thẳng. Sửa 2 lớp trong `AiChatService.cs`: (1) thêm rule "QUY TẮC KHÔNG BỊA KẾT QUẢ TRA CỨU" vào `DefaultSystemPrompt`; (2) `UnfulfilledPromisePattern` (regex bắt các cụm hứa suông tiếng Việt: "sẽ thực hiện/tra cứu/kiểm tra/gọi", "ngay bây giờ", "trong giây lát", "xin chờ", "để tôi kiểm tra/tra cứu") — nếu tin nhắn **cuối cùng** trong `request.History` là `role: assistant` và khớp regex này, tự động chèn 1 tin nhắn `role: "system"` nhắc model trước khi gọi Ollama lại, thay vì chỉ trông cậy prompt gốc. Vẫn là mitigation, không chặn 100% được mọi cách diễn đạt hứa suông khác hoặc bịa ngay trong round đầu tiên.

## 2. DTOs (`Asset.Application/Dtos/`)
- **Master data** (Branches/Suplliers/DeviceTypes/SoftwareGroups): `{Entity}Dto`(Id/Code/Name), `Create...`(+`[Required]`), `Update...`.
- **DeviceGroups**: `DeviceGroupDto`(+`DepartmentId`/`DepartmentName`), `Create/UpdateDeviceGroupDto`(`DepartmentId[Required]`+Code/Name).
- **DeviceDepartments**: cùng khuôn master.
- **Devices**:
  - `DeviceFilterRequest`: `PageIndex=1`, `PageSize=50`, filter `DeviceCode/Manager/SupplierName`(Contains), `PurchaseDate`(parse rồi so `.Date ==`, không phải Contains chuỗi — 2026-07-30, tránh `CONVERT` non-sargable), `IpAddress?`/`Email?`(Contains any), `GroupId?`/`DepartmentId?`/`BranchId?`/`DeviceTypeId?`(exact), `Note`(Contains), `IsOutsourced?`/`IsUseUsb?`(exact), `SerialNumber?`(Contains), `Status?`(exact, enum `DeviceStatus`), `ExpiryDate?`(`ExpirationDate <= ExpiryDate`), `SortDeviceCodeAscending?`(null→`OrderByDescending(PurchaseDate)`; true/false→theo `DeviceCode`).
    `BranchId/DeviceTypeId/Status/ExpiryDate` thêm 2026-07-30 (trước đó FE lọc 4 field này bằng cách tải `PageSize=5000` về rồi tự lọc ở client — chậm ~1.7s/request và sai khi DB vượt 5000 thiết bị).
  - `DeviceGridDto`: tên Branch/Supplier/DeviceType + `GroupName?`/`DepartmentName?` + `IpAddresses:List<string>`/`Emails:List<string>` + `StatusText` + `IsOutsourced`/`SerialNumber?`/`IsUseUsb`.
  - `DeviceDto`: tên + `GroupId?/GroupName?/DepartmentId?/DepartmentName?` + `StatusText` + `IpAddresses:List<DeviceIpAddressDto>` + `Emails:List<DeviceEmailDto>` + `ExpirationDate` + `SerialNumber?/IsUseUsb` + `SuggestedNewDeviceId?/SuggestedNewDeviceCode?`.
  - `Create/UpdateDeviceDto`: `DeviceCode/DeviceName[Required]`, `DeviceTypeId/SupplierId/BranchId[Required]`, `GroupId?/DepartmentId?`(validate khi có), `Manager`(tuỳ chọn, mặc định `""` — máy chưa dùng thì chưa biết ai quản lý), `Emails`(tuỳ chọn, cho phép rỗng), `PurchaseDate[Required]`, `DepreciationMonths[Required][Range(1,600)]`, `IsOutsourced`, `Status[Range(0,3)]`, `Note[Required]`(2026-08-01 — bắt buộc thay cho Manager/Emails, giải thích tình trạng máy khi chưa gán người dùng), `IpAddressIds:List<int>`, `SerialNumber?[StringLength(100)]`, `IsUseUsb`, `SuggestedNewDeviceId?`. **Không có** `ExpirationDate`.
  - `DeviceIpAddressDto`(Id/IpAddress), `DeviceEmailDto`(Id/Email/Note), `DeviceEmailInputDto`(Email/Note).
  - Báo cáo: `DeviceReportFilterRequest`(`DeviceTypeId?/BranchId?/Keyword?`), `DeviceReportItemDto` (§1.7, `IpAddress` là `string?` nối `", "`).
  - Thống kê dashboard (§1.7b): `DeviceReportSummaryDto`(`TotalCount/InUseCount/PendingUseCount/ExpiringSoonCount` + `BranchDistribution/DeviceTypeDistribution:List<DeviceReportDistributionItemDto>` + `ExpiringDevices:List<DeviceReportExpiringItemDto>`), `DeviceReportDistributionItemDto`(`Label/Count`), `DeviceReportExpiringItemDto`(`Id/DeviceCode/DeviceName/BranchName/Manager/ExpirationDate/DaysRemaining`).
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
| Device | `/api/Device` | grid-list, `available`, {id}, `{id}/detail`, `{id}/replacement-suggestion`, `qr-labels`(§1.16, POST), POST, PUT, DELETE(mềm), `bulk-delete`(§1.15). **Không** `all` | `Asset.Device.*` |
| AssetSetting | `/api/AssetSetting` | GET, PUT (1 dòng) | `Asset.Setting.View/.Update` |
| Report | `/api/Report` | `device-list`, `device-summary`(§1.7b, 2026-07-30) | `Asset.Report.View` |
| DeviceType | `/api/DeviceType` | CRUD | `Asset.DeviceType.*` |
| Supplier | `/api/Supplier` | CRUD | `Asset.Supplier.*` |
| DeviceSoftware | `/api/DeviceSoftware` | GetByDevice, POST, PUT, DELETE, `picker/{deviceId}`, `sync`(PUT) | `Asset.DeviceSoftware.*` (picker→View, sync→Update) |
| Software | `/api/Software` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.Software.*` |
| SoftwareGroup | `/api/SoftwareGroup` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.SoftwareGroup.*` |
| IpAddress | `/api/IpAddress` | grid-list, `available`, {id}, PUT{id}(Status+Note), `bulk-status`(§1.2b), `{id}/assign`, `{id}/unassign`. **Không** POST/DELETE/all/generate-range | `Asset.IpAddress.View/.Update/.Assign` |
| IpPrefix | `/api/IpPrefix` | grid-list, all, {id}, POST(254 IP), PUT(BranchId+mạng), DELETE(cascade) | `Asset.IpPrefix.View/.Create/.Update/.Delete` |
| DeviceConfiguration | `/api/DeviceConfiguration` | `by-device/{deviceId}`(null nếu chưa có), POST, PUT, DELETE(cứng), `{configId}/initial`, `initial/{id}`(DELETE), `{configId}/history`. **Không** grid-list/all | `Asset.DeviceConfiguration.*` |
| TransferHistory | `/api/TransferHistory` | POST(chuyển máy), `device/{deviceId}`. **Không** PUT/DELETE | `Asset.TransferHistory.Create/.View` |
| DeviceImport | `/api/DeviceImport` | `preview`, `confirm` | `Asset.Device.Create` |
| DeviceConfigurationImport | `/api/DeviceConfigurationImport` | `preview`, `confirm`, `missing-devices-report`(§1.10a, trả file .xlsx) | `Asset.DeviceConfiguration.Update` |
| DeviceLiquidationImport | `/api/DeviceLiquidationImport` | `preview`, `confirm` (§1.10b, thanh lý hàng loạt theo mã máy) | `Asset.Device.Update` |
| AuditTrail | `/api/AuditTrail` | `grid-list`(phân trang+filter), `record?tableName=&recordId=`. **Không** POST/PUT/DELETE (ghi tự động qua `SaveChangesAsync`, §1.17) | `Asset.AuditTrail.View` |
| AiChat | `/api/AiChat` | `stream`(POST, NDJSON, §1.18). Chỉ 1 endpoint | `Asset.AiChat.Use` |

**Pattern service mẫu để nhân bản:**
- **CRUD chuẩn** → `BranchService` (soft-delete, check trùng code, `OrThrowNotFound`, `ToPagedResponseAsync`, `GetAllActiveAsync` dùng `SelectAsync`).
- **Grid filter động** → `DeviceService.GetDevicesForGridAsync` (`GetQueryable(false, ...includes)`, `.Where(!IsDeleted)`, nối filter, sort, `ToPagedResponseAsync`).
- **Khoá kép** → `DeviceSoftwareService` (`FirstOrDefaultAsync(DeviceId&&SoftwareId)`, xóa cứng).
- **CRUD FK bắt buộc** → `SoftwareService` (`.Include(SoftwareGroup)`, validate `SoftwareGroupId` + `OrThrowNotFound`).
- **Read-only + Update hạn chế + assign/unassign** → `IpAddressService`. `StatusText`/`DeviceCode`="Khác" trong `Expression` phải viết ternary (EF→SQL, không gọi method C#).
- **Master tự sinh/dọn record con** → `IpPrefixService` (`Enumerable.Range` build 254 IP — `.1..254`, bỏ `.0`/`.255`, `AddRangeAsync` 1 lần; `DeleteAsync` cascade soft-delete).
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
| `UpdateIpAddressStatusRemoveServerIp` (backfill Status enum 3 trạng thái, drop `ServerIP`) | **Đã apply** (xác nhận lại qua `dotnet ef migrations list` trên DB thật, 2026-07-27) |
| `AddAssetSetting` (seed `LiquidationAfterMonths=2`) | **Đã apply** (xác nhận lại 2026-07-27) |

Ngoài ra: dữ liệu `Software`/`SoftwareGroup` đã sửa qua API CRUD (32 group + 95 software) — không phải migration.

**~~Bug đã biết (chưa fix)~~ — ĐÃ FIX 2026-07-27**: check trùng mã ở master data có 2 lỗi, và lỗi nằm ở **7 service** chứ không riêng `SoftwareGroupService` như ghi nhận trước đó (`Branch`, `DeviceType`, `Supplier`, `SoftwareGroup`, `Software`, `DeviceDepartment`, `DeviceGroup`):
1. **Lọc `&& !x.IsDeleted`** trong khi unique index của DB **không** filter `IsDeleted` → tạo lại mã đã xoá mềm thì app cho qua, SQL chặn, ra **500 "A database error occurred."** thay vì 400 dễ hiểu. (`DeviceService` từ đầu đã đúng — không lọc `IsDeleted`.)
2. **Guard `if (entity.Code != request.Code)`** so ordinal case-sensitive trong C# còn SQL collation case-insensitive → đổi mã chỉ khác hoa/thường (`of` → `OF`) lọt vào nhánh check, tìm thấy chính nó, báo 400 "đã tồn tại".

Cách sửa (áp dụng đồng loạt): bỏ `!IsDeleted` khỏi truy vấn, `UpdateAsync` loại chính mình bằng `x.Id != request.Id`, rồi gọi `GuardExtensions.ThrowIfDuplicateCode(...)` — helper mới ở `Shared.Core/Exceptions/GuardExtensions.cs` giữ toàn bộ lời giải thích ở 1 chỗ và tự phân biệt message "đã tồn tại" vs "đang thuộc một bản ghi đã xóa nên không dùng lại được". Xem [architecture-core.md §6](architecture-core.md).

> ⚠️ **Chưa có API khôi phục bản ghi đã xoá mềm.** Sau khi fix, người dùng nhận được message rõ ràng nhưng vẫn *không* dùng lại được mã cũ. Nếu nghiệp vụ cần tái sử dụng mã, phải bổ sung chức năng "Khôi phục" (action `Restore` đã có sẵn trong `AuditTrail` §1.17) — cần chốt với người yêu cầu trước (CLAUDE.md §2 luật 2).

## 6. Cần làm tiếp
1. ~~**AuditTrail**: chưa có Application/Api.~~ Đã xong (§1.17, 2026-07-16), migration `AddAssetAuditTrailPermission` (Identity) cũng đã apply — permission `Asset.AuditTrail.View` đã có hiệu lực (xác nhận lại 2026-07-27).
2. **Auth**: xong `[RequirePermission]`. Admin cần gán permission cho role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` — **chưa làm, cần chốt danh sách quyền cho từng role với người yêu cầu** (thao tác trên DB thật, không tự quyết).
3. ~~**Warning** `CS8602/8603/8604` (null deref/return) trong Service.~~ Đã xong 2026-07-27: `Asset.Application` từ **78 → 0 warning**. Nguyên nhân chính là gọi `OrThrowNotFound` mà **bỏ giá trị trả về** (56 chỗ) → đã gộp thành `var x = (await ...).OrThrowNotFound(...)`; 3 chỗ còn lại là include selector navigation nullable (`x => x.Device!`). Giữ nguyên quy ước này khi viết service mới, xem [architecture-core.md §6](architecture-core.md).
4. **Field ngoài phạm vi Device** — mục "Email 2/3" **không còn nữa** (đã thay bằng bảng `DeviceEmails` nhiều email, §1.6). Chỉ còn **Sticky Notes** chưa làm, cần hỏi trước (CLAUDE.md §2 luật 2).
5. ~~**`SoftwareGroupService` case-collation bug**~~ Đã fix 2026-07-27 cho cả 7 service (§5).
6. **Khôi phục bản ghi đã xoá mềm** — chưa có API, xem cảnh báo cuối §5.
7. **AI Chat FE** — đã dựng lại 2026-07-27 (`yev-frontend/src/modules/ai-chat/`, route `/pc/ai-chat`, menu gated bằng `Asset.AiChat.Use`). Câu trả lời render **markdown** qua `react-markdown` + `remark-gfm` (`MarkdownMessage.tsx`) — cố ý **không** cài `rehype-raw` để model không chèn được HTML thô (XSS); Tailwind v4 reset hết style thẻ và dự án không có `@tailwindcss/typography` nên class từng thẻ khai báo tay trong `components`. **Chưa chạy thử end-to-end** với Ollama thật (`AiChatSettings.OllamaBaseUrl = http://10.45.6.70:11434`, model `gemma4:e2b`).

## 7. Checklist thêm entity mới
Đọc core + file này (nghiệp vụ mới chưa rõ → **hỏi trước** CLAUDE.md §2 luật 2) → entity `partial class` + `IsDeleted` → DbSet + Fluent (constraint tiếng Việt) → `I<Entity>Repository`+impl rỗng + property vào `IAssetUnitOfWork`+`AssetUnitOfWork` → DTOs (`Create/Update`+DataAnnotations tiếng Việt) → Service `: BaseService<IAssetUnitOfWork>` (Scrutor tự DI) → Controller `: BaseController` + route pattern §4 + `[RequirePermission(...)]` (không cần chỉnh Program.cs) + thêm mã permission vào migration seed + gán `Admin` → migration `dotnet ef migrations add <Name> --project Asset.Infrastructure --startup-project CompanySystem.HostApi` → cập nhật §4/§5 doc này.
