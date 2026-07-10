# identity-module.md — Module Identity

> **Trạng thái:** ĐÃ CÓ CODE, đang chạy production. Quản lý User/Role và xác thực
> qua **Windows Negotiate (AD)** → sinh **JWT**. Đọc [architecture-core.md](architecture-core.md)
> trước để nắm pattern lõi. Tài liệu cho đội FE (request/response, luồng login
> từ browser): [identity-api-fe.md](identity-api-fe.md).

- **DB:** `YevIdentityManagement` (connection string `IdentityManagementConnection`).
- **DbContext:** `IdentityDbContext` (`Indentity.Infrastructure/Context/`).
- **Thư mục Infrastructure:** `Indentity.Infrastructure/` (⚠️ typo "Inden", assembly = `Identity.Infrastructure`).

---

## 1. Domain Models

| Entity | Thuộc tính chính | Quan hệ | Soft delete |
|---|---|---|---|
| `User` | `Id`, `UserName`(≤100), `FullName?`, `CreatedAt`, `DeviceName?`(≤100) | N-N `Roles`, 1-N `LoginUserIPs` | Không |
| `Role` | `Id`, `RoleName`(≤50), `Description?`, `IsDeleted` | N-N `Users`, N-N `Permissions` | **Có** (`IsDeleted`) |
| `LoginUserIP` | `Id`, `UserId`, `IPAddress`, `FirstLoginAt`, `LastLoginAt` | N-1 `User` | Không |
| `Permission` | `Id`, `Code`(≤150, unique, dạng `Module.Entity.Action`), `Module`(≤50), `Description?`(≤255) | N-N `Roles` | Không (danh sách cố định, seed qua migration — xem §9) |

**Cấu hình quan hệ (Fluent, `IdentityDbContext.OnModelCreating`):**
- `User` ↔ `Role`: **many-to-many** qua bảng nối `UserRoles` (khoá kép
  `UserId, RoleId`), khai báo bằng `UsingEntity<Dictionary<string,object>>`.
- `Role` ↔ `Permission`: **many-to-many** qua bảng nối `RolePermissions` (khoá kép
  `RoleId, PermissionId`) — cùng pattern `UsingEntity<Dictionary<string,object>>`
  như `UserRoles`, không có repository riêng cho bảng nối.
- `User`/`Role`/`Permission` là `partial class`; `IdentityDbContext` là `partial`.
- `LoginUserIP` chưa có Fluent config riêng (map theo convention).

---

## 2. DTOs (`Identity.Application/Dtos/UserDto/`)

| DTO | Dùng cho |
|---|---|
| `UserDto` | Trả thông tin user: `Id`, `UserName`, `FullName`, `DeviceName?`, `Roles: List<string>`, `Permissions: List<string>` (mã permission, suy ra từ claim `Permission`). |
| `LoginResponseDto` | Kết quả login: `User: UserDto`, `Token: string`. |
| `RoleDto` | `Id`, `RoleName`, `Description?` (dùng cả input tạo role lẫn output). |
| `UpdateRoleDto` | `RoleName`, `Description?`. |
| `UpdateUserRolesDto` | `UserId`, `RoleIds: List<int>`. |
| `PermissionDto` | `Id`, `Code`, `Module`, `Description?` — output-only, không có Create/Update DTO (permission là danh sách cố định). |
| `UpdateRolePermissionsDto` | `RoleId`, `PermissionIds: List<int>` — gán lại toàn bộ tập permission cho 1 role. |

> Ghi chú: `UserDto.UserName`/`FullName` non-nullable nhưng chưa gắn `[Required]`
> (đang có warning CS8618). `RoleDto` hiện đóng 2 vai (input+output).

---

## 3. Repositories & UnitOfWork

- `IUserReposiory` *(giữ nguyên typo)* : `GenericRepository<User>` + `GetUserWithRolesAsync(userName)`.
- `IRoleRepository`, `ILoginUserIPRepository`, `IPermissionRepository` : generic (repo con rỗng, chỉ kế thừa).
- `IIdentityUnitOfWork : IUnitOfWork` → phơi bày `Users`, `Roles`, `LoginUserIPs`, `Permissions`.
- Cài đặt: `UserRepository`/`RoleRepository`/`LoginUserIPRepository`/`PermissionRepository` +
  `IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>`.

---

## 4. Services

