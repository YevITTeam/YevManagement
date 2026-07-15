# attendance-module.md — Module Attendance (Chấm công / Giấy tăng ca)

> **ĐÃ CÓ CODE** — Domain + DbContext + Migrations + Repository/UnitOfWork + DTO + Service + Controller
> đầy đủ cho tính năng đầu tiên: **Giấy tăng ca (OT Form)** với luồng duyệt nhiều cấp + phân quyền
> theo phạm vi tổ chức + chữ ký. Build sạch, đã smoke-test host khởi động OK (2026-07-14).
>
> **FE triển khai đọc [attendance-api-fe.md](attendance-api-fe.md)** — hợp đồng API đầy đủ (request/response
> mẫu, enum, checklist màn hình). File này (`attendance-module.md`) là tài liệu **cho dev BE**: lý do thiết kế,
> migration, cấu trúc code nội bộ.

## 0. Chốt yêu cầu (CLAUDE.md §4.2)

### §Entity (`Attendance.Domain/Entities/`)

Danh mục (master data, đều có `IsDeleted`):
| Entity | Thuộc tính chính | Song ngữ (Vn/Jp)? |
|---|---|---|
| `Department` | `DepartmentCode`(unique), `DepartmentNameVn`, `DepartmentNameJp?` | Có — **entity mới** (ERD gốc không vẽ bảng Department dù OT FORM có `DepartmentId`). Tạo riêng cho Attendance, KHÔNG dùng `Asset.DeviceDepartment` (khác DB, khác ngữ cảnh nghiệp vụ). |
| `Group` | `GroupCode`(unique), `GroupNameVn`, `GroupNameJp?`, `DepartmentId`(FK, **1 Department - N Group**, theo pattern `Asset.Domain.Entities.DeviceGroup.DepartmentId`) | Có |
| `Reason` | `ReasonNameVn`, `ReasonNameJp?` | Có |
| `OtCase` | `Code`(unique), `Description?`, `RequireSignature:bool`, `RequiredApprovalLevel:int` (enum `ApprovalLevel` — cấp CUỐI phải đạt) | Không |
| `Employee` | `Code`(unique), `FirstName`, `LastName`, `MonthToDate:decimal(10,2)`, `YearToDate:decimal(10,2)`, `GroupId`(FK, **BẮT BUỘC**) | Tên riêng — không dịch. Department suy ra qua `Group.DepartmentId`, không lưu trùng trên Employee. |

> **Đã bỏ `Area`/`Line`** (2026-07-14): OT Form không cần "tên công đoạn" ở cấp Area/Line. Xoá hẳn (migration `RemoveAreaLineFromOtFormAddGroupDepartment`), không giữ bảng mồ côi.
>
> **Đã bỏ `Employee.DepartmentId`, `GroupId` thành bắt buộc** (2026-07-14, migration `MakeEmployeeGroupRequiredRemoveDepartment`): Department suy ra qua `Group.DepartmentId`, tránh 2 nguồn dữ liệu lệch nhau.
>
> **Đã đổi `UserId:int` → `UserName:string`** trên `OtForm.CreatedByUserName`, `OtFormApprovalHistory.ApproverUserName`, `UserApprovalScope.UserName`, `UserSignature.UserName` (2026-07-14, migration `RenameUserIdToUserName`): JWT không có claim UserId dạng số, chỉ có `UserName` (`User.Identity.Name` — claim `ClaimTypes.Name` do `MyClaimsTransformation` nạp). Theo đúng convention `Asset.Domain.Models.AuditTrail.ChangedBy` (string) đã có sẵn trong codebase.

Nghiệp vụ OT Form:
| Entity | Thuộc tính chính | Quan hệ | Ghi chú |
|---|---|---|---|
| `OtForm` | `GroupId/DepartmentId/ReasonId/OtCaseId` (FK, Restrict), `StartTime/EndTime:TimeOnly`, `SubReason?`, `TotalHour:decimal(10,2)`, `Date:DateOnly`, `NumberOfEmployee`, `CreatedByUserName:string`, `Status:int` (enum `OtFormStatus`), `IsDeleted` | N-1 tới 4 danh mục trên; 1-N `OtFormEmployee`; 1-1 `ProcessPart`; 1-N `OtFormApprovalHistory` | |
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn. |
| `UserApprovalScope` | `UserName:string`, `ScopeType:int` (enum, `Group/Department`), `ScopeId:int`, `ApprovalLevel:int` (enum `DepartmentManager/WorkshopManager`), `IsDeleted` | Không FK thật (ScopeId đa hình theo ScopeType) | Ánh xạ 1 User (Trưởng phòng/Trưởng xưởng) phụ trách duyệt phạm vi nào. Tổng Giám Đốc KHÔNG cần dòng ở đây — bypass scope (check Role claim). |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserName:string`, `ApprovalLevel:int`, `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm | Audit trail từng cấp duyệt; `SignatureImage` là snapshot tại thời điểm ký. |
| `UserSignature` | `UserName:string`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit (nguồn thật = `OtFormApprovalHistory.SignatureImage`). |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (Pending/ApprovedByDepartment/ApprovedByWorkshop/Completed/Rejected), `ApprovalLevel` (Submitter/DepartmentManager/WorkshopManager/GeneralDirector), `ApprovalAction` (Submitted/Approved/Rejected), `ScopeType` (Group/Department). Lưu dưới dạng `int` trên entity, không dùng `HasConversion`.

