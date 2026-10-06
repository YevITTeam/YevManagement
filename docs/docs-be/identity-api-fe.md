# identity-api-fe.md — API Identity cho Frontend

> Hợp đồng API cho đội FE (login + quản trị user/role). Implementation: [identity-module.md](identity-module.md). Module Asset: [asset-api-fe.md](asset-api-fe.md) · Module Attendance: [attendance-api-fe.md](attendance-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8081` (theo `CompanySystem.HostApi/Properties/launchSettings.json` — đây là nguồn chuẩn; các giá trị cũ `http://localhost:5000` và `http://10.45.1.181:8080` đã không còn dùng, port đổi từ `8080` ngày 2026-08-26) · Scalar UI `/scalar/v1`.
- **CORS**: whitelist ở policy `AllowNextJs` (`CompanySystem.HostApi/Program.cs`, `AllowCredentials`): `localhost:3000`, `localhost:8000`, `10.45.1.155:3000`, `10.45.1.181:3000`, `10.45.1.49` (`:8000`/`:80`/không port), `http://intra.yev.vn`. Origin khác → báo BE thêm whitelist.
- Envelope `ApiResponse<T>` + cách đọc `data`/`errors` giống Asset — xem [asset-api-fe.md §1](asset-api-fe.md).
- `UserDto.email` = **email chính** của user (null khi chưa có email nào) — trả về ở `windows-login` (mục 2) và `get-all-users-with-roles` (mục 4.1). Admin quản lý danh sách email + email nhận theo module ở §4.11.

- **Cập nhật 2026-08-01**: thêm `GET /api/Auth/me` (mục 2b) — lấy lại hồ sơ + **gia hạn JWT bằng chính token đang có**, không cần handshake Negotiate. FE chỉ gọi `windows-login` khi **chưa có** token.
- **Cập nhật 2026-08-21**: thêm `PUT /api/Auth/update-user-fullname` (mục 4.2b) — Admin sửa **CHỈ** tên hiển thị của 1 user đã tồn tại (`userName`/`deviceName` vẫn không sửa được qua API nào).

## 1. Auth
| Endpoint | Cơ chế |
|---|---|
| `POST /api/Auth/windows-login` | **Windows Negotiate** (IWA), không dùng Bearer |
| `POST /api/Auth/login` | Public, body `{userName, password}` — BE tự bind AD (§2c) |
| `GET /api/Auth/me` | **JWT Bearer** (chỉ cần đã đăng nhập, không cần permission) |
| Tất cả còn lại (Identity + Asset) | **JWT Bearer** + user phải có **permission** cụ thể (không phải check "role Admin") |

## 2. Login — `POST /api/Auth/windows-login`
Không phải username/password — xác thực qua **Windows Negotiate** dựa phiên Windows của máy client (phải trong domain AD). **Không có body request.**

```js
const res = await fetch("http://10.45.1.155:8081/api/Auth/windows-login", {
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
- **`email`** — email chính của user, nullable. User chưa có email nào thì lần đăng nhập kế tiếp BE tự lấy thuộc tính AD `mail` làm email chính; từ khi đã có email, chỉ Admin đổi được qua §4.11 (đăng nhập không ghi đè). Người dùng **không** tự sửa được.
- `windows-login` có **side-effect ghi DB** (IP + DeviceName + email AD nếu user chưa có email nào) nhưng idempotent.
- `token` hết hạn **120 phút** → 401. Gia hạn bằng `GET /api/Auth/me` (mục 2b), chỉ khi không còn token hợp lệ mới phải gọi lại `windows-login`.
- **Permission tự refresh mỗi request** — Admin đổi permission Role có hiệu lực ngay request sau, không cần login lại. `user.permissions` lúc login chỉ là snapshot.
- **JWT cũng có claim `Email`** (nếu có giá trị, cùng cách claim `FullName` đã có) — nhưng FE không cần tự decode JWT, dùng thẳng `data.user.email` ở trên là đủ.

Request sau: `headers: { Authorization: 'Bearer ${token}' }`.

## 2b. Lấy lại phiên & gia hạn token — `GET /api/Auth/me`
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

**Dữ liệu trả về luôn là bản mới nhất.** JWT **không chứa permission** — FE/mobile lấy danh sách quyền từ
`data.user.permissions` của `windows-login` / `login` / `qr-login` / `/Auth/me`, đừng giải mã JWT để đọc quyền.
BE tự xác định permission của mỗi request từ DB (có cache 60s, tự xoá khi Admin đổi quyền), nên quyền vừa
**bị thu hồi** có hiệu lực ngay ở BE; FE chỉ cần gọi `/Auth/me` ("Làm mới quyền") để cập nhật UI.

**Lưu ý bảo mật:** đây là *sliding session* — người dùng còn mở app thì token cứ được gia hạn, không có mốc
buộc xác thực lại Windows. Quyền vẫn luôn theo DB (khoá quyền có hiệu lực gần như tức thì), nhưng tài khoản
AD bị vô hiệu hoá thì phiên đang mở vẫn sống tới khi user đóng app quá 120 phút. Chấp nhận được với app nội bộ;
muốn chặt hơn thì phải thêm mốc buộc `windows-login` lại (chưa làm).

## 2c. Đăng nhập bằng form tự viết — `POST /api/Auth/login`
Dùng cho trang `/login` tự viết ở FE — thay thế popup gốc "Windows Security" mà `windows-login`
(Negotiate) tự bật, không custom UI/thông báo lỗi được. **Vẫn xác thực bằng Windows Authentication
thật sự**: BE tự bind username/password vào AD, không tự chế hệ mật khẩu riêng, không lưu password.

```js
const res = await fetch("http://10.45.1.155:8081/api/Auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userName: "n.truong.da.pcd.it", password: "..." }) // userName KHÔNG kèm domain
});
```
- Response `data` **shape y hệt `windows-login`** (`{ user, token }`, xem mục 2) — cùng cách lưu
  `token`, cùng cách dùng `Authorization: Bearer <token>` cho request sau.
- Sai username hoặc sai password → `isSuccess: false`, message chung
  "Tên đăng nhập hoặc mật khẩu không đúng." (không tiết lộ username có tồn tại hay không).
- Không cần `credentials: "include"` (không phải Negotiate) — gửi JSON body bình thường.
- **Bảo mật:** password đi trong body JSON qua mạng (LAN nội bộ, hiện chưa bật HTTPS ở production) —
  khác NTLM cũ (challenge-response, không gửi password thô). Đã chấp nhận rủi ro này cho môi trường
  LAN nội bộ hiện tại; nếu đổi sang mạng rộng hơn cần bật HTTPS trước.
- FE nên giữ thêm nút gọi thẳng `windows-login` (Negotiate) làm lựa chọn phụ cho máy đã có SSO — đăng
  nhập 1 chạm không cần gõ mật khẩu, xem [identity-module.md §5.4](identity-module.md).

## 2d. Đăng nhập bằng mã QR — `POST /api/Auth/qr-login` (app Flutter YEV Scan)
`[AllowAnonymous]`, body `{ "code": "<nội dung QR quét được>" }` (cả chuỗi `YEVQR1:...`, có hay không tiền tố
đều được). Response `data` **shape y hệt `/Auth/login`** (`{ user, token }`) — lưu `token`, gắn
`Authorization: Bearer`, gia hạn bằng `GET /Auth/me` như bình thường.
- Mã sai hoặc đã bị Admin thu hồi → HTTP 400, `isSuccess:false`, message "Mã QR không hợp lệ hoặc đã bị thu hồi."
  → app xoá mã đã lưu (nếu có) và bắt quét lại / đăng nhập bằng mật khẩu.
- Mã **dài hạn, dùng nhiều lần**, không tự hết hạn — chỉ mất hiệu lực khi Admin tạo mã mới hoặc thu hồi.
  QR **không chứa user id**, là mã ngẫu nhiên; coi như mật khẩu.
- Chi tiết thiết kế: [identity-module.md §5.8](identity-module.md).

## 3. Phân quyền hiển thị UI
Dùng **`user.permissions`** (mảng `Module.Entity.Action`) để bật/tắt tính năng — **không** dùng `user.roles`. FE ẩn/hiện nút theo `user.permissions.includes(code)`; BE luôn enforce lại (thiếu permission → **403**). `user.permissions` đã là danh sách hiệu lực cuối (đã áp override). Lấy toàn bộ mã qua `GET /api/Permission/all` (mục 4.7). **Chỉ `Admin` seed full quyền**, 3 role còn lại cần Admin tự gán.

## 4. Quản trị User & Role
Cần `Authorization: Bearer` + permission tương ứng (thiếu token→401, thiếu permission→403).

- **4.1 `GET /api/Auth/get-all-users-with-roles?roleId=`** (`Identity.User.View`) → `[{id, userName, fullName, deviceName, email, roles:[]}]` (`email` = email chính, xem mục 2). `roleId` optional (mới 2026-07-16) — lọc user thuộc Role đó; không truyền → trả toàn bộ. Không phân trang. Lưu ý danh sách này **không trả `permissions`** (khác `windows-login`) — luôn là mảng rỗng nếu FE cố đọc.
- **4.2 `POST /api/Auth/update-user-roles`** (`Identity.User.UpdateRoles`) — body `{userId, roleIds:[1,2]}`. `roleIds` = **toàn bộ** danh sách cuối (gửi thiếu = gỡ role đó).
- **4.2b `PUT /api/Auth/update-user-fullname`** (`Identity.User.UpdateFullName`, mới 2026-08-21) — body `{userId, fullName}`. Sửa **CHỈ** tên hiển thị (`fullName`) của 1 user đã tồn tại — **không** có cách sửa `userName` (định danh đăng nhập Windows) hay `deviceName` qua API nào cả, có chủ đích (khớp login chỉ theo `userName` suông, xem mục 2). 400 nếu `fullName` rỗng, 404 nếu `userId` sai. Response `data` = `UserDto` đã cập nhật.
- **4.3 `GET /api/Auth/get-all-roles`** (`Identity.Role.View`) → `[{id, roleName, description}]`.
- **4.4 `POST /api/Auth/create-role`** (`Identity.Role.Create`) — `{roleName, description}`, 400 nếu trống/trùng.
- **4.5 `PUT /api/Auth/update-role/{roleId}`** (`Identity.Role.Update`) — `{roleName, description}`, 400 nếu roleId sai.
- **4.6 `DELETE /api/Auth/delete-role/{roleId}`** (`Identity.Role.Delete`) — xóa mềm.
- **4.7 Permission theo Role** (`/api/Permission`):
  - `GET /all` (`Identity.Permission.View`) → nhóm 2 cấp: `[{module, entities:[{entity, permissions:[{id,code,module,description}]}]}]`. Entity tách từ giữa `code`. FE flatten: `entities.flatMap(e=>e.permissions)`.
  - `GET /role/{roleId}` (`Identity.Permission.View`) → `PermissionDto[]` phẳng đang gán.
  - `PUT /role/{roleId}` (`Identity.Role.Update`) — body `[1,2,5,8]` **toàn bộ** Id cuối (gửi thiếu = gỡ). Không có API CRUD Permission (cố định).
- **4.8 Override theo User** (`/api/Permission/user/{userId}`): dùng khi 1 người cần quyền khác Role (tránh tạo Role mới):
  - `GET /user/{userId}` → override đang áp: `[{permissionId, code, ..., isGranted, isAutoGranted}]` (`isGranted`: `false`=thu hồi, `true`=cấp thêm; **`isAutoGranted` mới 2026-08-10** — `true` = dòng do Attendance `JobTitlePermission` tự động cấp theo Chức vụ đang giữ, KHÔNG phải Admin cấp tay, xem `attendance-module.md` §Cây chức vụ mục "Quyền theo Chức vụ").
  - `GET /user/{userId}/effective` → permission hiệu lực cuối (đã áp override, gồm cả phần tự động cấp), shape như `GET /all` phẳng.
  - `PUT /user/{userId}` (`Identity.User.UpdatePermissions`) — body `{grantPermissionIds:[12], denyPermissionIds:[5,8]}` **toàn bộ override THỦ CÔNG cuối** (2026-08-10, đổi hành vi: trước đó là toàn bộ override nói chung). 400 nếu 1 id ở cả 2 mảng. Không cần login lại. **Chỉ xoá/ghi lại phần `isAutoGranted=false`** — permission đang tự động cấp theo Chức vụ (`isAutoGranted=true`) không nằm trong 2 mảng này thì được **giữ nguyên**, không bị mất khi Admin lưu màn "Tuỳ chỉnh quyền" cho lý do khác. Nếu 1 id trong `grantPermissionIds`/`denyPermissionIds` trùng đúng permission đang `isAutoGranted=true` — coi là Admin **chiếm quyền thủ công** dòng đó (ghi đè `isGranted` + đổi `isAutoGranted=false`), từ đó dòng này không còn bị đồng bộ tự động theo Chức vụ nữa. FE (`UserPermissionOverrideManager.tsx`) chỉ đưa override `isAutoGranted=false` vào state chỉnh/gửi lên — permission tự động cấp hiện dạng nhãn riêng "Tự động (Chức vụ)", không đi vào 2 mảng trừ khi Admin chủ động bấm đổi.
- **4.9 `POST /api/Auth/create-user`** (`Identity.User.Create`) — pre-provision trước khi người dùng login lần đầu. Body `{userName[Required], deviceName?, fullName?, roleIds?}`. 400 nếu thiếu/trùng `userName` hoặc `roleIds` sai. `deviceName` chỉ tham khảo (khớp login chỉ theo `userName`).

- **4.10 Mã QR đăng nhập** (`/api/LoginQr`, **1 permission `Identity.LoginQr.Manage`** cho cả nhóm — chỉ Admin):
  - `GET /api/LoginQr` → `[{userId, createdAt, lastUsedAt, useCount}]` — user đang có mã hoạt động.
  - `POST /api/LoginQr/{userId}` → `{userId, userName, fullName, qrPayload, createdAt}`. Tạo mã mới và **vô hiệu
    mã cũ**. `qrPayload` là chuỗi cần mã hoá thành ảnh QR (FE dùng `qrcode`); **chỉ có trong response này**, BE
    chỉ lưu hash nên không lấy lại được. 404 nếu `userId` sai.
  - `DELETE /api/LoginQr/{userId}` → thu hồi; 400 nếu user chưa có mã hoạt động.
  - `GET /api/LoginQr/{userId}/logs` → 50 log gần nhất `[{id, userId, action, actorUserId, actorName, ipAddress,
    userAgent, note, createdAt}]`, `action` ∈ `Created|Revoked|LoginSuccess|LoginFailed`, mới nhất trước.
  - FE: nút "QR" trên mỗi dòng `UserRoleModal` → `LoginQrDialog.tsx`.

- **4.11 Email người dùng** (`/api/UserEmail`, **1 permission `Identity.UserEmail.Manage`** — chỉ Admin). Mọi endpoint ghi
  trả lại toàn bộ `UserEmailOverviewDto` mới:
  `{userId, userName, fullName, emails:[{id, email, source, isPrimary, note, createdAt}], modules:[{moduleCode, moduleName, isApplied, userEmailId}]}`.
  `source`: `0`=AD (`mail`), `1`=Alias AD (`proxyAddresses`), `2`=Tanium, `3`=Nhập tay. `modules[].userEmailId = null` →
  module gửi về email chính. `isApplied=false` → module chưa đọc cấu hình này (hiện: Workflow), lưu được nhưng chưa có tác dụng.
  - `GET /user/{userId}` → overview.
  - `GET /user/{userId}/suggestions` → `[{email, source, note, alreadyAdded}]` — mail + alias trên AD (`source` 0/1) và email của các máy mà Tanium báo user này đăng nhập gần nhất (`source` 2, `note` ghi mã máy).
  - `POST /user/{userId}` — body `{email[Required, EmailAddress, ≤255], source (mặc định 3), note?, isPrimary}`. Email đầu tiên
    luôn thành email chính. 400 nếu trùng.
  - `DELETE /user/{userId}/{userEmailId}` — 400 nếu xoá email chính khi còn email khác (phải đổi email chính trước).
    Xoá email đang được gán cho module → module quay về email chính.
  - `PUT /user/{userId}/{userEmailId}/primary` — đặt email chính (đồng thời cập nhật `UserDto.email`).
  - `PUT /user/{userId}/modules` — body `{items:[{moduleCode, userEmailId|null}]}` = **toàn bộ** cấu hình cuối. 400 nếu module
    không hỗ trợ, trùng module, hoặc email không thuộc user.
  - FE: nút "Email" trên mỗi dòng `UserRoleModal` → `UserEmailDialog.tsx` (biểu tượng màu cam khi user chưa có email).

## 5. Tổng hợp endpoint
| Method | Route | Permission |
|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate |
| POST | `/api/Auth/login` | Public — tự bind AD (§2c) |
| POST | `/api/Auth/qr-login` | Public — mã QR (§2d) |
| GET | `/api/Auth/me` | Bearer (không cần permission) |
| POST | `/api/Auth/create-user` | `Identity.User.Create` |
| GET | `/api/Auth/get-all-users-with-roles` | `Identity.User.View` |
| POST | `/api/Auth/update-user-roles` | `Identity.User.UpdateRoles` |
| PUT | `/api/Auth/update-user-fullname` | `Identity.User.UpdateFullName` |
| GET | `/api/Auth/get-all-roles` | `Identity.Role.View` |
| POST | `/api/Auth/create-role` | `Identity.Role.Create` |
| PUT | `/api/Auth/update-role/{roleId}` | `Identity.Role.Update` |
| DELETE | `/api/Auth/delete-role/{roleId}` | `Identity.Role.Delete` |
| GET/POST/DELETE | `/api/LoginQr[/{userId}[/logs]]` | `Identity.LoginQr.Manage` (§4.10) |
| GET/POST/PUT/DELETE | `/api/UserEmail/user/{userId}[...]` | `Identity.UserEmail.Manage` (§4.11) |
| GET | `/api/Permission/all` | `Identity.Permission.View` |
| GET/PUT | `/api/Permission/role/{roleId}` | View / `Identity.Role.Update` |
| GET | `/api/Permission/user/{userId}[/effective]` | `Identity.Permission.View` |
| PUT | `/api/Permission/user/{userId}` | `Identity.User.UpdatePermissions` |

## 6. Lỗi thường gặp
| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `windows-login` luôn 401 | Thiếu `credentials:"include"` / máy không trong domain → thêm credentials, test máy joined domain |
| **Trình duyệt hỏi tài khoản domain lặp lại dù vừa nhập đúng** | Đang gọi `windows-login` nhiều lần (mỗi lần = 1 handshake Negotiate). FE đã sửa: còn token thì dùng `GET /Auth/me` (mục 2b). Vẫn còn hỏi ở lần đăng nhập ĐẦU → máy chưa bật SSO cho origin BE: thêm `http://10.45.1.155:8081` vào vùng **Local Intranet** (Internet Options → Security → Local intranet → Sites → Advanced) hoặc policy `AuthServerAllowlist` của Chrome/Edge |
| API 401 dù đã login | Token hết hạn (120') / thiếu header → `GET /Auth/me` gia hạn, hỏng nữa thì `windows-login` |
| API 403 dù token còn hạn | Role thiếu permission → Admin `PUT /api/Permission/role/{roleId}` hoặc đổi Role |
| Có Role đủ quyền vẫn 403 | Bị **deny override** riêng → `GET /api/Permission/user/{userId}` kiểm tra, PUT gỡ deny |
| API Asset 401/403 | Asset cũng cần JWT + permission → gắn Bearer cho mọi request |
| CORS chặn | Origin ngoài whitelist → báo BE thêm |
