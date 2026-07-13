# identity-api-fe.md — Tài liệu API module Identity cho Frontend

> Tài liệu này viết cho đội FE dựng màn hình đăng nhập + quản trị user/role.
> Chỉ mô tả hợp đồng API (request/response, luật nghiệp vụ ảnh hưởng UI) —
> không đi vào chi tiết code backend. Muốn hiểu implementation, xem
> [identity-module.md](identity-module.md). Muốn hiểu module Asset (Device/PC),
> xem [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Development)**: `http://localhost:5000`
- **Swagger/Scalar UI**: `http://localhost:5000/scalar/v1` (chỉ chạy ở Development)
- **CORS**: server chỉ cho phép origin `http://localhost:3000` và
  `http://10.45.1.181:3000` (đã cấu hình `AllowCredentials()`), nếu FE chạy ở
  origin khác cần báo BE thêm vào whitelist (`CompanySystem.HostApi/Program.cs`).
- **Content-Type**: `application/json` cho request có body.

---

## 1. Khác biệt quan trọng so với module Asset

**Cả 2 module Identity và Asset đều bắt buộc JWT Bearer + đủ permission** —
không có endpoint nào mở tự do:

| Endpoint | Cơ chế xác thực |
|---|---|
| `POST /api/Auth/windows-login` | **Windows Negotiate** (IWA) — không dùng Bearer token |
| Tất cả endpoint còn lại (Identity **và** Asset) | **JWT Bearer** + user (qua Role) phải có **permission** cụ thể cho hành động đó (không phải check "role Admin" cứng) — xem mục 3. |

