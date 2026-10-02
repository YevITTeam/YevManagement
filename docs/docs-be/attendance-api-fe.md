# attendance-api-fe.md — API Attendance (Giấy tăng ca) cho Frontend

> Hợp đồng API quản lý Giấy tăng ca (OT Form). Implementation: [attendance-module.md](attendance-module.md).
> Module Identity: [identity-api-fe.md](identity-api-fe.md) · Module Asset: [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8081` (launchSettings hiện trỏ IP này, không phải `localhost:5000` — port đổi từ `8080` ngày 2026-08-26, xem AGENTS.md) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Attendance.OTForm.Create`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- Envelope `ApiResponse<T>`, phân trang, mã lỗi HTTP, pattern CRUD cơ bản — giống hệt Asset, xem [asset-api-fe.md §1](asset-api-fe.md#1-quy-ước-chung). Tóm tắt: mọi response bọc `{ isSuccess, message, data, errors, timestamp }`; `grid-list` trả `data.data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **byte[] qua JSON**: field kiểu `byte[]` (chữ ký `SignatureImage`) serialize/deserialize thành **chuỗi base64** — FE convert ảnh (**upload file ảnh chữ ký có sẵn** — PNG/JPG chụp/scan chữ ký tay thật, KHÔNG phải vẽ bằng canvas/chuột trên web) sang base64 trước khi gửi, và decode base64 → hiển thị `<img src="data:image/png;base64,...">` khi nhận.

---

## MỤC LỤC ĐỌC NHANH — đọc file này theo lát cắt

> ⚠ **File ~165 KB. KHÔNG `Read` cả file** (AGENTS.md §2 luật 7). `Grep` pattern `^#{2,3} ` để lấy mục
> lục kèm số dòng hiện tại → `Read` đúng dải cần. Tra 1 field/endpoint cụ thể thì `Grep` thẳng chuỗi đó.

| Cần gì | Mục |
|---|---|
| Enum (`OtFormStatus`, `ApprovalLevel`, `MealTicketType`…) | §2 |
| CRUD danh mục: Department/Group/Reason/OtCase/JobTitle | §3.1–§3.4b |
| **Cây duyệt** (Bộ phận / Nhóm / Chuyền) + Người phụ trách + Quyền theo Chức vụ | §3.4c → §3.4e |
| Employee + **lũy kế thật / dự kiến / lịch sử** | §3.5 → §3.5c |
| Import Excel nhân sự · nhân sự dưới chuyền · giới hạn OT | §3.7, §3.8, §3.8b |
| **OtForm**: tạo/sửa/xoá đơn | §4.0a → §4.1c |
| **OtForm**: các danh sách (`my-forms`, `pending-approvals`, badge, lịch, `all-forms`) | §4.2 → §4.2f |
| **OtForm**: chi tiết đơn (`OtFormDto` đầy đủ) | §4.3 |
| Duyệt / Từ chối (trong app và qua email) | §4.4, §4.5, §4.6 |
| Chữ ký cá nhân + xác nhận qua email | §6, §6b |
| Mật khẩu cấp 2 | §6c |
| Cấu hình phiếu ăn & giới hạn lũy kế (`AttendanceSetting`) | §6d |
| **Đơn tổng** (`OtFormBatch`) | §6e |
| Bảng tổng hợp toàn bộ endpoint | §7 |
| Checklist FE + lỗi thường gặp | §8, §9 |
| AI Chat lập đơn (NDJSON stream) | §10 |
| Báo cáo dưới chuyền + export Excel/PDF | §11 |

---

## 1. Cơ chế duyệt hiện hành (đọc trước khi code màn hình)

> Mục này thay cho: (a) khối "Cập nhật <ngày>" ~24 KB liệt kê mọi breaking change từ 2026-07 → 2026-09,
> và (b) bản §1 cũ ~36 KB (sơ đồ luồng cố định Draft→Submitter→GroupHead→…, bảng Role, ma trận trạng
> thái, wireframe) — **đã bị đánh dấu SUPERSEDED từ 2026-08-07** và FE thì đã dựng xong từ lâu. Trạng
> thái đúng của từng endpoint nằm ở chính mục mô tả nó (§2 → §11); lịch sử thay đổi tra bằng `git log`.
> Vài chỗ trong file (và trong `attendance-module.md`) còn trỏ tới `§1.1`/`§1.2`/`§1.3.x`/`§1.4` —
> các mục con đó đã bị xoá cùng bản §1 cũ, cứ đọc mục này thay thế.

- **Không có Draft.** `POST /api/OtForm` đưa đơn vào chuỗi duyệt ngay. `OtFormStatus` chỉ còn 3 giá trị
  `InApproval / Completed / Rejected` (§2). `POST /{id}/submit` **đã xoá**.
- **Số bước duyệt co giãn theo Phòng ban**, không còn cố định 3–5 cấp. FE đọc từ
  `OtFormDto.approvalSteps[]` (snapshot lúc tạo đơn, §4.3) — **đừng suy trạng thái từ `status`**.
- **Ai duyệt được bước nào** = có tên trong `approvalSteps[].candidates[]` của bước đó. `UserApprovalScope`
  **đã xoá hẳn** (§5 chỉ còn ghi chú lịch sử).
- **Cấu hình chuỗi duyệt** ở màn "Cây duyệt" (`CategoryManagement.tsx`): khối "Cây duyệt Nhóm"
  (`/api/GroupApprovalStep`, §3.4c-2) chạy trước, rồi "Cây duyệt Bộ phận" (`/api/DepartmentApprovalStep`,
  §3.4c). Riêng Chế Tạo có "Cây duyệt Chuyền" (`/api/ProductionApprovalStep`) cho đơn `isProductionForm`.
  Endpoint xem trước `GET /api/JobTitle/resolve-chain` vẫn còn nhưng **không còn UI**.
- **Mật khẩu cấp 2** bắt buộc ở `POST /api/OtForm`, `PUT /api/OtForm/{id}`, Duyệt, Từ chối, và
  bulk-approve/bulk-reject. **Không** bắt buộc ở kênh email (token trong URL đã là xác thực).
- **Thêm nhân viên** gộp vào `PUT /api/OtForm/{id}` (`employees[]` nhận NV mới — §4.1b, endpoint
  `employees/add` cũ vẫn 404). **Loại nhân viên** có 2 đường: `removedEmployees[]` trong `PUT /{id}`
  (đi kèm việc sửa giờ/note của người khác trong cùng lượt Sửa đơn) HOẶC route riêng
  `POST /{id}/employees/remove` (§4.5a, khôi phục 2026-09-30) để loại nhanh ngay trên màn Duyệt mà
  không cần vào Sửa đơn — route riêng dùng đúng luật "candidate bước hiện tại" nên approver không phải
  creator cũng gọi được (khác `PUT /{id}` với đơn theo Nhóm, vẫn creator-only).
- **Đơn "theo chuyền"** (`isProductionForm=true`, Chế Tạo): sửa được theo TỪNG BƯỚC (candidate của bước
  Pending hiện tại), NV thêm vào phải cùng Line/Nhóm ca với NV còn lại; ứng viên bước Line Leader lấy từ
  `ProductionEmployee.IsLeader` + `ProductionLineId`, không đọc `Employee.JobTitleId`.
- **Phiếu ăn 3 bậc**: `OtFormEmployeeDto.mealTicketType` (0 Không / 1 Phụ / 2 Chính), tính trên giờ
  THỰC TÍCH. Field cũ `isEligibleForMeal` **đã xoá**.
- **Giới hạn giờ OT chặn cứng** cả 3 mốc ngày/tháng/năm (`AttendanceSetting`, §6d) — vượt thì
  `POST`/`PUT /api/OtForm` trả 400 kèm danh sách NV vi phạm. Mốc riêng từng NV
  (`customMonthlyOtHourLimit`/`customYearlyOtHourLimit`) được ưu tiên; sửa qua endpoint RIÊNG
  `PUT /api/Employee/{id}/ot-limit` (không nằm trong `UpdateEmployeeDto`).
- **Menu / route**: `/ot/*` trong app + 3 route công khai mở từ link email (`/xac-nhan-chu-ky`,
  `/xac-nhan-don`, `/xac-nhan-don-tong`). "Sửa đơn" không phải menu riêng — là nút trong màn chi tiết.
  "Lũy kế của tôi" đã xoá (2026-08-08).

## 2. Enum dùng chung (gửi/nhận là số `int`, FE tự map label)

> **⚠ Đợt 2026-08-07 (Giai đoạn 3.1)** — `OtFormStatus` đã REDESIGN sạch (bỏ 6 giá trị cũ, không cần
> tương thích ngược); `ApprovalLevel` KHÔNG còn dùng bởi `OtForm*` (chỉ còn dùng bởi `UserApprovalScope`
> — xem §5, tính năng riêng, không liên quan chuỗi duyệt OtForm nữa); `OtFormApprovalHistoryDto`/
> `ApprovalSummaryItemDto` đổi field `approvalLevel:int` → `stepOrder:int` + `jobTitleNameSnapshot:string`
> (text tự do lấy từ Cây chức vụ, không map qua bảng enum cố định nữa). Xem §4.3/§Cây chức vụ.

```js
// OtFormStatus — Attendance.Domain.Enums.OtFormStatus (redesign 2026-08-07)
{ 0: "InApproval (Đang chờ duyệt — chi tiết bước đang chờ đọc ở OtFormDto.approvalSteps)",
  1: "Completed (Hoàn tất)", 2: "Rejected (Từ chối)" }

// OtFormApprovalStepStatus — Attendance.Domain.Enums.OtFormApprovalStepStatus (MỚI 2026-08-07, dùng
// trong OtFormApprovalStepDto.status, §4.3)
{ 0: "Pending (Đang chờ)", 1: "Approved (Đã duyệt)", 2: "Rejected (Đã từ chối)",
  3: "Skipped (Bỏ qua — do đơn bị Reject ở 1 bước khác, các bước Pending còn lại tự chuyển Skipped)" }

// ApprovalLevel — Attendance.Domain.Enums.ApprovalLevel — CHỈ còn dùng bởi UserApprovalScope (§5),
// KHÔNG còn liên quan tới chuỗi duyệt OtForm (thay bằng Cây chức vụ động, xem §Cây chức vụ)
{ 0: "Submitter", 1: "DepartmentManager", 2: "WorkshopManager", 3: "GeneralDirector", 4: "GroupHead" }

// ApprovalAction — Attendance.Domain.Enums.ApprovalAction (chỉ xuất hiện trong OtFormApprovalHistoryDto.action)
{ 0: "Submitted", 1: "Approved", 2: "Rejected" }

// ScopeType — Attendance.Domain.Enums.ScopeType (chỉ dùng trong UserApprovalScope)
{ 0: "Group", 1: "Department", 2: "All (Toàn công ty)" }

// JobTitleTerminalLevel — Attendance.Domain.Enums.JobTitleTerminalLevel (dùng trong JobTitleDto.terminalLevel
// §3.4b VÀ OtFormApprovalStepDto.terminalLevelSnapshot §4.3, VÀ OtCase.requiredApprovalLevel §3.4)
{ 0: "None (chỉ là cấp trung gian)", 1: "DepartmentManager (Trưởng phòng)",
  2: "WorkshopManager (Trưởng xưởng)", 3: "GeneralDirector (Tổng Giám Đốc)" }
// Tối đa 1 JobTitle active giữ mỗi giá trị non-0. Từ 2026-08-07, đây là enum DUY NHẤT xác định "cấp
// duyệt cuối" cho cả OtCase lẫn OtFormApprovalStep — thay thế hoàn toàn ApprovalLevel cho mục đích này.
```

## 3. Danh mục CRUD chuẩn

6 entity: `Department`, `Group`, `Reason`, `OtCase`, `JobTitle`, `Employee`. Đều theo pattern chung (giống Asset):
```
GET /api/{Entity}/grid-list?pageIndex=1&pageSize=50&keyword=   → PagedResponse
GET /api/{Entity}/all                                           → Dto[] (active, cho dropdown)
GET /api/{Entity}/{id}   POST   PUT /{id} (body có Id khớp)    DELETE /{id} (xóa mềm)
```
Permission: `Attendance.{Entity}.{View|Create|Update|Delete}` (tên Entity theo PascalCase ở bảng dưới, VD `Attendance.OtCase.Create`).

### 3.1 Department (Phòng/Phòng ban) — `/api/Department`
> **Sửa label 2026-07-17**: trước đây tài liệu ghi nhầm `Department` = "Bộ phận" — đối chiếu với email thật của công ty thì `Department` = **Phòng/Phòng ban** (khớp "Trưởng phòng"), còn "Bộ phận" là `Group` (§3.2). Field/API không đổi, chỉ sửa lại tên gọi tiếng Việt cho đúng.
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
POST/PUT: `code`[Required], `description?`, `requireSignature`(bool), `requiredApprovalLevel`[Required] (enum `ApprovalLevel` §2 — **chỉ nên chọn `1`/`2`/`3`**, không dùng `0=Submitter` hoặc `4=GroupHead` làm cấp cuối — cả 2 cấp này luôn bắt buộc chạy qua trước khi tới cấp `requiredApprovalLevel` thật sự, không phải cấp có thể chọn làm điểm dừng). Đây là **master data admin cấu hình sẵn** (thường 3 dòng cố định TH1/TH2/TH3), FE màn tạo đơn chỉ cần dropdown chọn từ `/all`.

### 3.4b JobTitle (Chức vụ) — `/api/JobTitle` (mới, 2026-08-06 — Giai đoạn 1 "Cây chức vụ")

> Danh mục độc lập, **CHƯA được đọc bởi bất kỳ luồng duyệt OtForm nào** — xem
> [attendance-module.md §Cây chức vụ](attendance-module.md) để biết phạm vi Giai đoạn 1 đã xong và
> phần còn thiếu (suy luận chuỗi duyệt tự động, thay thế `UserApprovalScope`).

```jsonc
// JobTitleDto
{ "id": 18, "code": "M", "name": "Manager", "rankOrder": 4, "terminalLevel": 1 }
```
POST/PUT: `code`[Required], `name`[Required], `rankOrder`[Required] (int, số lớn = cấp cao hơn — **chỉ dùng để loại bỏ bước ở cấp ngang/thấp hơn người tạo đơn** khỏi cây duyệt, KHÔNG còn dùng để tự bắc cầu qua mọi cấp đang có người giữ, xem §3.4c), `terminalLevel` (enum `JobTitleTerminalLevel`: `0=None/1=DepartmentManager/2=WorkshopManager/3=GeneralDirector`). Trùng `code` (kể cả bản ghi đã xóa mềm) → 400. Đặt `terminalLevel` khác `0` khi đã có 1 `JobTitle` active khác giữ đúng giá trị đó → 400 (mỗi `TerminalLevel` non-None chỉ 1 chức vụ). Xóa khi còn `Employee.jobTitleId` trỏ tới → 400.
>
> `requiresSignature` **không còn nằm ở đây** — 2026-08-07 đã chuyển xuống `DepartmentApprovalStep`
> (§3.4c), vì cùng 1 Chức vụ có thể cần ký ở Phòng ban này nhưng chỉ cần xác nhận ở Phòng ban khác.
>
> **Thu gọn 14→6 dòng seed (2026-08-08, Giai đoạn 4)**: `STAFF`(rank 1)/`GL` Group Leader(2)/`TL` Team
> Leader(3)/`M` Manager(4, terminalLevel=1)/`FM` Factory Manager(5, terminalLevel=2)/`GM` Director(6,
> terminalLevel=3) — thay 14 mã cũ. Xem `attendance-module.md` §Giai đoạn 4.

### 3.4c DepartmentApprovalStep (Cây duyệt Bộ phận) — `/api/DepartmentApprovalStep` (mới, 2026-08-06 — Giai đoạn 2b; thu hẹp phạm vi ở Giai đoạn 4)

> Cấu hình TAY danh sách Chức vụ CẤP CUỐI (Manager/Factory Manager/Director, `terminalLevel != 0`) là
> bước duyệt THẬT của 1 Bộ phận (route/entity vẫn giữ tên `Department` — chỉ nhãn hiển thị FE đổi
> thành "Bộ phận", xem `attendance-module.md` §Giai đoạn 4 mục 4). **Từ Giai đoạn 4 (2026-08-08) KHÔNG
> còn chứa cấp trung gian** — 3 cấp dưới Manager (Staff/Group Leader/Team Leader) cấu hình riêng ở
> `/api/GroupApprovalStep` (§3.4c-2) theo từng Nhóm. Bộ phận chưa cấu hình gì → chuỗi duyệt rỗng,
> `resolve-chain` báo kẹt.

> **Scope-check (2026-08-11):** cả `GET`/`PUT` giờ còn kiểm tra thêm phạm vi — Admin (Role `Admin`)
> luôn xem/sửa được mọi Bộ phận; người khác (dù có permission) chỉ xem/sửa được ĐÚNG Bộ phận họ được
> Admin gán làm "Người phụ trách" (xem §3.4c-3) — sai Bộ phận thì 400 dù đúng quyền. Đây là điểm khác
> so với hành vi cũ (chỉ kiểm tra permission phẳng, không giới hạn phạm vi).

`GET /by-department/{departmentId}` (`Attendance.DepartmentApprovalStep.View`) → `DepartmentApprovalStepDto[]` đã sắp theo `stepOrder` (không còn field `isResponsible` — xem §3.4c-2):
```jsonc
[
  { "id": 6, "departmentId": 1, "stepOrder": 1, "jobTitleId": 18, "jobTitleCode": "M", "jobTitleName": "Manager",
    "rankOrder": 4, "requiresSignature": true, "terminalLevel": 1 }
]
```
`PUT /by-department/{departmentId}` (`Attendance.DepartmentApprovalStep.Update`) — **thay NGUYÊN danh sách**, không có Create/Update/Delete từng dòng riêng:
```jsonc
// Request body — thứ tự phần tử = thứ tự bước duyệt (phần tử đầu = bước 1)
{
  "steps": [
    { "jobTitleId": 18, "requiresSignature": true },
    { "jobTitleId": 19, "requiresSignature": true },
    { "jobTitleId": 20, "requiresSignature": true }
  ]
}
```
Trả về `DepartmentApprovalStepDto[]` mới sau khi thay. Validate: không được lặp lại cùng 1 `jobTitleId`
(400), mọi `jobTitleId` phải tồn tại/active (404), và **`jobTitleId` phải có `terminalLevel != 0`**
(400 nếu gửi Chức vụ trung gian — báo cấu hình ở `/api/GroupApprovalStep` thay vào đó, mới Giai đoạn
4). Gửi mảng rỗng `{ "steps": [] }` để xoá hết cây duyệt của Bộ phận đó. `requiresSignature` áp dụng
riêng cho BƯỚC này của Bộ phận này (2026-08-07 — xem §3.4b).

### 3.4c-2 GroupApprovalStep (Cây duyệt Nhóm) — `/api/GroupApprovalStep` (mới, 2026-08-08 — Giai đoạn 4)

> Cấu hình TAY danh sách Chức vụ TRUNG GIAN (Staff/Group Leader/Team Leader, `terminalLevel = 0`) là
> bước duyệt THẬT của 1 Nhóm (route/entity `Group` — nhãn hiển thị FE là "Nhóm", entity `Department`
> hiển thị "Bộ phận", xem `attendance-module.md` §Giai đoạn 4 mục 4) — mirror hoàn toàn
> `DepartmentApprovalStep` (§3.4c) nhưng khoá theo `groupId`. Nhóm chưa cấu hình gì → chuỗi duyệt kẹt
> ngay ở cấp trung gian, `resolve-chain` báo warning. **FE (2026-08-10):** §3.4c và §3.4c-2 hiển thị
> chung trong 1 tab "Cây duyệt" (`ApprovalStepManager.tsx`) — chọn 1 Bộ phận, rồi cấu hình lần lượt
> khối Nhóm (trung gian) và khối Bộ phận (cấp cuối) trong cùng màn, không còn 2 tab riêng.

> **Scope-check (2026-08-11):** mirror §3.4c — Admin xem/sửa mọi Nhóm; người khác chỉ xem/sửa được
> ĐÚNG Nhóm họ được gán "Người phụ trách" (§3.4c-3), **tách biệt hoàn toàn** với phụ trách Bộ phận
> (phụ trách Bộ phận KHÔNG tự động phụ trách Nhóm con, phải gán riêng).

`GET /by-group/{groupId}` (`Attendance.GroupApprovalStep.View`) → `GroupApprovalStepDto[]` đã sắp theo `stepOrder`:
```jsonc
[
  { "id": 1, "groupId": 163, "stepOrder": 1, "jobTitleId": 15, "jobTitleCode": "STAFF", "jobTitleName": "Staff",
    "rankOrder": 1, "requiresSignature": true, "isResponsible": true, "terminalLevel": 0 },
  { "id": 2, "groupId": 163, "stepOrder": 2, "jobTitleId": 16, "jobTitleCode": "GL", "jobTitleName": "Group Leader",
    "rankOrder": 2, "requiresSignature": false, "isResponsible": false, "terminalLevel": 0 }
]
```
`PUT /by-group/{groupId}` (`Attendance.GroupApprovalStep.Update`) — **thay NGUYÊN danh sách**, cùng khuôn §3.4c:
```jsonc
{
  "steps": [
    { "jobTitleId": 15, "requiresSignature": true, "isResponsible": true },
    { "jobTitleId": 16, "requiresSignature": false, "isResponsible": false }
  ]
}
```
Trả về `GroupApprovalStepDto[]` mới sau khi thay. Validate: không lặp `jobTitleId` (400), mọi
`jobTitleId` tồn tại/active (404), **`terminalLevel` phải = 0** (400 nếu gửi Chức vụ cấp cuối — báo
cấu hình ở `/api/DepartmentApprovalStep` thay vào đó), **tối đa 1 phần tử** đặt `isResponsible: true`
(400 nếu >1), và số bước có `requiresSignature: true` phải **từ 1 đến 2** khi `steps` không rỗng (400
nếu 0 hoặc >2 — khớp đúng 2 ô "Người đề nghị" cố định trên giấy in `YEV-22-024`; validate này dời
nguyên từ `DepartmentApprovalStep` cũ sang đây ở Giai đoạn 4). Gửi mảng rỗng để xoá hết cây duyệt của
Nhóm đó.

### 3.4c-3 Người phụ trách Cây duyệt — `/api/DepartmentApprovalStepCoordinator`, `/api/GroupApprovalStepCoordinator` (mới, 2026-08-11; sửa 2026-08-11b: khoá theo `employeeId`, quyền tự động cấp)

> Cho phép Admin **gán tay** 1 hoặc nhiều người phụ trách cấu hình Cây duyệt của 1 Bộ phận/Nhóm cụ
> thể, để họ tự sửa được §3.4c/§3.4c-2 mà **không cần** quyền Admin toàn công ty — giải quyết vấn đề
> Admin phải tự tay cấu hình cây duyệt cho MỌI Bộ phận/Nhóm. **KHÔNG suy luận theo Chức vụ** (Trưởng
> phòng/Group Leader/Team Leader không tự động có quyền) — vẫn là gán tay tường minh, nhưng **CHỈ**
> chọn được trong số Employee đang thuộc ĐÚNG Bộ phận/Nhóm đó (trực tiếp hoặc qua Group con, cho Bộ
> phận). 2 API tách biệt hoàn toàn (mirror nhau), không có nesting: gán phụ trách Bộ phận KHÔNG tự
> động phụ trách Nhóm con.
>
> **Chỉ Admin sửa được BẢNG GÁN này** (`Attendance.DepartmentApprovalStepCoordinator.Update`/
> `Attendance.GroupApprovalStepCoordinator.Update` — chỉ seed cho Role `Admin`, xem
> `Indentity.Infrastructure/Migrations/…_AddApprovalStepCoordinatorPermissions.cs`) — bảng này chỉ trả
> lời câu hỏi "ai được làm người phụ trách", không phải quyền thao tác Cây duyệt thật.
>
> **Quyền thao tác THẬT (2026-08-11b) — TỰ ĐỘNG, không còn bước cấp tay:** ngay khi `PUT` (thêm hoặc
> gỡ 1 Employee khỏi bảng gán), BE tự tính lại và đồng bộ bộ quyền
> `Attendance.DepartmentApprovalStep.{View,Update}` (hoặc `GroupApprovalStep.{View,Update}` cho phía
> Nhóm) + `Department.View`/`Group.View`/`JobTitle.View`/`Employee.View` cho tài khoản Identity liên
> kết với Employee đó (qua `Employee.UserName`), dùng đúng cơ chế "tự động cấp theo Chức vụ" đã có ở
> §Giai đoạn 6 (`IUserDirectoryService.SyncAutoGrantedPermissionsAsync`, đánh dấu
> `UserPermission.IsAutoGranted=true` — Admin cấp tay qua "Tuỳ chỉnh quyền" vẫn không bị đụng, xem
> §Giai đoạn 6). Nếu Employee được gán CHƯA có `UserName` (chưa liên kết tài khoản đăng nhập — xem
> `employee-api-fe.md`/`Employee.userName` nullable), việc cấp quyền **tạm hoãn**: không lỗi, không
> cảnh báo, chỉ đơn giản là chưa ai được cấp gì — khi Admin liên kết `UserName` cho Employee đó sau
> này (qua `PUT /api/Employee/{id}`), quyền tự bật lên ngay lập tức, không cần thao tác gì ở đây nữa.
> **Không** đưa 2 permission `*ApprovalStep.Update` vào `JobTitlePermissionWhitelist` — cơ chế tự động
> cấp ở đây đi qua 1 nguồn RIÊNG (`ApprovalStepCoordinatorPermissions`, hardcode cố định trong BE,
> không phải chuỗi Admin tự nhập) để không tái tạo rủi ro tự leo thang quyền đã loại bỏ khi xoá
> `UserApprovalScope`.

`GET /by-department/{departmentId}` (`Attendance.DepartmentApprovalStepCoordinator.View`) → `DepartmentApprovalStepCoordinatorDto[]`:
```jsonc
[
  { "id": 3, "departmentId": 1, "employeeId": 3370, "employeeCode": "N-30479",
    "fullName": "Nguyễn Văn A", "userName": "YEV\\n.van.a" }
]
```
`userName: null` = Employee này CHƯA liên kết tài khoản đăng nhập — quyền chưa có hiệu lực (xem trên).

`PUT /by-department/{departmentId}` (`Attendance.DepartmentApprovalStepCoordinator.Update`) — **thay NGUYÊN danh sách**:
```jsonc
{ "employeeIds": [3370, 3412] }
```
Validate: mọi `employeeId` phải khớp Employee active đang thuộc ĐÚNG Bộ phận này (400 nếu có 1 phần tử
sai đơn vị hoặc không tồn tại). Gửi mảng rỗng để bỏ hết người phụ trách của Bộ phận đó (đồng thời thu
hồi quyền tự động đã cấp cho những Employee vừa bị gỡ).

`GET /by-group/{groupId}` / `PUT /by-group/{groupId}` (`Attendance.GroupApprovalStepCoordinator.View`/`.Update`) → `GroupApprovalStepCoordinatorDto[]`, payload `{ "employeeIds": [...] }` — mirror hoàn toàn khối trên, khoá theo `groupId` (Employee phải có `groupId` đúng bằng Nhóm này).

**FE:** quản lý ngay trong tab "Cây duyệt" (`ApprovalStepManager.tsx`) — mỗi khối Nhóm/Bộ phận có thêm
1 ô "Người phụ trách" (chip + ô gõ tìm chọn nhân viên, nguồn dữ liệu TÁI DÙNG `deptEmployees`/
`groupEmployees` đã tải sẵn cho khối "Đang giữ" Chức vụ — không gọi thêm API, áp dụng ngay không cần
nút Lưu riêng). Khối này chỉ hiện với người có quyền `*Coordinator.View` (Admin) — ẩn hẳn với 1 Người
phụ trách bình thường mở màn qua sidebar, tránh gọi nhầm API họ không có quyền. Mục menu "Danh mục"
(sidebar `OtManagerSidebar.tsx`) đã mở thêm điều kiện hiện — trước đây chỉ `Attendance.Department.Create`
(Admin), giờ thêm `Attendance.DepartmentApprovalStep.Update`/`Attendance.GroupApprovalStep.Update` để
Người phụ trách (không phải Admin) cũng thấy được mục vào tab Cây duyệt.

> **Gán Chức vụ CÓ PHẠM VI (2026-08-11c) — `PUT /api/Employee/{id}/department-job-title?departmentId=`
> / `PUT /api/Employee/{id}/group-job-title?groupId=`**, body `{ "jobTitleId": number | null }`
> (`null` = gỡ Chức vụ). Đây là cách Người phụ trách gán Chức vụ cho nhân viên ở khối "Đang giữ" trong
> cùng tab Cây duyệt — TÁCH RIÊNG khỏi `PUT /api/Employee/{id}` (sửa toàn bộ hồ sơ, vẫn chỉ Admin qua
> `Attendance.Employee.Update`, không đổi). 2 endpoint mới gate bằng CHÍNH quyền cây duyệt của đơn vị
> đó (`Attendance.DepartmentApprovalStep.Update`/`Attendance.GroupApprovalStep.Update` — Người phụ
> trách đã tự động có, xem trên) — Admin cũng dùng chung 2 endpoint này (không còn gọi
> `updateEmployee` full-profile cho thao tác quick-assign nữa). BE tự kiểm tra Employee phải thuộc
> đúng Bộ phận/Nhóm trong URL và (nếu không phải Admin) người gọi phải có tên trong bảng gán tương
> ứng; **non-Admin không được gán Chức vụ Trưởng Xưởng/Giám đốc** (2 cấp dùng chung toàn công ty, vượt
> phạm vi 1 Bộ phận — chỉ Admin mới thăng được, dù có đủ 2 quyền `*ApprovalStep.Update`). BE tự tính
> lại `groupId`/`departmentId` theo `TerminalLevel` của Chức vụ mới, FE không gửi 2 field này. Trả về
> `EmployeeDto` mới sau khi gán.

### 3.4d Xem trước chuỗi duyệt tự động (Giai đoạn 2, mới 2026-08-06, thuật toán sửa lại ở Giai đoạn 2b, ghép Nhóm+Bộ phận ở Giai đoạn 4)

`GET /api/JobTitle/resolve-chain?employeeId=&otCaseId=` (`Attendance.JobTitle.View`, đọc-only, KHÔNG tạo/sửa gì):
```jsonc
// ResolveApprovalChainResultDto
{
  "isComplete": true,
  "warning": null,
  "requiresCreatorSelfSign": false,
  "steps": [
    { "stepOrder": 1, "jobTitleCode": "STAFF", "jobTitleName": "Staff", "rankOrder": 1,
      "requiresSignature": true, "isResponsible": true, "terminalLevel": 0,
      "candidates": [] },
    { "stepOrder": 2, "jobTitleCode": "M", "jobTitleName": "Manager", "rankOrder": 4,
      "requiresSignature": true, "isResponsible": false, "terminalLevel": 1,
      "candidates": [ { "employeeId": 42, "userName": "YEV\\n.van.b", "fullName": "Nguyễn Văn B" } ] }
  ]
}
```
Thuật toán (2026-08-08, Giai đoạn 4) đọc `GroupApprovalStep` của Nhóm người tạo TRƯỚC (§3.4c-2, cấp
trung gian), rồi nối tiếp `DepartmentApprovalStep` của Bộ phận (§3.4c, cấp cuối) SAU — luôn đi hết
Nhóm rồi mới tới Bộ phận. `isComplete=false` (kèm `warning` giải thích) nếu: Nhóm/Bộ phận chưa cấu
hình cây duyệt nào, hoặc cây duyệt không có bước nào khớp đúng `TerminalLevel` cần tới, hoặc 1 bước
nào đó chưa có ai giữ đúng Chức vụ đó trong đúng Nhóm/Bộ phận — **không** tự fallback về
`UserApprovalScope` cũ (đã xoá hẳn). `steps=[]` + `isComplete=true` nghĩa là người tạo đã ở cấp
bằng/cao hơn cấp duyệt cuối, không cần bước nào. Endpoint này đã được `OtFormService.CreateAsync` gọi
tới thật (qua `ResolveChainForCreationAsync`, thêm tham số `groupId` ở Giai đoạn 4) — không còn chỉ để
test (xem [attendance-module.md §Cây chức vụ](attendance-module.md)). **FE (2026-08-10):** tab xem
trước "Thử chuỗi duyệt" (`ApprovalChainPreviewPanel.tsx`) đã bị bỏ khỏi màn Danh mục — endpoint này
giờ chỉ được gọi ngầm bởi `OtFormService.CreateAsync`, không còn UI riêng để test tay qua trình duyệt
(vẫn gọi được trực tiếp qua Scalar UI `/scalar/v1` nếu cần debug).

### 3.4e JobTitlePermission (Quyền theo Chức vụ) — `/api/JobTitlePermission` (mới, 2026-08-10)

> Cấu hình TAY danh sách permission Identity **tự động cấp** cho MỌI Employee đang giữ 1 Chức vụ (có
> `UserName` link tài khoản đăng nhập) — mục tiêu: gán Chức vụ xong là có đủ quyền vận hành ngay,
> không cần Admin làm thêm bước 2 (cấp tay qua "Tuỳ chỉnh quyền", `identity-api-fe.md` §4.8) cho
> trường hợp thông thường. Chỉ nhận permission thuộc **nhóm "tham gia quy trình"** — 13 mã cố định
> (`GET /allowed-codes` trả đúng danh sách): `OTForm.{View,Create,Approve,RemoveEmployee}`,
> `UserSignature.{View,Update}`, `SecondaryPassword.Update`, `{Department,Group,OtCase,Reason,
> Employee,JobTitle}.View`. **KHÔNG BAO GIỜ** nhận permission nhóm "quản trị" (CRUD danh mục,
> `Setting.Update`, `AiChat.Use`, `*ApprovalStep.Update`, `JobTitlePermission.*`) — validate cứng ở
> BE (400 nếu gửi mã ngoài whitelist), tránh lặp lại đúng rủi ro đã loại bỏ khi xoá
> `UserApprovalScope`: 1 người có thể tự leo thang quyền quản trị chỉ bằng cách đổi Chức vụ cho chính
> mình.

`GET /by-job-title/{jobTitleId}` (`Attendance.JobTitlePermission.View`) → `JobTitlePermissionDto[]`:
```jsonc
[
  { "id": 1, "jobTitleId": 18, "permissionCode": "Attendance.OTForm.Approve" },
  { "id": 2, "jobTitleId": 18, "permissionCode": "Attendance.UserSignature.Update" }
]
```
`GET /allowed-codes` (`Attendance.JobTitlePermission.View`) → `string[]` — danh sách mã được phép chọn (FE lọc UI theo đúng danh sách này, không hardcode song song).

`PUT /by-job-title/{jobTitleId}` (`Attendance.JobTitlePermission.Update`) — **thay NGUYÊN danh sách**:
```jsonc
// Request body
{ "permissionCodes": ["Attendance.OTForm.Approve", "Attendance.UserSignature.Update"] }
```
Trả về `JobTitlePermissionDto[]` mới. Validate: mọi code phải nằm trong whitelist (400 nếu không).
Sau khi lưu, **đồng bộ NGAY** cho mọi Employee đang giữ đúng Chức vụ đó (có `UserName`) — không cần
đợi ai đó động vào Employee của từng người. Gửi `{ "permissionCodes": [] }` để bỏ hết quyền tự động
cấp của Chức vụ đó (thu hồi lại mọi permission đã tự cấp trước đó cho người giữ Chức vụ này).

**Cơ chế đồng bộ thật** (`Identity.Application/Services/UserDirectoryService.SyncAutoGrantedPermissionsAsync`,
gọi từ `Attendance.EmployeeService.CreateAsync/UpdateAsync/DeleteAsync` mỗi khi `JobTitleId`/`UserName`
đổi, và từ `JobTitlePermissionService.ReplaceAsync` khi mapping đổi):
- Ghi/xoá permission qua `UserPermission.IsAutoGranted=true` (cột mới trên Identity, xem
  `identity-api-fe.md` §4.8) — phân biệt rõ với permission Admin cấp tay (`IsAutoGranted=false`).
  Đổi/gỡ Chức vụ của 1 người → permission `IsAutoGranted=true` không còn cần thiết bị **tự thu hồi**;
  permission Admin cấp tay **không bao giờ** bị đụng tới, dù trùng mã.
- Employee **chưa có `UserName`** (chưa link tài khoản đăng nhập) → no-op, không có đích để cấp. Khi
  sau này `UserName` được gán vào Employee đó (dù đã có sẵn Chức vụ từ trước), lần `PUT /api/Employee/{id}`
  đó tự kích hoạt đồng bộ lại đúng bộ quyền theo Chức vụ hiện tại — không cần thao tác gì thêm.
- Đổi `UserName` của 1 Employee sang tài khoản khác → permission tự động cấp bị **thu hồi khỏi tài
  khoản cũ** trước khi cấp cho tài khoản mới (tránh 1 tài khoản Identity giữ mãi quyền của Employee
  không còn link tới nó).

### 3.5 Employee (Nhân viên) — `/api/Employee` — thuộc 1 Group HOẶC 1 Department tuỳ Chức vụ
```jsonc
// EmployeeDto
{ "id": 100, "code": "NV001", "firstName": "Nguyễn Văn", "lastName": "A",
  "userName": "YEV\\n.van.a",                     // nullable — tài khoản AD của chính nhân viên (nếu có)
  "monthToDate": 12.5, "yearToDate": 80.0,         // lũy kế THẬT — BE tính lúc đọc, xem §3.5a
  "projectedDayToDate": 0, "projectedMonthToDate": 0, "projectedYearToDate": 0, // lũy kế DỰ KIẾN — CHỈ có ý nghĩa ở by-group, xem §3.5b (projectedDayToDate mới 2026-08-26)
  "groupId": 5, "groupNameVn": "Nhóm 1",           // cả 2 nullable từ 2026-08-08, xem ngay dưới
  "departmentId": null, "departmentNameVn": null,  // MỚI 2026-08-08
  "jobTitleId": 11, "jobTitleName": "Manager",     // nullable, MỚI 2026-08-06 — xem §3.4b
  "customMonthlyOtHourLimit": null, "customYearlyOtHourLimit": 400 } // decimal? nullable, MỚI 2026-08-26 — null = dùng mặc định chung, có giá trị = "gia hạn" riêng cho người này (xem §3.5b)
```
POST/PUT: `code`[Required], `firstName`[Required], `lastName`[Required], `userName?` (optional — gán tài khoản AD để liên kết nhân viên với đúng người tạo/duyệt đơn OT, xem §3.5), `groupId?`/`departmentId?`, `jobTitleId?` (optional, MỚI 2026-08-06 — id không tồn tại/đã xóa → 404), `customMonthlyOtHourLimit?`/`customYearlyOtHourLimit?` (optional, MỚI 2026-08-26, `[Range(1,744)]`/`[Range(1,8784)]` khi có giá trị — KHÔNG có `customDailyOtHourLimit`, Ngày luôn dùng chung 1 mốc cho mọi người). Trùng `userName` với nhân viên khác (kể cả đang active) → 400. `monthToDate`/`yearToDate`/`projectedMonthToDate`/`projectedYearToDate` là field **chỉ đọc** (response only) — **không còn trong POST/PUT body nữa** (2026-08-19, xem §3.6 — bỏ hẳn khả năng chỉnh tay).

### 3.5a Lũy kế THẬT — `monthToDate`/`yearToDate` (REDESIGN 2026-08-19)

Không còn lưu trên `Employee` — BE tính trực tiếp từ ledger (`EmployeeAccumulationHistory`) mỗi lần trả
`EmployeeDto`, luôn scope theo **năm/tháng THỰC TẾ hôm nay** (không phải ngày trên bất kỳ đơn nào). Hệ
quả FE cần biết: 1 đơn ghi ngày tương lai, dù đã `Completed` từ trước, chỉ "hiện" vào `monthToDate`/
`yearToDate` khi lịch thực tế đã tới đúng tháng đó — không có gì để FE code thêm, chỉ cần biết số này
luôn đúng-theo-hôm-nay chứ không phải "theo lần Hoàn tất gần nhất" như bản cũ. Chi tiết thiết kế/lý do
đổi xem [attendance-module.md §Lũy kế — bỏ cache trên Employee, tính lúc đọc](attendance-module.md).

**`groupId`/`departmentId` — đúng 1 trong 2 (hoặc cả 2 đều bỏ trống), tuỳ `TerminalLevel` của `jobTitleId` (2026-08-08, breaking so với trước — trước đó `groupId` luôn bắt buộc)**, validate ở `EmployeeService.ValidateOrganizationAssignmentAsync`, sai tổ hợp → 400 message cụ thể:
| `jobTitleId` chưa gán / Chức vụ `TerminalLevel=None` | `TerminalLevel=DepartmentManager` (Trưởng phòng) | `TerminalLevel=WorkshopManager`/`GeneralDirector` (Trưởng Xưởng/Giám đốc) |
|---|---|---|
| `groupId` **bắt buộc**, `departmentId` phải bỏ trống | `departmentId` **bắt buộc**, `groupId` phải bỏ trống | Cả 2 đều phải bỏ trống — dùng chung toàn công ty |

FE `EmployeeForm.tsx` (2026-08-08): chọn **Chức vụ trước**, dropdown Bộ phận/Phòng ban hiện đúng 1 trong 2 (hoặc ẩn cả 2 kèm ghi chú "dùng chung toàn công ty") theo `JobTitleDto.terminalLevel` của lựa chọn — đổi Chức vụ giữa 3 nhóm tự reset field cũ.

**Chọn nhân viên hàng loạt khi lập đơn**: `GET /api/Employee/by-group/{groupId}?date=2026-08-01` → `EmployeeDto[]` toàn bộ nhân viên nhóm đó (Trưởng nhóm tick chọn nhiều người cho `CreateOtFormDto.employees`) — FE dùng **`projectedDayToDate`/`projectedMonthToDate`/`projectedYearToDate`** (KHÔNG dùng `monthToDate`/`yearToDate`) để cảnh báo hạn mức TH3 ngay lúc chọn (§1.3.A, §3.5b) — chỉ là cảnh báo SỚM, BE luôn tự chặn thật lúc submit (§6d). `date` query param (optional, mặc định hôm nay thực tế nếu bỏ trống) = **ngày trên đơn đang tạo** — BẮT BUỘC truyền để Dự kiến scope đúng tháng/năm của đơn đó (2026-08-19); FE phải gọi lại endpoint này mỗi khi người dùng đổi ngày trên form.

**Toàn bộ nhân viên active (mọi Group)**: `GET /api/Employee/all` (`Attendance.Employee.View`, mới 2026-08-06) → `EmployeeDto[]` — dùng cho dropdown/công cụ cần chọn 1 nhân viên bất kỳ không giới hạn theo Group. Trước đó FE (`EmployeeApi.getAllEmployees()`) đã gọi sẵn route này nhưng BE chưa có action khớp — request rơi vào `GET /{id}` với `id="all"`, trả 400 `"The value 'all' is not valid"`; đã bổ sung action thật.

**Toàn bộ nhân viên active thuộc 1 Phòng ban (mọi Group con)**: `GET /api/Employee/by-department/{departmentId}` (`Attendance.Employee.View`, mới 2026-08-07) → `EmployeeDto[]`. Dùng ở khối "Cây duyệt Bộ phận" trong tab "Cây duyệt" (`ApprovalStepManager.tsx`) để: (a) hiện ngay dưới mỗi bước ai đang giữ Chức vụ đó trong Phòng ban, (b) gán nhanh `jobTitleId` cho từng nhân viên ngay tại màn này (gọi lại `PUT /api/Employee/{id}` bình thường, giữ nguyên field khác) — không cần chuyển qua màn "Nhân viên" riêng.

**Lọc `grid-list` theo Phòng ban/Bộ phận** (mới 2026-08-07): `GET /api/Employee/grid-list?...&DepartmentId=&GroupId=` — 2 query param optional, dùng cho ô lọc trên màn "Nhân viên" để dễ tìm đúng nhóm người cần gán Chức vụ trước khi cấu hình cây duyệt. `DepartmentId` lọc qua `Group.DepartmentId` (không cần biết Group con); `GroupId` lọc chính xác 1 Group; có thể kết hợp cả 2 (thực tế `GroupId` đã đủ hẹp, `DepartmentId` chỉ còn tác dụng lọc thô).

### 3.5b Lũy kế DỰ KIẾN — `projectedDayToDate`/`projectedMonthToDate`/`projectedYearToDate` (2026-08-06, REDESIGN 2026-08-19, thêm `projectedDayToDate` 2026-08-26)

`monthToDate`/`yearToDate` chỉ cộng khi đơn OT đạt `Completed` (xem [attendance-module.md §Lũy kế tháng/năm](attendance-module.md)) — nên nếu nhân viên đang có 1 đơn khác chưa được duyệt xong, hạn mức không phản ánh được phần đó, dễ gây trường hợp tạo 2 đơn cùng lúc mà đơn nào cũng không thấy cảnh báo vượt hạn mức. `projectedDayToDate`/`projectedMonthToDate`/`projectedYearToDate` giải quyết việc này: tính = thực tế + mọi đơn khác của người đó còn hiệu lực (`!IsRemoved && Status != Rejected && !IsDeleted`) rơi vào **đúng ngày/tháng/năm của `date` query param** (không phải hôm nay thực tế) — **không lưu ở đâu cả, BE tính trực tiếp mỗi lần gọi** từ 2026-08-19 (trước đó là bộ đếm cộng/trừ dần trên `Employee`, đã bỏ — xem [attendance-module.md §Lũy kế dự kiến](attendance-module.md)).

FE dùng field nào ở đâu:
- **`GET /api/Employee/by-group/{groupId}?date=`** (chọn nhân viên lúc TẠO đơn mới) → dùng `projectedDayToDate`/`projectedMonthToDate`/`projectedYearToDate`, **BẮT BUỘC truyền `date`** = ngày trên đơn đang tạo (§3.5). Đây là **nguồn DUY NHẤT** trả 3 field này có ý nghĩa — mọi endpoint `EmployeeDto` khác trả về `0`.
- **`OtFormEmployeeDto.monthToDate`/`yearToDate`** (§4.3, hiện trên 1 đơn cụ thể — chi tiết/sửa/PDF/email) → vẫn 2 tên field cũ, vẫn là **snapshot lũy kế dự kiến** tại thời điểm tạo đơn, TRƯỚC khi cộng chính đơn đó (không đổi từ 2026-08-06) — không đổi tên field, chỉ đổi cách BE tính ra số để chụp.
- Màn quản lý nhân viên (`EmployeeList`, Admin) dùng `monthToDate`/`yearToDate` (thực tế, §3.5a) — không liên quan tới 1 đơn cụ thể nào, và Admin **không còn sửa tay được nữa** (§3.6).

**Tra Group của 1 userName bất kỳ — `GET /api/Employee/by-username/{userName}`** (mới, 2026-07-17, permission `Attendance.Employee.View`): trả về `EmployeeDto` (có `groupId`/`groupNameVn`) của nhân viên có `userName` khớp, 404 nếu chưa được gán. Dùng ở màn Admin **"Phân quyền duyệt"** (§5, §1.3.F) — khi Admin gõ/chọn 1 tài khoản để gán làm Trưởng nhóm, gọi endpoint này để **gợi ý** luôn Bộ phận (Group) họ đang thuộc, đỡ phải tra thủ công ngoài hệ thống rồi mới chọn đúng `scopeId`. **Đây chỉ là gợi ý best-effort, không bắt buộc**: 404 là chuyện bình thường với Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc/Trưởng Bộ phận — các cấp quản lý này không nhất thiết có hồ sơ `Employee`, lúc đó Admin vẫn chọn `scopeId` thủ công từ dropdown Group/Department như bình thường, không phải lỗi.

### 3.5c Lịch sử lũy kế theo tháng/năm (mới, 2026-08-11d)

> Tính năng hoàn toàn MỚI — `monthToDate`/`yearToDate` chỉ là bộ đếm SỐNG, bị ghi đè về 0 mỗi khi
> rollover sang tháng/năm mới nên không giữ được lịch sử tháng đã qua. Ledger mới
> (`EmployeeAccumulationHistory`) ghi dần từ thời điểm này trở đi — **KHÔNG có dữ liệu trước đó, không
> backfill**. Gate bằng `Attendance.OTForm.Approve` (KHÔNG phải `Attendance.Employee.View`) — Admin +
> bất kỳ ai giữ quyền duyệt đều xem được, nhưng người không phải Admin CHỈ xem được nhân viên trong
> phạm vi mình quản lý (suy theo ĐÚNG vị trí Cây chức vụ của người gọi, xem dưới).

`GET /api/Employee/in-my-scope?pageIndex=&pageSize=&keyword=` (`Attendance.OTForm.Approve`) →
`PagedResponse<EmployeeDto>` — danh sách nhân viên trong phạm vi người gọi, dùng để tự tìm 1 nhân viên
mà KHÔNG cần `Attendance.Employee.View` (mọi action đọc khác trên `EmployeeController` đều gate quyền
đó). Phạm vi:
- Admin → không giới hạn.
- Người gọi có `JobTitle.TerminalLevel` = WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc) →
  toàn công ty.
- Người gọi có `DepartmentId` (Manager) → nhân viên có `DepartmentId` trùng, hoặc `Group.DepartmentId` trùng.
- Còn lại (Staff/Group Leader/Team Leader, cấp Nhóm) → chỉ nhân viên có `GroupId` trùng.
- Người gọi chưa liên kết Employee (`UserName` không khớp ai) → 400.

**Sửa tay lũy kế** (quyền `Attendance.EmployeeAccumulation.Update` — Admin + Người phụ trách Bộ phận/Nhóm
tự động có; scope: Bộ phận phụ trách → mọi nhân viên trong Bộ phận, Nhóm phụ trách → chỉ nhân viên trong Nhóm,
Admin → tất cả; không bắt lý do, không ghi log):
- `GET /api/Employee/{id}/accumulation-history/manage?year=` → cùng `EmployeeAccumulationHistoryYearDto` như
  endpoint bên dưới nhưng gate bằng quyền Update (không đòi `OTForm.Approve`).
- `PUT /api/Employee/{id}/accumulation-history` body `{ year, initialBalanceHours, months: [{month 1..12, totalHours}] }`
  → đặt lại số giờ từng tháng + số dư đầu kỳ (dòng `Month = 0` của ledger); trả `EmployeeAccumulationHistoryYearDto` mới.
  Tổng cả năm = `initialBalanceHours` + tổng 12 tháng; FE cho nhập thẳng tổng năm rồi tự quy ra `initialBalanceHours`
  (không được âm). Giá trị 0 mà chưa có dòng thì không tạo dòng.

`GET /api/Employee/{id}/accumulation-history?year=2026` (`Attendance.OTForm.Approve`, cùng phạm vi
trên) → `EmployeeAccumulationHistoryYearDto`:
```jsonc
{
  "employeeId": 42, "employeeCode": "N-30479", "employeeFullName": "Phan Nguyễn Mạnh Cường",
  "year": 2026,
  "months": [
    { "month": 1, "totalHours": 0 },
    { "month": 2, "totalHours": 12.5 }
    // ... luôn đủ 12 phần tử, tháng chưa có đơn Hoàn tất nào = totalHours 0
  ],
  "yearTotalHours": 12.5
}
```
`yearTotalHours` = tổng `months[].totalHours` — LUÔN cộng đủ 12 tháng của năm được chọn (kể cả tháng
tương lai, nếu đã có đơn `Completed` dán ngày tháng đó — ledger ghi ngay không đợi tới đúng tháng).
KHÔNG nhầm với `EmployeeDto.yearToDate` (§3.5a, năm hiện tại) — field đó chỉ cộng tới **đúng tháng thực
tế hôm nay**, nên nếu có 1 đơn tương lai đã `Completed` sớm, `yearTotalHours` (năm hiện tại) sẽ **lớn
hơn** `yearToDate` cho tới khi lịch thực tế bắt kịp. Sai đơn vị (khác Nhóm/Bộ phận người gọi quản lý) → 400.

**FE:** `AccumulationHistoryTable.tsx` (bảng 12 tháng, tô đỏ theo `AttendanceSetting.monthlyOtHourLimit`/
`yearlyOtHourLimit` giống `EmployeeList.tsx`) + `AccumulationHistoryModal.tsx` (modal chọn năm, dùng
chung ở cả 3 nơi) — nút trong `EmployeeList.tsx` (Admin), icon cạnh cột Lũy kế năm trong
`OtFormDetail.tsx` (theo `canApprove`), và màn mới `/ot/accumulation` (`AccumulationLookupPage.tsx`,
gọi `GET /in-my-scope` tự tìm nhân viên, không cần mở sẵn 1 đơn) — sidebar mục "Lũy kế nhân viên", cùng
điều kiện quyền với "Đơn tổng".

### 3.6 Điều chỉnh lũy kế thủ công — ĐÃ XOÁ HOÀN TOÀN (2026-08-08 → 2026-08-19)

Trước đây `PATCH /api/Employee/{id}/adjust-accumulation` + `GET /api/Employee/me` cho phép **chính nhân
viên tự chỉnh** `monthToDate`/`yearToDate` của mình (màn "Lũy kế của tôi") — đã xoá 2026-08-08 (người
dùng chốt "user không thể tự thay đổi lũy kế của họ được, việc này do Admin đảm nhận"), lúc đó vẫn còn
cho **Admin** chỉnh qua `PUT /api/Employee/{id}` (`UpdateEmployeeDto.monthToDate/yearToDate`).

**2026-08-19: bỏ nốt luôn cả đường Admin** — `monthToDate`/`yearToDate` không còn là cột lưu trên
`Employee` nữa (tính lúc đọc từ ledger, xem §3.5a), nên **không còn field nào để chỉnh tay cả**.
`CreateEmployeeDto`/`UpdateEmployeeDto` không còn `monthToDate`/`yearToDate` — gửi lên sẽ bị BE bỏ qua
(không phải lỗi 400, chỉ đơn giản là DTO không còn field đó, gửi thừa cũng không sao). Lý do: (1) sửa
tay không ghi lại vào ledger nên sẽ lệch với tra cứu lịch sử (§3.5c) — "hiện tại" ra số đã sửa, "tra
cứu tháng đó" vẫn ra số ledger gốc; (2) lý do gốc của tính năng này (nhập liệu lũy kế cũ khi ledger
chưa tồn tại) không còn áp dụng sau đợt reset dữ liệu demo (xem attendance-module.md §DB). Muốn sửa sai
số liệu giờ chỉ còn cách sửa thẳng dữ liệu OT gốc (đơn/`OtFormEmployee`) khiến ledger tự tính lại đúng.

