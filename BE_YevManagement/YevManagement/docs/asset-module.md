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
| `Device` | `DeviceCode`(unique), `DeviceName`, `DeviceTypeId`, `SupplierId`, `BranchId`, `Manager`, `PurchaseDate`, `DepreciationMonths`, `ExpirationDate?`(**tính toán**, không nhập tay — xem ghi chú bên dưới), `IsOutsourced`, `Status`, `Note?`, `SerialNumber?`(unique khi có giá trị), `IsUseUsb`, `ReplacesOldDeviceId?`(tự tham chiếu, gợi ý máy thay thế — xem ghi chú "Lưu lại gợi ý máy thay thế xuống DB") | N-1 Branch/DeviceType/Supplier; N-1 ReplacesOldDevice (tự tham chiếu, optional); 1-1 DeviceConfiguration; 1-N IpAddresses (**nhiều IP/device**, xem ghi chú bên dưới), 1-N DeviceEmails, DeviceSoftwares, TransferHistory(old/new) | **Có** |
| `DeviceEmail` | `DeviceId`, `Email`, `Note?` | N-1 Device | **Có** |
| `Branch` | `BranchCode`(unique), `BranchName` | 1-N Devices | **Có** |
| `Supplier` | `SupplierCode`(unique), `SupplierName` | 1-N Devices | **Có** |
| `DeviceType` | `TypeCode`(unique), `TypeName` | 1-N Devices | **Có** |
| `IpAddress` | `IpAddress1`(unique **toàn cục**, cột `IpAddress`), `DeviceId?`, `IpPrefixId`(bắt buộc), `Status`, `Note?` (2026-07-11: **bỏ** `ServerIp`) | N-1 Device (nullable), N-1 IpPrefix (**bắt buộc**) | **Có** |
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

> **`IpAddress.Status` (int) — đổi lại còn 3 trạng thái (2026-07-11, quyết định
> người dùng)** qua enum `IpAddressStatus` (`Asset.Domain/Enums/IpAddressStatus.cs`):
> `0=Available` (chưa gán), `1=AssignedExternal` (đã gán nhưng **không** có
> `DeviceId` — IP đang được 1 thiết bị ngoài hệ thống dùng; khi hiển thị
> `DeviceCode` trả về **"Khác"**), `2=Assigned` (đã gán và **có** `DeviceId` thật).
> Bỏ hẳn `Reserved`/`Disabled` cũ. **Bất biến:** `Status==Assigned(2)` ⟺
> `DeviceId != null`; `Status==Available(0)/AssignedExternal(1)` ⟺ `DeviceId == null`.
>
> Server tự derive Status khi gán/gỡ thiết bị (gán → `Assigned(2)` + set `DeviceId`;
> gỡ → `Available(0)` + `DeviceId=null`). `IpAddressService.UpdateAsync` (chỉ đổi
> `Status`+`Note`, xem bên dưới) chỉ cho chuyển tay giữa `Available(0)` ↔
> `AssignedExternal(1)` khi IP chưa gắn thiết bị; IP đang gắn (`DeviceId != null`)
> chỉ đổi được `Note`, muốn đổi Status phải gỡ gán trước.
>
> **Migration backfill (chưa apply — người dùng tự chạy sau khi review)**:
> `Status = CASE WHEN DeviceId IS NOT NULL THEN 2 (Assigned) WHEN Status <> 0 THEN 1
> (AssignedExternal) ELSE 0 (Available) END` — mọi IP đang có thiết bị → 2; IP
> không thiết bị nhưng trước đó không phải Available (cũ 1/2/3) → 1 (coi như đang
> dùng bởi thiết bị ngoài, giữ khỏi pool trống); còn lại → 0. Đảm bảo bất biến trên.
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
>
> **Không còn Create/Delete thủ công cho từng `IpAddress`, không còn Update cho
> `IpPrefix` (2026-07-11, quyết định người dùng)**: `IpAddressController` còn
> `grid-list`/`available`/`{id}` (View) + `PUT {id}` (Update **hạn chế** chỉ đổi
> `Status`+`Note`) + `assign`/`unassign` (gán/gỡ gán cho Device). `IpPrefixController`
> chỉ còn `Create` (tự sinh 255 IP con) và `Delete`. `IIpAddressService.CreateAsync/
> DeleteAsync` và `IIpPrefixService.UpdateAsync` đã xoá khỏi interface +
> implementation (xoá hẳn action + DTO `CreateIpAddressDto`/`UpdateIpPrefixDto`).
> `IpAddressService.UpdateAsync` được **giữ lại nhưng thu hẹp**: `UpdateIpAddressDto`
> chỉ còn `Id`/`Status`/`Note` (bỏ `IpAddress`/`ServerIp`/`IpPrefixId`/`DeviceId`) —
> logic đổi Status như mô tả ở ghi chú `IpAddressStatus` bên trên.
>
> **Bỏ cột `IpAddress.ServerIp` (2026-07-11)**: xoá khỏi entity/DbContext/`IpAddressDto`
> và DROP cột `ServerIP` trên DB qua migration (chưa apply, xem bên dưới).
>
> **Validate cấu hình mạng khi tạo `IpPrefix` (2026-07-11)**: `IpPrefixService.CreateAsync`
> gọi `ValidateNetworkSettings` (áp dụng logic từ công cụ nội bộ ChangeIP/SetIP.cs,
> qua `Shared.Application/Helper/NetworkHelper.cs`: `IsValidIpv4`/`GetNetworkClass`/
> `IsSameSubnet`): `SubnetMask`/`Gateway`/`PreferredDns`/`AlternateDns` nếu có phải
> là IPv4 hợp lệ; `Gateway` phải thuộc đúng network 3-octet của `Prefix` (cùng dải
> IP con sẽ sinh), cùng subnet theo `SubnetMask` (nếu có), và không trùng địa chỉ
> network `.0`/broadcast `.255`. (Quy tắc "không trùng network 3-octet giữa các dải"
> trong SetIP.cs đã được unique index `IX_TienToIPs_TienTo` trên `Prefix` lo sẵn.)
>
> **`IpPrefixService.DeleteAsync` đổi quy tắc chặn xoá** (2026-07-11, đổi — trước
> đó chặn nếu còn **bất kỳ** `IpAddress` con `!IsDeleted`, quy tắc cũ giờ vô
> nghĩa vì IP không còn tự xoá tay được nữa nên luôn còn đủ 255 dòng): giờ chỉ
> chặn (`DomainException`) nếu còn IP con **đang gắn cho Device** (`DeviceId`
> khác null, `!IsDeleted`) — phải gỡ gán hết trước mới xoá được Prefix. Nếu
> không còn IP nào đang dùng, `DeleteAsync` **cascade soft-delete toàn bộ IP con
> chưa dùng** cùng lúc với soft-delete Prefix (đây là cách duy nhất dọn IP chưa
> dùng vì không còn API xoá tay từng IP).

