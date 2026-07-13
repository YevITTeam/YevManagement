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
| `User` | `Id`, `UserName`(≤100), `FullName?`, `CreatedAt`, `DeviceName?`(≤100) | N-N `Roles`, 1-N `LoginUserIPs`, 1-N `UserPermissions` | Không |
| `Role` | `Id`, `RoleName`(≤50), `Description?`, `IsDeleted` | N-N `Users`, N-N `Permissions` | **Có** (`IsDeleted`) |
| `LoginUserIP` | `Id`, `UserId`, `IPAddress`, `FirstLoginAt`, `LastLoginAt` | N-1 `User` | Không |
| `Permission` | `Id`, `Code`(≤150, unique, dạng `Module.Entity.Action`), `Module`(≤50), `Description?`(≤255) | N-N `Roles`, 1-N `UserPermissions` | Không (danh sách cố định, seed qua migration — xem §9) |
| `UserPermission` | `UserId`, `PermissionId` (khoá kép), `IsGranted` (bool) | N-1 `User`, N-1 `Permission` | Không — override permission riêng theo từng User, xem §9.1 |

**Cấu hình quan hệ (Fluent, `IdentityDbContext.OnModelCreating`):**
- `User` ↔ `Role`: **many-to-many** qua bảng nối `UserRoles` (khoá kép
  `UserId, RoleId`), khai báo bằng `UsingEntity<Dictionary<string,object>>`.
- `Role` ↔ `Permission`: **many-to-many** qua bảng nối `RolePermissions` (khoá kép
  `RoleId, PermissionId`) — cùng pattern `UsingEntity<Dictionary<string,object>>`
  như `UserRoles`, không có repository riêng cho bảng nối.
- `User` ↔ `Permission` (qua `UserPermission`): **KHÔNG** dùng shorthand
  `UsingEntity<Dictionary<...>>` như 2 quan hệ trên, vì cần thêm cột dữ liệu
  `IsGranted` trên chính bảng nối — khai báo `UserPermission` là **entity tường
  minh** (`modelBuilder.Entity<UserPermission>()`, khoá kép qua `HasKey(e => new
  { e.UserId, e.PermissionId })`, 2 `HasOne().WithMany()` riêng). Có repository
  `IUserPermissionRepository` riêng (khác 2 bảng nối kia).
- `User`/`Role`/`Permission`/`UserPermission` là `partial class`; `IdentityDbContext` là `partial`.
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
| `PermissionModuleGroupDto` / `PermissionEntityGroupDto` | `PermissionModuleGroupDto`: `Module`, `Entities: List<PermissionEntityGroupDto>`. `PermissionEntityGroupDto`: `Entity`, `Permissions: List<PermissionDto>` — nhóm 2 cấp Module > Entity (Entity tách từ đoạn giữa của `Code` dạng `Module.Entity.Action`), riêng cho response `GET /api/Permission/all` để FE dựng UI gán quyền dạng cây/collapsible thay vì 1 danh sách phẳng ~53 dòng. |
| `UpdateRolePermissionsDto` | `RoleId`, `PermissionIds: List<int>` — gán lại toàn bộ tập permission cho 1 role. |
| `UserPermissionDto` | `PermissionId`, `Code`, `Module`, `Description?`, `IsGranted` — 1 dòng override hiện có của 1 User. |
| `UpdateUserPermissionsDto` | `UserId`, `GrantPermissionIds: List<int>`, `DenyPermissionIds: List<int>` — dùng nội bộ Service. |
| `UpdateUserPermissionOverridesDto` | `GrantPermissionIds: List<int>`, `DenyPermissionIds: List<int>` — body request `PUT /api/Permission/user/{userId}` (không lặp lại `UserId` vì đã có trên route). |

> Ghi chú: `UserDto.UserName`/`FullName` non-nullable nhưng chưa gắn `[Required]`
> (đang có warning CS8618). `RoleDto` hiện đóng 2 vai (input+output).

---

## 3. Repositories & UnitOfWork

