# identity-module.md — Module Identity

> Production. User/Role/Permission + xác thực Windows Negotiate (AD) / form AD / QR → JWT. Đọc [architecture-core.md](architecture-core.md) trước.
> DB `YevIdentityManagement` (conn `IdentityManagementConnection`), `IdentityDbContext`. Thư mục Infrastructure là `Indentity.Infrastructure/` (typo giữ nguyên, assembly `Identity.Infrastructure`).
> Mục lục: §1 Domain · §2 Services · §3 Xác thực · §4 Tính năng phụ (tạo/xoá user, TEST, QR, email) · **§6 API (hợp đồng FE↔BE)** · §7 Còn nợ · §8 Checklist · §9 Phân quyền.

## 1. Domain
Entity ở `Identity.Domain/Entities/` (tất cả `partial class`); cấu hình Fluent trong `IdentityDbContext.OnModelCreating`.
- `User` (không `IsDeleted`, xoá **cứng**; `Email` = email chính), `Role` (soft-delete), `Permission` (mã `Module.Entity.Action` unique, cố định — seed qua migration), `LoginUserIP`, `LoginQrCode`/`LoginQrLog`, `UserEmail`/`UserEmailModule`, `UserPermission` (khoá kép `(UserId, PermissionId)` + `IsGranted`; tường minh vì có cột `IsGranted`/`IsAutoGranted`), `TestLoginAccount`.
- `User↔Role` (`UserRoles`) và `Role↔Permission` (`RolePermissions`) là N-N qua `UsingEntity`, không có repo riêng.
- Bất biến: **1 `UserName` = đúng 1 dòng `User`**. `UserEmail` unique theo `(UserId, Email)`; `UserEmailModule` unique `(UserId, ModuleCode)`.

## 2. Services (`Identity.Application/Services/`)
- `UserService`: `SyncWindowsUserAsync`, `GetAllUsersAsync(roleId?)`, `UpdateUserRolesAsync`, `CreateUserAsync`, `UpdateUserFullNameAsync`, `DeleteUserAsync`. `RoleService`: CRUD (xoá mềm, trùng tên → `DomainException`). ⚠️ `RoleService.GetRoleByIdAsync` không check null.
- `TokenService.GenerateJwtToken` — JWT HS256 hạn `JwtSettings:ExpiryMinutes` (120). **Không** chứa `Permission` (xem §3); `Role` chỉ lấy từ identity `DbRoles` rồi `DistinctBy`, loại claim JWT tự sinh (`exp/nbf/iat/iss/aud/jti`) để token gia hạn không trùng `aud`/`exp`.
- `PermissionService`: `GetAll`, `GetRolePermissions`, `UpdateRolePermissions` (clear+add lại), `GetUserPermissionOverrides`, `GetEffectivePermissionsForUser`, `UpdateUserPermissionOverrides` (§9.1).
- `IIdentityUnitOfWork` phơi repo của mọi entity trên; `IUserReposiory.GetUserWithRolesAsync(userName)`.

## 3. Xác thực: Negotiate → ClaimsTransformation → JWT
1. Config `HostApi/Configurations/Authentication.cs`: default JwtBearer + `.AddNegotiate()`.
2. **`MyClaimsTransformation`** (`Indentity.Infrastructure/Authentication/`) chạy mỗi request đã xác thực:
   - Gỡ **mọi** claim `Role`/`Permission` mang sẵn trong JWT; chỉ tin identity `DbRoles` → thu hồi quyền có hiệu lực ngay, kể cả token cũ.
   - Khớp User **CHỈ theo `UserName` suông**. `DeviceName` (reverse-DNS) chỉ để hiển thị — từng khớp theo cặp `(UserName, DeviceName)` gây tạo User trùng (đã bỏ; dữ liệu trùng cũ rà tay).
   - Chưa có User → tạo mới role `Basic`, `FullName` từ AD (`UserPrincipal.FindByIdentity`, chỉ Windows). User chưa có `UserEmail` nào → lấy AD `mail` làm email chính (Source=AD); đã có email thì không đụng.
   - Ghi `LoginUserIP`; bơm claims vào `ClaimsIdentity` riêng `AuthenticationType = "DbRoles"`: `Role`, `Permission`, `FullName`, `Email`, `IpAddress`, `DeviceName`, `RolesLoaded`. Tên claim là hằng ở `Identity.Application/Authentication/IdentityClaimTypes.cs` (Infrastructure tạo → Application đóng vào JWT → Api đọc ra `UserDto`; phải khớp chính xác).