> **Sắp xếp lưới IP theo giá trị số (2026-07-11)**: cả `IpPrefix` grid/all và
> `IpAddress` grid-list/available đều sort theo **giá trị IP** (không phải chuỗi —
> sort chuỗi sẽ đặt `10.45.10` trước `10.45.2`). Dùng `NetworkHelper.ToSortableKey`
> (pack 4 octet thành 1 `long`). Vì cần sort theo số nên `GetPagedAsync` (cả 2
> service) **materialize DTO đã project rồi sort + phân trang trong bộ nhớ** thay vì
> `ToPagedResponseAsync` (paging trong SQL) — bảng IP là nội bộ, quy mô vừa phải nên
> chấp nhận được.

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
> **Chọn/gán nhiều IP cho Device (2026-07-11, đã đổi — bỏ khái niệm "IP chính")**:
> `Device` 1-N `IpAddress`, Create/Update Device nhận `IpAddressIds: List<int>`
> (mỗi Id phải là 1 `IpAddress` đang `Status=Available`, không được trùng lặp
> trong cùng request) — `DeviceService.CreateAsync` validate + gán toàn bộ list;
> `UpdateAsync` gọi `SyncIpAddressesAsync` để **đối chiếu diff** với các IP đang
> gắn: IP nào không còn trong list mới → gỡ về `Available`; IP mới trong list mà
> trước đó chưa gắn → validate `Available` rồi gán; IP đã gắn sẵn và vẫn còn
> trong list → **không đụng tới** (tránh xoá/gán lại không cần thiết). Xoá
> Device → mọi IP đang gắn tự gỡ về `Available` (như cũ). `DeviceDto.IpAddresses`
> trả `List<DeviceIpAddressDto>` (`Id` + `IpAddress`); `DeviceGridDto.IpAddresses`
> trả `List<string>` rút gọn. **Danh sách "IP chưa dùng" để chọn** có 2 cách:
> `GET /api/IpAddress/grid-list?status=0&keyword=` (có phân trang, dùng cho
> bảng/picker lớn) hoặc `GET /api/IpAddress/available?keyword=` (trả thẳng
> `List<IpAddressDto>` không phân trang, sort theo `IpAddress` A-Z, dùng cho
> dropdown/picker gọn không cần trang).
>
> **Nhiều Email/Device (2026-07-11, đã làm)**: thay cột `Device.Email` (string
> đơn) bằng bảng `DeviceEmails` (`Id/DeviceId/Email/Note?/IsDeleted`), **không**
> ràng buộc unique (1 email có thể dùng chung cho nhiều Device, theo quyết định
> người dùng). Create/Update Device nhận `Emails: List<DeviceEmailInputDto>`
> (`Email [Required][EmailAddress]`, `Note?`) — `UpdateAsync` gọi
> `SyncEmailsAsync`: entry không còn trong request (so khớp theo `Email` đã
> trim, case-insensitive) → soft-delete; entry khớp sẵn → chỉ cập nhật `Note`
> nếu đổi, giữ nguyên `Id`; entry mới → `AddAsync`. Xoá Device → toàn bộ
> `DeviceEmail` liên quan cũng soft-delete theo. `DeviceDto.Emails` trả
> `List<DeviceEmailDto>` (`Id/Email/Note`); `DeviceGridDto.Emails` trả
> `List<string>` rút gọn. Migration `AddDeviceEmailsMultiIp`
> (`Asset.Infrastructure/Migrations/20260711013130_AddDeviceEmailsMultiIp.cs`)
> đã **backfill 5218/5225 Device.Email cũ** sang `DeviceEmails` (verify khớp
> 100% số dòng) trước khi drop cột cũ, đã apply lên DB thật.
>
> **Bộ lọc Device theo IP/Email (2026-07-11, đã làm)**: `DeviceFilterRequest`
> thêm `IpAddress?`/`Email?` (Contains, khớp **bất kỳ** IP/email nào của Device
> qua `d.IpAddresses.Any(...)`/`d.DeviceEmails.Any(...)`, cả 2 đều tự lọc
> `!IsDeleted` trên bảng con).
>
> **Hệ luỵ sang nghiệp vụ khác (2026-07-11)**: `TransferHistoryService.TransferAsync`
> đổi từ "chuyển 1 IP chính" sang **chuyển toàn bộ IP đang gắn** của máy cũ sang
> máy mới (IP nào máy mới đang giữ sẵn mà không thuộc tập IP máy cũ thì gỡ về
> `Available` trước). `DeviceConfigurationImportService.ReassignDeviceIpAsync`
> (import Tanium) không còn gỡ các IP khác của Device khi gán IP Tanium báo cáo
> được — chỉ "cướp" IP đó từ Device khác đang giữ (nếu có), không đụng tới các
> IP khác của chính Device đang import.