- `IUserReposiory` *(giữ nguyên typo)* : `GenericRepository<User>` + `GetUserWithRolesAsync(userName)`.
- `IRoleRepository`, `ILoginUserIPRepository`, `IPermissionRepository`, `IUserPermissionRepository` : generic (repo con rỗng, chỉ kế thừa).
- `IIdentityUnitOfWork : IUnitOfWork` → phơi bày `Users`, `Roles`, `LoginUserIPs`, `Permissions`, `UserPermissions`.
- Cài đặt: `UserRepository`/`RoleRepository`/`LoginUserIPRepository`/`PermissionRepository`/`UserPermissionRepository` +
  `IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>`.

---

## 4. Services

| Service | Method | Ghi chú |
|---|---|---|
| `IUserService` / `UserService` | `SyncWindowsUserAsync`, `GetAllUsersAsync`, `UpdateUserRolesAsync`, `CreateUserAsync`, `DeleteUserAsync` | Sync user AD, gán role, cập nhật role. `CreateUserAsync` — Admin **pre-provision** thủ công 1 User (`UserName`+chọn `RoleIds`, `DeviceName?` chỉ để tham khảo) trước khi người đó từng đăng nhập Windows — xem §5.1. `DeleteUserAsync` — xóa **cứng** (entity `User` không có `IsDeleted`); `UserRoles`/`LoginUserIPs`/`UserPermissions` cascade tự động ở DB (không cần dọn tay). Nếu `UserName` đó đăng nhập Windows lại sau khi xóa, `MyClaimsTransformation` tạo lại User mới với role mặc định `"Basic"` (mất role/permission override cũ). |
| `IRoleService` / `RoleService` | `GetAllRolesAsync`, `GetRoleByIdAsync`, `CreateRoleAsync`, `UpdateRoleByIdAsync`, `DeleteRoleByIdAsync` | CRUD role, xoá = soft delete. `CreateRole` ném `DomainException` nếu trùng tên. |
| `ITokenService` / `TokenService` | `GenerateJwtToken(ClaimsPrincipal)` | Sinh JWT HS256 từ claims (loại bỏ claim `RolesLoaded`), hạn theo `JwtSettings:ExpiryMinutes`. |
| `IPermissionService` / `PermissionService` | `GetAllPermissionsAsync`, `GetRolePermissionsAsync(roleId)`, `UpdateRolePermissionsAsync(dto)`, `GetUserPermissionOverridesAsync(userId)`, `GetEffectivePermissionsForUserAsync(userId)`, `UpdateUserPermissionOverridesAsync(dto)` | Danh sách permission cố định (chỉ đọc); gán/đổi tập permission của 1 Role (clear rồi add lại theo danh sách Id, giống `UserService.UpdateUserRolesAsync`); 3 method cuối quản lý override permission riêng theo User — xem §9.1. |

---

## 5. Cơ chế xác thực (điểm đặc thù nhất của module)

Luồng: **Windows Negotiate → ClaimsTransformation (đồng bộ DB) → JWT**.

1. **Cấu hình** (`CompanySystem.HostApi/Configurations/Authentication.cs`):
   `AddAuthentication` mặc định `JwtBearer` + `.AddNegotiate()` +
   `.AddJwtBearer(...)` (validate Issuer/Audience/Lifetime/SigningKey từ `JwtSettings`).
