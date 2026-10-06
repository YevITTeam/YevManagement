# attendance-api-fe.md — API Attendance (Giấy tăng ca) cho Frontend

> Hợp đồng API quản lý Giấy tăng ca (OT Form). Implementation: [attendance-module.md](attendance-module.md).
> Module Identity: [identity-api-fe.md](identity-api-fe.md) · Module Asset: [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8081` (lấy từ `launchSettings.json`, xem AGENTS.md) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Attendance.OTForm.Create`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- Envelope `ApiResponse<T>`, phân trang, mã lỗi HTTP, pattern CRUD cơ bản — giống hệt Asset, xem [asset-api-fe.md §1](asset-api-fe.md#1-quy-ước-chung). Tóm tắt: mọi response bọc `{ isSuccess, message, data, errors, timestamp }`; `grid-list` trả `data.data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **byte[] qua JSON**: field kiểu `byte[]` (chữ ký `SignatureImage`) serialize/deserialize thành **chuỗi base64** — FE convert ảnh (**upload file ảnh chữ ký có sẵn** — PNG/JPG chụp/scan chữ ký tay thật, KHÔNG phải vẽ bằng canvas/chuột trên web) sang base64 trước khi gửi, và decode base64 → hiển thị `<img src="data:image/png;base64,...">` khi nhận.

---

## MỤC LỤC ĐỌC NHANH — đọc file này theo lát cắt

> ⚠ **File >120 KB. KHÔNG `Read` cả file** (AGENTS.md §2 luật 7). `Grep` pattern `^#{2,3} ` để lấy mục
> lục kèm số dòng hiện tại → `Read` đúng dải cần. Tra 1 field/endpoint cụ thể thì `Grep` thẳng chuỗi đó.

| Cần gì | Mục |
|---|---|
| Enum (`OtFormStatus`, `OtFormApprovalStepStatus`, `JobTitleTerminalLevel`, `MealTicketType`…) | §2 |
| CRUD danh mục: Department/Group/Reason/OtCase/JobTitle | §3.1–§3.4b |
| **Cây duyệt** (Nhóm / Bộ phận / Chuyền) + Người phụ trách + gán Chức vụ có phạm vi + Quyền theo Chức vụ | §3.4c → §3.4e |
| Employee (+ bảng route) · **lũy kế thật / dự kiến / lịch sử + sửa tay** · mốc OT riêng | §3.5 → §3.5d |
| Import Excel: nhân sự · giới hạn OT · lũy kế tháng · liên kết Identity · nhân sự dưới chuyền | §3.7, §3.7b, §3.8, §3.8b |
| **OtForm**: bảng route · tạo / sửa / xoá đơn | §4, §4.0a → §4.1c |
| **OtForm**: 5 danh sách + bộ lọc chung, badge, lịch mini, `all-forms` | §4.2 → §4.2f |
| **OtForm**: chi tiết đơn (`OtFormDto` đầy đủ) | §4.3 |
| Duyệt / Từ chối / Loại nhân viên / kênh email | §4.4, §4.5, §4.5a, §4.6 |
| Chữ ký cá nhân + xác nhận email · Mật khẩu cấp 2 | §6, §6b, §6c |
| Cấu hình phiếu ăn & giới hạn OT (`AttendanceSetting`) · Lịch ngày nghỉ + Trường hợp OT tự động | §6d, §6d-2 |
| **Đơn tổng** (`OtFormBatch`) | §6e |
| Bảng tổng hợp endpoint · checklist FE · lỗi thường gặp | §7, §8, §9 |
| AI Chat lập đơn (NDJSON stream) | §10 |
| Báo cáo dưới chuyền + export Excel/PDF | §11 |

---

## 1. Cơ chế duyệt hiện hành (đọc trước khi code màn hình)

> Trạng thái đúng của từng endpoint nằm ở chính mục mô tả nó (§2 → §11); lịch sử thay đổi tra bằng `git log`. Vài chỗ trong code và docs còn trỏ tới `§1.1`/`§1.2`/`§1.3.x`/`§1.4` — các mục con đó không còn, đọc mục này thay thế.

- **Không có Draft.** `POST /api/OtForm` đưa đơn vào chuỗi duyệt ngay. `OtFormStatus` chỉ còn 3 giá trị
  `InApproval / Completed / Rejected` (§2). `POST /{id}/submit` **đã xoá**.
- **Số bước duyệt co giãn theo Phòng ban**, không còn cố định 3–5 cấp. FE đọc từ
  `OtFormDto.approvalSteps[]` (snapshot lúc tạo đơn, §4.3) — **đừng suy trạng thái từ `status`**.
- **Ai duyệt được bước nào** = có tên trong `approvalSteps[].candidates[]` của bước đó. Không còn bảng gán phạm vi riêng (`UserApprovalScope` đã xoá).
- **Cấu hình chuỗi duyệt** ở màn "Cây duyệt" (`CategoryManagement.tsx`): khối "Cây duyệt Nhóm" (`/api/GroupApprovalStep`, §3.4c-2) chạy trước, rồi "Cây duyệt Bộ phận" (`/api/DepartmentApprovalStep`, §3.4c); đơn `isProductionForm` dùng "Cây duyệt Chuyền" (`/api/ProductionApprovalStep`, §3.4c-3).
  Endpoint xem trước `GET /api/JobTitle/resolve-chain` vẫn còn nhưng **không còn UI**.
- **Mật khẩu cấp 2** bắt buộc ở `POST /api/OtForm`, `PUT /api/OtForm/{id}`, Duyệt, Từ chối, bulk-approve/bulk-reject, duyệt Đơn tổng và cả Duyệt/Từ chối qua email; **không** cần khi loại nhân viên (§6c).
- **Thêm nhân viên** gộp vào `PUT /api/OtForm/{id}` (`employees[]` nhận NV mới — §4.1b; `employees/add` trả 404). **Loại nhân viên** có 2 đường: `removedEmployees[]` trong `PUT /{id}` (cùng lượt sửa giờ/note) hoặc route riêng `POST /{id}/employees/remove` (§4.5a) để loại nhanh ngay trên màn Duyệt:
  route riêng authorize theo "candidate bước hiện tại" nên approver không phải người tạo cũng gọi được (khác `PUT /{id}` với đơn theo Nhóm, chỉ người tạo).
- **Đơn "theo chuyền"** (`isProductionForm=true`, Chế Tạo): sửa được theo TỪNG BƯỚC (candidate của bước
  Pending hiện tại), NV thêm vào phải cùng Line/Nhóm ca với NV còn lại; ứng viên bước Line Leader lấy từ
  `ProductionEmployee.IsLeader` + `ProductionLineId`, không đọc `Employee.JobTitleId`.
- **Phiếu ăn 3 bậc**: `OtFormEmployeeDto.mealTicketType` (0 Không / 1 Phụ / 2 Chính), tính trên giờ
  THỰC TÍCH. Field cũ `isEligibleForMeal` **đã xoá**.
- **Giới hạn giờ OT** (`AttendanceSetting`, §6d): mốc **ngày** chặn cứng — vượt thì `POST`/`PUT /api/OtForm` trả 400 kèm danh sách NV vi phạm; mốc **tháng/năm** không chặn mà ép đơn thành TH3 (§6d-2). Mốc riêng từng NV (`customMonthlyOtHourLimit`/`customYearlyOtHourLimit`) được ưu tiên; sửa qua `PUT /api/Employee/{id}/ot-limit` (§3.5d).
- **Menu / route**: `/ot/*` trong app + 4 route công khai mở từ link email (`/xac-nhan-chu-ky`, `/xac-nhan-mat-khau-cap-2`, `/xac-nhan-don`, `/xac-nhan-don-tong`). "Sửa đơn" không phải menu riêng — là nút trong màn chi tiết.

## 2. Enum dùng chung (gửi/nhận là số `int`, FE tự map label)

```js
// OtFormStatus — chi tiết bước đang chờ đọc ở OtFormDto.approvalSteps, đừng suy từ status
{ 0: "InApproval (Đang chờ duyệt)", 1: "Completed (Hoàn tất)", 2: "Rejected (Từ chối)" }

// OtFormApprovalStepStatus — OtFormApprovalStepDto.status (§4.3)
{ 0: "Pending (Đang chờ)", 1: "Approved (Đã duyệt)", 2: "Rejected (Đã từ chối)",
  3: "Skipped (Bỏ qua — đơn bị Reject ở bước khác, các bước Pending còn lại tự chuyển Skipped)" }

// ApprovalAction — chỉ xuất hiện ở OtFormApprovalHistoryDto.action
{ 0: "Submitted", 1: "Approved", 2: "Rejected" }

// JobTitleTerminalLevel — JobTitleDto.terminalLevel (§3.4b), OtFormApprovalStepDto.terminalLevelSnapshot (§4.3),
// OtCaseDto.requiredApprovalLevel (§3.4), OtFormBatchDto.terminalLevel (§6e)
{ 0: "None (cấp trung gian)", 1: "DepartmentManager (Trưởng phòng)",
  2: "WorkshopManager (Trưởng Xưởng)", 3: "GeneralDirector (Giám đốc)" }
// Tối đa 1 JobTitle active giữ mỗi giá trị khác 0. Đây là enum DUY NHẤT xác định "cấp duyệt cuối" của OtCase và của bước duyệt.

// MealTicketType — OtFormEmployeeDto.mealTicketType (§4.3)
{ 0: "Không có phiếu", 1: "Phiếu phụ", 2: "Phiếu chính" }
```
Các enum phụ: `OtFormBatchStatus` (0 Pending / 1 Processed), `OtFormBatchFormDecision` (0 Approve / 1 Reject) ở §6e; `WorkCalendarDayType` (1 Chủ nhật / 2 Ngày lễ / 3 Nghỉ đặc biệt) ở §6d-2.

## 3. Danh mục CRUD chuẩn

6 entity: `Department`, `Group`, `Reason`, `OtCase`, `JobTitle`, `Employee`. Đều theo pattern chung (giống Asset):
```
GET /api/{Entity}/grid-list?pageIndex=1&pageSize=50&keyword=   → PagedResponse
GET /api/{Entity}/all                                           → Dto[] (active, cho dropdown)
GET /api/{Entity}/{id}   POST   PUT /{id} (body có Id khớp)    DELETE /{id} (xóa mềm)
```
Permission: `Attendance.{Entity}.{View|Create|Update|Delete}` (tên Entity PascalCase, ví dụ `Attendance.OtCase.Create`). `Employee` có thêm nhiều route ngoài khuôn này, xem §3.5.

### 3.1 Department (Phòng/Phòng ban) — `/api/Department`
`Department` = **Phòng/Phòng ban** (khớp "Trưởng phòng"); "Bộ phận" là `Group` (§3.2).
```jsonc
// DepartmentDto
{ "id": 1, "departmentCode": "ASSY", "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": null }
```
POST/PUT body: `departmentCode`[Required], `departmentNameVn`[Required], `departmentNameJp?`. PUT thêm `id` khớp URL.

### 3.2 Group (Bộ phận) — `/api/Group` — thuộc 1 Department
```jsonc
// GroupDto
{ "id": 5, "groupCode": "ASSY-01", "groupNameVn": "Nhóm 1", "groupNameJp": null,
  "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp" }
```
POST/PUT body: `groupCode`[Required], `groupNameVn`[Required], `groupNameJp?`, `departmentId`[Required]. `departmentId` sai/không tồn tại → 404.

**Cascading dropdown**: `GET /api/Group/by-department/{departmentId}` → `GroupDto[]` lọc theo Department.
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
POST/PUT: `code`[Required], `description?`, `requireSignature`(bool), `requiredApprovalLevel`[Required] (enum `JobTitleTerminalLevel` — **chỉ chọn `1`/`2`/`3`**: cấp duyệt cuối của trường hợp đó; mặc định TH1 → 1, TH2 → 2, TH3 → 3). Master data Admin cấu hình sẵn (3 dòng cố định), FE màn tạo đơn chỉ cần dropdown từ `/all`.
Trường hợp của một đơn là **giá trị suy ra** (§6d-2), `requireSignature` không còn quyết định việc ký (cờ ký nằm theo từng bước của cây duyệt).

### 3.4b JobTitle (Chức vụ) — `/api/JobTitle`

```jsonc
// JobTitleDto
{ "id": 18, "code": "M", "name": "Manager", "rankOrder": 4, "terminalLevel": 1, "isLineScoped": false }
```
- `POST /api/JobTitle` / `PUT /{id}`: `code`[Required], `name`[Required], `terminalLevel` (`0` None / `1` DepartmentManager / `2` WorkshopManager / `3` GeneralDirector). **Không** nhận `rankOrder` và `isLineScoped`: Chức vụ mới được xếp **cuối** bảng xếp hạng, `isLineScoped` đặt ở DB (cờ "ứng viên lấy từ `ProductionEmployee.IsLeader` của Line", xem attendance-module.md §Cây chức vụ & Cây duyệt).
- `PUT /api/JobTitle/reorder` (`Attendance.JobTitle.Update`): body `{ "jobTitleIds": [..] }` = **toàn bộ** Chức vụ active theo thứ tự mới (kéo-thả) → BE gán `rankOrder = 1..N`, trả `JobTitleDto[]`; danh sách lệch tập hiện có → 400 "vui lòng tải lại trang". `rankOrder` (số lớn = cấp cao) chỉ dùng để **loại các bước ngang/thấp hơn người tạo đơn** khỏi chuỗi duyệt.
- Trùng `code` (kể cả bản đã xóa mềm) → 400. Đặt `terminalLevel` khác `0` khi đã có Chức vụ active khác giữ đúng giá trị đó → 400. Xóa khi còn `Employee.jobTitleId` trỏ tới → 400.
- `requiresSignature` **không** nằm ở Chức vụ mà theo từng bước của cây duyệt (§3.4c): cùng một Chức vụ có thể cần ký ở Bộ phận này nhưng chỉ xác nhận ở Bộ phận khác.
- Bộ Chức vụ là dữ liệu trong DB (không seed bằng code): tra `GET /api/JobTitle/all`. Ví dụ đang dùng: `STAFF`, `GL` Group Leader, `TL` Team Leader, `M` Manager (`terminalLevel` 1), `FM` Factory Manager (2), `GM` Director (3).

### 3.4c DepartmentApprovalStep (Cây duyệt Bộ phận) — `/api/DepartmentApprovalStep`

Danh sách Chức vụ **cấp cuối** (`terminalLevel != 0`: Manager/Factory Manager/Director) là bước duyệt thật của 1 Bộ phận (route/entity tên `Department`, FE hiển thị "Bộ phận"). Cấp trung gian (Staff/Group Leader/Team Leader) cấu hình riêng ở
`/api/GroupApprovalStep` (§3.4c-2). Bộ phận chưa cấu hình gì → chuỗi duyệt rỗng, `resolve-chain` báo kẹt.

**Phạm vi:** `GET`/`PUT` kiểm tra thêm phạm vi — Admin xem/sửa mọi Bộ phận; người khác (dù có permission) chỉ xem/sửa **đúng Bộ phận được gán làm Người phụ trách** (§3.4c-3), sai Bộ phận → 400.

`GET /by-department/{departmentId}` (`Attendance.DepartmentApprovalStep.View`) → `DepartmentApprovalStepDto[]` sắp theo `stepOrder`:
```jsonc
[
  { "id": 6, "departmentId": 1, "stepOrder": 1, "jobTitleId": 18, "jobTitleCode": "M", "jobTitleName": "Manager",
    "rankOrder": 4, "requiresSignature": true, "terminalLevel": 1 }
]
```
`PUT /by-department/{departmentId}` (`Attendance.DepartmentApprovalStep.Update`) — **thay NGUYÊN danh sách**, không có Create/Update/Delete từng dòng:
```jsonc
// thứ tự phần tử = thứ tự bước (phần tử đầu = bước 1)
{ "steps": [ { "jobTitleId": 18, "requiresSignature": true },
             { "jobTitleId": 19, "requiresSignature": true } ] }
```
Trả `DepartmentApprovalStepDto[]` mới. Validate: không lặp `jobTitleId` (400); `jobTitleId` tồn tại/active (404); **`terminalLevel` phải khác `0`** (400 nếu gửi Chức vụ trung gian — cấu hình ở `GroupApprovalStep`). `{ "steps": [] }` xoá hết cây của Bộ phận. `requiresSignature` áp dụng riêng cho bước này của Bộ phận này.

### 3.4c-2 GroupApprovalStep (Cây duyệt Nhóm) — `/api/GroupApprovalStep`

Danh sách Chức vụ **trung gian** (`terminalLevel = 0`: Staff/Group Leader/Team Leader) là bước duyệt thật của 1 Nhóm — cùng khuôn §3.4c nhưng khoá theo `groupId`. Nhóm chưa cấu hình → chuỗi kẹt ngay ở cấp trung gian (`resolve-chain` báo warning).
FE hiển thị §3.4c và §3.4c-2 chung trong tab "Cây duyệt" (`ApprovalStepManager.tsx`): chọn 1 Bộ phận, cấu hình khối Nhóm (trung gian) rồi khối Bộ phận (cấp cuối).
**Phạm vi** giống §3.4c nhưng **tách biệt**: phụ trách Bộ phận không tự phụ trách Nhóm con.

`GET /by-group/{groupId}` (`Attendance.GroupApprovalStep.View`) → `GroupApprovalStepDto[]`:
```jsonc
[
  { "id": 1, "groupId": 163, "stepOrder": 1, "jobTitleId": 15, "jobTitleCode": "STAFF", "jobTitleName": "Staff",
    "rankOrder": 1, "requiresSignature": true, "isResponsible": true, "terminalLevel": 0 },
  { "id": 2, "groupId": 163, "stepOrder": 2, "jobTitleId": 16, "jobTitleCode": "GL", "jobTitleName": "Group Leader",
    "rankOrder": 2, "requiresSignature": false, "isResponsible": false, "terminalLevel": 0 }
]
```
`PUT /by-group/{groupId}` (`Attendance.GroupApprovalStep.Update`) — thay nguyên danh sách: `{ "steps": [ { "jobTitleId": 15, "requiresSignature": true, "isResponsible": true }, … ] }`. Validate: không lặp `jobTitleId` (400);
tồn tại/active (404); **`terminalLevel` phải = 0** (400 nếu gửi cấp cuối); **tối đa 1** bước `isResponsible: true`; khi `steps` không rỗng phải có **1–2** bước `requiresSignature: true` (khớp 2 ô "Người đề nghị" của giấy in `YEV-22-024`). `[]` xoá hết.

### 3.4c-3 ProductionApprovalStep (Cây duyệt Chuyền) — `/api/ProductionApprovalStep`

Danh sách bước duyệt riêng cho đơn **theo chuyền** (`isProductionForm = true`, Chế Tạo): **1 danh sách duy nhất cho mỗi Bộ phận**, từ Line Leader tới Director (khác đơn theo Nhóm = Nhóm rồi Bộ phận).
`GET /by-department/{departmentId}` (`Attendance.ProductionApprovalStep.View`) → `ProductionApprovalStepDto[]` (`id, departmentId, stepOrder, jobTitleId, jobTitleCode, jobTitleName, rankOrder, requiresSignature, isResponsible, terminalLevel, isLineScoped`);
`PUT /by-department/{departmentId}` (`Attendance.ProductionApprovalStep.Update`) body `{ "steps": [ { "jobTitleId", "requiresSignature", "isResponsible" } ] }` (thay nguyên danh sách). Nhận cả Chức vụ trung gian lẫn cấp cuối trong cùng danh sách. Validate: không lặp Chức vụ; tối đa 1 `isResponsible`; nếu có bước cấp **trung gian** (`terminalLevel = 0`) thì phải có **1–2** bước trong số đó `requiresSignature: true` (cấp cuối không bị giới hạn).
Bước Chức vụ có `isLineScoped = true` (Line Leader) lấy ứng viên từ `ProductionEmployee.IsLeader` của Line; phạm vi người sửa giống §3.4c (Người phụ trách **Bộ phận**).

### 3.4c-4 Người phụ trách Cây duyệt — `/api/DepartmentApprovalStepCoordinator`, `/api/GroupApprovalStepCoordinator`

Admin **gán tay** 1 hoặc nhiều Người phụ trách cho 1 Bộ phận/Nhóm để họ tự cấu hình Cây duyệt (§3.4c/§3.4c-2/§3.4c-3) và quản lý nhân sự trong đúng phạm vi mà không cần quyền Admin toàn công ty. **Không suy luận theo Chức vụ**;
chỉ chọn được Employee đang thuộc đúng Bộ phận/Nhóm đó. Hai API tách biệt (mirror nhau), không lồng nhau.

- **Bảng gán chỉ Admin sửa** (`Attendance.{Department|Group}ApprovalStepCoordinator.Update`, chỉ seed cho `Admin`); nó chỉ trả lời "ai là Người phụ trách", không phải quyền thao tác thật.
- **Quyền thao tác thật tự động cấp** ngay khi `PUT` (thêm/gỡ): BE đồng bộ permission cho tài khoản Identity gắn với Employee (`Employee.UserName`) qua `SyncAutoGrantedPermissionsAsync` (`UserPermission.IsAutoGranted = true`; quyền Admin cấp tay không bị đụng). Danh sách quyền tự cấp và luật scope:
  attendance-module.md §Phân quyền Coordinator. Employee chưa có `UserName` → hoãn im lặng, khi gán `UserName` sau (qua `PUT /api/Employee/{id}`) quyền tự bật.

`GET /by-department/{departmentId}` (`…Coordinator.View`) → `DepartmentApprovalStepCoordinatorDto[]`:
```jsonc
[ { "id": 3, "departmentId": 1, "employeeId": 3370, "employeeCode": "N-30479", "fullName": "Nguyễn Văn A", "userName": "YEV\\n.van.a" } ]
```
`userName: null` = Employee chưa liên kết tài khoản → quyền chưa có hiệu lực. `PUT /by-department/{departmentId}` (`…Coordinator.Update`) — thay nguyên danh sách `{ "employeeIds": [3370, 3412] }`; mọi `employeeId` phải là Employee active thuộc đúng Bộ phận (400 nếu sai đơn vị/không tồn tại);
`[]` bỏ hết và thu hồi quyền tự động của người vừa gỡ. `GET`/`PUT /by-group/{groupId}` mirror hoàn toàn (`GroupApprovalStepCoordinatorDto[]`, Employee phải có `groupId` đúng Nhóm).

**FE:** khối "Người phụ trách" (`CoordinatorsBox.tsx`) trong tab "Cây duyệt" (chip + ô tìm nhân viên, tái dùng `deptEmployees`/`groupEmployees` đã tải, áp dụng ngay không cần nút Lưu riêng); chỉ hiện với người có quyền `*Coordinator.View` (Admin). Mục "Danh mục" ở sidebar hiện
khi có 1 trong các quyền quản trị liệt kê ở `otRoutePermissions.ts` (gồm `*ApprovalStep.Update`), để Người phụ trách không phải Admin cũng vào được tab Cây duyệt.

**Gán Chức vụ có phạm vi — `PUT /api/Employee/{id}/department-job-title?departmentId=` và `PUT /api/Employee/{id}/group-job-title?groupId=`**, body `{ "jobTitleId": number | null }` (`null` = gỡ Chức vụ), trả `EmployeeDto` mới. Cách Người phụ trách (và Admin) gán Chức vụ cho nhân viên ở khối "Đang giữ" của tab Cây duyệt,
tách khỏi `PUT /api/Employee/{id}` (sửa hồ sơ đầy đủ). Gate bằng chính quyền cây duyệt của đơn vị (`DepartmentApprovalStep.Update` / `GroupApprovalStep.Update`); BE kiểm tra Employee thuộc đúng Bộ phận/Nhóm trên URL và (non-Admin) người gọi là Người phụ trách của đơn vị đó;
**non-Admin không gán được Chức vụ Trưởng Xưởng/Giám đốc** (cấp dùng chung toàn công ty). BE tự tính lại `groupId`/`departmentId` theo `terminalLevel` Chức vụ mới, FE không gửi 2 field này.

### 3.4d Xem trước chuỗi duyệt — `GET /api/JobTitle/resolve-chain`

`GET /api/JobTitle/resolve-chain?employeeId=&otCaseId=` (`Attendance.JobTitle.View`, chỉ đọc):
```jsonc
// ResolveApprovalChainResultDto
{
  "isComplete": true,
  "warning": null,
  "requiresCreatorSelfSign": false,
  "steps": [
    { "stepOrder": 1, "jobTitleCode": "STAFF", "jobTitleName": "Staff", "rankOrder": 1,
      "requiresSignature": true, "isResponsible": true, "terminalLevel": 0, "candidates": [] },
    { "stepOrder": 2, "jobTitleCode": "M", "jobTitleName": "Manager", "rankOrder": 4,
      "requiresSignature": true, "isResponsible": false, "terminalLevel": 1,
      "candidates": [ { "employeeId": 42, "userName": "YEV\\n.van.b", "fullName": "Nguyễn Văn B" } ] }
  ]
}
```
Đọc `GroupApprovalStep` của Nhóm người tạo trước (cấp trung gian), rồi `DepartmentApprovalStep` của Bộ phận (cấp cuối): luôn đi hết Nhóm rồi tới Bộ phận. `isComplete = false` (kèm `warning`) nếu Nhóm/Bộ phận chưa cấu hình cây, không có bước nào khớp
`TerminalLevel` cần tới, hoặc có bước chưa ai giữ Chức vụ đó đúng Nhóm/Bộ phận. `steps = []` + `isComplete = true`: người tạo đã ở cấp bằng/cao hơn cấp duyệt cuối. `OtFormService.CreateAsync` gọi cùng thuật toán thật; endpoint này hiện **không còn UI** (gọi qua Scalar `/scalar/v1` khi cần debug).
Đơn theo chuyền suy chuỗi từ `ProductionApprovalStep` (§3.4c-3).

### 3.4e JobTitlePermission (Quyền theo Chức vụ) — `/api/JobTitlePermission`

Danh sách permission Identity **tự động cấp** cho mọi Employee đang giữ 1 Chức vụ (có `UserName`): gán Chức vụ xong là có đủ quyền vận hành. Chỉ nhận mã thuộc **whitelist "tham gia quy trình"** (`GET /allowed-codes` trả đúng danh sách; FE lọc UI theo đó, không hardcode song song);
mã quản trị (CRUD danh mục, `Setting.Update`, `AiChat.Use`, `*ApprovalStep.Update`, `JobTitlePermission.*`, `OTForm.Delete`) bị chặn cứng ở BE (400) để không ai tự leo thang quyền bằng cách đổi Chức vụ. Danh sách whitelist hiện hành: attendance-module.md §Permission & Role của Attendance.

`GET /by-job-title/{jobTitleId}` (`Attendance.JobTitlePermission.View`) → `JobTitlePermissionDto[]`:
```jsonc
[ { "id": 1, "jobTitleId": 18, "permissionCode": "Attendance.OTForm.Approve" },
  { "id": 2, "jobTitleId": 18, "permissionCode": "Attendance.UserSignature.Update" } ]
```
`GET /allowed-codes` (`…JobTitlePermission.View`) → `string[]`. `PUT /by-job-title/{jobTitleId}` (`…JobTitlePermission.Update`) — **thay nguyên danh sách** `{ "permissionCodes": [..] }`, trả `JobTitlePermissionDto[]` mới; code ngoài whitelist → 400.
Lưu xong **đồng bộ ngay** cho mọi Employee đang giữ Chức vụ đó; `[]` thu hồi mọi quyền tự cấp của Chức vụ. FE: section "Quyền" trong modal Sửa chức vụ (`JobTitleForm.tsx` + `JobTitlePermissionSection.tsx`, chỉ khi sửa, có nút Lưu riêng).

**Cơ chế đồng bộ** (`UserDirectoryService.SyncAutoGrantedPermissionsAsync`, gọi từ `EmployeeService` khi `JobTitleId`/`UserName` đổi và từ `JobTitlePermissionService.ReplaceAsync`):
- Ghi/xoá qua `UserPermission.IsAutoGranted = true`, phân biệt với quyền Admin cấp tay (`false`, **không bao giờ** bị đụng, dù trùng mã). Đổi/gỡ Chức vụ thì quyền tự cấp không còn cần thiết tự bị thu hồi.
- Employee chưa có `UserName` → no-op; khi `UserName` được gán sau (qua `PUT /api/Employee/{id}`) tự đồng bộ đúng bộ quyền hiện hành.
- Đổi `UserName` sang tài khoản khác → quyền tự cấp bị thu hồi khỏi tài khoản cũ trước khi cấp cho tài khoản mới.
- Nguồn "Người phụ trách" (§3.4c-4) gộp chung trong cùng 1 lần đồng bộ.

### 3.5 Employee (Nhân viên) — `/api/Employee` — thuộc 1 Group HOẶC 1 Department tuỳ Chức vụ
```jsonc
// EmployeeDto
{ "id": 100, "code": "NV001", "firstName": "Nguyễn Văn", "lastName": "A",
  "userName": "YEV\\n.van.a",                     // nullable — tài khoản AD của chính nhân viên
  "monthToDate": 12.5, "yearToDate": 80.0,         // lũy kế THẬT, BE tính lúc đọc — §3.5a
  "projectedDayToDate": 0, "projectedMonthToDate": 0, "projectedYearToDate": 0, // lũy kế DỰ KIẾN — chỉ có nghĩa ở by-group và search dưới chuyền, §3.5b
  "groupId": 5, "groupNameVn": "Nhóm 1",           // nullable, xem bảng dưới
  "departmentId": null, "departmentNameVn": null,
  "jobTitleId": 11, "jobTitleName": "Manager",     // nullable — §3.4b
  "customMonthlyOtHourLimit": null, "customYearlyOtHourLimit": 400 } // decimal? — null = mặc định chung, có giá trị = mốc riêng
```
`POST /api/Employee` body: `code`/`firstName`/`lastName` [Required], `userName?` (gán tài khoản AD để liên kết với người tạo/duyệt đơn), `groupId?`/`departmentId?`, `jobTitleId?` (không tồn tại/đã xóa → 404), `customMonthlyOtHourLimit?` (`[Range(1,744)]`) và
`customYearlyOtHourLimit?` (`[Range(1,8784)]`). **`PUT /api/Employee/{id}` không nhận 2 field mốc OT riêng** (cố ý, để Admin sửa thông tin cơ bản không xoá chúng); sửa mốc qua `PUT /{id}/ot-limit` (§3.5d). Không có mốc ngày riêng (ngày dùng chung 1 mốc cho mọi người).
Trùng `userName` với nhân viên khác (kể cả đang active) → 400. Các field lũy kế là **chỉ đọc**, không có trong POST/PUT.

**`groupId`/`departmentId` — đúng 1 trong 2 (hoặc cả 2 bỏ trống) tuỳ `terminalLevel` của `jobTitleId`** (validate ở `EmployeeService.ValidateOrganizationAssignmentAsync`, sai tổ hợp → 400):

| `jobTitleId` chưa gán / `terminalLevel = 0` | `terminalLevel = 1` (Trưởng phòng) | `terminalLevel = 2/3` (Trưởng Xưởng/Giám đốc) |
|---|---|---|
| `groupId` **bắt buộc**, `departmentId` bỏ trống | `departmentId` **bắt buộc**, `groupId` bỏ trống | cả 2 bỏ trống — dùng chung toàn công ty |

FE `EmployeeForm.tsx`: chọn **Chức vụ trước**, rồi hiện đúng 1 dropdown Bộ phận/Phòng ban (hoặc ẩn cả 2 kèm ghi chú "dùng chung toàn công ty") theo `JobTitleDto.terminalLevel`; đổi Chức vụ giữa 3 nhóm tự reset field cũ. Người phụ trách (non-Admin) tạo/sửa/xoá được nhân viên **trong phạm vi** mình phụ trách và không chuyển nhân viên ra ngoài phạm vi.

**Các route của `/api/Employee`** (quyền `Attendance.Employee.View` trừ khi ghi chú):

| Route | Việc |
|---|---|
| `GET grid-list?pageIndex&pageSize&keyword&departmentId&groupId` | Danh sách phân trang. **Tự áp phạm vi người gọi** (non-Admin chỉ thấy nhân viên trong Bộ phận/Nhóm mình thuộc hoặc phụ trách). `departmentId` lọc cả qua `Group.DepartmentId`; `groupId` lọc 1 Nhóm; filter chỉ thu hẹp thêm trong phạm vi |
| `GET all` | Toàn bộ nhân viên active trong phạm vi người gọi (dropdown chọn 1 nhân viên bất kỳ) |
| `GET by-group/{groupId}?date=` | Nhân viên của 1 Nhóm để Trưởng nhóm tick chọn khi lập đơn; kèm 3 field **dự kiến** theo `date` (§3.5b) |
| `GET by-department/{departmentId}` | Mọi nhân viên active của Phòng ban (cả Group con) — khối "Đang giữ" ở tab Cây duyệt |
| `GET my-scope` | `EmployeeScopeDto { companyWide, departments[], groups[] }` để thu hẹp dropdown lọc Phòng ban/Nhóm ở màn Nhân viên (chỉ UX; chi tiết attendance-module.md §Phạm vi xem nhân viên) |
| `GET in-my-scope?pageIndex&pageSize&keyword` (`OTForm.Approve`) | Nhân viên trong phạm vi người gọi, để tìm 1 người mà không cần `Employee.View`; người gọi chưa liên kết Employee → 400 |
| `GET {id}`, `GET by-username/{userName}` | Tra 1 người (`by-username` 404 nếu chưa có Employee gắn `userName` đó — chuyện bình thường với cấp quản lý không có hồ sơ) |
| `POST`, `PUT {id}`, `DELETE {id}` (`Employee.Create/Update/Delete`) | CRUD hồ sơ (Admin, hoặc Người phụ trách trong phạm vi) |
| `PUT {id}/department-job-title?departmentId=`, `PUT {id}/group-job-title?groupId=` | Gán/gỡ Chức vụ có phạm vi (§3.4c-4) |
| `PUT {id}/ot-limit` (`Employee.UpdateOtLimit`) | Sửa mốc OT riêng (§3.5d) |
| `GET {id}/accumulation-history`, `GET {id}/accumulation-history/manage`, `PUT {id}/accumulation-history` | Lịch sử / sửa lũy kế (§3.5c) |
| `POST resync-coordinator-permissions` (`Department.Create`, Admin) | Đồng bộ lại quyền tự động của mọi Người phụ trách sau khi đổi luật cấp tự động trong code |

### 3.5a Lũy kế THẬT — `monthToDate` / `yearToDate`

Không lưu trên `Employee`: BE tính từ sổ lũy kế (`EmployeeAccumulationHistory`) mỗi lần trả `EmployeeDto`, luôn theo **năm/tháng thực tế hôm nay** (không phải ngày trên đơn nào). `monthToDate` = dòng của tháng nay; `yearToDate` = các dòng từ tháng 0 (số dư đầu kỳ) tới tháng nay.
Hệ quả: đơn ghi ngày tương lai, dù đã `Completed` sớm, chỉ "hiện" khi lịch thực tế tới đúng tháng đó. Màn Nhân viên dùng 2 field này; chúng **không** có trong POST/PUT. Thiết kế đầy đủ: attendance-module.md §Lũy kế & giới hạn giờ OT.

### 3.5b Lũy kế DỰ KIẾN — `projectedDayToDate` / `projectedMonthToDate` / `projectedYearToDate`

`monthToDate`/`yearToDate` chỉ phản ánh đơn đã `Completed`, nên 2 đơn cùng lúc cho một người không thấy cảnh báo vượt mốc. Dự kiến = sổ lũy kế + mọi đơn còn hiệu lực (`!IsRemoved && Status != Rejected && !IsDeleted`; đơn `Completed` không cộng lại vì đã nằm trong sổ)
rơi vào **đúng ngày/tháng/năm của tham số `date`**; **không lưu ở đâu**, tính mỗi lần gọi.
- **Chỉ 2 nguồn trả 3 field này có nghĩa**: `GET /api/Employee/by-group/{groupId}?date=` (đơn theo Nhóm) và `GET /api/ProductionEmployee/search?...&date=` (đơn theo chuyền); mọi `EmployeeDto` khác trả `0`.
- **FE bắt buộc truyền `date` = ngày trên đơn đang tạo** và gọi lại mỗi khi người dùng đổi ngày (bỏ trống = hôm nay thực tế, sai tháng khi lập đơn cho tháng khác). Dùng 3 field này (không dùng `monthToDate`/`yearToDate`) để cảnh báo sớm lúc chọn nhân viên; BE vẫn chặn thật lúc submit (§6d).
- **`OtFormEmployeeDto.monthToDate`/`yearToDate`** (§4.3, trên 1 đơn cụ thể) là **snapshot dự kiến tại lúc thêm dòng, trước khi cộng chính đơn đó** — đóng băng, tên field giữ nguyên.

### 3.5c Lịch sử lũy kế theo tháng/năm và sửa tay

Sổ lũy kế ghi từ khi tính năng ra đời, **không backfill** dữ liệu cũ. Hai quyền khác nhau:

- **Xem** — `GET /api/Employee/{id}/accumulation-history?year=2026` (`Attendance.OTForm.Approve`; Admin xem mọi người, người khác chỉ xem nhân viên trong phạm vi suy theo vị trí Cây chức vụ, ngoài phạm vi → 400) → `EmployeeAccumulationHistoryYearDto`:
```jsonc
{ "employeeId": 42, "employeeCode": "N-30479", "employeeFullName": "Phan Nguyễn Mạnh Cường", "year": 2026,
  "months": [ { "month": 1, "totalHours": 0 }, { "month": 2, "totalHours": 12.5 } /* … luôn đủ 12 phần tử */ ],
  "initialBalanceHours": 0, "yearTotalHours": 12.5 }
```
`yearTotalHours` = `initialBalanceHours` + tổng 12 tháng, cộng đủ cả tháng tương lai nếu đã có đơn `Completed` dán ngày đó — nên có thể **lớn hơn** `EmployeeDto.yearToDate` (§3.5a, chỉ tới tháng hiện tại) cho tới khi lịch thực tế bắt kịp.
- **Sửa tay** (quyền `Attendance.EmployeeAccumulation.Update`: Admin, hoặc Người phụ trách Bộ phận/Nhóm — Bộ phận phụ trách → mọi nhân viên trong Bộ phận; Nhóm phụ trách → chỉ nhân viên trong Nhóm; không bắt lý do, không ghi log):
  `GET /api/Employee/{id}/accumulation-history/manage?year=` (cùng DTO, gate bằng quyền Update) và `PUT /api/Employee/{id}/accumulation-history` body `{ year, initialBalanceHours, months: [{ month 1..12, totalHours }] }` → đặt lại từng tháng + số dư đầu kỳ (dòng `Month = 0`), trả DTO mới.
  Số giờ không âm (`initialBalanceHours` `[Range(0,100000)]`, `year` `[Range(2000,2100)]`); FE cho nhập thẳng tổng năm rồi tự quy ra `initialBalanceHours`; giá trị 0 mà chưa có dòng thì không tạo dòng.
- Ngoài ra sổ được ghi khi đơn `Completed` và qua import (§3.7, §3.8). Không còn `PATCH /api/Employee/{id}/adjust-accumulation` và `GET /api/Employee/me`.

**FE:** `AccumulationHistoryTable.tsx` (bảng 12 tháng, tô đỏ theo `monthlyOtHourLimit`/`yearlyOtHourLimit`) + `AccumulationHistoryModal.tsx` (chọn năm; nút "Sửa lũy kế" khi `canEdit`, form `AccumulationHistoryEditor.tsx`), dùng ở `EmployeeList.tsx`, `ProductionEmployeeList.tsx`, icon cạnh cột lũy kế năm của `OtFormDetail.tsx` (theo
`canApprove`) và màn `/ot/accumulation` (`AccumulationLookupPage.tsx`, gọi `in-my-scope`; không còn link ở sidebar).

### 3.5d Mốc OT riêng của nhân viên — `PUT /api/Employee/{id}/ot-limit`

`Attendance.Employee.UpdateOtLimit` (Admin; Người phụ trách Bộ phận/Nhóm tự có, trong đúng phạm vi). Body `UpdateEmployeeOtLimitDto { customMonthlyOtHourLimit?: number|null, customYearlyOtHourLimit?: number|null }` (`[Range(1,744)]` / `[Range(1,8784)]`; `null` = dùng mặc định chung), trả `EmployeeDto`.
Tách khỏi `PUT /api/Employee/{id}` để quyền hẹp hơn quyền sửa hồ sơ. FE: `EmployeeOtLimitDialog.tsx`; nhập hàng loạt ở §3.7.

### 3.7 Import Excel nhân sự hàng loạt — `/api/EmployeeImport`

Import file `.xlsx` (cột: No./Employee code/Full name/Department/Department Name/Group/Group Name — dòng tiêu đề tự dò theo cột "Employee code", không cố định ở dòng 1) — **upsert theo `Employee.Code`** (mã đã có thì cập nhật `firstName`/`lastName`/`groupId`, mã chưa có thì tạo mới), **tự tạo `Department`/`Group` mới** nếu mã trong file chưa tồn tại. Permission: `Attendance.Employee.Create` (không có permission "import" riêng).

Pattern **Preview → Confirm** (giống import Device bên module Asset): FE luôn gọi Preview trước cho user xem/sửa, rồi gửi lại **nguyên** danh sách đó (kể cả field `Resolved*`/`isNew*` — BE tự re-validate lại từ đầu, không tin dữ liệu Preview cũ) sang Confirm.

```jsonc
// POST /api/EmployeeImport/preview — multipart/form-data, field "file" = file .xlsx
// response — EmployeeImportPreviewResultDto
{
  "rows": [
    { "rowNumber": 15, "employeeCode": "11", "fullName": "Nguyễn Thị Ngọc Thảo",
      "departmentCode": "MN", "departmentNameVn": "MONODUKURI", "groupCode": "1A4DT", "groupNameVn": "Đào tạo",
      "resolvedFirstName": "Thảo", "resolvedLastName": "Nguyễn Thị Ngọc",
      "isNewDepartment": true, "isNewGroup": true, "isNewEmployee": true,
      "isValid": true, "errors": [] },
    { "rowNumber": 16, "employeeCode": "24", "fullName": "", "departmentCode": "TV", "departmentNameVn": "Tổng vụ",
      "groupCode": "1A4AO", "groupNameVn": "Tổng vụ", "resolvedFirstName": null, "resolvedLastName": null,
      "isNewDepartment": false, "isNewGroup": false, "isNewEmployee": true,
      "isValid": false, "errors": ["Thiếu họ tên."] }
  ],
  "totalRows": 2, "validRows": 1, "invalidRows": 1,
  "newDepartmentCount": 1, "newGroupCount": 1
}

// POST /api/EmployeeImport/confirm — body ConfirmEmployeeImportDto: { "rows": [ ...y hệt rows ở trên... ] }
// response — EmployeeImportConfirmResultDto
{ "createdDepartmentCount": 1, "createdGroupCount": 1, "createdEmployeeCount": 1, "updatedEmployeeCount": 0,
  "skippedCount": 1, "skippedRows": [ { "rowNumber": 16, "employeeCode": "24", "errors": ["Thiếu họ tên."] } ] }
```
- `resolvedFirstName`/`resolvedLastName` — BE tự tách từ `fullName`: **từ cuối cùng = tên riêng** (`resolvedFirstName`), phần còn lại = họ + tên đệm (`resolvedLastName`). FE hiện 2 cột này trong bảng preview để user kiểm tra tách đúng chưa trước khi Confirm.
- `isNewDepartment`/`isNewGroup`/`isNewEmployee` — cờ thông tin cho **từng dòng**: mã đó (phòng ban/nhóm/nhân viên) hiện chưa có trong hệ thống, sẽ được tạo khi Confirm. **Lưu ý**: nhiều dòng có thể cùng báo `isNewDepartment=true` cho cùng 1 mã phòng ban — Confirm vẫn chỉ tạo đúng **1** dòng Department cho mã đó (không tạo trùng); số lượng thật sự sẽ tạo xem ở `newDepartmentCount`/`createdDepartmentCount`, không phải đếm số dòng có cờ `true`.
- Dòng có `isValid=false` (`errors` không rỗng) → Confirm **tự bỏ qua**, không chặn cả file — chỉ dòng hợp lệ mới được ghi. FE hiện rõ danh sách dòng bị skip (`skippedRows`) kèm lý do sau khi Confirm xong.
- Mã nhân viên trùng **trong cùng file** (2 dòng cùng `employeeCode`) vẫn là lỗi (không biết dòng nào đúng) — khác với trùng mã đã có sẵn trong hệ thống (không còn là lỗi, sẽ update).
- File không phải `.xlsx` thật (VD `.xlsb`, hoặc `.xls` cũ đổi đuôi) → 400 kèm chi tiết exception gốc trong `errors[]` để debug (không chỉ message chung chung).

### 3.7b Các import khác trong `/api/EmployeeImport` và `/api/EmployeeIdentityLinkImport`

Cả ba là **multipart/form-data, field `file` = `.xlsx`**, ô được đọc theo vị trí cột (cột A bỏ trống). Mỗi endpoint có `GET .../template` trả file mẫu.

| Route | Quyền | File / hành vi |
|---|---|---|
| `POST /api/EmployeeImport/ot-hour-limits` (+ `GET ot-hour-limits/template`) | `Attendance.Employee.UpdateOtLimit` | B = MNV, C = Giới hạn Tháng, D = Giới hạn Năm. **Áp dụng luôn** (không có Preview), từng dòng độc lập; trả `EmployeeOtHourLimitImportResultDto { updatedCount, skippedCount, rows[{ rowNumber, employeeCode, success, error?, monthlyLimit?, yearlyLimit? }] }`. Admin ghi mọi người; Người phụ trách chỉ ghi nhân viên thuộc Bộ phận/Nhóm mình phụ trách (dòng ngoài phạm vi vào `rows` với `success = false`) |
| `POST /api/EmployeeImport/monthly-accumulation?year=&month=` (+ `GET monthly-accumulation/template`) | `Attendance.EmployeeAccumulation.Import` | B = MNV, C = tổng giờ OT của tháng, D (tuỳ chọn) = tổng giờ cả năm. Áp dụng luôn; **cộng chênh lệch** (chạy lại cùng file ra delta 0), cột D ghi chênh lệch vào số dư đầu kỳ (`Month = 0`). Trả `ProductionEmployeeAccumulationResultDto { adjustedCount, unchangedCount, skippedCount, skippedRows[{ employeeCode, reason }], totalDeltaHours, adjustedYearCount, totalDeltaYearHours }` |
| `POST /api/EmployeeIdentityLinkImport/preview`, `POST .../confirm`, `GET .../template` | `Identity.User.BulkImport` (chỉ Admin) | B = MNV, C = UserName, D = RoleName (trống = `Basic`), E = MaChucVu, F = NguoiPhuTrach (`"1"`); ảnh chữ ký nhúng trong Excel. **Cả Preview lẫn Confirm đều nhận lại nguyên file** (không gửi rows JSON). Tự tạo tài khoản Identity nếu chưa có, gán `Employee.UserName`, Chức vụ, Người phụ trách, chữ ký |

`EmployeeIdentityLinkImportPreviewResultDto { rows[], totalRows, validRows, invalidRows, newIdentityUserCount, rowsWithSignatureCount, rowsWithJobTitleCount, rowsWithCoordinatorCount }`, mỗi row: `rowNumber, employeeCode, userName, roleName, jobTitleCode, isCoordinator, hasSignatureImage, resolvedEmployeeFullName,
identityUserAlreadyExists, currentUserNameOnEmployee, resolvedJobTitleName, coordinatorScopeDescription, isValid, errors[]`. Confirm trả `{ successCount, createdIdentityUserCount, signatureSetCount, jobTitleAssignedCount, coordinatorAddedCount, skippedCount, skippedRows[] }`. Thiết kế: attendance-module.md §Import Excel liên kết Identity ↔ Attendance và §Import lũy kế OT theo tháng.

### 3.8 Import/Export nhân sự dưới chuyền — `/api/ProductionEmployeeImport`, `/api/ProductionEmployeeExport`

Nạp/xuất `ProductionEmployee` theo đúng format `docs/Data/Import_Nhan_Su_Che_Tao.xlsx` (sheet `OT(N+1)`).
Pattern **Preview → Confirm** y hệt §3.7, cộng thêm 1 bước riêng "Áp dụng lũy kế" (`GET /api/ProductionEmployeeImport/template` trả file mẫu) — thiết kế: attendance-module.md §Import nhân sự dưới chuyền.

```jsonc
// POST /api/ProductionEmployeeImport/preview — multipart/form-data, field "file"
// Permission: Attendance.ProductionEmployee.Import — response ProductionEmployeeImportPreviewResultDto
{
  "rows": [
    { "rowNumber": 2, "employeeCode": "46", "lastName": "PHAN OANH", "firstName": "LIỆT",
      "congDoan": "GT", "taskName": "FUKU KJC", "blockCode": "CT", "teamCode": "HC", "shiftTeamCode": "HC",
      "isLeader": false, "otMonthHours": 0, "otYearHours": 4.5,
      "resolvedProductionLineId": 78, "resolvedTeamId": 3, "resolvedShiftTeamId": 4,
      "isNewEmployee": false, "isNewProductionEmployee": false, "isUpdatedProductionEmployee": false,
      "isValid": true, "errors": [] }
  ],
  "totalRows": 2414, "validRows": 2119, "invalidRows": 295,
  "newEmployeeCount": 292, "newProductionEmployeeCount": 431, "updatedProductionEmployeeCount": 1258,
  "unchangedProductionEmployeeCount": 0, "removedProductionEmployeeCount": 6,
  "removedRows": [ { "employeeCode": "9999", "fullName": "Nguyễn Văn A" } ]
}

// POST /api/ProductionEmployeeImport/confirm — body { "rows": [ ...y hệt rows ở Preview... ] }
// Permission: Attendance.ProductionEmployee.Import — response ProductionEmployeeImportConfirmResultDto
{ "createdGroupCount": 1, "createdEmployeeCount": 292, "createdProductionEmployeeCount": 431,
  "updatedProductionEmployeeCount": 1258, "removedProductionEmployeeCount": 6,
  "skippedCount": 295, "skippedRows": [ { "rowNumber": 40, "employeeCode": "512", "errors": ["Mã GROUP 'S' không khớp Team nào trong hệ thống."] } ] }

// POST /api/ProductionEmployeeImport/apply-accumulation — body { "year": 2026, "month": 8, "rows": [ ...rows... ] }
// Permission RIÊNG: Attendance.EmployeeAccumulation.Import (đụng lũy kế OT, ảnh hưởng lương)
// response ProductionEmployeeAccumulationResultDto
{ "adjustedCount": 2100, "unchangedCount": 19, "skippedCount": 0, "skippedRows": [], "totalDeltaHours": 340.5 }

// GET /api/ProductionEmployeeExport/export — Permission: Attendance.ProductionEmployee.Export
// KHÔNG bọc ApiResponse<T> — trả thẳng file .xlsx (Content-Disposition), 1 sheet / Phòng ban thật của
// hệ thống (Employee.Group.Department), cột OT month/OT year lấy SỐNG từ EmployeeAccumulationHistory.
// Cột xuất ra ĐÚNG VỊ TRÍ A..O của file mẫu (A=KHOI SU để trống, B=MNV...K=GROUP, L/M/N để trống,
// O=LEADER) — file xuất ra dùng lại được ngay làm file Import tháng sau.
```
- Chỉ resolve `BlockCode`/`TeamCode`/`ShiftTeamCode` theo `ProductionLine`/`ProductionTeam`/`ProductionShiftTeam`
  hiện có trong hệ thống — **KHÔNG tự tạo mới** khi không khớp (khác `EmployeeImportService` ở §3.7),
  chỉ skip dòng đó kèm lý do. Mã nhân viên (`MNV`) thì NGƯỢC LẠI — **được phép tự tạo** `Employee` nếu
  chưa có, gán vào Group `"Chưa phân loại (nhập từ file chuyền)"` (mã `KHAC`) dưới Phòng ban `Chế Tạo`.
- `otMonthHours`/`otYearHours` trong `rows` chỉ mang tính hiển thị ở Preview/Confirm — **không được ghi
  vào đâu** cho tới khi gọi riêng `apply-accumulation`. Chỉ `otMonthHours` được dùng (cộng **chênh lệch**
  vào `EmployeeAccumulationHistory` của đúng Year/Month chọn tay, kèm `Note` truy vết) — `otYearHours`
  chỉ tham khảo.
- Người đang có trong `ProductionEmployees` nhưng KHÔNG còn xuất hiện trong file mới → tự động soft-delete
  khi Confirm (`removedRows`/`removedProductionEmployeeCount`) — FE nên cảnh báo rõ trước khi bấm Confirm.
- **FE (`ProductionEmployeeImportDialog.tsx`)**: bản xem trước tách thành 6 tab (Tất cả/
  Mới/Cập nhật/Không đổi/Lỗi/Bị gỡ, mỗi tab có số đếm) — lọc lại client-side từ CÙNG `rows`/`removedRows`
  của response Preview (`isNewProductionEmployee`/`isUpdatedProductionEmployee`/`isValid`), không gọi
  thêm API nào. Nút Import/Export gom vào 1 dropdown "Excel" ở toolbar view "Nhân viên dưới chuyền".

### 3.8b `GET /api/ProductionEmployee/page-nation` — Màn "Nhân viên dưới chuyền"

View đọc thẳng bảng `ProductionEmployees` (KHÁC `Employee/grid-list` §3.1 đọc bảng `Employees`) — hiển
thị đúng dữ liệu chuyền mới nhất (Line/Team/Nhóm ca/Công đoạn/Trưởng nhóm) thay vì Nhóm/Phòng ban/Chức
vụ tổ chức. Nguồn chính vẫn là Import lại Excel (§3.8, nạp đè hết mỗi tháng) — `PUT /{id}` bên dưới
chỉ để sửa nhanh 1 dòng giữa 2 đợt import. Permission xem riêng `Attendance.ProductionEmployee.View` (Admin chỉ định theo Chức vụ hoặc từng user; Người phụ trách Bộ phận tự có).
Có quyền không có nghĩa xem được toàn công ty: response tự lọc còn lại nhân sự thuộc Phòng ban/Nhóm mà người gọi đang phụ trách (Admin không bị lọc) — FE không cần tự lọc thêm.

```jsonc
// GET /api/ProductionEmployee/page-nation?PageIndex=1&PageSize=10&Keyword=&ProductionLineId=&TeamId=&ShiftTeamId=
// response — data: ProductionEmployeeListItemDto[] (bọc PagedResponse như mọi grid-list khác)
{
  "data": [
    { "id": 12, "employeeId": 46, "employeeCode": "46", "fullName": "LIỆT PHAN OANH",
      "congDoan": "GT", "taskName": "FUKU KJC", "blockCode": "CT", "productionLineId": 7,
      "teamCode": "HC", "teamNameVn": "Hành chính", "teamId": 3,
      "shiftTeamCode": "HC", "shiftTeamNameVn": "Hành chính", "shiftTeamId": 9,
      "isLeader": false, "departmentNameVn": "Chế Tạo", "monthToDate": 12.5, "yearToDate": 88.0 }
  ],
  "pageIndex": 1, "pageSize": 10, "totalCount": 1688, "totalPages": 169,
  "hasNextPage": true, "hasPreviousPage": false
}
```
- 3 dropdown lọc (`ProductionLineId`/`TeamId`/`ShiftTeamId`) dùng lại đúng 3 API option đã có sẵn cho
  màn "Theo chuyền" khi tạo đơn OT: `GET /api/ProductionEmployee/line-options|team-options|shift-team-options`.
  Quyền của 4 endpoint `search`/`line-options`/`team-options`/`shift-team-options`: `Attendance.OTForm.Create` **OR** `Attendance.OTForm.CreateProduction` (Line Leader chỉ có `CreateProduction` vẫn dùng được).
  Dropdown Line theo Team lấy từ dữ liệu `ProductionEmployees` thật, không theo FK tĩnh của `ProductionLine`.
- `monthToDate`/`yearToDate` là lũy kế THẬT (từ `EmployeeAccumulationHistory`, scope theo năm/tháng
  thực tế hôm nay) — cùng công thức `EmployeeService.GetPagedAsync`, không phải số tĩnh từ file import.
- `productionLineId`/`teamId`/`shiftTeamId` để FE chọn sẵn đúng giá trị hiện tại khi mở form sửa (`PUT` bên dưới); 3 field Code chỉ để hiển thị.

**`PUT /api/ProductionEmployee/{id}`** (permission riêng `Attendance.ProductionEmployee.Update`, khác
`.Import`) — sửa Team/Line/Nhóm ca/Trưởng nhóm của 1 dòng:
```jsonc
// body — UpdateProductionEmployeeDto (3 Id đều nullable — null = gỡ về không xác định)
{ "productionLineId": 7, "teamId": 3, "shiftTeamId": 9, "isLeader": true }
```
BE tự tra lại `LineCode`/`TeamCode`/`ShiftTeamCode` từ đúng Id gửi lên (FE không gửi Code tay) để 2
field Id/Code không bao giờ lệch nhau. **Lưu ý**: dữ liệu sửa ở đây sẽ bị **ghi đè lại** đúng theo file
ở lần Import Excel kế tiếp; `isLeader=true` có hiệu lực NGAY cho luồng duyệt "theo chuyền" của Line đó
(đọc sống, không cache) — xem `attendance-module.md §Import nhân sự dưới chuyền`.

## 4. OtForm (`/api/OtForm`) — nghiệp vụ chính

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtForm/my-create-scopes` | `OTForm.Create` | Nhóm/Bộ phận mà **chính mình** được tạo đơn (§4.0a) — gọi trước khi mở màn "Tạo đơn" (đơn theo Nhóm) |
| GET | `/api/OtForm/my-production-create-scopes` | `OTForm.CreateProduction` | Tổ hợp Team/Line/Nhóm ca mà mình là Line Leader (§4.0b) — gọi trước khi mở tab "Theo chuyền" |
| POST | `/api/OtForm/check-overlap` | `Create` **hoặc** `CreateProduction` | Trả `int[]` mã nhân viên bị trùng giờ với đơn khác trong ngày (§4.1) |
| POST | `/api/OtForm` | `Create` **hoặc** `CreateProduction` (rồi kiểm lại theo `isProductionForm`) | Tạo đơn, vào chuỗi duyệt ngay (§4.1) |
| PUT | `/api/OtForm/{id}` | `Create` **hoặc** `CreateProduction` | Sửa giờ/ghi chú + thêm/loại nhân viên (§4.1b) |
| POST | `/api/OtForm/{id}/delete` | `OTForm.Delete` (Admin) | Xoá đơn kẹt, 400 nếu `Completed` (§4.1c) |
| GET | `/api/OtForm/my-forms` | `OTForm.View` | Đơn mình tạo (§4.2) |
| GET | `/api/OtForm/pending-approvals` (+ `/count`, `/dates`) | `OTForm.Approve` | Đơn chờ mình xử lý; badge; lịch mini (§4.2, §4.2d, §4.2e) |
| GET | `/api/OtForm/my-actions` | `OTForm.View` | Đơn mình đã duyệt/từ chối (§4.2b) |
| GET | `/api/OtForm/my-participations` | `OTForm.View` | Đơn mình có tên trong danh sách tăng ca (§4.2c) |
| GET | `/api/OtForm/all-forms` | `OTForm.ViewAll` (Admin) | Tất cả đơn (§4.2f) |
| GET | `/api/OtForm/{id}` | `OTForm.View` | Chi tiết đầy đủ kèm `approvalSteps[]` (§4.3) |
| POST | `/api/OtForm/{id}/approve`, `/{id}/reject` | `OTForm.Approve` | Duyệt / Từ chối bước đang chờ (§4.4, §4.5) |
| POST | `/api/OtForm/bulk-approve`, `/bulk-reject` | `OTForm.Approve` | Duyệt / Từ chối hàng loạt: body = `ApproveOtFormDto`/`RejectOtFormDto` + `otFormIds: int[]`; trả 200 kèm `BulkOtFormActionResultItemDto[] { otFormId, success, error? }`, **không** all-or-nothing |
| POST | `/api/OtForm/{id}/employees/remove` | `OTForm.RemoveEmployee` | Loại 1 nhân viên ngay trên màn Duyệt (§4.5a) |
| GET/POST | `/api/OtForm/email-confirm/{token}` (+ `/approve`, `/reject`, `/employees/remove`) | `[AllowAnonymous]` | Kênh email (§4.6) |

Không còn: `POST /{id}/submit`, `GET pending-submissions`, `POST /{id}/employees/add` (gọi sẽ nhận 404).

### 4.0a `GET /api/OtForm/my-create-scopes` — Nhóm/Bộ phận được tạo đơn

```jsonc
// data: MyCreateScopeItemDto[]
[ { "groupId": 5, "groupNameVn": "Nhóm 1", "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp" } ]
```
Người gọi chỉ tạo được đơn theo Nhóm cho **đúng Nhóm của chính mình** (`Employee.GroupId` của `Employee` gắn `userName`); gọi endpoint này **trước khi mở màn "Tạo đơn"** để điền sẵn và khoá Bộ phận/Nhóm.
- **1 phần tử**: tự điền `groupId`/`departmentId`, khoá 2 ô (readonly/disabled).
- **Mảng rỗng** khi: (1) **Admin** — không giới hạn, hiện dropdown tự do (`Department/all` + `Group/by-department/{id}`); (2) tài khoản chưa liên kết `Employee` hoặc Employee không có Nhóm — nên chặn màn Tạo đơn, báo "Tài khoản chưa được cấp quyền tạo đơn cho Bộ phận nào, liên hệ Admin".

### 4.0b `GET /api/OtForm/my-production-create-scopes` — Tổ hợp Team/Line/Nhóm ca của Line Leader

```jsonc
// data: MyProductionCreateScopeItemDto[]
[ { "departmentId": 7, "departmentNameVn": "Chế tạo",                    // Bộ phận của CHÍNH người gọi, giống nhau ở mọi phần tử
    "productionLineId": 12, "lineCode": "SHIDO", "lineNameVn": null,     // lineNameVn luôn null (ProductionLine chỉ có mã)
    "teamId": 2, "teamCode": "B", "teamNameVn": "Team B",
    "shiftTeamId": 1, "shiftTeamCode": "G", "shiftTeamNameVn": "Green" } ]
```
Mirror §4.0a cho chế độ "Theo chuyền". `departmentId` suy từ `Employee.DepartmentId ?? Employee.Group.DepartmentId` của người gọi; **khoá cứng ô "Bộ phận"** khi mảng ≥ 1 phần tử. Chỉ trả tổ hợp có đủ cả 3 FK (`ProductionLineId`/`TeamId`/`ShiftTeamId`) của dòng `ProductionEmployee` có `IsLeader = true`.
- **1 phần tử**: tự điền và khoá cả 3 dropdown Team/Line/Nhóm ca. **Nhiều phần tử**: giới hạn 3 dropdown trong các tổ hợp trả về (không khoá cứng, Bộ phận vẫn khoá).
- **Mảng rỗng** (Admin, hoặc có quyền `CreateProduction` nhưng không phải Line Leader): giữ dropdown tự do (`ProductionEmployee/team-options|line-options|shift-team-options`), **không** chặn màn.

### 4.1 `POST /api/OtForm` — Tạo đơn
```jsonc
// body — CreateOtFormDto
{
  "isProductionForm": false,                                                  // true = đơn theo chuyền (groupId bỏ trống)
  "groupId": 5, "departmentId": 1, "reasonId": 2, "otCaseId": 1,             // departmentId/reasonId/otCaseId [Required]; groupId bắt buộc khi đơn theo Nhóm
  "startTime": "17:30:00", "endTime": "19:30:00",                            // TimeOnly "HH:mm:ss" — khung giờ TỐI ĐA của đơn
  "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15",                                    // [Required], DateOnly "yyyy-MM-dd"
  "employees": [                                                             // [Required][MinLength(1)]
    { "employeeId": 100, "startTime": "18:00:00", "endTime": "19:30:00", "didEat": false, "noteVn": null, "noteJp": null }  // startTime null = lấy startTime của đơn
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null },  // optional ở body nhưng BE LUÔN tạo ProcessPart và ép isEat = true
  "secondaryPassword": "..."                                                  // [Required] — §4.4
}
```
Response `201 Created` (Location trỏ `GET /{id}`), `data` = `OtFormDto` đầy đủ (§4.3), không cần gọi lại `GetById`.
- **Khung giờ**: `startTime` của đơn ≤ `employees[].startTime` < `employees[].endTime` ≤ `endTime` của đơn, sai → 400 kèm mã nhân viên vi phạm. **`endTime` phải > `startTime`, không hỗ trợ ca qua đêm** (400 ngay đầu hàm; FE tự chặn trước ở `CreateOtFormPage.tsx`, BE là nơi chặn thật).
- **Đơn theo Nhóm**: `employees[].employeeId` phải cùng `groupId` của đơn (khác nhóm → 400); `departmentId` phải đúng là Department của `groupId` (`Group.DepartmentId`, lệch → 400 "Nhóm '…' không thuộc Bộ phận đã chọn"; dùng cascading dropdown §3.2 thì không gặp). Người tạo phải là Employee của đúng Nhóm đó hoặc Admin (400 "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình").
- **Đơn theo chuyền**: cần quyền `OTForm.CreateProduction` (Controller ném 400 nếu thiếu); mỗi `employees[].employeeId` phải có `ProductionEmployee.ShiftTeamId != null` (thiếu → 400 liệt kê mã); **non-Admin phải là Line Leader (`IsLeader`) của TẤT CẢ Line có trong đơn** (400 "Bạn chỉ được tạo đơn cho nhân viên thuộc (những) Line mà mình là Line Leader"). `didEat` luôn bị ép `true`.
- **Trường hợp OT là giá trị suy ra** (§6d-2): `otCaseId` khác Trường hợp BE suy ra → 400 ghi rõ phải là TH nào. **Giới hạn giờ OT** (§6d): vượt mốc ngày → 400 liệt kê nhân viên vi phạm; vượt mốc tháng/năm → đơn bắt buộc TH3. **Trùng giờ**: một nhân viên không được nằm trong 2 đơn (chưa xoá, chưa bị từ chối) có giờ chồng chéo trong cùng ngày — dùng `check-overlap` để báo sớm.
- **Không có field chữ ký trong body**: chữ ký chỉ bắt buộc lúc Duyệt nếu bước đó yêu cầu (§4.4). Đơn vào chuỗi duyệt ngay (`status = InApproval`), hoặc `Completed` ngay nếu chuỗi rỗng (người tạo đã ở cấp ≥ cấp duyệt cuối); `approvalHistories` ban đầu rỗng.
- **Chuỗi duyệt thiếu không chặn tạo đơn**: Nhóm/Bộ phận chưa cấu hình cây hoặc thiếu người giữ Chức vụ → đơn vẫn tạo với chuỗi cắt cụt, `approvalChainWarning` (string, `null` nếu đủ) nêu lý do; FE hiện banner ở màn chi tiết (§4.3).
- **`processPart`**: BE luôn tạo `ProcessPart` và ép `isEat = true` dù gửi gì; `isTransportation`/`isUseCopyRoom` tuỳ chọn. `mainTicketCount`/`secondaryTicketCount`/`milkCount` do người lập nhập tay cho **cả đơn** (BE không validate khớp `numberOfEmployee`), `ProcessPart` cố định sau khi tạo (không sửa qua `PUT`), trừ việc BE tính lại số phiếu khi loại nhân viên.
- **`secondaryPassword`** re-verify ngay đầu hàm (§4.4); sai/chưa đăng ký → 400. `employees[].didEat`: `true` = ăn TRONG ca, bị trừ `MealBreakDeductionHours` (FE hiển thị đảo ngược dưới nhãn "Ăn sau"); xem attendance-module.md §Phiếu ăn.
- `POST /api/OtForm/check-overlap` body `{ date, startTime, employees: [{ employeeId, startTime?, endTime }], excludeFormId? }` → `data: int[]` mã nhân viên trùng giờ (`excludeFormId` bỏ qua đơn đang sửa).

### 4.1b `PUT /api/OtForm/{id}` — Sửa đơn
```jsonc
// UpdateOtFormDto
{
  "employees": [
    // NV đang có: sửa giờ/ghi chú. NV MỚI (employeeId chưa có trong đơn): BE validate y hệt lúc tạo (giờ hợp lệ, trùng giờ, giới hạn OT); đơn theo chuyền phải cùng Line/Nhóm ca với NV còn lại.
    { "employeeId": 100, "startTime": "18:00:00", "endTime": "20:00:00", "didEat": true, "noteVn": null, "noteJp": null },  // startTime null = giữ nguyên (NV mới: lấy startTime của đơn)
    { "employeeId": 205, "endTime": "19:00:00", "didEat": false, "noteVn": null, "noteJp": null }
  ],
  "removedEmployees": [ { "employeeId": 101, "reason": "Nghỉ đột xuất" } ],  // NV đang có nhưng KHÔNG có ở employees[] phải khai ở đây
  "secondaryPassword": "..."   // [Required] — 1 LẦN cho toàn bộ thay đổi trong lượt Lưu
}
```
- **Ai gọi được**: đơn **theo Nhóm** — chỉ người tạo, và chỉ khi chưa bước nào `Approved`. Đơn **theo chuyền** — theo từng bước: người có tên trong `candidates` của bước `Pending` hiện tại (không có Admin bypass; bước đã ký bị khoá, chữ ký đã có giữ nguyên khi sửa ở bước sau). Đơn phải còn `InApproval`.
  Route riêng `POST /{id}/employees/remove` (§4.5a) khác ở chỗ authorize theo candidate bước hiện tại cho cả 2 loại đơn.
- **Validate**: mọi NV đang active không có ở `employees[]` lẫn `removedEmployees[]` → 400 "Danh sách nhân viên trong đơn không khớp"; tổng NV còn lại (giữ + thêm) ≥ 1; mỗi dòng `otForm.StartTime ≤ startTime < endTime ≤ otForm.EndTime`. `didEat` của đơn theo chuyền luôn bị ép `true`.
- Mỗi thay đổi ghi `OtFormEditLog` (`TimeChanged`/`NoteChanged`/`EmployeeAdded`/`EmployeeRemoved`). Quyền scope của người sửa kiểm lại theo `groupId`/`departmentId` **hiện có của đơn** (không nhận từ body). Response `data` = `OtFormDto` sau khi sửa.
- **FE** (`CreateOtFormPage.tsx` chế độ `isEditMode`, dùng chung với Tạo mới): khoá "Thông tin đơn"/"Yêu cầu hỗ trợ khác"; bảng nhân viên có khối tìm NV mới (keyword, BE chặn thật theo Line/Nhóm ca) và nút "Loại khỏi đơn" từng dòng (nhập lý do); thay đổi chỉ là tạm (`pendingRemovals`/`selectedEmployeeIds`) tới khi bấm "Lưu thay đổi".

### 4.1c `POST /api/OtForm/{id}/delete` — Xoá đơn kẹt vĩnh viễn (Admin)
Body `{ "reason": "..." }` [Required]; `Attendance.OTForm.Delete` chỉ Admin. Dùng cho đơn kẹt cứng trong chuỗi duyệt (1 bước thiếu candidate không resolve lại được).
- **400 nếu `Completed`** (đã cộng lũy kế thật); chỉ xoá được `InApproval`/`Rejected`. Soft-delete, response `data: true`; đơn biến mất khỏi mọi danh sách và `GET /{id}` trả 404, không có cách hoàn tác qua UI.
- FE: nút "Xoá đơn" (`OtFormDetail.tsx`) chỉ hiện khi có quyền **và** `status !== Completed`; modal bắt nhập lý do; thành công thì điều hướng `/ot/list`.

### 4.2 Danh sách đơn — `my-forms`, `pending-approvals`, `my-actions`, `my-participations`, `all-forms` (`OtFormListItemDto`)
```jsonc
// data.data[]
{ "id": 10, "groupNameVn": "Nhóm 1", "groupNameJp": null, "isProductionForm": false, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": "組立工場", "otCaseCode": "TH1",
  "date": "2026-07-15", "totalHour": 2.0, "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A",
  "status": 0, "isEditable": true, "currentStepCandidateCount": 2,
  "productionLineNames": null, "productionShiftTeamNames": null,
  "approvalSummary": [
    { "stepOrder": 1, "jobTitleNameSnapshot": "Manager", "approverUserName": "YEV\\n.van.a",
      "approverFullName": "Nguyễn Văn A", "action": 1, "actionAt": "2026-07-15T08:00:00Z" }
  ] }
```
**Query chung cho cả 5 endpoint** (kết hợp AND với điều kiện sẵn có của từng endpoint): `pageIndex`, `pageSize`, `fromDate`/`toDate` (`yyyy-MM-dd`, lọc `OtForm.date` gồm hai đầu mút, bỏ trống 1 đầu = không giới hạn đầu đó), `status` (int, enum `OtFormStatus`; check `!== undefined` vì `0` là giá trị hợp lệ), `groupId`/`departmentId`
(lọc `OtForm.GroupId`/`DepartmentId`; đơn theo chuyền chỉ có `DepartmentId`), `productionLineId`/`productionTeamId`/`productionShiftTeamId` (BE đổi Id → `Code` rồi lọc theo `BlockCodeSnapshot`/`TeamCodeSnapshot`/`ShiftTeamCodeSnapshot`; đơn nào có ít nhất 1 nhân viên active khớp thì qua).
FE: `OtFormApi.get*({ … })` (`ot-form.api.ts`); bộ lọc (2 ô ngày, trạng thái, Bộ phận → Nhóm, Team → Line → Nhóm ca) nằm trong `OtFormListPage.tsx` dùng chung cho cả 5 tab (prop `mode`), hiện ở mọi tab. Thiết kế: attendance-module.md §Danh sách đơn.

- **`pending-approvals`** tự xác định "bước hiện tại" của người gọi (candidate của bước `Pending` có `StepOrder` nhỏ nhất); FE không truyền tham số lọc cấp. `currentStepCandidateCount` = số người đủ điều kiện xử lý bước đang chờ (0 nếu đơn không còn `InApproval`); FE hiện "Đang chờ duyệt (1 trong N người)" khi > 1.
- **Hiển thị người tạo**: dùng `createdByFullName ?? createdByUserName` (`createdByFullName` có thể `null`).
- **`isEditable`** = `status == InApproval && !approvalSteps.some(Approved)`, tính độc lập với người xem; nút "Sửa" chỉ nên hiện khi `isEditable` **và** `createdByUserName == user hiện tại` **và** có `OTForm.Create` (thực tế chỉ có nghĩa ở tab "Đơn của tôi").
- **`approvalSummary`** (sắp theo `actionAt` tăng dần, có ở cả 5 endpoint) cùng shape `approvalHistories` ở §4.3 nhưng bỏ `comment`/`signatureImage`/`hasSignature`; danh sách **không** có tên bước đang chờ tiếp theo (chỉ có ở chi tiết qua `approvalSteps[]`), FE hiện "Đang chờ duyệt" chung khi `status == InApproval`.
- **`groupNameJp`/`departmentNameJp`** (nullable): FE hiện `"{Vn} / {Jp}"` khi có Jp (`bilingualText` ở `modules/attendance/lib/bilingual.ts`). **`productionLineNames`/`productionShiftTeamNames`**: `BlockCodeSnapshot`/`ShiftTeamCodeSnapshot` distinct của nhân viên còn active, nối `", "`; chỉ có giá trị khi `isProductionForm = true`, đơn khác trả `null`.

### 4.2b `GET /api/OtForm/my-actions` — Đơn tôi đã xử lý
Mọi đơn mà chính người gọi từng **Duyệt hoặc Từ chối** ở bất kỳ bước nào (tra `OtFormApprovalHistory.approverUserName`, gồm cả đơn do mình Từ chối), vì đơn vừa xử lý xong biến mất khỏi `pending-approvals`. Cùng shape §4.2. Một đơn có thể xuất hiện ở `my-actions` của nhiều người (mỗi cấp đều thấy). Click dòng → `GET /{id}` xem `approvalHistories` kèm comment lý do.

### 4.2c `GET /api/OtForm/my-participations` — Đơn tôi có tên trong danh sách tăng ca
Mọi đơn mà người gọi được liệt kê là nhân viên tăng ca (`OtFormEmployee`), bất kể có phải người tạo/ký/duyệt hay không; cho nhân viên bình thường tự tra mình có tên trong đơn nào (`my-forms` chỉ lọc theo người **tạo**). BE tra qua `Employee.userName == người gọi`: **tài khoản chưa được gán `Employee.userName` trả danh sách rỗng**
(không lỗi, không 404) — FE nên hiện thông báo nhẹ "Tài khoản chưa liên kết hồ sơ nhân viên, liên hệ Admin". Cùng shape §4.2; click dòng → `GET /{id}` (chỉ xem, kể cả khi không có quyền sửa/duyệt đơn đó).

### 4.2d `GET /api/OtForm/pending-approvals/count` — Đếm badge sidebar
`ApiResponse<int>` (`data` là số nguyên, không bọc `PagedResponse`): số đơn đang chờ **chính người gọi** duyệt, đúng bằng số dòng `pending-approvals` trả khi không lọc ngày/trạng thái; chỉ 1 `COUNT` SQL. FE: `OtManagerSidebar.tsx` qua hook `usePendingApprovalsCount`, tự poll mỗi 60 giây, chỉ gọi khi có `Attendance.OTForm.Approve`.

### 4.2e `GET /api/OtForm/pending-approvals/dates` — Lịch mini ngày chưa duyệt
`GET /api/OtForm/pending-approvals/dates?fromDate=2026-09-01&toDate=2026-09-30` → `data: PendingApprovalDateCountDto[]` (`{ "date": "2026-09-05", "count": 3 }`), group theo `OtForm.Date` trong `[fromDate, toDate]`, cùng scoping với `pending-approvals`; không phân trang, ngày không có đơn thì không xuất hiện. FE (`OtFormListPage.tsx`, chỉ tab "Chờ tôi duyệt")
hiện lịch tháng nhỏ với badge số đơn; bấm 1 ngày đặt `fromDate = toDate` rồi gọi lại `pending-approvals`.

### 4.2f `GET /api/OtForm/all-forms` — "Tất cả đơn" cho Admin
Cùng shape §4.2 và cùng query, nhưng **không lọc theo người gọi**: toàn bộ `OtForm` chưa xoá mềm, sắp `Id` giảm dần. Gate `Attendance.OTForm.ViewAll` (chỉ Admin). FE: tab "Tất cả đơn" trong `OtFormTabsPage.tsx`, hiện khi `hasPermission(user, "Attendance.OTForm.ViewAll")`.

### 4.3 `GET /api/OtForm/{id}` — Chi tiết (`OtFormDto`)
```jsonc
{
  "id": 10, "groupId": 5, "groupNameVn": "Nhóm 1", "groupNameJp": null,          // groupId/groupName* null với đơn theo chuyền
  "isProductionForm": false,
  "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": "組立工場",
  "reasonId": 2, "reasonNameVn": "Tăng ca sản xuất gấp", "reasonNameJp": null, "otCaseId": 1, "otCaseCode": "TH1",
  "startTime": "17:30:00", "endTime": "19:30:00", "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15", "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A", "createdAt": "2026-07-14T09:00:00Z",
  "creatorSignatureImage": null,
  "status": 0, "isEditable": true, "approvalChainWarning": null,
  "employees": [
    { "employeeId": 100, "employeeCode": "NV001", "fullName": "Nguyễn Văn A",
      "startTime": "17:30:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null,
      "monthToDate": 12.5, "yearToDate": 80.0,
      "customMonthlyOtHourLimit": null, "customYearlyOtHourLimit": null,
      "mealTicketType": 0, "actualHours": 2.0, "didEat": false,
      "isRemoved": false, "removedByUserName": null, "removedByFullName": null,
      "removedAtLevel": null, "removedAt": null, "removeReason": null,
      "congDoanSnapshot": null, "taskNameSnapshot": null, "blockCodeSnapshot": null,
      "teamCodeSnapshot": null, "shiftTeamCodeSnapshot": null }                    // 5 snapshot chuyền: chỉ có giá trị với đơn theo chuyền
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null },
  "approvalHistories": [
    { "approverUserName": "YEV\\n.van.a", "approverFullName": "Nguyễn Văn A",
      "stepOrder": 1, "jobTitleNameSnapshot": "Manager", "action": 1,
      "comment": null, "hasSignature": true, "signatureImage": "iVBORw0KG...", "actionAt": "2026-07-15T08:00:00Z" }
  ],
  "approvalSteps": [
    { "id": 501, "stepOrder": 1, "jobTitleCodeSnapshot": "M", "jobTitleNameSnapshot": "Manager",
      "requiresSignatureSnapshot": true, "isResponsibleSnapshot": true, "terminalLevelSnapshot": 1,
      "status": 1,
      "candidates": [ { "employeeId": 12, "userName": "YEV\\n.van.a", "fullName": "Nguyễn Văn A" } ] }
  ],
  "editLogs": [
    { "actionByUserName": "YEV\\n.van.a", "actionByFullName": "Nguyễn Văn A", "actionAt": "2026-08-28T02:10:00Z",
      "actionType": 0, "employeeId": 100, "employeeCodeSnapshot": "NV001",
      "fieldName": "EndTime", "oldValue": "19:30", "newValue": "20:00" }
  ]
}
```
- **`approvalSteps[]`** — chuỗi bước duyệt **snapshot lúc tạo đơn**, sắp `stepOrder` tăng dần, **không** tính lại theo tổ chức hiện tại (đơn cũ giữ chuỗi dù nhân sự/cây duyệt đổi sau). `status` = `OtFormApprovalStepStatus` (§2). `candidates[]` = người đủ điều kiện duyệt bước đó tại lúc snapshot (ai xử lý trước thì tính).
  **"Bước đang chờ"** = phần tử đầu tiên có `status = 0 Pending`; `candidates[]` của nó là những người Duyệt/Từ chối được. `status` cấp đơn (`Completed`/`Rejected`) = hết, ẩn nút Duyệt/Từ chối. Không suy được "đang chờ ai" từ `OtForm.status` (chỉ 3 giá trị).
- **`approvalHistories`** — audit trail từng lần xử lý, render timeline dọc (`action` §2 quyết định icon); cũng là nguồn JSON để **FE tự dựng PDF in đơn** (khớp giấy YEV-22-024; BE không xuất PDF). Dòng `action = 2 Rejected` **không có chữ ký** (`hasSignature = false`, `signatureImage = null`), chỉ có `comment` (lý do). `hasSignature` cho biết có hiện `<img>` hay không mà không cần giải mã
  `signatureImage` (base64). `approverFullName` là snapshot lúc ký, có thể `null` → FE fallback `approverFullName ?? approverUserName` (tương tự `createdByFullName ?? createdByUserName`).
- **`approvalChainWarning`** — `string | null`, khác `null` khi chuỗi suy luận lúc tạo bị cắt cụt (Nhóm/Bộ phận chưa cấu hình cây, hoặc thiếu người giữ Chức vụ ở 1 bước): đơn vẫn tạo/duyệt tới đâu hay tới đó; FE hiện banner cảnh báo, không phải lỗi chặn.
- **`creatorSignatureImage`** — base64, `null` ở hầu hết đơn. Khác `null` khi người tạo đã ở cấp ≥ mọi Chức vụ trung gian "Bắt buộc ký" của Bộ phận lúc tạo (không còn ai khác ký ô "Người đề nghị" thay họ): BE snapshot `UserSignature` đã đăng ký của người tạo vào đây (chặn tạo đơn 400 nếu chưa đăng ký chữ ký). `OtFormPrintView.tsx` dùng nó để tự điền 1 ô "Người đề nghị" khi `approvalSteps[]` không có bước trung gian "Bắt buộc ký" nào;
  xem attendance-module.md §Cây chức vụ & Cây duyệt (mục RequiresCreatorSelfSign).
- **Ô "Tên công đoạn / 工程名" trên giấy `YEV-22-024` không có field tương ứng** (BE không lưu); FE tự dựng PDF thì **để trống ô này** — đừng dùng `groupNameVn`/`departmentNameVn` thay thế.
- `isEditable` = `status == InApproval && !approvalSteps.some(s => s.status === 1)` — điều kiện CẦN (chưa đủ) để hiện nút "Sửa", xem §4.1b.
- **`employees[].monthToDate`/`yearToDate`** — snapshot **đóng băng lũy kế dự kiến** (§3.5b) tại lúc dòng được thêm vào đơn, trước khi cộng chính đơn (không phải lũy kế sống `Employee.monthToDate`); người duyệt đối chiếu ngưỡng TH3 (mặc định > 25h/tháng, > 300h/năm, Admin đổi qua `AttendanceSetting`, §6d; `customMonthlyOtHourLimit`/`customYearlyOtHourLimit` của người đó, nếu có, thay mốc chung).
- **`employees[].mealTicketType`** — `int`: `0` Không có phiếu / `1` Phụ / `2` Chính, tính trên **giờ thực tích** `actualHours`: `< AttendanceSetting.noMealTicketMaxHours` (mặc định 2h) → 0; `< mainMealTicketMinHours` (3.5h) → 1; còn lại → 2. Ca khớp đúng khung `earlyMealWindowStartTime`/`earlyMealWindowEndTime` (mặc định 6h–8h) luôn = 1.
  BE tính sẵn, FE chỉ hiển thị (`MealTicketTypeBadge.tsx`) khi xem đơn đã lưu; riêng lúc **tạo** đơn (`OtFormEmployee` chưa tồn tại) `CreateOtFormPage.tsx` tự tính preview bằng `modules/attendance/lib/mealTicket.ts` (mirror công thức BE) cho badge và `processPart.mainTicketCount`/`secondaryTicketCount`.
- **`employees[].actualHours`** — giờ OT thực tính của người đó: `endTime - startTime`, trừ `mealBreakDeductionHours` (mặc định 0.5h) nếu `didEat = true`, **trừ ca khớp đúng khung OT sớm (luôn không trừ)**. FE (`OtFormDetail.tsx`, `OtFormBatchDetail.tsx`, `OtFormEmailConfirmPage.tsx`) dùng field này cho cột giờ và tổng giờ, không tự trừ `startTime`/`endTime`.
- **`groupNameJp`/`departmentNameJp`/`reasonNameJp`** (nullable): FE hiện `"{Vn} / {Jp}"`; tương tự `employees[].noteJp`, `processPart.anotherSuggestionJp`.
- **`editLogs[]`** — nhật ký chỉnh sửa (sửa giờ/`didEat`/ghi chú qua §4.1b, thêm/loại người), mới nhất trước. `actionType`: `0` TimeChanged / `1` NoteChanged / `2` EmployeeAdded / `3` EmployeeRemoved; `fieldName` chỉ có giá trị khi `actionType` là `0`/`1` (`"StartTime"`/`"EndTime"`/`"DidEat"`/`"NoteVn"`/`"NoteJp"`). Không ghi gì cho hành động Tạo đơn.
- **`employees[].isRemoved`/`removed*`** (§4.5a): người bị loại **vẫn nằm trong `employees[]`** để giữ dấu vết ai loại/lúc nào/lý do; FE tự lọc `isRemoved === true` ra khỏi tổng giờ OT, bản in PDF A4/A5 và trang xem trước qua email. `removedAtLevel` = `stepOrder` của bước đang chờ lúc loại — tra tên bước bằng phần tử `approvalSteps[]` có `stepOrder` khớp (`jobTitleNameSnapshot`).
  `numberOfEmployee` (cả `OtFormDto` lẫn `OtFormListItemDto`) chỉ đếm người **chưa** bị loại.

### 4.4 `POST /api/OtForm/{id}/approve`
```jsonc
// body — ApproveOtFormDto
{ "comment": null, "secondaryPassword": "..." }   // comment optional, secondaryPassword [Required]
```
- **Không có `signatureImage` trong body**: chữ ký cấp duyệt BE tự lấy từ `UserSignature` đã đăng ký của chính người duyệt (`GET/PUT /api/UserSignature/me`, §6) và snapshot vào `OtFormApprovalHistory.signatureImage` lúc duyệt.
- **Phải đã đăng ký chữ ký nếu bước đang chờ có `requiresSignatureSnapshot = true`** (đọc từ `approvalSteps[]` của chính đơn, FE biết trước mà không cần gọi `GET /api/OtCase/{id}`) — chưa đăng ký (`GET /UserSignature/me` 404) → duyệt 400 "…bắt buộc phải ký khi duyệt. Vui lòng đăng ký chữ ký…".
- **`secondaryPassword`** phải khớp mật khẩu cấp 2 đã đăng ký (mọi bước duyệt, §6c); chưa thiết lập/sai → 400 (§9).
- 400 nếu: đơn đã `Completed`/`Rejected`; không còn bước `Pending`; người gọi không nằm trong `candidates[]` của bước đang chờ.
- Thành công → bước đang chờ chuyển `Approved`; hết bước `Pending` → `OtForm.status = Completed` + cộng sổ lũy kế; còn bước → gửi mail (cấp trung gian) cho `candidates[]` bước kế tiếp (3 cấp quản lý nhận qua mail tổng hợp, §6e). Response `data: true`; FE gọi lại `GET /{id}` để refresh.

### 4.5 `POST /api/OtForm/{id}/reject`
```jsonc
// body — RejectOtFormDto
{ "comment": "Thiếu chứng từ, cần xác nhận lại.", "secondaryPassword": "..." }   // cả 2 field [Required]
```
Bước đang chờ chuyển `Rejected`, mọi bước `Pending` còn lại chuyển `Skipped`, `OtForm.status → Rejected`, dừng hẳn luồng; người lập đơn nhận mail báo. Không có chữ ký, không cộng lũy kế.

### 4.5a `POST /api/OtForm/{id}/employees/remove` — loại 1 nhân viên khỏi đơn ngay trên màn Duyệt

```jsonc
// body — RemoveOtFormEmployeeDto
{ "employeeId": 100, "reason": "Không đủ điều kiện tăng ca đợt này." }   // KHÔNG có secondaryPassword
```
Quyền `Attendance.OTForm.RemoveEmployee`; authorize thật nằm ở `RemoveEmployeeCoreAsync`: Admin, hoặc người có tên trong `candidates` của bước `Pending` nhỏ nhất — **cùng một luật cho đơn theo Nhóm lẫn theo chuyền** (khác `PUT /{id}` đơn theo Nhóm chỉ người tạo được). Không cần `secondaryPassword`, không đổi `OtForm.Status`, không huỷ chữ ký các bước trước,
tính lại `numberOfEmployee` và số phiếu ăn; 400 nếu đơn không còn `InApproval` hoặc chỉ còn ≤ 1 người chưa bị loại (dùng Từ chối cả đơn). Trả `data: OtFormDto` đầy đủ, ghi `OtFormEditLog` (`EmployeeRemoved`), báo người lập đơn qua mail.
**Kênh email** `POST /api/OtForm/email-confirm/{token}/employees/remove` dùng chung lõi, body `RemoveOtFormEmployeeByEmailTokenDto` (`{ employeeId, reason }`, cũng không có `secondaryPassword`), **không tiêu token** (loại nhiều người rồi mới Duyệt/Từ chối bằng cùng link). FE: `OtFormDetail.tsx` và `OtFormEmailConfirmPage.tsx`; thiết kế: attendance-module.md §Loại nhân viên khỏi đơn.

### 4.6 Duyệt/Từ chối qua email — kênh BỔ SUNG, không thay thế §4.4/§4.5

Khi đơn tới lượt một bước **cấp trung gian**, BE tự gửi email cho **từng người** trong `candidates[]` (ai bấm trước thì xử lý); mail chứa link `{FrontendBaseUrl}/xac-nhan-don?token=xxx`. **FE tự xây trang public** tại route này (không cần đăng nhập SPA, token tự là thông tin xác thực).
Ba cấp quản lý (Trưởng phòng/Trưởng Xưởng/Giám đốc) **không** nhận mail riêng này mà nhận mail tổng hợp hằng ngày với link `/xac-nhan-don-tong` (§6e). Template `ApprovalNotification.html` song ngữ Việt/Nhật (nhãn "Phòng ban / 部署", dữ liệu `"{Vn} / {Jp}"`).

| Method | Route | Việc gì |
|---|---|---|
| GET | `/api/OtForm/email-confirm/{token}` | Trả `OtFormDto` đầy đủ (như §4.3) để hiện chi tiết trên trang xác nhận |
| POST | `/api/OtForm/email-confirm/{token}/approve` | Body `ApproveOtFormDto` (`{ "comment": null, "secondaryPassword": "..." }`) — duyệt |
| POST | `/api/OtForm/email-confirm/{token}/reject` | Body `RejectOtFormDto` (`{ "comment": "...", "secondaryPassword": "..." }`, cả 2 [Required]) — từ chối |
| POST | `/api/OtForm/email-confirm/{token}/employees/remove` | Body `{ "employeeId", "reason" }` (không `secondaryPassword`) — loại 1 nhân viên (§4.5a); trả `OtFormDto`, **không tiêu token** |

**Trang xác nhận** (route public, không nằm trong menu): hiện chi tiết đơn y hệt màn "Chi tiết đơn" (dùng chung component), ô Ghi chú (chỉ khi Duyệt, không bắt buộc), nút **Từ chối** và **Duyệt**.
- **Từ chối mở popup nhập lý do** (ô "Lý do từ chối" bắt buộc, nút "Huỷ"/"Xác nhận từ chối", cùng UX modal ở màn Chi tiết đơn) để tránh bấm nhầm; "Duyệt" gửi thẳng kèm ô Ghi chú ngoài popup.
- Cả hai nút gọi đúng logic `approve`/`reject` trong app, **không cần canvas ký** (chữ ký lấy từ `UserSignature` đã đăng ký của người đó).
- **Bắt buộc có ô "Mật khẩu cấp 2"** cho cả Duyệt lẫn popup Từ chối (§6c). Trang public không có JWT nên không kiểm tra trước được; lỗi "chưa thiết lập"/"sai mật khẩu" chỉ hiện sau khi bấm, qua message BE.
- Token gắn với **đúng 1 người + 1 bước** tại lúc gửi mail; đơn đã được xử lý trước (hoặc đổi bước) thì bấm link cũ nhận 400 "Đơn đã xử lý xong…" rõ ràng, FE không cần tự kiểm tra trạng thái.
- Token hết hạn sau **3 ngày** hoặc đã dùng (Duyệt/Từ chối, cái nào trước) → gọi lại bất kỳ API nào trong nhóm này trả 400/404 (§9). Sau khi Duyệt/Từ chối, nếu còn bước tiếp theo BE tự gửi mail tiếp, FE không cần làm gì thêm.

## 6. UserSignature (`/api/UserSignature`) — chữ ký cá nhân

Mỗi user tự đăng ký 1 chữ ký (ảnh) — **BE tự lấy chữ ký này khi duyệt đơn** (và khi người tạo tự ký ô "Người đề nghị", §4.3); body `CreateOtFormDto`/`ApproveOtFormDto` không nhận `signatureImage` (§4.1/§4.4). `UserSignature` KHÔNG phải nguồn audit — nguồn thật để hiển thị/in lại luôn là `OtFormApprovalHistory.signatureImage`, bản **snapshot đóng băng** tại đúng thời điểm ký (§4.3): nếu user đổi chữ ký mới sau này, các đơn đã ký trước đó vẫn giữ nguyên ảnh chữ ký cũ, không bị đổi theo.

> ⚠️ `PUT /me` **không áp dụng chữ ký ngay** mà gửi email xác nhận — xem §6b (quan trọng nhất cho màn "Cài đặt chữ ký").

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/me` | `Attendance.UserSignature.Update` | Xem chữ ký **đang có hiệu lực** của chính mình (chữ ký cũ, chưa đổi) |
| PUT | `/me` | `Attendance.UserSignature.Update` | **Yêu cầu** cập nhật chữ ký — gửi email xác nhận, KHÔNG áp dụng ngay (§6b) |
| GET | `/{userName}` | `Attendance.UserSignature.View` | Admin xem chữ ký người khác |

```jsonc
// UserSignatureDto
{ "userName": "YEV\\n.van.a", "signatureImage": "iVBORw0KG...", "updatedAt": "2026-07-14T09:00:00Z" }
```

### 6b. Xác nhận cập nhật chữ ký qua email

**Lý do**: đổi chữ ký ảnh hưởng tính pháp lý của mọi đơn ký sau đó — bắt buộc tự xác nhận qua kênh thứ 2 (email) để chống trường hợp ai đó chiếm phiên đăng nhập rồi đổi chữ ký hộ người khác.

```jsonc
// PUT /me body — UpsertUserSignatureDto: { "signatureImage": "..." }  // [Required] base64
// response: { "isSuccess": true, "data": true,
//   "message": "Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư trong 30 phút." }
```

Sau khi gọi `PUT /me`, BE gửi email tới **địa chỉ email của chính user gọi API** (tự resolve từ Active Directory lúc đăng nhập, FE không truyền/thấy được email này) — nội dung có link dạng `{FrontendBaseUrl}/xac-nhan-chu-ky?token=xxx`. **FE phải tự xây trang public tại route này** (không cần đăng nhập SPA — token tự nó là thông tin xác thực), gọi 2 API sau:

| Method | Route | Auth | Việc gì |
|---|---|---|---|
| GET | `/api/UserSignature/confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xem trước — trả `userName`, `signatureImage` (ảnh chữ ký ĐANG CHỜ xác nhận), `expiresAt` |
| POST | `/api/UserSignature/confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xác nhận thật — áp dụng chữ ký, trả về `UserSignatureDto` mới |

```jsonc
// GET /confirm/{token} — SignatureConfirmationPreviewDto
{ "userName": "YEV\\n.van.a", "signatureImage": "iVBORw0KG...", "expiresAt": "2026-07-16T05:30:00Z" }
// POST /confirm/{token} — trả UserSignatureDto
{ "userName": "YEV\\n.van.a", "signatureImage": "iVBORw0KG...", "updatedAt": "2026-07-16T05:05:00Z" }
```

**Trang xác nhận gợi ý** (route public, không nằm trong menu điều hướng chính — chỉ mở qua link email):
```
[Xem preview: ảnh chữ ký mới đang chờ xác nhận]
"Bạn có xác nhận cập nhật chữ ký này không? Link hết hạn lúc {expiresAt}."
[ Xác nhận cập nhật ]
```
- Link hết hạn sau **30 phút** (`expiresAt`) hoặc đã dùng 1 lần (`ConfirmedAt` khác null) → gọi `GET`/`POST` trả 400/404, hiện thông báo lỗi rõ ràng thay vì crash trang (xem §9).
- KHÔNG có nút "Từ chối" ở trang này — không xác nhận thì đơn giản là bỏ qua email, chữ ký cũ vẫn giữ nguyên hiệu lực, không cần gọi API nào để "hủy".
- Sau khi xác nhận thành công, gợi ý điều hướng user quay lại app (không tự động đăng nhập — vẫn cần JWT bình thường để dùng tiếp).

## 6c. SecondaryPassword (`/api/SecondaryPassword`) — mật khẩu cấp 2 khi ký/duyệt

**Lý do**: lớp xác thực bổ sung (như PIN giao dịch) cho hành vi có giá trị pháp lý. Mỗi user tự đăng ký 1 mật khẩu cấp 2 riêng (khác mật khẩu đăng nhập AD) và phải nhập lại ở **mọi** thao tác ký/duyệt/ghi đơn: `POST /api/OtForm` (tạo), `PUT /{id}` (sửa), `POST /{id}/approve`, `POST /{id}/reject`, `bulk-approve`/`bulk-reject`,
`POST /api/OtFormBatch/{id}/approve`, **kể cả kênh email** `email-confirm/{token}/approve|reject` (§4.6). **Không** cần ở loại nhân viên (`employees/remove`, §4.5a). BE verify qua field `secondaryPassword` trước khi ghi bất kỳ thay đổi nào.

Cùng pattern tự đăng ký + xác nhận qua email như `UserSignature` (§6/§6b) — **KHÔNG** áp dụng ngay,
chỉ gửi email xác nhận, giá trị cũ (nếu có) vẫn còn hiệu lực cho tới khi user tự bấm xác nhận.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/me` | `Attendance.SecondaryPassword.Update` | Xem trạng thái mật khẩu cấp 2 của chính mình — **KHÔNG** bao giờ trả hash/plaintext, chỉ `isRegistered`/`updatedAt` |
| PUT | `/me` | `Attendance.SecondaryPassword.Update` | **Yêu cầu** thiết lập/cập nhật mật khẩu cấp 2 — gửi email xác nhận, KHÔNG áp dụng ngay |
| GET | `/confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xem trước — trả `userName`, `expiresAt` (KHÔNG trả lại mật khẩu) |
| POST | `/confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xác nhận thật — áp dụng mật khẩu cấp 2 |

```jsonc
// GET /me — SecondaryPasswordStatusDto
{ "isRegistered": true, "updatedAt": "2026-07-30T02:00:00Z" }   // updatedAt: null nếu chưa đăng ký

// PUT /me body — UpsertSecondaryPasswordDto: { "password": "..." }  // [Required][MinLength(6)]
// response: { "isSuccess": true, "data": true,
//   "message": "Đã gửi email xác nhận thiết lập mật khẩu cấp 2 — vui lòng kiểm tra hộp thư trong 30 phút." }

// GET /confirm/{token} — SecondaryPasswordConfirmationPreviewDto
{ "userName": "YEV\\n.van.a", "expiresAt": "2026-07-30T02:30:00Z" }
// POST /confirm/{token} — { "isSuccess": true, "data": true, "message": "Xác nhận thiết lập mật khẩu cấp 2 thành công." }
```

- Link email tới `{FrontendBaseUrl}/xac-nhan-mat-khau-cap-2?token=xxx` (route public riêng, mirror
  `/xac-nhan-chu-ky` ở §6b) — hết hạn sau **30 phút** hoặc đã dùng 1 lần, cùng luật lỗi như §6b.
- **Chưa thiết lập mà vào ký/duyệt** → 400 "Bạn chưa thiết lập mật khẩu cấp 2. Vui lòng thiết lập
  trước khi ký duyệt đơn." — FE nên chủ động gọi `GET /me` khi mở modal Ký/Duyệt/Từ chối trong app
  (như đã làm với `UserSignatureApi.getMySignature()`) để cảnh báo sớm, link sang `/ot/secondary-password`.
- **Permission `Attendance.SecondaryPassword.Update`**: nằm trong whitelist theo Chức vụ (cấp theo Chức vụ hoặc từng user); không có permission `.View` riêng (không có nhu cầu xem hộ mật khẩu người khác).

## 6d. AttendanceSetting (`/api/AttendanceSetting`) — cấu hình phiếu ăn & giới hạn lũy kế

Cấu hình dùng chung 1 dòng (ngưỡng phiếu ăn, mốc giờ OT, giờ gom Đơn tổng), Admin sửa qua tab "Cấu hình" trong `/ot/categories`, không cần deploy lại khi chính sách đổi.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/AttendanceSetting` | **Không cần** (mọi tài khoản đăng nhập) | Đọc cấu hình hiện hành |
| PUT | `/api/AttendanceSetting` | `Attendance.Setting.Update` (chỉ Admin) | Sửa cấu hình |
| POST | `/api/AttendanceSetting/test-email` | `Attendance.Setting.Update` (chỉ Admin) | Gửi 1 email mẫu tới địa chỉ tự nhập, kiểm tra SMTP + font/layout |

```jsonc
// SendTestEmailDto — body POST test-email
{ "email": "ten@yev.vn" }  // string, [Required] + [EmailAddress]
// Response data: boolean — luôn true nếu HTTP 200 (BE trả Fail (400) kèm message nếu SMTP gửi thất
// bại, không có trường hợp response 200 với data=false).
```

```jsonc
// AttendanceSettingDto — response GET, body PUT (cùng shape). 5 field đầu: phiếu ăn 3 bậc + khung OT sớm (attendance-module.md §Phiếu ăn).
{
  "mainMealTicketMinHours": 3.5,      // decimal, [Range(0.5, 24)] — thực tích từ mốc này = phiếu CHÍNH
  "noMealTicketMaxHours": 2,          // decimal, [Range(0, 24)] — thực tích dưới mốc này = KHÔNG phiếu
  "mealBreakDeductionHours": 0.5,     // decimal, [Range(0, 4)] — số giờ trừ khi có ăn
  "earlyMealWindowStartTime": "06:00:00",  // TimeOnly "HH:mm:ss", [Required] khi PUT
  "earlyMealWindowEndTime": "08:00:00",    // TimeOnly "HH:mm:ss", [Required] khi PUT
  "dailyOtHourLimit": 4,           // decimal, [Range(0.5, 24)] khi PUT — chặn cứng ngày làm việc
  "monthlyOtHourLimit": 25,        // decimal, [Range(1, 744)] khi PUT — lũy kế tháng vượt mốc này => BẮT BUỘC TH3 (không chặn)
  "yearlyOtHourLimit": 300,        // decimal, [Range(1, 8784)] khi PUT — lũy kế năm vượt mốc này => BẮT BUỘC TH3 (không chặn)
  "dailyOtHourLimitHoliday": 12,   // decimal, [Range(0.5, 24)] khi PUT — mốc ngày dùng khi ngày đó nằm trong lịch ngày nghỉ (§6d-2)
  "batchAutoSendTime": "15:00:00"  // TimeOnly "HH:mm:ss", [Required] khi PUT — giờ gom Đơn tổng hằng ngày, xem §6e
}
```

- **`GET` cố tình KHÔNG gắn permission** — màn Tạo đơn của người không có quyền quản trị vẫn phải đọc cấu hình để tự tính phiếu ăn (§4.1) và tô đỏ lũy kế vượt ngưỡng. Chỉ **SỬA** cần `Attendance.Setting.Update`.
- **3 bậc phiếu ăn**: thực tích `< noMealTicketMaxHours` → không phiếu; `< mainMealTicketMinHours` → Phụ; còn lại → Chính. Áp dụng cho `OtFormEmployeeDto.mealTicketType` (BE tính) và `processPart.mainTicketCount`/`secondaryTicketCount` (FE tính preview ở `CreateOtFormPage.tsx` qua `modules/attendance/lib/mealTicket.ts`, người dùng sửa tay được — §4.1).
- **`mealBreakDeductionHours`** — số giờ trừ khỏi giờ thô khi `didEat = true`, áp dụng ở mọi mức giờ.
- **`earlyMealWindowStartTime`/`earlyMealWindowEndTime`** — khung OT sớm đặc cách (mặc định 6h–8h): ca có `startTime`/`endTime` khớp **đúng** 2 mốc này luôn nhận phiếu Phụ và **không** bị trừ `mealBreakDeductionHours`, bất kể `didEat`.
- **`dailyOtHourLimit`/`dailyOtHourLimitHoliday`** — **CHẶN CỨNG** `POST`/`PUT /api/OtForm`: tổng giờ OT thực tích
  của 1 nhân viên trong đúng ngày (cộng mọi đơn/ca trong ngày, kể cả giờ của đơn đang tạo/sửa) vượt mốc
  thì BE trả 400 liệt kê nhân viên vi phạm (xem `OtFormService.ValidateOtHourLimitsAsync`). Ngày nằm trong
  lịch ngày nghỉ (§6d-2) dùng `dailyOtHourLimitHoliday`, còn lại dùng `dailyOtHourLimit`.
- **`monthlyOtHourLimit`/`yearlyOtHourLimit`** — KHÔNG chặn: vượt thì đơn bắt buộc là TH3 (§6d-2). Badge/pill
  đỏ ở `EmployeeList.tsx`/`CreateOtFormPage.tsx`/`OtFormDetail.tsx`/`OtFormBatchDetail.tsx`/
  `OtFormPrintView.tsx` là cảnh báo SỚM. Lũy kế không sửa qua `PUT /Employee/{id}` (sửa tay có route riêng, §3.5c).
- **FE cache dùng chung** (`useAttendanceSetting.ts`) — 1 promise cấp module, không gọi lại API mỗi màn
  mount; gọi `invalidateAttendanceSettingCache()` sau khi Admin lưu cấu hình mới để các màn mở sau đó
  thấy ngay, không cần F5 cả trang.
- **Trang public qua email** (`OtFormEmailConfirmPage.tsx`, không JWT) **không gọi được endpoint này**
  — dùng cứng giá trị mặc định (`DEFAULT_ATTENDANCE_SETTING`: 25h/300h) cho màu cảnh báo lũy kế; chỉ là gợi ý hiển thị, không quyết định nghiệp vụ.
- Thành công → `data` = `AttendanceSettingDto` đầy đủ (cả GET lẫn PUT).

## 6d-2. Lịch ngày nghỉ (`/api/WorkCalendar`) + Trường hợp OT tự động

Lịch ngày nghỉ của công ty (Chủ nhật, ngày lễ, nghỉ đặc biệt). Ngày CÓ dòng trong lịch = ngày nghỉ, ngày
không có dòng = ngày làm việc. Năm chưa import lịch thì mọi ngày là ngày làm việc.

| Method | Route | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/WorkCalendar?year=2026` | mọi tài khoản đăng nhập | `WorkCalendarDayDto[]` sắp theo ngày |
| GET | `/api/WorkCalendar/template?year=2026` | mọi tài khoản đăng nhập | file `.xlsx` mẫu: toàn bộ Chủ nhật của năm + các ngày đã lưu |
| POST | `/api/WorkCalendar/import?year=2026` | `Attendance.Setting.Update` | multipart `file`; **thay thế toàn bộ** lịch của năm, all-or-nothing |

```jsonc
// WorkCalendarDayDto
{ "date": "2026-02-16", "dayType": 2, "note": null }   // dayType: 1 Chủ nhật, 2 Ngày lễ, 3 Nghỉ đặc biệt
```

File Excel: sheet "Lịch nghỉ", hàng 1 là tiêu đề (`Ngày` · `Loại` · `Ghi chú`), từ hàng 2 mỗi dòng 1 ngày.
`Loại` chỉ nhận `Chủ nhật` / `Ngày lễ` / `Nghỉ đặc biệt`. Ngày phải thuộc đúng năm import, không trùng. Có
bất kỳ dòng lỗi nào thì không ghi gì và trả 400 liệt kê tối đa 10 lỗi.

**Trường hợp OT (`otCaseId`) do hệ thống quyết định**, `POST /api/OtForm` (cả Theo Nhóm lẫn Theo chuyền)
trả 400 nếu `otCaseId` gửi lên không khớp:

1. Có nhân viên nào mà lũy kế tháng hoặc năm (đã cộng giờ của chính đơn) vượt `monthlyOtHourLimit` /
   `yearlyOtHourLimit` (ưu tiên mốc riêng `customMonthlyOtHourLimit`/`customYearlyOtHourLimit` của nhân
   viên nếu có) → **TH3**. Lũy kế ngày không bao giờ ép TH3.
2. Ngược lại, ngày của đơn nằm trong lịch ngày nghỉ → **TH2**, còn lại → **TH1**.

Chỉ mốc **ngày** còn chặn cứng, và cũng đổi theo lịch: ngày nghỉ dùng `dailyOtHourLimitHoliday`, ngày làm việc dùng
`dailyOtHourLimit`. `PUT /api/OtForm/{id}` không đổi Trường hợp OT: nếu giờ sửa khiến nhân viên vượt mốc
tháng/năm mà đơn chưa phải TH3 thì trả 400. FE (`CreateOtFormPage.tsx`) tự điền và khoá ô Trường hợp OT
theo đúng các luật này.

## 6e. Đơn tổng (`/api/OtFormBatch`) — gom nhiều đơn theo cấp quản lý, duyệt 1 lần

**Ý tưởng**: ba cấp quản lý (Trưởng phòng `terminalLevel = 1`, Trưởng Xưởng `2`, Giám đốc `3`) **không** nhận mail riêng từng đơn mà nhận **1 mail tổng hợp/ngày**. Mỗi ngày vào `AttendanceSetting.batchAutoSendTime` (mặc định **15:00**, Admin đổi ở tab Cấu hình, §6d) hệ thống gom các đơn **mới, chưa từng vào batch nào** mà bước đang chờ thuộc 1 trong 3 cấp đó thành
"Đơn tổng": cấp Trưởng phòng gom theo từng Phòng ban (`departmentId` có giá trị); cấp Trưởng Xưởng/Giám đốc gom **toàn công ty**, 1 batch/cấp/ngày (`departmentId = null`). Người duyệt bấm vào duyệt cả loạt một lần. Batch chưa xử lý xong được gửi **mail nhắc mỗi ngày** (không tạo batch mới, không gộp thêm đơn; 1 đơn chỉ thuộc đúng 1 batch).
Đơn còn kẹt ở bước cấp trung gian trước đó không được gom, vẫn duyệt lẻ và nhận mail riêng. Thiết kế BE: attendance-module.md §Đơn tổng.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtFormBatch/grid-list?pageIndex&pageSize` | `Attendance.OTForm.Approve` | Danh sách batch (Admin thấy tất cả; còn lại chỉ thấy batch mình là candidate hợp lệ — DepartmentManager so theo đúng Department, WorkshopManager/GeneralDirector company-wide nên chỉ cần khớp cấp) |
| GET | `/api/OtFormBatch/{id}` | `Attendance.OTForm.Approve` | Chi tiết 1 batch |
| POST | `/api/OtFormBatch/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt/Từ chối hàng loạt |
| GET | `/api/OtFormBatch/email-confirm/{token}` | `[AllowAnonymous]` | Chi tiết qua link email |
| POST | `/api/OtFormBatch/email-confirm/{token}/approve` | `[AllowAnonymous]` | Duyệt/Từ chối qua link email |
| POST | `/api/OtFormBatch/run-now` | `Attendance.Setting.Update` | Chạy ngay đợt gom hằng ngày (nút "Gửi ngay" ở tab Cấu hình; body rỗng, response `data: true`) — **gửi mail thật** nếu đang có batch `Pending` |

```jsonc
// OtFormBatchListItemDto — item của grid-list. terminalLevel: enum JobTitleTerminalLevel
// (1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector). departmentId chỉ có giá trị khi
// terminalLevel=1 (DepartmentManager) — null nghĩa là batch company-wide; scopeNameVn/Jp lúc đó là
// tên Chức vụ ứng với cấp đó (JobTitle không có bản Jp nên scopeNameJp luôn null trong trường hợp này).
{
  "id": 12, "terminalLevel": 1, "departmentId": 1, "scopeNameVn": "Xưởng lắp ráp", "scopeNameJp": null,
  "batchDate": "2026-08-06", "status": 0,           // OtFormBatchStatus: 0=Pending, 1=Processed
  "formCount": 3, "employeeCount": 8, "totalHour": 14.5,
  "createdAt": "2026-08-06T15:00:00", "processedAt": null, "processedByFullName": null
}

// OtFormBatchDto — response GET /{id} (và /email-confirm/{token})
{
  "id": 12, "terminalLevel": 1, "departmentId": 1, "scopeNameVn": "Xưởng lắp ráp", "scopeNameJp": null,
  "batchDate": "2026-08-06", "status": 0,
  "createdAt": "2026-08-06T15:00:00", "processedAt": null, "processedByUserName": null, "processedByFullName": null,
  "otForms": [   // CHỈ gồm đơn vẫn còn status==Pending (còn hiệu lực xử lý)
    {
      "otFormId": 101, "groupNameVn": "Nhóm 1", "groupNameJp": null,
      "reasonNameVn": "Tăng ca sản xuất gấp", "reasonNameJp": null, "otCaseCode": "TH1",
      "date": "2026-08-06", "startTime": "17:30:00", "endTime": "20:00:00", "subReason": null, "totalHour": 2.5,
      "createdByUserName": "nva", "createdByFullName": "Nguyễn Văn A", "numberOfEmployee": 3,
      "processPart": { "isEat": true, "mainTicketCount": 2, "secondaryTicketCount": 1, "milkCount": 0,
                        "isTransportation": false, "isUseCopyRoom": false,
                        "anotherSuggestionVn": null, "anotherSuggestionJp": null },  // null nếu tạo đơn không gửi, xem §4.1
      "employees": [ /* OtFormEmployeeDto[] — chỉ nhân viên ĐANG active, xem §4.3 */ ]
    }
  ]
}
```
- Mỗi phần tử `otForms[]` có đủ dữ liệu (kể cả `subReason`, `processPart`, `employees[]` dạng `OtFormEmployeeDto` đầy đủ: `monthToDate`/`yearToDate`/`mealTicketType`/`actualHours`/`didEat`/`noteVn`/`noteJp`) để FE render ở mức chi tiết của `OtFormDto` (§4.3), cho cả trong app lẫn trang public qua email (dùng chung 1 component).

- **Duyệt hàng loạt** — body `ProcessOtFormBatchDto`:
  ```jsonc
  {
    "secondaryPassword": "••••••",
    "forms": [
      { "otFormId": 101, "decision": 0, "rejectReason": null, "excludedEmployeeIds": [5] }, // 0=Approve, loại nhân viên id=5
      { "otFormId": 102, "decision": 1, "rejectReason": "Không đủ định biên", "excludedEmployeeIds": null } // 1=Reject cả đơn
    ]
  }
  ```
  `forms[]` **phải khớp CHÍNH XÁC** (không thiếu/thừa) tập `otFormId` đang có trong `otForms[]` của batch
  lúc `GET` — thiếu 1 đơn hoặc thừa 1 `otFormId` không thuộc batch → 400. `decision=1` (Reject) bắt buộc
  `rejectReason`. `decision=0` (Approve) mà `excludedEmployeeIds` khiến đơn còn 0 người active → 400,
  báo dùng `decision=1` cho đơn đó thay vì bỏ chọn hết (khớp giới hạn sẵn có của "Loại nhân viên khỏi
  đơn", §4.5a — không xoá được người cuối cùng). Thành công → `data` = `OtFormBatchDto` đã cập nhật
  (`status=1 Processed`, `otForms` rỗng vì mọi đơn thành viên không còn `Pending` nữa).
- Mỗi đơn `decision=0` vẫn tiếp tục đúng luồng duyệt hiện có (`POST /OtForm/{id}/approve` nội bộ) — nếu
  `OtCase.RequiredApprovalLevel` cần thêm cấp (Trưởng xưởng/TGĐ) thì đơn đó vẫn nhận mail duyệt tiếp như
  bình thường, KHÔNG kết thúc ngay ở bước Trưởng phòng chỉ vì đã qua "Đơn tổng".
- Quyết định Approve không có ô comment — chỉ `decision = 1` mới có `rejectReason`. Các người bị loại (`excludedEmployeeIds`) được ghi lý do cố định "Loại khi duyệt Đơn tổng" và người lập đơn nhận 1 mail/đơn.
- Màn "Đơn tổng" trong app (`/ot/batches`, gate `Attendance.OTForm.Approve`) dự phòng khi người duyệt mất/quên link email; danh sách rỗng tự nhiên nếu người dùng không phải candidate ở cấp nào, không cần ẩn mục menu.
- Trang public `/xac-nhan-don-tong?token=...` (FE tự xây, không đăng nhập SPA) — cùng nguyên tắc
  `/xac-nhan-don` (§4.6): token là thông tin xác thực duy nhất, không nằm trong sơ đồ menu.

## 7. Tổng hợp endpoint

| Route | Ghi chú |
|---|---|
| `/api/Department`, `/api/Reason`, `/api/OtCase`, `/api/JobTitle`, `/api/Group` | CRUD chuẩn (§3.1–§3.4b); `Group/by-department/{id}` cascading; `JobTitle/reorder` (kéo-thả xếp hạng); `JobTitle/resolve-chain` xem trước chuỗi duyệt (§3.4d) |
| `/api/DepartmentApprovalStep/by-department/{departmentId}`, `/api/GroupApprovalStep/by-group/{groupId}`, `/api/ProductionApprovalStep/by-department/{departmentId}` | GET / PUT (thay nguyên danh sách) cây duyệt cấp cuối / cấp trung gian / theo chuyền (§3.4c → §3.4c-3) |
| `/api/DepartmentApprovalStepCoordinator/by-department/{id}`, `/api/GroupApprovalStepCoordinator/by-group/{id}` | GET / PUT (thay nguyên danh sách) Người phụ trách Cây duyệt; chỉ Admin sửa bảng gán (§3.4c-4) |
| `/api/JobTitlePermission/by-job-title/{id}`, `/allowed-codes` | Quyền tự cấp theo Chức vụ (§3.4e) |
| `/api/Employee` | CRUD + `all`, `by-group`, `by-department`, `by-username`, `my-scope`, `in-my-scope`, `{id}/department-job-title`, `{id}/group-job-title`, `{id}/ot-limit`, `{id}/accumulation-history` (+`/manage`), `resync-coordinator-permissions` — bảng đầy đủ ở §3.5 |
| `/api/EmployeeImport` | `preview`, `confirm` (§3.7); `ot-hour-limits`, `monthly-accumulation` (+`/template`) (§3.7b) |
| `/api/EmployeeIdentityLinkImport` | `preview`, `confirm` (nhận file), `template` — liên kết Employee ↔ Identity User (§3.7b), gate `Identity.User.BulkImport` |
| `/api/ProductionEmployeeImport`, `/api/ProductionEmployeeExport`, `/api/ProductionEmployee` | Import/Export nhân sự dưới chuyền (§3.8); `search`, `line-options`, `team-options`, `shift-team-options` cho màn "Theo chuyền"; `page-nation`, `PUT {id}` cho màn "Nhân viên dưới chuyền" (§3.8b) |
| `/api/OtForm` | Bảng route ở §4: tạo/sửa/xoá, 5 danh sách, chi tiết, duyệt/từ chối (đơn lẻ và hàng loạt), loại nhân viên, kênh email |
| `/api/OtFormBatch` | Đơn tổng (§6e) |
| `/api/UserSignature`, `/api/SecondaryPassword` | `me` (GET/PUT), `confirm/{token}` (GET/POST, public); `UserSignature/{userName}` (xem hộ, `UserSignature.View`) — §6, §6b, §6c |
| `/api/AttendanceSetting` | GET (mọi tài khoản đăng nhập), PUT + `test-email` (Admin) — §6d |
| `/api/WorkCalendar` | Lịch ngày nghỉ (§6d-2) |
| `/api/ProductionOtReport` | Báo cáo dưới chuyền theo ngày (§11), gate `Attendance.ProductionOtReport.View` |
| `/api/AttendanceAiChat/stream` | AI Chat lập đơn (§10) |

## 8. Checklist FE — màn hình chính

**"Tạo đơn tăng ca — theo Nhóm"**
1. `GET /OtForm/my-create-scopes`: 1 phần tử → điền sẵn và khoá Bộ phận/Nhóm; rỗng + Admin → dropdown tự do (`Department/all`, `Group/by-department/{id}`); rỗng + không phải Admin → chặn màn (§4.0a). Lý do ← `Reason/all`; Trường hợp OT do hệ thống suy ra (§6d-2), FE điền và khoá.
2. Chọn nhân viên ← `Employee/by-group/{groupId}?date=<ngày trên đơn>` (gọi lại khi đổi ngày); dùng `projected*` để cảnh báo mốc ngày/tháng/năm (§3.5b); `POST /OtForm/check-overlap` để báo trùng giờ.
3. Nhập mật khẩu cấp 2 → `POST /api/OtForm` → điều hướng sang chi tiết bằng `data` trả về (§4.1).

**"Tạo đơn tăng ca — theo chuyền"** (tab "Theo chuyền", cần `OTForm.CreateProduction`): `GET /OtForm/my-production-create-scopes` để điền/khoá Bộ phận và Team/Line/Nhóm ca (§4.0b); chọn nhân viên qua `GET /ProductionEmployee/search?...&date=`; `POST /api/OtForm` với `isProductionForm: true` (§4.1).

**Màn "Đơn tăng ca"** (1 màn, tối đa 5 tab, ẩn tab thiếu quyền; bộ lọc chung §4.2): "Đơn của tôi" (`my-forms`, nút Sửa khi §4.2 `isEditable` + là người tạo), "Chờ tôi duyệt" (`pending-approvals`, kèm lịch mini `/dates`, duyệt/từ chối hàng loạt), "Tôi đã xử lý" (`my-actions`), "Tôi có tên trong đơn" (`my-participations`, chỉ xem),
"Tất cả đơn" (`all-forms`, Admin).

**Chi tiết đơn / Duyệt**: `GET /{id}` → timeline `approvalHistories`, bước đang chờ = phần tử `approvalSteps[]` đầu tiên có `status = 0` (§4.3).
- "Duyệt": `POST /{id}/approve` (`comment?`, `secondaryPassword`); nếu bước đang chờ có `requiresSignatureSnapshot` mà người duyệt chưa đăng ký chữ ký thì nhắc sang "Cài đặt chữ ký" trước khi cho bấm. "Từ chối": bắt buộc `comment`.
- "Loại khỏi đơn" (§4.5a): nút riêng từng dòng nhân viên, ẩn nếu chỉ còn 1 người chưa bị loại, modal riêng chỉ có ô lý do (không mật khẩu cấp 2); response là `OtFormDto` mới. Sau duyệt/từ chối gọi lại `GET /{id}`.
- "Sửa" (đơn của mình, hoặc đơn theo chuyền khi mình là candidate bước hiện tại): form Tạo đổ sẵn dữ liệu → `PUT /{id}` (§4.1b).

**"Đơn tổng"** (`/ot/batches`, §6e): danh sách batch; chi tiết; duyệt/từ chối từng đơn kèm `excludedEmployeeIds`; trang public `/xac-nhan-don-tong?token=` dùng chung component.

**"Cài đặt chữ ký"** (`/ot/signature`): `GET /UserSignature/me` hiện preview, chọn **file ảnh** (`<input type="file">`, không phải canvas) → base64 → `PUT /me` → hiện "đã gửi email xác nhận, kiểm tra hộp thư trong 30 phút" (chữ ký chưa đổi nên không refresh preview).
**"Mật khẩu cấp 2"** (`/ot/secondary-password`): `GET /SecondaryPassword/me` (`isRegistered`), `PUT /me` → email xác nhận (§6c). Mở modal Ký/Duyệt/Từ chối thì gọi `GET /me` để cảnh báo sớm nếu chưa đăng ký.
**Trang public mở từ email** (token ở query string, đọc → xem trước → hành động; lỗi hết hạn/đã dùng thì hiện thông báo, không crash): `/xac-nhan-chu-ky` (§6b), `/xac-nhan-mat-khau-cap-2` (§6c), `/xac-nhan-don` (§4.6), `/xac-nhan-don-tong` (§6e).

**"Import nhân sự" (§3.7)**: chọn `.xlsx` → `POST /EmployeeImport/preview` (bảng preview, cột `errors` đỏ, cờ `isNew*`) → `POST /EmployeeImport/confirm` gửi lại nguyên `rows` → hiện số tạo mới/cập nhật và `skippedRows` kèm lý do. Các import khác: §3.7b, §3.8.

**"In đơn / Xuất PDF"** — BE không tạo PDF, FE tự dựng từ `GET /api/OtForm/{id}` (đủ dữ liệu khớp giấy YEV-22-024: header, nhân viên, `ProcessPart`, `approvalHistories` có `signatureImage` base64 + `approverFullName`). Nút "In đơn" hiện ở **mọi trạng thái**; bước chưa duyệt thì ô chữ ký để trống. Lọc `isRemoved` khỏi danh sách in.

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `POST /OtForm` 400 "khác nhóm" | 1 `employeeId` trong `employees[]` không cùng `groupId` với đơn → chỉ cho tick nhân viên từ đúng `by-group/{groupId}` đang chọn |
| `POST /OtForm` 400 "Nhóm '...' không thuộc Bộ phận đã chọn" | `groupId`/`departmentId` không khớp (`Group.DepartmentId` khác `departmentId`) — dùng đúng cascading dropdown (§3.2), không cho set 2 field độc lập |
| `POST /OtForm` / `PUT /{id}` 400 "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình…" | Tài khoản chưa liên kết `Employee` đúng `groupId` của đơn (và không phải Admin) — §4.1 |
| `POST /OtForm` 400 "Bạn chỉ được tạo đơn cho nhân viên thuộc (những) Line mà mình là Line Leader" | Đơn theo chuyền chứa nhân viên của Line mà người tạo không phải Line Leader (non-Admin) — §4.1 |
| `POST /OtForm` 400 "Nhân viên chưa có Nhóm ca…" | Đơn theo chuyền có nhân viên thiếu `ProductionEmployee.ShiftTeamId` — cập nhật ở màn "Nhân viên dưới chuyền" trước |
| `POST /OtForm` 400 "Giờ kết thúc phải sau giờ bắt đầu (không hỗ trợ ca qua đêm)" | `endTime <= startTime` — FE chặn ngay tại UI (§4.1) |
| `POST /OtForm` 400 "Giờ bắt đầu OT của nhân viên … phải nằm trong khoảng giờ của đơn" / "…không được vượt quá giờ kết thúc của đơn" | `employees[].startTime`/`endTime` ra ngoài khung `[startTime, endTime]` của đơn, hoặc `endTime <= startTime` của chính người đó |
| `POST /OtForm` 400 "Trường hợp OT phải là TH… vì …" | `otCaseId` khác Trường hợp BE suy ra (§6d-2) |
| `POST /OtForm` / `PUT` 400 "Nhân viên mã … quá giới hạn OT ngày (…h > …h)" | Tổng giờ OT trong ngày vượt `dailyOtHourLimit`/`dailyOtHourLimitHoliday` (§6d) — bỏ chọn nhân viên đó hoặc giảm giờ |
| `PUT /OtForm/{id}` 400 "Bạn chỉ có thể sửa đơn do chính mình tạo" / "Đơn đã có bước duyệt được xử lý…" | Đơn theo Nhóm chỉ người tạo sửa và chỉ khi chưa bước nào `Approved`; ẩn nút "Sửa" theo `isEditable` thay vì đoán theo `status` |
| `PUT /OtForm/{id}` 400 "Bạn không phải người được chỉ định xử lý bước hiện tại…" | Đơn theo chuyền: chỉ candidate của bước `Pending` hiện tại sửa được |
| `POST /{id}/approve` 400 dù đã có quyền | Người gọi không nằm trong `candidates[]` của bước đang chờ (`approvalSteps[]`, §4.3) — kiểm tra Chức vụ của họ ở đúng Nhóm/Bộ phận và cây duyệt đã cấu hình bước đó chưa |
| Đơn tạo xong có `approvalChainWarning != null` | Nhóm/Bộ phận chưa cấu hình đủ cây duyệt (§3.4c) hoặc thiếu người giữ Chức vụ ở 1 bước — báo Admin/Người phụ trách cấu hình hoặc gán `Employee.jobTitleId` |
| `POST /{id}/approve` 400 "chữ ký" | Bước đang chờ có `requiresSignatureSnapshot = true` nhưng người duyệt chưa đăng ký chữ ký qua `PUT /UserSignature/me` |
| `POST` tạo/sửa/duyệt/từ chối 400 "Bạn chưa thiết lập mật khẩu cấp 2…" | Chưa đăng ký mật khẩu cấp 2 (`PUT /SecondaryPassword/me` + xác nhận email) — bắt buộc cho mọi thao tác ghi đơn, kể cả kênh email (§6c) |
| 400 "Mật khẩu cấp 2 không đúng" | `secondaryPassword` không khớp mật khẩu cấp 2 đã đăng ký — không liên quan mật khẩu đăng nhập AD |
| `GET/POST /UserSignature/confirm/{token}` hoặc `/SecondaryPassword/confirm/{token}` 404 / 400 | 404 = token sai (link bị copy thiếu); 400 "đã được sử dụng" = đã xác nhận rồi (single-use, không cần làm gì thêm); 400 "đã hết hạn" = quá 30 phút kể từ `PUT /me`, gọi `PUT /me` lại để nhận email mới |
| `GET/POST /OtForm/email-confirm/{token}…` 404 / 400 | 404 = token sai; 400 "đã được sử dụng" = đã Duyệt/Từ chối (single-use); 400 "đã hết hạn" = quá 3 ngày → vào app dùng `pending-approvals`; 400 "Đơn đã xử lý xong…" = người khác đã xử lý hoặc đơn đổi bước (bình thường khi nhiều người cùng nhận mail) |
| `pending-approvals` luôn rỗng dù có đơn chờ | Người gọi không có tên trong `candidates[]` bước `Pending` nhỏ nhất của đơn nào: Employee chưa gắn `userName`, sai Chức vụ/Nhóm/Bộ phận, hoặc là cấp quản lý (đơn của họ nằm trong Đơn tổng, §6e, nhưng vẫn hiện ở `pending-approvals` khi tới lượt) |
| `GET /my-participations` rỗng | Tài khoản chưa được gán `Employee.userName` (§4.2c) |
| `POST /EmployeeImport/preview` 400 "File Excel không hợp lệ…" | File không phải `.xlsx` OOXML thật (`.xlsb`, `.xls` đổi đuôi) — Save As lại "Excel Workbook (*.xlsx)" |
| 401/403 chung | Xem [identity-api-fe.md §6](identity-api-fe.md) |

## 10. Attendance AI Chat (`POST /api/AttendanceAiChat/stream`)

Trợ lý AI hỗ trợ lập đơn tăng ca qua hội thoại — kiến trúc/code ở [attendance-module.md §AttendanceAiChat](attendance-module.md), đây chỉ tóm tắt hợp đồng FE↔BE.

- **Permission**: `Attendance.AiChat.Use` (hiện chỉ Admin; không nằm trong whitelist theo Chức vụ).
- **Request** (`application/json`, cùng hình dạng `POST /api/AiChat/stream` của Asset nhưng endpoint và permission riêng): `{ "message": "Tạo đơn tăng ca cho nhóm Kế toán ngày mai 18h-20h", "history": [], "think": false }` (`systemPrompt?` tuỳ chọn).
- **Response**: NDJSON (`application/x-ndjson`), mỗi dòng 1 JSON, **không** bọc `ApiResponse<T>`; 5 dạng dòng (giống Asset nhưng `device` thay bằng `otform`):
  ```json
  {"type":"content","text":"..."}
  {"type":"tool","name":"create_ot_form_draft"}
  {"type":"otform","otFormId":18}
  {"type":"done"}
  {"type":"error","message":"..."}
  ```
  `otform` emit đúng 1 lần/lượt hỏi, ngay sau khi tool `create_ot_form_draft` tạo **THẬT** 1 đơn; FE dùng để hiện nút "Xem đơn vừa tạo" → `/ot/forms/edit?id={otFormId}`.
- **Đây là tool GHI dữ liệu duy nhất** của AI Chat (các tool tra cứu khác read-only): xác nhận sẽ tạo thật 1 đơn (vào chuỗi duyệt ngay) và, nếu bước đầu thuộc cấp trung gian (`TerminalLevelSnapshot = None`), gửi thật 1 email cho candidate (không có cách tắt). Bước đầu thuộc 3 cấp quản lý thì chỉ nhận mail tổng hợp ở lần chạy `OtFormBatchBackgroundService` kế tiếp (§6e).
  Tên tool `create_ot_form_draft` và chữ "Draft" trong system prompt còn sót dù đơn không còn Draft — xem attendance-module.md §AttendanceAiChat mục "Còn nợ".

## 11. ProductionOtReport (`/api/ProductionOtReport`) — báo cáo dưới chuyền theo ngày

Gate cả 6 route bằng `Attendance.ProductionOtReport.View`. Chỉ tính đơn `isProductionForm = true` + `status = Completed` (qua đủ mọi cấp duyệt) đúng ngày truyền vào. Mọi route nhận thêm query **`departmentId`** (`int?`, bỏ trống = mọi Phòng ban); đơn dưới chuyền có thể tạo dưới bất kỳ Phòng ban nào,
nên FE cho chọn Phòng ban qua `DepartmentApi.getAllDepartments()`. Thiết kế và nguồn từng cột: [attendance-module.md §Báo cáo & export dưới chuyền theo ngày](attendance-module.md).

- **`GET /api/ProductionOtReport/ticket-report?date=yyyy-MM-dd&departmentId=`** — "Xuất số lượng phiếu
  đã sử dụng" (PDF). Trả JSON bọc `ApiResponse<ProductionTicketReportDto>`:
  ```json
  {
    "date": "2026-08-29",
    "totalSecondaryTicketCount": 2,
    "totalMainTicketCount": 5,
    "totalMilkCount": 2,
    "rows": [
      {
        "congDoan": "GT", "ca": "A", "team": "HC", "lineCa": "4S-HC",
        "secondaryTicketCount": 1, "mainTicketCount": 3, "milkCount": 2,
        "totalHour": 4.00, "startTime": "14:00:00", "endTime": "18:00:00"
      }
    ]
  }
  ```
  FE tự dựng PDF (A4 dọc) từ JSON này bằng `jsPDF` + `jspdf-autotable` (font Roboto nhúng qua VFS, tái
  dùng `modules/pc-management/lib/pdf-fonts.ts`) — BE không sinh PDF. Xem
  `modules/attendance/components/reports/ProductionOtReportPanel.tsx`.
- **`GET /api/ProductionOtReport/hours-report-excel?date=yyyy-MM-dd&departmentId=`** — "Tổng số giờ
  tăng ca 1 người trong 1 ngày" (Excel). Trả file `.xlsx` trực tiếp (KHÔNG bọc `ApiResponse<T>` — đọc
  bằng `getForBlob`, cùng pattern `ProductionEmployeeExportApi.exportExcel`), **gộp 1 dòng/người/
  ngày**. Đủ **23 cột** khớp file mẫu gốc (thứ tự đúng như xuất ra):
  `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_BD, Gio_KT, Lydo, LYDO_JP, Lydo_phu, An, CONGVIEC, OT_Thang,
  OT_Nam, BLOCK, NHOM, NOTE, Gio_Hienta, Line_Muon, MNV_LC, MNV_SC, BP, Ngay_lap`.
  Chi tiết nguồn từng cột + lưu ý `BP` ra `"CT"` (mã Phòng ban thật) chứ không phải `"SX"` (nhãn hệ cũ)
  — xem attendance-module.md.
- **`GET /api/ProductionOtReport/times-report-excel?date=yyyy-MM-dd&departmentId=`** — "Số LƯỢT tăng
  ca 1 người trong 1 ngày" (Excel) — **KHÔNG gộp dòng** (khác hẳn báo cáo trên): mỗi
  dòng = 1 lượt (1 đơn/1 ngày của người đó). Trả file `.xlsx` trực tiếp, cùng pattern. 9 cột:
  `MNV, BLOCK, NHOM, NOTE, Ngay_TC, LAN_TANG_CA_TRONG_NGAY, Gio_Hientai, BP, MNV_TP`. 2 cột
  `LAN_TANG_CA_TRONG_NGAY`/`Gio_Hientai` là tổng hợp CẢ NGÀY (lặp lại trên mọi dòng của người đó);
  `MNV_TP` = mã Trưởng Phòng đã duyệt đúng đơn đó (tra `OtFormApprovalHistory`). Chi tiết nguồn từng
  cột — xem attendance-module.md.
- **`GET /api/ProductionOtReport/qry-export-excel?date=&departmentId=`** — "Qry_EXPORT_EXCEL" (Excel), gộp 1 dòng/người/ngày, **17 cột**: `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_BD, Gio_KT,
  Lydo, Lydo_phu, An, BLOCK, NHOM, NOTE, Gio_Thuc_Te, BP, QUAN_LY_TC_SX, MNV_TP` — ĐỘC LẬP với
  `hours-report-excel` (không thay thế). `QUAN_LY_TC_SX` = mã NV đã duyệt ở bước Chức vụ "TL" (Team
  Leader). Trả file `.xlsx` trực tiếp, cùng pattern.
- **`GET /api/ProductionOtReport/sum-export-data?date=&departmentId=`** — "SUM_EXPORT_DATA" (Excel), gộp 1 dòng/người/ngày, **7 cột**: `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_thuc_te, BP` —
  ĐỘC LẬP mục đích với `qry-export-excel` (không phải bản rút gọn). Trả file `.xlsx` trực tiếp.
- **`GET /api/ProductionOtReport/ticket-batch?date=&departmentId=`** — dữ liệu nền để FE tự dựng + đóng
  gói **PDF phiếu YEV-22-024 hàng loạt theo Line/Nhóm** (zip).
  Trả JSON bọc `ApiResponse<ProductionTicketBatchGroupDto[]>` — 1 phần tử/tổ hợp Block-Nhóm-khung giờ có
  OT Hoàn tất trong ngày:
  ```json
  {
    "primaryOtFormId": 48,
    "block": "HL", "shiftTeam": "HC", "employeeCount": 4,
    "employees": [
      {
        "employeeId": 76, "employeeCode": "634", "fullName": "Phạm Thị Lương",
        "startTime": "14:00:00", "endTime": "16:15:00",
        "monthToDate": 0.00, "yearToDate": 0.00, "noteVn": null,
        "congDoanSnapshot": "GT", "taskNameSnapshot": "HUẤN LUYỆN",
        "blockCodeSnapshot": "HL", "teamCodeSnapshot": "HC", "shiftTeamCodeSnapshot": "HC"
      }
    ]
  }
  ```
  Mọi field trong `employees[]` là **snapshot ĐÓNG BĂNG** lấy thẳng từ cột `OtFormEmployee` tương ứng
  (KHÔNG tính lại) — y hệt dữ liệu `GET /api/OtForm/{id}` trả cho bản in đơn lẻ, để phiếu PDF hàng loạt
  khớp 100% với phiếu in tay từng đơn. `primaryOtFormId` dùng để FE gọi tiếp `GET /api/OtForm/{id}` lấy
  phần chữ ký/lý do/ProcessPart (không có ở DTO này) rồi ghép vào layout `OtFormPrintView.tsx` — xem
  `modules/attendance/lib/productionTicketBatchPdf.tsx` + attendance-module.md §Báo cáo & export dưới chuyền theo ngày.
