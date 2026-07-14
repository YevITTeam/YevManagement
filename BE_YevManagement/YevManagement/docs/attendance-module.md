# attendance-module.md — Module Attendance (Chấm công / Giấy tăng ca)

> **ĐÃ CÓ Domain + DbContext + Migration đầu (InitAttendance)**, chưa có Repository/UnitOfWork/DTO/Service/Controller. Tính năng đầu tiên: **Giấy tăng ca (OT Form)** với luồng duyệt nhiều cấp + phân quyền theo phạm vi tổ chức.

## 0. Chốt yêu cầu (CLAUDE.md §4.2)

### §Entity — đã tạo (`Attendance.Domain/Entities/`)

Danh mục (master data, đều có `IsDeleted`):
| Entity | Thuộc tính chính | Song ngữ (Vn/Jp)? |
|---|---|---|
| `Area` | `AreaCode`(unique), `AreaName`, `AreaDescription?` | **Không** (theo ERD gốc, chỉ 1 field) |
| `Line` | `LineCode`(unique), `LineNameVn`, `LineNameJp?` | Có |
| `Group` | `GroupCode`(unique), `GroupNameVn`, `GroupNameJp?` | Có |
| `Department` | `DepartmentCode`(unique), `DepartmentNameVn`, `DepartmentNameJp?` | Có — **entity mới** (ERD gốc không vẽ bảng Department dù OT FORM có `DepartmentId`). Quyết định: tạo riêng cho Attendance, KHÔNG dùng `Asset.DeviceDepartment` (khác DB, khác ngữ cảnh nghiệp vụ — Asset là phòng ban quản lý thiết bị, đây là phòng ban tổ chức nhân sự). |
| `Reason` | `ReasonNameVn`, `ReasonNameJp?` | Có |
| `OtCase` | `Code`(unique), `Description?`, `RequireSignature:bool` | Không |
| `Employee` | `Code`(unique), `FirstName`, `LastName`, `MonthToDate:decimal(10,2)`, `YearToDate:decimal(10,2)` | Tên riêng — không dịch |

Nghiệp vụ OT Form:
| Entity | Thuộc tính chính | Quan hệ | Ghi chú |
|---|---|---|---|
| `OtForm` | `AreaId/LineId/GroupId/DepartmentId/ReasonId/OtCaseId` (FK, Restrict), `StartTime/EndTime:TimeOnly`, `SubReason?`, `TotalHour:decimal(10,2)`, `Date:DateOnly`, `NumberOfEmployee`, `CreatedByUserId:int`, `Status:int` (enum `OtFormStatus`), `IsDeleted` | N-1 tới 6 danh mục trên; 1-N `OtFormEmployee`; 1-1 `ProcessPart`; 1-N `OtFormApprovalHistory` | `CreatedByUserId` KHÔNG có FK constraint thật — `Identity.User` nằm ở DB khác (`YevIdentityManagement`), chỉ lưu Id suông. |
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn, không phải danh mục dùng chung. |
| `UserApprovalScope` | `UserId:int`, `ScopeType:int` (enum, `Area/Line/Group/Department`), `ScopeId:int`, `ApprovalLevel:int` (enum `LineManager/DepartmentManager`), `IsDeleted` | Không FK thật (UserId khác DB; ScopeId đa hình theo ScopeType) | Ánh xạ 1 User (Trưởng xưởng/Trưởng phòng) phụ trách duyệt phạm vi nào. Tổng Giám Đốc KHÔNG cần dòng ở đây — duyệt cấp cuối bằng cách bypass scope (check `Role` claim). |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserId:int`, `ApprovalLevel:int`, `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm | Audit trail từng cấp duyệt; `SignatureImage` là snapshot tại thời điểm ký (không tham chiếu ngược `UserSignature`). |
| `UserSignature` | `UserId:int`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit. |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (Pending/ApprovedByLine/ApprovedByDepartment/Completed/Rejected), `ApprovalLevel` (Submitter/LineManager/DepartmentManager/GeneralDirector), `ApprovalAction` (Submitted/Approved/Rejected), `ScopeType` (Area/Line/Group/Department). Lưu dưới dạng `int` trên entity (theo convention `Asset.Domain.Entities.Device.Status`), không dùng `HasConversion`.

### §Business Logic — đã chốt sơ bộ, CHƯA code Service/Controller
- Luồng duyệt **nhiều cấp**: Submitter tạo đơn → LineManager (theo `LineId`) → DepartmentManager (theo `DepartmentId`) → Tổng Giám Đốc (bypass scope, duyệt mọi đơn ở `Status=ApprovedByDepartment`).
- Phân quyền theo 2 lớp độc lập: **Permission** (RBAC hiện có, gate hành động `Attendance.OTForm.Approve`) + **`UserApprovalScope`** (gate dữ liệu — phạm vi cụ thể).
- Ký tên: nếu `OtCase.RequireSignature = true` thì bước duyệt bắt buộc có `SignatureImage`.
- Chưa chốt: DTO, validate chi tiết, API endpoint, cách tính `TotalHour`/`MonthToDate`/`YearToDate` tự động hay nhập tay, seed permission `Attendance.OTForm.*`/`Attendance.UserApprovalScope.*`.

