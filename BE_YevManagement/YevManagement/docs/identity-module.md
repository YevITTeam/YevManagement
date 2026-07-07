# identity-module.md — Module Identity

> **Trạng thái:** ĐÃ CÓ CODE, đang chạy production. Quản lý User/Role và xác thực
> qua **Windows Negotiate (AD)** → sinh **JWT**. Đọc [architecture-core.md](architecture-core.md)
> trước để nắm pattern lõi.

- **DB:** `YevIdentityManagement` (connection string `IdentityManagementConnection`).
- **DbContext:** `IdentityDbContext` (`Indentity.Infrastructure/Context/`).
- **Thư mục Infrastructure:** `Indentity.Infrastructure/` (⚠️ typo "Inden", assembly = `Identity.Infrastructure`).

---

## 1. Domain Models

| Entity | Thuộc tính chính | Quan hệ | Soft delete |
|---|---|---|---|
| `User` | `Id`, `UserName`(≤100), `FullName?`, `CreatedAt`, `DeviceName?`(≤100) | N-N `Roles`, 1-N `LoginUserIPs` | Không |
| `Role` | `Id`, `RoleName`(≤50), `Description?`, `IsDeleted` | N-N `Users` | **Có** (`IsDeleted`) |
| `LoginUserIP` | `Id`, `UserId`, `IPAddress`, `FirstLoginAt`, `LastLoginAt` | N-1 `User` | Không |

**Cấu hình quan hệ (Fluent, `IdentityDbContext.OnModelCreating`):**
- `User` ↔ `Role`: **many-to-many** qua bảng nối `UserRoles` (khoá kép
  `UserId, RoleId`), khai báo bằng `UsingEntity<Dictionary<string,object>>`.
- `User`/`Role` là `partial class`; `IdentityDbContext` là `partial`.
- `LoginUserIP` chưa có Fluent config riêng (map theo convention).

---

## 2. DTOs (`Identity.Application/Dtos/UserDto/`)

| DTO | Dùng cho |
|---|---|
| `UserDto` | Trả thông tin user: `Id`, `UserName`, `FullName`, `DeviceName?`, `Roles: List<string>`. |
| `LoginResponseDto` | Kết quả login: `User: UserDto`, `Token: string`. |
| `RoleDto` | `Id`, `RoleName`, `Description?` (dùng cả input tạo role lẫn output). |
| `UpdateRoleDto` | `RoleName`, `Description?`. |
| `UpdateUserRolesDto` | `UserId`, `RoleIds: List<int>`. |

> Ghi chú: `UserDto.UserName`/`FullName` non-nullable nhưng chưa gắn `[Required]`
> (đang có warning CS8618). `RoleDto` hiện đóng 2 vai (input+output).

---

## 3. Repositories & UnitOfWork

- `IUserReposiory` *(giữ nguyên typo)* : `GenericRepository<User>` + `GetUserWithRolesAsync(userName)`.
- `IRoleRepository`, `ILoginUserIPRepository` : generic (repo con rỗng, chỉ kế thừa).
- `IIdentityUnitOfWork : IUnitOfWork` → phơi bày `Users`, `Roles`, `LoginUserIPs`.
- Cài đặt: `UserRepository`/`RoleRepository`/`LoginUserIPRepository` +
  `IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>`.

---

## 4. Services

| Service | Method | Ghi chú |
|---|---|---|
| `IUserService` / `UserService` | `SyncWindowsUserAsync`, `GetAllUsersAsync`, `UpdateUserRolesAsync` | Sync user AD, gán role, cập nhật role. |
| `IRoleService` / `RoleService` | `GetAllRolesAsync`, `GetRoleByIdAsync`, `CreateRoleAsync`, `UpdateRoleByIdAsync`, `DeleteRoleByIdAsync` | CRUD role, xoá = soft delete. `CreateRole` ném `DomainException` nếu trùng tên. |
| `ITokenService` / `TokenService` | `GenerateJwtToken(ClaimsPrincipal)` | Sinh JWT HS256 từ claims (loại bỏ claim `RolesLoaded`), hạn theo `JwtSettings:ExpiryMinutes`. |

---

## 5. Cơ chế xác thực (điểm đặc thù nhất của module)

Luồng: **Windows Negotiate → ClaimsTransformation (đồng bộ DB) → JWT**.

1. **Cấu hình** (`CompanySystem.HostApi/Configurations/Authentication.cs`):
   `AddAuthentication` mặc định `JwtBearer` + `.AddNegotiate()` +
   `.AddJwtBearer(...)` (validate Issuer/Audience/Lifetime/SigningKey từ `JwtSettings`).