3. `AuthController.WindowsLogin` (Negotiate) / `Me` (Bearer) / `Login` / `QrLogin` cùng gọi `BuildSession(principal)` → `UserDto` + token → `LoginResponseDto { user, token }`.

⚠️ **Cache:** permission/role/profile lấy từ DB và cache trong `IAuthSnapshotCache` (`IMemoryCache`, TTL 60s, Singleton). `IdentityUnitOfWork.SaveChangesAsync` gọi `InvalidateAll()` sau mọi lần lưu entity Identity (trừ `LoginUserIP/LoginQrCode/LoginQrLog`) → đổi quyền có hiệu lực ngay; sửa DB trực tiếp chỉ có hiệu lực sau ≤ 60s. Cache nằm trong tiến trình — chạy nhiều instance phải thay bằng Redis. Mọi request `/api/Auth/*` luôn nạp lại cache.
⚠️ AD (`System.DirectoryServices.AccountManagement`) chỉ chạy trên Windows domain-joined (CA1416). `TransformAsync` ghi DB nên `windows-login` không read-only.

**`POST /api/Auth/login` (form tự viết, vẫn xác thực AD):** `IActiveDirectoryAuthService.ValidateCredentials(domain, userName, password)` bind thẳng AD (domain từ `ActiveDirectory:Domain`, mặc định `YEV`), không lưu password. Sai user/pass trả chung "Tên đăng nhập hoặc mật khẩu không đúng.". Thành công → `ClaimsPrincipal` mồi `Name = "{domain}\{userName}"` → qua đúng `MyClaimsTransformation` → `BuildSession`.
> ⚠️ **Bắt buộc `ValidateCredentials(userName, password, ContextOptions.SimpleBind)`, KHÔNG dùng overload 2 tham số:** overload mặc định (Negotiate) trả `true` cho BẤT KỲ cặp user/pass nào khi tiến trình BE chạy dưới tài khoản domain có Kerberos ticket (bypass xác thực).
> ⚠️ `SimpleBind` không tự resolve `sAMAccountName` trần — phải ghép down-level name `"{domain}\{userName}"` (`ActiveDirectoryAuthService` tự ghép; caller chỉ truyền `userName` trần).

