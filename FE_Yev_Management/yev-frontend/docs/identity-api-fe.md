# identity-api-fe.md — API Identity cho Frontend

> Hợp đồng API cho đội FE (login + quản trị user/role). Implementation: [identity-module.md](identity-module.md). Module Asset: [asset-api-fe.md](asset-api-fe.md) · Module Attendance: [attendance-api-fe.md](attendance-api-fe.md).

- **Base URL (Dev)**: `http://localhost:5000` · Scalar UI `/scalar/v1`.
- **CORS**: chỉ `http://localhost:3000` + `http://10.45.1.181:3000` (`AllowCredentials`). Origin khác → báo BE thêm whitelist.
- Envelope `ApiResponse<T>` + cách đọc `data`/`errors` giống Asset — xem [asset-api-fe.md §1](asset-api-fe.md).

## 1. Auth
| Endpoint | Cơ chế |
|---|---|
| `POST /api/Auth/windows-login` | **Windows Negotiate** (IWA), không dùng Bearer |
| Tất cả còn lại (Identity + Asset) | **JWT Bearer** + user phải có **permission** cụ thể (không phải check "role Admin") |

## 2. Login — `POST /api/Auth/windows-login`
Không phải username/password — xác thực qua **Windows Negotiate** dựa phiên Windows của máy client (phải trong domain AD). **Không có body request.**

```js
const res = await fetch("http://localhost:5000/api/Auth/windows-login", {
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
    "roles": ["Admin"],              // luôn có ít nhất "Basic"
    "permissions": ["Asset.Device.View", "..."]  // mã hiệu lực (roles + override)
  },
  "token": "eyJ..."  // JWT, dùng cho mọi request sau
}
```
- **Định danh = `UserName` suông.** `DeviceName` chỉ hiển thị (reverse-DNS không ổn định) — FE **đừng** dùng để định danh.
- Lần đầu 1 `UserName` login → server tự tạo user + gán `"Basic"` (không cần "đăng ký"). Nâng quyền: nhờ Admin `update-user-roles` hoặc Admin `create-user` trước (mục 4.9).
- `windows-login` có **side-effect ghi DB** (IP + DeviceName) nhưng idempotent.
- `token` hết hạn **120 phút** → 401, gọi lại `windows-login` (không có refresh-token).
- **Permission tự refresh mỗi request** — Admin đổi permission Role có hiệu lực ngay request sau, không cần login lại. `user.permissions` lúc login chỉ là snapshot.

Request sau: `headers: { Authorization: 'Bearer ${token}' }`.

## 3. Phân quyền hiển thị UI
Dùng **`user.permissions`** (mảng `Module.Entity.Action`) để bật/tắt tính năng — **không** dùng `user.roles`. FE ẩn/hiện nút theo `user.permissions.includes(code)`; BE luôn enforce lại (thiếu permission → **403**). `user.permissions` đã là danh sách hiệu lực cuối (đã áp override). Lấy toàn bộ mã qua `GET /api/Permission/all` (mục 4.7). **Chỉ `Admin` seed full quyền**, 3 role còn lại cần Admin tự gán.

## 4. Quản trị User & Role
Cần `Authorization: Bearer` + permission tương ứng (thiếu token→401, thiếu permission→403).

- **4.1 `GET /api/Auth/get-all-users-with-roles`** (`Identity.User.View`) → `[{id, userName, fullName, deviceName, roles:[]}]`.
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
| API 401 dù đã login | Token hết hạn (120') / thiếu header → login lại |
| API 403 dù token còn hạn | Role thiếu permission → Admin `PUT /api/Permission/role/{roleId}` hoặc đổi Role |
| Có Role đủ quyền vẫn 403 | Bị **deny override** riêng → `GET /api/Permission/user/{userId}` kiểm tra, PUT gỡ deny |
| API Asset 401/403 | Asset cũng cần JWT + permission → gắn Bearer cho mọi request |
| CORS chặn | Origin ngoài whitelist → báo BE thêm |