### §Business Logic (đã code trong `OtFormService`)
Chốt theo phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam):
- **Bước 0 — Submitter (Trưởng Group) ký "Người đề nghị" — bắt buộc, cùng lúc tạo đơn**: `OtFormService.CreateAsync` insert `OtForm` + `OtFormEmployee` + `ProcessPart` + `OtFormApprovalHistory(ApprovalLevel=Submitter, Action=Submitted, SignatureImage=request.SubmitterSignatureImage)` trong **1 `SaveChangesAsync()` duy nhất** (atomic). Chữ ký Người đề nghị luôn bắt buộc (`CreateOtFormDto.SubmitterSignatureImage` có `[Required]`), không phụ thuộc `OtCase.RequireSignature`. `Status` khởi tạo = `Pending` ngay từ lúc tạo.
- Luồng duyệt **tuần tự**: `DepartmentManager` (Trưởng phòng) → `WorkshopManager` (Trưởng xưởng) → `GeneralDirector` (Tổng Giám Đốc), dừng ở cấp = `OtCase.RequiredApprovalLevel`:
  - TH1 (ngày thường) → `RequiredApprovalLevel = DepartmentManager`.
  - TH2 (ngày nghỉ/CN/lễ) → `RequiredApprovalLevel = WorkshopManager`.
  - TH3 (lũy kế > 25h/tháng hoặc > 300h/năm) → `RequiredApprovalLevel = GeneralDirector`.
- Phân quyền 2 lớp: **Permission** (`Attendance.OTForm.Approve` gate hành động) + **`UserApprovalScope`** (gate dữ liệu — khớp `ScopeType/ScopeId` với `OtForm.DepartmentId`/`GroupId` VÀ đúng `ApprovalLevel` đang chờ). `GeneralDirector` bypass scope, chỉ cần `User.IsInRole("Tổng Giám Đốc")`.
- Ký tên các cấp duyệt: nếu `OtCase.RequireSignature = true` thì `ApproveOtFormDto.SignatureImage` bắt buộc (validate trong `OtFormService.ApproveAsync`).
- `Employee.GroupId` (bắt buộc) — Trưởng Group tạo đơn chỉ được chọn nhân viên **cùng `GroupId`** với đơn (`OtFormService.CreateAsync` validate, ném `DomainException` nếu lệch nhóm).
- Reject: ở bất kỳ cấp nào, `RejectOtFormDto.Comment` bắt buộc, `Status → Rejected`, dừng luồng.

### §DB
- DB: `YevOTManagement` (server `DASVRFAST`, conn `OTManagementConnection`). DbContext: `AttendanceDbContext`.
- Migrations theo thứ tự: `InitAttendance` → `AddOtCaseApprovalLevelAndEmployeeScope` → `RemoveAreaLineFromOtFormAddGroupDepartment` → `MakeEmployeeGroupRequiredRemoveDepartment` → `RenameUserIdToUserName`. Tất cả đã `database update` vào `YevOTManagement`.
- Do nhiều DbContext trong solution, mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`.

## 1. Cấu trúc code đã có

### Danh mục CRUD chuẩn (Department/Group/Reason/OtCase/Employee)
Mỗi entity có đủ: `I{Entity}Repository` (Application/Interfaces/Repository) + impl (Infrastructure/Repositories) → property trong `IAttendanceUnitOfWork`/`AttendanceUnitOfWork` → `{Entity}Dto`/`Create{Entity}Dto`/`Update{Entity}Dto` (Application/Dtos) → `{Entity}Service : BaseService<IAttendanceUnitOfWork>` → `{Entity}Controller : BaseController` (route `grid-list`/`all`/`{id}`/POST/PUT/DELETE, `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- `GroupController` có thêm `GET /by-department/{departmentId}` (dropdown phụ thuộc).
- `EmployeeController` có thêm `GET /by-group/{groupId}` (Trưởng Group chọn hàng loạt nhân viên).

