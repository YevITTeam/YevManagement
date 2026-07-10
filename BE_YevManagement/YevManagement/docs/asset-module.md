# asset-module.md — Module Asset (Quản lý Thiết bị / PC)

> **Trạng thái:** ĐANG PHÁT TRIỂN. Đã có nền CRUD cho hầu hết thực thể (Branch,
> DeviceType, Supplier, Software, SoftwareGroup, DeviceSoftware, IpAddress,
> IpPrefix, Device, DeviceConfiguration, TransferHistory); còn AuditTrail chưa có
> Application/Api. Đọc [architecture-core.md](architecture-core.md) trước. Tài
> liệu cho đội FE (request/response mẫu, luật nghiệp vụ ảnh hưởng UI):
> [asset-api-fe.md](asset-api-fe.md).

- **DB:** `YevPCManagement` (connection string `PCManagementConnection`).
- **DbContext:** `AssetDbContext` (`Asset.Infrastructure/Context/`).
- **Đặc điểm:** DB scaffold từ hệ thống cũ → tên bảng/cột/constraint bằng **tiếng
  Việt** (ví dụ entity `Device` → `PK_ThietBis`, `IX_ThietBis_MaMay`). Giữ đúng
  quy ước đặt tên này khi map entity mới.

---

## 1. Domain Models (`Asset.Domain/Entities/`)

| Entity | Thuộc tính chính | Quan hệ | Soft delete |
|---|---|---|---|
| `Device` | `DeviceCode`(unique), `DeviceName`, `DeviceTypeId`, `SupplierId`, `BranchId`, `Manager`, `Email`, `PurchaseDate`, `DepreciationMonths`, `ExpirationDate?`(**tính toán**, không nhập tay — xem ghi chú bên dưới), `IsOutsourced`, `Status`, `Note?`, `SerialNumber?`(unique khi có giá trị), `IsUseUsb` | N-1 Branch/DeviceType/Supplier; 1-1 DeviceConfiguration; 1-N IpAddresses (0..1 IP "chính"/device qua `DeviceService`), DeviceSoftwares, TransferHistory(old/new) | **Có** |
| `Branch` | `BranchCode`(unique), `BranchName` | 1-N Devices | **Có** |
| `Supplier` | `SupplierCode`(unique), `SupplierName` | 1-N Devices | **Có** |
| `DeviceType` | `TypeCode`(unique), `TypeName` | 1-N Devices | **Có** |
| `IpAddress` | `IpAddress1`(unique **toàn cục**, cột `IpAddress`), `ServerIp?`, `DeviceId?`, `IpPrefixId`(bắt buộc), `Status`, `Note?` | N-1 Device (nullable), N-1 IpPrefix (**bắt buộc**) | **Có** |
| `IpPrefix` | `Prefix`(unique **toàn cục**, vd `10.45.1`), `SubnetMask?`, `Gateway?`, `PreferredDns?`, `AlternateDns?`, `Description?` | 1-N IpAddress | **Có** |
| `DeviceConfiguration` | Cấu hình phần cứng: `Cpu/Ram/HardDrive/Os/Vga/Mainboard/Monitor/Mouse/Keyboard/Headphone/Speaker/Ups/Psu` + `Maker/Model/PowerAdapter/WirelessCard/Nic/Other`(cột viết hoa CPU/RAM/OS/VGA/UPS/PSU/NIC...), `Note?` | 1-1 Device (`DeviceId` unique); 1-1 DeviceConfigurationInitial; 1-N DeviceConfigurationHistory | Không |
| `DeviceConfigurationInitial` | Snapshot **bất biến** 20 field linh kiện y hệt `DeviceConfiguration` + `CreatedAt` | 1-1 DeviceConfiguration (`DeviceConfigurationId` unique) | Không (xoá cứng qua action riêng) |
| `DeviceConfigurationHistory` | Snapshot 20 field linh kiện tại thời điểm sửa + `EditedAt`, `EditedBy` | N-1 DeviceConfiguration | Không (không có API xoá — audit log) |
| `DeviceSoftware` | **Khoá kép** `(DeviceId, SoftwareId)`, `InstallDate`, `LicenseKey?` | N-1 Device, N-1 Software | Không |
| `Software` | `SoftwareCode`(unique), `SoftwareName`, `SoftwareType?`, `Publisher?`, `SoftwareQuantity?`, `SoftwarePriority?`, `SoftwareGroupId` | N-1 SoftwareGroup, 1-N DeviceSoftwares | **Có** |
| `SoftwareGroup` | `GroupCode`(unique), `GroupName` | 1-N Softwares | **Có** |
| `TransferHistory` | `OldDeviceId`, `NewDeviceId`, `TransferDate`, `Note?` | N-1 OldDevice/NewDevice (DeleteBehavior.ClientSetNull) | Không |
| `AuditTrail` | `Id(long)`, `TableName`, `RecordId`, `Action`, `OldValues?`, `NewValues?`, `ChangedBy`, `ChangedAt` | — (namespace `Asset.Domain.Models`) | Không |

> `DeviceSoftware` dùng **khoá chính kép** — không có `Id` đơn. Repo/service phải
> tìm bằng cả `DeviceId + SoftwareId` (dùng `FirstOrDefaultAsync`, không dùng `GetByIdAsync`).

> **`IpAddress.Status` (int)** có ý nghĩa cố định qua enum `IpAddressStatus`
> (`Asset.Domain/Enums/IpAddressStatus.cs`, enum Domain đầu tiên của project):
> `0=Available` (chưa gán), `1=Assigned` (đã gán `DeviceId`), `2=Reserved` (giữ chỗ),
> `3=Disabled` (ngưng dùng). `IpAddressService` tự derive Status theo `DeviceId`
> (có `DeviceId` → luôn `Assigned`; gỡ `DeviceId` → luôn `Available`) — không cho
> client tự đặt `Assigned` khi chưa có `DeviceId`. Lưu ý: dữ liệu cũ backfill từ
> trước khi có rule này có thể còn vài dòng `Status` không khớp `DeviceId` (chưa
> retroactive fix, chỉ áp dụng cho Create/Update mới).
>
> **Unique index `IX_DiaChiIPs_DiaChi` trên `IpAddress1` và `IX_TienToIPs_TienTo`
> trên `IpPrefix.Prefix` đều là unique toàn cục, không lọc `IsDeleted`.** Mọi kiểm
> tra trùng lặp (Create/Update) phải so khớp trên **toàn bộ bản ghi** kể cả đã
> soft-delete, không chỉ lọc `!IsDeleted` (khác với phần lớn entity khác trong module).
>
> **Chuẩn hoá IpAddress → IpPrefix (2026-07-08):** trước đây `SubnetMask/Gateway/
> PreferredDNS/AlternateDNS` nằm trực tiếp, lặp lại trên từng dòng `IpAddress`. Đã
> tách sang bảng `IpPrefixes` riêng (mỗi dòng = 1 subnet 3-octet, vd `10.45.1`),
> `IpAddress` tham chiếu qua `IpPrefixId` bắt buộc — sửa `SubnetMask/Gateway/DNS`
> ở 1 `IpPrefix` tự "cascade" hiển thị cho toàn bộ IP con qua JOIN, không cần
> bulk-update từng dòng. Migration `AddIpPrefix`
> (`Asset.Infrastructure/Migrations/20260708031004_AddIpPrefix.cs`) đã **backfill
> và apply lên DB thật**: 27 `IpPrefix` (group theo 3 octet đầu của 6885 `IpAddress`
> hiện có) + DROP 4 cột cũ trên `IpAddresses`. Trạng thái schema hiện tại: đã chạy
> xong, không cần backfill lại.
>
> **Tạo `IpPrefix` mới tự động sinh luôn 255 `IpAddress` con** (`n=1..255`,
> `Status=Available`) trong cùng 1 lần gọi `IpPrefixService.CreateAsync` — không
> còn action `generate-range` riêng trên `IpAddressController` (đã gộp vào đây).
> Xoá `IpPrefix` bị chặn (`DomainException`) nếu còn `IpAddress` con `!IsDeleted`.