### §DB
- DB: `YevOTManagement` (DB có sẵn trên server `DASVRFAST`, conn `OTManagementConnection` trong `CompanySystem.HostApi/appsettings.json`). DbContext: `AttendanceDbContext` (`Attendance.Infrastructure/Context/`).
- Migration đầu: `InitAttendance` (`Attendance.Infrastructure/Migrations/`) — đã `database update` thành công, 13 bảng.
- Do có nhiều DbContext trong solution, mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`.

## 1. Trạng thái project (đã dựng, đúng chuẩn)
Reference đúng như module khác. Lưu ý:
- `Attendance.Api.csproj` hiện chỉ ref `Attendance.Infrastructure` (module khác ref thẳng `Application`) — khi cần DTO/interface, thêm `ProjectReference` tới `Attendance.Application`.
- `Attendance.Infrastructure.csproj` **không cần** thêm `PackageReference` EF Core riêng — đã có sẵn transitive qua `ProjectReference` tới `Shared.Infrastructure` (project SDK-style propagate PackageReference qua ProjectReference).

## 2. Template scaffold — bước tiếp theo (Repo/UoW/DTO/Service/Controller, điền tên thật khi làm)
Kế thừa 100% pattern lõi ([architecture-core.md](architecture-core.md)). Ký hiệu `{Entity}`/`{Feature}`.

- **Domain** `Attendance.Domain/Entities/{Entity}.cs`: `class {Entity} { int Id; ...; bool IsDeleted; }` + navigation.
- **DbContext** `Attendance.Infrastructure/Context/AttendanceDbContext.cs`: `partial class : DbContext`, 2 constructor, `DbSet<{Entity}>`, `OnModelCreating` (`HasKey`, `HasMaxLength`, `HasIndex().IsUnique()`) + `partial void OnModelCreatingPartial`.
- **Repository**: interface `I{Entity}Repository : IGenericRepository<{Entity}>` (Application/Interfaces/Repository) + impl `{Entity}Repository : GenericRepository<{Entity}, AttendanceDbContext>, I{Entity}Repository` (Infrastructure/Repositories).
- **UnitOfWork**: `IAttendanceUnitOfWork : IUnitOfWork` (phơi bày mỗi repo 1 property) + `AttendanceUnitOfWork : BaseUnitOfWork<AttendanceDbContext>, IAttendanceUnitOfWork` (inject repo qua constructor).
- **DTOs** `Application/Dtos/{Entity}s/`: `{Entity}Dto`, `Create{Entity}Dto` (+ `[Required(ErrorMessage="… tiếng Việt")]`), `Update{Entity}Dto`.
- **Service** `{Feature}Service : BaseService<IAttendanceUnitOfWork>, I{Feature}Service` — nhân theo `Asset.Application/Services/BranchService.cs` (CRUD soft-delete, phân trang `ToPagedResponseAsync`, check trùng bằng `DomainException`, `OrThrowNotFound`).
- **Controller**: `BaseController` (COPY từ `Asset.Api/Controllers/BaseController.cs`, đổi ns) + `{Feature}Controller : BaseController` (route pattern `grid-list`/`{id}`/POST/PUT `{id}`/DELETE `{id}`, gắn `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- **AssemblyReference**: `namespace Attendance.Api; public static class AssemblyReference {}`.

## 3. Wiring Host
Trong `CompanySystem.HostApi` (Scrutor tự lo Service/Repo/UoW vì tên đúng quy ước):
1. `Configurations/DependencyInjection.cs` `AddDIConfig`: **đã** `services.AddDbContext<AttendanceDbContext>(o => o.UseSqlServer(configuration.GetConnectionString("OTManagementConnection")))`.
2. Connection string: **đã** thêm vào `appsettings.json`.
3. Migration đầu: **đã** `InitAttendance` + `database update` (13 bảng, DB `YevOTManagement`).
4. **CHƯA làm** (chỉ cần khi có Controller): `Program.cs` chuỗi `AddControllers()` thêm `.AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)` — hiện `Attendance.Api` chưa có `AssemblyReference`/Controller nào.

## 4. Definition of Done
§0 ✅ → Domain+DbContext+Fluent ✅ → Migration ✅ → build sạch ✅ → Repo+UoW _(chưa)_ → DTOs _(chưa)_ → Service _(chưa)_ → Controller + AssemblyReference + Wiring §3.4 _(chưa)_ → seed permission `Attendance.OTForm.*` (Identity module, xem docs/identity-module.md §9) _(chưa)_.
