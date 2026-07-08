# asset-module.md — Module Asset (Quản lý Thiết bị / PC)

> **Trạng thái:** ĐANG PHÁT TRIỂN. Đã có nền CRUD cho nhiều thực thể (Branch,
> DeviceType, Supplier, Software, SoftwareGroup, DeviceSoftware); Device mới có
> grid, còn IpAddress/DeviceConfiguration/TransferHistory/AuditTrail chưa có
> Application/Api. Đọc [architecture-core.md](architecture-core.md) trước.

- **DB:** `YevPCManagement` (connection string `PCManagementConnection`).
- **DbContext:** `AssetDbContext` (`Asset.Infrastructure/Context/`).
- **Đặc điểm:** DB scaffold từ hệ thống cũ → tên bảng/cột/constraint bằng **tiếng
  Việt** (ví dụ entity `Device` → `PK_ThietBis`, `IX_ThietBis_MaMay`). Giữ đúng
  quy ước đặt tên này khi map entity mới.

---

## 1. Domain Models (`Asset.Domain/Entities/`)

| Entity | Thuộc tính chính | Quan hệ | Soft delete |
|---|---|---|---|
| `Device` | `DeviceCode`(unique), `DeviceName`, `DeviceTypeId`, `SupplierId`, `BranchId`, `Manager`, `Email`, `PurchaseDate`, `ExpirationDate?`, `Status`, `Note?` | N-1 Branch/DeviceType/Supplier; 1-1 DeviceConfiguration; 1-N IpAddresses, DeviceSoftwares, TransferHistory(old/new) | **Có** |
| `Branch` | `BranchCode`(unique), `BranchName` | 1-N Devices | **Có** |
| `Supplier` | `SupplierCode`(unique), `SupplierName` | 1-N Devices | **Có** |
| `DeviceType` | `TypeCode`(unique), `TypeName` | 1-N Devices | **Có** |
| `IpAddress` | `IpAddress1`(unique, cột `IpAddress`), `SubnetMask?`, `Gateway?`, DNS..., `DeviceId?`, `Status`, `Note?` | N-1 Device | **Có** |
| `DeviceConfiguration` | Cấu hình phần cứng: `Cpu/Ram/HardDrive/Os/Vga...` (cột viết hoa CPU/RAM/OS...) | 1-1 Device (`DeviceId` unique) | Không |
| `DeviceSoftware` | **Khoá kép** `(DeviceId, SoftwareId)`, `InstallDate`, `LicenseKey?` | N-1 Device, N-1 Software | Không |
| `Software` | `SoftwareCode`(unique), `SoftwareName`, `SoftwareType?`, `Publisher?`, `SoftwareQuantity?`, `SoftwarePriority?`, `SoftwareGroupId` | N-1 SoftwareGroup, 1-N DeviceSoftwares | **Có** |
| `SoftwareGroup` | `GroupCode`(unique), `GroupName` | 1-N Softwares | **Có** |
| `TransferHistory` | `OldDeviceId`, `NewDeviceId`, `TransferDate`, `Note?` | N-1 OldDevice/NewDevice (DeleteBehavior.ClientSetNull) | Không |
| `AuditTrail` | `Id(long)`, `TableName`, `RecordId`, `Action`, `OldValues?`, `NewValues?`, `ChangedBy`, `ChangedAt` | — (namespace `Asset.Domain.Models`) | Không |

> `DeviceSoftware` dùng **khoá chính kép** — không có `Id` đơn. Repo/service phải
> tìm bằng cả `DeviceId + SoftwareId` (dùng `FirstOrDefaultAsync`, không dùng `GetByIdAsync`).

---

## 2. DTOs (`Asset.Application/Dtos/`)

