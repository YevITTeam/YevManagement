# identity-module.md — Module Identity

> **ĐÃ CÓ CODE, production.** User/Role + xác thực Windows Negotiate (AD) → JWT. Đọc [architecture-core.md](architecture-core.md) trước. Doc FE: [identity-api-fe.md](identity-api-fe.md).

- **DB**: `YevIdentityManagement` (conn `IdentityManagementConnection`). **DbContext**: `IdentityDbContext`.
- ⚠️ Thư mục Infrastructure là `Indentity.Infrastructure/` (typo "Inden") nhưng **assembly = `Identity.Infrastructure`**. Typo khác giữ nguyên: `IUserReposiory`.

## 1. Domain Models
| Entity | Thuộc tính chính | Quan hệ | Soft-del |
|---|---|---|---|
| `User` | `Id`, `UserName`(≤100), `FullName?`, `CreatedAt`, `DeviceName?` | N-N Roles, 1-N LoginUserIPs, 1-N UserPermissions | Không |
| `Role` | `Id`, `RoleName`(≤50), `Description?`, `IsDeleted` | N-N Users, N-N Permissions | **Có** |
| `LoginUserIP` | `Id`, `UserId`, `IPAddress`, `FirstLoginAt`, `LastLoginAt` | N-1 User | Không |
| `Permission` | `Id`, `Code`(≤150, unique, `Module.Entity.Action`), `Module`(≤50), `Description?` | N-N Roles, 1-N UserPermissions | Không (cố định, seed qua migration §9) |
| `UserPermission` | khoá kép `(UserId, PermissionId)`, `IsGranted:bool` | N-1 User, N-1 Permission | Không (override theo User §9.1) |

Fluent (`IdentityDbContext.OnModelCreating`):
- `User↔Role` (bảng nối `UserRoles`) và `Role↔Permission` (`RolePermissions`): many-to-many qua `UsingEntity<Dictionary<string,object>>`, không repo riêng.
- `User↔Permission` qua `UserPermission`: entity **tường minh** (`HasKey(e => new {e.UserId, e.PermissionId})`, 2 `HasOne().WithMany()`) vì có cột `IsGranted`. Có `IUserPermissionRepository` riêng.
- `LoginUserIP` map theo convention. Tất cả là `partial class`.

## 2. DTOs (`Identity.Application/Dtos/UserDto/`)
| DTO | Dùng cho |
|---|---|
| `UserDto` | `Id/UserName/FullName/DeviceName?/Roles:List<string>/Permissions:List<string>` (mã từ claim). |
| `LoginResponseDto` | `User:UserDto, Token:string`. |
| `RoleDto` | `Id/RoleName/Description?` (dùng cả input+output). `UpdateRoleDto`: `RoleName/Description?`. |
| `UpdateUserRolesDto` | `UserId, RoleIds:List<int>`. |
| `CreateUserDto` | `UserName[Required], DeviceName?, FullName?, RoleIds:List<int>?` (§5.1). |
| `PermissionDto` | `Id/Code/Module/Description?` (output-only). |
| `PermissionModuleGroupDto` / `PermissionEntityGroupDto` | Nhóm 2 cấp Module > Entity (Entity = đoạn giữa của Code) — cho `GET /api/Permission/all`. |
| `UpdateRolePermissionsDto` | `RoleId, PermissionIds:List<int>` (gán lại toàn bộ). |
| `UserPermissionDto` | `PermissionId/Code/Module/Description?/IsGranted`. |
| `UpdateUserPermissionOverridesDto` | `GrantPermissionIds/DenyPermissionIds:List<int>` — body `PUT /api/Permission/user/{userId}`. |

## 3. Repositories & UnitOfWork
`IUserReposiory` (+`GetUserWithRolesAsync(userName)`), `IRoleRepository`/`ILoginUserIPRepository`/`IPermissionRepository`/`IUserPermissionRepository` (generic rỗng). `IIdentityUnitOfWork` phơi bày `Users/Roles/LoginUserIPs/Permissions/UserPermissions`. Impl `IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>`.

## 4. Services
| Service | Method |
|---|---|
| `UserService` | `SyncWindowsUserAsync`, `GetAllUsersAsync`, `UpdateUserRolesAsync`, `CreateUserAsync` (§5.1), `DeleteUserAsync` (§5.2, **xóa cứng**) |
| `RoleService` | CRUD role (`Create` ném `DomainException` nếu trùng tên; xóa = soft-delete). ⚠️ `GetRoleByIdAsync` **không check null** → NRE nếu id sai (nên `.OrThrowNotFound`) |
| `TokenService` | `GenerateJwtToken(ClaimsPrincipal)` — JWT HS256, loại claim `RolesLoaded`, hạn `JwtSettings:ExpiryMinutes` |
| `PermissionService` | `GetAllPermissionsAsync`, `GetRolePermissionsAsync`, `UpdateRolePermissionsAsync` (clear+add lại), `GetUserPermissionOverridesAsync`, `GetEffectivePermissionsForUserAsync`, `UpdateUserPermissionOverridesAsync` (§9.1) |

