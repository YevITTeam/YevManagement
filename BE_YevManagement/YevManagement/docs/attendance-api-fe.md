# attendance-api-fe.md — API Attendance (Giấy tăng ca) cho Frontend

> Hợp đồng API quản lý Giấy tăng ca (OT Form). Implementation: [attendance-module.md](attendance-module.md).
> Module Identity: [identity-api-fe.md](identity-api-fe.md) · Module Asset: [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8080` (launchSettings hiện trỏ IP này, không phải `localhost:5000`) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Attendance.OTForm.Create`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- Envelope `ApiResponse<T>`, phân trang, mã lỗi HTTP, pattern CRUD cơ bản — giống hệt Asset, xem [asset-api-fe.md §1](asset-api-fe.md#1-quy-ước-chung). Tóm tắt: mọi response bọc `{ isSuccess, message, data, errors, timestamp }`; `grid-list` trả `data.data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **byte[] qua JSON**: field kiểu `byte[]` (chữ ký `SignatureImage`) serialize/deserialize thành **chuỗi base64** — FE convert ảnh (canvas chữ ký, upload file) sang base64 trước khi gửi, và decode base64 → hiển thị `<img src="data:image/png;base64,...">` khi nhận.

## 1. Tổng quan nghiệp vụ (đọc trước khi code màn hình)

Giấy tăng ca mô phỏng phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam), luồng ký duyệt **tuần tự**:

```
Trưởng Group tạo đơn (ký "Người đề nghị" ngay lúc tạo, bắt buộc)
        ↓
Trưởng phòng duyệt (DepartmentManager)      → dừng nếu OtCase.requiredApprovalLevel = DepartmentManager (TH1)
        ↓
Trưởng xưởng duyệt (WorkshopManager)        → dừng nếu = WorkshopManager (TH2)
        ↓
Tổng Giám Đốc duyệt (GeneralDirector)        → luôn là cấp cuối khi cần (TH3)
```

- Mỗi đơn gắn 1 `OtCase` (TH1/TH2/TH3...) — `otCase.requiredApprovalLevel` quyết định cấp nào là **cấp cuối**, đủ cấp đó thì `status → Completed` ngay (không cần đi hết 3 cấp).
- **Ai duyệt được gì**: Trưởng phòng/Trưởng xưởng chỉ duyệt đơn thuộc phạm vi được gán qua `UserApprovalScope` (Group hoặc Department cụ thể) **và** đúng cấp đang chờ. Tổng Giám Đốc **bỏ qua** `UserApprovalScope` — chỉ cần có Role `"Tổng Giám Đốc"`.
- Ở bất kỳ cấp nào, **Reject** dừng hẳn luồng (`status → Rejected`), không đi tiếp.
- Trước khi dùng module này, user (Trưởng Group/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) phải **đã được Admin**: (1) gán đúng Role qua Identity `update-user-roles`, (2) nếu là Trưởng phòng/Trưởng xưởng — được tạo dòng `UserApprovalScope` (mục 5). Chữ ký (`UserSignature`, mục 6) do **chính user** tự đăng ký, không phải Admin làm hộ.

## 2. Enum dùng chung (gửi/nhận là số `int`, FE tự map label)

```js
// ApprovalLevel — Attendance.Domain.Enums.ApprovalLevel
{ 0: "Submitter (Người đề nghị)", 1: "DepartmentManager (Trưởng phòng)",
  2: "WorkshopManager (Trưởng xưởng)", 3: "GeneralDirector (Tổng Giám Đốc)" }

// OtFormStatus — Attendance.Domain.Enums.OtFormStatus
{ 0: "Pending (Chờ Trưởng phòng duyệt)", 1: "ApprovedByDepartment (Chờ Trưởng xưởng duyệt)",
  2: "ApprovedByWorkshop (Chờ Tổng Giám Đốc duyệt)", 3: "Completed (Hoàn tất)", 4: "Rejected (Từ chối)" }
// Lưu ý: status không đi tuần tự 1-1 với ApprovalLevel — nó thể hiện "đã qua cấp nào", xem OtCase.requiredApprovalLevel để biết khi nào dừng sớm ở Completed.

// ApprovalAction — Attendance.Domain.Enums.ApprovalAction (chỉ xuất hiện trong OtFormApprovalHistoryDto.action)
{ 0: "Submitted", 1: "Approved", 2: "Rejected" }

// ScopeType — Attendance.Domain.Enums.ScopeType (chỉ dùng trong UserApprovalScope)
{ 0: "Group", 1: "Department" }
```

## 3. Danh mục CRUD chuẩn

5 entity: `Department`, `Group`, `Reason`, `OtCase`, `Employee`. Đều theo pattern chung (giống Asset):
```
GET /api/{Entity}/grid-list?pageIndex=1&pageSize=50&keyword=   → PagedResponse
GET /api/{Entity}/all                                           → Dto[] (active, cho dropdown)
GET /api/{Entity}/{id}   POST   PUT /{id} (body có Id khớp)    DELETE /{id} (xóa mềm)
```
Permission: `Attendance.{Entity}.{View|Create|Update|Delete}` (tên Entity theo PascalCase ở bảng dưới, VD `Attendance.OtCase.Create`).

### 3.1 Department (Bộ phận) — `/api/Department`
```jsonc
// DepartmentDto
{ "id": 1, "departmentCode": "ASSY", "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": null }
```
POST/PUT body: `departmentCode`[Required], `departmentNameVn`[Required], `departmentNameJp?`. PUT thêm `id` khớp URL.

### 3.2 Group (Nhóm) — `/api/Group` — thuộc 1 Department
```jsonc
// GroupDto
{ "id": 5, "groupCode": "ASSY-01", "groupNameVn": "Nhóm 1", "groupNameJp": null,
  "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp" }
```
POST/PUT body: `groupCode`[Required], `groupNameVn`[Required], `groupNameJp?`, `departmentId`[Required]. `departmentId` sai/không tồn tại → 404.

**Cascading dropdown** (giống `DeviceGroup` bên Asset): `GET /api/Group/by-department/{departmentId}` → `GroupDto[]` lọc theo Department.
1. Dropdown "Bộ phận" ← `GET /api/Department/all`.
2. Dropdown "Nhóm" disable tới khi chọn Bộ phận → gọi `by-department/{id}`.
3. Đổi Bộ phận → xóa lựa chọn Nhóm, gọi lại.

### 3.3 Reason (Lý do) — `/api/Reason`
```jsonc
// ReasonDto
{ "id": 2, "reasonNameVn": "Tăng ca sản xuất gấp", "reasonNameJp": null }
```
POST/PUT: `reasonNameVn`[Required], `reasonNameJp?`.

### 3.4 OtCase (Trường hợp OT — TH1/TH2/TH3) — `/api/OtCase`
```jsonc
// OtCaseDto
{ "id": 1, "code": "TH1", "description": "Ngày thường", "requireSignature": false, "requiredApprovalLevel": 1 }
```
POST/PUT: `code`[Required], `description?`, `requireSignature`(bool), `requiredApprovalLevel`[Required] (enum `ApprovalLevel` §2 — **chỉ nên chọn `1`/`2`/`3`**, không dùng `0=Submitter` làm cấp cuối). Đây là **master data admin cấu hình sẵn** (thường 3 dòng cố định TH1/TH2/TH3), FE màn tạo đơn chỉ cần dropdown chọn từ `/all`.

### 3.5 Employee (Nhân viên) — `/api/Employee` — thuộc 1 Group (bắt buộc)
```jsonc
// EmployeeDto
{ "id": 100, "code": "NV001", "firstName": "Nguyễn Văn", "lastName": "A",
  "monthToDate": 12.5, "yearToDate": 80.0, "groupId": 5, "groupNameVn": "Nhóm 1" }
```
POST/PUT: `code`[Required], `firstName`[Required], `lastName`[Required], `monthToDate`, `yearToDate` (decimal, giờ OT lũy kế — dùng để cảnh báo TH3 vượt 25h/tháng hoặc 300h/năm), `groupId`[Required].

**Chọn nhân viên hàng loạt khi lập đơn**: `GET /api/Employee/by-group/{groupId}` → `EmployeeDto[]` toàn bộ nhân viên nhóm đó (Trưởng Group tick chọn nhiều người cho `CreateOtFormDto.employees`).

## 4. OtForm (`/api/OtForm`) — nghiệp vụ chính

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| POST | `/api/OtForm` | `Attendance.OTForm.Create` | Trưởng Group tạo đơn + ký "Người đề nghị" cùng lúc |
| GET | `/api/OtForm/my-forms?pageIndex=&pageSize=` | `Attendance.OTForm.View` | Đơn do **chính mình** tạo |
| GET | `/api/OtForm/pending-approvals?pageIndex=&pageSize=` | `Attendance.OTForm.Approve` | Đơn đang **chờ chính mình** duyệt (tự lọc scope, xem §1) |
| GET | `/api/OtForm/{id}` | `Attendance.OTForm.View` | Chi tiết đầy đủ 1 đơn |
| POST | `/api/OtForm/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt đơn ở cấp hiện tại |
| POST | `/api/OtForm/{id}/reject` | `Attendance.OTForm.Approve` | Từ chối đơn ở cấp hiện tại (dừng luồng) |

### 4.1 `POST /api/OtForm` — Tạo đơn
```jsonc
// body — CreateOtFormDto
{
  "groupId": 5, "departmentId": 1, "reasonId": 2, "otCaseId": 1,             // [Required]
  "startTime": "17:30:00", "endTime": "19:30:00",                            // TimeOnly, chuỗi "HH:mm:ss"
  "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15",                                    // [Required], DateOnly "yyyy-MM-dd"
  "employees": [                                                             // [Required][MinLength(1)]
    { "employeeId": 100, "startTime": "17:30:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null }
  ],
  "processPart": { "isEat": true, "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null }, // optional, cả object hoặc null
  "submitterSignatureImage": "iVBORw0KGgoAAAANSU..."                          // [Required] base64, chữ ký Người đề nghị
}
```
- `employees[].employeeId` **phải cùng `groupId`** với đơn — khác nhóm → 400 (`DomainException`).
- `submitterSignatureImage` luôn bắt buộc (không phụ thuộc `otCase.requireSignature` — đó là luật riêng cho **cấp duyệt sau**, không áp dụng cho người tạo đơn).
- Response `201 Created` (Location header trỏ `GET /{id}`), `data` = `OtFormDto` (§4.3) đầy đủ luôn — không cần gọi lại `GetById`.

### 4.2 `GET /api/OtForm/my-forms` & `pending-approvals` — Danh sách (`OtFormListItemDto`)
```jsonc
// data.data[]
{ "id": 10, "groupNameVn": "Nhóm 1", "departmentNameVn": "Xưởng lắp ráp", "otCaseCode": "TH1",
  "date": "2026-07-15", "totalHour": 2.0, "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "status": 0 }
```
`pending-approvals` tự xác định "cấp hiện tại" của user gọi API (từ Role + `UserApprovalScope`) — FE **không** truyền tham số lọc cấp, chỉ `pageIndex/pageSize`.

### 4.3 `GET /api/OtForm/{id}` — Chi tiết (`OtFormDto`)
```jsonc
{
  "id": 10, "groupId": 5, "groupNameVn": "Nhóm 1", "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp",
  "reasonId": 2, "reasonNameVn": "Tăng ca sản xuất gấp", "otCaseId": 1, "otCaseCode": "TH1",
  "startTime": "17:30:00", "endTime": "19:30:00", "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15", "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "status": 0,
  "employees": [
    { "employeeId": 100, "employeeCode": "NV001", "fullName": "Nguyễn Văn A",
      "startTime": "17:30:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null }
  ],
  "processPart": { "isEat": true, "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null },   // null nếu tạo đơn không gửi
  "approvalHistories": [
    { "approverUserName": "YEV\\n.van.a", "approvalLevel": 0, "action": 0,
      "comment": null, "hasSignature": true, "signatureImage": "iVBORw0KG...", "actionAt": "2026-07-15T08:00:00Z" }
  ]
}
```
- `approvalHistories` là **audit trail đầy đủ** từng bước ký/duyệt/từ chối — render như timeline dọc trên UI chi tiết đơn (mỗi dòng = 1 cấp đã xử lý, `action` §2 quyết định icon Ký/Duyệt/Từ chối).
- `hasSignature` — cờ tiện dùng để FE quyết định có hiện `<img>` chữ ký hay không **mà không cần** giải mã `signatureImage` trước; `signatureImage` vẫn trả kèm nếu có (base64) để hiện trực tiếp.
- **Suy ra "cấp đang chờ ai duyệt tiếp"** từ `status`: `Pending`(0)→đang chờ Trưởng phòng, `ApprovedByDepartment`(1)→chờ Trưởng xưởng, `ApprovedByWorkshop`(2)→chờ Tổng Giám Đốc, `Completed`(3)/`Rejected`(4)→hết, ẩn nút Duyệt/Từ chối.

### 4.4 `POST /api/OtForm/{id}/approve`
```jsonc
// body — ApproveOtFormDto
{ "comment": null, "signatureImage": "iVBORw0KG..." }   // cả 2 optional...
```
- `signatureImage` **bắt buộc thực tế nếu `otCase.requireSignature = true`** (validate ở Service, không có annotation — sai → 400 message rõ). FE nên đọc `otCase.requireSignature` (từ `otFormDto` không có field này trực tiếp — gọi thêm `GET /api/OtCase/{otCaseId}` hoặc cache list `OtCase` đã load) để quyết định bắt buộc canvas ký hay không.
- Không tự điền `signatureImage` — FE có thể gợi ý lấy từ `GET /api/UserSignature/me` (mục 6) rồi cho user xác nhận/ký lại.
- 400 nếu: đơn đã `Completed`/`Rejected`; user không đúng cấp đang chờ; user không có `UserApprovalScope` khớp `departmentId`/`groupId` của đơn (trừ Tổng Giám Đốc).
- Thành công → đơn tự chuyển `status` kế tiếp hoặc `Completed` nếu vừa đạt `otCase.requiredApprovalLevel`. Response `data: true` — FE tự gọi lại `GET /{id}` để refresh chi tiết.

### 4.5 `POST /api/OtForm/{id}/reject`
```jsonc
// body — RejectOtFormDto
{ "comment": "Thiếu chứng từ, cần xác nhận lại." }   // [Required]
```
`status → Rejected`, dừng hẳn luồng ở bất kỳ cấp nào.

## 5. UserApprovalScope (`/api/UserApprovalScope`) — Admin gán phạm vi duyệt

Dùng để khai báo "user X là Trưởng phòng/Trưởng xưởng phụ trách Group/Department nào" — **bắt buộc có trước** khi Trưởng phòng/Trưởng xưởng duyệt được đơn (Tổng Giám Đốc không cần).

| Method | Route | Permission |
|---|---|---|
| GET | `/grid-list?pageIndex=&pageSize=&keyword=` | `Attendance.UserApprovalScope.View` |
| GET | `/by-user/{userName}` | `Attendance.UserApprovalScope.View` |
| POST | `/` | `Attendance.UserApprovalScope.Create` |
| DELETE | `/{id}` | `Attendance.UserApprovalScope.Delete` |

```jsonc
// UserApprovalScopeDto
{ "id": 1, "userName": "YEV\\n.truong.b", "scopeType": 1, "scopeId": 1,
  "scopeName": "Xưởng lắp ráp", "approvalLevel": 1 }
// POST body — CreateUserApprovalScopeDto: { userName, scopeType, scopeId, approvalLevel } — tất cả [Required]
```
- `scopeType`: `0=Group` (chọn `scopeId` từ `Group.id`), `1=Department` (chọn từ `Department.id`) — §2.
- `approvalLevel`: chỉ dùng `1=DepartmentManager` hoặc `2=WorkshopManager` (Tổng Giám Đốc không tạo dòng này).
- **Không có PUT** — sửa = `DELETE` dòng cũ + `POST` dòng mới.
- Trùng scope (cùng `userName`+`scopeType`+`scopeId`+`approvalLevel`) → 400.

## 6. UserSignature (`/api/UserSignature`) — chữ ký cá nhân

Mỗi user tự đăng ký 1 chữ ký (ảnh) dùng để tham khảo/auto-fill lúc duyệt (không phải nguồn audit — nguồn thật luôn là `OtFormApprovalHistory.signatureImage` snapshot tại thời điểm ký, §4.3).

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/me` | `Attendance.UserSignature.Update` | Xem chữ ký của chính mình |
| PUT | `/me` | `Attendance.UserSignature.Update` | Đăng ký/cập nhật chữ ký của chính mình |
| GET | `/{userName}` | `Attendance.UserSignature.View` | Admin xem chữ ký người khác |

```jsonc
// UserSignatureDto
{ "userName": "YEV\\n.van.a", "signatureImage": "iVBORw0KG...", "updatedAt": "2026-07-14T09:00:00Z" }
// PUT /me body — UpsertUserSignatureDto: { "signatureImage": "..." }  // [Required] base64
```
FE thường có màn "Cài đặt cá nhân → Chữ ký": canvas vẽ tay hoặc upload ảnh → convert base64 → `PUT /me`.

## 7. Tổng hợp endpoint

| Route | Ghi chú |
|---|---|
| `/api/Department`, `/api/Reason`, `/api/OtCase` | CRUD chuẩn (grid-list, all, {id}, POST, PUT, DELETE) |
| `/api/Group` (`?by-department/{id}`) | CRUD + cascading theo Department |
| `/api/Employee` (`by-group/{id}`) | CRUD + liệt kê theo Group |
| `/api/UserApprovalScope` | grid-list, `by-user/{userName}`, POST, DELETE (không PUT) |
| `/api/UserSignature` | `me` (GET/PUT), `{userName}` (GET, admin) |
| `/api/OtForm` | `my-forms`, `pending-approvals`, `{id}`, POST, `{id}/approve`, `{id}/reject` |

## 8. Checklist FE — màn hình chính

**"Tạo đơn tăng ca" (Trưởng Group)**
1. Dropdown Bộ phận → `Department/all`; Nhóm → `Group/by-department/{id}` (thường chỉ 1 nhóm nếu user chỉ quản 1 Group — vẫn để dropdown cho tổng quát); Lý do → `Reason/all`; Trường hợp OT → `OtCase/all`.
2. Bảng chọn nhân viên → `Employee/by-group/{groupId}`, tick nhiều dòng → build `employees[]`.
3. Canvas/upload chữ ký "Người đề nghị" → convert base64 → `submitterSignatureImage`.
4. Submit `POST /api/OtForm` → điều hướng sang màn chi tiết (dùng `data` trả về, không cần gọi lại).

**"Đơn của tôi"** → `GET /my-forms`, click dòng → `GET /{id}` xem chi tiết + timeline `approvalHistories`.

**"Chờ tôi duyệt" (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc)**
1. `GET /pending-approvals` — danh sách đã tự lọc đúng phạm vi/cấp của user đang đăng nhập.
2. Vào chi tiết `GET /{id}` → nút "Duyệt"/"Từ chối".
3. "Duyệt": nếu `otCase.requireSignature` (tra thêm `OtCase/{id}`) → bắt buộc canvas ký (gợi ý load sẵn từ `UserSignature/me`) → `POST /{id}/approve`.
4. "Từ chối": bắt buộc nhập `comment` → `POST /{id}/reject`.
5. Sau khi duyệt/từ chối → gọi lại `GET /{id}` refresh timeline + trạng thái nút.

**"Cài đặt chữ ký"** → `GET /UserSignature/me` hiện preview, canvas vẽ lại → `PUT /me`.

**Admin — "Phân quyền duyệt"** → gán Role (Identity `update-user-roles`) trước, rồi `POST /api/UserApprovalScope` khai báo phạm vi cho từng Trưởng phòng/Trưởng xưởng. Không có màn sửa — xóa + tạo lại.

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `POST /OtForm` 400 "khác nhóm" | 1 `employeeId` trong `employees[]` không cùng `groupId` với đơn → chỉ cho tick nhân viên từ đúng `by-group/{groupId}` đang chọn |
| `POST /{id}/approve` 400 dù đúng Role | Thiếu `UserApprovalScope` khớp `departmentId`/`groupId` của đơn + đúng cấp — báo Admin tạo qua `POST /UserApprovalScope` |
| `POST /{id}/approve` 400 "chữ ký" | `otCase.requireSignature=true` nhưng không gửi `signatureImage` |
| `pending-approvals` luôn rỗng dù có đơn chờ | User Tổng Giám Đốc thiếu Role `"Tổng Giám Đốc"` (case-sensitive, kiểm tra đúng chuỗi), hoặc Trưởng phòng/xưởng thiếu `UserApprovalScope` |
| 401/403 chung | Xem [identity-api-fe.md §6](identity-api-fe.md) |
