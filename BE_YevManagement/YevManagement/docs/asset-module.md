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
| `Device` | `DeviceCode`(unique), `DeviceName`, `DeviceTypeId`, `SupplierId`, `BranchId`, `GroupId?`, `DepartmentId?`, `Manager`, `PurchaseDate`, `DepreciationMonths`, `ExpirationDate?`(**tính toán**, không nhập tay), `IsOutsourced`, `Status`, `Note?`, `SerialNumber?`(unique khi có giá trị), `IsUseUsb`, `SuggestedNewDeviceId?`(tự tham chiếu, set trên máy CŨ, gợi ý máy MỚI nào sẽ thay nó — đổi hướng 2026-07-13, xem §1.8) | N-1 Branch/DeviceType/Supplier; N-1 DeviceGroup/DeviceDepartment (optional, xem §1.14); N-1 SuggestedNewDevice (tự tham chiếu, optional); 1-1 DeviceConfiguration; 1-N IpAddresses (nhiều IP/device), 1-N DeviceEmails, DeviceSoftwares, TransferHistory(old/new) | **Có** |
| `DeviceEmail` | `DeviceId`, `Email`, `Note?` | N-1 Device | **Có** |
| `Branch` | `BranchCode`(unique), `BranchName` | 1-N Devices | **Có** |
| `DeviceGroup` | `GroupCode`(unique), `GroupName` | 1-N Devices | **Có** |
| `DeviceDepartment` | `DepartmentCode`(unique), `DepartmentName` | 1-N Devices | **Có** |
| `Supplier` | `SupplierCode`(unique), `SupplierName` | 1-N Devices | **Có** |
| `DeviceType` | `TypeCode`(unique), `TypeName` | 1-N Devices | **Có** |
| `IpAddress` | `IpAddress1`(unique **toàn cục**, cột `IpAddress`), `DeviceId?`, `IpPrefixId`(bắt buộc), `Status`, `Note?` | N-1 Device (nullable), N-1 IpPrefix (**bắt buộc**) | **Có** |
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

### 1.1. `IpAddress.Status` — enum `IpAddressStatus` (`Asset.Domain/Enums/IpAddressStatus.cs`)

3 giá trị: `0=Available` (chưa gán), `1=AssignedExternal` (đã gán nhưng **không**
có `DeviceId` — IP đang dùng bởi 1 thiết bị ngoài hệ thống; hiển thị
`DeviceCode`="Khác"), `2=Assigned` (đã gán và **có** `DeviceId` thật).

**Bất biến:** `Status==Assigned(2)` ⟺ `DeviceId != null`; `Status==Available(0)/
AssignedExternal(1)` ⟺ `DeviceId == null`.

Server tự derive Status khi gán/gỡ thiết bị (gán → `Assigned(2)` + set `DeviceId`;
gỡ → `Available(0)` + `DeviceId=null`). `IpAddressService.UpdateAsync` (chỉ đổi
`Status`+`Note`) chỉ cho chuyển tay giữa `Available(0)` ↔ `AssignedExternal(1)`
khi IP chưa gắn thiết bị; IP đang gắn (`DeviceId != null`) chỉ đổi được `Note`,
muốn đổi Status phải gỡ gán trước.

> **Migration `UpdateIpAddressStatusRemoveServerIp` — CHƯA APPLY lên DB thật**
> (người dùng tự chạy sau khi review). Backfill: `Status = CASE WHEN DeviceId
> IS NOT NULL THEN 2 (Assigned) WHEN Status <> 0 THEN 1 (AssignedExternal) ELSE
> 0 (Available) END` — IP đang có thiết bị → 2; IP không thiết bị nhưng trước
> đó không phải Available (cũ 1/2/3) → 1 (coi như đang dùng bởi thiết bị ngoài,
> giữ khỏi pool trống); còn lại → 0. Cùng migration này cũng DROP cột
> `IpAddress.ServerIp` (đã xoá khỏi entity/DbContext/`IpAddressDto`).

> **Unique index `IX_DiaChiIPs_DiaChi` trên `IpAddress1` và `IX_TienToIPs_TienTo`
> trên `IpPrefix.Prefix` đều là unique toàn cục, không lọc `IsDeleted`.** Mọi
> kiểm tra trùng lặp (Create/Update) phải so khớp trên **toàn bộ bản ghi** kể cả
> đã soft-delete, không chỉ lọc `!IsDeleted` (khác với phần lớn entity khác
> trong module).

### 1.2. IpPrefix — quan hệ với IpAddress

`SubnetMask/Gateway/PreferredDns/AlternateDns` sống ở `IpPrefix` (mỗi dòng = 1
subnet 3-octet, vd `10.45.1`); `IpAddress` tham chiếu qua `IpPrefixId` bắt buộc
— sửa các field mạng ở 1 `IpPrefix` tự hiển thị cho toàn bộ IP con qua JOIN,
không cần bulk-update từng dòng. Migration `AddIpPrefix` **đã apply lên DB
thật**: backfill 27 `IpPrefix` (group theo 3 octet đầu của 6885 `IpAddress` hiện
có) + DROP 4 cột cũ trên `IpAddresses`.

**Tạo `IpPrefix` mới tự động sinh luôn 255 `IpAddress` con** (`n=1..255`,
`Status=Available`) trong cùng 1 lần gọi `IpPrefixService.CreateAsync` — không
có action `generate-range` riêng.

**Không có Create/Delete thủ công cho từng `IpAddress`**: `IpAddressController`
còn `grid-list`/`available`/`{id}` (View) + `PUT {id}` (chỉ đổi `Status`+`Note`)
+ `assign`/`unassign`. `IIpAddressService.CreateAsync/DeleteAsync` không tồn
tại trong interface (DTO `CreateIpAddressDto` đã xoá). `UpdateIpAddressDto`
chỉ còn `Id`/`Status`/`Note`.