## 4. Tính năng phụ
- **Tạo user thủ công** (`create-user`): pre-provision cho người chưa từng login; login lần đầu khớp theo `UserName` → giữ Role đã gán. Chặn trùng `UserName`, validate `RoleIds`.
- **Xoá user** (`delete-user`): xoá cứng, cascade dọn `UserRoles/LoginUserIPs/UserPermissions`. Login lại sau xoá → tạo mới `Basic`, mất override cũ (có chủ đích).
- **Sửa tên hiển thị** (`update-user-fullname`): chỉ ghi đè `FullName`; `UserName` (khoá khớp login) và `DeviceName` không sửa được qua API nào.
- **`EnsureUserExistsAsync(userName, fullName, roleName)`** (`IUserDirectoryService`, `Shared.Application/Interfaces/`): tạo User idempotent cho import cross-module (đã tồn tại → no-op trả `false`, giữ Role; chưa có → tạo, role mặc định `Basic`). Người gọi: `EmployeeIdentityLinkImportService` (Attendance, permission `Identity.User.BulkImport`).
- **Tạo User từ tài khoản domain có trong AD** (`IUserDirectoryService.ResolveDomainAccountsAsync` chỉ đọc / `EnsureDomainUsersAsync` tạo; người gọi: import Tanium và lưu thiết bị bên Asset, `asset-module.md §1.10`): bỏ trùng không phân biệt hoa/thường, chỉ tra AD cho tài khoản Identity chưa có (song song tối đa 8) qua `IActiveDirectoryAuthService.FindAccount` (`UserPrincipal.FindByIdentity`; domain phải khớp `ActiveDirectory:Domain`). Trạng thái `DomainAccountState`: `ExistsInIdentity`, `WillCreate`/`Created` (AD đang bật), `Disabled`, `NotInDirectory`, `DirectoryUnavailable` (không hỏi được AD thì **không tạo**; khác `GetEmailAddresses` vốn nuốt lỗi), `Failed`. Tạo User role `Basic` với họ tên = AD `displayName`, không thêm email — giống JIT-provision nên không mở thêm quyền.
- **Đăng nhập TEST** (bypass AD): `UserName` bắt đầu `TEST\` (bảng `TestLoginAccounts`, `PasswordHash` kiểu `PasswordHasher<object>`) rẽ nhánh trong `POST /login`, **chỉ khi `IsDevelopment()`**, mật khẩu chung `Test@2026`. Có 10 tài khoản seed phủ Cây duyệt Chuyền Attendance: `TEST\ll_shido`, `gl_shido`, `tl_shido`, `mgr_ct`, `fm_01`, `dir_01` và nhóm Công vụ-IT `st_cvit`, `gl_cvit`, `tl_cvit`, `mgr_cv` (migration `AddTestLoginAccounts`, `AddTestAccountsCongVuIT`). Permission theo Chức vụ chỉ sync được khi `Identity.User` đã tồn tại → thứ tự tạo tài khoản TEST mới: `TestLoginAccount` → `create-user` → tạo `Employee` (tự sync) → login 1 lần. Mật khẩu cấp 2/chữ ký là luồng self-service qua email nên tài khoản TEST phải seed tay.
- **Đăng nhập QR** (app YEV Scan): QR chứa `YEVQR1:<base64url mã ngẫu nhiên 32 byte>`, **không** chứa `UserId`. `LoginQrCode` chỉ lưu SHA-256 → mã gốc lấy được **1 lần** lúc tạo; mỗi user tối đa 1 mã hoạt động (tạo mới thu hồi cũ). Mã dài hạn, dùng nhiều lần, hết hiệu lực khi Admin thu hồi/tạo lại/xoá User — coi như mật khẩu. `LoginQrLog` ghi `Created/Revoked/LoginSuccess/LoginFailed`. Chưa làm: giới hạn quét sai theo IP.
- **Email người dùng** (Identity là nguồn chân lý email; email thêm mới luôn lưu chữ thường, dữ liệu cũ chuyển bằng `docs/deploy-config/sql/lowercase-emails-identity.sql`): bất biến user có ≥1 `UserEmail` thì có đúng 1 `IsPrimary` và `User.Email` = email chính (JWT claim `Email` giữ nguyên). Chỉ Admin quản lý. Đề xuất đồng bộ (`suggestions`): AD `mail` + mọi `smtp:` trong `proxyAddresses`, cộng email của máy Tanium (`IDeviceContactDirectoryService.GetEmailsByDomainAccountAsync`, ghi chú = mã máy); AD thắng khi trùng. `LinkDomainAccountEmailsAsync` (form thiết bị Asset → Identity): chưa có User thì tạo (`Basic`, họ tên = `Device.Manager`), thêm email `Source=Manual`, **không bao giờ đổi email chính** (User chưa có email nào thì email đầu thành chính), không tự gán module. Danh mục module: `Shared.Application/Helper/EmailModules.cs` (`Attendance` đã áp dụng; `Workflow` lưu được nhưng `IsApplied=false`). Gửi mail: `IUserDirectoryService.GetContactInfoAsync(userName, moduleCode)` → email Admin gán cho module, không có thì email chính.

## 6. API (hợp đồng FE↔BE)
Envelope `ApiResponse<T>` (xem `architecture-core.md §3`). Thiếu token → 401, thiếu permission → 403. Tên field đọc ở `Identity.Application/Dtos/` hoặc `yev-frontend/src/modules/auth/types/`. Base URL & CORS: `AGENTS.md` / `Program.cs`.

### 6.1. Đăng nhập & phiên
| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate | Không body; fetch **`credentials: "include"`** (thiếu → luôn 401); handshake 2–3 request là bình thường. Có side-effect ghi DB, idempotent |
| POST | `/api/Auth/login` | Public | `{userName, password}`, `userName` KHÔNG kèm domain; password đi JSON qua LAN (chưa HTTPS) |
| POST | `/api/Auth/qr-login` | Public | `{code}` (có/không tiền tố `YEVQR1:`); sai/đã thu hồi → 400 "Mã QR không hợp lệ hoặc đã bị thu hồi." → app xoá mã đã lưu |
| GET | `/api/Auth/me` | Bearer | Cùng shape `{user, token}` + token gia hạn thêm 120' (sliding session) |

- Mọi nhánh trả `data = { user: {id, userName, fullName, deviceName?, email?, roles[], permissions[]}, token }`. `email` = email chính (nullable); `roles` luôn có ≥ `Basic`; **định danh = `userName`**, không dùng `deviceName`.
- **Chỉ gọi `windows-login` khi chưa có token**; còn token → `GET /me` (mỗi `windows-login` là 1 handshake NTLM, máy chưa bật SSO sẽ bị hỏi lại tài khoản domain). `client.ts` tự re-login 1 lần khi 401 rồi retry; `AuthProvider` gọi `/me` mỗi 30 phút; nút "Làm mới quyền" cũng qua `/me`. Nên giữ nút `windows-login` làm lựa chọn phụ cho máy đã có SSO. Máy chưa SSO: thêm origin BE vào vùng Local Intranet hoặc policy `AuthServerAllowlist`.
- **JWT không chứa permission** — FE đọc `data.user.permissions` (hiệu lực cuối, đã áp override), không decode JWT. Quyền bị thu hồi có hiệu lực ngay ở BE; FE gọi `/me` để cập nhật UI. Ẩn/hiện UI theo `user.permissions`, không theo `user.roles`.
- Sliding session: AD bị vô hiệu hoá vẫn sống tới khi đóng app > 120' (chấp nhận được với app nội bộ).

### 6.2. User, Role, Permission
| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/api/Auth/get-all-users-with-roles?roleId=` | `Identity.User.View` | `roleId` tuỳ chọn; không phân trang; **không trả `permissions`** |
| POST | `/api/Auth/create-user` | `Identity.User.Create` | `{userName[Required], deviceName?, fullName?, roleIds?}`; 400 nếu trùng/`roleIds` sai |
| POST | `/api/Auth/update-user-roles` | `Identity.User.UpdateRoles` | `{userId, roleIds}` = **toàn bộ** danh sách cuối (thiếu = gỡ) |
| PUT | `/api/Auth/update-user-fullname` | `Identity.User.UpdateFullName` | `{userId, fullName}`; 400 nếu rỗng, 404 nếu sai id; trả `UserDto` |
| DELETE | `/api/Auth/delete-user/{userId}` | `Identity.User.Delete` | xoá cứng |
| GET/POST/PUT/DELETE | `/api/Auth/get-all-roles` · `create-role` · `update-role/{id}` · `delete-role/{id}` | `Identity.Role.View/Create/Update/Delete` | `{roleName, description}`; 400 nếu trống/trùng; xoá mềm. Seed role: `Basic`, `Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiết bị` |
| GET | `/api/Permission/all` | `Identity.Permission.View` | Nhóm 2 cấp `[{module, entities:[{entity, permissions[]}]}]`; FE flatten `entities.flatMap(e => e.permissions)` |
| GET/PUT | `/api/Permission/role/{roleId}` | View / `Identity.Role.Update` | PUT body `[1,2,5]` = **toàn bộ** Id cuối |
| GET | `/api/Permission/user/{userId}` | `Identity.Permission.View` | Override `[{permissionId, code, isGranted, isAutoGranted}]` |
| GET | `/api/Permission/user/{userId}/effective` | `Identity.Permission.View` | Hiệu lực cuối (gồm phần tự động cấp) |
| PUT | `/api/Permission/user/{userId}` | `Identity.User.UpdatePermissions` | `{grantPermissionIds, denyPermissionIds}`; 400 nếu 1 id ở cả hai |