## 5. Xác thực: Windows Negotiate → ClaimsTransformation → JWT
1. **Config** (`HostApi/Configurations/Authentication.cs`): `AddAuthentication` default JwtBearer + `.AddNegotiate()` + `.AddJwtBearer(...)` (validate Issuer/Audience/Lifetime/SigningKey từ `JwtSettings`).
2. **`MyClaimsTransformation : IClaimsTransformation`** (`Indentity.Infrastructure/Authentication/`) chạy mỗi request đã xác thực (Windows **và** JWer):
   - Resolve `deviceName` (reverse-DNS từ IP) **chỉ để hiển thị/log**, KHÔNG dùng khớp User. ⚠️ Reverse-DNS không ổn định (NAT/nhiều PTR) → **khớp User CHỈ theo `UserName` suông** (từng dùng cặp `(UserName,DeviceName)` gây tạo User trùng — đã bỏ; data debt trùng cũ cần rà tay).
   - Chưa có claim `RolesLoaded` → tra `Users` (`.Include(Roles).ThenInclude(Permissions)` + `.Include(UserPermissions).ThenInclude(Permission)`) theo `UserName`.
   - `UserName` chưa có → tạo User MỚI, role `"Basic"`, `FullName` từ AD (`UserPrincipal.FindByIdentity`, chỉ Windows). Đã có → dùng lại, chỉ refresh `DeviceName` nếu resolve ra giá trị khác (bỏ qua nếu null).
   - Ghi/update `LoginUserIP`. Bơm claims: `Role` (mỗi role), `Permission` (mỗi mã hiệu lực §9.1), `FullName`, `IpAddress`, `DeviceName`, `RolesLoaded=true`.
3. **`AuthController.WindowsLogin`** (`[Authorize(AuthenticationSchemes="Negotiate")]`): đọc claims → `TokenService.GenerateJwtToken` → `LoginResponseDto`. Client dùng `Authorization: Bearer <token>` cho request sau.

> ⚠️ **`RolesLoaded` bị loại khỏi JWT** → mỗi request Bearer chạy lại `MyClaimsTransformation` → **Role/Permission luôn refresh theo DB hiện tại mỗi request**, không cần login lại sau khi Admin đổi quyền. Đánh đổi: +1 query DB/request.
> ⚠️ AD (`System.DirectoryServices.AccountManagement`) chỉ chạy trên Windows domain-joined (warning CA1416). `TransformAsync` có ghi DB → windows-login **không** read-only.

### 5.1. Tạo User thủ công (pre-provision)
Admin tạo trước User cho người **chưa từng đăng nhập Windows**. Login lần đầu khớp theo `UserName` → dùng Role đã gán, không rơi `"Basic"`.
`POST /api/Auth/create-user` (`Identity.User.Create`, seed migration `AddIdentityUserCreatePermission`) — `CreateUserDto`. `CreateUserAsync` chặn trùng `UserName` + validate `RoleIds` tồn tại `!IsDeleted`. **Bất biến: 1 `UserName` = đúng 1 dòng User.**

### 5.2. Xóa User (xóa CỨNG)
`DELETE /api/Auth/delete-user/{userId}` (`Identity.User.Delete`, seed migration `AddUserDeleteAndAssetSettingPermissions`). `User` không có `IsDeleted` → xóa cứng, cascade DB tự dọn `UserRoles`/`LoginUserIPs`/`UserPermissions`. Đánh đổi: `UserName` login lại sau xóa → tạo mới với `"Basic"`, mất override cũ (có chủ đích). Chưa có API **sửa** User.

## 6. API Endpoints
### `AuthController` — `/api/Auth`
| Method | Route | Permission |
|---|---|---|
| POST | `windows-login` | Negotiate |
| POST | `create-user` | `Identity.User.Create` |
| GET | `get-all-users-with-roles` | `Identity.User.View` |
| POST | `update-user-roles` | `Identity.User.UpdateRoles` |
| DELETE | `delete-user/{userId}` | `Identity.User.Delete` |
| GET | `get-all-roles` | `Identity.Role.View` |
| POST | `create-role` | `Identity.Role.Create` |
| PUT | `update-role/{roleId}` | `Identity.Role.Update` |
| DELETE | `delete-role/{roleId}` | `Identity.Role.Delete` |

Seed role: `Basic`, `Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiêt bị`.

### `PermissionController` — `/api/Permission`
| Method | Route | Permission | Mô tả |
|---|---|---|---|
| GET | `all` | `Identity.Permission.View` | Toàn bộ, nhóm 2 cấp Module>Entity (`PermissionModuleGroupDto`) |
| GET | `role/{roleId}` | `Identity.Permission.View` | Permission của 1 role (phẳng) |
| PUT | `role/{roleId}` | `Identity.Role.Update` | Gán lại toàn bộ (body `List<int>`) |
| GET | `user/{userId}` | `Identity.Permission.View` | Override (grant/deny) của 1 User |
| GET | `user/{userId}/effective` | `Identity.Permission.View` | Permission hiệu lực cuối (base+override) |
| PUT | `user/{userId}` | `Identity.User.UpdatePermissions` | Gán lại override (`UpdateUserPermissionOverridesDto`) |