2. **`MyClaimsTransformation : IClaimsTransformation`** (`Indentity.Infrastructure/Authentication/`)
   chạy mỗi request đã xác thực Windows **và mỗi request JWT** (lý do xem điểm
   "RolesLoaded bị loại khỏi JWT" bên dưới):
   - Resolve `deviceName` (reverse DNS qua IP client) — chỉ dùng để **hiển
     thị/log**, **KHÔNG** dùng để khớp `User`. ⚠️ **Gotcha:** reverse-DNS PTR
     lookup trên IP client không ổn định trong môi trường thật (NAT, nhiều PTR
     record...) — cùng 1 người dùng có thể bị resolve ra 2 hostname khác nhau
     chỉ trong vài giây. Vì vậy khớp `User` **chỉ** dựa vào `UserName` suông,
     không bao giờ dùng `DeviceName` làm khoá khớp (từng dùng cặp
     `(UserName, DeviceName)` làm khoá và gây tạo `User` trùng liên tục — đã bỏ
     hẳn cách đó). **Data debt còn tồn đọng**: các dòng `User` trùng `UserName`
     bị tạo rác bởi bug này trước đây chưa được dọn tự động — cần rà tay qua
     `GET /api/User` để gộp/xoá nếu cần.
   - Nếu chưa có claim `RolesLoaded`: tra `Users` (kèm `.Include(Roles).ThenInclude(Permissions)`
     + `.Include(UserPermissions).ThenInclude(Permission)`) theo **`UserName` suông**.
   - **`UserName` chưa tồn tại** → tạo User **MỚI**, gán role `"Basic"`, resolve
     `FullName` từ AD (`UserPrincipal.FindByIdentity`, chỉ chạy trên Windows).
   - **`UserName` đã tồn tại** → dùng lại đúng dòng đó (không tạo thêm), chỉ
     refresh `DeviceName` hiển thị nếu resolve ra giá trị khác giá trị cũ (bỏ qua
     nếu resolve thất bại/`null`, tránh xoá mất `DeviceName` Admin đã nhập tay).
   - Ghi/cập nhật `LoginUserIP` (IP client, `LastLoginAt`).
   - Bơm claims: `ClaimTypes.Role` (mỗi role), `Permission` (mỗi mã permission **hiệu
     lực** — base từ `user.Roles.SelectMany(r => r.Permissions)`, cộng
     `UserPermission.IsGranted=true`, trừ `UserPermission.IsGranted=false`; xem công
     thức đầy đủ ở §9.1), `FullName`, `IpAddress`, `DeviceName`, `RolesLoaded=true`.
3. **`AuthController.WindowsLogin`** (`[Authorize(AuthenticationSchemes="Negotiate")]`)
   đọc claims, gọi `TokenService.GenerateJwtToken(User)` trả `LoginResponseDto`
   (`UserDto.Permissions` lấy từ claim `Permission`). Từ đó client dùng
   `Authorization: Bearer <token>` cho các request sau. Contract request/response
   đầy đủ xem [identity-api-fe.md §2](identity-api-fe.md).

### 5.1. Tạo User thủ công (pre-provision)

**Mục đích**: cho Admin tạo trước 1 `User` (`UserName` + chọn `RoleIds`) cho
người **CHƯA từng đăng nhập Windows lần nào** — ví dụ nhân viên mới sắp nhận
máy. Khi người đó đăng nhập Windows lần đầu, `MyClaimsTransformation` tra ra
đúng dòng `User` này theo `UserName` và dùng luôn `Role` đã gán, **không** rơi
vào mặc định `"Basic"`.

- `POST /api/Auth/create-user` (`[RequirePermission("Identity.User.Create")]`,
  permission seed qua migration `AddIdentityUserCreatePermission`, đã gán full
  quyền cho `Admin`) — body `CreateUserDto`: `UserName` `[Required]`,
  `DeviceName?` (**không bắt buộc**, chỉ để tham khảo/hiển thị — không dùng để
  khớp login), `FullName?` (optional), `RoleIds: List<int>` (optional, có thể
  để trống — nếu để trống, User này khi đăng nhập vẫn nhận claim Role mặc định
  `"Basic"` giống case không có Role nào, nhưng là claim-only, KHÔNG tự thêm
  Role "Basic" vào DB).
- `UserService.CreateUserAsync`: chặn trùng nếu đã có `User` với đúng `UserName`
  (`DomainException`); validate mọi `RoleIds` phải tồn tại và chưa xoá mềm
  (`DomainException` nếu có Id không hợp lệ).
- **Bất biến: 1 `UserName` chỉ ứng với đúng 1 dòng `User`** — đăng nhập từ máy
  nào cũng khớp về đúng dòng `User` này, dùng chung 1 bộ Role.

> ⚠️ **`RolesLoaded` bị loại khỏi JWT** (`TokenService` filter claim này khi sinh
> token) → mỗi request dùng Bearer token, `MyClaimsTransformation` chạy lại từ đầu
> (tra DB theo `Name` claim có trong JWT), nghĩa là **Role/Permission luôn được
> refresh theo DB hiện tại mỗi request**, không cần đăng nhập lại sau khi Admin đổi
> quyền của Role. Đánh đổi: có thêm 1 query DB mỗi request (chấp nhận được, đã có
> sẵn từ trước cho Role, Permission chỉ tận dụng lại đúng cơ chế này).