Không có API CRUD `Permission` (cố định). Override `isAutoGranted=true` là dòng Attendance tự cấp theo Chức vụ (không phải Admin): `PUT user/{id}` chỉ xoá/ghi lại phần `isAutoGranted=false`, giữ nguyên phần tự động cấp; id trùng đúng dòng tự động cấp = Admin **chiếm thủ công** (đổi `isGranted`, `isAutoGranted=false`, ngừng đồng bộ theo Chức vụ). FE `UserPermissionOverrideManager.tsx` chỉ đưa override thủ công vào state gửi lên.

### 6.3. Mã QR đăng nhập — `/api/LoginQr` (`Identity.LoginQr.Manage`, chỉ Admin)
`GET /` user đang có mã `[{userId, createdAt, lastUsedAt, useCount}]` · `POST /{userId}` tạo mã mới (vô hiệu mã cũ), trả `{userId, userName, fullName, qrPayload, createdAt}` — `qrPayload` **chỉ có trong response này** (FE dùng `qrcode` vẽ ảnh) · `POST /batch` body `{userIds[≤200]}` tạo mã mới cho nhiều user (mỗi người vô hiệu mã cũ, ghi log `Created` từng người), trả mảng cùng shape `POST /{userId}`; 400 nếu có id không tồn tại (không tạo mã nào) · `DELETE /{userId}` thu hồi (400 nếu chưa có mã) · `GET /{userId}/logs` 50 log gần nhất, mới trước. FE: `LoginQrDialog.tsx` (1 user); in hàng loạt: tick nhiều user ở `UserRoleModal` → nút "In QR (N)" → xác nhận → `POST /batch` → `lib/loginQrLabelPrint.ts` in tem Zebra 5.2×3.1cm (2 tem/hàng, chỉ tên + QR; khổ ở `modules/common/lib/zebraLabel.ts`, dùng chung với tem thiết bị).