> **`Device.Status` (int)** có ý nghĩa cố định qua enum `DeviceStatus`
> (`Asset.Domain/Enums/DeviceStatus.cs`): `0=PendingUse` (Chờ sử dụng, 694 thiết bị
> tại thời điểm map), `1=InUse` (Đang sử dụng, 2414), `2=PendingLiquidation` (Chờ
> thanh lý, 2094), `3=Liquidated` (Đã thanh lý, **mới thêm**, 0 thiết bị hiện tại —
> dữ liệu cũ chỉ có 0/1/2, `3` an toàn để dùng cho nghiệp vụ mới).
>
> **`Device.ExpirationDate` là field TÍNH TOÁN (2026-07-08)**: server luôn set
> `ExpirationDate = PurchaseDate.AddMonths(DepreciationMonths)` trong
> `DeviceService.CreateAsync`/`UpdateAsync` — DTO Create/Update **không nhận**
> `ExpirationDate` từ client, chỉ nhận `DepreciationMonths`. Migration
> `AddDeviceFields` (`Asset.Infrastructure/Migrations/20260708042916_AddDeviceFields.cs`)
> đã backfill `DepreciationMonths = DATEDIFF(MONTH, PurchaseDate, ExpirationDate)`
> cho 5202 thiết bị thật (khớp chính xác 100%, chỉ 2 giá trị 60/48 tháng) và
> `IsOutsourced = false` mặc định cho toàn bộ — đã apply lên DB thật.
>
> **Chọn/gán IP cho Device**: `Device` 1-N `IpAddress` nhưng UI chỉ thao tác **1 IP
> chính/device** (thực tế 2131/2131 device có IP thì chỉ 27 có >1 IP). Create/Update
> Device nhận `IpAddressId?` (Id của 1 `IpAddress` đang `Status=Available`) —
> `DeviceService` tự gán/gỡ `IpAddress.DeviceId`+`Status` tương ứng (đổi IP → IP cũ
> tự gỡ về `Available`; xoá Device → mọi IP đang gắn tự gỡ về `Available`). **Danh
> sách "IP chưa dùng" để chọn** có 2 cách: `GET /api/IpAddress/grid-list?status=0&keyword=`
> (có phân trang, dùng cho bảng/picker lớn) hoặc `GET /api/IpAddress/available?keyword=`
> (2026-07-09, mới thêm — trả thẳng `List<IpAddressDto>` không phân trang, sort theo
> `IpAddress` A-Z, dùng cho dropdown/picker gọn không cần trang).