> ⚠️ Phần AD (`System.DirectoryServices.AccountManagement`) chỉ hoạt động khi host
> chạy trên Windows domain-joined (có warning CA1416 khi build). `TransformAsync`
> có thể ghi DB (tạo user/IP) → windows-login **không** hoàn toàn read-only.

### 5.2. Xóa User

`DELETE /api/Auth/delete-user/{userId}` (`RequirePermission("Identity.User.Delete")`,
permission seed qua migration `AddUserDeleteAndAssetSettingPermissions`, đã
gán full quyền cho `Admin`) gọi `UserService.DeleteUserAsync` — xóa **cứng**
(entity `User` không có `IsDeleted`, khác `Role` là soft-delete). Cascade ở
tầng DB tự dọn sạch `UserRoles` (bảng nối N-N), `LoginUserIPs`, `UserPermissions`
liên quan — không cần Service tự xóa tay từng bảng con.

**Đánh đổi đã chấp nhận**: nếu `UserName` vừa xóa đăng nhập Windows lại,
`MyClaimsTransformation` (xem §5) không tìm thấy `User` theo `UserName` nữa →
tạo **mới** với role mặc định `"Basic"`, mất toàn bộ role/permission override
đã gán trước đó (phải cấu hình lại). Đây là hành vi có chủ đích của "xóa cứng"
(khác với ý tưởng thêm `IsDeleted` — đã cân nhắc nhưng không chọn để tránh
phải sửa thêm `MyClaimsTransformation`/`GetAllUsersAsync` lọc `IsDeleted`).

---

## 6. API Endpoints

### `Identity.Api/Controllers/AuthController.cs` — route gốc `/api/Auth`

Controller kế thừa `BaseController` (Identity), trả `ApiResponse<T>`.

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate | Đăng nhập Windows → JWT + profile (kèm `Permissions`). |
| POST | `/api/Auth/create-user` | `RequirePermission("Identity.User.Create")` | Pre-provision thủ công 1 User (`UserName`+`RoleIds`, `DeviceName?` tham khảo) — xem §5.1. |
| GET | `/api/Auth/get-all-users-with-roles` | `RequirePermission("Identity.User.View")` | Danh sách user + role. |
| POST | `/api/Auth/update-user-roles` | `RequirePermission("Identity.User.UpdateRoles")` | Cập nhật role cho user (`UpdateUserRolesDto`). |
| DELETE | `/api/Auth/delete-user/{userId}` | `RequirePermission("Identity.User.Delete")` | Xóa **cứng** User (không phải soft-delete) — xem §5.2. |
| GET | `/api/Auth/get-all-roles` | `RequirePermission("Identity.Role.View")` | Danh sách role (chưa xoá). |
| POST | `/api/Auth/create-role` | `RequirePermission("Identity.Role.Create")` | Tạo role (`RoleDto`). |
| PUT | `/api/Auth/update-role/{roleId}` | `RequirePermission("Identity.Role.Update")` | Sửa role (`UpdateRoleDto`). |
| DELETE | `/api/Auth/delete-role/{roleId}` | `RequirePermission("Identity.Role.Delete")` | Xoá mềm role. |

Seed role trong DB: `Basic`, `Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiêt bị` (và có thể thay đổi).

