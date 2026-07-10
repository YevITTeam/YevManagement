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

Toàn bộ endpoint **Asset** (Device/Software/IP...) hiện đang `[AllowAnonymous]`,
nhưng **toàn bộ endpoint Identity đều yêu cầu xác thực**:

| Endpoint | Cơ chế xác thực |
|---|---|
| `POST /api/Auth/windows-login` | **Windows Negotiate** (IWA) — không dùng Bearer token |
| Tất cả endpoint còn lại (`get-all-users-with-roles`, `create-role`...) | **JWT Bearer**, yêu cầu role `Admin` trong claims |

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
    "deviceName": "DESKTOP-ABC123",   // nullable, reverse DNS từ IP
    "roles": ["Admin"]                 // luôn có ít nhất "Basic" (auto-gán khi user mới)
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."   // JWT, dùng cho mọi request sau
}
```

- **Lần đầu 1 user Windows đăng nhập** → server **tự động tạo** user mới trong
  `YevIdentityManagement`, gán sẵn role `"Basic"` — không cần bước "đăng ký"
  riêng. Muốn nâng quyền (vd lên `Admin`) phải nhờ 1 Admin khác gọi
  `update-user-roles` (xem mục 4).
- Mỗi lần gọi `windows-login` server cũng **ghi/cập nhật** IP + `DeviceName`
  của lần đăng nhập gần nhất — **không phải API read-only**, gọi nhiều lần vẫn
  an toàn (idempotent) nhưng có side-effect ghi DB.
- `token` hết hạn sau **120 phút** (`JwtSettings:ExpiryMinutes`). Hết hạn → mọi
  request dùng token cũ trả 401, FE phải gọi lại `windows-login` để lấy token
  mới (không có endpoint refresh-token riêng).

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

`user.roles` là mảng string tên role (vd `["Basic"]`, `["Admin", "Basic"]`).
FE tự quyết định ẩn/hiện menu quản trị dựa trên mảng này — BE **không** có
endpoint kiểm tra quyền riêng, chỉ chặn ở tầng API (gọi endpoint `Admin` mà
không có role → 401/403, không phải hiển thị UI đẹp).

Role hiện có trong DB (seed sẵn, có thể có thêm qua `create-role`): `Basic`,
`Admin`, `Quản lý Hợp Đồng`, `Quản lý Thiết bị`.

---

## 4. Quản trị User & Role (yêu cầu role `Admin`)

Tất cả endpoint dưới đây cần header `Authorization: Bearer <token>` của 1 user
có role `Admin` — thiếu hoặc sai role → 401.

### 4.1. Danh sách user + role — `GET /api/Auth/get-all-users-with-roles`

```jsonc
// data[]
[
  { "id": 12, "userName": "YEV\\n.truong.da.pcd.it", "fullName": "Truong Nguyen", "deviceName": "DESKTOP-ABC123", "roles": ["Admin"] }
]
```

### 4.2. Gán role cho user — `POST /api/Auth/update-user-roles`

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

```jsonc
// data[]
[ { "id": 1, "roleName": "Admin", "description": "Quản trị hệ thống" } ]
```

### 4.4. Tạo role — `POST /api/Auth/create-role`

```jsonc
// body
{ "roleName": "Kế toán", "description": "Phòng kế toán" }
// → 400 nếu roleName trống hoặc đã tồn tại
```

### 4.5. Sửa role — `PUT /api/Auth/update-role/{roleId}`

```jsonc
// body (không cần gửi id, đã có trên URL)
{ "roleName": "Kế toán", "description": "Đã cập nhật mô tả" }
// → 400 "Không tìm thấy quyền để cập nhật." nếu roleId sai
```

### 4.6. Xoá role — `DELETE /api/Auth/delete-role/{roleId}`

Xoá mềm (`IsDeleted=true`). → 400 "Không tìm thấy quyền để xóa." nếu roleId sai.

---

## 5. Tổng hợp endpoint (tra cứu nhanh)

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/Auth/windows-login` | Negotiate (không phải Bearer) | Đăng nhập → JWT + profile |
| GET | `/api/Auth/get-all-users-with-roles` | Bearer, role `Admin` | Danh sách user + role |
| POST | `/api/Auth/update-user-roles` | Bearer, role `Admin` | Gán role cho 1 user (gửi đủ danh sách cuối) |
| GET | `/api/Auth/get-all-roles` | Bearer, role `Admin` | Danh sách role |
| POST | `/api/Auth/create-role` | Bearer, role `Admin` | Tạo role |
| PUT | `/api/Auth/update-role/{roleId}` | Bearer, role `Admin` | Sửa role |
| DELETE | `/api/Auth/delete-role/{roleId}` | Bearer, role `Admin` | Xoá mềm role |

---

## 6. Lỗi thường gặp khi FE tích hợp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `windows-login` luôn trả 401 | Thiếu `credentials: "include"` trên fetch, hoặc máy/trình duyệt client không nằm trong domain AD | Thêm `credentials: "include"`; test bằng máy đã join domain |
| Gọi `get-all-roles`... trả 401 dù đã đăng nhập | Token hết hạn (120 phút) hoặc thiếu header `Authorization` | Gọi lại `windows-login` lấy token mới |
| Gọi `get-all-roles`... trả 401/403 dù token còn hạn | User đăng nhập không có role `Admin` (mặc định user mới chỉ có `Basic`) | Nhờ 1 Admin khác gọi `update-user-roles` gán thêm role `Admin` |
| Gọi API từ origin khác `localhost:3000`/`10.45.1.181:3000` bị chặn CORS | Origin chưa nằm trong whitelist CORS ở BE | Báo BE thêm origin vào `Program.cs` (`AddCors`) |