**`IpPrefix` có Update (từ 2026-07-13, đổi quyết định trước đó "không cho sửa
sau khi tạo")**: `IpPrefixController` có `Create` (tự sinh 255 IP con), `Update`
(PUT `{id}`) và `Delete`. `UpdateIpPrefixDto` (`Id`/`BranchId [Required]`/
`SubnetMask?`/`Gateway?`/`PreferredDns?`/`AlternateDns?`/`Description?`) —
**không có `Prefix`**: 3 octet định danh dải vẫn bất biến sau khi tạo (đã sinh
sẵn 255 `IpAddress` con theo giá trị này) — đổi Prefix vẫn phải xoá + tạo lại
như cũ. Cho sửa vì lý do thực tế: DNS/Gateway của 1 dải mạng có thể đổi theo
thời gian, xoá+tạo lại sẽ mất toàn bộ 255 `IpAddress` con (kể cả IP đã gán cho
Device). `IpPrefixService.UpdateAsync` chạy lại đúng `ValidateNetworkSettings`
như `CreateAsync` (IPv4 hợp lệ, Gateway cùng subnet, không trùng network/
broadcast — dùng `prefix.Prefix` hiện có của entity, không nhận từ client) +
validate `BranchId` tồn tại (`!IsDeleted`) trước khi ghi.

**`IpPrefix.BranchId`** (mới, xem migration `AddIpPrefixBranch` bên dưới): mỗi
dải mạng gán cho đúng 1 Chi nhánh. Cột DB **nullable** (27 dải cũ trước khi có
khái niệm này chưa gán Chi nhánh, để `null` cho tới khi Admin tự cập nhật qua
`PUT`) nhưng `CreateIpPrefixDto.BranchId` **`[Required]`** — mọi dải mạng tạo
mới từ nay bắt buộc chọn Chi nhánh ngay lúc tạo. `IpPrefixService.CreateAsync`/
`UpdateAsync` đều validate `BranchId` tồn tại (`!IsDeleted`) qua
`ValidateBranchIdAsync` (pattern giống `ValidateGroupIdAsync` ở `DeviceService`,
khác là bắt buộc chứ không optional). `IpPrefixDto` trả kèm `BranchId?`/
`BranchName?` (join `IpPrefix.Branch`, `null` nếu dải cũ chưa gán).

**Validate cấu hình mạng khi tạo `IpPrefix`**: `IpPrefixService.CreateAsync` gọi
`ValidateNetworkSettings` (logic theo công cụ nội bộ ChangeIP/SetIP.cs, qua
`Shared.Application/Helper/NetworkHelper.cs`: `IsValidIpv4`/`GetNetworkClass`/
`IsSameSubnet`): `SubnetMask`/`Gateway`/`PreferredDns`/`AlternateDns` nếu có phải
là IPv4 hợp lệ; `Gateway` phải thuộc đúng network 3-octet của `Prefix`, cùng
subnet theo `SubnetMask` (nếu có), và không trùng địa chỉ network `.0`/broadcast
`.255`. (Ràng buộc "không trùng network 3-octet giữa các dải" đã có sẵn qua
unique index `IX_TienToIPs_TienTo` trên `Prefix`.)

`IpPrefixService.DeleteAsync` chỉ chặn (`DomainException`) nếu còn IP con **đang
gắn cho Device** (`DeviceId` khác null, `!IsDeleted`) — phải gỡ gán hết trước
mới xoá được Prefix. Nếu không còn IP nào đang dùng, `DeleteAsync` **cascade
soft-delete toàn bộ IP con chưa dùng** cùng lúc với soft-delete Prefix (đây là
cách duy nhất dọn IP chưa dùng, vì không còn API xoá tay từng IP).

### 1.3. Sắp xếp lưới IP theo giá trị số

Cả `IpPrefix` grid/all và `IpAddress` grid-list/available đều sort theo **giá
trị IP** (không phải chuỗi — sort chuỗi sẽ đặt `10.45.10` trước `10.45.2`).
Dùng `NetworkHelper.ToSortableKey` (pack 4 octet thành 1 `long`). Vì cần sort
theo số nên `GetPagedAsync` (cả 2 service) **materialize DTO đã project rồi
sort + phân trang trong bộ nhớ** thay vì `ToPagedResponseAsync` (paging trong
SQL) — bảng IP là nội bộ, quy mô vừa phải nên chấp nhận được.

### 1.4. `Device.Status` — enum `DeviceStatus` (`Asset.Domain/Enums/DeviceStatus.cs`)

`0=PendingUse` (Chờ sử dụng), `1=InUse` (Đang sử dụng), `2=PendingLiquidation`
(Chờ thanh lý), `3=Liquidated` (Đã thanh lý — dữ liệu cũ chỉ dùng 0/1/2, giá trị
`3` an toàn để dùng cho nghiệp vụ mới).

### 1.5. `Device.ExpirationDate` — field tính toán

Server luôn set `ExpirationDate = PurchaseDate.AddMonths(DepreciationMonths)`
trong `DeviceService.CreateAsync`/`UpdateAsync` — DTO Create/Update **không
nhận** `ExpirationDate` từ client, chỉ nhận `DepreciationMonths`. Migration
`AddDeviceFields` **đã apply lên DB thật**: backfill `DepreciationMonths =
DATEDIFF(MONTH, PurchaseDate, ExpirationDate)` cho dữ liệu thật (khớp chính xác
100%, chỉ 2 giá trị 60/48 tháng) và `IsOutsourced = false` mặc định cho toàn bộ.

### 1.6. Device hỗ trợ nhiều IP + nhiều Email

**Nhiều IP**: đã bỏ khái niệm "IP chính". `Device` 1-N `IpAddress`, Create/
Update Device nhận `IpAddressIds: List<int>` (mỗi Id phải là 1 `IpAddress`
đang `Status=Available`, không trùng lặp trong cùng request) —
`DeviceService.CreateAsync` validate + gán toàn bộ list; `UpdateAsync` gọi
`SyncIpAddressesAsync` để **đối chiếu diff**: IP nào không còn trong list mới
→ gỡ về `Available`; IP mới trong list mà trước đó chưa gắn → validate
`Available` rồi gán; IP đã gắn sẵn và vẫn còn trong list → **không đụng tới**.
Xoá Device → mọi IP đang gắn tự gỡ về `Available`. `DeviceDto.IpAddresses` trả
`List<DeviceIpAddressDto>` (`Id` + `IpAddress`); `DeviceGridDto.IpAddresses` trả
`List<string>` rút gọn. **Danh sách "IP chưa dùng" để chọn** có 2 cách: `GET
/api/IpAddress/grid-list?status=0&keyword=` (có phân trang, cho bảng/picker
lớn) hoặc `GET /api/IpAddress/available?keyword=` (không phân trang, sort theo
`IpAddress` A-Z, cho dropdown/picker gọn).

**Nhiều Email**: thay cột `Device.Email` (string đơn) bằng bảng `DeviceEmails`
(`Id/DeviceId/Email/Note?/IsDeleted`), **không** ràng buộc unique (1 email có
thể dùng chung cho nhiều Device). Create/Update Device nhận `Emails:
List<DeviceEmailInputDto>` (`Email [Required][EmailAddress]`, `Note?`) —
`UpdateAsync` gọi `SyncEmailsAsync`: entry không còn trong request (so khớp
theo `Email` đã trim, case-insensitive) → soft-delete; entry khớp sẵn → chỉ
cập nhật `Note` nếu đổi, giữ nguyên `Id`; entry mới → `AddAsync`. Xoá Device →
toàn bộ `DeviceEmail` liên quan cũng soft-delete theo. `DeviceDto.Emails` trả
`List<DeviceEmailDto>` (`Id/Email/Note`); `DeviceGridDto.Emails` trả
`List<string>` rút gọn. Migration `AddDeviceEmailsMultiIp` **đã apply lên DB
thật**: backfill 5218/5225 `Device.Email` cũ sang `DeviceEmails` (verify khớp
100% số dòng) trước khi drop cột cũ.

**Bộ lọc Device theo IP/Email**: `DeviceFilterRequest` có `IpAddress?`/`Email?`
(Contains, khớp **bất kỳ** IP/email nào của Device qua
`d.IpAddresses.Any(...)`/`d.DeviceEmails.Any(...)`, cả 2 đều tự lọc
`!IsDeleted` trên bảng con).

**Hệ luỵ sang nghiệp vụ khác**: `TransferHistoryService.TransferAsync` chuyển
**toàn bộ IP đang gắn** của máy cũ sang máy mới (IP nào máy mới đang giữ sẵn mà
không thuộc tập IP máy cũ thì gỡ về `Available` trước).
`DeviceConfigurationImportService.ReassignDeviceIpAsync` (import Tanium) không
gỡ các IP khác của Device khi gán IP Tanium báo cáo được — chỉ "cướp" IP đó từ
Device khác đang giữ (nếu có), không đụng tới các IP khác của chính Device
đang import.

### 1.7. Báo cáo "DANH SÁCH DESKTOP TOÀN CÔNG TY"

`GET /api/Report/device-list?deviceTypeId=&branchId=&keyword=` (controller
riêng `ReportController`, **không** nằm trong `DeviceController` — để sau này
gom chung các loại báo cáo khác như "Thống kê phần mềm"/"Thống kê tổng số
thiết bị toàn công ty" dưới `/api/Report/*`) trả thẳng
`List<DeviceReportItemDto>` (**không phân trang** — dùng cho in ấn/export),
gồm `Stt` (đánh số lại theo kết quả trả về, `OrderBy(DeviceCode)`),
`DeviceCode`, `DeviceName`, `IpAddress` (toàn bộ IP đang gắn, nối `", "`),
`PurchaseDate`, `ExpirationDate`, `IsExpired` (bool, `ExpirationDate < hôm nay
UTC`), `FinancialPeriod` (int?, công thức bên dưới), `Note`. Filter đều
optional: không truyền gì = toàn bộ Device active.

**Công thức "Kỳ tài chính" (`FinancialPeriod`)**: tính từ `ExpirationDate` (Hạn
sử dụng), **không phải** `PurchaseDate`. Năm tài chính Yazaki chạy **1/7 →
30/6 năm sau**, đánh số liên tục từ năm thành lập Yazaki Corporation (1941, kỳ
1 = FY1941–1942):
```
fiscalYearStartYear = ExpirationDate.Month >= 7 ? ExpirationDate.Year : ExpirationDate.Year - 1
FinancialPeriod = fiscalYearStartYear - 1940
```
Đã verify khớp 100% với báo cáo giấy gốc (vd `Hạn S/D=01-Oct-2026` → kỳ 86,
`09-Nov-2020` → kỳ 80, `31-Aug-2028` → kỳ 88). Field này **không lưu DB**, chỉ
tính on-the-fly trong `DeviceService.GetReportListAsync` — công thức viết lặp
lại trực tiếp trong `Expression<Func<>>` (giống `StatusText`) vì EF dịch sang
SQL, không gọi được method C# tuỳ ý.

Endpoint dùng repository method `IGenericRepository<T>.ToListAsync(query,
selector)` (`Shared.Application`/`Shared.Infrastructure`, xem
[architecture-core.md](architecture-core.md) §1) — materialize `IQueryable` đã
filter/`OrderBy` động thành `List<TResult>` **không phân trang**.

### 1.8. "Chuyển máy" — `TransferHistory`

`POST /api/TransferHistory` (`CreateTransferHistoryDto`: `OldDeviceId`/
`NewDeviceId` `[Required]`, `Note?`) thực hiện **1 hành động nghiệp vụ tổng
hợp** qua `TransferHistoryService.TransferAsync`, không phải CRUD tạo bản ghi
đơn thuần:

1. Validate `OldDeviceId != NewDeviceId` (`DomainException` nếu trùng), cả 2
   Device phải tồn tại (`OrThrowNotFound`).
2. **Chuyển toàn bộ IP** đang gắn `OldDevice` → gán sang `NewDevice`. IP nào
   `NewDevice` đang giữ sẵn mà không thuộc tập IP của `OldDevice` → tự gỡ về
   `Available` trước (đúng ràng buộc "1 IP không được gắn nhiều thiết bị" —
   logic viết lại trực tiếp trong `TransferHistoryService` vì cả 2 dùng chung
   `IAssetUnitOfWork`, không gọi chéo sang `IpAddressService`).
3. **Chuyển Email (`DeviceEmail`)**: đổi `DeviceId` của từng dòng từ
   `OldDevice` sang `NewDevice` (move, giữ nguyên `Note`). Khác IP —
   `DeviceEmail` không có ràng buộc unique nên **không cần gỡ** email sẵn có
   của `NewDevice`, chỉ re-point `DeviceId` trực tiếp. Nếu trùng đúng nội dung
   `Email` với 1 dòng `NewDevice` đã có sẵn → soft-delete dòng cũ (tránh nhân
   đôi).
4. **Chuyển phần mềm cài (`DeviceSoftware`)**: đổi `DeviceId` của từng dòng từ
   `OldDevice` sang `NewDevice` (move, giữ nguyên `InstallDate`/`LicenseKey`).
   Nếu `NewDevice` **đã cài sẵn** đúng phần mềm đó rồi (trùng khoá kép
   `DeviceId+SoftwareId`) → giữ bản ghi bên `NewDevice`, xoá cứng bản ghi cũ
   bên `OldDevice`.
5. **Chuyển dữ liệu vai trò/vị trí sử dụng**: copy trực tiếp từ `OldDevice`
   ghi đè lên `NewDevice` CHỈ 4 field `BranchId`/`Manager`/`IsOutsourced`/
   `IsUseUsb` — dữ liệu gắn theo vị trí/người dùng đang thao tác trên máy,
   không phải thuộc tính vật lý riêng của thiết bị. **KHÔNG copy** (giữ
   nguyên của `NewDevice`, coi là thuộc tính vật lý/độc nhất của từng máy):
   `DeviceTypeId`, `SupplierId`, `PurchaseDate`, `ExpirationDate`,
   `DepreciationMonths`, `Id`, `DeviceCode`, `DeviceName`, `SerialNumber`,
   `Note`, `DeviceConfiguration` (xem bước 7), `Status` (bước 6/6b).
6. **Đổi trạng thái `OldDevice`**: mặc định chuyển `PendingUse` (0) — **trừ
   khi** `OldDevice.ExpirationDate` đã qua (dùng đúng công thức `IsExpired` ở
   §1.7) thì chuyển thẳng `PendingLiquidation` (2).
6b. **Đổi trạng thái `NewDevice` → `InUse`** (1) tự động — không cần gọi `PUT
   /api/Device/{id}` riêng để đổi status thủ công.
7. `DeviceConfiguration` **không đụng tới** — chủ ý không copy sang
   `NewDevice` (cấu hình phần cứng đặc thù theo từng máy vật lý), cũng không
   xoá ở `OldDevice`.
8. Tạo 1 dòng `TransferHistory` (`TransferDate = DateTime.UtcNow`) ghi nhận
   `OldDeviceId`/`NewDeviceId`/`Note`. **Không có API sửa/xoá `TransferHistory`**
   (audit-log — chỉ tạo qua hành động nghiệp vụ, không cho client POST/PUT/
   DELETE trực tiếp).

**Chọn máy mới để chuyển**: `GET /api/Device/available?keyword=`
(`DeviceService.GetAvailableForTransferAsync`, cùng pattern
`IpAddressService.GetAvailableAsync` — không phân trang, trả `List<DeviceGridDto>`)
trả toàn bộ Device `Status=PendingUse` (0) và `!IsDeleted`, lọc theo
`DeviceCode.Contains(keyword)` nếu có.

**Gợi ý "máy thay thế" lưu xuống DB + endpoint tra cứu (2026-07-13, đổi hướng
tự tham chiếu)**: `Device` có cột tự tham chiếu `SuggestedNewDeviceId` (int?,
FK → `Devices.Id`, index `IX_ThietBis_GoiYMayMoiId`, constraint
`FK_ThietBis_ThietBis_GoiYMayMoiId`, `OnDelete(ClientSetNull)`) — nghĩa là
"thiết bị này (máy CŨ) dự tính được thay thế bởi máy có Id này (máy MỚI)".
**Trước 2026-07-13** cột này tên `ReplacesOldDeviceId` và nằm ngược hướng: lưu
trên máy MỚI, trỏ về máy CŨ nó thay thế (`"máy này thay thế cho máy nào"`).
Đổi hướng vì lý do thực tế: khi mở màn "Chuyển máy" trên 1 máy CŨ, hướng cũ
buộc phải dò ngược toàn bộ Device khác xem ai khai `ReplacesOldDeviceId` =
máy này (có thể nhiều dòng do nhiều lần import chồng nhau); hướng mới đọc
thẳng 1 cột trên chính máy CŨ đang mở, không cần dò ngược.

`DeviceImportService.ConfirmAsync` set field này: sau khi tạo xong Device mới
từ 1 dòng Excel có `MQL Cũ`, gọi `DeviceService.SetSuggestedNewDeviceAsync
(oldDeviceId, newDeviceId)` để ghi thẳng Id máy mới vào `SuggestedNewDeviceId`
của máy CŨ tương ứng (ghi đè gợi ý cũ nếu máy cũ này từng được 1 lần import
khác gợi ý trước đó — luôn giữ gợi ý mới nhất, không cần lưu nhiều gợi ý cùng
lúc). Field cũng có sẵn ở `CreateDeviceDto`/`UpdateDeviceDto` để sửa tay trên
chính máy CŨ (`DeviceService.CreateAsync`/`UpdateAsync` validate máy MỚI được
gợi ý phải tồn tại `!IsDeleted` và không được tự trỏ vào chính nó).

`GET /api/Device/{oldDeviceId}/replacement-suggestion` (permission
`Asset.Device.View`, dùng chung `DeviceController`, **route/response giữ
nguyên không đổi** dù đổi cơ chế lưu bên trong) trả
`DeviceReplacementSuggestionDto? { Id, DeviceCode, DeviceName }` — gọi khi FE
mở màn "Chuyển máy" trên 1 máy cũ để **tự điền sẵn** ô chọn `NewDeviceId`
(vẫn có thể đổi qua `GET /api/Device/available`, đây chỉ là gợi ý). Logic chọn
gợi ý (`DeviceService.GetReplacementSuggestionAsync`): đọc thẳng
`oldDevice.SuggestedNewDevice` (1 lần load kèm navigation, không cần query
dò ngược nữa) — chỉ trả về nếu máy mới đó còn tồn tại, `!IsDeleted` và
`Status == PendingUse` (chưa bị dùng cho lần chuyển máy nào khác kể từ lúc
được gợi ý), ngược lại trả `null`. `DeviceDto` đổi trả kèm
`SuggestedNewDeviceId`/`SuggestedNewDeviceCode` (thay cho
`ReplacesOldDeviceId`/`ReplacesOldDeviceCode` cũ) khi xem chi tiết máy — nay
field này có ý nghĩa khi xem máy CŨ (gợi ý máy nào sẽ thay nó), không phải khi
xem máy MỚI. Migration `AddDeviceReplacesOldDevice` (đã apply) + migration nối
tiếp `RenameDeviceReplacementToSuggestedNewDevice` (đổi hướng tự tham chiếu,
kèm data-fixup chuyển giá trị hiện có sang đúng dòng máy CŨ, xem bảng migration
cuối file) — **chờ deploy**.

`GET /api/TransferHistory/device/{deviceId}` trả `List<TransferHistoryDto>` —
lịch sử chuyển máy liên quan tới 1 Device (dù là vai trò máy cũ hay máy mới),
sort `TransferDate` mới nhất trước.

### 1.9. Import Device hàng loạt từ Excel/CSV

`POST /api/DeviceImport/preview` + `POST /api/DeviceImport/confirm`. Mẫu file
**13 cột theo đúng thứ tự**: `MQL`, `Xưởng`, `Loại Thiết Bị`, `Nhà Cung Cấp`,
`Ngày Mua`, `Ghi Chú`, `Số SerialNumber`, `Hãng`, `Model`, `CPU`, `RAM`, `Ổ
Cứng`, `MQL Cũ`; dòng 1 là header. Quy trình 2 bước bắt buộc — xem trước rồi
mới ghi DB.

**5 cột cấu hình `Hãng/Model/CPU/RAM/Ổ Cứng`**: hoàn toàn tuỳ chọn, map thẳng
vào `DeviceConfiguration.Maker/Model/Cpu/Ram/HardDrive`. Ở bước Confirm, nếu
dòng có **ít nhất 1** trong 5 cột này khác rỗng thì sau khi tạo `Device`,
`DeviceImportService.ConfirmAsync` gọi luôn `IDeviceConfigurationService
.CreateAsync` để tạo kèm `DeviceConfiguration` (chỉ set đúng 5 field này, các
field cấu hình khác để trống, sửa lại sau qua màn "Cập nhật cấu hình"). Vì
Device vừa tạo chắc chắn chưa có config sẵn, luôn `CreateAsync` — không cần
nhánh update-nếu-đã-có như `DeviceConfigurationImportService`.
`DeviceImportConfirmResultDto` có `CreatedConfigCount` đếm số Device kèm config.

**Định dạng cột "Ngày Mua"**: nếu ô Excel là kiểu Date thật thì đọc trực tiếp.
Nếu ô là text, `ParseXlsx`/`TryParsePurchaseDate` chỉ nhận **đúng 1 định dạng
cố định** `dd/MM/yyyy` (hằng số `PurchaseDateFormat`, VD `01/07/2026`) qua
`DateTime.TryParseExact` + `CultureInfo.InvariantCulture` — cố ý không dùng
`DateTime.TryParse` theo culture mặc định của server (dễ hiểu nhầm ngày/tháng
tuỳ môi trường chạy). Định dạng khác (kể cả `d/M/yyyy` thiếu số 0, hay
`yyyy-MM-dd`) hoặc ô trống → lỗi "Thiếu hoặc sai định dạng Ngày Mua".

**Hỗ trợ cả `.xlsx` lẫn `.csv`**: `PreviewAsync` nhận thêm `fileName?`, chọn
`ParseXlsx` (ClosedXML, đổi tên từ `ParseExcel`) hay `ParseCsv` theo đuôi file
(`CsvFileHelper.HasCsvExtension`, không phân biệt hoa/thường). `ParseCsv` dùng
`CsvFileHelper` (`Shared.Application/Helper/CsvFileHelper.cs`, tự viết tay
không phụ thuộc thư viện ngoài) — tự nhận diện dấu phân cách `,`/`;` theo dòng
header (đếm số lần xuất hiện, dấu nào nhiều hơn thì dùng cho toàn file), hỗ
trợ field có dấu ngoặc kép bao quanh (escape `""`→`"` bên trong), UTF-8 tự
nhận BOM. CSV không có kiểu Date thật nên cột "Ngày Mua" luôn parse qua
`TryParsePurchaseDate` (`dd/MM/yyyy`). File không mở được ở cả 2 nhánh →
`DomainException` (400) thay vì để lọt exception gốc ra ngoài thành lỗi 500
(cùng 1 fix áp dụng cho cả 2 service import Excel — xem §1.10).

1. `POST /api/DeviceImport/preview` (`multipart/form-data`, field `file`) —
   `DeviceImportService.PreviewAsync` đọc file, parse từng dòng, validate +
   resolve tên → Id (không đụng DB, chỉ đọc), trả
   `DeviceImportPreviewResultDto { Rows: List<DeviceImportRowDto>, TotalRows,
   ValidRows, InvalidRows }`. Mỗi `DeviceImportRowDto` có `IsValid`/`Errors`
   (tiếng Việt, theo từng dòng).
2. `POST /api/DeviceImport/confirm` (`ConfirmDeviceImportDto { Rows }` — FE gửi
   lại đúng field thô của các dòng đã xem ở bước 1, **không gửi Id đã resolve**
   vì server luôn tự tra lại theo tên, không tin Id từ client) —
   `DeviceImportService.ConfirmAsync` **validate lại từ đầu** theo dữ liệu DB
   tại thời điểm confirm (phòng race condition). **Dòng lỗi bị BỎ QUA, không
   chặn cả batch**: chỉ những dòng hợp lệ mới được tạo Device, chạy trong 1
   `_unitOfWork.BeginTransactionAsync()`/`CommitTransactionAsync()` (rollback
   chỉ ảnh hưởng phần ghi hợp lệ nếu lỗi giữa chừng; không đụng gì nếu
   `validRows` rỗng). Dòng bị bỏ qua trả về trong
   `DeviceImportConfirmResultDto.SkippedRows` (`RowNumber`/`DeviceCode`/
   `Errors`) + `SkippedCount` — preview không đổi, vẫn hiển thị đầy đủ dòng lỗi
   như cũ. Với từng dòng hợp lệ:
   - Gọi thẳng `IDeviceService.CreateAsync` (tái dùng nguyên logic tạo Device)
     với `DeviceCode`/`SerialNumber`/`Note`/`PurchaseDate` từ Excel; các field
     **`[Required]` mà Excel không có** dùng mặc định: `DeviceName` = `MQL`,
     `Manager` = chuỗi rỗng, `Emails` = `List<DeviceEmailInputDto>` rỗng,
     `DepreciationMonths` = **60 tháng** (hằng số `DefaultDepreciationMonths`),
     `Status` = `PendingUse`. Cần sửa lại tay sau nếu thiếu thông tin.
   - Nếu dòng có `MQL Cũ`: **KHÔNG** tự chuyển máy. `ConfirmAsync` chỉ thêm 1
     gợi ý vào `DeviceImportConfirmResultDto.PendingTransfers`
     (`DeviceImportPendingTransferDto { NewDeviceId, NewDeviceCode, OldDeviceId,
     OldDeviceCode }`) — thực tế lắp đặt có thể đổi ý. Đồng thời **lưu quan hệ
     này xuống DB** qua `DeviceService.SetSuggestedNewDeviceAsync(oldDeviceId,
     newDeviceId)` — ghi thẳng Id máy MỚI vừa tạo vào `SuggestedNewDeviceId`
     của máy CŨ (xem §1.8), vì `PendingTransfers` chỉ trả 1 lần trong response
     Confirm còn `SuggestedNewDeviceId` tồn tại lâu dài để tra lại sau qua `GET
     /api/Device/{oldId}/replacement-suggestion`. FE dùng gợi ý để **điền sẵn
     nhưng cho sửa** trên màn "Chuyển máy" — người dùng phải tự bấm "Chuyển"
     thì mới thật sự gọi `POST /api/TransferHistory` (nghiệp vụ y nguyên §1.8,
     chỉ đổi **thời điểm** gọi).

**Validate/resolve từng dòng** (`DeviceImportService.ValidateAndResolveRowsAsync`,
dùng chung cho cả `preview` và `confirm`): `Loại Thiết Bị` vẫn khớp theo **tên**
(case-insensitive với `DeviceType.TypeName`, `!IsDeleted`, không đổi). **`Xưởng`/
`Nhà Cung Cấp` đổi sang khớp theo MÃ (2026-07-13, đổi từ khớp theo Tên)** —
so khớp case-insensitive với `Branch.BranchCode`/`Supplier.SupplierCode` đang
`!IsDeleted` (lý do: Mã là duy nhất, còn Tên dễ trùng/khác nhau về dấu/viết
tắt giữa các lần nhập liệu, dẫn tới match sai hoặc match hụt). `DeviceImportRowDto`
đổi 2 field tương ứng `BranchName`→`BranchCode`, `SupplierName`→`SupplierCode`
(field `DeviceTypeName` giữ nguyên). **Không tự tạo mới** nếu không khớp — báo
lỗi dòng đó, chặn import dòng đó. Tương tự `MQL Cũ` phải khớp đúng 1
`Device.DeviceCode` (`!IsDeleted`) đang có sẵn. Các lỗi khác được kiểm: thiếu
`MQL`/`Ngày Mua`, `MQL`/Serial trùng trong chính file đang import, `MQL`/Serial
đã tồn tại trong DB, `MQL Cũ` trùng `MQL` mới, `MQL Cũ` bị dùng thay thế ở nhiều
dòng trong cùng file.

**Chưa làm / giới hạn đã biết**: chưa có endpoint tải file Excel mẫu (FE dùng
lại file mẫu người dùng đang có). Import chỉ hỗ trợ **tạo mới**, không hỗ trợ
cập nhật Device đã tồn tại qua Excel (trùng `MQL` với Device đang có luôn báo
lỗi, không ghi đè).

### 1.10. Import Cấu hình thiết bị hàng loạt từ file kiểm kê Tanium

Khác hẳn §1.9 (import Device MỚI) — feature này chỉ **cập nhật**
`DeviceConfiguration` cho Device **đã tồn tại sẵn**, không tự tạo Device mới
(file Tanium không có Xưởng/Loại thiết bị/Nhà cung cấp/Ngày mua nên không đủ
dữ liệu tạo Device hợp lệ). Controller/Service riêng:
`DeviceConfigurationImportController` `/api/DeviceConfigurationImport`
(`preview`/`confirm`, cùng pattern 2 bước) + `DeviceConfigurationImportService`.

**Mẫu file Tanium — 8 cột cố định**: `Computer Name`, `Tanium Client IP
Address`, `Last Logged In User` (**bỏ qua**, không lưu), `Manufacturer` →
`Maker`, `Model` → `Model`, `CPU` → `Cpu`, `RAM` → `Ram`, `Size` → `HardDrive`.
Dòng 1 header.

**Chỉ import đúng 5 "họ" mã**: `YDC`, `YLC`, `YDF`, `AC`, `TYC`. Computer Name
không khớp 1 trong 5 họ này (VD `Mayhethong`, `VNDASOLARWINDS`, `BTTB-ATO-xx`,
`QAKENSA-MAE-xx`, `DESKTOP-xxxxxxx`, `NUC0xx`, `ACLF/ACELF/ALF-xx`, `YCM-xx`,
`yazaki-xx`, `DASVRFAST`, và **toàn bộ họ `DA`** — cả `DA-<serial>` lẫn
`DA-ENG-<serial>`) → **loại thầm lặng** khỏi kết quả trả về (không phải lỗi,
không đưa vào `Rows`), đếm số dòng bị loại vào `OutOfScopeSkippedCount` của
response preview.

**Tách "Computer Name" → Mã/Tên** (`DeviceConfigurationImportService
.ParseComputerName`, đã verify khớp 100% với dữ liệu thật bằng script độc lập
trước khi tích hợp):
1. Bỏ hậu tố domain (phần sau dấu `.` đầu tiên, VD `.yev.vn`).
2. Tách theo dấu `-`.
3. Đoạn đầu khớp đúng 1 trong 4 tiền tố **họ chuẩn** `YDC`/`YLC`/`YDF`/`TYC`
   theo sau bởi số (số có thể **rỗng** — case hiếm `YDC-TVSOC`/`YDF-011`) →
   Mã = chèn dấu `-` giữa chữ và số (`YDC1877` → `YDC-1877`), Tên = phần còn
   lại nối bằng `-` (VD `TVCBSX`).
4. Đoạn đầu khớp regex `^AC\d+[A-Za-z]?$` (`AC` + số + tối đa 1 chữ cuối, VD
   `AC81`, `AC90`, `AC90A/B/D/E`, `AC95`) → **họ AC**: mã gốc đã có dấu `-` sẵn
   bên trong: Mã = nối 2 đoạn đầu (`AC90B-2446`), Tên = giống hệt Mã, đoạn còn
   lại (VD `J19`) bị **bỏ**. **Nhận diện theo tiền tố "AC"** (không theo cấu
   trúc chữ/số từng đoạn) — cách làm ban đầu (khớp theo cấu trúc "chữ rồi số")
   khiến `AC81`/`AC90`/`AC95` (thuần chữ-số) và `AC90A/B/D/E` (có chữ xen sau
   số) bị tách 2 kiểu khác nhau dù cùng 1 họ; đã sửa bằng cách nhận diện tiền
   tố `AC` trước. **Không khớp** `ACLF`/`ACELF`/`ALF` (chữ ngay sau `AC`,
   không phải số — khác họ, bị loại ở bước lọc allowlist).
5. Còn lại (không khớp bước 3–4, bao gồm **toàn bộ họ `DA`**) → ngoài phạm vi
   5 họ, loại thầm lặng.

**Không tìm thấy Device theo mã tách được** → báo lỗi dòng đó ở Preview,
**không tự tạo Device mới**. Có check trùng mã tách được trong cùng 1 file
import (báo lỗi nếu 2 dòng parse ra cùng 1 mã) — cố ý **không** tự động lấy
dòng cuối/mới nhất khi trùng: dữ liệu thật cho thấy có Computer Name họ AC (VD
`AC90B-2446-J19`, `AC90D-2698-A04`) xuất hiện 2 lần với **CPU/Model khác hẳn
nhau** (đổi máy vật lý nhưng giữ nguyên tên theo vị trí/cổng mạng) — tự tin
dùng dòng cuối có thể ghi nhầm cấu hình sang thiết bị khác, nên chặn để người
dùng tự kiểm tra.

**Dòng lỗi Tanium** (`"TSE-Error: Failed to send..."` xuất hiện ở bất kỳ cột
IP/Manufacturer/Model/Cpu/Ram/Size nào) → tự động phát hiện qua prefix
`"TSE-Error"`, báo lỗi dòng đó ở Preview, không update gì.

**Gán IP Tanium báo cáo được cho Device** (`Tanium Client IP Address`, chỉ khi
cột này có giá trị — để trống thì bỏ qua, không lỗi/không cảnh báo): tra
`IpAddress.IpAddress1` khớp đúng giá trị, `!IsDeleted`.
- Khớp được `IpAddress` trong DB (bất kể đang `Available`, `Assigned` cho
  thiết bị khác, v.v.) → **luôn** gán IP đó cho Device này, kể cả khi phải
  "cướp" lại từ 1 Device khác đang giữ nó.
- **Không** khớp `IpAddress` nào trong DB (chưa cấp phát qua `IpPrefix`) →
  **không chặn dòng**, chỉ bỏ qua việc cập nhật IP và thêm 1 dòng vào
  `Warnings` của row đó (Cpu/Ram/Model/tạo-cập nhật `DeviceConfiguration` vẫn
  chạy bình thường).
- Xử lý trong `DeviceConfigurationImportService.ReassignDeviceIpAsync` (không
  gọi chéo `IpAddressService`, cùng `IAssetUnitOfWork` nên truy cập thẳng
  repo): gán IP mới `DeviceId`+`Status=Assigned` — do `IpAddress.DeviceId` là
  FK 1 chiều nên việc set field này tự động "cướp" khỏi Device cũ đang giữ IP
  đó. **KHÔNG gỡ các IP khác của chính Device đang import** — Device hỗ trợ
  nhiều IP cùng lúc nên IP Tanium báo cáo chỉ được **thêm vào**, không thay
  thế IP đã gán thủ công trước đó.

**Update `DeviceConfiguration` không đè mất field khác**: nếu Device đã có
`DeviceConfiguration`, chỉ ghi đè đúng 5 field Tanium báo cáo được
(`Cpu/Ram/HardDrive/Maker/Model`, và **chỉ đè nếu giá trị mới không rỗng**),
toàn bộ field còn lại (`Mainboard/Monitor/Mouse/Keyboard/Headphone/Speaker/
Ups/Psu/Os/Vga/PowerAdapter/WirelessCard/Nic/Other/Note`) copy nguyên từ config
hiện có (vì `UpdateDeviceConfigurationDto` yêu cầu gửi đủ field, không hỗ trợ
patch từng phần). Nếu Device **chưa có** `DeviceConfiguration` → tạo mới qua
`IDeviceConfigurationService.CreateAsync` (tự kèm snapshot "Cấu hình ban đầu").

**Confirm chạy trong 1 transaction** (`BeginTransactionAsync`/
`CommitTransactionAsync`, rollback nếu lỗi giữa chừng) — validate lại toàn bộ
từ đầu theo dữ liệu DB hiện tại trước khi ghi, nếu còn dòng lỗi thì **không ghi
gì cả**, ném `DomainException` kèm `Errors` dạng `"Dòng {n}: {lý do}"`.

**Permission**: dùng chung `Asset.DeviceConfiguration.Update` cho cả `preview`
và `confirm` (không tách permission riêng cho import).

**File Excel/CSV không hợp lệ/hỏng**: `ParseXlsx` (cả ở đây lẫn
`DeviceImportService`) bọc `try/catch` quanh `new XLWorkbook(stream)` — file
không phải `.xlsx` hợp lệ (VD đổi đuôi từ `.xls`, hoặc file bị hỏng) →
`DomainException` (400) với thông báo tiếng Việt rõ ràng, thay vì rơi vào
nhánh `default` của `HandleExceptionMiddleware` (500 chung). Nguyên nhân thật
gặp phải: file kiểm kê Tanium xuất ra thực chất là `.csv` nhưng bị hiểu
nhầm/đổi đuôi thành `.xlsx` — do đó thêm hẳn hỗ trợ `.csv` native (xem
§1.9, dùng chung `CsvFileHelper`) thay vì chỉ trả lỗi rõ hơn.

### 1.11. `Device.SerialNumber` + `Device.IsUseUsb`

`SerialNumber?` (string, max 100, **unique khi có giá trị** — index
`IX_ThietBis_SoSeri` filtered `WHERE SerialNumber IS NOT NULL`, cho phép nhiều
Device cùng `SerialNumber=null`) và `IsUseUsb` (bool, mặc định `false`, không
ràng buộc unique). `DeviceService.CreateAsync`/`UpdateAsync` tự check trùng
`SerialNumber` bằng `DomainException` giống `DeviceCode` (chỉ khi
`SerialNumber` không rỗng/null và có thay đổi so với giá trị cũ khi Update).
Có trong `DeviceFilterRequest` (lọc `Contains` theo `SerialNumber`, exact-match
theo `IsUseUsb`), `DeviceGridDto`, `DeviceDto`, `Create/UpdateDeviceDto`.
Migration `AddDeviceUsbSerialFields` **đã apply lên DB thật**.

### 1.12. `DeviceConfiguration` — phạm vi

Chỉ CRUD cơ bản + 6 field chung (`Maker/Model/PowerAdapter/WirelessCard/Nic/
Other`) theo màn hình "CẬP NHẬT CẤU HÌNH" của hệ thống cũ.

**Quyết định KHÔNG làm field riêng theo loại thiết bị** (9 field "Máy in":
`standardFunction/type/MediaSize Max/Min/Copy-Print Resolution/Print Speed/
Connectivity/Scan Destination/Support`; 5 field "Thiết bị mạng": `Ports/Number
of Port/Network Media/Poe Ready/Management`) — người dùng xác nhận nhóm field
này trong hệ thống cũ hầu như không được nhập dù có ~10% tổng số thiết bị là
máy in/scan/thiết bị mạng, nên bỏ hẳn, không cần `DeviceType.Category`. Máy
in/thiết bị mạng vẫn quản lý bình thường qua field chung + `Note`/`Other`.

Migration `AddDeviceConfigurationFields` **đã apply lên DB thật** (chỉ thêm 6
cột nullable, không backfill).

### 1.13. "Cấu hình ban đầu" + "Sửa chữa/Thay thế"

2 bảng `DeviceConfigurationInitials`/`DeviceConfigurationHistories` (migration
`AddDeviceConfigurationHistory` — chỉ `CREATE TABLE`, không đụng bảng cũ, **đã
apply lên DB thật**). Cơ chế:
- **`DeviceConfigurationInitial`**: `DeviceConfigurationService.CreateAsync` tự
  động copy toàn bộ 20 field vừa tạo thành 1 snapshot bất biến — các lần
  `Update` sau không đụng tới. Xoá qua `DELETE /api/DeviceConfiguration/initial/{id}`
  (dùng khi nhập nhầm lúc tạo).
- **`DeviceConfigurationHistory`**: `UpdateAsync` so sánh 20 field cũ/mới;
  **chỉ** tạo 1 dòng lịch sử (giá trị **mới**, `EditedAt`, `EditedBy`) nếu có
  **ít nhất 1 field thực sự đổi** — Save mà không đổi gì thì không log thêm.
- **`EditedBy`**: lấy `HttpContext.User.Identity.Name` (claim `ClaimTypes.Name`
  qua JWT nếu request có gắn token) qua `IHttpContextAccessor`; request hoàn
  toàn anonymous thì ghi `"Unknown"`. Cần
  `<FrameworkReference Include="Microsoft.AspNetCore.App" />` trong
  `Asset.Application.csproj` (theo đúng convention đã có ở `Asset.Api.csproj`)
  để dùng được `IHttpContextAccessor` trong tầng Application.
- Cả 2 entity có FK `OnDelete(Cascade)` tới `DeviceConfiguration` — xoá
  `DeviceConfiguration` tự động xoá sạch Initial + toàn bộ History liên quan.
- Không có Create/Update DTO cho 2 entity này — hoàn toàn tự sinh (side
  effect), không có API cho client POST/PUT trực tiếp.

### 1.14. DeviceGroup (Nhóm) + DeviceDepartment (Bộ phận) — quan hệ 1 Bộ phận - N Nhóm

**Sắp xếp (2026-07-13, theo yêu cầu)**: `DeviceType`/`DeviceGroup`/
`DeviceDepartment` — cả `grid-list` lẫn `all` — đổi sang `OrderBy(x => x.Id)`
(giữ đúng thứ tự tạo/import ban đầu), thay vì sort theo Code/Name như các
master data khác (`Branch`/`Supplier`/`SoftwareGroup`/`Software` không đổi,
vẫn sort theo Code/Name).

`DeviceDepartment` (Bộ phận) là master data độc lập (Code/Name, giống pattern
`Branch`). `DeviceGroup` (Nhóm) **thuộc về đúng 1 `DeviceDepartment`**
(`DeviceGroup.DepartmentId` **bắt buộc**, không nullable — mỗi Nhóm luôn có
đúng 1 Bộ phận cha, khớp sơ đồ tổ chức thực tế: 1 Bộ phận chia thành nhiều
Nhóm con). `Device.GroupId`/`DepartmentId` vẫn **nullable** trên Device — dữ
liệu Device cũ (5000+ dòng) chưa gán, chỉ áp dụng dần qua Create/Update mới.

**Ràng buộc khi gán Nhóm/Bộ phận cho Device** (`DeviceService
.ValidateGroupAndDepartmentAsync`, dùng chung Create/Update): nếu client gửi
`GroupId` thì **bắt buộc phải gửi kèm `DepartmentId`** và `DepartmentId` đó
phải đúng là Bộ phận cha của Nhóm đó (`DomainException` nếu thiếu
`DepartmentId` hoặc Nhóm không thuộc Bộ phận đã chọn) — tránh lưu dữ liệu
Nhóm/Bộ phận không khớp nhau trên 1 Device. `DepartmentId` vẫn có thể gửi độc
lập (không kèm `GroupId`) nếu chỉ muốn gán Bộ phận mà chưa xác định Nhóm cụ
thể.

**`GroupCode` không còn unique toàn cục — chỉ unique trong phạm vi 1 Bộ phận**
(unique index đổi từ `IX_Nhoms_MaNhom` (`GroupCode`) sang
`IX_Nhoms_BoPhanId_MaNhom` (`DepartmentId`+`GroupCode`)): 2 Bộ phận khác nhau
có thể cùng có 1 Nhóm mã `"OF"` (VD Tổng vụ và Quản lý chất lượng đều có
`GroupCode="OF"`, là 2 bản ghi `DeviceGroup` khác nhau). `DeviceGroupService
.CreateAsync`/`UpdateAsync` check trùng theo cặp `(DepartmentId, GroupCode)`
thay vì chỉ `GroupCode`, thông báo lỗi kèm tên Bộ phận (VD `"Mã nhóm 'OF' đã
tồn tại trong bộ phận 'Quản lý chất lượng'."`).

**Dropdown Nhóm phụ thuộc Bộ phận đã chọn (cascading)**: `GET
/api/DeviceGroup/all?departmentId=` và `GET /api/DeviceGroup/grid-list
?departmentId=` (tham số optional, không truyền = toàn bộ Nhóm) — FE dùng để
chỉ hiện Nhóm thuộc đúng Bộ phận người dùng vừa chọn trên form Device/màn quản
lý Nhóm, xem mô tả UI chi tiết ở cuối mục này.

Migration `AddDeviceGroupAndDepartment` (đã apply) tạo 2 bảng gốc + seed 1
dòng mặc định mỗi bảng (`Code="MD"`, `Name="Mặc định"`). Migration
`ChangeDeviceGroupDepartmentRelation` (2026-07-13, **đã apply lên DB
thật**, verify 9 Bộ phận / 28 Nhóm) đổi quan hệ: xoá cứng data cũ
(`DeviceGroups` chỉ có 1 dòng "MD",
`DeviceDepartments` có "MD" + "IT" tự thêm tay — **đã xác nhận chưa Device nào
tham chiếu** trước khi xoá), thêm cột bắt buộc `DeviceGroup.DepartmentId` +
FK/unique composite, rồi import bộ mã Bộ phận/Nhóm chính thức theo sơ đồ tổ
chức thực tế (9 Bộ phận, 28 Nhóm). **15 mã Nhóm chưa có tên đầy đủ lúc import**
(`HZ`/`YT`/`PD`/`EC`/`JK`/`MA`/`IM`/`IT`/`PL`/`PR`/`WH`/`SH`/`KS`/`00`/`JP` —
tạm để `GroupName` = đúng mã Code) — sửa lại tên thật qua `PUT
/api/DeviceGroup/{id}` khi có thông tin đầy đủ, không cần migration mới.

**Mô tả cho FE — luồng UI liên quan (2026-07-13):**

1. **Màn quản lý "Bộ phận"** (`/api/DeviceDepartment`): CRUD độc lập như cũ,
   không đổi.
2. **Màn quản lý "Nhóm"** (`/api/DeviceGroup`): form Create/Update giờ
   **bắt buộc chọn Bộ phận trước** (dropdown load từ `GET
   /api/DeviceDepartment/all`) rồi mới nhập `GroupCode`/`GroupName`. Validate
   trùng mã chỉ áp dụng trong phạm vi Bộ phận đã chọn — đổi Bộ phận của 1 Nhóm
   đang có thể khiến `GroupCode` cũ hết trùng (hợp lệ) hoặc trùng mới (chặn),
   server luôn là nguồn xác nhận cuối cùng. Bảng danh sách Nhóm nên hiển thị
   thêm cột "Bộ phận" (`DepartmentName` trong `DeviceGroupDto`) và có thể lọc
   theo Bộ phận qua `grid-list?departmentId=`.
3. **Form Device (gán Nhóm/Bộ phận cho thiết bị)**: đổi từ 2 dropdown độc lập
   sang **cascading 2 tầng**:
   - Bước 1: chọn "Bộ phận" — dropdown từ `GET /api/DeviceDepartment/all`
     (độc lập, không đổi).
   - Bước 2: dropdown "Nhóm" gọi lại `GET /api/DeviceGroup/all?departmentId=
     {id vừa chọn}` để chỉ hiện Nhóm thuộc đúng Bộ phận đó. **Mỗi lần người
     dùng đổi Bộ phận, FE phải tự xoá lựa chọn Nhóm hiện tại** (không giữ
     `GroupId` cũ vì có thể không còn thuộc Bộ phận mới) và disable dropdown
     Nhóm cho tới khi đã chọn Bộ phận.
   - Khi sửa Device đã có sẵn `GroupId`/`DepartmentId` (xem chi tiết qua
     `GET /api/Device/{id}`, trả kèm `GroupName`/`DepartmentName` trong
     `DeviceDto`): FE set Bộ phận trước, gọi `GET /api/DeviceGroup/all
     ?departmentId={departmentId hiện có}` để load đúng danh sách Nhóm rồi mới
     set giá trị Nhóm đã chọn sẵn.
   - Submit Create/Update Device: nếu người dùng chọn Nhóm thì bắt buộc phải
     có Bộ phận đi kèm (ràng buộc server chặn 400 nếu thiếu/không khớp, xem
     trên) — FE nên validate sơ bộ tương tự phía client trước khi gọi API.

### 1.15. Xóa hàng loạt Device — xóa MỀM, chỉ cho thiết bị đã thanh lý

`POST /api/Device/bulk-delete` (`BulkDeleteDeviceRequestDto { Ids: List<int>
}`, permission dùng chung `Asset.Device.Delete`) gọi
`DeviceService.BulkDeleteAsync` — cùng cơ chế xóa **mềm** với `DELETE
/api/Device/{id}` (`DeleteAsync`, set `IsDeleted=true` + gỡ IP đang gắn +
xóa mềm `DeviceEmail`), chỉ khác là nhận nhiều Id 1 lần trong 1
`SaveChangesAsync`. (2026-07-13: ban đầu thiết kế xóa **cứng** riêng cho thao
tác hàng loạt, nhưng đổi sang xóa mềm để không vướng ràng buộc khóa ngoại của
`TransferHistory` — xem lý do kỹ thuật bên dưới — và giữ nhất quán với xóa
đơn lẻ.)

**Chỉ áp dụng cho thiết bị đang ở trạng thái `Liquidated`(3) — Đã thanh lý.**
Thiết bị ở trạng thái khác (`PendingUse`/`InUse`/`PendingLiquidation`) bị bỏ
qua, tránh xóa nhầm thiết bị đang/sắp còn dùng thật. Kết quả trả về
`BulkDeleteDeviceResultDto { DeletedCount, SkippedDevices:
List<{Id, DeviceCode, Reason}> }` (cùng pattern
`DeviceImportConfirmResultDto.SkippedRows` — dòng lỗi bị bỏ qua, không chặn
cả batch) — `Reason` là "Không tìm thấy thiết bị." (Id không tồn tại/đã xóa)
hoặc "Chỉ có thể xóa thiết bị đã thanh lý." (Status khác `Liquidated`).

> **Vì sao không xóa cứng**: `TransferHistory.OldDeviceId`/`NewDeviceId` là FK
> **bắt buộc** (không nullable, xem §1.8) — nếu 1 Device từng xuất hiện trong
> `TransferHistory` (là máy cũ hoặc máy mới của 1 lần "Chuyển máy"), xóa cứng
> nó sẽ vi phạm ràng buộc khóa ngoại (vì không thể set `null` cho cột bắt
> buộc), hơn nữa `TransferHistory` là audit-log không nên đụng tới. Xóa mềm
> né được vấn đề này hoàn toàn vì chỉ set cờ `IsDeleted`, không đụng khóa
> chính/khóa ngoại.

### 1.16. `AssetSetting` — cấu hình hệ thống + tự động chuyển trạng thái "Chờ thanh lý → Đã thanh lý"

Bảng `AssetSettings` (migration `AddAssetSetting`, seed sẵn **đúng 1 dòng**
`Id=1, LiquidationAfterMonths=2`) lưu cấu hình runtime của module Asset —
hiện chỉ có 1 field `LiquidationAfterMonths` (số tháng, mặc định 2). Chọn lưu
DB (thay vì `appsettings.json`) để Admin đổi được ngay qua API, không cần
deploy lại. `AssetSettingService` tự "get-or-create" dòng mặc định nếu vì lý
do gì đó bảng trống (VD chỉnh tay trực tiếp trên DB) — tránh cả API lẫn
background service dưới đây bị lỗi vì thiếu cấu hình.

- `GET /api/AssetSetting` (`Asset.Setting.View`) / `PUT /api/AssetSetting`
  (`Asset.Setting.Update`, body `UpdateAssetSettingDto { LiquidationAfterMonths
  [Range(1,120)] }`) — cả 2 đều thao tác trên đúng 1 dòng, không có Id trên
  route.

**`DeviceLiquidationBackgroundService`** (`CompanySystem.HostApi/BackgroundServices/`,
đăng ký qua `AddHostedService` ở `Program.cs`) chạy **1 lần/ngày** (mặc định
00:30 giờ hệ thống, tính theo `TimeHelper.GetCurrentUtcTime()`), mỗi lần chạy
mở 1 `IServiceScopeFactory` scope riêng (không dùng chung DbContext với
request), thực hiện tuần tự trong `IAssetUnitOfWork`:

1. Device đang `PendingUse`(0)/`InUse`(1), `!IsDeleted`, có `ExpirationDate`
   và đã qua hạn (`ExpirationDate < hôm nay`) → chuyển `PendingLiquidation`(2).
2. Device đang `PendingLiquidation`(2), `!IsDeleted`, có `ExpirationDate` và
   `ExpirationDate.AddMonths(LiquidationAfterMonths) < hôm nay` → chuyển
   `Liquidated`(3). **Mốc tính "N tháng" là từ `ExpirationDate`** (hạn sử
   dụng), **không phải** từ lúc Device thực sự chuyển sang trạng thái Chờ
   thanh lý — nghĩa là nếu 1 Device bị chuyển tay sang `PendingLiquidation`
   trong khi `ExpirationDate` còn xa, job sẽ **không** tự chuyển `Liquidated`
   cho tới khi `ExpirationDate + N tháng` thực sự trôi qua (không cần thêm
   cột theo dõi "ngày vào trạng thái chờ thanh lý").
3. `SaveChangesAsync` 1 lần cho cả 2 bước. Lỗi (VD mất kết nối DB) được bắt
   và log qua `ILogger`, không làm crash background service — vòng lặp tự thử
   lại vào lần chạy kế tiếp (ngày hôm sau).

---

## 2. DTOs (`Asset.Application/Dtos/`)

- **Branches/**: `BranchDto` (Id/Code/Name), `CreateBranchDto` (+`[Required]`), `UpdateBranchDto`.
- **Suplliers/** *(giữ nguyên typo folder)*: `SupplierDto`, `CreateSupplierDto`, `UpdateSupplierDto`.
- **DeviceTypes/**: `DeviceTypeDto`, `CreateDeviceTypeDto`, `UpdateDeviceTypeDto`.
- **DeviceGroups/**: `DeviceGroupDto` (Id/GroupCode/GroupName/`DepartmentId`/`DepartmentName`), `CreateDeviceGroupDto`/`UpdateDeviceGroupDto` (`DepartmentId [Required]` + GroupCode/GroupName `[Required]`) — Nhóm nay thuộc về đúng 1 Bộ phận, xem §1.14.
- **DeviceDepartments/**: `DeviceDepartmentDto` (Id/Code/Name), `CreateDeviceDepartmentDto` (+`[Required]`), `UpdateDeviceDepartmentDto` — cùng khuôn `BranchDto`, xem §1.14.
- **Devices/**:
  - `DeviceFilterRequest` (query grid): `PageIndex=1`, `PageSize=50`, filter
    `DeviceCode/Manager/SupplierName` (`Contains`), `PurchaseDate` (`Contains`
    trên `ToString()`), `IpAddress?`/`Email?` (`Contains` khớp bất kỳ IP/email
    nào của Device), `GroupId?`/`DepartmentId?` (exact match), `Note`
    (`Contains`), `IsOutsourced?` (exact, bỏ qua nếu null), `SerialNumber?`
    (`Contains`), `IsUseUsb?` (exact match), `SortDeviceCodeAscending?` (`null`
    giữ mặc định `OrderByDescending(PurchaseDate)`; `true`/`false` = sort theo
    `DeviceCode` tăng/giảm dần, ghi đè sort mặc định).
  - `DeviceGridDto` (1 dòng grid): gộp tên Branch/Supplier/DeviceType +
    `GroupName?`/`DepartmentName?` (null nếu chưa gán) +
    `IpAddresses: List<string>`/`Emails: List<string>` + `StatusText` +
    `IsOutsourced` + `SerialNumber?`/`IsUseUsb`.
  - `DeviceDto` (GetById, đầy đủ): gộp tên Branch/DeviceType/Supplier +
    `GroupId?`/`GroupName?`/`DepartmentId?`/`DepartmentName?` +
    `StatusText` + `IpAddresses: List<DeviceIpAddressDto>` (`Id`/`IpAddress`) +
    `Emails: List<DeviceEmailDto>` (`Id`/`Email`/`Note`) + `ExpirationDate`
    tính toán + `SerialNumber?`/`IsUseUsb` + `SuggestedNewDeviceId?`/
    `SuggestedNewDeviceCode?` (đổi tên 2026-07-13, xem §1.8).
  - `CreateDeviceDto`/`UpdateDeviceDto`: `DeviceCode/DeviceName/Manager`
    `[Required]`, `Emails: List<DeviceEmailInputDto>` `[Required][MinLength(1)]`
    (mỗi item `Email [Required][EmailAddress]` + `Note?`),
    `DeviceTypeId/SupplierId/BranchId` `[Required]`, `GroupId?`/`DepartmentId?`
    (optional — không `[Required]`, server chỉ validate tồn tại khi có gửi Id,
    xem §1.14), `PurchaseDate` `[Required]`, `DepreciationMonths`
    `[Required][Range(1,600)]`, `IsOutsourced` (bool), `Status` `[Range(0,3)]`,
    `Note?`, `IpAddressIds: List<int>` (mỗi Id phải là IP `Available`, không
    giới hạn số lượng), `SerialNumber?` (`[StringLength(100)]`), `IsUseUsb`
    (bool), `SuggestedNewDeviceId?` (xem §1.8). **Không có** `ExpirationDate`
    (server tự tính, xem §1.5).
  - `DeviceIpAddressDto` (`Id`/`IpAddress`), `DeviceEmailDto`
    (`Id`/`Email`/`Note`), `DeviceEmailInputDto` (`Email`/`Note`, dùng cho
    Create/Update) — đi kèm entity `DeviceEmail`.
- **DeviceSoftwares/**: `DeviceSoftwareDto`, `CreateDeviceSoftwareDto` (+`[Required]` Device/Software), `UpdateDeviceSoftwareDto`.
- **Softwares/**: `SoftwareDto` (Id/Code/Name/Type?/Publisher?/Quantity?/Priority?/GroupId/GroupName —
  gộp tên `SoftwareGroup`), `CreateSoftwareDto` (+`[Required]` Code/Name/GroupId), `UpdateSoftwareDto`.
- **SoftwareGroups/**: `SoftwareGroupDto` (Id/Code/Name), `CreateSoftwareGroupDto` (+`[Required]`), `UpdateSoftwareGroupDto`.
- **IpAddresses/**: `IpAddressDto` (gộp `DeviceCode` + `StatusText` + `Prefix*` từ
  `IpPrefix`; `DeviceCode`="Khác" khi Status=1, không có `ServerIp`),
  `UpdateIpAddressDto` (thu hẹp — chỉ `Id`/`Status`/`Note`),
  `IpAddressFilterRequest` (`Keyword/Status/IsInUse/DeviceId`, **không có**
  `all` vì bảng pool lớn — `IsInUse?` lọc gộp đang/chưa sử dụng: `true`→
  `Status != Available`, `false`→`Status == Available`, AND với `Status` nếu
  gửi cả 2), `AssignIpAddressDto` (`DeviceId` `[Required]`). **Không có**
  `CreateIpAddressDto` (không tạo tay từng IP).
- **IpPrefixes/**: `IpPrefixDto` (không có `IpAddressCount` — thay bằng
  `UsedIpCount` (IP đang dùng, `Status != Available`) + `AvailableIpCount` (IP
  chưa dùng, `Status == Available`); có `BranchId?`/`BranchName?`),
  `CreateIpPrefixDto` (`Prefix` `[Required]` + `[RegularExpression]` 3 octet,
  `BranchId [Required]`, + SubnetMask/Gateway/DNS/Description dùng chung cho cả
  subnet — `CreateAsync` validate thêm các field IP hợp lệ + Gateway cùng
  subnet qua `NetworkHelper`, xem §1.2), `UpdateIpPrefixDto` (`Id`/
  `BranchId [Required]`/`SubnetMask?`/`Gateway?`/`PreferredDns?`/
  `AlternateDns?`/`Description?` — **không có** `Prefix`, xem §1.2).
- **DeviceConfigurations/**: `DeviceConfigurationDto` (gộp `DeviceCode`, đủ 20
  field linh kiện), `CreateDeviceConfigurationDto` (`DeviceId` `[Required]`,
  còn lại đều optional), `UpdateDeviceConfigurationDto` (giống Create + `Id`;
  field `DeviceId` vẫn còn trong DTO nhưng **không được đối chiếu/dùng để làm
  gì trong `UpdateAsync`** — tránh lỗi giả `DomainException` khi client gửi
  sai/thiếu `deviceId` cho 1 lần sửa cấu hình bình thường; `id` trên route đã
  định danh đúng bản ghi), `DeviceConfigurationInitialDto` (20 field +
  `CreatedAt`), `DeviceConfigurationHistoryDto` (20 field + `EditedAt`/
  `EditedBy`) — 2 DTO cuối không có Create/Update tương ứng (tự sinh, xem
  §1.13).
- **Devices/** (báo cáo): `DeviceReportFilterRequest` (`DeviceTypeId?/BranchId?/Keyword?`,
  tất cả optional), `DeviceReportItemDto` (`Stt/DeviceCode/DeviceName/IpAddress/
  PurchaseDate/ExpirationDate/IsExpired/FinancialPeriod/Note` — `IpAddress`
  vẫn là 1 `string?` để giữ nguyên contract báo cáo in ấn, chứa **toàn bộ IP
  đang gắn nối bằng `", "`** thay vì chỉ IP đầu tiên — xem công thức
  `FinancialPeriod` ở §1.7).
- **TransferHistories/**: `TransferHistoryDto` (gộp `OldDeviceCode/OldDeviceName/
  NewDeviceCode/NewDeviceName`), `CreateTransferHistoryDto` (`OldDeviceId`/
  `NewDeviceId` `[Required]`, `Note?`) — **không có** Update/Delete DTO
  (audit-log, xem §1.8).
- **Devices/** (xóa hàng loạt, xem §1.15): `BulkDeleteDeviceRequestDto` (`Ids:
  List<int>` `[Required][MinLength(1)]`), `BulkDeleteSkippedDeviceDto`
  (`Id/DeviceCode/Reason`), `BulkDeleteDeviceResultDto`
  (`DeletedCount/SkippedDevices`).
- **AssetSettings/** (xem §1.16): `AssetSettingDto` (`LiquidationAfterMonths`),
  `UpdateAssetSettingDto` (`LiquidationAfterMonths` `[Range(1,120)]`).

---

## 3. Repositories & UnitOfWork

- `IAssetUnitOfWork : IUnitOfWork` gom **18 repository**: `Devices`, `Branches`,
  `AssetSettings`, `DeviceGroups`, `DeviceDepartments`, `Softwares`, `SoftwareGroups`,
  `Suppliers`, `DeviceConfigurations`, `DeviceConfigurationInitials`,
  `DeviceConfigurationHistories`, `DeviceEmails`, `DeviceSoftwares`,
  `DeviceTypes`, `IpAddresses`, `IpPrefixes`, `TransferHistories`, `AuditTrails`.
- Tất cả repo hiện **generic thuần** (class con rỗng, chỉ kế thừa
  `GenericRepository<T, AssetDbContext>`) — chưa có method đặc thù nào.
- `AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>` inject đủ 18 repo qua constructor.

---

## 4. Services & API — hiện trạng theo từng thực thể

> Hợp đồng API đầy đủ (route/query/body/JSON mẫu) xem
> [asset-api-fe.md](asset-api-fe.md). Bảng dưới chỉ tóm tắt trạng thái nội bộ +
> mã permission theo từng entity.

| Thực thể | Service | Controller / Route | CRUD | Permission |
|---|---|---|---|---|
| Branch | `BranchService` (đầy đủ) | `BranchController` `/api/Branch` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.Branch.*` |
| DeviceGroup | `DeviceGroupService` (đầy đủ, thuộc về 1 Bộ phận, xem §1.14) | `DeviceGroupController` `/api/DeviceGroup` | grid-list?departmentId=, all?departmentId=, {id}, POST, PUT, DELETE | `Asset.DeviceGroup.*` |
| DeviceDepartment | `DeviceDepartmentService` (đầy đủ, xem §1.14) | `DeviceDepartmentController` `/api/DeviceDepartment` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.DeviceDepartment.*` |
| Device | `DeviceService` (đầy đủ) | `DeviceController` `/api/Device` | grid-list, `available` (không phân trang), {id}, `{id}/detail`, `{id}/replacement-suggestion`, POST, PUT, DELETE (xóa mềm), `bulk-delete` (POST, xóa mềm hàng loạt — chỉ thiết bị Đã thanh lý, xem §1.15) (**không có** `all`) | `Asset.Device.*` |
| AssetSetting | `AssetSettingService` (đầy đủ, xem §1.16) | `AssetSettingController` `/api/AssetSetting` | GET, PUT (thao tác trên đúng 1 dòng cấu hình, không có Id trên route) | `Asset.Setting.View/.Update` |
| Report (device-list) | dùng lại `IDeviceService.GetReportListAsync` | `ReportController` `/api/Report` (controller riêng cho mọi loại báo cáo) | `device-list` | `Asset.Report.View` |
| DeviceType | `DeviceTypeService` | `DeviceTypeController` `/api/DeviceType` | CRUD | `Asset.DeviceType.*` |
| Supplier | `SupplierService` | `SupplierController` `/api/Supplier` | CRUD | `Asset.Supplier.*` |
| DeviceSoftware | `DeviceSoftwareService` | `DeviceSoftwareController` `/api/DeviceSoftware` | GetByDevice, POST, PUT, DELETE, `picker/{deviceId}` (GET), `sync` (PUT, bulk tick) | `Asset.DeviceSoftware.*` (Picker→`.View`, Sync→`.Update`) |
| Software | `SoftwareService` (đầy đủ) | `SoftwareController` `/api/Software` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.Software.*` |
| SoftwareGroup | `SoftwareGroupService` (đầy đủ) | `SoftwareGroupController` `/api/SoftwareGroup` | grid-list, all, {id}, POST, PUT, DELETE | `Asset.SoftwareGroup.*` |
| IpAddress | `IpAddressService` (không có Create/Delete thủ công, Update chỉ đổi Status+Note) | `IpAddressController` `/api/IpAddress` | grid-list, `available` (không phân trang), {id}, PUT `{id}` (chỉ Status+Note), `{id}/assign`, `{id}/unassign` (**không có** POST/DELETE/`all`/`generate-range`) | `Asset.IpAddress.View/.Update/.Assign` |
| IpPrefix | `IpPrefixService` (POST tự sinh 255 IP con; PUT sửa Chi nhánh + DNS/Gateway; Delete cascade IP con chưa dùng) | `IpPrefixController` `/api/IpPrefix` | grid-list, all, {id}, POST, PUT (BranchId + SubnetMask/Gateway/DNS/Description, không sửa Prefix), DELETE | `Asset.IpPrefix.View/.Create/.Update/.Delete` |
| DeviceConfiguration | `DeviceConfigurationService` (CRUD + snapshot/history) | `DeviceConfigurationController` `/api/DeviceConfiguration` | `by-device/{deviceId}` (trả `null` nếu chưa có), POST, PUT, DELETE (xoá cứng, cascade Initial+History), `{configId}/initial` (GET), `initial/{id}` (DELETE), `{configId}/history` (GET list) — **không có** `grid-list`/`all` | `Asset.DeviceConfiguration.*` (initial/history GET→`.View`, DeleteInitial→`.Delete`) |
| TransferHistory | `TransferHistoryService` ("chuyển máy", xem §1.8) | `TransferHistoryController` `/api/TransferHistory` | POST (thực hiện chuyển máy), `device/{deviceId}` (GET, lịch sử) — **không có** grid-list/all/PUT/DELETE (audit-log) | `Asset.TransferHistory.Create/.View` |
| DeviceImport | `DeviceImportService` (import Device hàng loạt từ Excel/CSV, xem §1.9) | `DeviceImportController` `/api/DeviceImport` | `preview` (POST multipart file, không ghi DB), `confirm` (POST, validate lại rồi ghi DB trong 1 transaction) | `Asset.Device.Create` (dùng chung, không tách riêng) |
| DeviceConfigurationImport | `DeviceConfigurationImportService` (import cấu hình hàng loạt từ file Tanium, xem §1.10) | `DeviceConfigurationImportController` `/api/DeviceConfigurationImport` | `preview` (POST multipart file, không ghi DB), `confirm` (POST, validate lại rồi ghi DB trong 1 transaction) | `Asset.DeviceConfiguration.Update` (dùng chung, không tách riêng) |
| AuditTrail | ❌ chưa có | ❌ | — | — |

> **Auth**: toàn bộ 14 controller trên dùng `[RequirePermission("Module.Entity.Action")]`
> (attribute dùng chung ở `Shared.Application/Authorization/`, xem cơ chế đầy đủ
> + danh sách mã permission ở [identity-module.md](identity-module.md) §9). Gọi
> endpoint bắt buộc có JWT hợp lệ **và** Role của user phải được gán đúng
> permission tương ứng qua `PUT /api/Permission/role/{roleId}`.

**Các pattern service mẫu để nhân bản:**

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
  buộc): `Status` giữ bất biến theo `DeviceId` (xem §1.1). `GetPagedAsync`/
  `GetAvailableAsync`/`GetByIdAsync` (đọc), `UpdateAsync` thu hẹp chỉ đổi
  `Status`+`Note`, + 2 action `AssignToDeviceAsync`/`UnassignAsync` đổi
  `DeviceId`+`Status`. Lưu ý: `StatusText` (và `DeviceCode`="Khác" khi Status=1)
  trong `Expression<Func<>>` của `ToPagedResponseAsync` phải viết bằng ternary
  lồng nhau thay vì gọi method C#, vì EF Core dịch expression đó sang SQL và
  không hỗ trợ gọi method tuỳ ý.
- **Master record tự sinh/dọn hàng loạt record con** → xem `IpPrefixService`
  (IpPrefix 1-N IpAddress): `CreateAsync` tạo 1 `IpPrefix` xong (`AddAsync` +
  `SaveChangesAsync` để có `Id`), build luôn danh sách 255 `IpAddress` con
  (`n=1..255`) bằng LINQ `Enumerable.Range`, rồi `AddRangeAsync` +
  `SaveChangesAsync` **1 lần** cho cả batch (không loop insert từng bản ghi).
  Không cần check trùng vì Prefix vừa tạo chắc chắn chưa có IP con nào.
  `DeleteAsync` chặn nếu còn IP con đang gắn Device (`DomainException`), nếu
  không thì cascade soft-delete toàn bộ IP con chưa dùng cùng lúc với
  soft-delete Prefix.
- **Field tính toán + điều khiển quan hệ 1-N ngược chiều (owning side là bảng
  khác)** → xem `DeviceService` (Device 1-N IpAddress, nhưng Device không giữ FK —
  `IpAddress.DeviceId` mới là FK): `CreateAsync`/`UpdateAsync` tự tính
  `ExpirationDate = PurchaseDate.AddMonths(DepreciationMonths)` (không nhận từ
  client); gán/gỡ **nhiều** IP qua `SyncIpAddressesAsync` — đối chiếu diff
  giữa `IpAddressIds` mới với `FindAsync(x => x.DeviceId == device.Id &&
  !x.IsDeleted)` hiện có, chỉ `Update` field `DeviceId`/`Status` của những IP
  thực sự thêm/bớt (không gọi chéo sang `IpAddressService` — cùng
  `IAssetUnitOfWork` nên truy cập thẳng repo `_unitOfWork.IpAddresses` là đủ).
  Tương tự `SyncEmailsAsync` đối chiếu `Emails` mới với `DeviceEmails` hiện có
  (so khớp theo text, xem §1.6). `UpdateAsync` gom **mọi** thay đổi (Device +
  IP/Email thêm/bớt) vào **1 lần `SaveChangesAsync`** duy nhất ở cuối;
  `CreateAsync` cần 2 lần Save vì phải có `Device.Id` trước mới gán ngược được
  cho IP/Email.
- **1-1 optional, trả `null` thay vì `OrThrowNotFound`** → xem
  `DeviceConfigurationService.GetByDeviceIdAsync`: phần lớn Device chưa có
  `DeviceConfiguration` — đây là trạng thái bình thường, không phải lỗi, nên
  trả thẳng `null` (`ApiResponse.IsSuccess=true`, `Data=null`) thay vì ném
  `NotFoundException` như các lookup theo `Id` khác. FE dựa vào `null` để
  quyết định gọi `POST` (tạo mới) hay `PUT` (cập nhật).
- **Snapshot bất biến lúc tạo + audit log diff-based lúc sửa** → xem
  `DeviceConfigurationService` (`CreateAsync` tạo kèm `DeviceConfigurationInitial`;
  `UpdateAsync` so sánh field cũ/mới, chỉ `AddAsync` 1 dòng
  `DeviceConfigurationHistory` nếu thực sự có thay đổi, gộp chung
  `SaveChangesAsync` với `Update(config)`). Lấy "ai sửa" qua
  `IHttpContextAccessor.HttpContext?.User?.Identity?.Name` (claim JWT optional,
  fallback `"Unknown"` nếu request anonymous) — xem §1.13.

> **Picker chọn nhiều phần mềm cho Device + đồng bộ 1 lần**: `GET
> /api/DeviceSoftware/picker/{deviceId}` trả `List<SoftwarePickerDto>`
> (`SoftwareId/SoftwareCode/SoftwareName/IsSelected`) — toàn bộ Software
> `!IsDeleted`, `IsSelected=true` nếu đã có trong `DeviceSoftware` của
> `deviceId` đó. Dùng cho UI dạng checkbox-list (tick nhiều phần mềm 1 lúc,
> giống màn "Update software to Equipment" của hệ thống cũ).
> `PUT /api/DeviceSoftware/sync` (`SyncDeviceSoftwareDto`: `DeviceId`
> `[Required]`, `Items: List<DeviceSoftwareSyncItemDto>` — mỗi item
> `{SoftwareId [Required], InstallDate?, LicenseKey?}` **riêng theo từng phần
> mềm**, không dùng chung 1 key cho cả batch vì thực tế đa số phần mềm (OS,
> Office...) có key bản quyền khác nhau) đồng bộ **toàn bộ** trạng thái tick:
> phần mềm có trong `Items` nhưng chưa cài → `AddRangeAsync` (dùng
> `item.InstallDate ?? DateTime.UtcNow` + `item.LicenseKey` của riêng item
> đó); phần mềm đang cài nhưng **không còn trong `Items`** → `RemoveRange`
> (gỡ hẳn, xoá cứng vì `DeviceSoftware` không có `IsDeleted`). Phần mềm **giữ
> nguyên tick** → **không đụng vào** bản ghi cũ dù `Items` có gửi
> `LicenseKey`/`InstallDate` mới cho `SoftwareId` đó (không ghi đè); muốn sửa
> key/date của 1 phần mềm cụ thể đã cài thì dùng `PUT /api/DeviceSoftware`
> (Update từng dòng). Validate `Items` không được trùng `SoftwareId` + toàn bộ
> `SoftwareId` phải là Software tồn tại + chưa xoá trước khi ghi
> (`DomainException` nếu trùng hoặc có Id lạ). 1 lần `SaveChangesAsync` cho cả
> add+remove, trả về danh sách phần mềm sau đồng bộ.

> **API tổng hợp chi tiết Device**: `GET /api/Device/{id}/detail` trả
> `DeviceDetailDto { Device: DeviceDto, Configuration: DeviceConfigurationDto?,
> Softwares: List<DeviceSoftwareDto> }` — gộp `DeviceService.GetByIdAsync` +
> `DeviceConfigurationService.GetByDeviceIdAsync` (có thể `null`, xem §1.13) +
> `DeviceSoftwareService.GetByDeviceIdAsync` trong 1 lần gọi (compose service,
> `DeviceService` inject thêm `IDeviceConfigurationService`/
> `IDeviceSoftwareService` qua constructor).

**API endpoints chi tiết** (route pattern nhất quán):
- `GET /api/{Entity}/grid-list?pageIndex=&pageSize=&keyword=` → `PagedResponse`.
- `GET /api/{Entity}/all` → list rút gọn (active).
- `GET /api/{Entity}/{id}` · `POST /api/{Entity}` · `PUT /api/{Entity}/{id}` · `DELETE /api/{Entity}/{id}`.

---

## 5. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:** CRUD Branch/DeviceGroup/DeviceDepartment/DeviceType/Supplier/
Software/SoftwareGroup/Device (đầy đủ, kể cả chọn/gán IP, gán Nhóm/Bộ phận
optional — xem §1.14); IpAddress (chỉ đọc + gán/gỡ, không có Create/Update/
Delete thủ công) + IpPrefix (Create/Update/Delete — Update sửa Chi nhánh +
DNS/Gateway, không sửa Prefix, xem §1.2); CRUD
DeviceSoftware + picker checkbox-list + đồng bộ hàng loạt `PUT sync`; CRUD
DeviceConfiguration (kể cả snapshot "Cấu hình ban đầu" + audit log "Sửa chữa
Thay thế"); API tổng hợp `GET /api/Device/{id}/detail`; nghiệp vụ "chuyển máy"
(`TransferHistory`); import Device hàng loạt từ Excel/CSV; import cấu hình
hàng loạt từ file Tanium; báo cáo in ấn `device-list`; xóa cứng hàng loạt
Device (`bulk-delete`, xem §1.15); cấu hình `AssetSetting` + background
service tự động chuyển "Chờ thanh lý → Đã thanh lý" (xem §1.16); toàn bộ
Domain + DbContext + Migrations.

**Trạng thái migration đối chiếu DB thật** (thứ tự thời gian):

| Migration | Nội dung | Trạng thái |
|---|---|---|
| `AddIpPrefix` | Tạo bảng `IpPrefix`, backfill 27 dòng từ 6885 `IpAddress`, drop 4 cột cũ trên `IpAddresses` | **Đã apply** |
| `AddDeviceFields` | Thêm `DepreciationMonths`/`IsOutsourced`, backfill `DepreciationMonths` cho 5202 thiết bị | **Đã apply** |
| `AddDeviceConfigurationFields` | Thêm 6 cột nullable (`Maker/Model/PowerAdapter/WirelessCard/Nic/Other`) | **Đã apply** |
| `AddDeviceConfigurationHistory` | Tạo bảng `DeviceConfigurationInitials`/`DeviceConfigurationHistories` | **Đã apply** |
| `AddDeviceUsbSerialFields` | Thêm `SerialNumber`/`IsUseUsb` + unique index filtered | **Đã apply** |
| `AddDeviceEmailsMultiIp` | Tạo bảng `DeviceEmails`, backfill 5218/5225 `Device.Email` cũ, drop cột cũ | **Đã apply** |
| `UpdateIpAddressStatusRemoveServerIp` | Backfill `IpAddress.Status` sang enum 3 trạng thái mới, drop cột `ServerIP` | **CHƯA apply** — chờ người dùng tự chạy sau khi review |
| `AddDeviceReplacesOldDevice` | Thêm cột tự tham chiếu `Device.ReplacesOldDeviceId` | **Đã apply** |
| `AddDeviceGroupAndDepartment` | Tạo bảng `DeviceGroups`/`DeviceDepartments`, thêm cột nullable `Device.GroupId`/`DepartmentId`, seed 1 dòng mặc định mỗi bảng | **Đã apply** |
| `AddAssetSetting` | Tạo bảng `AssetSettings`, seed 1 dòng mặc định (`LiquidationAfterMonths=2`, xem §1.16) | Chưa apply — chờ deploy |
| `AddIpPrefixBranch` | Thêm cột nullable `IpPrefix.BranchId` + FK/index tới `Branches` (27 dải cũ để `null`, backfill dần qua PUT) | **Đã apply** (2026-07-13) |
| `ChangeDeviceGroupDepartmentRelation` | Xoá data cũ (`DeviceGroups`/`DeviceDepartments` chưa Device nào dùng), thêm `DeviceGroup.DepartmentId` bắt buộc + FK/unique composite, import 9 Bộ phận + 28 Nhóm chính thức (xem §1.14) | **Đã apply** (2026-07-13) — đã verify trên DB thật: 9 Bộ phận / 28 Nhóm, đúng số Nhóm mỗi Bộ phận theo ảnh |
| `RenameDeviceReplacementToSuggestedNewDevice` | Đổi hướng tự tham chiếu `Device.ReplacesOldDeviceId`→`SuggestedNewDeviceId` (đổi tên cột + đổi FK/index + **data-fixup SQL** chuyển giá trị hiện có sang đúng dòng máy CŨ, giữ gợi ý `Id` lớn nhất nếu nhiều máy mới cùng trỏ 1 máy cũ, xem §1.8) | **Đã apply** (2026-07-13) |

Ngoài ra: dữ liệu thật `Software`/`SoftwareGroup` đã được sửa lại qua API CRUD
sẵn có (không phải migration) — đối chiếu lại với dữ liệu gốc
(`HTLoaiPhanMem`/`HTPhanMem`) để sửa đúng 32 `SoftwareGroup` + 95 `Software`
(trước đó 1 lần migrate dữ liệu cũ bị sai: nhét mã nhóm cũ vào `SoftwareType`,
bỏ trống `SoftwareQuantity`/`SoftwarePriority`, dồn gần hết vào 1 group
`DEFAULT`).

**Bug đã biết (chưa fix)**: `SoftwareGroupService.UpdateAsync` so sánh
`GroupCode` cũ/mới **trong bộ nhớ** (case-sensitive) để quyết định có chạy
check trùng hay không, nhưng chính check trùng đó chạy dưới SQL Server với
collation mặc định **case-insensitive** — nên đổi `GroupCode` sang 1 chuỗi chỉ
khác hoa/thường so với chính nó (vd `"MS Office"` → `"MS OFFICE"`) luôn bị 400
"đã tồn tại" (tự đụng chính mình).

**Cần làm tiếp (theo độ ưu tiên gợi ý):**
1. **AuditTrail**: chưa có tầng Application/Api.
2. **Auth**: đã xong — chuyển sang `[RequirePermission]` chi tiết theo
   permission, xem [identity-module.md](identity-module.md) §9. Còn lại: Admin
   cần tự gán permission phù hợp cho các role `Basic`/`Quản lý Hợp Đồng`/
   `Quản lý Thiết bị` qua `PUT /api/Permission/role/{roleId}` (mặc định chỉ
   `Admin` được seed sẵn full quyền).
3. **Warning**: nhiều `CS8602`/`CS8603`/`CS8604` (deref/return possibly null)
   trong các Service — `GetByIdAsync` trả nullable, nên dùng `OrThrowNotFound`
   như `BranchService` (chấp nhận được, không chặn build).
4. **Field ngoài phạm vi Device hiện tại** (theo ảnh form hệ thống cũ, chưa
   làm vì chưa có yêu cầu rõ + cần thêm cột DB mới): Email 2/Email 3, Sticky
   Notes. Nếu cần, áp dụng đúng quy trình §4.2 CLAUDE.md (hỏi trước khi thêm cột).
5. **`SoftwareGroupService.UpdateAsync` case-collation bug** nêu trên — cần
   sửa logic so sánh sang case-insensitive (hoặc so `Id` của bản ghi trùng
   khác `request.Id`) trước khi cho phép rename đổi hoa/thường `GroupCode`.

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