### `Identity.Api/Controllers/PermissionController.cs` — route gốc `/api/Permission`

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/Permission/all` | `RequirePermission("Identity.Permission.View")` | Toàn bộ permission hệ thống, **nhóm 2 cấp Module > Entity** (`List<PermissionModuleGroupDto>`) — FE dùng để dựng UI gán quyền dạng cây. Các endpoint permission khác (`role/{roleId}`, `user/{userId}`, `user/{userId}/effective`) vẫn trả `List<PermissionDto>` phẳng như cũ. |
| GET | `/api/Permission/role/{roleId}` | `RequirePermission("Identity.Permission.View")` | Permission hiện tại của 1 role. |
| PUT | `/api/Permission/role/{roleId}` | `RequirePermission("Identity.Role.Update")` | Gán lại toàn bộ tập permission cho role (body: `List<int>` permission id). |
| GET | `/api/Permission/user/{userId}` | `RequirePermission("Identity.Permission.View")` | Danh sách override (grant/deny) hiện có của 1 User. |
| GET | `/api/Permission/user/{userId}/effective` | `RequirePermission("Identity.Permission.View")` | Permission **hiệu lực** cuối cùng của 1 User (base theo Role, đã áp override) — dùng để preview "user này thực sự làm được gì". |
| PUT | `/api/Permission/user/{userId}` | `RequirePermission("Identity.User.UpdatePermissions")` | Gán lại override cho User (body `UpdateUserPermissionOverridesDto`: `GrantPermissionIds`, `DenyPermissionIds`). |

**Không có** API tạo/sửa/xoá `Permission` — danh sách cố định, chỉ seed qua migration
(xem §9). Chỉ có CRUD `RolePermission` và `UserPermission` (override) qua các endpoint ở trên.

---

## 7. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:**
- Xác thực Windows → JWT, tự đồng bộ user + lịch sử IP/thiết bị.
- CRUD Role (soft delete), gán role cho user, liệt kê user.
- **Phân quyền chi tiết theo permission (RBAC + Permission)** — xem §9:
  entity `Permission` + N-N `RolePermission`, enforce qua `[RequirePermission]` trên
  toàn bộ action Identity **và** 12 controller Asset (trước đó `[AllowAnonymous]`).
- **Override permission riêng theo User** — xem §9.1: entity
  `UserPermission` (grant/deny), cho phép cấp thêm hoặc thu hồi riêng 1 permission
  cho 1 User cụ thể mà không cần tạo Role mới cho từng trường hợp ngoại lệ.

**Cần làm tiếp / điểm nợ kỹ thuật:**
- `AuthController` dùng `try/catch` + `Fail<>()` thủ công thay vì để middleware
  xử lý (khác chuẩn ở [architecture-core.md](architecture-core.md) §6). Cân nhắc refactor về ném exception.
- `RoleService.GetRoleByIdAsync` **không kiểm null** trước khi map → NRE nếu id sai
  (nên dùng `.OrThrowNotFound("Role", roleId)`).
- Có endpoint tạo (`create-user`, §5.1) và xóa cứng (`delete-user`, §5.2) User
  thủ công nhưng vẫn qua `AuthController` (chưa tách `UserController` riêng).
  Vẫn chưa có **sửa** User (kể cả sửa `DeviceName` sau khi tạo — muốn đổi phải
  xoá thẳng trong DB, chưa có API).
- `UserDto` thiếu `[Required]`; `RoleDto` nên tách input/output.
- Endpoint Identity **không** `[AllowAnonymous]` — siết bằng `[RequirePermission]`.
- Role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` chưa có permission nào sau
  migration — xem §9 (chỉ `Admin` được seed full quyền).

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

## 9. Phân quyền chi tiết (RBAC + Permission)

Nâng cấp từ chỗ chỉ có Role thô (`[Authorize(Roles="Admin")]`) sang **permission chi
tiết theo từng chức năng**: mỗi action controller ứng với 1 mã permission dạng
`Module.Entity.Action`, Role sở hữu 1 tập Permission (N-N `RolePermissions`), User
vẫn chỉ có Role như trước (không gán permission thẳng cho User — override riêng lẻ
xem §9.1).

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
- Claim `Permission` được nạp trong `MyClaimsTransformation` (xem §5) và **tự
  refresh mỗi request** — cơ chế `RolesLoaded` bị loại khỏi JWT khiến việc này
  xảy ra tự động, chi tiết xem ⚠️ ở §5.1.

**Danh sách permission đã seed (64 mã: 51 mã gốc trong migration
`AddPermissionAndRolePermission` + `Identity.User.UpdatePermissions` thêm ở
migration `AddUserPermissionOverride` (§9.1) + `Identity.User.Create` thêm ở
migration `AddIdentityUserCreatePermission` (§5.1) + 8 mã `Asset.DeviceGroup`/
`Asset.DeviceDepartment` thêm ở migration `AddDeviceGroupDepartmentPermissions`,
xem [asset-module.md](asset-module.md) §1.14 + `Identity.User.Delete` (§5.2) và
`Asset.Setting.View`/`Asset.Setting.Update` (xem [asset-module.md](asset-module.md)
§1.16) thêm ở migration `AddUserDeleteAndAssetSettingPermissions`):**