### 6.4. Email người dùng — `/api/UserEmail` (`Identity.UserEmail.Manage`, chỉ Admin)
Mọi endpoint ghi trả lại toàn bộ `UserEmailOverviewDto { userId, userName, fullName, emails[{id, email, source, isPrimary, note, createdAt}], modules[{moduleCode, moduleName, isApplied, userEmailId}] }`. `source`: `0`=AD, `1`=Alias AD, `2`=Tanium, `3`=Nhập tay. `modules[].userEmailId = null` → module gửi về email chính; `isApplied=false` → lưu được nhưng chưa có tác dụng.

| Method | Route | Ghi chú |
|---|---|---|
| GET | `user/{userId}` | Overview |
| GET | `user/{userId}/suggestions` | `[{email, source, note, alreadyAdded}]` (AD + Tanium) |
| POST | `user/{userId}` | `{email[Required, EmailAddress, ≤255], source (mặc định 3), note?, isPrimary}`; email đầu tiên luôn thành chính; 400 nếu trùng |
| DELETE | `user/{userId}/{userEmailId}` | 400 nếu xoá email chính khi còn email khác; xoá email đang gán module → module quay về email chính |
| PUT | `user/{userId}/{userEmailId}/primary` | Đặt email chính (đồng bộ `UserDto.email`) |
| PUT | `user/{userId}/modules` | `{items:[{moduleCode, userEmailId\|null}]}` = **toàn bộ** cấu hình cuối; 400 nếu module không hỗ trợ/trùng/email không thuộc user |
| GET | `domain-account?domainAccount=DOMAIN\user` | `{domainAccount, userExists, userId, fullName, emails[]}` — cho form thiết bị hiện trạng thái |
| POST | `link-domain-account` | `{domainAccount[Required, DOMAIN\user, ≤100], fullName?, emails:[{email, note?}] (≥1)}` → `{userId, userName, userCreated, addedEmails[], skippedEmails[]}` |

FE: nút "Email" trên mỗi dòng `UserRoleModal` → `UserEmailDialog.tsx`; form thiết bị Asset (`DeviceForm.tsx`) dùng `domain-account`, `link-domain-account`, `modules`, `primary`.