| Service | Method | Ghi chú |
|---|---|---|
| `IUserService` / `UserService` | `SyncWindowsUserAsync`, `GetAllUsersAsync`, `UpdateUserRolesAsync` | Sync user AD, gán role, cập nhật role. |
| `IRoleService` / `RoleService` | `GetAllRolesAsync`, `GetRoleByIdAsync`, `CreateRoleAsync`, `UpdateRoleByIdAsync`, `DeleteRoleByIdAsync` | CRUD role, xoá = soft delete. `CreateRole` ném `DomainException` nếu trùng tên. |
| `ITokenService` / `TokenService` | `GenerateJwtToken(ClaimsPrincipal)` | Sinh JWT HS256 từ claims (loại bỏ claim `RolesLoaded`), hạn theo `JwtSettings:ExpiryMinutes`. |
| `IPermissionService` / `PermissionService` | `GetAllPermissionsAsync`, `GetRolePermissionsAsync(roleId)`, `UpdateRolePermissionsAsync(dto)` | Danh sách permission cố định (chỉ đọc); gán/đổi tập permission của 1 Role — pattern giống hệt `UserService.UpdateUserRolesAsync` (clear rồi add lại theo danh sách Id). |

---

## 5. Cơ chế xác thực (điểm đặc thù nhất của module)

Luồng: **Windows Negotiate → ClaimsTransformation (đồng bộ DB) → JWT**.

1. **Cấu hình** (`CompanySystem.HostApi/Configurations/Authentication.cs`):
   `AddAuthentication` mặc định `JwtBearer` + `.AddNegotiate()` +
   `.AddJwtBearer(...)` (validate Issuer/Audience/Lifetime/SigningKey từ `JwtSettings`).
2. **`MyClaimsTransformation : IClaimsTransformation`** (`Indentity.Infrastructure/Authentication/`)
   chạy mỗi request đã xác thực Windows (**và mỗi request JWT** — xem lưu ý bên dưới):
   - Nếu chưa có claim `RolesLoaded`: tra `Users` (kèm `.Include(Roles).ThenInclude(Permissions)`)
     theo `UserName` (Windows name).
   - User chưa tồn tại → tạo mới, gán role `"Basic"`, resolve `FullName` từ AD
     (`UserPrincipal.FindByIdentity`, chỉ chạy trên Windows).
   - Ghi/cập nhật `LoginUserIP` (IP client, `LastLoginAt`), `DeviceName` (reverse DNS).
   - Bơm claims: `ClaimTypes.Role` (mỗi role), `Permission` (mỗi mã permission suy ra
     từ `user.Roles.SelectMany(r => r.Permissions)`, xem §9), `FullName`, `IpAddress`,
     `DeviceName`, `RolesLoaded=true`.
3. **`AuthController.WindowsLogin`** (`[Authorize(AuthenticationSchemes="Negotiate")]`)
   đọc claims, gọi `TokenService.GenerateJwtToken(User)` trả `LoginResponseDto`
   (`UserDto.Permissions` lấy từ claim `Permission`). Từ đó client dùng
   `Authorization: Bearer <token>` cho các request sau.

> ⚠️ **`RolesLoaded` bị loại khỏi JWT** (`TokenService` filter claim này khi sinh
> token) → mỗi request dùng Bearer token, `MyClaimsTransformation` chạy lại từ đầu
> (tra DB theo `Name` claim có trong JWT), nghĩa là **Role/Permission luôn được
> refresh theo DB hiện tại mỗi request**, không cần đăng nhập lại sau khi Admin đổi
> quyền của Role. Đánh đổi: có thêm 1 query DB mỗi request (chấp nhận được, đã có
> sẵn từ trước cho Role, Permission chỉ tận dụng lại đúng cơ chế này).

> ⚠️ Phần AD (`System.DirectoryServices.AccountManagement`) chỉ hoạt động khi host
> chạy trên Windows domain-joined (có warning CA1416 khi build). `TransformAsync`
> có thể ghi DB (tạo user/IP) → windows-login **không** hoàn toàn read-only.

---

## 6. API Endpoints

### `Identity.Api/Controllers/AuthController.cs` — route gốc `/api/Auth`