| Module.Entity | Action seed |
|---|---|
| `Asset.Branch` | View, Create, Update, Delete |
| `Asset.DeviceGroup` | View, Create, Update, Delete |
| `Asset.DeviceDepartment` | View, Create, Update, Delete |
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
| `Asset.Setting` | View, Update (thêm ở migration `AddUserDeleteAndAssetSettingPermissions`, xem §1.16 asset-module.md) |
| `Identity.User` | View, UpdateRoles, UpdatePermissions, Create (§5.1), **Delete** (thêm ở migration `AddUserDeleteAndAssetSettingPermissions`, xem §5.2) |
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

### 9.1. Override permission riêng theo User

**Lý do:** RBAC thuần (chỉ Role) dễ sinh "role rác" khi mỗi nhân viên có nhu cầu
quyền hơi khác nhau — mỗi tổ hợp khác lại phải tạo 1 Role mới. Giải pháp: giữ
Role làm nền (đa số user dùng chung Role theo phòng ban/vị trí), thêm khả năng
**override riêng lẻ theo User** cho phần thiểu số cần ngoại lệ, tránh phải tạo
Role mới cho từng trường hợp cá biệt.

**Entity `UserPermission`** (`UserId`, `PermissionId`, `IsGranted: bool`):
- `IsGranted = true` → **cấp thêm** permission này riêng cho User, dù không Role
  nào của User đó cấp.
- `IsGranted = false` → **thu hồi (deny)** permission này riêng khỏi User, dù có
  Role đang cấp permission đó.

**Công thức tính permission hiệu lực** (dùng trong `MyClaimsTransformation` khi
build claim `Permission`, và trong `PermissionService.GetEffectivePermissionsForUserAsync`
khi trả về cho FE preview):

```
basePermissions = ∪ (Permissions của mọi Role mà User đang có)
grants          = { p.PermissionId | UserPermission có IsGranted = true }
denies          = { p.PermissionId | UserPermission có IsGranted = false }

effectivePermissions = (basePermissions ∪ grants) \ denies
```

**Deny luôn thắng** — nếu 1 permission vừa nằm trong `basePermissions`/`grants`
vừa nằm trong `denies`, kết quả cuối cùng là **không có** permission đó. Ràng
buộc: `UpdateUserPermissionOverridesAsync` từ chối (ném `DomainException`) nếu
cùng 1 `PermissionId` xuất hiện ở cả `GrantPermissionIds` **và**
`DenyPermissionIds` trong 1 request (vô nghĩa, không rõ ý định).

**Cập nhật override** (`PermissionService.UpdateUserPermissionOverridesAsync`):
xoá sạch toàn bộ dòng `UserPermission` cũ của User đó, rồi insert lại theo đúng
`GrantPermissionIds`/`DenyPermissionIds` mới — **thay thế toàn bộ**, không phải
patch từng phần (giống pattern `UpdateRolePermissionsAsync`/`UpdateUserRolesAsync`).

**Ví dụ áp dụng** (đúng yêu cầu ban đầu — "Full quyền Chi nhánh nhưng không
được xem Thiết bị"): User đang thuộc Role "Quản lý PC" (có `Asset.Device.View`)
→ Admin gọi `PUT /api/Permission/user/{userId}` với `DenyPermissionIds:
[<id Asset.Device.View>]` → User đó mất quyền xem Device dù Role vẫn còn
nguyên, không ảnh hưởng user khác cùng Role.

**Chưa làm:** chưa có UI Admin (FE) cho màn "gán override theo User" — mới có
API. `Identity.User.UpdatePermissions` (permission guard cho `PUT
.../user/{userId}`) đã seed sẵn full quyền cho `Admin` qua migration
`AddUserPermissionOverride` (`Indentity.Infrastructure/Migrations/20260710045905_AddUserPermissionOverride.cs`).