> **Báo cáo "DANH SÁCH DESKTOP TOÀN CÔNG TY" (2026-07-09, đã làm)**:
> `GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=` (controller
> riêng `ReportController`, **không** nằm trong `DeviceController` — để sau này
> gom chung các loại báo cáo khác như "Thống kê phần mềm"/"Thống kê tổng số thiết
> bị toàn công ty" cùng dưới `/api/Report/*`) trả thẳng
> `List<DeviceReportItemDto>` (**không phân trang** — dùng cho in ấn/export, khác
> `grid-list`), gồm `Stt` (đánh số lại theo kết quả trả về, `OrderBy(DeviceCode)`),
> `DeviceCode`, `DeviceName`, `IpAddress` (IP chính), `PurchaseDate`,
> `ExpirationDate`, `IsExpired` (bool, `ExpirationDate < hôm nay UTC` — tương ứng
> cột "O/X" trong báo cáo giấy, FE tự chọn ký hiệu hiển thị), `FinancialPeriod`
> (int?, xem công thức bên dưới), `Note`. Filter đều optional: không truyền gì
> = toàn bộ Device active.
>
> **Công thức "Kỳ tài chính" (`FinancialPeriod`)**: tính từ `ExpirationDate`
> (Hạn sử dụng/Hạn S/D), **không phải** `PurchaseDate`. Năm tài chính Yazaki chạy
> **1/7 → 30/6 năm sau** (không theo năm dương lịch), đánh số liên tục từ năm
> thành lập Yazaki Corporation (1941, kỳ 1 = FY1941–1942):
> ```
> fiscalYearStartYear = ExpirationDate.Month >= 7 ? ExpirationDate.Year : ExpirationDate.Year - 1
> FinancialPeriod = fiscalYearStartYear - 1940
> ```
> Đã verify khớp 100% với báo cáo giấy gốc (vd `Hạn S/D=01-Oct-2026` → kỳ 86,
> `09-Nov-2020` → kỳ 80, `31-Aug-2028` → kỳ 88). Field này **không lưu DB**, chỉ
> tính on-the-fly trong `DeviceService.GetReportListAsync` — công thức được viết
> lặp lại trực tiếp trong `Expression<Func<>>` (giống `StatusText`) vì EF dịch
> sang SQL, không gọi được method C# tuỳ ý.
>
> Endpoint này dùng repository method mới `IGenericRepository<T>.ToListAsync(query,
> selector)` (thêm ở `Shared.Application`/`Shared.Infrastructure`, xem
> [architecture-core.md](architecture-core.md) §1) — materialize `IQueryable` đã
> filter/`OrderBy` động thành `List<TResult>` **không phân trang**, khác
> `ToPagedResponseAsync`.

> **"Chuyển máy" — `TransferHistory` (2026-07-09, đã làm)**:
> `POST /api/TransferHistory` (`CreateTransferHistoryDto`: `OldDeviceId`/
> `NewDeviceId` `[Required]`, `Note?`) thực hiện **1 hành động nghiệp vụ tổng hợp**
> qua `TransferHistoryService.TransferAsync`, không phải CRUD tạo bản ghi đơn
> thuần:
> 1. Validate `OldDeviceId != NewDeviceId` (`DomainException` nếu trùng), cả 2
>    Device phải tồn tại (`OrThrowNotFound`).
> 2. **Chuyển IP chính**: IP đang gắn `OldDevice` (nếu có) → gán sang `NewDevice`.
>    Nếu `NewDevice` đang có sẵn 1 IP khác → IP đó tự gỡ về `Available` trước (đúng
>    ràng buộc "1 IP không được gắn nhiều thiết bị" — logic giống hệt cách
>    `DeviceService.UpdateAsync` đổi `ipAddressId`, viết lại trực tiếp trong
>    `TransferHistoryService` vì cả 2 dùng chung `IAssetUnitOfWork`, không gọi
>    chéo sang `IpAddressService`).
> 3. **Chuyển phần mềm cài (`DeviceSoftware`)**: đổi `DeviceId` của từng dòng từ
>    `OldDevice` sang `NewDevice` (move, không phải copy — giữ nguyên
>    `InstallDate`/`LicenseKey` cũ). Nếu `NewDevice` **đã cài sẵn** đúng phần mềm
>    đó rồi (trùng khoá kép `DeviceId+SoftwareId`) → giữ bản ghi bên `NewDevice`,
>    xoá cứng bản ghi cũ bên `OldDevice` (tránh vi phạm khoá kép).
> 4. **Đổi trạng thái `OldDevice`**: mặc định chuyển `PendingUse` (0, "Chờ sử
>    dụng") — **trừ khi** `OldDevice.ExpirationDate` đã qua (dùng đúng công thức
>    `IsExpired` ở báo cáo `device-list` bên trên) thì chuyển thẳng
>    `PendingLiquidation` (2, "Chờ thanh lý") thay vì `PendingUse`.
> 4b. **Đổi trạng thái `NewDevice` → `InUse`** (1, "Đang sử dụng", 2026-07-10, đã
>    làm) — máy mới đã tiếp nhận IP + phần mềm của máy cũ nên tự động chuyển sang
>    "Đang sử dụng" ngay khi transfer xong, không cần gọi `PUT /api/Device/{id}`
>    riêng để đổi status thủ công.
> 5. `DeviceConfiguration` **không đụng tới** — chủ ý không copy sang `NewDevice`
>    (cấu hình phần cứng là đặc thù theo từng máy vật lý, máy mới có config
>    riêng), cũng không xoá ở `OldDevice`.
> 6. Tạo 1 dòng `TransferHistory` (`TransferDate = DateTime.UtcNow`) ghi nhận
>    `OldDeviceId`/`NewDeviceId`/`Note`. **Không có API sửa/xoá `TransferHistory`**
>    (audit-log, giống `DeviceConfigurationHistory` — chỉ tạo qua hành động
>    nghiệp vụ, không cho client POST/PUT/DELETE trực tiếp).
>
> **Chọn máy mới để chuyển (2026-07-10, đã làm)**: `GET /api/Device/available?keyword=`
> (`DeviceService.GetAvailableForTransferAsync`, cùng pattern
> `IpAddressService.GetAvailableAsync` — không phân trang, trả `List<DeviceGridDto>`)
> trả toàn bộ Device `Status=PendingUse` (0, "Chờ sử dụng") và `!IsDeleted`, lọc
> theo `DeviceCode.Contains(keyword)` nếu có. Dùng để FE hiển thị danh sách máy
> "chưa dùng" cho người dùng chọn làm `NewDeviceId` khi gọi
> `POST /api/TransferHistory`.
>
> `GET /api/TransferHistory/device/{deviceId}` trả `List<TransferHistoryDto>` —
> lịch sử chuyển máy liên quan tới 1 Device (dù là vai trò máy cũ hay máy mới),
> sort `TransferDate` mới nhất trước. Đã test thật trên DB (tạo thiết bị TEST,
> gán IP/phần mềm, chuyển máy, verify IP/phần mềm/status đúng cả 2 kịch bản hết
> hạn/chưa hết hạn + case trùng Id bị từ chối 400, rồi soft-delete thiết bị TEST
> — riêng dòng `TransferHistory` test không xoá được vì thiết kế không có API
> xoá, chấp nhận còn lại vài dòng tham chiếu thiết bị đã soft-delete).

> **Import Device hàng loạt từ Excel (2026-07-10, đã làm)**: theo đúng file mẫu
> Excel hiện có của người dùng (8 cột theo đúng thứ tự: `MQL`, `Xưởng`, `Loại
> Thiết Bị`, `Nhà Cung Cấp`, `Ngày Mua`, `Ghi Chú`, `Số SerialNumber`, `MQL Cũ`;
> dòng 1 là header). Quy trình 2 bước — **bắt buộc xem trước khi ghi DB** theo
> yêu cầu người dùng:
>
> **Định dạng cột "Ngày Mua"**: nếu ô Excel là **kiểu Date thật** (không phải
> text) thì đọc trực tiếp, không phụ thuộc cách hiển thị. Nếu ô là text,
> `ParseExcel`/`TryParsePurchaseDate` chỉ nhận cố định vài định dạng
> (`dd/MM/yyyy`, `d/M/yyyy`, `dd-MM-yyyy`, `d-M-yyyy`, `yyyy-MM-dd`) qua
> `DateTime.TryParseExact` + `CultureInfo.InvariantCulture` — **cố ý không dùng**
> `DateTime.TryParse` theo culture mặc định của server (dễ hiểu nhầm ngày/tháng
> tuỳ môi trường chạy). Định dạng khác hoặc ô trống → dòng đó báo lỗi "Thiếu
> hoặc sai định dạng Ngày Mua", không có giá trị mặc định.
> 1. `POST /api/DeviceImport/preview` (`multipart/form-data`, field `file`) —
>    `DeviceImportService.PreviewAsync` đọc file bằng `ClosedXML`
>    (`Asset.Application` thêm package `ClosedXML` 0.105.0), parse từng dòng,
>    validate + resolve tên → Id (không đụng DB, chỉ đọc), trả
>    `DeviceImportPreviewResultDto { Rows: List<DeviceImportRowDto>, TotalRows,
>    ValidRows, InvalidRows }`. Mỗi `DeviceImportRowDto` có `IsValid`/`Errors`
>    (tiếng Việt, theo từng dòng) để FE hiển thị bảng preview trước khi người
>    dùng bấm xác nhận import.
> 2. `POST /api/DeviceImport/confirm` (`ConfirmDeviceImportDto { Rows }` — FE gửi
>    lại đúng field thô của các dòng đã xem ở bước 1, **không gửi Id đã resolve**
>    vì server luôn tự tra lại theo tên, không tin Id từ client) —
>    `DeviceImportService.ConfirmAsync` **validate lại từ đầu** theo dữ liệu DB
>    tại thời điểm confirm (phòng race condition giữa lúc xem preview và lúc bấm
>    xác nhận) — nếu còn dòng lỗi thì **không ghi gì cả**, ném `DomainException`
>    kèm `Errors` là danh sách `"Dòng {n}: {lý do}"` (dùng constructor mới
>    `DomainException(message, List<string> errors)` thêm ở `Shared.Core`, map
>    thẳng vào `ApiResponse.Failure.Errors` qua middleware chung). Nếu toàn bộ
>    hợp lệ, chạy trong 1 `_unitOfWork.BeginTransactionAsync()`/
>    `CommitTransactionAsync()` (rollback nếu có lỗi giữa chừng — atomic cả
>    batch), với từng dòng:
>    - Gọi thẳng `IDeviceService.CreateAsync` (tái dùng nguyên logic tạo Device
>      đã có, không viết lại) với `DeviceCode`/`SerialNumber`/`Note`/`PurchaseDate`
>      lấy từ Excel, còn các field **`[Required]` mà Excel không có** thì theo
>      đúng quyết định người dùng (2026-07-10): `DeviceName` = lấy theo `MQL`,
>      `Manager`/`Email` để trống, `DepreciationMonths` mặc định **60 tháng**
>      (hằng số `DefaultDepreciationMonths` trong `DeviceImportService`) —
>      `Status` mặc định `PendingUse`. Cần sửa lại tay qua màn hình Device sau
>      nếu thiếu thông tin.
>    - Nếu dòng có `MQL Cũ` (thiết bị bị thay thế): gọi thẳng
>      `ITransferHistoryService.TransferAsync` (tái dùng 100% nghiệp vụ "chuyển
>      máy" đã có ở §1 — chuyển IP chính + phần mềm từ máy cũ sang máy vừa tạo,
>      đổi trạng thái máy cũ theo hạn sử dụng, tạo dòng `TransferHistory`) theo
>      đúng quyết định người dùng, **không** viết logic thay thế riêng.
>
> **Validate/resolve từng dòng** (`DeviceImportService.ValidateAndResolveRowsAsync`,
> dùng chung cho cả `preview` và `confirm`): `Xưởng`/`Loại Thiết Bị`/`Nhà Cung
> Cấp` là **tên** (không phải mã) → so khớp case-insensitive với
> `Branch.BranchName`/`DeviceType.TypeName`/`Supplier.SupplierName` đang
> `!IsDeleted`; theo đúng quyết định người dùng, **không tự tạo mới** — không
> khớp thì báo lỗi dòng đó, chặn import. Tương tự `MQL Cũ` phải khớp đúng 1
> `Device.DeviceCode` (`!IsDeleted`) đang có sẵn. Các lỗi khác được kiểm: thiếu
> `MQL`/`Ngày Mua`, `MQL`/Serial trùng trong chính file đang import, `MQL`/Serial
> đã tồn tại trong DB, `MQL Cũ` trùng `MQL` mới, `MQL Cũ` bị dùng thay thế ở
> nhiều dòng trong cùng file.
>
> **Chưa làm / giới hạn đã biết**: chưa có endpoint tải file Excel mẫu
> (`template`) — FE dùng lại file mẫu người dùng đang có sẵn. Import chỉ hỗ trợ
> **tạo mới**, không hỗ trợ cập nhật Device đã tồn tại qua Excel (trùng `MQL` với
> Device đang có luôn bị báo lỗi, không ghi đè).

> **`Device.SerialNumber` + `Device.IsUseUsb` (2026-07-09, đã làm)**: 2 field mới —
> `SerialNumber?` (string, max 100, **unique khi có giá trị** — index
> `IX_ThietBis_SoSeri` filtered `WHERE SerialNumber IS NOT NULL`, cho phép nhiều
> Device cùng `SerialNumber=null`) và `IsUseUsb` (bool, mặc định `false`, không có
> ràng buộc unique). `DeviceService.CreateAsync`/`UpdateAsync` tự check trùng
> `SerialNumber` bằng `DomainException` giống `DeviceCode` (chỉ khi
> `SerialNumber` không rỗng/null và có thay đổi so với giá trị cũ khi Update).
> Có trong `DeviceFilterRequest` (lọc `Contains` theo `SerialNumber`, exact-match
> theo `IsUseUsb`), `DeviceGridDto`, `DeviceDto`, `Create/UpdateDeviceDto`.
> Migration `AddDeviceUsbSerialFields`
> (`Asset.Infrastructure/Migrations/20260709062733_AddDeviceUsbSerialFields.cs`)
> đã apply lên DB thật.

> **`DeviceConfiguration` — phạm vi đã làm (2026-07-08)**: chỉ CRUD cơ bản + 6 field
> chung mới (`Maker/Model/PowerAdapter/WirelessCard/Nic/Other`) theo màn hình "CẬP
> NHẬT CẤU HÌNH" của hệ thống cũ.
>
> **Quyết định KHÔNG làm field riêng theo loại thiết bị** (9 field "Máy in":
> `standardFunction/type/MediaSize Max/Min/Copy-Print Resolution/Print Speed/
> Connectivity/Scan Destination/Support`; 5 field "Thiết bị mạng": `Ports/Number of
> Port/Network Media/Poe Ready/Management`) — người dùng xác nhận nhóm field này
> trong hệ thống cũ hầu như không được nhập dù có ~351 máy in/scan + ~178 thiết bị
> mạng trong fleet (~10% tổng số thiết bị), nên bỏ hẳn, không cần `DeviceType.Category`.
> Máy in/thiết bị mạng vẫn quản lý bình thường qua field chung + `Note`/`Other`.
>
> Migration `AddDeviceConfigurationFields`
> (`Asset.Infrastructure/Migrations/20260708090146_AddDeviceConfigurationFields.cs`)
> chỉ thêm 6 cột nullable, không backfill — đã apply lên DB thật.
>
> **"Cấu hình ban đầu" + "Sửa chữa/Thay thế" (2026-07-08, đã làm)**: 2 bảng mới
> `DeviceConfigurationInitials`/`DeviceConfigurationHistories`
> (migration `AddDeviceConfigurationHistory`,
> `Asset.Infrastructure/Migrations/20260708095858_AddDeviceConfigurationHistory.cs`
> — chỉ `CREATE TABLE`, không đụng bảng cũ, đã apply lên DB thật). Cơ chế:
> - **`DeviceConfigurationInitial`**: `DeviceConfigurationService.CreateAsync` tự
>   động copy toàn bộ 20 field vừa tạo thành 1 snapshot bất biến — các lần `Update`
>   sau không đụng tới. Xoá qua `DELETE /api/DeviceConfiguration/initial/{id}`
>   (dùng khi nhập nhầm lúc tạo).
> - **`DeviceConfigurationHistory`**: `UpdateAsync` so sánh 20 field cũ/mới; **chỉ**
>   tạo 1 dòng lịch sử (giá trị **mới**, `EditedAt`, `EditedBy`) nếu có **ít nhất 1
>   field thực sự đổi** — Save mà không đổi gì thì không log thêm (đã kiểm chứng
>   bằng test thật: Update 2 lần cùng giá trị chỉ tạo đúng 1 dòng lịch sử).
> - **`EditedBy`**: lấy `HttpContext.User.Identity.Name` (claim `ClaimTypes.Name`
>   qua JWT nếu request có gắn token) qua `IHttpContextAccessor`; request hoàn
>   toàn anonymous thì ghi `"Unknown"`. Cần thêm
>   `<FrameworkReference Include="Microsoft.AspNetCore.App" />` vào
>   `Asset.Application.csproj` (theo đúng convention đã có sẵn ở `Asset.Api.csproj`)
>   để dùng được `IHttpContextAccessor` trong tầng Application.
> - Cả 2 entity có FK `OnDelete(Cascade)` tới `DeviceConfiguration` — xoá
>   `DeviceConfiguration` (`DeviceConfigurationService.DeleteAsync`) tự động xoá
>   sạch Initial + toàn bộ History liên quan (đã verify bằng test thật, 0 dòng sót).
> - Không có Create/Update DTO cho 2 entity này — hoàn toàn tự sinh (side effect),
>   không có API cho client POST/PUT trực tiếp.

---

## 2. DTOs (`Asset.Application/Dtos/`)

- **Branches/**: `BranchDto` (Id/Code/Name), `CreateBranchDto` (+`[Required]`), `UpdateBranchDto`.
- **Suplliers/** *(giữ nguyên typo folder)*: `SupplierDto`, `CreateSupplierDto`, `UpdateSupplierDto`.
- **DeviceTypes/**: `DeviceTypeDto`, `CreateDeviceTypeDto`, `UpdateDeviceTypeDto`.
- **Devices/**:
  - `DeviceFilterRequest` (query grid): `PageIndex=1`, `PageSize=50`, filter
    `DeviceCode/Manager/PurchaseDate/IpAddress/SupplierName/Note/IsOutsourced?`
    (2026-07-09: thêm `IsOutsourced?` — lọc đúng true/false, bỏ qua nếu null),
    `SerialNumber?`(`Contains`), `IsUseUsb?` (2026-07-09, thêm sau — exact match),
    `SortDeviceCodeAscending?` (2026-07-10, thêm sau — `null` giữ mặc định
    `OrderByDescending(PurchaseDate)`, `true`/`false` = sort theo `DeviceCode`
    tăng/giảm dần, ghi đè sort mặc định).
  - `DeviceGridDto` (1 dòng grid): gộp tên Branch/Supplier/DeviceType + IP đầu tiên +
    `StatusText` + `IsOutsourced` (2026-07-09: thêm cột này vào grid, trước đó chỉ
    có ở `DeviceDto`/Create/Update, grid-list thiếu) + `SerialNumber?`/`IsUseUsb`
    (2026-07-09, thêm sau).
  - `DeviceDto` (GetById, đầy đủ): gộp tên Branch/DeviceType/Supplier + `StatusText`
    + `IpAddressId?`/`IpAddress?` (IP chính đang gắn) + `ExpirationDate` tính toán +
    `SerialNumber?`/`IsUseUsb` (2026-07-09).
  - `CreateDeviceDto`/`UpdateDeviceDto`: `DeviceCode/DeviceName/Manager/Email`
    `[Required]` (Email +`[EmailAddress]`), `DeviceTypeId/SupplierId/BranchId`
    `[Required]`, `PurchaseDate` `[Required]`, `DepreciationMonths`
    `[Required][Range(1,600)]`, `IsOutsourced` (bool), `Status` `[Range(0,3)]`,
    `Note?`, `IpAddressId?` (chọn IP `Available` để gán ngay), `SerialNumber?`
    (`[StringLength(100)]`, 2026-07-09), `IsUseUsb` (bool, 2026-07-09). **Không có**
    `ExpirationDate` (server tự tính, xem ghi chú §1).
- **DeviceSoftwares/**: `DeviceSoftwareDto`, `CreateDeviceSoftwareDto` (+`[Required]` Device/Software), `UpdateDeviceSoftwareDto`.
- **Softwares/**: `SoftwareDto` (Id/Code/Name/Type?/Publisher?/Quantity?/Priority?/GroupId/GroupName —
  gộp tên `SoftwareGroup`), `CreateSoftwareDto` (+`[Required]` Code/Name/GroupId), `UpdateSoftwareDto`.
- **SoftwareGroups/**: `SoftwareGroupDto` (Id/Code/Name), `CreateSoftwareGroupDto` (+`[Required]`), `UpdateSoftwareGroupDto`.
- **IpAddresses/**: `IpAddressDto` (gộp `DeviceCode` + `StatusText` + `Prefix*` từ
  `IpPrefix`), `CreateIpAddressDto`/`UpdateIpAddressDto` (+`[RegularExpression]`
  IPv4, `IpPrefixId` `[Required]`), `IpAddressFilterRequest` (`Keyword/Status/DeviceId`,
  **không có** `all` vì bảng pool lớn), `AssignIpAddressDto` (`DeviceId` `[Required]`).
- **IpPrefixes/**: `IpPrefixDto` (gồm `IpAddressCount` đếm IP con), `CreateIpPrefixDto`
  (`Prefix` `[Required]` + `[RegularExpression]` 3 octet, + SubnetMask/Gateway/DNS/
  Description dùng chung cho cả subnet), `UpdateIpPrefixDto` (**không** có `Prefix`
  — đổi prefix phải xoá + tạo lại, không hỗ trợ rename).
- **DeviceConfigurations/**: `DeviceConfigurationDto` (gộp `DeviceCode`, đủ 20 field
  linh kiện), `CreateDeviceConfigurationDto` (`DeviceId` `[Required]`, còn lại đều
  optional), `UpdateDeviceConfigurationDto` (giống Create + `Id`, **không cho đổi
  `DeviceId`** sau khi tạo), `DeviceConfigurationInitialDto` (20 field + `CreatedAt`),
  `DeviceConfigurationHistoryDto` (20 field + `EditedAt`/`EditedBy`) — 2 DTO cuối
  không có Create/Update tương ứng (tự sinh, xem ghi chú §1).
- **Devices/** (báo cáo): `DeviceReportFilterRequest` (`DeviceTypeId?/BranchId?/Keyword?`,
  tất cả optional), `DeviceReportItemDto` (`Stt/DeviceCode/DeviceName/IpAddress/
  PurchaseDate/ExpirationDate/IsExpired/FinancialPeriod/Note` — xem công thức
  `FinancialPeriod` ở ghi chú §1).
- **TransferHistories/**: `TransferHistoryDto` (gộp `OldDeviceCode/OldDeviceName/
  NewDeviceCode/NewDeviceName`), `CreateTransferHistoryDto` (`OldDeviceId`/
  `NewDeviceId` `[Required]`, `Note?`) — **không có** Update/Delete DTO (audit-log,
  xem ghi chú §1).

---

## 3. Repositories & UnitOfWork

- `IAssetUnitOfWork : IUnitOfWork` gom **14 repository**: `Devices`, `Branches`,
  `Softwares`, `SoftwareGroups`, `Suppliers`, `DeviceConfigurations`,
  `DeviceConfigurationInitials`, `DeviceConfigurationHistories`, `DeviceSoftwares`,
  `DeviceTypes`, `IpAddresses`, `IpPrefixes`, `TransferHistories`, `AuditTrails`.
- Tất cả repo hiện **generic thuần** (class con rỗng, chỉ kế thừa
  `GenericRepository<T, AssetDbContext>`) — chưa có method đặc thù nào.
- `AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>` inject đủ 14 repo qua constructor.

---

## 4. Services & API — hiện trạng theo từng thực thể

| Thực thể | Service | Controller / Route | CRUD | Auth |
|---|---|---|---|---|
| Branch | `BranchService` (đầy đủ) | `BranchController` `/api/Branch` | grid-list, all, {id}, POST, PUT, DELETE | `[RequirePermission("Asset.Branch.*")]` |
| Device | `DeviceService` (đầy đủ) | `DeviceController` `/api/Device` | grid-list, `available` (2026-07-10, không phân trang — máy `Status=PendingUse` phục vụ chọn máy mới khi "đổi thiết bị"), {id}, `{id}/detail` (gộp Device+Configuration+Softwares), POST, PUT, DELETE (**không có** `all`) | `[RequirePermission("Asset.Device.*")]` |
| Report (device-list) | dùng lại `IDeviceService.GetReportListAsync` | `ReportController` `/api/Report` (2026-07-09, controller riêng cho mọi loại báo cáo) | `device-list` (báo cáo in ấn "DANH SÁCH DESKTOP TOÀN CÔNG TY") | `[RequirePermission("Asset.Report.View")]` |
| DeviceType | `DeviceTypeService` | `DeviceTypeController` `/api/DeviceType` | CRUD | `[RequirePermission("Asset.DeviceType.*")]` |
| Supplier | `SupplierService` | `SupplierController` `/api/Supplier` | CRUD | `[RequirePermission("Asset.Supplier.*")]` |
| DeviceSoftware | `DeviceSoftwareService` | `DeviceSoftwareController` `/api/DeviceSoftware` | GetByDevice, POST, PUT, DELETE, `picker/{deviceId}` (GET), `sync` (PUT, bulk tick) | `[RequirePermission("Asset.DeviceSoftware.*")]` (Picker→`.View`, Sync→`.Update`) |
| Software | `SoftwareService` (đầy đủ) | `SoftwareController` `/api/Software` | grid-list, all, {id}, POST, PUT, DELETE | `[RequirePermission("Asset.Software.*")]` |
| SoftwareGroup | `SoftwareGroupService` (đầy đủ) | `SoftwareGroupController` `/api/SoftwareGroup` | grid-list, all, {id}, POST, PUT, DELETE | `[RequirePermission("Asset.SoftwareGroup.*")]` |
| IpAddress | `IpAddressService` (đầy đủ) | `IpAddressController` `/api/IpAddress` | grid-list, `available` (2026-07-09, không phân trang), {id}, POST, PUT, DELETE, `{id}/assign`, `{id}/unassign` (**không có** `all`/`generate-range`) | `[RequirePermission("Asset.IpAddress.*")]` (assign/unassign dùng chung `Asset.IpAddress.Assign`) |
| IpPrefix | `IpPrefixService` (đầy đủ, POST tự sinh 255 IP con) | `IpPrefixController` `/api/IpPrefix` | grid-list, all, {id}, POST, PUT, DELETE | `[RequirePermission("Asset.IpPrefix.*")]` |
| DeviceConfiguration | `DeviceConfigurationService` (CRUD + snapshot/history) | `DeviceConfigurationController` `/api/DeviceConfiguration` | `by-device/{deviceId}` (trả `null` nếu chưa có), POST, PUT, DELETE (xoá cứng, cascade Initial+History), `{configId}/initial` (GET), `initial/{id}` (DELETE), `{configId}/history` (GET list) — **không có** `grid-list`/`all` | `[RequirePermission("Asset.DeviceConfiguration.*")]` (initial/history GET→`.View`, DeleteInitial→`.Delete`) |
| TransferHistory | `TransferHistoryService` (2026-07-09, đã làm — "chuyển máy") | `TransferHistoryController` `/api/TransferHistory` | POST (thực hiện chuyển máy), `device/{deviceId}` (GET, lịch sử chuyển máy của 1 thiết bị) — **không có** grid-list/all/PUT/DELETE (audit-log, không sửa/xoá sau khi tạo) | `[RequirePermission("Asset.TransferHistory.Create/.View")]` |
| DeviceImport | `DeviceImportService` (2026-07-10, mới làm — import Device hàng loạt từ Excel) | `DeviceImportController` `/api/DeviceImport` | `preview` (POST multipart file, chỉ đọc + validate, **không ghi DB**), `confirm` (POST, validate lại rồi ghi DB trong 1 transaction) | `[RequirePermission("Asset.Device.Create")]` (dùng chung, không tách permission riêng) |
| AuditTrail | ❌ chưa có | ❌ | — | — |

> **Auth (2026-07-10, đã siết)**: toàn bộ 12 controller trên đã bỏ `[AllowAnonymous]`,
> chuyển sang `[RequirePermission("Module.Entity.Action")]` (attribute dùng chung ở
> `Shared.Application/Authorization/`, xem cơ chế đầy đủ + danh sách mã permission ở
> [identity-module.md](identity-module.md) §9). Muốn gọi các endpoint này giờ bắt buộc
> có JWT hợp lệ **và** Role của user phải được gán đúng permission tương ứng qua
> `PUT /api/Permission/role/{roleId}`.

**Hai pattern service mẫu để nhân bản:**

- **CRUD chuẩn** → xem `BranchService` (soft-delete, check trùng code bằng
  `DomainException`, `OrThrowNotFound`, phân trang `ToPagedResponseAsync`, có cả
  `GetAllActiveAsync` dùng `SelectAsync`).
- **Grid filter động** → xem `DeviceService.GetDevicesForGridAsync`: lấy
  `GetQueryable(false, ...includes)`, `.Where(!IsDeleted)`, nối filter theo field,
  `OrderByDescending` (mặc định theo `PurchaseDate`, hoặc theo `DeviceCode` nếu
  `SortDeviceCodeAscending` có giá trị), rồi `ToPagedResponseAsync` projection
  sang `DeviceGridDto`.
- **Khoá kép** → xem `DeviceSoftwareService`: mọi thao tác tìm bằng
  `FirstOrDefaultAsync(x => x.DeviceId == .. && x.SoftwareId == ..)`, xoá **cứng**
  (`Delete`, không soft-delete vì entity không có `IsDeleted`).
- **CRUD có FK bắt buộc** → xem `SoftwareService` (Software → SoftwareGroup):
  `GetPagedAsync`/`GetAllActiveAsync`/`GetByIdAsync` dùng `GetQueryable`/`FirstOrDefaultAsync`
  kèm `.Include(x => x.SoftwareGroup)` để gộp `SoftwareGroupName` vào DTO; `CreateAsync`/
  `UpdateAsync` validate `SoftwareGroupId` tồn tại bằng `_unitOfWork.SoftwareGroups.GetByIdAsync`
  + `OrThrowNotFound` trước khi ghi.
- **CRUD với FK optional + action gán/gỡ** → xem `IpAddressService`
  (IpAddress → Device, nullable; IpAddress → IpPrefix, bắt buộc): `Status` tự derive
  theo `DeviceId` (xem ghi chú `IpAddressStatus` ở §1), có 2 action riêng
  `AssignToDeviceAsync`/`UnassignAsync` ngoài CRUD chuẩn để đổi `DeviceId`+`Status`
  cùng lúc mà không cần gọi `UpdateAsync` đầy đủ. Lưu ý: `StatusText` trong
  `Expression<Func<>>` của `ToPagedResponseAsync` phải viết bằng ternary lồng nhau
  thay vì gọi method C#, vì EF Core dịch expression đó sang SQL và không hỗ trợ gọi
  method tuỳ ý.
- **Master record tự sinh hàng loạt record con** → xem `IpPrefixService.CreateAsync`
  (IpPrefix 1-N IpAddress): tạo 1 `IpPrefix` xong (`AddAsync` + `SaveChangesAsync` để
  có `Id`), build luôn danh sách 255 `IpAddress` con (`n=1..255`) bằng LINQ
  `Enumerable.Range`, rồi `AddRangeAsync` + `SaveChangesAsync` **1 lần** cho cả batch
  (không loop insert từng bản ghi). Không cần check trùng vì Prefix vừa tạo chắc
  chắn chưa có IP con nào.
- **Field tính toán + điều khiển quan hệ 1-N ngược chiều (owning side là bảng
  khác)** → xem `DeviceService` (Device 1-N IpAddress, nhưng Device không giữ FK —
  `IpAddress.DeviceId` mới là FK): `CreateAsync`/`UpdateAsync` tự tính
  `ExpirationDate = PurchaseDate.AddMonths(DepreciationMonths)` (không nhận từ
  client); muốn gán/gỡ "IP chính" thì Service tự tìm `IpAddress` hiện gắn qua
  `FirstOrDefaultAsync(x => x.DeviceId == device.Id && !x.IsDeleted)` rồi `Update`
  trực tiếp field `DeviceId`/`Status` của nó (không gọi chéo sang `IpAddressService`
  — cùng `IAssetUnitOfWork` nên truy cập thẳng repo `_unitOfWork.IpAddresses` là đủ).
  `UpdateAsync` gom **mọi** thay đổi (Device + IP cũ gỡ + IP mới gán) vào **1 lần
  `SaveChangesAsync`** duy nhất ở cuối; `CreateAsync` cần 2 lần Save vì phải có
  `Device.Id` trước mới gán ngược được cho IP.
- **1-1 optional, trả `null` thay vì `OrThrowNotFound`** → xem
  `DeviceConfigurationService.GetByDeviceIdAsync`: phần lớn Device chưa có
  `DeviceConfiguration` (3004/5202 tại thời điểm map) — đây là trạng thái bình
  thường, không phải lỗi, nên trả thẳng `null` (`ApiResponse.IsSuccess=true`,
  `Data=null`) thay vì ném `NotFoundException` như các lookup theo `Id` khác. FE
  dựa vào `null` để quyết định gọi `POST` (tạo mới) hay `PUT` (cập nhật).
- **Snapshot bất biến lúc tạo + audit log diff-based lúc sửa** → xem
  `DeviceConfigurationService` (`CreateAsync` tạo kèm `DeviceConfigurationInitial`;
  `UpdateAsync` so sánh field cũ/mới, chỉ `AddAsync` 1 dòng
  `DeviceConfigurationHistory` nếu thực sự có thay đổi, gộp chung
  `SaveChangesAsync` với `Update(config)`). Lấy "ai sửa" qua
  `IHttpContextAccessor.HttpContext?.User?.Identity?.Name` (claim JWT optional,
  fallback `"Unknown"` nếu request anonymous) — cần thêm
  `<FrameworkReference Include="Microsoft.AspNetCore.App" />` vào project
  Application mới dùng được kiểu này (xem ghi chú §1).

> **Picker chọn nhiều phần mềm cho Device + đồng bộ 1 lần (2026-07-09, đã làm)**:
> `GET /api/DeviceSoftware/picker/{deviceId}` trả `List<SoftwarePickerDto>`
> (`SoftwareId/SoftwareCode/SoftwareName/IsSelected`) — toàn bộ Software
> `!IsDeleted`, `IsSelected=true` nếu đã có trong `DeviceSoftware` của
> `deviceId` đó. Dùng cho UI dạng checkbox-list (tick nhiều phần mềm 1 lúc,
> giống màn "Update software to Equipment" của hệ thống cũ).
> `PUT /api/DeviceSoftware/sync` (`SyncDeviceSoftwareDto`: `DeviceId`
> `[Required]`, `Items: List<DeviceSoftwareSyncItemDto>` — mỗi item
> `{SoftwareId [Required], InstallDate?, LicenseKey?}` **riêng theo từng phần
> mềm**, không dùng chung 1 key cho cả batch nữa vì thực tế đa số phần mềm
> (OS, Office...) có key bản quyền khác nhau) đồng bộ **toàn bộ** trạng thái
> tick: phần mềm có trong `Items` nhưng chưa cài → `AddRangeAsync` (dùng
> `item.InstallDate ?? DateTime.UtcNow` + `item.LicenseKey` **của riêng item
> đó**); phần mềm đang cài nhưng **không còn trong `Items`** → `RemoveRange`
> (gỡ hẳn, xoá cứng vì `DeviceSoftware` không có `IsDeleted`). Phần mềm **giữ
> nguyên tick** (đã cài từ trước, vẫn có `SoftwareId` trong `Items`) →
> **không đụng vào** bản ghi cũ dù `Items` có gửi `LicenseKey`/`InstallDate`
> mới cho `SoftwareId` đó (không ghi đè); muốn sửa key/date của 1 phần mềm cụ
> thể đã cài thì dùng `PUT /api/DeviceSoftware` (Update từng dòng) như cũ.
> Validate `Items` không được trùng `SoftwareId` + toàn bộ `SoftwareId` phải
> là Software tồn tại + chưa xoá trước khi ghi (`DomainException` nếu trùng
> hoặc có Id lạ). 1 lần `SaveChangesAsync` cho cả add+remove, trả về danh
> sách phần mềm sau đồng bộ (gọi lại `GetByDeviceIdAsync`). Đã test thật:
> device mẫu 95 software trong picker, 9 đang cài → picker trả đúng 9 dòng
> `IsSelected=true`; sync thêm 1 phần mềm mới với key riêng + giữ nguyên key
> cũ của 2 phần mềm đã cài từ trước + gỡ 1 phần mềm bị bỏ tick — đúng cả 3
> hành vi.

> **API tổng hợp chi tiết Device (2026-07-09, đã làm)**: `GET
> /api/Device/{id}/detail` trả `DeviceDetailDto { Device: DeviceDto,
> Configuration: DeviceConfigurationDto?, Softwares: List<DeviceSoftwareDto> }`
> — gộp `DeviceService.GetByIdAsync` + `DeviceConfigurationService
> .GetByDeviceIdAsync` (có thể `null`, xem ghi chú §1) + `DeviceSoftwareService
> .GetByDeviceIdAsync` trong 1 lần gọi (compose service, `DeviceService`
> inject thêm `IDeviceConfigurationService`/`IDeviceSoftwareService` qua
> constructor). FE mở màn hình chi tiết 1 thiết bị chỉ cần 1 request thay vì
> gọi 3 API riêng.

**API endpoints chi tiết** (route pattern nhất quán):
- `GET /api/{Entity}/grid-list?pageIndex=&pageSize=&keyword=` → `PagedResponse`.
- `GET /api/{Entity}/all` → list rút gọn (active).
- `GET /api/{Entity}/{id}` · `POST /api/{Entity}` · `PUT /api/{Entity}/{id}` · `DELETE /api/{Entity}/{id}`.

---

## 5. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:** CRUD Branch/DeviceType/Supplier/Software/SoftwareGroup/IpAddress/
IpPrefix/Device (đầy đủ, kể cả chọn/gán IP); CRUD DeviceSoftware + picker
checkbox-list `GET picker/{deviceId}` + đồng bộ hàng loạt `PUT sync`; CRUD
DeviceConfiguration (kể cả snapshot "Cấu hình ban đầu" + audit log "Sửa chữa Thay
thế"); API tổng hợp `GET /api/Device/{id}/detail` (Device + Configuration +
Softwares 1 lần gọi); toàn bộ Domain + DbContext + Migrations, gồm:
- `AddIpPrefix` (2026-07-08): backfill 27 `IpPrefix` từ 6885 `IpAddress` cũ, apply
  lên DB thật.
- `AddDeviceFields` (2026-07-08): thêm `DepreciationMonths`/`IsOutsourced` cho
  `Device`, backfill `DepreciationMonths` từ `DATEDIFF(MONTH, PurchaseDate,
  ExpirationDate)` cho 5202 thiết bị thật, apply lên DB thật.
- `AddDeviceConfigurationFields` (2026-07-08): thêm 6 cột nullable
  (`Maker/Model/PowerAdapter/WirelessCard/Nic/Other`) cho `DeviceConfiguration`,
  không backfill (khái niệm mới), apply lên DB thật.
- `AddDeviceConfigurationHistory` (2026-07-08): tạo mới 2 bảng
  `DeviceConfigurationInitials`/`DeviceConfigurationHistories`, không đụng bảng cũ,
  apply lên DB thật — đã test end-to-end (create→snapshot, update có/không đổi
  giá trị, cascade delete) trên dữ liệu test rồi dọn sạch.
- `AddDeviceUsbSerialFields` (2026-07-09): thêm `SerialNumber`(nvarchar 100,
  nullable) + `IsUseUsb`(bit, default false) cho `Device`, kèm unique index
  filtered `IX_ThietBis_SoSeri` (`WHERE SerialNumber IS NOT NULL`), không backfill,
  apply lên DB thật. Đi kèm `GET /api/IpAddress/available?keyword=` (endpoint mới,
  trả list rút gọn IP `Available` không phân trang — xem `IpAddressService
  .GetAvailableAsync`, ghi chú §1).

`GET /api/Report/device-list` (2026-07-09, đã làm, xem ghi chú §1) — báo cáo in ấn
"DANH SÁCH DESKTOP TOÀN CÔNG TY", filter `deviceTypeId`/`branchId`/`keyword`,
trả `FinancialPeriod` ("Kỳ T/C") tính đúng công thức fiscal year Yazaki
(1/7–30/6, đánh số từ 1941) — đã verify khớp báo cáo giấy gốc. Không lưu DB,
tính on-the-fly. Nằm ở controller riêng `ReportController`, không phải
`DeviceController`. Kèm theo đó, thêm method dùng chung mới
`IGenericRepository<T>.ToListAsync(query, selector)` ở tầng `Shared.*` (materialize
`IQueryable` filter động thành `List<TResult>` không phân trang) — xem
[architecture-core.md](architecture-core.md) §1.

`POST /api/TransferHistory` + `GET /api/TransferHistory/device/{deviceId}`
(2026-07-09, đã làm, xem ghi chú §1) — nghiệp vụ "chuyển máy": chuyển IP chính +
`DeviceSoftware` từ máy cũ sang máy mới (không chuyển `DeviceConfiguration`),
máy cũ tự chuyển `PendingUse`/`PendingLiquidation` (tuỳ đã hết hạn hay chưa),
tạo 1 dòng `TransferHistory` audit-log. Đã test thật trên DB (tạo thiết bị TEST,
verify đủ 2 kịch bản trạng thái + swap IP + dedup phần mềm + reject trùng Id,
rồi soft-delete thiết bị TEST — dòng `TransferHistory` test không xoá được do
thiết kế không có API xoá).

`POST /api/DeviceImport/preview` + `POST /api/DeviceImport/confirm` (2026-07-10,
đã làm, xem ghi chú §1) — import Device hàng loạt từ file Excel mẫu có sẵn của
người dùng (8 cột `MQL/Xưởng/Loại Thiết Bị/Nhà Cung Cấp/Ngày Mua/Ghi Chú/Số
SerialNumber/MQL Cũ`), có bước preview validate trước khi ghi DB, `MQL Cũ` tái
dùng nguyên nghiệp vụ "chuyển máy" của `TransferHistoryService`. Thêm package
`ClosedXML` 0.105.0 vào `Asset.Application` để đọc `.xlsx`; thêm constructor
`DomainException(string message, List<string> errors)` ở `Shared.Core` để trả
lỗi theo từng dòng qua `ApiResponse.Failure.Errors`.

Dữ liệu thật `Software`/`SoftwareGroup` cũng đã được sửa lại (2026-07-09, thao
tác dữ liệu qua API CRUD sẵn có, không phải code): trước đó 1 lần migrate dữ
liệu cũ bị sai — nhét mã nhóm cũ vào `SoftwareType`, bỏ trống
`SoftwareQuantity`/`SoftwarePriority`, dồn gần hết vào 1 group `DEFAULT`. Đã
đối chiếu lại với dữ liệu gốc (`HTLoaiPhanMem`/`HTPhanMem`) và sửa đúng 32
`SoftwareGroup` + 95 `Software` (field `SoftwareType`=kind, `SoftwareQuantity`
=licence, `SoftwarePriority`=TTUuTien, `SoftwareGroupId` khớp đúng nhóm — có xử
lý 15 dòng mà dữ liệu gốc lưu **tên nhóm** thay vì **mã nhóm** trong cột tham
chiếu, match case-insensitive theo cả 2 field). Không có migration nào cho
việc này vì chỉ là data fix, không đổi schema.

**Bug đã biết (chưa fix)**: `SoftwareGroupService.UpdateAsync` so sánh
`GroupCode` cũ/mới **trong bộ nhớ** (case-sensitive) để quyết định có chạy check
trùng hay không, nhưng chính check trùng đó chạy dưới SQL Server với collation
mặc định **case-insensitive** — nên đổi `GroupCode` sang 1 chuỗi chỉ khác hoa/
thường so với chính nó (vd `"MS Office"` → `"MS OFFICE"`) luôn bị 400 "đã tồn
tại" (tự đụng chính mình). Chưa fix vì ngoài phạm vi task lúc phát hiện.

**Cần làm tiếp (theo độ ưu tiên gợi ý):**
1. **AuditTrail**: chưa có tầng Application/Api.
2. ~~**Auth**: tất cả controller Asset đang `[AllowAnonymous]`~~ — **đã xong
   (2026-07-10)**: chuyển sang `[RequirePermission]` chi tiết theo permission, xem
   [identity-module.md](identity-module.md) §9. Còn lại: Admin cần tự gán permission
   phù hợp cho các role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` qua
   `PUT /api/Permission/role/{roleId}` (mặc định chỉ `Admin` được seed sẵn full quyền).
3. **Warning**: nhiều `CS8602`/`CS8603`/`CS8604` (deref/return possibly null) trong
   các Service — `GetByIdAsync` trả nullable, nên dùng `OrThrowNotFound` như
   `BranchService` (Software/SoftwareGroup/IpAddress/Device/DeviceConfiguration
   mới thêm cũng theo pattern này, cùng warning y hệt, chấp nhận được).
4. **Field ngoài phạm vi Device hiện tại** (theo ảnh form hệ thống cũ, chưa làm vì
   chưa có yêu cầu rõ + cần thêm cột DB mới): Nhóm (Group), Email 2/Email 3, Sticky
   Notes. Nếu cần, áp dụng đúng quy trình §4.2 CLAUDE.md (hỏi trước khi thêm cột).
5. **`SoftwareGroupService.UpdateAsync` case-collation bug** nêu trên — cần sửa
   logic so sánh sang case-insensitive (hoặc so `Id` của bản ghi trùng khác `request.Id`)
   trước khi cho phép rename đổi hoa/thường `GroupCode`.

---

## 6. Checklist khi thêm thực thể mới vào Asset

1. Đọc [architecture-core.md](architecture-core.md) + file này. Nếu là nghiệp vụ
   mới chưa rõ entity/luật → **hỏi trước** (xem CLAUDE.md §4.2).
2. **Domain**: entity `partial class` trong `Asset.Domain/Entities/`; thêm cờ
   `IsDeleted` nếu cần soft-delete.
3. **DbContext**: thêm `DbSet<>` + Fluent config (đặt tên constraint/index kiểu
   tiếng Việt cho khớp DB) trong `AssetDbContext.OnModelCreating`.
4. **Repository**: `I<Entity>Repository : IGenericRepository<Entity>` + class cài
   đặt rỗng; thêm property vào `IAssetUnitOfWork` **và** `AssetUnitOfWork`
   (constructor + property).
5. **DTOs**: `Dtos/{Entities}/` gồm `<Entity>Dto`, `Create<Entity>Dto`,
   `Update<Entity>Dto` (+ DataAnnotations tiếng Việt).
6. **Service**: `I<Entity>Service` + `<Entity>Service : BaseService<IAssetUnitOfWork>`
   — nhân theo `BranchService`. Scrutor tự DI (không sửa `AddDIConfig`).
7. **Controller**: `<Entity>Controller : BaseController`, route theo pattern §4,
   bọc `Success/Fail/CreatedSuccess`. Controller nằm trong `Asset.Api` nên đã
   được host nạp sẵn qua `AddApplicationPart` — không cần chỉnh Program.cs. Gắn
   `[RequirePermission("Asset.<Entity>.View/Create/Update/Delete")]` (namespace
   `Shared.Application.Authorization`) trên từng action — **không** dùng lại
   `[AllowAnonymous]`. Nhớ thêm mã permission mới vào migration seed (xem
   [identity-module.md](identity-module.md) §9) và gán cho role `Admin`.
8. **Migration**: `dotnet ef migrations add <Name> --project Asset.Infrastructure --startup-project CompanySystem.HostApi`.
9. Cập nhật lại bảng ở §4 và mục §5 của file doc này.