**Không có** API CRUD `Permission` (cố định, seed qua migration). Chỉ CRUD `RolePermission`/`UserPermission`.

## 7. Cần làm tiếp
- `AuthController` try/catch + `Fail<>()` thủ công (khác chuẩn §6) — nên refactor về ném exception.
- `RoleService.GetRoleByIdAsync` không check null.
- Chưa tách `UserController`; chưa có API sửa User (kể cả `DeviceName`).
- `UserDto` thiếu `[Required]`; `RoleDto` nên tách input/output.
- Role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` chưa có permission nào (chỉ `Admin` seed full).

## 8. Checklist thêm nghiệp vụ Identity
Đọc core + file này → entity `partial class` + DbSet + Fluent → `I<Entity>Repository` + impl + property vào `IIdentityUnitOfWork`+`IdentityUnitOfWork` → Service `: BaseService<IIdentityUnitOfWork>` (Scrutor tự DI) → Controller `: BaseController` + `[RequirePermission("Identity.<Entity>.<Action>")]` → permission mới thêm vào migration seed (§9) + gán `Admin` → migration `dotnet ef migrations add <Name> --project Indentity.Infrastructure --startup-project CompanySystem.HostApi --context IdentityDbContext` (bắt buộc `--context`) → cập nhật doc.

## 9. Phân quyền chi tiết (RBAC + Permission)
Mỗi action ↔ 1 mã `Module.Entity.Action`. Role sở hữu tập Permission (N-N). User có Role (+ override riêng §9.1).

**Enforce — Custom Policy** (`Shared.Application/Authorization/`, cần `FrameworkReference Microsoft.AspNetCore.App`):
- `PermissionRequirement(string) : IAuthorizationRequirement`.
- `PermissionAuthorizationHandler` — check `context.User.HasClaim("Permission", req.Permission)`.
- `PermissionPolicyProvider` — bọc `DefaultAuthorizationPolicyProvider`; policy prefix `"Permission:"` build động, còn lại delegate mặc định.
- `RequirePermissionAttribute : AuthorizeAttribute` — `[RequirePermission("Asset.Device.Create")]`.
- Đăng ký `Program.cs`: `AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>()` + `AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>()`.
- Claim `Permission` nạp trong `MyClaimsTransformation`, tự refresh mỗi request (§5).

**Danh sách permission đã seed** (~64 mã, seed rải qua nhiều migration):
| Module.Entity | Action |
|---|---|
| `Asset.Branch` / `.DeviceGroup` / `.DeviceDepartment` / `.Device` / `.DeviceType` / `.Supplier` / `.Software` / `.SoftwareGroup` / `.IpPrefix` | View, Create, Update, Delete |
| `Asset.IpAddress` | View, Create, Update, Delete, **Assign** (chung assign/unassign) |
| `Asset.DeviceConfiguration` | View, Create, Update, Delete (initial/history dùng lại View/Delete) |
| `Asset.DeviceSoftware` | View, Create, Update, Delete (picker→View, sync→Update) |
| `Asset.Report` | View |
| `Asset.TransferHistory` | View, Create |
| `Asset.Setting` | View, Update |
| `Identity.User` | View, UpdateRoles, UpdatePermissions, Create, Delete |
| `Identity.Role` | View, Create, Update, Delete |
| `Identity.Permission` | View |

**Seed & deploy**: migration INSERT toàn bộ `Permissions` + gán full cho `Admin` (tra `WHERE RoleName=N'Admin'`, không hardcode Id) qua `migrationBuilder.Sql(...)` — tránh Admin mất quyền khi chuyển role-check → permission-check. Role khác **không** gán mặc định, Admin tự cấu hình qua `PUT /api/Permission/role/{roleId}`.

### 9.1. Override permission theo User
Tránh "role rác": giữ Role làm nền, override riêng lẻ theo User cho ngoại lệ.
`UserPermission(UserId, PermissionId, IsGranted)`: `true`→cấp thêm, `false`→thu hồi (deny).

Công thức hiệu lực (dùng ở `MyClaimsTransformation` + `GetEffectivePermissionsForUserAsync`):
```
base   = ∪ Permissions của mọi Role của User
grants = { IsGranted=true }, denies = { IsGranted=false }
effective = (base ∪ grants) \ denies      // DENY luôn thắng
```
Ràng buộc: `UpdateUserPermissionOverridesAsync` ném `DomainException` nếu cùng 1 `PermissionId` ở cả Grant lẫn Deny. Cập nhật = **thay thế toàn bộ** (xóa hết override cũ rồi insert lại). Đã seed `Identity.User.UpdatePermissions` full cho `Admin`. Chưa có UI FE.