### 3.7 Import Excel nhân sự hàng loạt — `/api/EmployeeImport` (Admin, 2026-07-16)

Import file `.xlsx` (cột: No./Employee code/Full name/Department/Department Name/Group/Group Name — dòng tiêu đề tự dò theo cột "Employee code", không cố định ở dòng 1) — **upsert theo `Employee.Code`** (mã đã có thì cập nhật `firstName`/`lastName`/`groupId`, mã chưa có thì tạo mới), **tự tạo `Department`/`Group` mới** nếu mã trong file chưa tồn tại. Permission: `Attendance.Employee.Create` (dùng lại, không có permission "import" riêng).

Pattern **Preview → Confirm** (giống hệt import Device bên module Asset — [asset-api-fe.md](asset-api-fe.md) nếu có mục tương ứng): FE luôn gọi Preview trước cho user xem/sửa, rồi gửi lại **nguyên** danh sách đó (kể cả field `Resolved*`/`isNew*` — BE tự re-validate lại từ đầu, không tin dữ liệu Preview cũ) sang Confirm.

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

### 3.8 Import/Export nhân sự dưới chuyền — `/api/ProductionEmployeeImport`, `/api/ProductionEmployeeExport` (2026-08-27)

Nạp/xuất `ProductionEmployee` theo đúng format `docs/Data/Import_Nhan_Su_Che_Tao.xlsx` (sheet `OT(N+1)`).
Pattern **Preview → Confirm** y hệt §3.7, cộng thêm 1 bước riêng "Áp dụng lũy kế" — chi tiết thiết kế
xem `attendance-module.md` §Import/Export nhân sự dưới chuyền.

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
// O=LEADER — 2026-08-27b) — file xuất ra dùng lại được ngay làm file Import tháng sau.
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
- **FE (`ProductionEmployeeImportDialog.tsx`, 2026-08-27b)**: bản xem trước tách thành 6 tab (Tất cả/
  Mới/Cập nhật/Không đổi/Lỗi/Bị gỡ, mỗi tab có số đếm) — lọc lại client-side từ CÙNG `rows`/`removedRows`
  của response Preview (`isNewProductionEmployee`/`isUpdatedProductionEmployee`/`isValid`), không gọi
  thêm API nào. Nút Import/Export gom vào 1 dropdown "Excel" ở toolbar view "Nhân viên dưới chuyền".