Envelope response (`ApiResponse<T>`) và cách đọc `data`/`errors` **giống hệt**
module Asset — xem [asset-api-fe.md §1.1–1.3](asset-api-fe.md#1-quy-ước-chung--bắt-buộc-đọc-trước-khi-tích-hợp)
nếu chưa đọc.

---

## 2. Luồng đăng nhập — `POST /api/Auth/windows-login`

**Đây không phải login bằng username/password.** Server xác thực người dùng qua
**Windows Negotiate (Kerberos/NTLM)** dựa trên phiên đăng nhập Windows hiện tại
của máy client (máy phải trong domain AD của công ty) — **không có body request**.

### 2.1. Gọi từ trình duyệt (Next.js/fetch)

Browser phải gửi kèm **credentials** để trình duyệt tự động thực hiện handshake
Negotiate với server (giống cách IIS/SharePoint nội bộ hoạt động):

```js
const res = await fetch("http://localhost:5000/api/Auth/windows-login", {
  method: "POST",
  credentials: "include", // BẮT BUỘC — thiếu dòng này sẽ luôn 401
});
const body = await res.json();
```

- Nếu trình duyệt/máy client **không** trong domain hoặc trình duyệt chặn
  Negotiate (một số cấu hình Chrome/Edge cần whitelist domain nội bộ trong
  policy `AuthServerAllowlist`) → request trả **401**, không có `ApiResponse`
  body chuẩn (bị chặn ở tầng auth middleware trước khi vào controller).
- Handshake Negotiate có thể khiến trình duyệt gửi **nhiều request tới cùng
  endpoint này** (2-3 lần) trước khi thành công — đây là hành vi bình thường
  của giao thức, không phải bug, FE không cần xử lý gì thêm (browser tự làm).

### 2.2. Response thành công

```jsonc
// POST /api/Auth/windows-login → data
{
  "user": {
    "id": 12,
    "userName": "YEV\\n.truong.da.pcd.it",
    "fullName": "Truong Nguyen",
    "deviceName": "DESKTOP-ABC123",   // nullable, reverse DNS từ IP — chỉ để hiển thị/tham khảo
    "roles": ["Admin"],                // luôn có ít nhất "Basic" (auto-gán khi user mới)
    "permissions": [                   // mã permission hiệu lực, suy ra từ roles + override riêng
      "Asset.Device.View", "Asset.Device.Create", "Identity.Role.View", "..."
    ]
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."   // JWT, dùng cho mọi request sau (đã chứa claim Permission)
}
```

- **Định danh đăng nhập là `UserName` suông.** `DeviceName` chỉ mang tính hiển
  thị/tham khảo (resolve qua reverse-DNS mỗi lần login, server tự refresh nếu
  ra giá trị khác, bỏ qua nếu resolve thất bại) — FE **không** nên dùng field
  này để phân biệt/định danh gì cả, vì reverse-DNS không ổn định 100% trong môi
  trường thật.
- **Lần đầu 1 user Windows đăng nhập** (chưa từng có `UserName` này trong DB) →
  server **tự động tạo user mới** trong `YevIdentityManagement`, gán sẵn role
  `"Basic"` — không cần bước "đăng ký" riêng. Các lần đăng nhập sau (từ bất kỳ
  máy nào) đều khớp về **đúng 1** dòng user đó, dùng chung 1 bộ Role. Muốn nâng
  quyền (vd lên `Admin`) phải nhờ 1 Admin khác gọi `update-user-roles` (mục
  4.2), hoặc **Admin tạo trước** user kèm Role mong muốn qua `create-user` (mục
  4.9) trước khi người dùng đăng nhập lần đầu.
- Mỗi lần gọi `windows-login` server cũng **ghi/cập nhật** IP + `DeviceName`
  của lần đăng nhập gần nhất — **không phải API read-only**, gọi nhiều lần vẫn
  an toàn (idempotent) nhưng có side-effect ghi DB.
- `token` hết hạn sau **120 phút** (`JwtSettings:ExpiryMinutes`). Hết hạn → mọi
  request dùng token cũ trả 401, FE phải gọi lại `windows-login` để lấy token
  mới (không có endpoint refresh-token riêng).
- **Permission tự refresh mỗi request** — nếu Admin vừa đổi tập permission của
  1 Role, user thuộc role đó có hiệu lực ngay ở request tiếp theo, **không
  cần** gọi lại `windows-login`. `user.permissions` trả về lúc login chỉ là
  snapshot tại thời điểm đó — nếu cần permission mới nhất để hiển thị UI
  (không phải để enforce, BE luôn tự check lại), FE có thể gọi lại
  `windows-login` hoặc tự decode JWT mới nếu có.

### 2.3. Dùng token cho các request sau

```js
fetch("http://localhost:5000/api/Auth/get-all-roles", {
  headers: { Authorization: `Bearer ${token}` },
});
```

Lưu `token` ở đâu (localStorage/cookie/memory) là quyết định của FE, BE không
ràng buộc.

---

## 3. Phân quyền hiển thị UI

`user.roles` vẫn là mảng string tên role (vd `["Basic"]`, `["Admin", "Basic"]`)
— dùng để hiển thị/quản lý, **không dùng để quyết định bật/tắt tính năng**.
Việc đó dựa vào **`user.permissions`** — mảng mã permission dạng
`Module.Entity.Action` (vd `"Asset.Device.Delete"`, `"Identity.Role.Create"`).

FE tự quyết định ẩn/hiện nút bấm/menu dựa trên `user.permissions.includes(code)`
— BE **không** có endpoint "check quyền" riêng, luôn tự enforce lại ở tầng API
(gọi 1 hành động mà thiếu permission tương ứng → 403, không phải chỉ ẩn UI).
`user.permissions` đã là danh sách **hiệu lực cuối cùng** (base theo Role, đã
cộng/trừ override riêng theo User nếu có — xem mục 4.8), FE không cần tự tính lại.
Danh sách đầy đủ mã permission theo module/entity xem
[identity-module.md §9](identity-module.md#9-phân-quyền-chi-tiết-rbac--permission);
lấy toàn bộ danh sách này qua `GET /api/Permission/all` (mục 4.7) để dựng màn
"quản lý phân quyền" (checkbox permission theo từng Role, hoặc override riêng
theo User ở mục 4.8).

Role hiện có trong DB (seed sẵn, có thể có thêm qua `create-role`): `Basic`,
`Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiết bị`. **Chỉ `Admin` được seed sẵn
full quyền** — 3 role còn lại chưa có permission nào, cần Admin tự gán qua
`PUT /api/Permission/role/{roleId}` (mục 4.7).

---

## 4. Quản trị User & Role (yêu cầu permission tương ứng)

Tất cả endpoint dưới đây cần header `Authorization: Bearer <token>` **và**
user phải có permission tương ứng (mặc định chỉ `Admin` có sẵn, xem mục 3) —
thiếu token → 401, có token nhưng thiếu permission → 403.

### 4.1. Danh sách user + role — `GET /api/Auth/get-all-users-with-roles`

Permission: `Identity.User.View`.

```jsonc
// data[]
[
  { "id": 12, "userName": "YEV\\n.truong.da.pcd.it", "fullName": "Truong Nguyen", "deviceName": "DESKTOP-ABC123", "roles": ["Admin"] }
]
```

### 4.2. Gán role cho user — `POST /api/Auth/update-user-roles`

Permission: `Identity.User.UpdateRoles`.

```jsonc
// body
{
  "userId": 12,
  "roleIds": [1, 2]   // Id thật lấy từ GET /api/Auth/get-all-roles, GỬI ĐỦ danh sách role cuối cùng (không phải chỉ phần thêm/bớt)
}
```

`roleIds` là **toàn bộ** danh sách role sau cùng của user đó (giống cơ chế
`sync` ở `DeviceSoftware` bên Asset) — gửi thiếu 1 role cũ mà không có trong
mảng nghĩa là gỡ role đó khỏi user.

### 4.3. Danh sách role — `GET /api/Auth/get-all-roles`

Permission: `Identity.Role.View`.

```jsonc
// data[]
[ { "id": 1, "roleName": "Admin", "description": "Quản trị hệ thống" } ]
```

### 4.4. Tạo role — `POST /api/Auth/create-role`

Permission: `Identity.Role.Create`.

```jsonc
// body
{ "roleName": "Kế toán", "description": "Phòng kế toán" }
// → 400 nếu roleName trống hoặc đã tồn tại
```

### 4.5. Sửa role — `PUT /api/Auth/update-role/{roleId}`

Permission: `Identity.Role.Update`.

```jsonc
// body (không cần gửi id, đã có trên URL)
{ "roleName": "Kế toán", "description": "Đã cập nhật mô tả" }
// → 400 "Không tìm thấy quyền để cập nhật." nếu roleId sai
```

### 4.6. Xoá role — `DELETE /api/Auth/delete-role/{roleId}`

Permission: `Identity.Role.Delete`. Xoá mềm (`IsDeleted=true`). → 400 "Không tìm thấy quyền để xóa." nếu roleId sai.

### 4.7. Quản lý permission theo Role — `/api/Permission`

Dùng để dựng màn "Phân quyền chi tiết": chọn 1 Role, tick các permission muốn
cấp, lưu lại.

**`GET /api/Permission/all` trả về nhóm 2 cấp Module > Entity**, permission:
`Identity.Permission.View`. `Entity` được server tự tách từ đoạn giữa của
`code` (dạng `Module.Entity.Action`, vd `Asset.Device.View` → Entity `Device`).
Dùng để dựng UI dạng cây/collapsible (cấp 1: Module, cấp 2: Entity, cấp 3:
checkbox từng permission) thay vì phải tự group lại 1 mảng ~53 dòng phẳng:

```jsonc
// GET /api/Permission/all → data — List<PermissionModuleGroupDto>
[
  {
    "module": "Asset",
    "entities": [
      {
        "entity": "Device",
        "permissions": [
          { "id": 1, "code": "Asset.Device.View", "module": "Asset", "description": "Xem danh sách / chi tiết thiết bị" },
          { "id": 2, "code": "Asset.Device.Create", "module": "Asset", "description": "Thêm thiết bị" }
        ]
      },
      { "entity": "Branch", "permissions": [ /* ... */ ] }
      // ... các entity khác trong module Asset
    ]
  },
  {
    "module": "Identity",
    "entities": [
      { "entity": "Role", "permissions": [ /* ... */ ] },
      { "entity": "Permission", "permissions": [ /* ... */ ] }
    ]
  }
  // tổng cộng vẫn đúng 53 permission, chỉ đổi cách gói — flatten lại
  // (entities.flatMap(e => e.permissions)) nếu FE cần danh sách phẳng
]
```

**Các endpoint permission khác vẫn trả mảng phẳng `List<PermissionDto>`**
(không đổi theo `GET /all`):

```jsonc
// GET /api/Permission/role/{roleId} → data[] — permission ĐANG được gán cho role này, permission: Identity.Permission.View
[ { "id": 1, "code": "Asset.Device.View", "module": "Asset", "description": "..." } ]

// PUT /api/Permission/role/{roleId} — permission: Identity.Role.Update
// body: TOÀN BỘ danh sách Id permission sau cùng (giống cơ chế update-user-roles — gửi thiếu 1 Id cũ = gỡ quyền đó)
[1, 2, 5, 8]
```

**Không có** API tạo/sửa/xoá `Permission` — danh sách 53 mã là cố định (seed qua
migration BE), FE chỉ đọc (`GET /all`) và gán/gỡ theo Role (`GET`/`PUT /role/{roleId}`).

### 4.8. Override permission riêng theo User — `/api/Permission/user/{userId}`

Dùng khi 1 nhân viên cụ thể cần quyền **khác** so với Role đang gán (tránh phải
tạo hẳn 1 Role mới chỉ cho 1 người) — ví dụ: user thuộc Role "Quản lý PC" (có
sẵn quyền xem Thiết bị) nhưng muốn **thu hồi riêng** quyền xem Thiết bị của
đúng người này, hoặc **cấp thêm riêng** 1 quyền mà Role của họ không có.

```jsonc
// GET /api/Permission/user/{userId} → data[] — override ĐANG áp dụng cho user này (permission: Identity.Permission.View)
[
  { "permissionId": 5, "code": "Asset.Device.View", "module": "Asset", "description": "...", "isGranted": false }
  // isGranted=false → đang bị THU HỒI riêng dù Role có cấp
  // isGranted=true  → đang được CẤP THÊM riêng dù Role không cấp
]

// GET /api/Permission/user/{userId}/effective → data[] — permission HIỆU LỰC cuối cùng (đã cộng/trừ override), cùng shape GET /all (permission: Identity.Permission.View)
[
  { "id": 1, "code": "Asset.Branch.View", "module": "Asset", "description": "..." }
  // danh sách này mới là "user thực sự làm được gì" — dùng để preview trước khi lưu, hoặc audit
]

// PUT /api/Permission/user/{userId} — permission: Identity.User.UpdatePermissions
// body: TOÀN BỘ override sau cùng (thay thế hết override cũ, giống cơ chế PUT /role/{roleId})
{
  "grantPermissionIds": [12],      // cấp thêm riêng permission id=12
  "denyPermissionIds": [5, 8]      // thu hồi riêng permission id=5, id=8 (dù Role đang cấp)
}
// → 400 nếu 1 permission id xuất hiện ở CẢ 2 mảng cùng lúc (vô nghĩa)
```

**Không cần user đăng nhập lại** — permission hiệu lực tự refresh ngay request
tiếp theo (cùng cơ chế với đổi permission theo Role, xem mục 2.2).

### 4.9. Tạo user thủ công (pre-provision) — `POST /api/Auth/create-user`

Permission: `Identity.User.Create`. Dùng khi Admin muốn **chuẩn bị trước** 1
user cho 1 nhân viên cụ thể — ví dụ nhân viên mới sắp nhận máy — **trước khi**
người đó từng đăng nhập Windows lần nào. Khi họ đăng nhập lần đầu, hệ thống
nhận diện khớp theo `userName` và dùng ngay Role đã gán ở đây, không rơi vào
mặc định `"Basic"` (xem cơ chế khớp ở mục 2.2).

```jsonc
// body
{
  "userName": "YEV\\nv.a",          // Windows username đầy đủ (kèm domain nếu có)
  "deviceName": "YDC-1877",         // optional — chỉ để tham khảo/hiển thị, không dùng để khớp login
  "fullName": "Nguyễn Văn A",       // optional
  "roleIds": [3]                    // optional, Id thật lấy từ GET /api/Auth/get-all-roles — để trống thì user này coi như Basic khi đăng nhập
}

// → 400 nếu thiếu userName, nếu userName đã tồn tại, hoặc roleIds chứa Id
//   không tồn tại/đã bị xoá mềm
```

> `deviceName` không phải "chìa khoá" đăng nhập — nhập gì hay để trống cũng
> không ảnh hưởng việc khớp user lúc login thật (chỉ khớp theo `userName`). Lý
> do: reverse-DNS hostname server tự nhận diện lúc login không ổn định (NAT,
> nhiều PTR record...), từng khiến hệ thống tạo trùng user liên tục dù cùng 1
> người 1 máy — xem chi tiết ở [identity-module.md](identity-module.md) §5.

---

## 5. Tổng hợp endpoint (tra cứu nhanh)

| Method | Route | Permission | Mô tả |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate (không phải Bearer) | Đăng nhập → JWT + profile (kèm `permissions`) |
| POST | `/api/Auth/create-user` | `Identity.User.Create` | Tạo user thủ công (pre-provision UserName+Role, DeviceName chỉ tham khảo) |
| GET | `/api/Auth/get-all-users-with-roles` | `Identity.User.View` | Danh sách user + role |
| POST | `/api/Auth/update-user-roles` | `Identity.User.UpdateRoles` | Gán role cho 1 user (gửi đủ danh sách cuối) |
| GET | `/api/Auth/get-all-roles` | `Identity.Role.View` | Danh sách role |
| POST | `/api/Auth/create-role` | `Identity.Role.Create` | Tạo role |
| PUT | `/api/Auth/update-role/{roleId}` | `Identity.Role.Update` | Sửa role |
| DELETE | `/api/Auth/delete-role/{roleId}` | `Identity.Role.Delete` | Xoá mềm role |
| GET | `/api/Permission/all` | `Identity.Permission.View` | Toàn bộ permission hệ thống, nhóm 2 cấp Module > Entity (`PermissionModuleGroupDto[]` — các endpoint permission khác vẫn phẳng) |
| GET | `/api/Permission/role/{roleId}` | `Identity.Permission.View` | Permission hiện tại của 1 role |
| PUT | `/api/Permission/role/{roleId}` | `Identity.Role.Update` | Gán lại permission cho role |
| GET | `/api/Permission/user/{userId}` | `Identity.Permission.View` | Override (grant/deny) hiện có của 1 user |
| GET | `/api/Permission/user/{userId}/effective` | `Identity.Permission.View` | Permission hiệu lực cuối cùng của 1 user |
| PUT | `/api/Permission/user/{userId}` | `Identity.User.UpdatePermissions` | Gán lại override riêng cho user |

---

## 6. Lỗi thường gặp khi FE tích hợp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `windows-login` luôn trả 401 | Thiếu `credentials: "include"` trên fetch, hoặc máy/trình duyệt client không nằm trong domain AD | Thêm `credentials: "include"`; test bằng máy đã join domain |
| Gọi API nào đó trả 401 dù đã đăng nhập | Token hết hạn (120 phút) hoặc thiếu header `Authorization` | Gọi lại `windows-login` lấy token mới |
| Gọi API nào đó trả 403 dù token còn hạn | User đăng nhập không có permission cho hành động đó (Role của user chưa được gán permission tương ứng) | Nhờ 1 Admin gọi `PUT /api/Permission/role/{roleId}` gán thêm permission cho Role của user, hoặc gán user sang Role phù hợp qua `update-user-roles` |
| User rõ ràng đã được gán Role có permission X nhưng vẫn 403 khi gọi hành động cần permission X | User có thể đang bị **deny override riêng** (`UserPermission.IsGranted=false`) đè lên permission mà Role cấp | Gọi `GET /api/Permission/user/{userId}` xem override đang áp dụng; nếu cần khôi phục, `PUT /api/Permission/user/{userId}` với `denyPermissionIds` không còn permission đó |
| Gọi API Asset (Device/Software/IP...) trả 401/403 | Module Asset cũng yêu cầu JWT + permission như Identity, không có endpoint mở tự do (xem mục 1) | Gắn `Authorization: Bearer <token>` cho **mọi** request Asset, đảm bảo Role của user có permission tương ứng |
| Gọi API từ origin khác `localhost:3000`/`10.45.1.181:3000` bị chặn CORS | Origin chưa nằm trong whitelist CORS ở BE | Báo BE thêm origin vào `Program.cs` (`AddCors`) |