2. **`MyClaimsTransformation : IClaimsTransformation`** (`Indentity.Infrastructure/Authentication/`)
   chạy mỗi request đã xác thực Windows:
   - Nếu chưa có claim `RolesLoaded`: tra `Users` theo `UserName` (Windows name).
   - User chưa tồn tại → tạo mới, gán role `"Basic"`, resolve `FullName` từ AD
     (`UserPrincipal.FindByIdentity`, chỉ chạy trên Windows).
   - Ghi/cập nhật `LoginUserIP` (IP client, `LastLoginAt`), `DeviceName` (reverse DNS).
   - Bơm claims: `ClaimTypes.Role` (mỗi role), `FullName`, `IpAddress`, `DeviceName`, `RolesLoaded=true`.
3. **`AuthController.WindowsLogin`** (`[Authorize(AuthenticationSchemes="Negotiate")]`)
   đọc claims, gọi `TokenService.GenerateJwtToken(User)` trả `LoginResponseDto`.
   Từ đó client dùng `Authorization: Bearer <token>` cho các request sau.

> ⚠️ Phần AD (`System.DirectoryServices.AccountManagement`) chỉ hoạt động khi host
> chạy trên Windows domain-joined (có warning CA1416 khi build). `TransformAsync`
> có thể ghi DB (tạo user/IP) → windows-login **không** hoàn toàn read-only.

---

## 6. API Endpoints (`Identity.Api/Controllers/AuthController.cs`)

Route gốc: `/api/Auth`. Controller kế thừa `BaseController` (Identity), trả `ApiResponse<T>`.

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate | Đăng nhập Windows → JWT + profile. |
| GET | `/api/Auth/get-all-users-with-roles` | `Admin` | Danh sách user + role. |
| POST | `/api/Auth/update-user-roles` | `Admin` | Cập nhật role cho user (`UpdateUserRolesDto`). |
| GET | `/api/Auth/get-all-roles` | `Admin` | Danh sách role (chưa xoá). |
| POST | `/api/Auth/create-role` | `Admin` | Tạo role (`RoleDto`). |
| PUT | `/api/Auth/update-role/{roleId}` | `Admin` | Sửa role (`UpdateRoleDto`). |
| DELETE | `/api/Auth/delete-role/{roleId}` | `Admin` | Xoá mềm role. |

Seed role trong DB: `Basic`, `Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiêt bị` (và có thể thay đổi).

---

## 7. Hiện trạng: ĐÃ XONG / CẦN LÀM TIẾP

**Đã xong:**
- Xác thực Windows → JWT, tự đồng bộ user + lịch sử IP/thiết bị.
- CRUD Role (soft delete), gán role cho user, liệt kê user.

**Cần làm tiếp / điểm nợ kỹ thuật:**
- `AuthController` dùng `try/catch` + `Fail<>()` thủ công thay vì để middleware
  xử lý (khác chuẩn ở [architecture-core.md](architecture-core.md) §6). Cân nhắc refactor về ném exception.
- `RoleService.GetRoleByIdAsync` **không kiểm null** trước khi map → NRE nếu id sai
  (nên dùng `.OrThrowNotFound("Role", roleId)`).
- Chưa có endpoint quản lý User độc lập (chỉ thao tác qua Auth). Chưa có xoá/sửa User.
- `UserDto` thiếu `[Required]`; `RoleDto` nên tách input/output.
- Endpoint Identity **không** `[AllowAnonymous]` — siết bằng role `Admin` (khác Asset).

---

## 8. Checklist khi thêm nghiệp vụ vào Identity

1. Đọc [architecture-core.md](architecture-core.md) + file này.
2. Entity mới → thêm `partial class` vào `Identity.Domain/Entities/`, khai báo
   `DbSet` + Fluent config trong `IdentityDbContext`.
3. Thêm `I<Entity>Repository : IGenericRepository<Entity>` + cài đặt; thêm property
   vào `IIdentityUnitOfWork` **và** `IdentityUnitOfWork` (constructor + property).
4. Service `: BaseService<IIdentityUnitOfWork>, I<Feature>Service` — Scrutor tự DI.
5. Controller `: BaseController`, bọc `Success/Fail`, gắn `[Authorize(Roles="...")]`.
6. Tạo migration: `dotnet ef migrations add <Name> --project Indentity.Infrastructure --startup-project CompanySystem.HostApi`.
7. Cập nhật lại file doc này.