### 3.8b `GET /api/ProductionEmployee/page-nation` — Màn "Nhân viên dưới chuyền" (2026-08-27b, mới)

View đọc thẳng bảng `ProductionEmployees` (KHÁC `Employee/grid-list` §3.1 đọc bảng `Employees`) — hiển
thị đúng dữ liệu chuyền mới nhất (Line/Team/Nhóm ca/Công đoạn/Trưởng nhóm) thay vì Nhóm/Phòng ban/Chức
vụ tổ chức. Nguồn chính vẫn là Import lại Excel (§3.8, nạp đè hết mỗi tháng) — `PUT /{id}` bên dưới
(2026-09-04) chỉ để sửa nhanh 1 dòng giữa 2 đợt import. Permission xem RIÊNG
`Attendance.ProductionEmployee.View` (từ 2026-09-26; trước đó dùng chung `Attendance.Employee.View` nên Người phụ trách/Trưởng nhóm đều xem được) — Admin chỉ định theo Chức vụ hoặc từng user.
Có quyền không có nghĩa xem được toàn công ty: từ 2026-09-28, response tự lọc còn lại nhân sự thuộc Phòng
ban/Nhóm mà `callerUserName` đang phụ trách (Admin không bị lọc) — FE không cần tự lọc thêm, chỉ cần
truyền đúng token.

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
  Permission của 4 endpoint `search`/`line-options`/`team-options`/`shift-team-options` (`ProductionEmployeeController`):
  `Attendance.OTForm.Create` **OR** `Attendance.OTForm.CreateProduction` (2026-09-28 — trước đó chỉ nhận
  `Create`, khiến Line Leader chỉ có `CreateProduction` bị 403 ngay ở bước tìm nhân viên "Theo chuyền",
  triệu chứng FE là "Không tìm thấy ai khớp bộ lọc" thay vì lỗi 403 hiện rõ vì FE `.catch()` nuốt lỗi và
  giữ nguyên danh sách rỗng).
- `monthToDate`/`yearToDate` là lũy kế THẬT (từ `EmployeeAccumulationHistory`, scope theo năm/tháng
  thực tế hôm nay) — cùng công thức `EmployeeService.GetPagedAsync`, không phải số tĩnh từ file import.
- `productionLineId`/`teamId`/`shiftTeamId` (mới 2026-09-04) — dùng để FE chọn sẵn đúng giá trị hiện tại
  khi mở form sửa (`PUT` bên dưới), trước đó chỉ có 3 field Code (chỉ để hiển thị).

**`PUT /api/ProductionEmployee/{id}`** (permission RIÊNG `Attendance.ProductionEmployee.Update`, khác
`.Import` — mới 2026-09-04) — sửa Team/Line/Nhóm ca/Trưởng nhóm của 1 dòng:
```jsonc
// body — UpdateProductionEmployeeDto (3 Id đều nullable — null = gỡ về không xác định)
{ "productionLineId": 7, "teamId": 3, "shiftTeamId": 9, "isLeader": true }
```
BE tự tra lại `LineCode`/`TeamCode`/`ShiftTeamCode` từ đúng Id gửi lên (FE không gửi Code tay) để 2
field Id/Code không bao giờ lệch nhau. **Lưu ý**: dữ liệu sửa ở đây sẽ bị **ghi đè lại** đúng theo file
ở lần Import Excel kế tiếp; `isLeader=true` có hiệu lực NGAY cho luồng duyệt "theo chuyền" của Line đó
(đọc sống, không cache) — xem `attendance-module.md §Import nhân sự dưới chuyền`.

## 4. OtForm (`/api/OtForm`) — nghiệp vụ chính