### 6.5. Lỗi thường gặp
| Hiện tượng | Xử lý |
|---|---|
| `windows-login` luôn 401 | Thiếu `credentials:"include"` hoặc máy không trong domain |
| Trình duyệt hỏi tài khoản domain lặp lại | Đang gọi `windows-login` nhiều lần → dùng `/me`; lần đầu vẫn hỏi = máy chưa bật SSO cho origin BE |
| 401 dù đã login | Token hết hạn (120') → `/me`, hỏng nữa thì `windows-login` |
| 403 dù token còn hạn | Role thiếu permission → `PUT /Permission/role/{id}`; có Role đủ quyền vẫn 403 = bị **deny override** → `GET /Permission/user/{id}` rồi gỡ |
| CORS chặn | Origin ngoài whitelist → thêm vào policy `AllowNextJs` ở `Program.cs` |

## 7. Còn nợ
`AuthController` còn try/catch + `Fail<>()` thủ công (nên ném exception); `RoleService.GetRoleByIdAsync` không check null; chưa tách `UserController`, chưa có API sửa `DeviceName`; `UserDto` thiếu `[Required]`, `RoleDto` nên tách input/output; Role `Basic`/`Quản lý Hợp Đồng`/`Quản lý Thiết bị` chưa gán permission nào (chỉ `Admin` full).

## 8. Checklist thêm nghiệp vụ Identity
Entity `partial class` + DbSet + Fluent → `I<Entity>Repository` + impl + property vào `IIdentityUnitOfWork`/`IdentityUnitOfWork` → Service `: BaseService<IIdentityUnitOfWork>` → Controller `: BaseController` + `[RequirePermission("Identity.<Entity>.<Action>")]` → permission mới vào migration seed + gán `Admin` → `dotnet ef migrations add <Name> --project Indentity.Infrastructure --startup-project CompanySystem.HostApi --context IdentityDbContext` (**bắt buộc `--context`**) → cập nhật doc.

## 9. Phân quyền chi tiết (RBAC + override)
Mỗi action ↔ 1 mã `Module.Entity.Action`; Role sở hữu tập Permission (N-N); User có Role + override riêng.
- **Enforce** (`Shared.Application/Authorization/`): `RequirePermissionAttribute : AuthorizeAttribute` → `PermissionPolicyProvider` (policy prefix `"Permission:"` build động) → `PermissionAuthorizationHandler` (`HasClaim("Permission", code)`); claim nạp bởi `MyClaimsTransformation` mỗi request (§3). Đăng ký Singleton ở `Program.cs`.
- **Danh sách mã đã seed** (~64, rải nhiều migration): `Asset.{Branch|DeviceGroup|DeviceDepartment|Device|DeviceType|Supplier|Software|SoftwareGroup|IpPrefix}` View/Create/Update/Delete · `Asset.IpAddress` +`Assign` · `Asset.DeviceConfiguration`/`DeviceSoftware` CRUD · `Asset.Report` View · `Asset.TransferHistory` View/Create · `Asset.Setting` View/Update · `Asset.AuditTrail` View · `Identity.User` View/UpdateRoles/UpdatePermissions/UpdateFullName/Create/Delete/BulkImport · `Identity.Role` View/Create/Update/Delete · `Identity.Permission` View · `Identity.LoginQr` Manage · `Identity.UserEmail` Manage. Mã đầy đủ: bảng `Permissions` hoặc các migration `Add*Permission*`.
- **Seed:** migration INSERT toàn bộ `Permissions` + gán full cho `Admin` (tra `WHERE RoleName=N'Admin'`, không hardcode Id, qua `migrationBuilder.Sql`). Role khác không gán mặc định; Admin tự cấu hình.

### 9.1. Override theo User
Giữ Role làm nền, override cho ngoại lệ: `UserPermission.IsGranted` `true` = cấp thêm, `false` = thu hồi.
`effective = (∪ Permissions của mọi Role ∪ grants) \ denies` — **DENY luôn thắng** (dùng ở `MyClaimsTransformation` + `GetEffectivePermissionsForUserAsync`). `UpdateUserPermissionOverridesAsync` ném `DomainException` nếu 1 `PermissionId` ở cả Grant lẫn Deny; cập nhật thay thế toàn bộ phần thủ công (xem §6.2 về `isAutoGranted`).