Controller kế thừa `BaseController` (Identity), trả `ApiResponse<T>`.

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate | Đăng nhập Windows → JWT + profile (kèm `Permissions`). |
| GET | `/api/Auth/get-all-users-with-roles` | `RequirePermission("Identity.User.View")` | Danh sách user + role. |
| POST | `/api/Auth/update-user-roles` | `RequirePermission("Identity.User.UpdateRoles")` | Cập nhật role cho user (`UpdateUserRolesDto`). |
| GET | `/api/Auth/get-all-roles` | `RequirePermission("Identity.Role.View")` | Danh sách role (chưa xoá). |
| POST | `/api/Auth/create-role` | `RequirePermission("Identity.Role.Create")` | Tạo role (`RoleDto`). |
| PUT | `/api/Auth/update-role/{roleId}` | `RequirePermission("Identity.Role.Update")` | Sửa role (`UpdateRoleDto`). |
| DELETE | `/api/Auth/delete-role/{roleId}` | `RequirePermission("Identity.Role.Delete")` | Xoá mềm role. |

Seed role trong DB: `Basic`, `Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiêt bị` (và có thể thay đổi).

### `Identity.Api/Controllers/PermissionController.cs` — route gốc `/api/Permission` (mới, 2026-07-10)

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/Permission/all` | `RequirePermission("Identity.Permission.View")` | Toàn bộ permission hệ thống (order theo Module, Code) — FE dùng để dựng UI gán quyền. |
| GET | `/api/Permission/role/{roleId}` | `RequirePermission("Identity.Permission.View")` | Permission hiện tại của 1 role. |
| PUT | `/api/Permission/role/{roleId}` | `RequirePermission("Identity.Role.Update")` | Gán lại toàn bộ tập permission cho role (body: `List<int>` permission id). |

**Không có** API tạo/sửa/xoá `Permission` — danh sách cố định, chỉ seed qua migration
(xem §9). Chỉ có CRUD `RolePermission` qua 2 endpoint GET/PUT ở trên.

---

## 7. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:**
- Xác thực Windows → JWT, tự đồng bộ user + lịch sử IP/thiết bị.
- CRUD Role (soft delete), gán role cho user, liệt kê user.
- **Phân quyền chi tiết theo permission (RBAC + Permission, 2026-07-10)** — xem §9:
  entity `Permission` + N-N `RolePermission`, enforce qua `[RequirePermission]` trên
  toàn bộ action Identity **và** 12 controller Asset (trước đó `[AllowAnonymous]`).

**Cần làm tiếp / điểm nợ kỹ thuật:**
- `AuthController` dùng `try/catch` + `Fail<>()` thủ công thay vì để middleware
  xử lý (khác chuẩn ở [architecture-core.md](architecture-core.md) §6). Cân nhắc refactor về ném exception.
- `RoleService.GetRoleByIdAsync` **không kiểm null** trước khi map → NRE nếu id sai
  (nên dùng `.OrThrowNotFound("Role", roleId)`).
- Chưa có endpoint quản lý User độc lập (chỉ thao tác qua Auth). Chưa có xoá/sửa User.
- `UserDto` thiếu `[Required]`; `RoleDto` nên tách input/output.
- Endpoint Identity **không** `[AllowAnonymous]` — siết bằng `[RequirePermission]`.
- Role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` **chưa được gán permission
  nào** sau migration (chỉ `Admin` được seed full quyền) — Admin cần tự cấu hình
  qua `PUT /api/Permission/role/{roleId}` theo nhu cầu thực tế từng role.

---

## 8. Checklist khi thêm nghiệp vụ vào Identity

1. Đọc [architecture-core.md](architecture-core.md) + file này.
2. Entity mới → thêm `partial class` vào `Identity.Domain/Entities/`, khai báo
   `DbSet` + Fluent config trong `IdentityDbContext`.
3. Thêm `I<Entity>Repository : IGenericRepository<Entity>` + cài đặt; thêm property
   vào `IIdentityUnitOfWork` **và** `IdentityUnitOfWork` (constructor + property).
4. Service `: BaseService<IIdentityUnitOfWork>, I<Feature>Service` — Scrutor tự DI.
5. Controller `: BaseController`, bọc `Success/Fail`, gắn
   `[RequirePermission("Identity.<Entity>.<Action>")]` (namespace
   `Shared.Application.Authorization`, xem §9) — không dùng lại `[Authorize(Roles=...)]`.
6. Nếu thêm action/entity mới cần permission mới → thêm mã vào migration seed
   (§9) và cân nhắc gán cho `Admin`.
