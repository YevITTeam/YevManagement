# identity-api-fe.md — API Identity cho Frontend

> Hợp đồng API cho đội FE (login + quản trị user/role). Implementation: [identity-module.md](identity-module.md). Module Asset: [asset-api-fe.md](asset-api-fe.md) · Module Attendance: [attendance-api-fe.md](attendance-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8080` (theo `CompanySystem.HostApi/Properties/launchSettings.json` — đây là nguồn chuẩn; giá trị cũ `http://localhost:5000` đã không còn dùng) · Scalar UI `/scalar/v1`.
- **CORS**: chỉ `http://localhost:3000` + `http://10.45.1.181:3000` (`AllowCredentials`). Origin khác → báo BE thêm whitelist.
- Envelope `ApiResponse<T>` + cách đọc `data`/`errors` giống Asset — xem [asset-api-fe.md §1](asset-api-fe.md).
- **Cập nhật 2026-07-16**: `UserDto` thêm `email` (nullable, tự resolve từ AD, không tự nhập/sửa được) — trả về ở `windows-login` (mục 2) và `get-all-users-with-roles` (mục 4.1). Phục vụ tính năng gửi email xác nhận cập nhật chữ ký/duyệt đơn ở module Attendance.

- **Cập nhật 2026-08-01**: thêm `GET /api/Auth/me` (mục 2b) — lấy lại hồ sơ + **gia hạn JWT bằng chính token đang có**, không cần handshake Negotiate. FE chỉ gọi `windows-login` khi **chưa có** token.

## 1. Auth
| Endpoint | Cơ chế |
|---|---|
| `POST /api/Auth/windows-login` | **Windows Negotiate** (IWA), không dùng Bearer |
| `GET /api/Auth/me` | **JWT Bearer** (chỉ cần đã đăng nhập, không cần permission) |
| Tất cả còn lại (Identity + Asset) | **JWT Bearer** + user phải có **permission** cụ thể (không phải check "role Admin") |

## 2. Login — `POST /api/Auth/windows-login`
Không phải username/password — xác thực qua **Windows Negotiate** dựa phiên Windows của máy client (phải trong domain AD). **Không có body request.**

```js
const res = await fetch("http://10.45.1.155:8080/api/Auth/windows-login", {
  method: "POST", credentials: "include" // BẮT BUỘC, thiếu → luôn 401
});
```
- Máy/trình duyệt không trong domain hoặc chặn Negotiate → **401** (không có body chuẩn, bị chặn ở auth middleware).
- Handshake Negotiate có thể gửi 2-3 request tới endpoint này trước khi thành công — bình thường, browser tự làm.

**Response `data`**:
```jsonc
{
  "user": {
    "id": 12, "userName": "YEV\\n.truong.da.pcd.it", "fullName": "Truong Nguyen",
    "deviceName": "DESKTOP-ABC123",  // nullable, reverse-DNS, chỉ hiển thị
    "email": "n.truong@yazaki.com",  // nullable, xem ghi chú bên dưới
    "roles": ["Admin"],              // luôn có ít nhất "Basic"
    "permissions": ["Asset.Device.View", "..."]  // mã hiệu lực (roles + override)
  },
  "token": "eyJ..."  // JWT, dùng cho mọi request sau
}
```
- **Định danh = `UserName` suông.** `DeviceName` chỉ hiển thị (reverse-DNS không ổn định) — FE **đừng** dùng để định danh.
- **`email`** (2026-07-16, mới) — tự resolve từ thuộc tính AD `mail` ngay lần đăng nhập đầu tiên (giống `fullName`), **không** phải do user tự nhập. Nullable — có thể `null` nếu tài khoản AD chưa cấu hình mail, hoặc user đã tồn tại từ trước tính năng này và chưa đăng nhập lại lần nào kể từ đó (BE tự "chữa lành" — chỉ set nếu đang trống, ở lần đăng nhập kế tiếp). Đây **không phải field để FE sửa** — không có endpoint nào cho phép update `email` trực tiếp; muốn đổi phải sửa trong AD rồi chờ user đăng nhập lại (hoặc Admin không có cách set tay). Dùng bởi module Attendance để gửi email xác nhận cập nhật chữ ký/duyệt đơn — xem [attendance-api-fe.md §6b/§4.6](attendance-api-fe.md).
- `windows-login` có **side-effect ghi DB** (IP + DeviceName + Email nếu đang trống) nhưng idempotent.
- `token` hết hạn **120 phút** → 401. Gia hạn bằng `GET /api/Auth/me` (mục 2b), chỉ khi không còn token hợp lệ mới phải gọi lại `windows-login`.
- **Permission tự refresh mỗi request** — Admin đổi permission Role có hiệu lực ngay request sau, không cần login lại. `user.permissions` lúc login chỉ là snapshot.
- **JWT cũng có claim `Email`** (nếu có giá trị, cùng cách claim `FullName` đã có) — nhưng FE không cần tự decode JWT, dùng thẳng `data.user.email` ở trên là đủ.

Request sau: `headers: { Authorization: 'Bearer ${token}' }`.

## 2b. Lấy lại phiên & gia hạn token — `GET /api/Auth/me` *(2026-08-01)*
Chỉ cần `Authorization: Bearer <token>` (không cần permission). Trả về **đúng shape `data` của `windows-login`**
(`{ user, token }`) trong đó `token` là **JWT mới đã gia hạn thêm 120 phút**.

**Vì sao có endpoint này — đừng gọi `windows-login` để "lấy lại user".** Mỗi lời gọi `windows-login` là
một handshake Negotiate/NTLM mới. Handshake chỉ **âm thầm** khi trình duyệt đã bật SSO cho origin của BE
(site nằm trong vùng *Local Intranet* của Windows, hoặc policy `AuthServerAllowlist` của Chrome/Edge);
máy chưa cấu hình sẽ bị **hỏi lại tài khoản domain mỗi lần** — đúng triệu chứng "đã đăng nhập rồi vẫn bị
bắt đăng nhập lại". `/Auth/me` chỉ dùng Bearer nên không kéo theo handshake nào.

Quy tắc dùng ở FE (đã implement trong `AuthApi.getCurrentUser`):
- localStorage **đã có** token → `GET /Auth/me`. Token hết hạn/hỏng → 401 → `client.ts` tự `windows-login` 1 lần rồi retry.
- localStorage **chưa có** token → `POST /Auth/windows-login`.
- Tab mở lâu: `AuthProvider` tự gọi `/Auth/me` mỗi **30 phút** để token không bao giờ kịp hết hạn giữa giờ làm.
- Nút "Làm mới quyền" cũng đi qua `/Auth/me` (không cần đăng nhập lại) — xem gạch đầu dòng kế.

**Dữ liệu trả về luôn là bản mới nhất, không phải snapshot trong token cũ.** `MyClaimsTransformation` đọc lại
Role/Permission từ DB ở **mọi** request đã xác thực (kể cả Bearer) và gắn vào một `ClaimsIdentity` riêng
(`AuthenticationType = "DbRoles"`). `/Auth/me` (và `windows-login`) dựng `user` + JWT mới **chỉ từ identity đó**,
bỏ bản Role/Permission cũ nằm trong JWT gửi lên. Nhờ vậy quyền vừa **bị thu hồi** cũng biến mất khỏi token
sau lần gia hạn kế tiếp, và token không phình to dần qua mỗi lần gia hạn.

**Lưu ý bảo mật:** đây là *sliding session* — người dùng còn mở app thì token cứ được gia hạn, không có mốc
buộc xác thực lại Windows. Quyền vẫn luôn theo DB (khoá quyền có hiệu lực gần như tức thì), nhưng tài khoản
AD bị vô hiệu hoá thì phiên đang mở vẫn sống tới khi user đóng app quá 120 phút. Chấp nhận được với app nội bộ;
muốn chặt hơn thì phải thêm mốc buộc `windows-login` lại (chưa làm).

## 3. Phân quyền hiển thị UI
Dùng **`user.permissions`** (mảng `Module.Entity.Action`) để bật/tắt tính năng — **không** dùng `user.roles`. FE ẩn/hiện nút theo `user.permissions.includes(code)`; BE luôn enforce lại (thiếu permission → **403**). `user.permissions` đã là danh sách hiệu lực cuối (đã áp override). Lấy toàn bộ mã qua `GET /api/Permission/all` (mục 4.7). **Chỉ `Admin` seed full quyền**, 3 role còn lại cần Admin tự gán.

## 4. Quản trị User & Role
Cần `Authorization: Bearer` + permission tương ứng (thiếu token→401, thiếu permission→403).

- **4.1 `GET /api/Auth/get-all-users-with-roles?roleId=`** (`Identity.User.View`) → `[{id, userName, fullName, deviceName, email, roles:[]}]` (`email` mới 2026-07-16, xem mục 2 — hữu ích để Admin kiểm tra AD có resolve đúng mail cho user hay chưa trước khi họ báo "không nhận được email xác nhận"). `roleId` optional (mới 2026-07-16) — lọc user thuộc Role đó; không truyền → trả toàn bộ. Không phân trang. Lưu ý danh sách này **không trả `permissions`** (khác `windows-login`) — luôn là mảng rỗng nếu FE cố đọc.
- **4.2 `POST /api/Auth/update-user-roles`** (`Identity.User.UpdateRoles`) — body `{userId, roleIds:[1,2]}`. `roleIds` = **toàn bộ** danh sách cuối (gửi thiếu = gỡ role đó).
- **4.3 `GET /api/Auth/get-all-roles`** (`Identity.Role.View`) → `[{id, roleName, description}]`.
- **4.4 `POST /api/Auth/create-role`** (`Identity.Role.Create`) — `{roleName, description}`, 400 nếu trống/trùng.
- **4.5 `PUT /api/Auth/update-role/{roleId}`** (`Identity.Role.Update`) — `{roleName, description}`, 400 nếu roleId sai.
- **4.6 `DELETE /api/Auth/delete-role/{roleId}`** (`Identity.Role.Delete`) — xóa mềm.
- **4.7 Permission theo Role** (`/api/Permission`):
  - `GET /all` (`Identity.Permission.View`) → nhóm 2 cấp: `[{module, entities:[{entity, permissions:[{id,code,module,description}]}]}]`. Entity tách từ giữa `code`. FE flatten: `entities.flatMap(e=>e.permissions)`.
  - `GET /role/{roleId}` (`Identity.Permission.View`) → `PermissionDto[]` phẳng đang gán.
  - `PUT /role/{roleId}` (`Identity.Role.Update`) — body `[1,2,5,8]` **toàn bộ** Id cuối (gửi thiếu = gỡ). Không có API CRUD Permission (cố định).
- **4.8 Override theo User** (`/api/Permission/user/{userId}`): dùng khi 1 người cần quyền khác Role (tránh tạo Role mới):
  - `GET /user/{userId}` → override đang áp: `[{permissionId, code, ..., isGranted}]` (`false`=thu hồi, `true`=cấp thêm).
  - `GET /user/{userId}/effective` → permission hiệu lực cuối (đã áp override), shape như `GET /all` phẳng.
  - `PUT /user/{userId}` (`Identity.User.UpdatePermissions`) — body `{grantPermissionIds:[12], denyPermissionIds:[5,8]}` **toàn bộ** override cuối. 400 nếu 1 id ở cả 2 mảng. Không cần login lại.
- **4.9 `POST /api/Auth/create-user`** (`Identity.User.Create`) — pre-provision trước khi người dùng login lần đầu. Body `{userName[Required], deviceName?, fullName?, roleIds?}`. 400 nếu thiếu/trùng `userName` hoặc `roleIds` sai. `deviceName` chỉ tham khảo (khớp login chỉ theo `userName`).

## 5. Tổng hợp endpoint
| Method | Route | Permission |
|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate |
| GET | `/api/Auth/me` | Bearer (không cần permission) |
| POST | `/api/Auth/create-user` | `Identity.User.Create` |
| GET | `/api/Auth/get-all-users-with-roles` | `Identity.User.View` |
| POST | `/api/Auth/update-user-roles` | `Identity.User.UpdateRoles` |
| GET | `/api/Auth/get-all-roles` | `Identity.Role.View` |
| POST | `/api/Auth/create-role` | `Identity.Role.Create` |
| PUT | `/api/Auth/update-role/{roleId}` | `Identity.Role.Update` |
| DELETE | `/api/Auth/delete-role/{roleId}` | `Identity.Role.Delete` |
| GET | `/api/Permission/all` | `Identity.Permission.View` |
| GET/PUT | `/api/Permission/role/{roleId}` | View / `Identity.Role.Update` |
| GET | `/api/Permission/user/{userId}[/effective]` | `Identity.Permission.View` |
| PUT | `/api/Permission/user/{userId}` | `Identity.User.UpdatePermissions` |

## 6. Lỗi thường gặp
| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `windows-login` luôn 401 | Thiếu `credentials:"include"` / máy không trong domain → thêm credentials, test máy joined domain |
| **Trình duyệt hỏi tài khoản domain lặp lại dù vừa nhập đúng** | Đang gọi `windows-login` nhiều lần (mỗi lần = 1 handshake Negotiate). FE đã sửa: còn token thì dùng `GET /Auth/me` (mục 2b). Vẫn còn hỏi ở lần đăng nhập ĐẦU → máy chưa bật SSO cho origin BE: thêm `http://10.45.1.155:8080` vào vùng **Local Intranet** (Internet Options → Security → Local intranet → Sites → Advanced) hoặc policy `AuthServerAllowlist` của Chrome/Edge |
| API 401 dù đã login | Token hết hạn (120') / thiếu header → `GET /Auth/me` gia hạn, hỏng nữa thì `windows-login` |
| API 403 dù token còn hạn | Role thiếu permission → Admin `PUT /api/Permission/role/{roleId}` hoặc đổi Role |
| Có Role đủ quyền vẫn 403 | Bị **deny override** riêng → `GET /api/Permission/user/{userId}` kiểm tra, PUT gỡ deny |
| API Asset 401/403 | Asset cũng cần JWT + permission → gắn Bearer cho mọi request |
| CORS chặn | Origin ngoài whitelist → báo BE thêm |