- **Branches/**: `BranchDto` (Id/Code/Name), `CreateBranchDto` (+`[Required]`), `UpdateBranchDto`.
- **Suplliers/** *(giữ nguyên typo folder)*: `SupplierDto`, `CreateSupplierDto`, `UpdateSupplierDto`.
- **DeviceTypes/**: `DeviceTypeDto`, `CreateDeviceTypeDto`, `UpdateDeviceTypeDto`.
- **Devices/**:
  - `DeviceFilterRequest` (query grid): `PageIndex=1`, `PageSize=50`, filter
    `DeviceCode/Manager/PurchaseDate/IpAddress/SupplierName/Note`.
  - `DeviceGridDto` (1 dòng grid): gộp tên Branch/Supplier/DeviceType + IP đầu tiên.
- **DeviceSoftwares/**: `DeviceSoftwareDto`, `CreateDeviceSoftwareDto` (+`[Required]` Device/Software), `UpdateDeviceSoftwareDto`.
- **Softwares/**: `SoftwareDto` (Id/Code/Name/Type?/Publisher?/Quantity?/Priority?/GroupId/GroupName —
  gộp tên `SoftwareGroup`), `CreateSoftwareDto` (+`[Required]` Code/Name/GroupId), `UpdateSoftwareDto`.
- **SoftwareGroups/**: `SoftwareGroupDto` (Id/Code/Name), `CreateSoftwareGroupDto` (+`[Required]`), `UpdateSoftwareGroupDto`.

---

## 3. Repositories & UnitOfWork

- `IAssetUnitOfWork : IUnitOfWork` gom **11 repository**: `Devices`, `Branches`,
  `Softwares`, `SoftwareGroups`, `Suppliers`, `DeviceConfigurations`, `DeviceSoftwares`,
  `DeviceTypes`, `IpAddresses`, `TransferHistories`, `AuditTrails`.
- Tất cả repo hiện **generic thuần** (class con rỗng, chỉ kế thừa
  `GenericRepository<T, AssetDbContext>`) — chưa có method đặc thù nào.
- `AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>` inject đủ 11 repo qua constructor.

---

## 4. Services & API — hiện trạng theo từng thực thể

| Thực thể | Service | Controller / Route | CRUD | Auth |
|---|---|---|---|---|
| Branch | `BranchService` (đầy đủ) | `BranchController` `/api/Branch` | grid-list, all, {id}, POST, PUT, DELETE | `[AllowAnonymous]` |
| Device | `DeviceService` (chỉ grid) | `DeviceController` `/api/Device` | **chỉ** `grid-list` | `[AllowAnonymous]` |
| DeviceType | `DeviceTypeService` | `DeviceTypeController` `/api/DeviceType` | CRUD | `[AllowAnonymous]` |
| Supplier | `SupplierService` | `SupplierController` `/api/Supplier` | CRUD | `[AllowAnonymous]` |
| DeviceSoftware | `DeviceSoftwareService` | `DeviceSoftwareController` `/api/DeviceSoftware` | GetByDevice, POST, PUT, DELETE | `[AllowAnonymous]` |
| Software | `SoftwareService` (đầy đủ) | `SoftwareController` `/api/Software` | grid-list, all, {id}, POST, PUT, DELETE | `[AllowAnonymous]` |
| SoftwareGroup | `SoftwareGroupService` (đầy đủ) | `SoftwareGroupController` `/api/SoftwareGroup` | grid-list, all, {id}, POST, PUT, DELETE | `[AllowAnonymous]` |
| IpAddress | ❌ chưa có | ❌ | — | — |
| DeviceConfiguration | ❌ chưa có | ❌ | — | — |
| TransferHistory | ❌ chưa có | ❌ | — | — |
| AuditTrail | ❌ chưa có | ❌ | — | — |

**Hai pattern service mẫu để nhân bản:**

- **CRUD chuẩn** → xem `BranchService` (soft-delete, check trùng code bằng
  `DomainException`, `OrThrowNotFound`, phân trang `ToPagedResponseAsync`, có cả
  `GetAllActiveAsync` dùng `SelectAsync`).
- **Grid filter động** → xem `DeviceService.GetDevicesForGridAsync`: lấy
  `GetQueryable(false, ...includes)`, `.Where(!IsDeleted)`, nối filter theo field,
  `OrderByDescending`, rồi `ToPagedResponseAsync` projection sang `DeviceGridDto`.
- **Khoá kép** → xem `DeviceSoftwareService`: mọi thao tác tìm bằng
  `FirstOrDefaultAsync(x => x.DeviceId == .. && x.SoftwareId == ..)`, xoá **cứng**
  (`Delete`, không soft-delete vì entity không có `IsDeleted`).
- **CRUD có FK bắt buộc** → xem `SoftwareService` (Software → SoftwareGroup):
  `GetPagedAsync`/`GetAllActiveAsync`/`GetByIdAsync` dùng `GetQueryable`/`FirstOrDefaultAsync`
  kèm `.Include(x => x.SoftwareGroup)` để gộp `SoftwareGroupName` vào DTO; `CreateAsync`/
  `UpdateAsync` validate `SoftwareGroupId` tồn tại bằng `_unitOfWork.SoftwareGroups.GetByIdAsync`
  + `OrThrowNotFound` trước khi ghi.

**API endpoints chi tiết** (route pattern nhất quán):
- `GET /api/{Entity}/grid-list?pageIndex=&pageSize=&keyword=` → `PagedResponse`.
- `GET /api/{Entity}/all` → list rút gọn (active).
- `GET /api/{Entity}/{id}` · `POST /api/{Entity}` · `PUT /api/{Entity}/{id}` · `DELETE /api/{Entity}/{id}`.

---

## 5. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:** CRUD Branch/DeviceType/Supplier/Software/SoftwareGroup; grid Device
(filter + phân trang); CRUD DeviceSoftware; toàn bộ Domain + DbContext +
Migrations (đã map 11 entity).

**Cần làm tiếp (theo độ ưu tiên gợi ý):**
1. **Device**: mới có grid, **thiếu** GetById/Create/Update/Delete và quản lý
   cấu hình (`DeviceConfiguration`), IP (`IpAddress`), phần mềm cài đặt.
2. **IpAddress / DeviceConfiguration / TransferHistory / AuditTrail**: chưa có
   tầng Application/Api.
3. **Auth**: tất cả controller Asset đang `[AllowAnonymous]` — cần siết quyền
   thật trước khi lên production.
4. **Warning**: nhiều `CS8602` (deref possibly null) trong các Service —
   `GetByIdAsync` trả nullable, nên dùng `OrThrowNotFound` như `BranchService`
   (Software/SoftwareGroup mới thêm cũng theo pattern này, cùng warning y hệt).

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
   được host nạp sẵn qua `AddApplicationPart` — không cần chỉnh Program.cs.
8. **Migration**: `dotnet ef migrations add <Name> --project Asset.Infrastructure --startup-project CompanySystem.HostApi`.
9. Cập nhật lại bảng ở §4 và mục §5 của file doc này.