> **Báo cáo "DANH SÁCH DESKTOP TOÀN CÔNG TY" (2026-07-09, đã làm)**:
> `GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=` (controller
> riêng `ReportController`, **không** nằm trong `DeviceController` — để sau này
> gom chung các loại báo cáo khác như "Thống kê phần mềm"/"Thống kê tổng số thiết
> bị toàn công ty" cùng dưới `/api/Report/*`) trả thẳng
> `List<DeviceReportItemDto>` (**không phân trang** — dùng cho in ấn/export, khác
> `grid-list`), gồm `Stt` (đánh số lại theo kết quả trả về, `OrderBy(DeviceCode)`),
> `DeviceCode`, `DeviceName`, `IpAddress` (2026-07-11: toàn bộ IP đang gắn, nối
> `", "`, không còn chỉ 1 IP chính — xem ghi chú §1), `PurchaseDate`,
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
> 2. **Chuyển toàn bộ IP** (2026-07-11: đổi từ "chuyển 1 IP chính" — Device giờ
>    hỗ trợ nhiều IP cùng lúc): mọi IP đang gắn `OldDevice` → gán sang
>    `NewDevice`. IP nào `NewDevice` đang giữ sẵn mà không thuộc tập IP của
>    `OldDevice` → tự gỡ về `Available` trước (đúng ràng buộc "1 IP không được
>    gắn nhiều thiết bị" — logic giống hệt cách `DeviceService.UpdateAsync` đối
>    chiếu diff IP, viết lại trực tiếp trong `TransferHistoryService` vì cả 2
>    dùng chung `IAssetUnitOfWork`, không gọi chéo sang `IpAddressService`).
> 3. **Chuyển Email (`DeviceEmail`, 2026-07-11, mới thêm)**: đổi `DeviceId` của
>    từng dòng từ `OldDevice` sang `NewDevice` (move, giữ nguyên `Note`). Khác
>    IP — `DeviceEmail` không có ràng buộc unique nên **không cần gỡ** email sẵn
>    có của `NewDevice`, chỉ re-point `DeviceId` trực tiếp (PK riêng, không phải
>    khoá kép như `DeviceSoftware`). Nếu trùng đúng nội dung `Email` với 1 dòng
>    `NewDevice` đã có sẵn → soft-delete dòng cũ (tránh nhân đôi).
> 4. **Chuyển phần mềm cài (`DeviceSoftware`)**: đổi `DeviceId` của từng dòng từ
>    `OldDevice` sang `NewDevice` (move, không phải copy — giữ nguyên
>    `InstallDate`/`LicenseKey` cũ). Nếu `NewDevice` **đã cài sẵn** đúng phần mềm
>    đó rồi (trùng khoá kép `DeviceId+SoftwareId`) → giữ bản ghi bên `NewDevice`,
>    xoá cứng bản ghi cũ bên `OldDevice` (tránh vi phạm khoá kép).
> 5. **Chuyển dữ liệu vai trò/vị trí sử dụng của `Device` (2026-07-11, chốt lại
>    lần 2 theo quyết định người dùng)**: copy trực tiếp từ `OldDevice` ghi đè lên
>    `NewDevice` CHỈ 4 field `BranchId`/`Manager`/`IsOutsourced`/`IsUseUsb` — đây
>    là dữ liệu gắn theo vị trí/người dùng đang thao tác trên máy, không phải
>    thuộc tính vật lý riêng của thiết bị. **KHÔNG copy** (giữ nguyên của
>    `NewDevice`, coi là thuộc tính vật lý/độc nhất của từng máy — mỗi máy có
>    ngày mua/nhà cung cấp/loại/khấu hao riêng, không đại diện cho máy kia):
>    `DeviceTypeId`, `SupplierId`, `PurchaseDate`, `ExpirationDate`,
>    `DepreciationMonths`, `Id`, `DeviceCode`, `DeviceName`, `SerialNumber`,
>    `Note`, `DeviceConfiguration` (xem mục 7), `Status` (tính riêng ở mục 6/6b).
> 6. **Đổi trạng thái `OldDevice`**: mặc định chuyển `PendingUse` (0, "Chờ sử
>    dụng") — **trừ khi** `OldDevice.ExpirationDate` đã qua (dùng đúng công thức
>    `IsExpired` ở báo cáo `device-list` bên trên) thì chuyển thẳng
>    `PendingLiquidation` (2, "Chờ thanh lý") thay vì `PendingUse`.
> 6b. **Đổi trạng thái `NewDevice` → `InUse`** (1, "Đang sử dụng", 2026-07-10, đã
>    làm) — máy mới đã tiếp nhận IP + phần mềm của máy cũ nên tự động chuyển sang
>    "Đang sử dụng" ngay khi transfer xong, không cần gọi `PUT /api/Device/{id}`
>    riêng để đổi status thủ công.
> 7. `DeviceConfiguration` **không đụng tới** — chủ ý không copy sang `NewDevice`
>    (cấu hình phần cứng là đặc thù theo từng máy vật lý, máy mới có config
>    riêng), cũng không xoá ở `OldDevice`.
> 8. Tạo 1 dòng `TransferHistory` (`TransferDate = DateTime.UtcNow`) ghi nhận
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
> **Lưu lại gợi ý "máy thay thế" xuống DB + endpoint tra cứu (2026-07-11, thêm
> sau)**: trước đó `PendingTransfers` chỉ trả về **1 lần duy nhất** trong
> response `POST /api/DeviceImport/confirm` — nếu người dùng không mở màn
> "Chuyển máy" ngay lúc đó thì gợi ý bị mất. Giờ quan hệ này được **lưu xuống
> DB**: `Device` thêm cột tự tham chiếu `ReplacesOldDeviceId` (int?, FK →
> `Devices.Id`, index `IX_ThietBis_ThayTheChoId`, constraint
> `FK_ThietBis_ThietBis_ThayTheChoId`, `OnDelete(ClientSetNull)`) — nghĩa là
> "thiết bị này (máy mới) dự tính thay thế cho máy có Id này (máy cũ)".
> `DeviceImportService.ConfirmAsync` set field này khi tạo Device có `MQL Cũ`
> (qua `CreateDeviceDto.ReplacesOldDeviceId`, cũng có sẵn ở `UpdateDeviceDto`
> để sửa tay nếu cần — `DeviceService.CreateAsync`/`UpdateAsync` validate máy
> cũ phải tồn tại `!IsDeleted` và không được trỏ vào chính nó).
>
> `GET /api/Device/{oldDeviceId}/replacement-suggestion` (permission
> `Asset.Device.View`, dùng chung `DeviceController`) trả
> `DeviceReplacementSuggestionDto? { Id, DeviceCode, DeviceName }` — gọi khi FE
> mở màn "Chuyển máy" trên 1 máy cũ để **tự điền sẵn** ô chọn `NewDeviceId`
> (người dùng vẫn có thể đổi qua `GET /api/Device/available` như bình thường,
> đây chỉ là gợi ý, không ép buộc). Logic chọn gợi ý
> (`DeviceService.GetReplacementSuggestionAsync`): tìm mọi Device có
> `ReplacesOldDeviceId == oldDeviceId`, `Status == PendingUse` (chưa được dùng
> để chuyển máy khác), `!IsDeleted` — nếu nhiều máy cùng khai (nhiều lần
> import khác thời điểm cùng trỏ về 1 máy cũ, theo quyết định người dùng
> 2026-07-11), chỉ lấy máy có `Id` lớn nhất (import gần nhất) làm gợi ý duy
> nhất, không trả danh sách. `null` nếu không có gợi ý nào. `DeviceDto` cũng
> trả kèm `ReplacesOldDeviceId`/`ReplacesOldDeviceCode` khi xem chi tiết máy
> mới (`GET /api/Device/{id}`). Migration `AddDeviceReplacesOldDevice`
> (`Asset.Infrastructure/Migrations/20260711074154_AddDeviceReplacesOldDevice.cs`)
> đã **apply lên DB thật** (2026-07-11).
>
> `GET /api/TransferHistory/device/{deviceId}` trả `List<TransferHistoryDto>` —
> lịch sử chuyển máy liên quan tới 1 Device (dù là vai trò máy cũ hay máy mới),
> sort `TransferDate` mới nhất trước. Đã test thật trên DB (tạo thiết bị TEST,
> gán IP/phần mềm, chuyển máy, verify IP/phần mềm/status đúng cả 2 kịch bản hết
> hạn/chưa hết hạn + case trùng Id bị từ chối 400, rồi soft-delete thiết bị TEST
> — riêng dòng `TransferHistory` test không xoá được vì thiết kế không có API
> xoá, chấp nhận còn lại vài dòng tham chiếu thiết bị đã soft-delete).

> **Import Device hàng loạt từ Excel (2026-07-10, đã làm)**: theo đúng file mẫu
> Excel hiện có của người dùng, **13 cột theo đúng thứ tự** (2026-07-11, đổi —
> thêm 5 cột cấu hình phần cứng): `MQL`, `Xưởng`, `Loại Thiết Bị`, `Nhà Cung
> Cấp`, `Ngày Mua`, `Ghi Chú`, `Số SerialNumber`, `Hãng`, `Model`, `CPU`, `RAM`,
> `Ổ Cứng`, `MQL Cũ` (trước đó chỉ 8 cột, `MQL Cũ` ở cột H — mẫu cũ không có 5
> cột cấu hình); dòng 1 là header. Quy trình 2 bước — **bắt buộc xem trước khi
> ghi DB** theo yêu cầu người dùng:
>
> **5 cột cấu hình `Hãng/Model/CPU/RAM/Ổ Cứng` (2026-07-11, thêm sau)**: hoàn
> toàn tuỳ chọn, map thẳng vào `DeviceConfiguration.Maker/Model/Cpu/Ram/
> HardDrive`. Ở bước Confirm, nếu dòng có **ít nhất 1** trong 5 cột này khác
> rỗng thì sau khi tạo `Device`, `DeviceImportService.ConfirmAsync` gọi luôn
> `IDeviceConfigurationService.CreateAsync` để tạo kèm `DeviceConfiguration`
> (chỉ set đúng 5 field này, các field cấu hình còn lại — Mainboard/OS/VGA/...
> — để trống, sửa lại sau qua màn hình "Cập nhật cấu hình"). Vì Device vừa tạo
> chắc chắn chưa có config sẵn, luôn `CreateAsync` — không cần nhánh
> update-nếu-đã-có như `DeviceConfigurationImportService` (import Tanium, cập
> nhật Device có sẵn). `DeviceImportConfirmResultDto` thêm `CreatedConfigCount`
> đếm số Device có kèm config.
>
> **Định dạng cột "Ngày Mua"**: nếu ô Excel là **kiểu Date thật** (không phải
> text) thì đọc trực tiếp, không phụ thuộc cách hiển thị. Nếu ô là text,
> `ParseExcel`/`TryParsePurchaseDate` chỉ nhận **đúng 1 định dạng cố định**
> `dd/MM/yyyy` (hằng số `PurchaseDateFormat`, VD `01/07/2026`) qua
> `DateTime.TryParseExact` + `CultureInfo.InvariantCulture` — **cố ý không dùng**
> `DateTime.TryParse` theo culture mặc định của server (dễ hiểu nhầm ngày/tháng
> tuỳ môi trường chạy). Định dạng khác (kể cả `d/M/yyyy` thiếu số 0, hay
> `yyyy-MM-dd`) hoặc ô trống → dòng đó báo lỗi "Thiếu hoặc sai định dạng Ngày
> Mua", không có giá trị mặc định.
> 1. `POST /api/DeviceImport/preview` (`multipart/form-data`, field `file`) —
>    `DeviceImportService.PreviewAsync` đọc file bằng `ClosedXML`
>    (`Asset.Application` thêm package `ClosedXML` 0.105.0), parse từng dòng,
>    validate + resolve tên → Id (không đụng DB, chỉ đọc), trả
>    `DeviceImportPreviewResultDto { Rows: List<DeviceImportRowDto>, TotalRows,
>    ValidRows, InvalidRows }`. Mỗi `DeviceImportRowDto` có `IsValid`/`Errors`
>    (tiếng Việt, theo từng dòng) để FE hiển thị bảng preview trước khi người
>    dùng bấm xác nhận import.
>
>    **Hỗ trợ cả `.xlsx` lẫn `.csv` (2026-07-11, thêm sau)**: `PreviewAsync` nhận
>    thêm `fileName?` (controller truyền `IFormFile.FileName`), quyết định
>    `ParseXlsx` (ClosedXML, giữ nguyên logic cũ, đổi tên từ `ParseExcel`) hay
>    `ParseCsv` dựa theo đuôi file (`CsvFileHelper.HasCsvExtension`, đuôi `.csv`
>    không phân biệt hoa/thường). `ParseCsv` dùng `CsvFileHelper`
>    (`Shared.Application/Helper/CsvFileHelper.cs`, helper dùng chung, tự viết
>    tay không phụ thuộc thư viện ngoài) — tự nhận diện dấu phân cách `,`/`;` dựa
>    trên dòng header (đếm số lần xuất hiện, dấu nào nhiều hơn thì dùng cho toàn
>    file), hỗ trợ field có dấu ngoặc kép bao quanh (chứa dấu phân cách/escape
>    `""`→`"` bên trong), UTF-8 tự nhận BOM. Vì CSV không có kiểu Date thật như
>    Excel, cột "Ngày Mua" ở nhánh CSV luôn parse qua `TryParsePurchaseDate`
>    (`dd/MM/yyyy`) — giống hệt nhánh "cell text" của `ParseXlsx`, không có
>    nhánh đọc Date-typed cell riêng. File không mở được ở cả 2 nhánh (hỏng/sai
>    định dạng) → `DomainException` (400) thay vì để lọt exception gốc của
>    ClosedXML ra ngoài thành lỗi 500 (xem ghi chú riêng ở mục Import Tanium bên
>    dưới — cùng 1 fix áp dụng cho cả 2 service import Excel).
> 2. `POST /api/DeviceImport/confirm` (`ConfirmDeviceImportDto { Rows }` — FE gửi
>    lại đúng field thô của các dòng đã xem ở bước 1, **không gửi Id đã resolve**
>    vì server luôn tự tra lại theo tên, không tin Id từ client) —
>    `DeviceImportService.ConfirmAsync` **validate lại từ đầu** theo dữ liệu DB
>    tại thời điểm confirm (phòng race condition giữa lúc xem preview và lúc bấm
>    xác nhận). **Dòng lỗi bị BỎ QUA, không chặn cả batch** (2026-07-11, đổi —
>    trước đó có bất kỳ dòng lỗi nào thì không ghi gì cả, ném `DomainException`).
>    Chỉ những dòng hợp lệ mới được tạo Device, chạy trong 1
>    `_unitOfWork.BeginTransactionAsync()`/`CommitTransactionAsync()` (rollback
>    nếu có lỗi giữa chừng khi ghi các dòng hợp lệ — atomic cho phần được ghi,
>    không đụng gì nếu `validRows` rỗng). Dòng bị bỏ qua trả về trong
>    `DeviceImportConfirmResultDto.SkippedRows` (`RowNumber`/`DeviceCode`/
>    `Errors`) + `SkippedCount`, để FE báo cho người dùng biết dòng nào không
>    được tạo và lý do — **preview không đổi**, vẫn hiển thị đầy đủ dòng lỗi như
>    cũ để người dùng sửa file trước khi confirm nếu muốn. Với từng dòng hợp lệ:
>    - Gọi thẳng `IDeviceService.CreateAsync` (tái dùng nguyên logic tạo Device
>      đã có, không viết lại) với `DeviceCode`/`SerialNumber`/`Note`/`PurchaseDate`
>      lấy từ Excel, còn các field **`[Required]` mà Excel không có** thì theo
>      đúng quyết định người dùng (2026-07-10): `DeviceName` = lấy theo `MQL`,
>      `Manager` để trống, `Emails` để rỗng (2026-07-11: `List<DeviceEmailInputDto>`
>      rỗng, thay cho `Email = string.Empty` trước đó), `DepreciationMonths` mặc
>      định **60 tháng** (hằng số `DefaultDepreciationMonths` trong
>      `DeviceImportService`) — `Status` mặc định `PendingUse`. Cần sửa lại tay
>      qua màn hình Device sau nếu thiếu thông tin.
>    - Nếu dòng có `MQL Cũ` (thiết bị dự tính bị thay thế): **KHÔNG** tự chuyển
>      máy nữa (2026-07-11, đổi quyết định trước đó). `ConfirmAsync` chỉ thêm 1
>      gợi ý vào `DeviceImportConfirmResultDto.PendingTransfers`
>      (`DeviceImportPendingTransferDto { NewDeviceId, NewDeviceCode, OldDeviceId,
>      OldDeviceCode }`) — lúc import chỉ là dự tính máy cũ nào sẽ được thay,
>      thực tế lắp đặt có thể đổi ý. **Cùng lúc đó (2026-07-11, thêm sau) cũng
>      lưu quan hệ này xuống DB** qua `CreateDeviceDto.ReplacesOldDeviceId` — xem
>      ghi chú riêng "Lưu lại gợi ý máy thay thế xuống DB" ngay phía trên mục
>      "Chọn máy mới để chuyển", vì `PendingTransfers` chỉ trả 1 lần trong
>      response Confirm còn `ReplacesOldDeviceId` tồn tại lâu dài để tra lại sau
>      qua `GET /api/Device/{oldId}/replacement-suggestion`. FE dùng gợi ý này để
>      **điền sẵn nhưng cho sửa** trên màn hình "Chuyển máy" (chọn `NewDeviceId`
>      khác nếu cần qua `GET /api/Device/available`), người dùng phải tự bấm nút
>      "Chuyển" thì mới thật sự gọi `POST /api/TransferHistory` (nghiệp vụ
>      chuyển máy đầy đủ vẫn y nguyên như mô tả ở §1, chỉ đổi **thời điểm** gọi
>      — không còn tự động
>      trong lúc import).
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

> **Import Cấu hình thiết bị hàng loạt từ file kiểm kê Tanium (2026-07-10, đã
> làm)**: khác hẳn import ở trên (import Device MỚI) — feature này chỉ **cập
> nhật** `DeviceConfiguration` cho Device **đã tồn tại sẵn**, không tự tạo
> Device mới (quyết định người dùng: file Tanium không có Xưởng/Loại thiết
> bị/Nhà cung cấp/Ngày mua nên không đủ dữ liệu tạo Device hợp lệ). Controller/
> Service riêng: `DeviceConfigurationImportController`
> `/api/DeviceConfigurationImport` (`preview`/`confirm`, cùng pattern 2 bước
> như `DeviceImport`) + `DeviceConfigurationImportService`.
>
> **Mẫu file Tanium — 8 cột cố định**: `Computer Name`, `Tanium Client IP
> Address`, `Last Logged In User` (**bỏ qua**, không lưu — theo quyết định
> người dùng), `Manufacturer` → `Maker`, `Model` → `Model`, `CPU` → `Cpu`,
> `RAM` → `Ram`, `Size` → `HardDrive`. Dòng 1 header.
>
> **Chỉ import đúng 5 "họ" mã** (2026-07-10, chốt lại sau khi rà toàn bộ ~900
> dòng dữ liệu Tanium thật của người dùng): `YDC`, `YLC`, `YDF`, `AC`, `TYC`.
> Computer Name không khớp 1 trong 5 họ này (VD `Mayhethong`,
> `VNDASOLARWINDS`, `BTTB-ATO-xx`, `QAKENSA-MAE-xx`, `DESKTOP-xxxxxxx`,
> `NUC0xx`, `ACLF/ACELF/ALF-xx`, `YCM-xx`, `yazaki-xx`, `DASVRFAST`, và **toàn
> bộ họ `DA` — cả `DA-<serial>` lẫn `DA-ENG-<serial>`**...) → **loại thầm
> lặng** khỏi kết quả trả về (không phải lỗi, không đưa vào `Rows`), đếm số
> dòng bị loại vào `OutOfScopeSkippedCount` của response preview để người
> dùng biết. **Lịch sử quyết định họ `DA`**: ban đầu chỉ định loại dạng 3 đoạn
> `DA-ENG-<serial>` (giữ lại `DA-<serial>` 2 đoạn), sau đó người dùng chốt lại
> (2026-07-10) là loại bỏ **toàn bộ** họ `DA` khỏi phạm vi import lần này.
>
> **Tách "Computer Name" → Mã/Tên** (`DeviceConfigurationImportService.ParseComputerName`,
> đã verify khớp 100% với toàn bộ dữ liệu thật bằng script độc lập trước khi
> tích hợp, gồm cả các case bẫy nêu dưới):
> 1. Bỏ hậu tố domain (phần sau dấu `.` đầu tiên, VD `.yev.vn`).
> 2. Tách theo dấu `-`.
> 3. Đoạn đầu khớp đúng 1 trong 4 tiền tố **họ chuẩn** `YDC`/`YLC`/`YDF`/`TYC`
>    theo sau bởi số (số có thể **rỗng** — case hiếm `YDC-TVSOC`/`YDF-011`
>    không có số) → Mã = chèn dấu `-` giữa chữ và số (`YDC1877` → `YDC-1877`),
>    Tên = phần còn lại nối bằng `-` (VD `TVCBSX`).
> 4. Đoạn đầu khớp regex `^AC\d+[A-Za-z]?$` (`AC` + số + tối đa 1 chữ cuối,
>    VD `AC81`, `AC90`, `AC90A/B/D/E`, `AC95`) → **họ AC**: mã gốc đã có dấu
>    `-` sẵn bên trong: Mã = nối 2 đoạn đầu (`AC90B-2446`), Tên = giống hệt
>    Mã, đoạn còn lại (VD `J19`) bị **bỏ**. **Áp dụng thống nhất theo tiền tố
>    "AC"** (không theo cấu trúc chữ/số từng đoạn) — bản đầu có bug: `AC81`/
>    `AC90`/`AC95` vô tình khớp "họ chuẩn" (chữ-rồi-số thuần) trong khi
>    `AC90A/B/D/E` thì không (có chữ xen sau số), khiến cùng 1 họ AC bị tách
>    2 kiểu khác nhau — đã sửa bằng cách nhận diện theo tiền tố `AC` trước,
>    không dựa cấu trúc regex chung. **Không khớp** `ACLF`/`ACELF`/`ALF` (chữ
>    ngay sau `AC`, không phải số — khác họ, bị loại ở bước lọc allowlist).
> 5. Còn lại (không khớp bước 3–4, bao gồm **toàn bộ họ `DA`** — cả
>    `DA-<serial>` 2 đoạn lẫn `DA-ENG-<serial>` 3 đoạn) → ngoài phạm vi 5 họ,
>    loại thầm lặng (mục trên).
>
> **Không tìm thấy Device theo mã tách được** → báo lỗi dòng đó ở Preview,
> **không tự tạo Device mới** (quyết định người dùng). Có check trùng mã tách
> được trong cùng 1 file import (báo lỗi nếu 2 dòng parse ra cùng 1 mã) — cố
> ý **không** tự động lấy dòng cuối/mới nhất khi trùng: dữ liệu thật cho thấy
> có Computer Name họ AC (VD `AC90B-2446-J19`, `AC90D-2698-A04`) xuất hiện 2
> lần với **CPU/Model khác hẳn nhau** (đổi máy vật lý nhưng giữ nguyên tên
> theo vị trí/cổng mạng) — tự tin dùng dòng cuối có thể ghi nhầm cấu hình
> sang thiết bị khác, nên chặn để người dùng tự kiểm tra là lựa chọn an toàn
> hơn.
>
> **Dòng lỗi Tanium** (`"TSE-Error: Failed to send..."` xuất hiện ở bất kỳ cột
> IP/Manufacturer/Model/Cpu/Ram/Size nào) → tự động phát hiện qua prefix
> `"TSE-Error"`, báo lỗi dòng đó ở Preview, không update gì.
>
> **Gán IP Tanium báo cáo được cho Device** (`Tanium Client IP Address`, chỉ khi
> cột này có giá trị — để trống thì bỏ qua, không lỗi/không cảnh báo): tra
> `IpAddress.IpAddress1` khớp đúng giá trị, `!IsDeleted`. Quy tắc **đã đổi**
> (2026-07-10, chốt lại lần 2 — thay thế hoàn toàn quy tắc chặn-theo-status cũ;
> **2026-07-11: đổi tiếp** — không còn khái niệm "IP chính" nên hành vi gỡ IP
> khác của Device cũng bỏ, xem bên dưới):
> - Khớp được `IpAddress` trong DB (bất kể đang `Available`, `Assigned` cho
>   thiết bị khác, `Reserved` hay `Disabled`) → **luôn** gán IP đó cho Device
>   này, kể cả khi phải "cướp" lại từ 1 Device khác đang giữ nó — không còn
>   phân biệt theo `Status` như bản đầu.
> - **Không** khớp `IpAddress` nào trong DB (chưa cấp phát qua `IpPrefix`) →
>   **không chặn dòng**, chỉ bỏ qua việc cập nhật IP và thêm 1 dòng vào
>   `Warnings` của row đó để báo cho người dùng biết (Cpu/Ram/Model/tạo-cập
>   nhật `DeviceConfiguration` vẫn chạy bình thường).
> - Việc gán/cướp IP xử lý trong
>   `DeviceConfigurationImportService.ReassignDeviceIpAsync` (không gọi chéo
>   `IpAddressService`, cùng `IAssetUnitOfWork` nên truy cập thẳng repo, giống
>   pattern `DeviceService`/`TransferHistoryService`): gán IP mới
>   `DeviceId`+`Status=Assigned` — do `IpAddress.DeviceId` là FK 1 chiều nên
>   việc set field này tự động "cướp" khỏi Device cũ đang giữ IP đó mà không
>   cần đụng gì thêm ở phía Device cũ. **Từ 2026-07-11, KHÔNG còn gỡ các IP
>   khác của chính Device đang import** (khác hành vi cũ khi chỉ có 1 "IP
>   chính") — Device giờ hỗ trợ nhiều IP cùng lúc nên IP Tanium báo cáo chỉ
>   được **thêm vào**, không thay thế IP đã gán thủ công trước đó.
>
> **Update `DeviceConfiguration` không đè mất field khác**: nếu Device đã có
> `DeviceConfiguration`, chỉ ghi đè đúng 5 field Tanium báo cáo được
> (`Cpu/Ram/HardDrive/Maker/Model`, và **chỉ đè nếu giá trị mới không rỗng** —
> giữ nguyên giá trị cũ nếu cột đó trống ở dòng import), toàn bộ field còn lại
> (`Mainboard/Monitor/Mouse/Keyboard/Headphone/Speaker/Ups/Psu/Os/Vga/
> PowerAdapter/WirelessCard/Nic/Other/Note`) copy nguyên từ config hiện có
> (vì `UpdateDeviceConfigurationDto` yêu cầu gửi đủ field, không hỗ trợ patch
> từng phần). Nếu Device **chưa có** `DeviceConfiguration` → tạo mới qua
> `IDeviceConfigurationService.CreateAsync` (tự kèm snapshot "Cấu hình ban
> đầu" như bình thường, xem §1 mục `DeviceConfigurationInitial`).
>
> **Confirm chạy trong 1 transaction** (`BeginTransactionAsync`/
> `CommitTransactionAsync`, rollback nếu lỗi giữa chừng) — validate lại toàn
> bộ từ đầu theo dữ liệu DB hiện tại trước khi ghi (giống `DeviceImportService`),
> nếu còn dòng lỗi thì **không ghi gì cả**, ném `DomainException` kèm `Errors`
> dạng `"Dòng {n}: {lý do}"`.
>
> **Permission**: dùng chung `Asset.DeviceConfiguration.Update` cho cả
> `preview` và `confirm` (không tách permission riêng cho import).
>
> **File Excel không hợp lệ/hỏng bị crash 500 (2026-07-11, đã fix)**: `ParseXlsx`
> (cả ở đây lẫn `DeviceImportService`, đổi tên từ `ParseExcel`) gọi
> `new XLWorkbook(stream)` — nếu file upload không phải `.xlsx` hợp lệ (VD đổi
> đuôi từ `.xls`, hoặc file bị hỏng khi tải lên) thì `ClosedXML` ném thẳng
> `FileFormatException`/exception khác ra ngoài, rơi vào nhánh `default` của
> `HandleExceptionMiddleware` → trả 500 "An unexpected error occurred" chung
> chung. Đã bọc `try/catch` quanh `new XLWorkbook(stream)`, quy về
> `DomainException` (400) với thông báo tiếng Việt rõ ràng ("File Excel không
> hợp lệ hoặc bị hỏng...") — áp dụng cho cả 2 service import Excel trong module.
> **Nguyên nhân thật của lỗi này khi phát sinh**: file kiểm kê Tanium xuất ra
> thực chất là `.csv` nhưng bị hiểu nhầm/đổi đuôi thành `.xlsx` → dẫn tới thêm
> tính năng hỗ trợ `.csv` native ngay bên dưới, thay vì chỉ dừng ở việc trả lỗi
> rõ ràng hơn.
>
> **Hỗ trợ upload `.csv`** (2026-07-11, thêm sau, xem chi tiết cơ chế
> `CsvFileHelper` ở mục Import Device hàng loạt phía trên — dùng chung 100%):
> `PreviewAsync` nhận thêm `fileName?`, chọn `ParseXlsx` hay `ParseCsv` theo đuôi
> file. Cột Tanium không có kiểu Date nên không có khác biệt đặc biệt nào giữa
> 2 nhánh ngoài nguồn đọc.
>
> Đã test thật trên DB (tạo 1 Device TEST + gán IP Available thật, import cấu
> hình lần đầu → tạo `DeviceConfiguration` mới + gán đúng IP; sửa tay thêm
> `Mainboard` qua API thường rồi import lại với `Ram` khác → xác nhận chỉ
> `Ram` đổi, `Mainboard` giữ nguyên, `ipReassignedCount=0` vì IP không đổi;
> test âm: mã không tồn tại bị chặn, dòng `TSE-Error` bị chặn, gửi cả batch
> có dòng lỗi bị chặn toàn bộ không ghi gì; dọn sạch: xoá `DeviceConfiguration`
> + soft-delete Device TEST, xác nhận IP tự gỡ về `Available`).

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
    `DeviceCode/Manager/PurchaseDate/IpAddress/Email/SupplierName/Note/IsOutsourced?`
    (2026-07-09: thêm `IsOutsourced?` — lọc đúng true/false, bỏ qua nếu null;
    2026-07-11: thêm `Email?`, kích hoạt thật `IpAddress?` — trước đó field này
    có trong DTO nhưng chưa được dùng trong `GetDevicesForGridAsync`), cả 2 đều
    Contains khớp bất kỳ IP/email nào của Device, `SerialNumber?`(`Contains`),
    `IsUseUsb?` (2026-07-09, thêm sau — exact match), `SortDeviceCodeAscending?`
    (2026-07-10, thêm sau — `null` giữ mặc định `OrderByDescending(PurchaseDate)`,
    `true`/`false` = sort theo `DeviceCode` tăng/giảm dần, ghi đè sort mặc định).
    **`DeviceCode`/`Manager`/`SupplierName` đổi từ `StartsWith` sang `Contains`**
    (2026-07-11, theo yêu cầu người dùng — kiểu filter "chỉ cần chứa từ khoá" ở
    bất kỳ vị trí nào là ra kết quả, đồng nhất với `Note`/`SerialNumber`/
    `IpAddress`/`Email` vốn đã `Contains` sẵn). `PurchaseDate` vẫn giữ nguyên
    `Contains` trên `ToString()` như cũ (không đổi).
  - `DeviceGridDto` (1 dòng grid): gộp tên Branch/Supplier/DeviceType +
    `IpAddresses: List<string>`/`Emails: List<string>` (2026-07-11: đổi từ
    field đơn `IpAddress?`/`Email?` sang list — xem ghi chú multi-IP/multi-Email
    §1) + `StatusText` + `IsOutsourced` (2026-07-09: thêm cột này vào grid,
    trước đó chỉ có ở `DeviceDto`/Create/Update, grid-list thiếu) +
    `SerialNumber?`/`IsUseUsb` (2026-07-09, thêm sau).
  - `DeviceDto` (GetById, đầy đủ): gộp tên Branch/DeviceType/Supplier + `StatusText`
    + `IpAddresses: List<DeviceIpAddressDto>` (`Id`/`IpAddress`) +
    `Emails: List<DeviceEmailDto>` (`Id`/`Email`/`Note`) (2026-07-11: thay
    `IpAddressId?`/`IpAddress?`/`Email` đơn — xem ghi chú §1) + `ExpirationDate`
    tính toán + `SerialNumber?`/`IsUseUsb` (2026-07-09).
  - `CreateDeviceDto`/`UpdateDeviceDto`: `DeviceCode/DeviceName/Manager`
    `[Required]`, `Emails: List<DeviceEmailInputDto>` `[Required][MinLength(1)]`
    (mỗi item `Email [Required][EmailAddress]` + `Note?`, 2026-07-11 — thay
    field `Email` đơn), `DeviceTypeId/SupplierId/BranchId` `[Required]`,
    `PurchaseDate` `[Required]`, `DepreciationMonths` `[Required][Range(1,600)]`,
    `IsOutsourced` (bool), `Status` `[Range(0,3)]`, `Note?`,
    `IpAddressIds: List<int>` (2026-07-11, thay `IpAddressId?` đơn — mỗi Id phải
    là IP `Available`, không giới hạn số lượng), `SerialNumber?`
    (`[StringLength(100)]`, 2026-07-09), `IsUseUsb` (bool, 2026-07-09). **Không có**
    `ExpirationDate` (server tự tính, xem ghi chú §1).
  - `DeviceIpAddressDto` (`Id`/`IpAddress`), `DeviceEmailDto` (`Id`/`Email`/`Note`),
    `DeviceEmailInputDto` (`Email`/`Note`, dùng cho Create/Update) — 3 DTO nhỏ mới
    2026-07-11, đi kèm entity `DeviceEmail`.
- **DeviceSoftwares/**: `DeviceSoftwareDto`, `CreateDeviceSoftwareDto` (+`[Required]` Device/Software), `UpdateDeviceSoftwareDto`.
- **Softwares/**: `SoftwareDto` (Id/Code/Name/Type?/Publisher?/Quantity?/Priority?/GroupId/GroupName —
  gộp tên `SoftwareGroup`), `CreateSoftwareDto` (+`[Required]` Code/Name/GroupId), `UpdateSoftwareDto`.
- **SoftwareGroups/**: `SoftwareGroupDto` (Id/Code/Name), `CreateSoftwareGroupDto` (+`[Required]`), `UpdateSoftwareGroupDto`.
- **IpAddresses/**: `IpAddressDto` (gộp `DeviceCode` + `StatusText` + `Prefix*` từ
  `IpPrefix`; 2026-07-11: bỏ `ServerIp`, `DeviceCode`="Khác" khi Status=1), `Update
  IpAddressDto` (2026-07-11, tạo lại **thu hẹp** — chỉ `Id`/`Status`/`Note`),
  `IpAddressFilterRequest` (`Keyword/Status/IsInUse/DeviceId`, **không có** `all` vì
  bảng pool lớn — 2026-07-11: thêm `IsInUse?` lọc gộp đang/chưa sử dụng: `true`→
  `Status != Available`, `false`→`Status == Available`, AND với `Status` nếu gửi cả 2),
  `AssignIpAddressDto` (`DeviceId` `[Required]`). **Không còn**
  `CreateIpAddressDto` (2026-07-11, xoá — không tạo tay từng IP).
- **IpPrefixes/**: `IpPrefixDto` (2026-07-11: **bỏ** `IpAddressCount` (luôn = 255) →
  thay bằng `UsedIpCount` (IP đang dùng, `Status != Available`) + `AvailableIpCount`
  (IP chưa dùng, `Status == Available`)), `CreateIpPrefixDto`
  (`Prefix` `[Required]` + `[RegularExpression]` 3 octet, + SubnetMask/Gateway/DNS/
  Description dùng chung cho cả subnet — 2026-07-11: `CreateAsync` validate thêm các
  field IP hợp lệ + Gateway cùng subnet qua `NetworkHelper`, xem ghi chú §1).
  **Không còn** `UpdateIpPrefixDto` (2026-07-11, xoá — không còn Update cho IpPrefix,
  đổi prefix/subnet phải xoá + tạo lại, xem ghi chú §1).
- **DeviceConfigurations/**: `DeviceConfigurationDto` (gộp `DeviceCode`, đủ 20 field
  linh kiện), `CreateDeviceConfigurationDto` (`DeviceId` `[Required]`, còn lại đều
  optional), `UpdateDeviceConfigurationDto` (giống Create + `Id`; field `DeviceId`
  vẫn còn trong DTO nhưng **không còn được đối chiếu/dùng để làm gì trong
  `UpdateAsync`** — 2026-07-11, đã bỏ check `config.DeviceId != request.DeviceId`
  vì `DeviceId` chưa từng thực sự được ghi lại ở Update, check chỉ gây lỗi giả
  `DomainException` khi client gửi sai/thiếu `deviceId` cho 1 lần sửa cấu hình
  bình thường; `id` trên route đã định danh đúng bản ghi), `DeviceConfigurationInitialDto` (20 field + `CreatedAt`),
  `DeviceConfigurationHistoryDto` (20 field + `EditedAt`/`EditedBy`) — 2 DTO cuối
  không có Create/Update tương ứng (tự sinh, xem ghi chú §1).
- **Devices/** (báo cáo): `DeviceReportFilterRequest` (`DeviceTypeId?/BranchId?/Keyword?`,
  tất cả optional), `DeviceReportItemDto` (`Stt/DeviceCode/DeviceName/IpAddress/
  PurchaseDate/ExpirationDate/IsExpired/FinancialPeriod/Note` — `IpAddress` vẫn
  là 1 `string?` để giữ nguyên contract cho báo cáo in ấn, nhưng từ 2026-07-11
  chứa **toàn bộ IP đang gắn nối bằng `", "`** (`string.Join`) thay vì chỉ IP
  đầu tiên — xem công thức
  `FinancialPeriod` ở ghi chú §1).
- **TransferHistories/**: `TransferHistoryDto` (gộp `OldDeviceCode/OldDeviceName/
  NewDeviceCode/NewDeviceName`), `CreateTransferHistoryDto` (`OldDeviceId`/
  `NewDeviceId` `[Required]`, `Note?`) — **không có** Update/Delete DTO (audit-log,
  xem ghi chú §1).

---

## 3. Repositories & UnitOfWork

- `IAssetUnitOfWork : IUnitOfWork` gom **15 repository**: `Devices`, `Branches`,
  `Softwares`, `SoftwareGroups`, `Suppliers`, `DeviceConfigurations`,
  `DeviceConfigurationInitials`, `DeviceConfigurationHistories`, `DeviceEmails`
  (2026-07-11), `DeviceSoftwares`, `DeviceTypes`, `IpAddresses`, `IpPrefixes`,
  `TransferHistories`, `AuditTrails`.
- Tất cả repo hiện **generic thuần** (class con rỗng, chỉ kế thừa
  `GenericRepository<T, AssetDbContext>`) — chưa có method đặc thù nào.
- `AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>` inject đủ 15 repo qua constructor.

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
| IpAddress | `IpAddressService` (2026-07-11: bỏ Create/Delete thủ công, Update chỉ đổi Status+Note; 3 trạng thái mới; bỏ ServerIp) | `IpAddressController` `/api/IpAddress` | grid-list, `available` (2026-07-09, không phân trang), {id}, PUT `{id}` (chỉ Status+Note), `{id}/assign`, `{id}/unassign` (**không còn** POST/DELETE, **không có** `all`/`generate-range`) | `[RequirePermission("Asset.IpAddress.View/.Update/.Assign")]` |
| IpPrefix | `IpPrefixService` (POST tự sinh 255 IP con; 2026-07-11: bỏ Update, Delete cascade IP con chưa dùng) | `IpPrefixController` `/api/IpPrefix` | grid-list, all, {id}, POST, DELETE (**không còn** PUT) | `[RequirePermission("Asset.IpPrefix.View/.Create/.Delete")]` |
| DeviceConfiguration | `DeviceConfigurationService` (CRUD + snapshot/history) | `DeviceConfigurationController` `/api/DeviceConfiguration` | `by-device/{deviceId}` (trả `null` nếu chưa có), POST, PUT, DELETE (xoá cứng, cascade Initial+History), `{configId}/initial` (GET), `initial/{id}` (DELETE), `{configId}/history` (GET list) — **không có** `grid-list`/`all` | `[RequirePermission("Asset.DeviceConfiguration.*")]` (initial/history GET→`.View`, DeleteInitial→`.Delete`) |
| TransferHistory | `TransferHistoryService` (2026-07-09, đã làm — "chuyển máy") | `TransferHistoryController` `/api/TransferHistory` | POST (thực hiện chuyển máy), `device/{deviceId}` (GET, lịch sử chuyển máy của 1 thiết bị) — **không có** grid-list/all/PUT/DELETE (audit-log, không sửa/xoá sau khi tạo) | `[RequirePermission("Asset.TransferHistory.Create/.View")]` |
| DeviceImport | `DeviceImportService` (2026-07-10, mới làm — import Device hàng loạt từ Excel) | `DeviceImportController` `/api/DeviceImport` | `preview` (POST multipart file, chỉ đọc + validate, **không ghi DB**), `confirm` (POST, validate lại rồi ghi DB trong 1 transaction) | `[RequirePermission("Asset.Device.Create")]` (dùng chung, không tách permission riêng) |
| DeviceConfigurationImport | `DeviceConfigurationImportService` (2026-07-10, mới làm — import cấu hình hàng loạt từ file Tanium, chỉ update Device đã có sẵn) | `DeviceConfigurationImportController` `/api/DeviceConfigurationImport` | `preview` (POST multipart file, không ghi DB), `confirm` (POST, validate lại rồi ghi DB trong 1 transaction) | `[RequirePermission("Asset.DeviceConfiguration.Update")]` (dùng chung, không tách permission riêng) |
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
- **Read-only + Update hạn chế + action gán/gỡ (không có Create/Delete thủ công)**
  → xem `IpAddressService` (IpAddress → Device, nullable; IpAddress → IpPrefix, bắt
  buộc): `Status` giữ bất biến theo `DeviceId` (xem ghi chú `IpAddressStatus` ở §1).
  2026-07-11 (quyết định người dùng): bỏ hẳn `CreateAsync`/`DeleteAsync` — IpAddress
  chỉ sinh/xoá hàng loạt qua `IpPrefixService`, không cho thêm/xoá tay từng địa chỉ.
  Còn `GetPagedAsync`/`GetAvailableAsync`/`GetByIdAsync` (đọc), `UpdateAsync` **thu
  hẹp** chỉ đổi `Status`+`Note` (giữ bất biến: IP có `DeviceId` không đổi Status tay;
  IP trống chỉ cho `Available`↔`AssignedExternal`), + 2 action `AssignToDeviceAsync`/
  `UnassignAsync` đổi `DeviceId`+`Status`. Lưu ý: `StatusText` (và `DeviceCode`="Khác"
  khi Status=1) trong `Expression<Func<>>` của `ToPagedResponseAsync` phải viết bằng
  ternary lồng nhau thay vì gọi method C#, vì EF Core dịch expression đó sang SQL và
  không hỗ trợ gọi method tuỳ ý.
- **Master record tự sinh/dọn hàng loạt record con** → xem `IpPrefixService`
  (IpPrefix 1-N IpAddress): `CreateAsync` tạo 1 `IpPrefix` xong (`AddAsync` +
  `SaveChangesAsync` để có `Id`), build luôn danh sách 255 `IpAddress` con
  (`n=1..255`) bằng LINQ `Enumerable.Range`, rồi `AddRangeAsync` +
  `SaveChangesAsync` **1 lần** cho cả batch (không loop insert từng bản ghi).
  Không cần check trùng vì Prefix vừa tạo chắc chắn chưa có IP con nào.
  `DeleteAsync` (2026-07-11, đổi) làm ngược lại — chặn nếu còn IP con đang gắn
  Device (`DomainException`), nếu không thì cascade soft-delete toàn bộ IP con
  chưa dùng cùng lúc với soft-delete Prefix.
- **Field tính toán + điều khiển quan hệ 1-N ngược chiều (owning side là bảng
  khác)** → xem `DeviceService` (Device 1-N IpAddress, nhưng Device không giữ FK —
  `IpAddress.DeviceId` mới là FK): `CreateAsync`/`UpdateAsync` tự tính
  `ExpirationDate = PurchaseDate.AddMonths(DepreciationMonths)` (không nhận từ
  client); gán/gỡ **nhiều** IP (2026-07-11, không còn khái niệm "IP chính")
  qua `SyncIpAddressesAsync` — đối chiếu diff giữa `IpAddressIds` mới với
  `FindAsync(x => x.DeviceId == device.Id && !x.IsDeleted)` hiện có, chỉ
  `Update` field `DeviceId`/`Status` của những IP thực sự thêm/bớt (không gọi
  chéo sang `IpAddressService` — cùng `IAssetUnitOfWork` nên truy cập thẳng
  repo `_unitOfWork.IpAddresses` là đủ). Tương tự `SyncEmailsAsync` đối chiếu
  `Emails` mới với `DeviceEmails` hiện có (so khớp theo text, xem ghi chú §1).
  `UpdateAsync` gom **mọi** thay đổi (Device + IP/Email thêm/bớt) vào **1 lần
  `SaveChangesAsync`** duy nhất ở cuối; `CreateAsync` cần 2 lần Save vì phải có
  `Device.Id` trước mới gán ngược được cho IP/Email.
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

**Đã xong:** CRUD Branch/DeviceType/Supplier/Software/SoftwareGroup/Device (đầy
đủ, kể cả chọn/gán IP); IpAddress (2026-07-11: chỉ đọc + gán/gỡ, không còn
Create/Update/Delete thủ công) + IpPrefix (2026-07-11: chỉ Create/Delete, không
còn Update); CRUD DeviceSoftware + picker
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
(2026-07-09, đã làm, xem ghi chú §1; hành vi IP cập nhật lại 2026-07-11 — chuyển
**toàn bộ IP** thay vì chỉ 1 IP chính, xem ghi chú multi-IP §1) — nghiệp vụ
"chuyển máy": chuyển toàn bộ IP đang gắn + `DeviceSoftware` từ máy cũ sang máy
mới (không chuyển `DeviceConfiguration`),
máy cũ tự chuyển `PendingUse`/`PendingLiquidation` (tuỳ đã hết hạn hay chưa),
tạo 1 dòng `TransferHistory` audit-log. Đã test thật trên DB (tạo thiết bị TEST,
verify đủ 2 kịch bản trạng thái + swap IP + dedup phần mềm + reject trùng Id,
rồi soft-delete thiết bị TEST — dòng `TransferHistory` test không xoá được do
thiết kế không có API xoá).

`POST /api/DeviceImport/preview` + `POST /api/DeviceImport/confirm` (2026-07-10,
đã làm, xem ghi chú §1) — import Device hàng loạt từ file Excel mẫu có sẵn của
người dùng (13 cột `MQL/Xưởng/Loại Thiết Bị/Nhà Cung Cấp/Ngày Mua/Ghi Chú/Số
SerialNumber/Hãng/Model/CPU/RAM/Ổ Cứng/MQL Cũ`, 2026-07-11: thêm 5 cột cấu hình
Hãng/Model/CPU/RAM/Ổ Cứng — tuỳ chọn, tạo kèm `DeviceConfiguration` nếu có),
có bước preview validate trước khi ghi DB, `MQL Cũ` tái dùng nguyên nghiệp vụ
"chuyển máy" của `TransferHistoryService`. Thêm package `ClosedXML` 0.105.0
vào `Asset.Application` để đọc `.xlsx`; thêm constructor `DomainException(string
message, List<string> errors)` ở `Shared.Core` để trả lỗi theo từng dòng qua
`ApiResponse.Failure.Errors`.

`POST /api/DeviceConfigurationImport/preview` + `.../confirm` (2026-07-10, đã
làm, xem ghi chú §1) — import cấu hình phần cứng hàng loạt từ file kiểm kê
Tanium (`Computer Name/Tanium Client IP Address/Manufacturer/Model/CPU/RAM/
Size`), tách `Computer Name` thành Mã/Tên theo thuật toán đã verify khớp dữ
liệu thật, chỉ update Device đã có sẵn (không tự tạo Device mới), tự gán IP
chính theo `Tanium Client IP Address` nếu khớp IP đang `Available` trong hệ
thống. Đã test thật trên DB (tạo Device TEST, import lần đầu tạo Configuration
mới + gán IP, import lại xác nhận chỉ update field Tanium báo cáo được và giữ
nguyên field khác, dọn sạch dữ liệu test sau khi xong).

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

**Device hỗ trợ nhiều IP + nhiều Email (2026-07-11, đã làm)** — xem ghi chú chi
tiết ở §1: bỏ khái niệm "IP chính" (`IpAddressId?` đơn) trên Device, thay bằng
`IpAddressIds: List<int>`; thay cột `Device.Email` đơn bằng bảng `DeviceEmails`
(1-N, không unique). Kéo theo: `DeviceFilterRequest` thêm filter `Email?`, kích
hoạt thật filter `IpAddress?` (trước đó có field nhưng chưa dùng);
`TransferHistoryService` chuyển toàn bộ IP thay vì 1 IP chính;
`DeviceConfigurationImportService.ReassignDeviceIpAsync` (import Tanium) không
còn gỡ IP khác của Device khi gán IP mới. Migration `AddDeviceEmailsMultiIp`
(`Asset.Infrastructure/Migrations/20260711013130_AddDeviceEmailsMultiIp.cs`) đã
backfill 5218/5225 `Device.Email` cũ sang `DeviceEmails` trước khi drop cột,
verify khớp 100% số dòng, đã apply lên DB thật. Đã verify EF Core dịch đúng
toàn bộ query mới (projection `List<string>` từ collection navigation, filter
`Any()`, `string.Join` in-memory cho báo cáo) trên DB thật bằng script đọc
read-only riêng (không qua HTTP do user hiện tại không có quyền
`Asset.Device.View` để test qua API).

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