### UserApprovalScope (`UserApprovalScopeController`)
- `GET /grid-list`, `GET /by-user/{userName}`, `POST` (validate `ScopeId` tồn tại đúng bảng theo `ScopeType`, chặn trùng), `DELETE /{id}` (soft-delete). Không có `PUT` — sửa = xoá + tạo lại.

### UserSignature (`UserSignatureController`)
- `GET /me`, `PUT /me` (đăng ký/cập nhật chữ ký **của chính mình**, `[RequirePermission("Attendance.UserSignature.Update")]`).
- `GET /{userName}` (admin xem chữ ký người khác, `Attendance.UserSignature.View`).

### OtForm (`OtFormController`) — nghiệp vụ chính
- `POST /api/OtForm` — Trưởng Group tạo đơn (`Attendance.OTForm.Create`), ký Người đề nghị trong cùng request.
- `GET /api/OtForm/my-forms` — đơn do chính mình tạo (`Attendance.OTForm.View`).
- `GET /api/OtForm/pending-approvals` — đơn đang chờ chính mình duyệt, tự lọc theo `UserApprovalScope` hoặc bypass nếu `Role="Tổng Giám Đốc"` (`Attendance.OTForm.Approve`).
- `GET /api/OtForm/{id}` — chi tiết đầy đủ (Employees, ProcessPart, ApprovalHistories).
- `POST /api/OtForm/{id}/approve`, `POST /api/OtForm/{id}/reject` (`Attendance.OTForm.Approve`).
- `BaseController.CurrentUserName` (`Attendance.Api/Controllers/BaseController.cs`) — helper lấy `User.Identity.Name` dùng chung cho mọi Controller cần biết "ai đang gọi API".

### Permission & Role đã seed (Identity migration `AddAttendancePermissionsAndRoles`)
- 28 permission `Attendance.*`: CRUD 5 danh mục + `UserApprovalScope.{View,Create,Delete}` + `UserSignature.{View,Update}` + `OTForm.{View,Create,Approve}`.
- 4 Role mới: `Trưởng Group` (Create+View OTForm, View Employee, Update UserSignature), `Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc` (View+Approve OTForm, Update UserSignature). `Admin` được gán full toàn bộ permission `Attendance.*`.
- **Chưa làm**: gán Role cho user thật (`update-user-roles`/`create-user` — API Identity có sẵn) và tạo dòng `UserApprovalScope` cho từng Trưởng phòng/Trưởng xưởng thật (`POST /api/UserApprovalScope` — API đã có).

## 2. Wiring Host — đã xong
1. `Configurations/DependencyInjection.cs`: `AddDbContext<AttendanceDbContext>` với `OTManagementConnection`.
2. `Program.cs`: `AddControllers().AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)`.
3. `Attendance.Api.csproj`: thêm `ProjectReference` tới `Attendance.Application` (cần cho DTO/Interface Service).
4. Scrutor tự động đăng ký toàn bộ `*Repository`/`*UnitOfWork`/`*Service` trong assembly `Attendance.*` (không cần khai báo `AddScoped` thủ công).

## 3. Đã smoke-test (2026-07-14)
Build 0 lỗi. Host khởi động, `/openapi/v1.json` liệt kê đủ route `Department/Group/Reason/OtCase/Employee/OtForm/UserApprovalScope/UserSignature`. Gọi không token → 401 đúng như thiết kế (RequirePermission hoạt động).

## 4. Còn thiếu / bước tiếp theo
- Gán Role thật cho user (Trưởng Group/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) + tạo dữ liệu `UserApprovalScope` thật.
- Seed data mẫu: 3 `OtCase` (TH1/TH2/TH3 với `RequiredApprovalLevel` tương ứng), `Department`/`Group`/`Reason`/`Employee` thật.
- Validate end-to-end qua Scalar UI với JWT thật (chưa test luồng Create → Approve → Reject với dữ liệu thật).
- Cân nhắc thêm `PUT` cho `UserApprovalScope` nếu cần sửa thay vì xoá-tạo-lại.
- FE chưa có — hợp đồng API đã tài liệu hoá đầy đủ ở [attendance-api-fe.md](attendance-api-fe.md), đội FE có thể bắt đầu code song song trong lúc BE tiếp tục seed data thật.