> **⚠ Giai đoạn 3.1 (2026-08-07)** — bảng route và các mục §4.1a/§4.2a bên dưới đã lỗi thời ở phần mô
> tả Draft/Submitter/GroupHead. Đã sửa trực tiếp trong bảng route; các mục con giữ nguyên nội dung cũ
> làm tư liệu lịch sử NHƯNG được đánh dấu rõ — xem §Cây chức vụ ở `attendance-module.md` cho model hiện tại.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtForm/my-create-scopes` | `Attendance.OTForm.Create` | Bộ phận/Phòng ban mà **chính mình** được phép tạo đơn (tối đa 1 phần tử) — gọi TRƯỚC khi mở màn "Tạo đơn tăng ca" (§4.0a) |
| GET | `/api/OtForm/my-production-create-scopes` | `Attendance.OTForm.CreateProduction` | (Những) tổ hợp Team/Line/Nhóm ca mà **chính mình** đang là Line Leader — gọi TRƯỚC khi mở tab "Theo chuyền" (§4.0b, mới 2026-09-28) |
| POST | `/api/OtForm` | `Attendance.OTForm.Create` | Tạo đơn — vào chuỗi duyệt Cây chức vụ **ngay lập tức** (`status=InApproval`, hoặc `Completed` nếu chuỗi rỗng), không còn Draft (§4.1) |
| GET | `/api/OtForm/my-forms?pageIndex=&pageSize=&groupId=&departmentId=&productionLineId=&productionTeamId=&productionShiftTeamId=` | `Attendance.OTForm.View` | Đơn do **chính mình** tạo |
| GET | `/api/OtForm/pending-approvals?pageIndex=&pageSize=&groupId=&departmentId=&productionLineId=&productionTeamId=&productionShiftTeamId=` | `Attendance.OTForm.Approve` | Đơn đang **chờ chính mình** xử lý — tự lọc theo bước hiện tại (`Status=Pending`, `StepOrder` nhỏ nhất) có mặt trong `Candidates`; mỗi item có `currentStepCandidateCount` (§4.2, mới 2026-08-08) + `productionLineNames`/`productionShiftTeamNames` (§4.2, mới 2026-09-04) |
| GET | `/api/OtForm/pending-approvals/count` | `Attendance.OTForm.Approve` | Đếm nhanh cho badge sidebar (mới 2026-08-19) — trả về `data:int`, cùng logic lọc "bước hiện tại" với `pending-approvals` nhưng KHÔNG phân trang/không map DTO danh sách. Xem §4.2d. |
| GET | `/api/OtForm/pending-approvals/dates?fromDate=&toDate=` | `Attendance.OTForm.Approve` | Lịch mini "ngày nào có đơn chưa duyệt" (mới 2026-09-04) — trả `data: PendingApprovalDateCountDto[] {date, count}`, cùng scoping với `pending-approvals`. Xem §4.2e. |
| GET | `/api/OtForm/my-actions?pageIndex=&pageSize=&groupId=&departmentId=&productionLineId=&productionTeamId=&productionShiftTeamId=` | `Attendance.OTForm.View` | Lịch sử đơn **chính mình đã xử lý** (Ký/Duyệt/Từ chối) ở bất kỳ bước nào (§4.2b) |
| GET | `/api/OtForm/all-forms?pageIndex=&pageSize=&groupId=&departmentId=&productionLineId=&productionTeamId=&productionShiftTeamId=` | `Attendance.OTForm.ViewAll` (**Admin only**, mới 2026-09-04) | "Tất cả đơn" — toàn bộ đơn trong hệ thống, KHÔNG lọc theo user gọi API (khác 4 dòng trên). Xem §4.2f. |
| GET | `/api/OtForm/{id}` | `Attendance.OTForm.View` | Chi tiết đầy đủ 1 đơn, gồm `approvalSteps[]` (mới) |
| PUT | `/api/OtForm/{id}` | `Attendance.OTForm.Create` | Sửa giờ/`didEat`/ghi chú từng nhân viên đang active **+ thêm/loại nhân viên** (mới 2026-09-04) + `secondaryPassword` [Required] — đơn theo Nhóm chỉ chính người tạo, đơn theo chuyền theo TỪNG BƯỚC (§4.1b) |
| POST | `/api/OtForm/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt "bước đang chờ" hiện tại — tự cộng lũy kế nhân viên nếu đạt Completed |
| POST | `/api/OtForm/{id}/reject` | `Attendance.OTForm.Approve` | Từ chối đơn ở bước đang chờ (dừng luồng, các bước Pending còn lại chuyển Skipped) |
| POST | `/api/OtForm/{id}/employees/add` | — | **ĐÃ XOÁ (2026-09-04)** — trả 404, gộp vào `PUT /{id}` (§4.5b) |
| POST | `/api/OtForm/{id}/employees/remove` | `Attendance.OTForm.RemoveEmployee` | Loại 1 nhân viên khỏi đơn, ngay trên màn Duyệt — candidate bước hiện tại, KHÔNG cần creator (§4.5a, khôi phục 2026-09-30) |
| POST | `/api/OtForm/{id}/delete` | `Attendance.OTForm.Delete` (Admin only) | Xoá đơn kẹt vĩnh viễn — 400 nếu `Completed` (§4.1c, mới 2026-08-08) |
| GET | `/api/OtForm/email-confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xem trước đơn để duyệt qua link email — xem §4.6 |
| POST | `/api/OtForm/email-confirm/{token}/approve` | Không cần (`[AllowAnonymous]`) | Duyệt qua link email — xem §4.6 |
| POST | `/api/OtForm/email-confirm/{token}/reject` | Không cần (`[AllowAnonymous]`) | Từ chối qua link email — xem §4.6 |

### 4.0a `GET /api/OtForm/my-create-scopes` — Bộ phận được phép tạo đơn (mới, 2026-07-17)

```jsonc
// response — data: MyCreateScopeItemDto[]
[
  { "groupId": 5, "groupNameVn": "Nhóm 1", "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp" }
]
```

**Gọi endpoint này TRƯỚC khi mở màn "Tạo đơn tăng ca"** (§1.3.A) để tự điền sẵn Bộ phận/Phòng ban thay vì bắt Nhân viên/Trưởng nhóm tự chọn từ toàn bộ danh sách — họ vốn chỉ tạo được cho đúng phạm vi cố định này (§4.1, 2 nhánh `UserApprovalScope(Submitter)` hoặc `Employee.GroupId`), việc bắt chọn lại từ dropdown đầy đủ chỉ tạo thêm bước thừa và dễ chọn nhầm (dẫn tới 400 ở bước submit).

- **Trả về đúng 1 phần tử** (trường hợp phổ biến nhất — 1 Nhân viên/Trưởng nhóm chỉ phụ trách đúng 1 Bộ phận): FE **tự điền sẵn** `groupId`/`departmentId` trên form, khóa 2 field này lại (readonly/disabled) — đúng ý "không cần phải điền phần đó".
- **Trả về nhiều phần tử** (1 Trưởng nhóm được Admin gán quyền cho nhiều Bộ phận, hiếm gặp): hiện dropdown Bộ phận nhưng **chỉ liệt kê đúng các phần tử trong mảng này**, không phải toàn bộ `Group/all` — chọn 1 thì Phòng ban tự điền theo `departmentId` tương ứng.
- **Trả về mảng rỗng**: 2 trường hợp — (1) tài khoản Admin (Admin không giới hạn phạm vi, FE hiện lại đúng dropdown chọn tự do như trước 2026-07-17, dùng `Department/all` + `Group/by-department/{id}` như cũ); (2) tài khoản Role "Nhân viên"/"Trưởng nhóm" nhưng **chưa được cấu hình gì cả** (chưa gán `UserApprovalScope(Submitter)`, chưa liên kết `Employee.userName`) — trường hợp này nên chặn hẳn màn "Tạo đơn tăng ca", báo "Tài khoản chưa được cấp quyền tạo đơn cho Bộ phận nào, liên hệ Admin" thay vì cho vào form rồi chọn linh tinh.
- Permission: `Attendance.OTForm.Create` — dùng chung với quyền tạo đơn, không cần permission riêng.

### 4.0b `GET /api/OtForm/my-production-create-scopes` — Tổ hợp Team/Line/Nhóm ca của Line Leader (mới, 2026-09-28)

```jsonc
// response — data: MyProductionCreateScopeItemDto[]
[
  {
    "departmentId": 7, "departmentNameVn": "Chế tạo",                    // Bộ phận của CHÍNH người gọi — giống nhau ở MỌI phần tử (mới 2026-09-28)
    "productionLineId": 12, "lineCode": "SHIDO", "lineNameVn": null,     // lineNameVn luôn null — ProductionLine không có tên riêng, chỉ có mã (giống ProductionOptionDto)
    "teamId": 2, "teamCode": "B", "teamNameVn": "Team B",
    "shiftTeamId": 1, "shiftTeamCode": "G", "shiftTeamNameVn": "Green"
  }
]
```

Mirror `my-create-scopes` (§4.0a) nhưng cho chế độ "Theo chuyền" — gọi TRƯỚC khi mở tab "Theo chuyền" để tự điền sẵn/khoá dropdown Bộ phận + Team/Line/Nhóm ca thay vì bắt Line Leader tự chọn lại đúng Line mình phụ trách mỗi lần tạo đơn.

- `departmentId`/`departmentNameVn`: suy từ `Employee.DepartmentId ?? Employee.Group.DepartmentId` của CHÍNH người gọi (Line Leader thường được gán qua Group, vd Group "SHIDO" thuộc Bộ phận "Chế tạo", không set thẳng `DepartmentId` trên `Employee`) — **luôn khoá cứng ô "Bộ phận"** ngay khi mảng có ≥ 1 phần tử (không phụ thuộc đúng 1 hay nhiều tổ hợp Line, khác 3 field Team/Line/Nhóm ca bên dưới). Không resolve được Bộ phận nào (Employee không có cả `DepartmentId` lẫn `GroupId`) → không trả tổ hợp nào (mảng rỗng), giữ dropdown Bộ phận tự do.
- **Đúng 1 phần tử** (đa số Line Leader chỉ phụ trách 1 Line): FE tự điền sẵn cả 3 dropdown Team/Line/Nhóm ca + khoá cứng (readonly/disabled).
- **Nhiều phần tử** (Line Leader của nhiều Line, hiếm): FE giới hạn 3 dropdown Team/Line/Nhóm ca trong đúng các tổ hợp trả về (không khoá cứng, vẫn cho chọn giữa các tổ hợp) — riêng Bộ phận vẫn khoá cứng như trên.
- **Mảng rỗng**: Admin (không giới hạn, giữ dropdown tự do gọi `ProductionEmployee/team-options`/`line-options`/`shift-team-options` như cũ), hoặc tài khoản có quyền `CreateProduction` nhưng không phải Line Leader của bất kỳ tổ hợp nào (vd tài khoản Admin cấu hình quyền riêng cho HR) — cũng giữ dropdown tự do, KHÔNG chặn màn (khác `my-create-scopes`, ở đây mảng rỗng không phải lỗi cấu hình).
- Chỉ trả về tổ hợp có ĐỦ cả 3 FK resolve được (`ProductionEmployee.ProductionLineId`/`TeamId`/`ShiftTeamId` đều khác `null`) — đúng policy nạp dữ liệu Import.
- Permission: `Attendance.OTForm.CreateProduction`.

### 4.1 `POST /api/OtForm` — Tạo đơn
```jsonc
// body — CreateOtFormDto
{
  "groupId": 5, "departmentId": 1, "reasonId": 2, "otCaseId": 1,             // [Required]
  "startTime": "17:30:00", "endTime": "19:30:00",                            // TimeOnly, chuỗi "HH:mm:ss" — đây là khung giờ TỐI ĐA của đơn
  "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15",                                    // [Required], DateOnly "yyyy-MM-dd"
  "employees": [                                                             // [Required][MinLength(1)]
    { "employeeId": 100, "startTime": "18:00:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null }  // startTime optional
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null }, // vẫn optional ở body, nhưng BE LUÔN tạo ProcessPart + ép isEat=true dù gửi gì (xem ngay dưới)
  "secondaryPassword": "..."                                                  // [Required], mới 2026-08-28 — xem §4.4
}
```
- `employees[].startTime` / `employees[].endTime` chỉnh riêng được cho từng người, nhưng phải nằm trong khung giờ của đơn: **`startTime` của đơn <= `employees[].startTime` < `employees[].endTime` <= `endTime` của đơn** — sai thì 400 (`DomainException`, kèm mã nhân viên vi phạm). `employees[].startTime` là `string | null` — `null` = lấy `startTime` của đơn.
- **`endTime` của đơn phải > `startTime` của đơn — KHÔNG hỗ trợ ca qua đêm** (2026-08-26, theo yêu cầu
  người dùng): `endTime <= startTime` → 400 ngay đầu `CreateAsync`, trước khi làm bất kỳ việc gì khác
  (áp dụng cho cả 2 kiểu tạo đơn, theo Nhóm lẫn theo chuyền). Trước đây không có validate này — FE từng
  tự hiểu ngầm `endTime < startTime` là "qua ngày hôm sau" và cộng thêm 24h khi tính `totalHour`, nhưng
  hệ thống chưa từng hỗ trợ đúng ca qua đêm ở chỗ khác (dòng ngay trên so `endTime`/`startTime` bằng
  `TimeOnly` trực tiếp, không tính ngày) — dễ tạo nhầm đơn dài bất thường (vd 14h→06h ra 16h) mà không
  ai nhận ra ngay. FE `CreateOtFormPage.tsx` tự chặn trước khi gọi API (hiện lỗi ngay dưới ô "Giờ kết
  thúc"), BE luôn là nguồn chặn thật.
- `employees[].employeeId` **phải cùng `groupId`** với đơn — khác nhóm → 400 (`DomainException`).
- **`departmentId` phải đúng là Department của `groupId` đã chọn** (`Group.DepartmentId`, mới 2026-07-17) — gửi cặp `groupId`/`departmentId` không khớp nhau → 400 "Nhóm '...' không thuộc Bộ phận đã chọn." Dùng đúng cascading dropdown §3.2 (chọn Department trước, Group lọc theo `by-department/{id}`) sẽ không bao giờ gặp lỗi này.
- **KHÔNG có field chữ ký nào trong body** — chữ ký (nếu bước nào đó trong chuỗi yêu cầu) chỉ bắt buộc lúc Duyệt (§4.4), không phải lúc tạo. Đơn vào chuỗi duyệt **ngay lập tức** (`status=InApproval`), hoặc `status=Completed` ngay nếu chuỗi rỗng (người tạo đã ở cấp cao nhất áp dụng cho `otCaseId` đó) — không còn khái niệm Draft. `approvalHistories` của response sẽ **rỗng** (chưa ai duyệt).
- **`processPart.isEat` LUÔN `true` (bắt buộc cho MỌI đơn, 2026-09-28, theo yêu cầu người dùng)** — BE
  (`OtFormService.FinalizeCreateAsync`) LUÔN tạo `ProcessPart` cho đơn mới bất kể `request.ProcessPart`
  có gửi lên hay `null`, và luôn ép `IsEat = true` dù client gửi `false`. `CreateOtFormPage.tsx` không
  còn checkbox "Ăn uống" để tắt nữa — 2 mục `isTransportation`/`isUseCopyRoom` vẫn tuỳ chọn thật.
  `ProcessPart` cố định sau khi tạo (không sửa được qua `PUT /api/OtForm/{id}`, xem §4.1b).
- **`processPart.mainTicketCount`/`secondaryTicketCount`/`milkCount`** (số nguyên `int`, mặc định `0`) — số lượng phiếu ăn theo loại (phiếu chính/phiếu phụ/sữa). Người lập đơn **tự nhập tay 3 ô số lượng này** cho **cả đơn** (không phải theo từng nhân viên) — BE không tự tính, không validate tổng khớp `numberOfEmployee` hay `employees[].mealTicketType`.
- **Điều kiện được phép tạo** (đổi 2026-08-07, Giai đoạn 3.1 — bỏ nhánh `UserApprovalScope(Submitter)`): tài khoản đang gọi API phải được liên kết với 1 `Employee` (`Employee.UserName`) có **đúng `groupId` với đơn**, hoặc là Admin (không giới hạn phạm vi). Không thoả → 400 (`DomainException` "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình..."). Employee liên kết với người tạo cũng chính là cơ sở để suy luận chuỗi duyệt (Admin tạo hộ thì coi như cấp thấp nhất — chuỗi vẫn chạy đầy đủ từ bước đầu của Department).
- **Chuỗi duyệt không đủ KHÔNG chặn tạo đơn** — nếu Department chưa cấu hình cây duyệt, hoặc thiếu người giữ đúng Chức vụ ở 1 bước nào đó, đơn vẫn được tạo với chuỗi cắt cụt tới đâu hay tới đó; `response.data.approvalChainWarning` (string, `null` nếu đủ) cho biết lý do cụ thể — FE hiện banner cảnh báo trên màn chi tiết đơn khi field này khác `null` (xem §4.3).
- Response `201 Created` (Location header trỏ `GET /{id}`), `data` = `OtFormDto` (§4.3) đầy đủ luôn — không cần gọi lại `GetById`.
- **`secondaryPassword` bắt buộc (mới 2026-08-28)** — re-verify NGAY ĐẦU hàm (trước khi làm bất kỳ việc gì khác), cùng cơ chế `ApproveOtFormDto.secondaryPassword` (§4.4). Sai/chưa đăng ký → 400.
- **Đơn theo chuyền (`isProductionForm=true`) — Nhóm ca bắt buộc (mới 2026-08-28)**: mỗi `employees[].employeeId` phải có `ProductionEmployee.ShiftTeamId != null`, thiếu thì 400 liệt kê đúng mã nhân viên (phòng vệ thêm — Import đã chặn từ 2026-08-24, xem `attendance-module.md` §Giai đoạn 11).

### 4.1a `POST /api/OtForm/{id}/submit` — ĐÃ XOÁ (2026-08-07, Giai đoạn 3.1)

Endpoint này **không còn tồn tại** — khái niệm "Trưởng nhóm ký duyệt Người đề nghị"/Draft đã bị xoá bỏ
hoàn toàn, thay bằng chuỗi duyệt tự động theo Cây chức vụ bắt đầu ngay từ lúc tạo đơn (§4.1). FE nào
còn gọi endpoint này sẽ nhận 404.

### 4.1b `PUT /api/OtForm/{id}` — Sửa đơn (2026-07-16, giới hạn lại 2026-07-31, **gộp thêm/xóa NV 2026-09-04**)

**2026-09-04**: `employees[]` giờ có thể chứa **cả NV MỚI** (không có trong đơn trước đó) — BE tự diff so
với danh sách active hiện có để suy ai giữ nguyên/ai mới thêm; loại NV đi qua field mới
`removedEmployees[]` (bắt buộc `reason`) — dùng khi loại người CÙNG LÚC với sửa giờ/note trong 1 lượt
"Sửa đơn". `POST {id}/employees/add` (bản trong-app) vẫn đã xoá, trả 404. **`POST {id}/employees/remove`
đã khôi phục lại (2026-09-30, §4.5a)** làm route riêng cho case chỉ muốn loại nhanh 1 người ngay trên màn
Duyệt mà không phải vào Sửa đơn — và quan trọng hơn: route riêng này authorize theo candidate bước hiện
tại, còn `PUT /{id}` với đơn theo Nhóm vẫn chỉ creator mới gọi được.
```jsonc
// UpdateOtFormDto — 2026-09-04
{
  "employees": [
    // NV cũ: sửa thực tích như trước. NV MỚI: employeeId chưa có trong đơn — BE validate y hệt lúc
    // Thêm NV cũ (giờ hợp lệ, trùng giờ OT, giới hạn ngày/tháng/năm) + LUẬT MỚI: đơn theo chuyền phải
    // cùng Line/Nhóm ca với NV còn lại của đơn (xem attendance-module.md §Gộp thêm/xóa NV vào Sửa đơn).
    { "employeeId": 100, "startTime": "18:00:00", "endTime": "20:00:00", "didEat": true, "noteVn": null, "noteJp": null },  // startTime null = giữ nguyên
    { "employeeId": 205, "endTime": "19:00:00", "didEat": false, "noteVn": null, "noteJp": null }
    // didEat: đơn Theo chuyền (isProductionForm=true) BE LUÔN ép true bất kể gửi gì lên (2026-09-28,
    // Ăn uống bắt buộc — xem OtFormService.ResolveDidEat); đơn Theo Nhóm giữ nguyên như FE gửi, ý nghĩa
    // field KHÔNG đổi (true = ăn TRONG ca, bị trừ MealBreakDeductionHours) — FE chỉ hiển thị đảo ngược
    // dưới nhãn "Ăn sau" (xem attendance-module.md §Có ăn hay không theo từng nhân viên).
  ],
  "removedEmployees": [
    { "employeeId": 101, "reason": "Nghỉ đột xuất" }  // NV đang có trong đơn nhưng KHÔNG có mặt ở employees[] phải khai ở đây, nếu không BE trả 400
  ],
  "secondaryPassword": "..."   // [Required] — 1 LẦN cho TOÀN BỘ thay đổi (thêm+xóa+sửa giờ) trong lượt Lưu này
}
```
- **Ai gọi được**: giữ nguyên luật cũ — đơn theo Nhóm chỉ chính người tạo (+ chưa bước nào Approved); đơn
  theo chuyền theo TỪNG BƯỚC (candidate của bước Pending hiện tại). Luật này giờ áp dụng LUÔN cho cả
  thêm/xóa NV (trước đây 2 action cũ dùng quyền riêng "candidate bước hiện tại cho MỌI loại đơn" — thu
  hẹp có chủ đích cho đơn theo Nhóm khi gộp lại, 2026-09-04).
- **Validate NV giữ nguyên**: mọi NV đang active mà KHÔNG có mặt ở `employees[]` LẪN `removedEmployees[]`
  → 400 "Danh sách nhân viên trong đơn không khớp — thiếu nhân viên đang có trong đơn". Tổng NV còn lại
  (giữ nguyên + mới thêm) phải ≥ 1.
- Mỗi dòng validate `otForm.StartTime <= startTime < endTime <= otForm.EndTime` (cùng luật §4.1). `startTime: null` → NV giữ nguyên giữ giờ bắt đầu hiện có, NV mới thêm lấy `startTime` của đơn. Đổi giờ bắt đầu được ghi `OtFormEditLog` (field `"StartTime"`).
- Response `data` = `OtFormDto` (§4.3) đầy đủ sau khi sửa.
- Permission: `Attendance.OTForm.Create` (không đổi).
- **FE (`CreateOtFormPage.tsx`, dùng chung với Tạo mới)**: `isEditMode` vẫn khoá "Thông tin đơn"/"Yêu
  cầu hỗ trợ khác" như cũ, nhưng bảng nhân viên giờ có thêm: khối tìm NV mới (keyword-only, KHÔNG lọc
  Line/Nhóm ca ở FE — BE mới là nơi chặn thật) + nút "Loại khỏi đơn" trên từng dòng NV cũ (yêu cầu lý do
  qua panel nhỏ). Cả 2 đều chỉ TẠM (state cục bộ `pendingRemovals`/`selectedEmployeeIds`), áp dụng thật
  khi bấm "Lưu thay đổi".
- **Vá lỗ hổng phạm vi (2026-07-17, cập nhật 2026-08-07)**: `UpdateAsync` re-check quyền scope của
  người sửa (`Employee.GroupId == groupId của đơn` hoặc Admin — đã bỏ nhánh `UserApprovalScope(Submitter)`
  cũ ở Giai đoạn 3.1) dựa trên `groupId`/`departmentId` **hiện có của đơn** (không còn nhận từ body) —
  phòng trường hợp Admin thu hồi liên kết Employee của người tạo sau khi đơn đã được tạo.

### 4.1c `POST /api/OtForm/{id}/delete` — Xoá đơn kẹt vĩnh viễn (mới, 2026-08-08, Admin only)
Body: `{ "reason": "..." }` ([Required]). Permission `Attendance.OTForm.Delete` — **chỉ Admin** được
gán (không role nghiệp vụ nào khác, kể cả TGĐ). Dùng cho đơn kẹt cứng trong chuỗi duyệt (1 bước thiếu
candidate, không resolve lại được — xem `attendance-module.md` §Xoá đơn kẹt vĩnh viễn).
- **400 nếu đơn đã `Completed`** (đã cộng lũy kế thật, không xoá được) — chỉ xoá được `InApproval`/`Rejected`.
- Soft-delete — response `data: true`. Đơn biến mất khỏi **mọi** danh sách/`GET /{id}` (trả 404) ngay
  sau đó, không có cách hoàn tác qua UI (chỉ Admin sửa tay DB nếu thật sự cần).
- FE: nút "Xoá đơn" (`OtFormDetail.tsx`) chỉ hiện khi có permission **và** `status !== Completed` — ẩn
  sẵn thay vì để user bấm rồi mới nhận lỗi 400. Modal xác nhận bắt buộc nhập lý do; thành công thì điều
  hướng về `/ot/list`.

### 4.2a `GET /api/OtForm/pending-submissions` — ĐÃ XOÁ HẲN (2026-08-08, Giai đoạn 3.2)
Route + method + tab FE "Chờ tôi ký duyệt" đã xoá hoàn toàn. Endpoint này luôn trả rỗng kể từ Giai đoạn
3.1 (khái niệm Draft/"Trưởng nhóm ký Người đề nghị" đã bị xoá bỏ trước đó) — Giai đoạn 3.2 dọn nốt phần
code/UI chết còn sót lại. Gọi route này giờ trả 404.

### 4.2 `GET /api/OtForm/my-forms` & `pending-approvals` — Danh sách (`OtFormListItemDto`)
```jsonc
// data.data[]
{ "id": 10, "groupNameVn": "Nhóm 1", "groupNameJp": null, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": "組立工場", "otCaseCode": "TH1",
  "date": "2026-07-15", "totalHour": 2.0, "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A",
  "status": 0, "isEditable": true, "currentStepCandidateCount": 2,
  "approvalSummary": [
    { "stepOrder": 1, "jobTitleNameSnapshot": "Manager", "approverUserName": "YEV\\n.van.a",
      "approverFullName": "Nguyễn Văn A", "action": 1, "actionAt": "2026-07-15T08:00:00Z" }
  ] }
```
**Đổi 2026-08-07 (Giai đoạn 3.1)**: `approvalSummary[].approvalLevel:int` → `stepOrder:int` +
`jobTitleNameSnapshot:string` (tên Chức vụ dạng text tự do lấy từ Cây chức vụ, KHÔNG map qua bảng enum
cố định nữa — hiển thị thẳng, không cần lookup). `pending-approvals` tự xác định "bước hiện tại" của
user gọi API (candidate của bước `Pending` có `StepOrder` nhỏ nhất) — FE **không** truyền tham số lọc
cấp, chỉ `pageIndex/pageSize`.

**Thêm 2026-08-08 (Giai đoạn 3.2)**: `currentStepCandidateCount:int` — số người đủ điều kiện xử lý
bước đang chờ HIỆN TẠI (0 nếu đơn không còn `InApproval` hoặc chuỗi rỗng). FE hiện "Đang chờ duyệt (1
trong N người)" thay vì chỉ "Đang chờ duyệt" khi giá trị này > 1, để người xem hiểu đây không phải
riêng họ phải xử lý — xem `OtFormListPage.tsx`.

**Lọc theo ngày + trạng thái (2026-08-06)** — cả 4 endpoint danh sách (`my-forms`/`pending-approvals`/`my-actions`/`my-participations`) nhận thêm 3 query param optional, kết hợp AND với điều kiện lọc sẵn có của từng endpoint (VD `pending-approvals` đã tự lọc theo cấp — thêm `status` chỉ thu hẹp tiếp trong tập đó):
- `fromDate`/`toDate` (`yyyy-MM-dd`) — lọc theo `OtForm.date`, bao gồm cả 2 đầu mút (`>=`/`<=`). Bỏ trống 1 trong 2 = không giới hạn đầu đó.
- `status` (int, enum `OtFormStatus` §2) — lọc đúng 1 trạng thái. Bỏ trống = không lọc.
```
GET /api/OtForm/my-forms?pageIndex=1&pageSize=50&fromDate=2026-08-01&toDate=2026-08-31&status=3
```
FE: `OtFormApi.get*({ pageIndex, pageSize, fromDate, toDate, status })` (`ot-form.api.ts`) — `status` là số nên **phải** check `!== undefined` (không dùng truthy) vì `0` (Pending) là giá trị lọc hợp lệ, xem AGENTS.md §4.4. UI bộ lọc (2 ô ngày + dropdown trạng thái + nút Tìm kiếm/Xoá lọc) nằm chung trong `OtFormListPage.tsx` — dùng cho cả 5 tab vì đây là 1 component tái dùng theo prop `mode`.
- **Hiển thị người tạo**: FE luôn dùng `createdByFullName ?? createdByUserName` (không hiển thị thẳng `createdByUserName` — yêu cầu "dữ liệu hiển thị lúc nào cũng phải là tên người dùng"). `createdByFullName` có thể `null` nếu tài khoản tạo đơn chưa từng có `FullName` trong Identity lúc tạo.
- `isEditable` (đổi 2026-08-07) = `status == InApproval && !approvalSteps.some(Approved)`, tính độc lập với người xem — ở `pending-approvals`, 1 đơn `InApproval` vẫn có `isEditable=true` nhưng KHÔNG có nghĩa người duyệt hiện tại sửa được (chỉ chính người tạo mới sửa). FE chỉ hiện nút "Sửa" khi **cả 3 điều kiện**: `isEditable=true` **và** `createdByUserName == user hiện tại` **và** có permission `OTForm.Create` — tức thực tế nút này chỉ có ý nghĩa ở tab "Đơn của tôi" (`my-forms`).
- **`approvalSummary`** — mảng rút gọn từng lần Ký/Duyệt/Từ chối đã xảy ra trên đơn (sắp theo `actionAt` tăng dần), có mặt trên **cả 5 endpoint danh sách**. Cùng shape với `approvalHistories` ở §4.3 nhưng bỏ `comment`/`signatureImage`/`hasSignature`. FE dùng field này để hiện ngay "đã được ai duyệt" trên từng dòng danh sách — danh sách **không** có tên bước đang chờ tiếp theo (field đó chỉ có ở chi tiết đơn qua `approvalSteps[]`, §4.3), FE hiện dòng "Đang chờ duyệt" chung chung khi `status==InApproval`.
- **`groupNameJp`/`departmentNameJp` (mới, 2026-07-29)** — song ngữ Việt/Nhật lấy thẳng từ `Group.GroupNameJp`/`Department.DepartmentNameJp` (nullable, `null` nếu master data chưa nhập tiếng Nhật). FE hiện dạng `"{Vn} / {Jp}"` khi có Jp, chỉ hiện Vn nếu không (xem `bilingualText` ở `modules/attendance/lib/bilingual.ts`).
- **`productionLineNames`/`productionShiftTeamNames` (mới, 2026-09-04)** — string? distinct
  `BlockCodeSnapshot`/`ShiftTeamCodeSnapshot` của các `OtFormEmployee` còn active trong đơn, nối `", "`.
  Chỉ có giá trị khi `isProductionForm=true`. Ban đầu chỉ `pending-approvals` populate field này, **mở
  rộng ra CẢ 5 endpoint danh sách cùng ngày** (tính riêng sau khi phân trang, xem `attendance-module.md`
  §Mở rộng filter ra mọi tab) — đơn không phải theo chuyền vẫn trả `null`.
- **5 filter `groupId`/`departmentId`/`productionLineId`/`productionTeamId`/`productionShiftTeamId`**
  (int?, optional, kết hợp AND với nhau và với `fromDate`/`toDate`/`status`) — dùng chung cho **CẢ 5
  endpoint danh sách** (kể cả `all-forms`, mở rộng 2026-09-04, ban đầu 3 filter Line/Team/Nhóm ca chỉ có
  ở `pending-approvals`):
  - `groupId`/`departmentId` — lọc trực tiếp `OtForm.GroupId`/`DepartmentId` (đơn văn phòng theo Nhóm có
    cả 2, đơn theo chuyền chỉ có `DepartmentId`), cùng nguồn dropdown Bộ phận/Nhóm ở `CreateOtFormPage`
    (`Department/all` + `Group/by-department/{id}`, cascading).
  - `productionLineId`/`productionTeamId`/`productionShiftTeamId` — cùng nguồn ID với dropdown
    Line/Team/ShiftTeam ở `CreateOtFormPage`. BE resolve ID → `Code` rồi lọc theo
    `OtFormEmployee.BlockCodeSnapshot`/`TeamCodeSnapshot`/`ShiftTeamCodeSnapshot`, đơn nào có ÍT NHẤT 1
    nhân viên active khớp là qua filter.
  FE (`OtFormListPage.tsx`) hiện cả 5 dropdown filter này ở MỌI tab (trước đây 3 filter Line/Team/Nhóm ca
  chỉ hiện ở "Chờ tôi duyệt").

### 4.2d `GET /api/OtForm/pending-approvals/count` — Đếm badge sidebar (mới, 2026-08-19)
Trả về `ApiResponse<int>` (`data` là số nguyên, KHÔNG bọc `PagedResponse`) — số đơn đang chờ CHÍNH
user gọi API duyệt, đúng bằng số dòng sẽ trả về nếu gọi `pending-approvals` không kèm `fromDate`/
`toDate`/`status`. Không phân trang, không map `OtFormListItemDto` — chỉ 1 `COUNT` SQL, dùng để hiển
thị số trên badge sidebar mục "Đơn tăng ca" (FE: `OtManagerSidebar.tsx` qua hook
`usePendingApprovalsCount`, tự poll lại mỗi 60 giây, chỉ gọi khi user có `Attendance.OTForm.Approve`).

### 4.2e `GET /api/OtForm/pending-approvals/dates` — Lịch mini ngày chưa duyệt (mới, 2026-09-04)
```
GET /api/OtForm/pending-approvals/dates?fromDate=2026-09-01&toDate=2026-09-30
```
Trả `data: PendingApprovalDateCountDto[]` — `{ "date": "2026-09-05", "count": 3 }` mỗi phần tử, group
theo `OtForm.Date` trong khoảng `[fromDate, toDate]`. Cùng scoping "bước hiện tại có mình trong
Candidates" với `pending-approvals`/`pending-approvals/count` — KHÔNG phân trang, ngày nào không có đơn
chưa duyệt thì không xuất hiện trong mảng (không trả `count: 0`). FE (`OtFormListPage.tsx`, chỉ tab "Chờ
tôi duyệt") hiện widget lịch tháng nhỏ (điều hướng tháng bằng nút trước/sau, badge số đơn trên mỗi ngày
có dữ liệu) — bấm 1 ngày sẽ set `fromDate=toDate=` đúng ngày đó rồi gọi lại `pending-approvals`.

### 4.2f `GET /api/OtForm/all-forms` — "Tất cả đơn" cho Admin (mới, 2026-09-04)
Cùng shape `OtFormListItemDto` + cùng 8 query param (`pageIndex/pageSize/fromDate/toDate/status/groupId/
departmentId/productionLineId/productionTeamId/productionShiftTeamId`) như 4 endpoint kia, nhưng **KHÔNG
lọc theo user gọi API** — trả về toàn bộ `OtForm` chưa xoá mềm trong hệ thống, sắp `OrderByDescending(Id)`.
Gate bằng permission riêng **`Attendance.OTForm.ViewAll`** — migration `AddOtFormViewAllPermission` chỉ
gán permission này cho role có sẵn `Attendance.Department.Create` (tức Admin), không role nghiệp vụ nào
khác (kể cả Tổng Giám Đốc) có quyền xem toàn cục. FE: tab mới "Tất cả đơn" trong `OtFormTabsPage.tsx`,
chỉ hiện khi `hasPermission(user, "Attendance.OTForm.ViewAll")`.

### 4.2c `GET /api/OtForm/my-participations` — Đơn tôi có tên trong danh sách tăng ca (mới, 2026-07-17)
Cùng shape `OtFormListItemDto` như §4.2, nhưng nguồn dữ liệu khác hẳn: trả về **mọi đơn mà chính user gọi API được liệt kê là nhân viên tăng ca** (`OtFormEmployee`), **bất kể có phải người tạo/ký/duyệt đơn đó hay không**.
- **Lý do cần endpoint này**: trước đây 1 nhân viên bình thường (không tạo đơn, không ký/duyệt) hoàn toàn không có cách nào tự tra được mình có tên trong đơn tăng ca nào — `my-forms` chỉ lọc theo người **tạo** đơn. Quan trọng nhất với Role "Nhân viên" (mới, xem §1.1) — họ tạo đơn được nhưng phần lớn nhu cầu thực tế là **xem lại đơn mình được liệt kê tăng ca**, kể cả đơn do người khác tạo/nhóm khác tạo hộ.
- BE tra qua `Employee.userName == <user gọi>` rồi lọc theo `OtFormEmployee.employeeId` — **account chưa được Admin gán `Employee.userName` thì trả danh sách rỗng** (không lỗi, không 404) — FE nên hiện thông báo nhẹ kiểu "Tài khoản chưa liên kết hồ sơ nhân viên, liên hệ Admin" thay vì coi là lỗi.
- Permission: `Attendance.OTForm.View` — mọi role nghiệp vụ đều có sẵn (kể cả Role "Nhân viên"), không cần quyền riêng.
- Click vào dòng bất kỳ → `GET /{id}` xem chi tiết như các tab khác (kể cả khi user không có quyền Sửa/Duyệt đơn đó — chỉ xem).

### 4.2b `GET /api/OtForm/my-actions` — Lịch sử đơn đã xử lý (mới, đợt 5 — 2026-07-17)
Cùng shape `OtFormListItemDto` như §4.2, nhưng nguồn dữ liệu khác hẳn: trả về **mọi đơn mà chính user gọi API đã từng Duyệt (`/approve`) hoặc Từ chối (`/reject`)** ở bất kỳ bước nào — tra theo `OtFormApprovalHistory.approverUserName`, không phải theo `createdByUserName` (khác `my-forms`) và không lọc theo status "đang chờ" (khác `pending-approvals`).
- **Lý do cần endpoint này**: đơn vừa xử lý xong (Duyệt/Từ chối) lập tức biến mất khỏi `pending-approvals` — không có màn nào để xem lại "tôi đã xử lý những đơn nào".
- Dùng chung 1 endpoint cho cả các Role (kể cả "Nhân viên") vì tất cả đều có sẵn permission `Attendance.OTForm.View` — không cần phân biệt gọi API khác nhau theo Role.
- **Gồm cả đơn bị chính user đó Từ chối** (không chỉ đơn Ký/Duyệt thành công) — đúng nghĩa "lịch sử đã xử lý", không phải "lịch sử đã đồng ý". Click vào dòng bất kỳ → `GET /{id}` xem lại đầy đủ `approvalHistories` (kèm comment lý do nếu là Từ chối).
- 1 đơn có thể xuất hiện ở `my-actions` của **nhiều user khác nhau** (VD Trưởng nhóm ký + Trưởng phòng duyệt cùng 1 đơn → cả 2 đều thấy đơn đó trong `my-actions` của riêng mình) — đây là hành vi đúng, không phải trùng lặp lỗi.

### 4.3 `GET /api/OtForm/{id}` — Chi tiết (`OtFormDto`)
```jsonc
{
  "id": 10, "groupId": 5, "groupNameVn": "Nhóm 1", "groupNameJp": null,
  "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": "組立工場",
  "reasonId": 2, "reasonNameVn": "Tăng ca sản xuất gấp", "reasonNameJp": null, "otCaseId": 1, "otCaseCode": "TH1",
  "startTime": "17:30:00", "endTime": "19:30:00", "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15", "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A",
  "creatorSignatureImage": null,
  "status": 0, "isEditable": true, "approvalChainWarning": null,
  "employees": [
    { "employeeId": 100, "employeeCode": "NV001", "fullName": "Nguyễn Văn A",
      "startTime": "17:30:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null,
      "monthToDate": 12.5, "yearToDate": 80.0, "mealTicketType": 0,
      "actualHours": 2.0, "didEat": false,
      "isRemoved": false, "removedByUserName": null, "removedByFullName": null,
      "removedAtLevel": null, "removedAt": null, "removeReason": null }
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null },   // null nếu tạo đơn không gửi
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
- **`approvalSteps[]` (MỚI, 2026-08-07, Giai đoạn 3.1)** — chuỗi bước duyệt đã SNAPSHOT lúc tạo đơn, sắp theo `stepOrder` tăng dần, KHÔNG tính lại theo tổ chức hiện tại (đơn cũ giữ nguyên chuỗi dù nhân sự/cây duyệt Phòng ban đổi sau đó). `status` = enum `OtFormApprovalStepStatus` (§2). `candidates[]` = danh sách người ĐỦ điều kiện duyệt bước đó tại thời điểm snapshot (có thể nhiều người, ai xử lý trước thì tính). "Bước đang chờ" (hiện nút Duyệt/Từ chối) = phần tử đầu tiên có `status=0 Pending` (mảng đã sắp theo `stepOrder`).
- `approvalHistories` là **audit trail đầy đủ** từng bước đã xử lý — render như timeline dọc trên UI chi tiết đơn (`action` §2 quyết định icon Duyệt/Từ chối). **Đây cũng chính là nguồn JSON để FE tự dựng file PDF in đơn** (khớp layout giấy YEV-22-024) — BE không xuất PDF, chỉ cung cấp đủ dữ liệu qua endpoint này. Dòng `action=2 Rejected` KHÔNG có chữ ký (`hasSignature=false`, `signatureImage=null`) — từ chối chỉ ghi `comment` (lý do), không ký. **Đổi 2026-08-07**: field `approvalLevel:int` → `stepOrder:int` + `jobTitleNameSnapshot:string`.
- `hasSignature` — cờ tiện dùng để FE quyết định có hiện `<img>` chữ ký hay không **mà không cần** giải mã `signatureImage` trước; `signatureImage` vẫn trả kèm nếu có (base64) để hiện trực tiếp.
- `approverFullName` — Họ tên hiển thị, snapshot tại đúng thời điểm ký (không đổi theo dù sau này tài khoản đó đổi tên). **Có thể `null`** nếu tài khoản chưa từng có `FullName` trong Identity lúc ký — FE luôn fallback `approverFullName ?? approverUserName` khi hiển thị/in PDF. Áp dụng tương tự cho `createdByFullName ?? createdByUserName` ở cấp đơn.
- **`approvalChainWarning` (MỚI, 2026-08-07)** — `string | null`. Khác `null` khi chuỗi suy luận lúc tạo đơn bị cắt cụt (Department chưa cấu hình cây duyệt, hoặc thiếu người giữ đúng Chức vụ ở 1 bước) — đơn vẫn được tạo/duyệt tới đâu hay tới đó, FE hiện banner cảnh báo (không phải lỗi chặn hành động).
- **`creatorSignatureImage` (MỚI, 2026-08-08)** — base64, `null` ở hầu hết đơn. Chỉ khác `null` khi người
  tạo đơn đã ở cấp cao hơn/bằng MỌI Chức vụ trung gian "Bắt buộc ký" của Phòng ban lúc tạo (không còn ai
  khác để ký ô "Người đề nghị" thay họ — VD chính họ đã là Section Manager tạo đơn cho nhóm mình) — khi
  đó BE tự lấy `UserSignature` đã đăng ký sẵn của người tạo snapshot vào đây (chặn tạo đơn 400 nếu chưa
  đăng ký chữ ký, cùng cơ chế §4.4). `OtFormPrintView.tsx` dùng field này để tự điền ô "Người đề nghị"
  (chỉ điền vào 1 trong 2 ô) khi không có bước trung gian "Bắt buộc ký" nào trong `approvalSteps[]` —
  xem [attendance-module.md §Người tạo tự ký ô "Người đề nghị"](attendance-module.md). Field
  `requesterEmployeeId`/`responsibleEmployeeId` cùng các field liên quan trên `GroupDto`/
  `CreateOtFormDto`/`OtFormDto` (thiết kế cũ, per-Group, không thuộc Cây chức vụ) **đã xoá hẳn**
  2026-08-08 — không còn tồn tại trong bất kỳ contract nào ở tài liệu này.
- **Ô "Tên công đoạn / 工程名" trên form giấy `YEV-22-024` KHÔNG có field tương ứng trong `OtFormDto`** — BE hiện không lưu trường này. FE tự dựng PDF nên **để trống ô này** — `groupNameVn`/`departmentNameVn` là khái niệm khác (Bộ phận/Phòng ban), không nên dùng thay thế.
- **"Bước đang chờ ai duyệt/ký tiếp"** (đổi 2026-08-07): suy từ `approvalSteps[]` — phần tử đầu tiên có `status=0 Pending` (nếu có) là bước đang chờ, `candidates[]` của bước đó là danh sách người có thể Duyệt/Từ chối. `status==Completed(1)`/`Rejected(2)` ở cấp `OtForm` → hết, ẩn nút Duyệt/Từ chối. KHÔNG còn suy được trực tiếp từ `OtForm.status` như enum cũ (chỉ còn 3 giá trị, không phân biệt "đang chờ ai").
- `isEditable` (đổi 2026-08-07) = `status == InApproval && !approvalSteps.some(s => s.status === 1 /* Approved */)` — điều kiện CẦN (chưa đủ) để hiện nút "Sửa", xem §1.2 và §4.1b.
- **`employees[].monthToDate`/`yearToDate`** — snapshot **đóng băng lũy kế DỰ KIẾN** (§3.5b) tại đúng thời điểm dòng này được thêm vào đơn (KHÔNG live, KHÔNG phải lũy kế thực tế `Employee.monthToDate`/`yearToDate`) — dùng để người duyệt đối chiếu ngưỡng TH3 (mặc định >25h/tháng, >300h/năm — Admin sửa được qua `GET/PUT /AttendanceSetting`, xem §6d) ngay trên màn chi tiết, không cần mở thêm màn Employee. Xem lại 1 đơn cũ luôn ra đúng con số tại thời điểm lập đơn, không phải lũy kế hiện tại.
- **`employees[].mealTicketType`** (redesign 3 bậc 2026-08-26, THAY `isEligibleForMeal:bool` cũ) —
  `int`: `0`=Không có phiếu, `1`=Phụ, `2`=Chính. Tính trên giờ **THỰC TÍCH** (`actualHours` bên dưới,
  SAU khi trừ nếu có ăn — khác bản cũ luôn tính trên giờ thô): `< AttendanceSetting.noMealTicketMaxHours`
  (mặc định 2h) → 0; `< AttendanceSetting.mainMealTicketMinHours` (mặc định 3.5h) → 1; còn lại → 2.
  Ngoại lệ: ca khớp ĐÚNG khung `earlyMealWindowStartTime`/`earlyMealWindowEndTime` (mặc định 6h-8h)
  luôn = 1 (Phụ), bất kể giờ. Tính sẵn ở BE, FE chỉ hiển thị (badge "Loại phiếu ăn",
  `MealTicketTypeBadge.tsx`) — không tự tính lại field này khi XEM đơn đã lưu; nhưng
  `CreateOtFormPage.tsx` (đang TẠO đơn, `OtFormEmployee` chưa tồn tại) tự tính preview bằng
  `modules/attendance/lib/mealTicket.ts` (mirror đúng công thức BE) cho cả badge lẫn
  `processPart.mainTicketCount`/`secondaryTicketCount` (§4.1/§6d).
- **`employees[].actualHours`** (mới 2026-08-26, công thức đổi cùng đợt redesign trên) — giờ OT thực
  tính của NGƯỜI ĐÓ, BE tính sẵn: `endTime - startTime`, trừ thêm `mealBreakDeductionHours` (mặc định
  0.5h) nếu `didEat=true` — **trừ ca khớp đúng khung OT sớm, luôn KHÔNG trừ dù `didEat` là gì**. Có ăn
  thì bị trừ giờ nghỉ ăn ở MỌI mức giờ (không chỉ khi đủ ngưỡng phiếu Chính như bản cũ); không ăn thì
  giữ nguyên giờ thô. FE (`OtFormDetail.tsx`, `OtFormBatchDetail.tsx`, `OtFormEmailConfirmPage.tsx`)
  dùng field này để hiển thị cột giờ + tổng giờ OT của form — **không** tự trừ `startTime`/`endTime`
  nữa. `mealTicketType` cũng tính trên chính `actualHours` này (khác bản cũ tính trên giờ thô).
- **`groupNameJp`/`departmentNameJp`/`reasonNameJp`** — song ngữ Việt/Nhật (nullable), lấy thẳng từ `Group`/`Department`/`Reason` tương ứng. FE (`OtFormDetail.tsx`, `OtFormEmailConfirmPage.tsx`) hiện `"{Vn} / {Jp}"` cho Phòng ban/Bộ phận/Lý do, tương tự cho `employees[].noteJp`/`processPart.anotherSuggestionJp`.
- **`editLogs[]` (MỚI, 2026-08-28)** — nhật ký chỉnh sửa đơn (sửa giờ/`didEat`/ghi chú qua §4.1b, thêm
  người qua §4.5b, loại người qua §4.5a), mới nhất trước. `actionType`: `0`=TimeChanged,
  `1`=NoteChanged, `2`=EmployeeAdded, `3`=EmployeeRemoved. `fieldName` chỉ có giá trị khi
  `actionType` là `0`/`1` (`"EndTime"`/`"DidEat"`/`"NoteVn"`/`"NoteJp"`) — `null` khi là hành động
  Thêm/Loại. KHÔNG ghi gì cho hành động Tạo đơn (`CreatedByUserName`/`createdAt` đã là log riêng).
  Xem `attendance-module.md` §Giai đoạn 11.
- **`employees[].isRemoved`/`removedByUserName`/`removedByFullName`/`removedAtLevel`/`removedAt`/`removeReason` (xem §4.5a)** — người bị 1 bước duyệt loại khỏi đơn qua `POST /{id}/employees/remove` **vẫn nằm trong mảng `employees[]`** (BE cố tình KHÔNG lọc bỏ) để giữ dấu vết ai loại/lúc nào/lý do gì trên màn chi tiết — FE tự lọc `isRemoved === true` ra khỏi (1) tổng giờ OT hiển thị, (2) bản in PDF/A4/A5, (3) trang xem trước qua email. **`removedAtLevel` đổi ý nghĩa 2026-08-07**: giờ là `OtFormApprovalStep.stepOrder` (trước là số `ApprovalLevel`) — tra tên bước bằng cách tìm phần tử `approvalSteps[]` có `stepOrder` khớp, lấy `jobTitleNameSnapshot`, KHÔNG map qua `approvalLevelLabels` nữa. `numberOfEmployee` (cả `OtFormDto` lẫn `OtFormListItemDto`) chỉ đếm người **chưa** bị loại, không cần FE tự trừ.

### 4.4 `POST /api/OtForm/{id}/approve`
```jsonc
// body — ApproveOtFormDto
{ "comment": null, "secondaryPassword": "..." }   // comment optional, secondaryPassword [Required]
```
- **`signatureImage` KHÔNG còn tồn tại trong body** — chữ ký cấp duyệt BE tự lấy từ `UserSignature` đã đăng ký sẵn của chính người duyệt (`GET/PUT /api/UserSignature/me`, mục 6), snapshot vào `OtFormApprovalHistory.signatureImage` tại đúng thời điểm duyệt.
- **Bắt buộc phải đã đăng ký chữ ký thực tế nếu bước đang chờ có `requiresSignatureSnapshot=true`** (đổi 2026-08-07, Giai đoạn 3.1 — trước đây đọc `otCase.requireSignature`, giờ đọc TRỰC TIẾP từ `approvalSteps[]` của chính đơn, xem §4.3) — chưa đăng ký (`GET /UserSignature/me` 404) → duyệt trả 400 ("...bắt buộc phải ký khi duyệt. Vui lòng đăng ký chữ ký..."). FE tìm bước đang chờ trong `approvalSteps[]` (đã tải sẵn lúc mở chi tiết đơn) để biết trước có cần nhắc đăng ký chữ ký hay không, không cần gọi thêm `GET /api/OtCase/{id}`.
- **Bắt buộc `secondaryPassword` khớp mật khẩu cấp 2 đã đăng ký** (mọi bước duyệt, xem §6c) — chưa thiết lập/sai mật khẩu → 400, xem §9.
- 400 nếu: đơn đã `Completed`/`Rejected`; đơn không còn bước `Pending` nào (dữ liệu không nhất quán); user không nằm trong `candidates[]` của bước đang chờ.
- Thành công → bước đang chờ chuyển `Approved`; hết bước `Pending` → `OtForm.status = Completed` + cộng lũy kế; còn bước → gửi mail cho `candidates[]` của bước kế tiếp. Response `data: true` — FE tự gọi lại `GET /{id}` để refresh chi tiết.

### 4.5 `POST /api/OtForm/{id}/reject`
```jsonc
// body — RejectOtFormDto
{ "comment": "Thiếu chứng từ, cần xác nhận lại.", "secondaryPassword": "..." }   // cả 2 field [Required]
```
Bước đang chờ chuyển `Rejected`, mọi bước `Pending` còn lại (StepOrder lớn hơn) chuyển `Skipped`,
`OtForm.status → Rejected`, dừng hẳn luồng. `secondaryPassword` cũng bắt buộc, cùng luật với §4.4.

### 4.5a `POST /api/OtForm/{id}/employees/remove` — loại 1 nhân viên khỏi đơn, ngay trên màn Duyệt

**Lịch sử**: route này (mới 2026-07-30) từng là cách duy nhất để loại 1 người khỏi đơn mà không phải Từ
chối cả đơn. **2026-09-04** gộp tạm vào `PUT /api/OtForm/{id}` (`removedEmployees[]`) — nhưng vì
`UpdateAsync` cho đơn theo Nhóm chỉ cho phép chính **người tạo** sửa, các cấp đang **duyệt** (không phải
người tạo) mất hẳn khả năng loại người dù đúng candidate bước hiện tại. **2026-09-30 khôi phục lại route
riêng này** (không đổi hành vi so với bản gốc 2026-07-30/2026-08-28) — xem
`attendance-module.md` §Khôi phục "Loại khỏi đơn" ngay trên màn Duyệt (web).

```jsonc
// body — RemoveOtFormEmployeeDto
{ "employeeId": 100, "reason": "Không đủ điều kiện tăng ca đợt này." }   // KHÔNG có secondaryPassword
```
Permission riêng `Attendance.OTForm.RemoveEmployee` (đã seed sẵn theo Chức vụ từ 2026-08-28, không cần
migration mới). Authorization thật nằm trong `RemoveEmployeeCoreAsync`: candidate của bước `Pending`
StepOrder nhỏ nhất mới gọi được — **đúng luật này áp dụng như nhau cho CẢ đơn theo Nhóm lẫn theo
chuyền** (khác `UpdateAsync` vốn phân biệt creator-only cho đơn theo Nhóm). KHÔNG cần `secondaryPassword`
(cùng quyết định 2026-07-31). Không đổi `OtForm.Status`, không huỷ chữ ký cấp trước, chặn 400 nếu chỉ
còn ≤1 người chưa bị loại (dùng Từ chối cả đơn thay thế). Trả `data: OtFormDto` đầy đủ, ghi 1 dòng
`OtFormEditLog` (`actionType=EmployeeRemoved`).

**Kênh email dùng chung lõi, vẫn hoạt động y nguyên** (`OtFormEmailConfirmPage.tsx`):
```jsonc
// body — POST /api/OtForm/email-confirm/{token}/employees/remove — RemoveOtFormEmployeeByEmailTokenDto
{ "employeeId": 100, "reason": "Không đủ điều kiện tăng ca đợt này." }   // KHÔNG có secondaryPassword — token tự nó là thông tin xác thực
```
`OtFormService.RemoveEmployeeByEmailTokenAsync` (gọi `RemoveEmployeeCoreAsync` — phần lõi dùng chung với
kênh JWT ở trên) KHÔNG tiêu (consume) token — người duyệt có thể loại nhiều người rồi mới Duyệt/Từ chối
bằng đúng token đó.

### 4.5b `POST /api/OtForm/{id}/employees/add` — **ĐÃ XOÁ HẲN (2026-09-04)**

Route này (mới 2026-08-28, permission `Attendance.OTForm.AddEmployee`) đã gộp vào `PUT /api/OtForm/{id}`
(§4.1b, gửi NV mới trong `employees[]`) — gọi route cũ giờ trả **404**. Chưa từng có kênh email cho hành
động này nên không có gì cần giữ lại. Luật validate cũ (Nhóm ca bắt buộc, trùng giờ OT, giới hạn ngày/
tháng/năm) vẫn áp dụng y hệt trong `UpdateAsync`, **cộng thêm** luật phạm vi Line/Nhóm ca mới — xem
`attendance-module.md` §Gộp thêm/xóa NV vào Sửa đơn.

### 4.6 Duyệt/Từ chối qua email (2026-07-16) — kênh BỔ SUNG, không thay thế §4.4/§4.5

**Lý do**: Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc ít khi mở app — mỗi khi có đơn đến lượt họ ký/duyệt (đơn mới tạo → chờ Trưởng nhóm; vừa qua 1 cấp mà còn cấp tiếp theo), BE **tự động** gửi email cho **từng người** đủ quyền ký/duyệt ở đúng cấp đó (1 đơn có thể có nhiều người cùng phạm vi → nhiều email, ai bấm trước thì đơn được xử lý bởi người đó). Email chứa link `{FrontendBaseUrl}/xac-nhan-don?token=xxx` — **FE tự xây trang public** tại route này, gọi 3 API sau (không cần đăng nhập SPA, token tự nó là thông tin xác thực):

**Nội dung email song ngữ Việt/Nhật (2026-07-29)** — template `Attendance.Infrastructure/EmailTemplates/OtForm/ApprovalNotification.html` giờ hiện **cả nhãn lẫn dữ liệu** bằng cả 2 ngôn ngữ (nhãn dạng "Phòng ban / 部署", dữ liệu Phòng ban/Bộ phận/Lý do dạng `"{Vn} / {Jp}"` — bỏ phần `/ {Jp}` nếu master data chưa nhập tiếng Nhật). `NotifyEligibleApproversAsync` (`OtFormService.cs`) tự tra `Group`/`Department`/`Reason` theo Id của đơn (không dựa navigation property vì không phải lúc nào cũng được `Include()`) để lấy đủ cặp Vn/Jp trước khi render template — 3 placeholder mới: `{{DepartmentName}}`, `{{GroupName}}`, `{{ReasonName}}` (trước đây template thậm chí chưa hiện 3 trường này, chỉ có mã đơn/người tạo/ngày/giờ).

| Method | Route | Việc gì |
|---|---|---|
| GET | `/api/OtForm/email-confirm/{token}` | Trả `OtFormDto` đầy đủ (giống hệt §4.3) để hiện chi tiết đơn trên trang xác nhận |
| POST | `/api/OtForm/email-confirm/{token}/approve` | Body `ApproveOtFormDto` (`{ "comment": null, "secondaryPassword": "..." }`, giống §4.4) — duyệt |
| POST | `/api/OtForm/email-confirm/{token}/reject` | Body `RejectOtFormDto` (`{ "comment": "...", "secondaryPassword": "..." }` cả 2 [Required], giống §4.5) — từ chối |
| POST | `/api/OtForm/email-confirm/{token}/employees/remove` | Body `RemoveOtFormEmployeeByEmailTokenDto` (`{ "employeeId": 100, "reason": "..." }`, **KHÔNG có `secondaryPassword`**, 2026-07-31 — cùng shape với kênh JWT `POST /{id}/employees/remove`, cũng đã bỏ `secondaryPassword` cùng ngày) — loại 1 nhân viên khỏi đơn, xem §4.5a. Trả `data: OtFormDto` đầy đủ (khác approve/reject chỉ trả `true`). KHÔNG tiêu token — vẫn dùng lại được cho approve/reject sau đó. |

**Trang xác nhận gợi ý** (route public, không nằm trong menu điều hướng — chỉ mở qua link email):
```
[Hiện chi tiết đơn y hệt màn "Chi tiết đơn" — §1.3.C, dùng chung component]
Ghi chú/Comment [___]  (chỉ dùng khi bấm Duyệt, không bắt buộc)
[ Từ chối ]                                                 [ Duyệt ]
```
- **Từ chối mở popup riêng để nhập lý do (2026-07-29, yêu cầu người dùng)** — bấm "Từ chối" không gửi ngay, mà mở modal xác nhận với ô "Lý do từ chối" **bắt buộc** + 2 nút "Huỷ"/"Xác nhận từ chối", cùng UX với modal Ký duyệt/Duyệt/Từ chối ở màn "Chi tiết đơn" trong app (§1.3.C) — tránh bấm nhầm từ chối đơn khi chưa kịp gõ lý do. "Duyệt" giữ nguyên hành vi cũ (gửi thẳng kèm ô Ghi chú tuỳ chọn ở ngoài, không qua popup).
- Cả 2 nút gọi thẳng đúng logic `approve`/`reject`/`submit` hiện có tùy cấp của token (§4.1a/§4.4/§4.5) — **không cần canvas ký**, chữ ký tự lấy từ `UserSignature` đã đăng ký của người đó y hệt ký/duyệt trong app. Với token cấp Submitter (Trưởng nhóm), FE nên **ẩn nút "Từ chối"** trên trang xác nhận (backend chặn, trả lỗi nếu vẫn bấm) — chỉ hiện "Ký duyệt".
- **Bắt buộc thêm ô "Mật khẩu cấp 2" trên trang này (2026-07-30, xem §6c)** — cả nút Duyệt lẫn popup Từ chối đều cần `secondaryPassword` trong body, **kể cả** ở kênh email này (đã chốt với người dùng: mật khẩu cấp 2 áp dụng cho MỌI hành động ký/duyệt, không riêng gì trong app). Trang public này không có JWT nên không gọi được `GET /SecondaryPassword/me` để kiểm tra trước — lỗi "chưa thiết lập"/"sai mật khẩu" chỉ hiện ra sau khi bấm Duyệt/Xác nhận từ chối, qua message BE trả về.
- Token gắn với **đúng 1 người + đúng 1 cấp duyệt** tại thời điểm gửi mail — nếu đơn đã được người khác duyệt/từ chối trước (hoặc đã đổi cấp) từ lúc gửi mail, bấm link cũ sẽ nhận lỗi rõ ràng (400 "Đơn đã xử lý xong...") thay vì duyệt nhầm — không cần FE tự kiểm tra trạng thái trước.
- Token hết hạn sau **3 ngày** hoặc đã dùng 1 lần (Duyệt hoặc Từ chối, cái nào bấm trước) → gọi lại bất kỳ API nào trong 3 API trên đều trả 400/404 (xem §9).
- Sau khi Duyệt/Từ chối thành công qua trang này, nếu còn cấp tiếp theo cần duyệt, BE **tự động** gửi tiếp email cho cấp đó — FE trang xác nhận không cần tự gọi thêm gì.

## 5. UserApprovalScope — ĐÃ XOÁ HẲN (2026-08-08, Giai đoạn 3.2)

`/api/UserApprovalScope` (toàn bộ 4 route `grid-list`/`by-user`/`POST`/`DELETE`), entity, enum
`ApprovalLevel`/`ScopeType`, và bảng `UserApprovalScopes` trên `YevOTManagement` đã xoá hẳn khỏi code
lẫn DB thật. Cơ chế này bị thay thế hoàn toàn bởi Cây chức vụ từ Giai đoạn 3.1 (`OtFormService` không
còn đọc tới); audit xác nhận không còn module/màn hình nào khác dùng chung — người dùng xác nhận xoá
luôn (không chỉ ẩn UI). Màn "Phân quyền duyệt" + route `/ot/approval-scopes` cũng đã gỡ khỏi FE. Toàn
bộ nội dung §5 mô tả API cũ (ràng buộc Role/ScopeType, endpoint, DTO) bên dưới trong lịch sử file này
không còn áp dụng — xem `attendance-module.md` §Cây chức vụ Giai đoạn 3.2 mục 4 cho chi tiết migration.

## 6. UserSignature (`/api/UserSignature`) — chữ ký cá nhân

Mỗi user tự đăng ký 1 chữ ký (ảnh) — **BE tự lấy chữ ký này khi tạo đơn (Người đề nghị) hoặc duyệt đơn** (2026-07-16, không nhận `signatureImage` từ body `CreateOtFormDto`/`ApproveOtFormDto` nữa, xem §4.1/§4.4). `UserSignature` KHÔNG phải nguồn audit — nguồn thật để hiển thị/in lại luôn là `OtFormApprovalHistory.signatureImage`, bản **snapshot đóng băng** tại đúng thời điểm ký (§4.3): nếu user đổi chữ ký mới sau này, các đơn đã ký trước đó vẫn giữ nguyên ảnh chữ ký cũ, không bị đổi theo.

> ⚠️ **Breaking 2026-07-16**: `PUT /me` **KHÔNG còn áp dụng chữ ký ngay** — xem §6b, đây là thay đổi quan trọng nhất cho màn "Cài đặt chữ ký".

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/me` | `Attendance.UserSignature.Update` | Xem chữ ký **đang có hiệu lực** của chính mình (chữ ký cũ, chưa đổi) |
| PUT | `/me` | `Attendance.UserSignature.Update` | **Yêu cầu** cập nhật chữ ký — gửi email xác nhận, KHÔNG áp dụng ngay (§6b) |
| GET | `/{userName}` | `Attendance.UserSignature.View` | Admin xem chữ ký người khác |

```jsonc
// UserSignatureDto
{ "userName": "YEV\\n.van.a", "signatureImage": "iVBORw0KG...", "updatedAt": "2026-07-14T09:00:00Z" }
```

### 6b. Xác nhận cập nhật chữ ký qua email (2026-07-16)

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
// POST /confirm/{token} — trả UserSignatureDto (giống PUT /me kiểu cũ)
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

## 6c. SecondaryPassword (`/api/SecondaryPassword`) — mật khẩu cấp 2 khi ký/duyệt (mới, 2026-07-30)

**Lý do**: thêm 1 lớp xác thực bổ sung (giống PIN giao dịch ngân hàng) cho hành vi có tính pháp lý là
ký/duyệt đơn tăng ca — mỗi user tự đăng ký 1 mật khẩu cấp 2 riêng (khác mật khẩu đăng nhập AD), và
phải nhập lại đúng mật khẩu này ở **MỌI** hành động ký/duyệt: `POST /{id}/submit` (Trưởng nhóm ký),
`POST /{id}/approve`, `POST /{id}/reject` (mọi cấp), **kể cả kênh email** `email-confirm/{token}/approve|reject`
(§4.6) — không có ngoại lệ nào. BE verify qua field `secondaryPassword` đã thêm vào `ApproveOtFormDto`/
`RejectOtFormDto` (xem §4.1a/§4.4/§4.5/§4.6), verify TRƯỚC khi ghi bất kỳ thay đổi nào lên đơn.

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
- **Permission `Attendance.SecondaryPassword.Update`** được seed cho đúng các Role đang giữ
  `Attendance.UserSignature.Update` (Admin, Trưởng nhóm, Trưởng Bộ phận, Trưởng phòng, Trưởng xưởng,
  Tổng Giám Đốc) — không có permission `.View` riêng (không có nhu cầu Admin xem hộ mật khẩu người khác).

## 6d. AttendanceSetting (`/api/AttendanceSetting`) — cấu hình phiếu ăn & giới hạn lũy kế (mới, 2026-08-01)

**Lý do**: 2 nhóm ngưỡng trước đây hardcode trong code (mốc giờ nhận phiếu ăn ở BE — `> 2h`; ngưỡng
cảnh báo lũy kế 25h/tháng·300h/năm ở FE) nay gộp vào 1 bảng cấu hình 1 dòng, Admin tự sửa qua UI
(tab "Cấu hình" trong `/ot/categories`), không cần deploy lại khi chính sách công ty đổi.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/AttendanceSetting` | **Không cần** (mọi tài khoản đăng nhập) | Đọc cấu hình hiện hành |
| PUT | `/api/AttendanceSetting` | `Attendance.Setting.Update` (chỉ Admin) | Sửa cấu hình |
| POST | `/api/AttendanceSetting/test-email` | `Attendance.Setting.Update` (chỉ Admin) | Gửi 1 email mẫu tới địa chỉ tự nhập, kiểm tra SMTP + font/layout (mới 2026-09-05) |

```jsonc
// SendTestEmailDto — body POST test-email
{ "email": "ten@yev.vn" }  // string, [Required] + [EmailAddress]
// Response data: boolean — luôn true nếu HTTP 200 (BE trả Fail (400) kèm message nếu SMTP gửi thất
// bại, không có trường hợp response 200 với data=false).
```

```jsonc
// AttendanceSettingDto — response GET, body PUT (cùng shape). 4 field phiếu ăn đầu tiên: redesign 3
// bậc + khung OT sớm (2026-08-26) — xem attendance-module.md §Phiếu ăn — REDESIGN 3 bậc.
{
  "mainMealTicketMinHours": 3.5,      // decimal, [Range(0.5, 24)] — thực tích từ mốc này = phiếu CHÍNH
  "noMealTicketMaxHours": 2,          // decimal, [Range(0, 24)] — thực tích dưới mốc này = KHÔNG phiếu
  "mealBreakDeductionHours": 0.5,     // decimal, [Range(0, 4)] — số giờ trừ khi có ăn
  "earlyMealWindowStartTime": "06:00:00",  // TimeOnly "HH:mm:ss", [Required] khi PUT
  "earlyMealWindowEndTime": "08:00:00",    // TimeOnly "HH:mm:ss", [Required] khi PUT
  "dailyOtHourLimit": 4,           // decimal, [Range(0.5, 24)] khi PUT — MỚI 2026-08-26
  "monthlyOtHourLimit": 25,        // decimal, [Range(1, 744)] khi PUT
  "yearlyOtHourLimit": 300,        // decimal, [Range(1, 8784)] khi PUT
  "batchAutoSendTime": "15:00:00"  // TimeOnly "HH:mm:ss", [Required] khi PUT — mới 2026-08-08, xem §6e
}
```

- **`GET` cố tình KHÔNG gắn permission** — Role "Nhân viên"/"Trưởng nhóm" không có permission quản trị
  nào nhưng màn Tạo đơn của họ vẫn phải đọc được cấu hình này để tự tính phiếu ăn (§4.1) và tô đỏ lũy
  kế vượt ngưỡng. Chỉ hành động **SỬA** mới cần `Attendance.Setting.Update`.
- **3 bậc phiếu ăn** (redesign 2026-08-26, đảo ngược quyết định "không sàn dưới" chốt ngày 2026-08-01):
  thực tích `< noMealTicketMaxHours` → KHÔNG phiếu; `< mainMealTicketMinHours` → phiếu Phụ; còn lại →
  phiếu Chính. Áp dụng cho cả `OtFormEmployeeDto.mealTicketType` (BE tính, thay `isEligibleForMeal:bool`
  cũ) lẫn `processPart.mainTicketCount`/`secondaryTicketCount` (FE tự tính ở `CreateOtFormPage.tsx` qua
  `modules/attendance/lib/mealTicket.ts`, người dùng vẫn sửa tay được — xem §4.1).
- **`mealBreakDeductionHours`** — số giờ trừ khỏi giờ thô khi `didEat=true` (trước đây hardcode `0.5m`).
  Áp dụng ở MỌI mức giờ (không chỉ khi đủ ngưỡng phiếu Chính như bản cũ trước 2026-08-26).
- **`earlyMealWindowStartTime`/`earlyMealWindowEndTime`** — khung OT sớm đặc cách (mặc định 6h-8h). Ca
  OT có `startTime`/`endTime` khớp **ĐÚNG** 2 mốc này (không phải chỉ chồng lấn) luôn nhận phiếu Phụ và
  KHÔNG bị trừ `mealBreakDeductionHours`, bất kể `didEat`.
- **`dailyOtHourLimit`/`monthlyOtHourLimit`/`yearlyOtHourLimit`** — REDESIGN 2026-08-26 (đảo ngược
  hoàn toàn hành vi cũ): cả 3 mốc giờ đều **CHẶN CỨNG** `POST`/`PUT /api/OtForm` — nếu tổng giờ OT
  thực tích của 1 nhân viên (SAU khi cộng thêm giờ của chính đơn đang tạo/sửa) vượt bất kỳ mốc nào,
  BE trả 400 liệt kê tên các nhân viên vi phạm + mốc bị vượt, không tạo/sửa được đơn cho tới khi loại
  nhân viên đó khỏi đơn hoặc giảm giờ (xem `OtFormService.ValidateOtHourLimitsAsync`). "Ngày" cộng dồn
  TẤT CẢ ca OT của 1 nhân viên trong đúng ngày (nhiều đơn/nhiều ca cộng lại, không phải riêng lẻ từng
  ca). Badge/pill đỏ ở `EmployeeList.tsx`/`CreateOtFormPage.tsx`/`OtFormDetail.tsx`/
  `OtFormBatchDetail.tsx`/`OtFormPrintView.tsx` vẫn giữ nguyên vai trò cảnh báo SỚM (trước khi submit),
  nhưng giờ BE mới là nguồn chặn thật — không chỉnh lũy kế thủ công qua `PUT /Employee/{id}` được nữa
  (đã bỏ từ 2026-08-19, xem §3.6) nên không có đường vòng nào để né validate này.
- **FE cache dùng chung** (`useAttendanceSetting.ts`) — 1 promise cấp module, không gọi lại API mỗi màn
  mount; gọi `invalidateAttendanceSettingCache()` sau khi Admin lưu cấu hình mới để các màn mở sau đó
  thấy ngay, không cần F5 cả trang.
- **Trang public qua email** (`OtFormEmailConfirmPage.tsx`, không JWT) **không gọi được endpoint này**
  — vẫn dùng cứng giá trị mặc định (2.5h/25h/300h) cho màu cảnh báo lũy kế. Chấp nhận được vì đây chỉ
  là gợi ý hiển thị, không phải số liệu quyết định nghiệp vụ.
- Thành công → `data` = `AttendanceSettingDto` đầy đủ (cả GET lẫn PUT), không cần gọi lại `GetById`.

## 6e. Đơn tổng (`/api/OtFormBatch`) — gom nhiều đơn theo cấp quản lý, duyệt 1 lần (mới, 2026-08-06; redesign 2026-08-07 Giai đoạn 3.2; mở rộng sang cả 3 cấp quản lý 2026-09-05)

> **✅ Đã redesign theo Cây chức vụ (2026-08-07)** — route không đổi so với thiết kế gốc, chỉ đổi điều
> kiện xác định "đang chờ đúng cấp quản lý" (xem `attendance-module.md` §Đơn tổng để biết chi tiết ánh
> xạ sang model bước động).
> **Mở rộng sang cả 3 cấp quản lý (2026-09-05)** — trước đây CHỈ gom cấp Trưởng phòng
> (`TerminalLevel=DepartmentManager`); người ở cấp Trưởng Xưởng/Giám đốc vẫn nhận mail duyệt riêng
> từng đơn, gây quá tải. Giờ cả 3 cấp đều CHỈ nhận đúng 1 mail tổng hợp/ngày (không còn mail riêng
> từng đơn ở cả 3 cấp này — xem `attendance-module.md` §Bỏ mail riêng ở 3 cấp quản lý). Schema đổi:
> `departmentId`/`departmentNameVn`/`departmentNameJp` → `departmentId` (nullable) +
> `scopeNameVn`/`scopeNameJp` + `terminalLevel` mới (xem bên dưới) — **breaking change** cho FE nào còn
> đọc field cũ.

**Lý do**: đơn tăng ca tới đúng bước ở 1 trong 3 TerminalLevel quản lý (`OtFormApprovalStep.
TerminalLevelSnapshot` = DepartmentManager(1)/WorkshopManager(2)/GeneralDirector(3), đang `Pending`)
trước đây phải duyệt riêng lẻ từng đơn VÀ còn nhận thêm mail riêng ngay lúc đó — 2 lần mail cho cùng 1
đơn. Mỗi ngày, vào giờ đọc từ `AttendanceSetting.batchAutoSendTime` (mặc định **15:00**, Admin tự đổi
qua tab Cấu hình — xem §6d), hệ thống tự gom **các đơn MỚI, chưa từng vào batch nào**: cấp
DepartmentManager gom theo từng Phòng ban (`departmentId` có giá trị); cấp WorkshopManager/
GeneralDirector gom **company-wide** — 1 batch/cấp/ngày cho toàn công ty (`departmentId=null`, vì
candidate 2 cấp này vốn không lọc theo Department, xem Cây chức vụ) — thành 1 "Đơn tổng", gửi mail cho
người duyệt — bấm vào duyệt 1 lần là cả loạt được xử lý. Batch cũ chưa xử lý xong (từ ngày trước) được
gửi **mail nhắc lại mỗi ngày** (không tạo batch mới, không gộp thêm đơn — 1 đơn chỉ thuộc đúng 1 batch).
Đơn còn kẹt ở bước trung gian (SUP/CHIEF...) trước khi tới 1 trong 3 cấp trên thì KHÔNG được gom, vẫn
duyệt lẻ (và vẫn nhận mail riêng ngay — cấp trung gian chưa có cơ chế gom) như bình thường. Chi tiết
thiết kế BE ở [attendance-module.md §Đơn tổng](attendance-module.md).

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtFormBatch/grid-list?pageIndex&pageSize` | `Attendance.OTForm.Approve` | Danh sách batch (Admin thấy tất cả; còn lại chỉ thấy batch mình là candidate hợp lệ — DepartmentManager so theo đúng Department, WorkshopManager/GeneralDirector company-wide nên chỉ cần khớp cấp) |
| GET | `/api/OtFormBatch/{id}` | `Attendance.OTForm.Approve` | Chi tiết 1 batch |
| POST | `/api/OtFormBatch/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt/Từ chối hàng loạt |
| GET | `/api/OtFormBatch/email-confirm/{token}` | `[AllowAnonymous]` | Chi tiết qua link email |
| POST | `/api/OtFormBatch/email-confirm/{token}/approve` | `[AllowAnonymous]` | Duyệt/Từ chối qua link email |
| POST | `/api/OtFormBatch/run-now` | `Attendance.Setting.Update` | Chạy ngay đợt gom hằng ngày, không đợi tới giờ cấu hình (mới 2026-08-08, nút "Gửi ngay" ở tab Cấu hình — dùng khi test/cần gấp; body rỗng, response `data: true`) |

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
- **`subReason`/`processPart`/`employees[]` đầy đủ (MỚI, 2026-08-08)** — trước đây `OtFormBatchItemDto`
  chỉ có đủ field để FE render bảng rút gọn (Chọn/Mã NV/Họ tên/Thời gian/Số giờ); Trưởng phòng duyệt
  hàng loạt qua "Đơn tổng" mà không thấy "Yêu cầu hỗ trợ khác"/lý do chi tiết/lũy kế từng nhân viên như
  màn Chi tiết đơn thường. Giờ mỗi phần tử `otForms[]` có đủ dữ liệu để FE render lại đúng mức chi tiết
  của `OtFormDto` (§4.3) — `employees[]` vẫn là `OtFormEmployeeDto` đầy đủ (đã có sẵn từ đầu, gồm cả
  `monthToDate`/`yearToDate`/`mealTicketType`/`actualHours`/`didEat`/`noteVn`/`noteJp`), chỉ thêm mới `subReason`
  và `processPart` ở cấp đơn.

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
- **Không có `SubReason`/`comment` cho quyết định Approve** — chỉ `decision=1` mới có ô lý do.
- Màn "Đơn tổng" trong app (`/ot/batches`, menu cùng cấp "Đơn tăng ca", gate bằng `Attendance.OTForm.Approve`
  — trùng điều kiện tab "Chờ tôi duyệt") dự phòng khi Trưởng phòng mất/quên link email — danh sách rỗng tự
  nhiên nếu user không phải candidate ở bước Trưởng phòng của Department nào, không cần ẩn hẳn mục menu.
- Trang public `/xac-nhan-don-tong?token=...` (FE tự xây, không đăng nhập SPA) — cùng nguyên tắc
  `/xac-nhan-don` (§4.6): token là thông tin xác thực duy nhất, không nằm trong sơ đồ menu.

## 7. Tổng hợp endpoint

| Route | Ghi chú |
|---|---|
| `/api/Department`, `/api/Reason`, `/api/OtCase`, `/api/JobTitle` | CRUD chuẩn (grid-list, all, {id}, POST, PUT, DELETE) — JobTitle mới 2026-08-06, §3.4b |
| `/api/JobTitle/resolve-chain?employeeId=&otCaseId=` | Xem trước chuỗi duyệt tự động (đọc-only, mới 2026-08-06, §3.4d) |
| `/api/DepartmentApprovalStep/by-department/{departmentId}` | GET (xem)/PUT (thay nguyên danh sách) cây duyệt CẤP CUỐI của 1 Bộ phận — mới 2026-08-06, §3.4c. Từ Giai đoạn 4 (2026-08-08) CHỈ nhận `terminalLevel != 0` |
| `/api/GroupApprovalStep/by-group/{groupId}` | GET (xem)/PUT (thay nguyên danh sách) cây duyệt CẤP TRUNG GIAN của 1 Nhóm — mới 2026-08-08 (Giai đoạn 4), §3.4c-2. `PUT` validate `terminalLevel=0` + 1-2 bước `requiresSignature` |
| `/api/DepartmentApprovalStepCoordinator/by-department/{departmentId}` | GET/PUT (thay nguyên danh sách) người phụ trách cấu hình Cây duyệt của 1 Bộ phận — mới 2026-08-11 (sửa 2026-08-11b: `employeeIds` thay `userNames`), §3.4c-3. Chỉ Admin sửa được bảng gán này |
| `/api/GroupApprovalStepCoordinator/by-group/{groupId}` | GET/PUT (thay nguyên danh sách) người phụ trách cấu hình Cây duyệt của 1 Nhóm — mới 2026-08-11 (sửa 2026-08-11b), §3.4c-3. Chỉ Admin sửa được bảng gán này |
| `/api/Employee/{id}/department-job-title?departmentId=` | PUT gán/gỡ Chức vụ CẤP CUỐI có phạm vi — mới 2026-08-11c, §3.4c-3. Gate bằng `DepartmentApprovalStep.Update` (Người phụ trách gọi được, chỉ trong Bộ phận mình phụ trách) |
| `/api/Employee/{id}/group-job-title?groupId=` | PUT gán/gỡ Chức vụ TRUNG GIAN có phạm vi — mới 2026-08-11c, §3.4c-3. Gate bằng `GroupApprovalStep.Update` (Người phụ trách gọi được, chỉ trong Nhóm mình phụ trách) |
| `/api/Employee/in-my-scope` | GET nhân viên trong phạm vi Cây chức vụ của người gọi — mới 2026-08-11d, §3.5c. Gate `OTForm.Approve`, KHÔNG cần `Employee.View` |
| `/api/Employee/{id}/accumulation-history?year=` | GET lịch sử lũy kế 12 tháng của 1 năm — mới 2026-08-11d, §3.5c. Gate `OTForm.Approve`, cùng phạm vi trên |
| `/api/JobTitlePermission/by-job-title/{jobTitleId}` | GET (xem)/PUT (thay nguyên danh sách) permission tự động cấp theo 1 Chức vụ — mới 2026-08-10, §3.4e. `PUT` validate mọi code thuộc whitelist "tham gia quy trình" |
| `/api/JobTitlePermission/allowed-codes` | GET danh sách mã permission được phép chọn ở trên — mới 2026-08-10, §3.4e |
| `/api/Group` (`?by-department/{id}`) | CRUD + cascading theo Department |
| `/api/Employee` (`all`, `by-group/{id}`, `by-department/{id}`) | CRUD + liệt kê toàn bộ/theo Group/theo Department — `all` mới 2026-08-06, `by-department` mới 2026-08-07. `me`/`{id}/adjust-accumulation` **đã xoá** 2026-08-08, xem §3.6 |
| `/api/UserSignature` | `me` (GET/PUT), `{userName}` (GET, admin), `confirm/{token}` (GET/POST, public — §6b) |
| `/api/SecondaryPassword` | `me` (GET/PUT), `confirm/{token}` (GET/POST, public — §6c) |
| `/api/AttendanceSetting` | GET (mọi tài khoản), PUT (Admin — §6d) |
| `/api/OtForm` | `my-forms`, `pending-approvals` (`currentStepCandidateCount`, mới 2026-08-08), `my-actions` (§4.2b), `my-participations` (§4.2c), `{id}` (GET/PUT), POST, `{id}/approve`, `{id}/reject`, `{id}/delete` (Admin only, mới 2026-08-08, §4.1c), `{id}/employees/remove` (§4.5a), `email-confirm/{token}` (GET), `email-confirm/{token}/approve`, `email-confirm/{token}/reject`, `email-confirm/{token}/employees/remove` (public, không mật khẩu cấp 2 — §4.6). **KHÔNG còn `{id}/submit`** (xoá 2026-08-07) lẫn `pending-submissions` (xoá 2026-08-08, xem §4.2a) |
| `/api/EmployeeImport` | `preview`, `confirm` (Admin, §3.7); `ot-hour-limits`/`ot-hour-limits/template` (gate `Employee.UpdateOtLimit`, §Phân quyền theo Phòng ban); `monthly-accumulation?year=&month=`/`monthly-accumulation/template` (multipart, gate `EmployeeAccumulation.Import` — TỔNG QUÁT mọi Phòng ban, mới 2026-09-03) |
| `/api/ProductionOtReport` (mở rộng 2026-09-03c) | thêm `ticket-batch?date=&departmentId=` (JSON, dữ liệu nền phiếu YEV-22-024 xuất hàng loạt — FE lấy chữ ký/lý do qua `GET /api/OtForm/{primaryOtFormId}`), `qry-export-excel?date=&departmentId=` ("Qry_EXPORT_EXCEL", 17 cột), `sum-export-data?date=&departmentId=` ("SUM_EXPORT_DATA", 7 cột) — cả 3 gate `Attendance.ProductionOtReport.View` như 3 endpoint cũ. Tên file Excel theo quy tắc thật `"{TenQuery}_{yyyy-MM-d}_{MaPhongBan}.xlsx"` (ngày KHÔNG số 0 đầu) — xem `attendance-module.md §3 export mới + phiếu PDF hàng loạt theo Line/Nhóm` |
| `/api/ProductionEmployeeImport` | `preview`, `confirm`, `apply-accumulation` (quyền riêng, ảnh hưởng lương — §3.8) |
| `/api/ProductionEmployeeExport` | `export` (GET, trả file .xlsx — §3.8) |
| `/api/ProductionEmployee` | `search`, `line-options`, `team-options`, `shift-team-options` (màn "Theo chuyền" tạo đơn OT, gate `OTForm.Create`), `page-nation` (màn "Nhân viên dưới chuyền" đọc-only, gate `ProductionEmployee.View` — đổi từ `Employee.View` 2026-09-26, §3.8b) |
| `/api/ProductionOtReport` | `ticket-report?date=&departmentId=` (JSON), `hours-report-excel`/`times-report-excel`/`qry-export-excel`/`sum-export-data` (file .xlsx, 4 kiểu Excel độc lập), `ticket-batch?date=&departmentId=` (JSON, dữ liệu nền cho FE xuất PDF hàng loạt zip) — báo cáo dưới chuyền theo ngày, gate `Attendance.ProductionOtReport.View` — mới 2026-08-28, mở rộng 2026-09-03c, §11 |
| `/api/EmployeeIdentityLinkImport` | `preview`, `confirm` (CẢ 2 nhận file trực tiếp, không phải rows JSON — có thể kèm ảnh chữ ký nhúng), `template` — liên kết Employee↔Identity User + tự tạo tài khoản nếu chưa có + gán chữ ký + gán Chức vụ/Người phụ trách Cây duyệt (cột B=MNV, C=UserName, D=RoleName, E=MaChucVu, F=NguoiPhuTrach="1", phạm vi Chức vụ/Người phụ trách LUÔN suy theo Bộ phận/Nhóm hiện tại của Employee — mở rộng 2026-09-03b), gate `Identity.User.BulkImport` (Admin-only, mới 2026-09-03, xem `attendance-module.md §Import Excel liên kết Identity ↔ Attendance`) |

## 8. Checklist FE — màn hình chính

**"Tạo đơn tăng ca" (Trưởng nhóm, hoặc bất kỳ ai được cấp `UserApprovalScope(Submitter)`)**
1. Dropdown Bộ phận → `Department/all`; Nhóm → `Group/by-department/{id}` (thường chỉ 1 nhóm nếu user chỉ quản 1 Group — vẫn để dropdown cho tổng quát); Lý do → `Reason/all`; Trường hợp OT → `OtCase/all`.
2. Bảng chọn nhân viên → `Employee/by-group/{groupId}`, tick nhiều dòng → build `employees[]`.
3. Submit `POST /api/OtForm` → tạo `status=Draft`, **CHƯA ký** — điều hướng sang màn chi tiết (dùng `data` trả về, không cần gọi lại). Đơn cần Trưởng nhóm ký duyệt riêng qua "Chờ tôi ký duyệt" bên dưới (§4.1a) mới thật sự vào luồng.

**Màn "Đơn tăng ca"** (1 màn, 5 tab — xem §1.1/§1.3.B, ẩn tab thiếu permission tương ứng)

Tab **"Đơn của tôi"** → `GET /my-forms`, click dòng → `GET /{id}` xem chi tiết + timeline `approvalHistories`. Dòng có `isEditable=true` (Draft hoặc Pending) hiện thêm nút "Sửa" → mở lại form Tạo đơn đổ sẵn dữ liệu → `PUT /{id}`.

Tab **"Chờ tôi ký duyệt"** (Trưởng nhóm, mới đợt 4)
1. `GET /pending-submissions` (§4.2a) — danh sách đơn `Draft` thuộc scope của user (`UserApprovalScope(Submitter)`).
2. Vào chi tiết `GET /{id}` → nút "Ký duyệt".
3. "Ký duyệt": không có bước ký/upload ảnh nào ở màn này — BE tự lấy chữ ký từ ảnh đã đăng ký sẵn (`UserSignature`) của người ký. Chưa đăng ký → nhắc điều hướng sang "Cài đặt chữ ký" trước khi cho bấm → `POST /{id}/submit` (body chỉ còn `comment`, optional).
4. **"Loại khỏi đơn" (mới, §4.5a)**: Trưởng nhóm cũng loại được 1 người khỏi đơn ngay ở bước này (trước khi ký) — cùng nút/modal như ở tab "Chờ tôi duyệt", `status` vẫn `Draft` sau khi loại, chưa cần ký lại gì.
5. Thành công (Ký duyệt) → đơn chuyển `Pending`, biến mất khỏi `pending-submissions`, xuất hiện trong `pending-approvals` của Trưởng phòng phù hợp.

Tab **"Chờ tôi duyệt"** (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc)
1. `GET /pending-approvals` — danh sách đã tự lọc đúng phạm vi/cấp của user đang đăng nhập.
2. Vào chi tiết `GET /{id}` → nút "Duyệt"/"Từ chối".
3. "Duyệt": không có bước ký/upload ảnh nào ở màn này — BE tự lấy chữ ký từ ảnh đã đăng ký sẵn (`UserSignature`) của người duyệt. Nếu `otCase.requireSignature` (tra thêm `OtCase/{id}`) mà user chưa đăng ký chữ ký → nhắc điều hướng sang "Cài đặt chữ ký" trước khi cho bấm Duyệt → `POST /{id}/approve` (body chỉ còn `comment`).
4. "Từ chối": bắt buộc nhập `comment` → `POST /{id}/reject`.
5. **"Loại khỏi đơn" (mới, §4.5a)**: nút riêng trên từng dòng nhân viên (kể cả ở tab "Chờ tôi ký duyệt" — Trưởng nhóm cũng loại được), ẩn nếu chỉ còn 1 người chưa bị loại. Mở modal RIÊNG (chỉ ô lý do bắt buộc, KHÔNG có mật khẩu cấp 2 — sửa lại 2026-07-31) — KHÔNG gộp vào modal Duyệt/Ký duyệt, 2 hành động tách biệt hoàn toàn theo yêu cầu người dùng. Response trả thẳng `OtFormDto` mới — dùng ngay, không gọi lại `GET /{id}`.
6. Sau khi duyệt/từ chối/loại người → gọi lại `GET /{id}` (hoặc dùng response của loại người) refresh timeline + trạng thái nút.

Tab **"Đơn đã xử lý"** → `GET /my-actions` (§4.2b), click dòng → `GET /{id}` xem lại, chỉ xem (không có nút hành động vì đơn đã xử lý xong ở cấp của user đó).

Tab **"Đơn tôi tham gia"** (**mới**, mọi role kể cả "Nhân viên") → `GET /my-participations` (§4.2c), click dòng → `GET /{id}` xem chi tiết, **chỉ xem** (không có nút Sửa/Ký/Duyệt nào — user chỉ là nhân viên được liệt kê tăng ca, không có quyền thao tác trên đơn trừ khi họ cũng đồng thời là người tạo/ký/duyệt). Nếu API trả rỗng và user thuộc Role "Nhân viên"/"Trưởng nhóm", kiểm tra account đã được Admin gán `Employee.userName` chưa (§4.2c).

**"Cài đặt chữ ký"** → `GET /UserSignature/me` hiện preview (chữ ký đang có hiệu lực), chọn **file ảnh mới** qua `<input type="file">` (KHÔNG phải canvas) → convert base64 → `PUT /me` → **không** áp dụng ngay, hiện thông báo "đã gửi email xác nhận, kiểm tra hộp thư trong 30 phút" (không tự refresh preview vì chữ ký chưa đổi).

**"Xác nhận cập nhật chữ ký"** (route public, mở qua link email — §6b)
1. Đọc `token` từ query string URL.
2. `GET /UserSignature/confirm/{token}` — hiện preview ảnh chữ ký mới + `expiresAt`; lỗi (hết hạn/đã dùng/không tồn tại) → hiện thông báo, không crash trang.
3. Bấm "Xác nhận cập nhật" → `POST /UserSignature/confirm/{token}` → hiện thành công, gợi ý link quay lại app.

**"Xác nhận duyệt đơn qua email"** (route public, mở qua link email — §4.6)
1. Đọc `token` từ query string URL.
2. `GET /OtForm/email-confirm/{token}` — hiện chi tiết đơn (dùng chung component với màn "Chi tiết đơn" §1.3.C).
3. "Duyệt" → `POST /OtForm/email-confirm/{token}/approve` (body chỉ `comment` optional); "Từ chối" → bắt buộc nhập `comment` trước → `POST /OtForm/email-confirm/{token}/reject`.
4. Lỗi (hết hạn/đã dùng/đơn đã xử lý xong bởi người khác) → hiện thông báo rõ ràng, không crash trang.

**"Import nhân sự" (Admin, §3.7)**
1. Chọn file `.xlsx` → `POST /EmployeeImport/preview` → hiện bảng preview (cột `errors` đỏ cho dòng lỗi, cột `isNewDepartment`/`isNewGroup`/`isNewEmployee` đánh dấu dòng sẽ tạo mới).
2. Cho user xem/sửa lại (nếu FE hỗ trợ sửa tay từng ô) rồi bấm "Xác nhận import" → `POST /EmployeeImport/confirm` gửi lại nguyên `rows` từ Preview.
3. Hiện kết quả: số tạo mới/cập nhật/phòng ban+nhóm mới, và danh sách dòng bị bỏ qua kèm lý do (`skippedRows`).

**"In đơn / Xuất PDF"** — BE không tạo PDF, FE tự dựng file từ JSON `GET /api/OtForm/{id}` (đã đủ dữ liệu để khớp layout giấy YEV-22-024: header đơn, danh sách nhân viên, ProcessPart, và từng dòng `approvalHistories` có sẵn `signatureImage`(base64)+`approverFullName` để in đúng chữ ký/tên từng cấp đã duyệt). Nút "In đơn" hiện ở **mọi trạng thái** (không riêng `Completed`) — cấp nào chưa duyệt tới thì ô chữ ký tương ứng chỉ để trống trên bản in, không chặn in cả đơn.

**Admin — "Phân quyền duyệt"** → gán Role (Identity `update-user-roles`) trước, rồi `POST /api/UserApprovalScope` khai báo phạm vi cho từng Trưởng phòng/Trưởng xưởng (`approvalLevel=1/2`), **Trưởng Bộ phận** (`approvalLevel=4 GroupHead`, **mới 2026-07-17 — BẮT BUỘC gán cho MỌI Group ngay**, không gán thì đơn của Group đó kẹt cứng sau khi Trưởng nhóm ký) **và cho từng người được phép tạo đơn** (`approvalLevel=0 Submitter`) — 1 Group có thể gán nhiều người ở cả `approvalLevel=Submitter` lẫn `GroupHead`. Không có màn sửa — xóa + tạo lại.

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `POST /OtForm` 400 "khác nhóm" | 1 `employeeId` trong `employees[]` không cùng `groupId` với đơn → chỉ cho tick nhân viên từ đúng `by-group/{groupId}` đang chọn |
| `POST /OtForm` 400 "Nhóm '...' không thuộc Bộ phận đã chọn" (**mới 2026-07-17**) | `groupId`/`departmentId` gửi lên không khớp nhau (`Group.DepartmentId` khác `departmentId` gửi) — FE dùng sai cascading dropdown (§3.2) hoặc còn giữ `departmentId` cũ sau khi đổi `groupId`. Luôn để Group dropdown lọc theo Department đã chọn, không cho set 2 field độc lập. **Không còn xảy ra ở `PUT`** kể từ 2026-07-31 — sửa đơn không còn nhận `groupId`/`departmentId` trong body nữa (§4.1b) |
| `PUT /OtForm/{id}` 400 "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình..." | Người tạo đơn không có `Employee` liên kết đúng `groupId` của đơn (và không phải Admin) — 2026-08-07, xem §4.1 |
| `POST /{id}/approve` 400 dù đúng Role | User gọi không nằm trong `candidates[]` của bước đang chờ (`approvalSteps[]`, xem §4.3) — kiểm tra lại Employee của họ có đúng Chức vụ ở đúng Phòng ban không, hoặc cây duyệt Phòng ban chưa cấu hình bước đó |
| Đơn tạo xong có `approvalChainWarning != null` (2026-08-07) | Department chưa cấu hình đủ cây duyệt (`/api/DepartmentApprovalStep`, §3.4c) hoặc thiếu người giữ đúng Chức vụ ở 1 bước — báo Admin cấu hình/gán `Employee.jobTitleId`, xem `attendance-module.md` §Cây chức vụ |
| `POST /{id}/approve` 400 "chữ ký" | Bước đang chờ có `requiresSignatureSnapshot=true` (`approvalSteps[]`, §4.3) nhưng người duyệt chưa đăng ký chữ ký qua `PUT /UserSignature/me` |
| `POST /{id}/approve\|reject` 400 "Bạn chưa thiết lập mật khẩu cấp 2..." | Chưa từng đăng ký mật khẩu cấp 2 qua `PUT /SecondaryPassword/me` + xác nhận email — bắt buộc cho MỌI hành động duyệt/từ chối kể cả kênh email (§6c) |
| `POST /{id}/approve\|reject` 400 "Mật khẩu cấp 2 không đúng" | `secondaryPassword` gửi lên không khớp mật khẩu cấp 2 đã đăng ký — nhập lại, không liên quan tới mật khẩu đăng nhập AD |
| `GET/POST /SecondaryPassword/confirm/{token}` 404/400 | Cùng luật lỗi hệt `UserSignature/confirm/{token}` ở 3 dòng dưới đây, đổi "chữ ký" thành "mật khẩu cấp 2" |
| `POST /OtForm` 400 "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình..." | Tài khoản gọi API chưa liên kết `Employee` đúng `groupId` của đơn (và không phải Admin) — 2026-08-07, xem §4.1 |
| `POST /OtForm` 400 "Giờ kết thúc phải sau giờ bắt đầu (không hỗ trợ ca qua đêm)" (**mới 2026-08-26**) | `endTime <= startTime` của đơn — không còn được coi là "qua ngày hôm sau", FE nên chặn ngay tại UI trước khi gọi API, xem §4.1 |
| `POST /UserApprovalScope` 400 "chưa giữ Role '...'" (mở rộng cho cả 4 cấp, **2026-07-17**) | Admin gán `approvalLevel` (Submitter/GroupHead/DepartmentManager/WorkshopManager) cho `userName` chưa có đúng Role tương ứng (Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng) — gán Role qua Identity `update-user-roles` trước, rồi mới gán scope. Xem bảng mapping ở §5 |
| `POST /UserApprovalScope` 400 "Cấp duyệt này chỉ được gán theo phạm vi '...'" (**mới 2026-07-17**) | `scopeType` không khớp `approvalLevel` (VD gán `Trưởng Bộ phận` theo phạm vi "Phòng ban" thay vì "Bộ phận", hoặc `Trưởng phòng` theo phạm vi "Bộ phận" thay vì "Phòng ban") — xem bảng mapping ScopeType ở §5, FE nên ép sẵn PHẠM VI theo `approvalLevel` đã chọn để tránh lỗi này |
| `pending-approvals` luôn rỗng dù có đơn chờ | User Tổng Giám Đốc thiếu Role `"Tổng Giám Đốc"` (case-sensitive, kiểm tra đúng chuỗi), hoặc Trưởng phòng/xưởng thiếu `UserApprovalScope` |
| `POST /OtForm` 400 "Giờ bắt đầu OT của nhân viên ... phải nằm trong khoảng giờ của đơn" / "Giờ kết thúc OT của nhân viên ... phải sau giờ bắt đầu ... và không được vượt quá giờ kết thúc của đơn" | `employees[].startTime`/`endTime` ra ngoài khung `[startTime, endTime]` của đơn, hoặc `endTime <= startTime` của chính người đó — FE tự chặn trước khi gửi |
| `PUT /OtForm/{id}` 400 "Bạn chỉ có thể sửa đơn do chính mình tạo" | Gọi sửa đơn không phải do mình tạo — chỉ hiện nút "Sửa" khi `createdByUserName == user hiện tại` |
| `PUT /OtForm/{id}` 400 "Đơn đã được duyệt ít nhất 1 cấp, không thể sửa nữa" | Đơn đã qua cấp duyệt nào đó (`isEditable=false`) — ẩn nút "Sửa" dựa vào field này thay vì tự đoán theo `status` |
| `GET/POST /UserSignature/confirm/{token}` 404 "Yêu cầu xác nhận chữ ký..." | Token sai/không tồn tại — kiểm tra lại link email, có thể bị copy thiếu ký tự |
| `POST /UserSignature/confirm/{token}` 400 "Link xác nhận này đã được sử dụng" | Token đã bấm xác nhận trước đó (single-use) — chữ ký đã áp dụng rồi, không cần làm gì thêm |
| `GET/POST /UserSignature/confirm/{token}` 400 "Link xác nhận đã hết hạn" | Quá 30 phút kể từ lúc `PUT /me` — quay lại app gọi `PUT /me` lại để nhận email mới |
| `GET/POST /OtForm/email-confirm/{token}...` 404 "Link duyệt đơn qua email..." | Token sai/không tồn tại |
| `POST /OtForm/email-confirm/{token}/approve\|reject` 400 "Link duyệt đơn này đã được sử dụng" | Token đã bấm Duyệt hoặc Từ chối trước đó (single-use) |
| `GET/POST /OtForm/email-confirm/{token}...` 400 "Link duyệt đơn qua email đã hết hạn" | Quá 3 ngày kể từ lúc gửi mail — người duyệt cần vào app dùng `pending-approvals` thay vì link email cũ |
| `POST /OtForm/email-confirm/{token}/approve\|reject` 400 "Đơn đã xử lý xong..." | Đơn đã được người khác duyệt/từ chối (hoặc đổi cấp) từ lúc gửi mail đến lúc bấm link — bình thường khi 1 đơn có nhiều người cùng nhận được email |
| `POST /EmployeeImport/preview` 400 "File Excel không hợp lệ..." | File không phải `.xlsx` OOXML thật (VD `.xlsb`, `.xls` cũ đổi đuôi) — mở file trong Excel, Save As lại đúng "Excel Workbook (*.xlsx)" |
| 401/403 chung | Xem [identity-api-fe.md §6](identity-api-fe.md) |

## 10. Attendance AI Chat (`POST /api/AttendanceAiChat/stream`) — 2026-07-29

Trợ lý AI hỗ trợ lập đơn tăng ca qua hội thoại — thiết kế đầy đủ ở
[attendance-aichat-be-huong-dan.md](attendance-aichat-be-huong-dan.md), đây chỉ tóm tắt hợp đồng FE↔BE.

- **Permission**: `Attendance.AiChat.Use` (migration `AddAttendanceAiChatPermission`, hiện chỉ gán Admin —
  mở rộng cho Role "Trưởng nhóm"/"Nhân viên" là việc làm sau qua UI gán permission có sẵn).
- **Request** (`application/json`, giống hình dạng `POST /api/AiChat/stream` bên Asset nhưng endpoint
  và permission riêng):
  ```json
  { "message": "Tạo đơn tăng ca cho nhóm Kế toán ngày mai 18h-20h", "history": [], "think": false }
  ```
- **Response**: NDJSON (`application/x-ndjson`), mỗi dòng 1 JSON, KHÔNG bọc `ApiResponse<T>`. 5 dạng
  dòng — giống Asset nhưng thay `device` bằng `otform`:
  ```json
  {"type":"content","text":"..."}
  {"type":"tool","name":"create_ot_form_draft"}
  {"type":"otform","otFormId":18}
  {"type":"done"}
  {"type":"error","message":"..."}
  ```
  `otform`: emit đúng 1 lần/lượt hỏi, ngay sau khi tool `create_ot_form_draft` tạo THẬT 1 đơn Draft —
  FE dùng để hiện nút "Xem đơn vừa tạo" điều hướng `/ot/forms/edit?id={otFormId}` (đơn Draft sửa được).
- **Quan trọng — đây là tool GHI dữ liệu đầu tiên của toàn bộ tính năng AI Chat** (khác các tool
  tra cứu read-only của Asset): xác nhận sẽ tạo THẬT 1 bản ghi + (nếu bước đầu tiên trong chuỗi duyệt
  là cấp trung gian, `TerminalLevelSnapshot=None`) gửi THẬT 1 email ngay cho candidate bước đó
  (`NotifyEligibleApproversAsync`, không có cách tắt). Nếu bước đầu tiên đã là 1 trong 3 cấp quản lý
  (DepartmentManager/WorkshopManager/GeneralDirector) thì KHÔNG gửi mail ngay nữa (2026-09-05, xem
  `attendance-module.md` §Bỏ mail riêng ở 3 cấp quản lý) — người duyệt chỉ nhận mail tổng hợp ở lần
  chạy `OtFormBatchBackgroundService` kế tiếp (mặc định 15:00 hằng ngày).
  > **⚠ Chưa verify lại sau Giai đoạn 3.1 (2026-08-07)** — tool `create_ot_form_draft` gọi thẳng
  > `OtFormService.CreateAsync` đã redesign (không còn Draft, vào chuỗi duyệt Cây chức vụ ngay lập
  > tức, xem §4.1) nhưng bản thân code/prompt của AI Chat (đặt tên tool, mô tả "Draft" trong system
  > prompt) CHƯA được rà lại cho khớp — cần kiểm tra kỹ trước khi coi tính năng này hoạt động đúng ý,
  > xem [attendance-aichat-be-huong-dan.md §B3](attendance-aichat-be-huong-dan.md).

## 11. ProductionOtReport (`/api/ProductionOtReport`) — báo cáo dưới chuyền theo ngày (mới, 2026-08-28;
mở rộng 2026-08-29 — thêm `departmentId` + đủ 23 cột Excel)

Gate cả 2 route bằng `Attendance.ProductionOtReport.View`. Chỉ tính đơn `isProductionForm=true` +
`status=Completed` (Hoàn tất — qua đủ mọi cấp duyệt) đúng ngày truyền vào. Cả 2 route đều nhận thêm
query param **`departmentId`** (`int?`, optional — không truyền = không lọc, mọi Phòng ban). Đơn "dưới
chuyền" có thể tạo dưới BẤT KỲ Phòng ban nào (không chỉ riêng "Chế tạo"), nên FE nên luôn cho chọn
Phòng ban qua `DepartmentApi.getAllDepartments()`. Xem thiết kế đầy đủ + kết quả verify dữ liệu thật ở
[attendance-module.md §Báo cáo dưới chuyền theo ngày](attendance-module.md).

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
  ca 1 người trong 1 ngày" (Excel, mới 2026-08-29) — **KHÔNG gộp dòng** (khác hẳn báo cáo trên): mỗi
  dòng = 1 lượt (1 đơn/1 ngày của người đó). Trả file `.xlsx` trực tiếp, cùng pattern. 9 cột:
  `MNV, BLOCK, NHOM, NOTE, Ngay_TC, LAN_TANG_CA_TRONG_NGAY, Gio_Hientai, BP, MNV_TP`. 2 cột
  `LAN_TANG_CA_TRONG_NGAY`/`Gio_Hientai` là tổng hợp CẢ NGÀY (lặp lại trên mọi dòng của người đó);
  `MNV_TP` = mã Trưởng Phòng đã duyệt đúng đơn đó (tra `OtFormApprovalHistory`). Chi tiết nguồn từng
  cột — xem attendance-module.md.
- **`GET /api/ProductionOtReport/qry-export-excel?date=&departmentId=`** — "Qry_EXPORT_EXCEL" (Excel,
  mới 2026-09-03c), gộp 1 dòng/người/ngày, **17 cột**: `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_BD, Gio_KT,
  Lydo, Lydo_phu, An, BLOCK, NHOM, NOTE, Gio_Thuc_Te, BP, QUAN_LY_TC_SX, MNV_TP` — ĐỘC LẬP với
  `hours-report-excel` (không thay thế). `QUAN_LY_TC_SX` = mã NV đã duyệt ở bước Chức vụ "TL" (Team
  Leader). Trả file `.xlsx` trực tiếp, cùng pattern.
- **`GET /api/ProductionOtReport/sum-export-data?date=&departmentId=`** — "SUM_EXPORT_DATA" (Excel, mới
  2026-09-03c), gộp 1 dòng/người/ngày, **7 cột**: `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_thuc_te, BP` —
  ĐỘC LẬP mục đích với `qry-export-excel` (không phải bản rút gọn). Trả file `.xlsx` trực tiếp.
- **`GET /api/ProductionOtReport/ticket-batch?date=&departmentId=`** — dữ liệu nền để FE tự dựng + đóng
  gói **PDF phiếu YEV-22-024 hàng loạt theo Line/Nhóm** (zip, mới 2026-09-03c, sửa dữ liệu 2026-09-03f).
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
  `modules/attendance/lib/productionTicketBatchPdf.tsx` + attendance-module.md §3 và §Fix format/dữ liệu.