7. Tạo migration: `dotnet ef migrations add <Name> --project Indentity.Infrastructure --startup-project CompanySystem.HostApi --context IdentityDbContext`
   (bắt buộc `--context` vì `IdentityDbContext` không phải DbContext duy nhất trong project).
8. Cập nhật lại file doc này.

---

## 9. Phân quyền chi tiết (RBAC + Permission) — 2026-07-10

Nâng cấp từ chỗ chỉ có Role thô (`[Authorize(Roles="Admin")]`) sang **permission chi
tiết theo từng chức năng**: mỗi action controller ứng với 1 mã permission dạng
`Module.Entity.Action`, Role sở hữu 1 tập Permission (N-N `RolePermissions`), User
vẫn chỉ có Role như trước (không gán permission thẳng cho User).

**Cơ chế enforce — Custom Policy (không phải role check):**
- `Shared.Application/Authorization/` (dùng chung cho mọi module, cần
  `FrameworkReference Microsoft.AspNetCore.App` trong `Shared.Application.csproj`):
  - `PermissionRequirement(string Permission) : IAuthorizationRequirement`.
  - `PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>` —
    check `context.User.HasClaim("Permission", requirement.Permission)`.
  - `PermissionPolicyProvider : IAuthorizationPolicyProvider` — bọc
    `DefaultAuthorizationPolicyProvider`; policy tên có prefix `"Permission:"` thì build
    động `PermissionRequirement`, còn lại delegate cho provider mặc định (Default/Fallback).
  - `RequirePermissionAttribute : AuthorizeAttribute` — `[RequirePermission("Asset.Device.Create")]`
    thay vì phải nhớ chuỗi policy thô `"Permission:Asset.Device.Create"`.
- Đăng ký ở `CompanySystem.HostApi/Program.cs` (cạnh `AddAuthorization`):
  `AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>()` +
  `AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>()`.
- Claim `Permission` được nạp trong `MyClaimsTransformation` (xem §5) — **tự refresh
  mỗi request** nhờ JWT không mang claim `RolesLoaded`, nên Admin đổi quyền của 1
  Role có hiệu lực ngay ở request tiếp theo, không cần user đăng nhập lại.

**Danh sách permission đã seed (51 mã, migration `AddPermissionAndRolePermission`,
`Indentity.Infrastructure/Migrations/20260710025421_AddPermissionAndRolePermission.cs`):**

| Module.Entity | Action seed |
|---|---|
| `Asset.Branch` | View, Create, Update, Delete |
| `Asset.Device` | View, Create, Update, Delete |
| `Asset.DeviceType` | View, Create, Update, Delete |
| `Asset.Supplier` | View, Create, Update, Delete |
| `Asset.Software` | View, Create, Update, Delete |
| `Asset.SoftwareGroup` | View, Create, Update, Delete |
| `Asset.IpPrefix` | View, Create, Update, Delete |
| `Asset.IpAddress` | View, Create, Update, Delete, **Assign** (dùng chung cho cả `{id}/assign` và `{id}/unassign`) |
| `Asset.DeviceConfiguration` | View, Create, Update, Delete (sub-resource `initial`/`history` dùng lại View/Delete, không tách mã riêng) |
| `Asset.DeviceSoftware` | View, Create, Update, Delete (`picker`→View, `sync`→Update) |
| `Asset.Report` | View |
| `Asset.TransferHistory` | View, Create |
| `Identity.User` | View, UpdateRoles |
| `Identity.Role` | View, Create, Update, Delete |
| `Identity.Permission` | View |

**Seed data & rủi ro khi deploy:** migration này **INSERT** toàn bộ 51 dòng
`Permissions` **và** gán full quyền cho role `Admin` hiện có (tra theo tên qua
`WHERE RoleName = N'Admin'`, không hardcode Id) bằng `migrationBuilder.Sql(...)` —
bắt buộc làm vậy để tránh Admin mất quyền truy cập ngay sau khi chuyển từ role-check
sang permission-check. Các role khác (`Basic`, `Quản lý Hợp Đồng`, `Quản lý Thiết
bị`) **không** được gán mặc định, cần Admin tự cấu hình qua
`PUT /api/Permission/role/{roleId}`.

**Áp dụng vào controller:** toàn bộ 12 controller `Asset.Api` đã bỏ
`[AllowAnonymous]` cấp class, chuyển sang `[RequirePermission]` từng action — xem
[asset-module.md](asset-module.md) §4 để biết mã cụ thể theo từng entity.
