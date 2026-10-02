# workflow-module.md — Module Workflow (form builder động + duyệt nhiều cấp)

> Nguồn chân lý thiết kế cho module thứ 4 của hệ thống YEV Management.
> Bản đồ quan hệ 25 bảng: §2 bên dưới (file `docs/workflow-erd.drawio` đã xoá 2026-09).
> Mô hình tham chiếu: **POWER EGG 3.5 — 汎用申請ワークフロー**.
>
> **Trạng thái: Pha 1 → 4 đã xong cả BE lẫn FE.** 4 project + 27 entity + Migrations đầy đủ.
> - **Pha 1** tổ chức + nhân sự (5 bảng) · **Pha 2** form builder: danh mục/nguồn dữ liệu → `FormDefinitions`
>   → `FormFields` kéo-thả (`@dnd-kit`) + `FormFieldConditions` → `FormAccesses` + `publish`/`clone`.
> - **Pha 3** engine nộp–duyệt thật: `FormRoutes` + `FormApprovalSteps` (+ `Participants`) cấu hình nhánh
>   rẽ/bước duyệt; `WorkflowRequests`/`Steps`/`Participants`/`Histories`/`Sequences` + `ApprovalDelegations`
>   chạy luồng Draft → nộp → duyệt/từ chối/trả về/thêm người duyệt/hủy/ủy quyền. FE: render form động,
>   inbox "Chờ tôi duyệt", xem/in đơn, quản lý ủy quyền (3 endpoint phụ cho người nộp thường: §6, §10).
> - **Pha 4** 4A chữ ký đăng ký sẵn (`EmployeeSignatures` + `PendingEmployeeSignatureConfirmations`) ·
>   4B đính kèm (`WorkflowAttachments` — file trên đĩa, KHÔNG lưu `byte[]` — + `WorkflowSettings`) ·
>   4C duyệt qua email (`WorkflowRequestEmailTokens`, không có mật khẩu cấp 2) · **4D xuất Excel: chủ
>   động KHÔNG làm** (quyết định 2026-08-27, §10).
>
> **JWT phải có claim `UserId`** (số) — Workflow map ra `Employees.UserId` để biết "nhân sự nào đang
> đăng nhập"; token phát trước 2026-08-25 không có claim này, holder phải đăng nhập lại.
> Permission đã seed & gán Admin: `Workflow.Organization.View/Manage`, `Workflow.FormDesign.View/Manage`,
> `Workflow.Setting.Manage`, `Workflow.Request.Create`, `Workflow.Request.ViewAll`.
>
> **Còn nợ:** `FormCategoryService.DeleteAsync` thiếu guard "còn `FormDefinitions` chưa xoá thì chặn xoá"
> (mirror cách `FormDefinitionService.DeleteAsync` chặn xoá form đã publish) — xoá danh mục hiện để lại
> `FormDefinitions.FormCategoryId` trỏ vào bản ghi `IsDeleted=true`. Bổ sung khi nào chạm `FormCategoryService`.

---

## MỤC LỤC ĐỌC NHANH

> ⚠ **File ~135 KB — đọc theo lát cắt** (AGENTS.md §2 luật 7): `Grep` pattern `^#{2,3} ` để lấy mục lục
> kèm số dòng → `Read` đúng dải. Tra 1 field/endpoint cụ thể thì `Grep` thẳng chuỗi đó.

| Cần gì | Mục |
|---|---|
| **Quyết định kiến trúc ĐỪNG LẬT LẠI** (độc lập với Attendance, prefix route, in phiếu…) | §1.1 → §1.7 |
| Bản đồ 25 bảng | §2 |
| Entity chi tiết: tổ chức/nhân sự · định nghĩa form · dữ liệu đơn · cấu hình | §3.1 → §3.4 |
| Enum | §4 |
| **Luật nghiệp vụ**: nộp đơn, nhánh điều kiện, ẩn/hiện field, cấp số, resolve người duyệt, ủy quyền | §5.1 → §5.6a |
| In phiếu (2 chế độ: lưới / layout Word gốc) | §1.5, §5.7 |
| **`DataJson` — quy ước bắt buộc** + index + đặt tên DB | §5.8 → §5.10 |
| **Hợp đồng API cho FE** (không có `workflow-api-fe.md` riêng) | §6, §10 |
| Phân quyền | §7 |
| Lộ trình · còn để ngỏ · nhật ký quyết định | §8, §9, §10 |

---

## 0. Phạm vi & mục tiêu

Module cho phép **mỗi phòng ban tự thiết kế loại đơn của mình** (kéo-thả ô nhập) và **tự cấu hình
luồng duyệt** (chọn node trên cây tổ chức, gán người duyệt / người xem), rồi vận hành vòng đời đơn
từ nháp → nộp → duyệt nhiều cấp → hoàn tất, có audit trail đầy đủ.

Điểm khác biệt cốt lõi so với Attendance: **thêm một loại đơn mới không cần lập trình viên.**

| | |
|---|---|
| DB | `YevWorkflowManagement` (**mới hoàn toàn**) |
| Số bảng | **25** |
| Project | `Workflow.Domain` / `Workflow.Application` / `Workflow.Infrastructure` / `Workflow.Api` |
| Nền tảng | **Web** (không làm bố cục riêng cho mobile) |

---

## 1. Quyết định kiến trúc đã chốt — ĐỪNG LẬT LẠI

### 1.1 Module độc lập với Attendance (chốt 2026-08-20)

Rà soát ngày 2026-08-20 phát hiện **7 nhóm bảng của Workflow trùng việc với Attendance**:

| Attendance (đã chạy, 35 migration) | Workflow (thiết kế) |
|---|---|
| `Employee`, `JobTitle` | `Employees`, `JobTitles` |
| `Department`, `Group` | `OrgLevels`, `OrgUnits` |
| `DepartmentApprovalStep`, `GroupApprovalStep` | `FormApprovalSteps` |
| `OtFormApprovalStep` | `WorkflowRequestSteps` |
| `OtFormApprovalStepCandidate` | `WorkflowRequestStepParticipants` |
| `OtFormApprovalHistory` | `WorkflowRequestHistories` |
| `OtFormApprovalEmailToken`, `UserSignature` | `WorkflowRequestEmailTokens`, `EmployeeSignatures` |

**Quyết định: chấp nhận trùng lặp, để hai module hoàn toàn độc lập. Tách phần nền dùng chung sau,
khi Workflow đã ổn định.** Lý do: không muốn refactor 35 migration dữ liệu thật trong lúc còn đang
dựng cái mới.

Phương án "OT Form trở thành một `FormDefinition`" **đã bị loại dứt điểm** — `OtCase`,
`OtFormEmployee` (1 đơn nhiều nhân viên, giờ riêng từng người), `EmployeeAccumulationHistory`
(lũy kế tháng/năm), `SecondaryPassword`, xử lý theo lô — không diễn đạt được bằng `DataJson` phẳng.

### 1.2 Mối nối bắt buộc giữ cho lần tách sau

**Áp dụng NGAY TỪ MIGRATION ĐẦU TIÊN.** Đây là thứ quyết định pha gộp nền sau này là "di trú dữ liệu"
hay "đối chiếu thủ công từng con người":

| Cột Workflow | Phải cùng quy ước mã với |
|---|---|
| `Employees.EmployeeCode` | `Attendance.Employee.Code` |
| `JobTitles.Code` | `Attendance.JobTitle.Code` |
| `OrgUnits.Code` | `Attendance.Department.Code` / `Attendance.Group.Code` |

Ngoài ra: giữ `Employees` **thuần master data**, không nhét logic nghiệp vụ mà Attendance không có.

### 1.3 Tiêu chí "ổn định" để bước sang pha gộp nền

Không để cảm tính, nếu không pha gộp sẽ trôi vô hạn và trùng lặp thành vĩnh viễn:

> Workflow đã chạy thật **ít nhất 3 loại đơn** ở **ít nhất 2 phòng ban**, liên tục **2 tháng**,
> và **không còn thay đổi schema** trong thời gian đó.

### 1.4 Identity không nhận thêm bảng nào

Đúng theo hướng đã chốt ở `project_authz_architecture_direction`: Identity chỉ xác thực + phân quyền
thô. Cây tổ chức, chức danh, nhân sự đều thuộc Workflow DB.

**Chỉ có đúng 2 điểm chạm cross-DB (KHÔNG có FK thật, EF không tạo được):**
- `Employees.UserId` → `Identity.Users.Id` (**nullable**)
- `FormAccesses.RoleId` → `Identity.Roles.Id` (nullable)

### 1.5 In phiếu — 2 chế độ: lưới (mặc định) hoặc layout Word gốc (sửa 2026-09-05)

**Đảo ngược một phần quyết định chốt 2026-08-20** ("bản in = chính layout màn hình, KHÔNG mô phỏng
mẫu giấy chính thức"). Lý do đảo ngược: một số phòng ban đã có sẵn mẫu giấy Word chính thức và cần
**in đơn ra đúng y hệt layout đó**, không chấp nhận quy về lưới generic. Xem log ở §10 (2026-09-05).

Cơ chế: cộng thêm, không thay chỗ cũ. `FormDefinitions.LayoutHtml` (nvarchar(max), NULL) — NULL thì
mọi thứ y hệt trước đây (bản in = layout màn hình, dựng từ `FormFields`+`ColumnSpan`, hệ quả "không
cần bảng nào cho việc in" ở §5.7 vẫn đúng cho form này). Có giá trị thì đây là HTML `docx-preview`
render từ file `.docx` admin tải lên lúc thiết kế form ("Nhập từ Word", field-designer), nhúng sẵn
`<span data-field-key="...">` ngay tại vị trí field trong văn bản.

Điểm mấu chốt: **`FormFields` vẫn là nguồn chân lý duy nhất cho field** dù ở chế độ nào — validate
`DataJson`, `FormFieldConditions`, luồng duyệt, `FormAccesses`, permission... không đổi gì.
`LayoutHtml` chỉ là 1 cách khác để nói "field này nằm ở đâu" (vị trí trong HTML thay vì
`SortOrder`+`ColumnSpan`). `data-field-key` khớp đúng `FormFields.FieldKey` (không phải id riêng).
`FormSchemaJson` (snapshot lúc nộp, §5.7) snapshot thêm cả `LayoutHtml` — đơn cũ luôn in đúng layout
tại thời điểm nộp dù `FormDefinitions.LayoutHtml` sau này bị sửa/xoá.

Hệ quả: **không cần bảng mới nào cho việc in** (chỉ thêm 1 cột), field-designer/renderer FE tự chọn
lưới hay tài liệu theo `LayoutHtml` có NULL hay không, xem chi tiết implementation ở §5.7.

### 1.6 Không có kiểu duyệt "tự leo lên cấp trên"

Bản thiết kế v3 từng có `OrgUnitScope = ApplicantAncestor` (bước duyệt tự leo cây tìm cấp trên của
người nộp). **Đã gỡ bỏ.** Attendance thử đúng cơ chế này và loại ngày 2026-08-06 — xem comment trong
`Attendance.Domain/Entities/JobTitle.cs`:

> *"KHÔNG dùng để tự bắc cầu qua mọi cấp đang có người giữ nữa — bắc cầu tự động khiến 1 đơn phải
> qua quá nhiều bước nếu Phòng ban có đủ người ở mọi cấp."*

### 1.7 Route API prefix bằng `api/Workflow/` — bắt buộc (phát hiện 2026-08-24)

Attendance module đã có sẵn `EmployeeController` và `JobTitleController` (route mặc định
`api/[controller]` → `api/Employee`, `api/JobTitle`) — trùng thẳng tên entity với Workflow (§1.1).
Vì routing của ASP.NET Core chỉ nhìn tên class, không nhìn namespace, scaffold Pha 1 ban đầu dùng
`api/[controller]` y hệt Asset/Attendance đã vỡ ngay ở runtime (`AmbiguousMatchException` khi gọi
`GET /api/JobTitle` hay `/api/Employee` — cả 2 controller cùng khớp route).

**Quyết định: `WorkflowBaseController` dùng `[Route("api/Workflow/[controller]")]`** — MỌI controller
Workflow (không chỉ 2 cái trùng tên) đều nằm dưới tiền tố `api/Workflow/`, để phòng entity nào khác
sau này lại trùng tên với Asset/Attendance/Identity. FE gọi Workflow API phải nhớ thêm tiền tố này,
khác Asset/Attendance/Identity (`api/{Controller}` không tiền tố).

---

## 2. Bản đồ 25 bảng

| Nhóm | Bảng |
|---|---|
| **Tổ chức + nhân sự** (6) | `OrgLevels` · `OrgUnits` · `JobTitles` · `Employees` · `EmployeeOrgUnits` · `OrgLevelJobTitleSuggestions` |
| **Định nghĩa form** (10) | `FormCategories` · `FormCategoryCoordinators` · `FormDefinitions` · `FormFields` · `FormFieldConditions` · `FormDataSources` · `FormAccesses` · `FormRoutes` · `FormApprovalSteps` · `FormApprovalStepParticipants` |
| **Dữ liệu đơn** (6) | `WorkflowRequests` · `WorkflowRequestSteps` · `WorkflowRequestStepParticipants` · `WorkflowRequestHistories` · `WorkflowAttachments` · `WorkflowRequestEmailTokens` |
| **Độc lập / cấu hình** (4) | `ApprovalDelegations` · `EmployeeSignatures` · `WorkflowSequences` · `WorkflowSettings` |

Trục chính của thiết kế: **form → nhánh → bước → người**, rồi snapshot toàn bộ lúc nộp.

---

## 3. Entity chi tiết

> Quy ước chung áp cho **mọi** entity: `partial class`, POCO thuần, không phụ thuộc gì
> (AGENTS.md §3.2). Bảng cấu hình có `IsDeleted`; bảng audit/counter/settings **không** có.
> Query phải tự lọc `.Where(x => !x.IsDeleted)` — **không có global query filter**.

### 3.1 Nhóm tổ chức + nhân sự

#### `OrgLevels` — danh mục cấp tổ chức

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `LevelNumber` | int | **UNIQUE**. Số nhỏ = cấp cao hơn |
| `NameVn` | nvarchar(100) | |
| `NameJp` | nvarchar(100) NULL | |
| `IsDeleted` | bit = 0 | |

#### `OrgUnits` — cây tổ chức dùng chung

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `Code` | nvarchar(50) | **UNIQUE**. Cùng quy ước với Attendance (§1.2) |
| `NameVn` / `NameJp` | nvarchar(200) | `NameJp` nullable |
| `OrgLevelId` | int | FK → `OrgLevels`, **Restrict** |
| `ParentId` | int NULL | FK → `OrgUnits` (self), **Restrict**. NULL = node gốc |
| `SortOrder` | int = 0 | thứ tự hiển thị trong cây |
| `ValidFrom` / `ValidTo` | datetime2 NULL | `組織図の世代管理` bản nhẹ — cơ cấu cũ/mới chạy song song |
| `IsDeleted` | bit = 0 | |

**Cây này KHÔNG mang luật duyệt.** Nó chỉ là sơ đồ tổ chức tổng quát. Luật duyệt nằm ở tầng form.

#### `JobTitles` — chức danh (役職)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `Code` | nvarchar(50) | **UNIQUE**. Cùng quy ước với Attendance (§1.2) |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `RankOrder` | int | thứ bậc, số nhỏ = cao hơn. **Chỉ để hiển thị/sắp xếp**, KHÔNG dùng suy luận luồng duyệt (§1.6) |
| `IsUniquePerOrgUnit` | bit = 1 | true = tại 1 `OrgUnit` chỉ 1 người giữ chức danh này cùng lúc (bắt buộc cho chức danh dùng route duyệt qua `ParticipantSource=JobTitle`, §5.5). false = chức danh phổ thông, nhiều người cùng giữ (vd "Nhân viên") — **không được** chọn làm `ParticipantRole=Approver` khi cấu hình `FormApprovalStepParticipants` (chặn ở `ReplaceRoutesAsync`). Chốt 2026-08-26, xem §10 |
| `IsDeleted` | bit = 0 | |

#### `Employees` — nhân sự, điểm neo định danh duy nhất

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `EmployeeCode` | nvarchar(50) | **UNIQUE**. Cùng quy ước với Attendance (§1.2) |
| `FullName` | nvarchar(200) | |
| `FullNameJp` | nvarchar(200) NULL | |
| `Email` | nvarchar(200) NULL | dùng gửi mail duyệt |
| `Position` | nvarchar(100) NULL | chức vụ mô tả tự do, khác `JobTitles` (dùng cho luồng duyệt) |
| `UserId` | int NULL | **cross-DB → `Identity.Users.Id`, KHÔNG FK**. UNIQUE filtered WHERE NOT NULL |
| `IsActive` | bit = 1 | còn làm việc |
| `IsDeleted` | bit = 0 | tạo nhầm / xoá mềm |

`IsActive` và `IsDeleted` **tách biệt có chủ đích**: nghỉ việc và tạo nhầm là hai chuyện khác nhau.

**Luật `UserId IS NULL`** — nhân sự có trong sơ đồ tổ chức nhưng không đăng nhập được. Hợp lệ, nhưng
**chặn ở CẢ HAI chỗ** khi đứng vào vai trò cần thao tác:
1. **Designer** không cho chọn làm `Approver` hoặc người được tạo đơn.
2. **Lúc nộp đơn** validate lại lần nữa — phòng khi tài khoản bị gỡ sau khi form đã thiết kế xong.

> **Mọi cột "ai đó" trong toàn bộ Workflow DB đều là FK → `Employees` (Restrict).** Không lưu chuỗi
> `UserName` rời rạc ở từng bảng như Attendance đang làm.

#### `EmployeeOrgUnits` — nhân sự × đơn vị × chức danh (kiêm nhiệm 兼務)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK (surrogate, vì có thời hiệu) |
| `EmployeeId` | int | FK → `Employees`, **Cascade** |
| `OrgUnitId` | int | FK → `OrgUnits`, **Restrict** |
| `JobTitleId` | int NULL | FK → `JobTitles`, **Restrict** |
| `IsPrimary` | bit = 0 | đơn vị chính |
| `ValidFrom` / `ValidTo` | datetime2 NULL | |
| `IsDeleted` | bit = 0 | |

- `UNIQUE (EmployeeId, OrgUnitId, JobTitleId)`
- **Validate ở Service** (không dùng ràng buộc DB vì có thời hiệu):
  - 1 `Employee` chỉ có tối đa **1 dòng** `IsPrimary = 1` còn hiệu lực.
  - 1 cặp (`OrgUnitId`, `JobTitleId`) chỉ có **1 người** giữ tại một thời điểm — **CHỈ áp dụng khi
    `JobTitles.IsUniquePerOrgUnit = true`** (chốt 2026-08-26, xem §10). Chức danh phổ thông
    (`IsUniquePerOrgUnit = false`) không bị chặn, nhiều người cùng giữ được tại 1 đơn vị.

**Đây là bảng duy nhất trả lời "ai đang là Trưởng phòng Kế toán"** — nên cũng là chỗ duy nhất phải
sửa khi nhân sự thay đổi.

#### `OrgLevelJobTitleSuggestions` — chức danh GỢI Ý theo cấp (chốt 2026-08-27, xem §10)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `OrgLevelId` | int | FK → `OrgLevels`, **Restrict** |
| `JobTitleId` | int | FK → `JobTitles`, **Restrict** |
| `SortOrder` | int | thứ tự gợi ý — `SortOrder=0` là giá trị FE tự chọn sẵn (pre-select) mặc định |
| `IsDeleted` | bit = 0 | |

- `UNIQUE (OrgLevelId, JobTitleId)`.
- **Chỉ gợi ý, KHÔNG giới hạn cứng**: dùng để tự chọn sẵn `JobTitleId` khi gán nhân sự vào 1 `OrgUnit`
  ngay từ màn Cây tổ chức (vd cấp "Xưởng" → gợi ý "Trưởng xưởng"), người dùng vẫn chọn tự do toàn bộ
  `JobTitles` khác nếu gợi ý không đúng — không có logic chặn nào dựa vào bảng này.
- Quản lý kiểu **"thay nguyên danh sách theo thứ tự"** (`ReplaceJobTitleSuggestionsAsync`,
  `PUT .../OrgLevel/{id}/job-title-suggestions`) — mirror pattern
  `FormCategoryCoordinators`/`EmployeeOrgUnits`, không có Create/Update/Delete từng dòng.
- Không seed sẵn dữ liệu — admin tự cấu hình sau khi triển khai (màn "Chức danh gợi ý" ở trang Cấp tổ
  chức).

### 3.2 Nhóm định nghĩa form

#### `FormCategories` — thư mục form theo phòng ban

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `Code` | nvarchar(50) | **UNIQUE** |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `OrgUnitId` | int NULL | FK → `OrgUnits`, **Restrict**. Phòng ban sở hữu thư mục |
| `SortOrder` | int = 0 | |
| `IsDeleted` | bit = 0 | |

#### `FormCategoryCoordinators` — ai được THIẾT KẾ form của phòng này

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormCategoryId` | int | FK → `FormCategories`, **Cascade** |
| `EmployeeId` | int | FK → `Employees`, **Restrict** |
| `IsDeleted` | bit = 0 | |

- `UNIQUE (FormCategoryId, EmployeeId)`
- **CHỈ ĐỊNH TAY, không suy theo chức danh.** Attendance đã học bài này với
  `DepartmentApprovalStepCoordinator`: Trưởng phòng thường *không* tự cấu hình mà giao cho người khác.
- Quản lý kiểu **"thay nguyên danh sách"** (`ReplaceAsync`), không có Create/Update/Delete từng dòng —
  mirror pattern của Attendance.

> **Phân biệt rõ:** `FormCategoryCoordinators` = ai **sửa được cấu hình**.
> `FormAccesses` = ai **tạo đơn được**. Hai chuyện khác nhau.

#### `FormDefinitions` — 1 dòng = 1 loại đơn (申請様式)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `Code` | nvarchar(50) | **UNIQUE** |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `FormCategoryId` | int | FK → `FormCategories`, **Restrict** |
| `Description` | nvarchar(500) NULL | |
| `Version` | int = 1 | tăng mỗi lần publish lại |
| `IsPublished` | bit = 0 | chưa publish thì không tạo đơn được |
| `AllowAttachment` | bit = 0 | |
| `RequireAttachment` | bit = 0 | |
| `CodePrefix` | nvarchar(20) | tiền tố `RequestCode`, vd `"PO"` |
| `RouteConditionType` | int | enum `RouteConditionType`. **KHÔNG đổi được sau khi tạo** |
| `RouteNumericFieldKey` | nvarchar(50) NULL | `FieldKey` của ô mang giá trị số để rẽ nhánh |
| `RouteClassFieldKey` | nvarchar(50) NULL | `FieldKey` của ô mang giá trị phân loại |
| `LayoutHtml` | nvarchar(max) NULL | HTML `docx-preview` từ file Word đã nhập, nhúng `<span data-field-key>`. NULL = chế độ lưới (§1.5, thêm 2026-09-05) |
| `CreatedByEmployeeId` | int | FK → `Employees`, **Restrict** |
| `UpdatedByEmployeeId` | int NULL | FK → `Employees`, **Restrict** |
| `CreatedAt` / `UpdatedAt` | datetime2 | |
| `IsDeleted` | bit = 0 | |

**`RouteConditionType` bất biến** — giống ràng buộc của POWER EGG. Đổi kiểu điều kiện làm mọi
`FormRoutes` đã cấu hình trở nên vô nghĩa. Muốn đổi thì tạo `FormDefinition` mới.

#### `FormFields` — ô nhập, designer kéo-thả

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormDefinitionId` | int | FK, **Cascade** |
| `FieldKey` | nvarchar(50) | khoá trong `DataJson`. `UNIQUE (FormDefinitionId, FieldKey)` |
| `LabelVn` / `LabelJp` | nvarchar(200) | |
| `DataType` | int | enum `FieldDataType` |
| `IsRequired` | bit = 0 | bắt buộc mặc định (điều kiện có thể ép thêm — §5.3) |
| `SortOrder` | int | thứ tự kéo-thả |
| `ColumnSpan` | int = 1 | 1..3, lưới bố cục |
| `Placeholder` | nvarchar(200) NULL | |
| `DefaultValue` | nvarchar(500) NULL | |
| `OptionsJson` | nvarchar(max) NULL | lựa chọn tĩnh cho dropdown/radio |
| `MinValue` / `MaxValue` | decimal(18,4) NULL | |
| `MaxLength` | int NULL | |
| `HelpTextVn` | nvarchar(500) NULL | |
| `FormDataSourceId` | int NULL | FK → `FormDataSources`, **Restrict**. Nguồn dữ liệu ngoài |
| `AutoNumberPattern` | nvarchar(100) NULL | vd `"PO-{YYYY}-{SEQ:4}"` |
| `DefaultVisible` | bit = 1 | 0 = ẩn cho tới khi điều kiện `Show` khớp |
| `IsReadOnly` | bit = 0 | |
| `IsDeleted` | bit = 0 | |

`FieldKey` ở đây chính là thứ `FormRoutes` soi vào để rẽ nhánh và `FormFieldConditions` soi để ẩn/hiện.

#### `FormFieldConditions` — ẩn/hiện · bắt buộc theo điều kiện (条件による項目の表示制御)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `TargetFieldId` | int | FK → `FormFields`, **Cascade**. Ô bị điều khiển |
| `SourceFieldId` | int | FK → `FormFields`, **Restrict**. Ô mang giá trị điều kiện |
| `Operator` | int | enum `ConditionOperator` |
| `CompareValue` | nvarchar(500) NULL | |
| `CompareValue2` | nvarchar(500) NULL | chỉ dùng cho `Between` |
| `Effect` | int | enum `ConditionEffect` |
| `LogicGroup` | int = 1 | cùng group ghép **AND**, khác group ghép **OR** |
| `SortOrder` | int = 0 | |
| `IsDeleted` | bit = 0 | |

**Service PHẢI chặn vòng lặp** khi lưu: A điều khiển B rồi B lại điều khiển ngược A sẽ làm form treo
khi render. Kiểm tra chu trình **lúc lưu cấu hình**, không phải lúc render.

Ràng buộc thêm: `TargetFieldId` và `SourceFieldId` phải cùng thuộc một `FormDefinitionId`.

#### `FormDataSources` — nguồn dữ liệu cho ô nhập (外部DB参照)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `Code` | nvarchar(50) | **UNIQUE** |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `SourceKind` | int | enum `DataSourceKind` |
| `ConnectionName` | nvarchar(100) NULL | tên connection string trong `appsettings.json` |
| `SqlText` | nvarchar(max) NULL | chỉ dùng khi `SourceKind = SqlQuery` |
| `ValueColumn` / `DisplayColumn` | nvarchar(100) | |
| `FilterJson` | nvarchar(max) NULL | |
| `IsDeleted` | bit = 0 | |

**Bảo mật — bắt buộc:**
- **Admin đăng ký sẵn**, designer CHỈ được chọn từ danh sách. Không có đường nào để người thiết kế
  form tự nhập SQL.
- `SqlText` chạy bằng **tài khoản DB chỉ có quyền đọc**, chặn từ khoá ghi, có **timeout** truy vấn.
- Nếu không đáp ứng được 2 điều trên thì **chỉ triển khai `SourceKind` built-in** (Employees /
  OrgUnits / JobTitles), hoãn `SqlQuery` sang sau.

#### `FormAccesses` — ai được TẠO ĐƠN form này

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormDefinitionId` | int | FK, **Cascade** |
| `TargetType` | int | enum `AccessTargetType` |
| `RoleId` | int NULL | **cross-DB → `Identity.Roles`, KHÔNG FK** |
| `OrgUnitId` | int NULL | FK → `OrgUnits`, **Restrict** |
| `EmployeeId` | int NULL | FK → `Employees`, **Restrict** |
| `IsDeleted` | bit = 0 | |

- `UNIQUE (FormDefinitionId, TargetType, RoleId, OrgUnitId, EmployeeId)` — hoạt động đúng vì mỗi dòng
  chỉ có đúng 1 trong 3 cột đích khác NULL, và SQL Server coi NULL = NULL khi so unique nhiều cột.
- Service validate: đúng 1 cột đích khớp `TargetType`, 2 cột còn lại phải NULL.
- **`TargetType = OrgUnit` LAN XUỐNG cây con** (chốt 2026-08-26, xem §10): cấp quyền cho 1 `OrgUnit`
  thì mọi nhân sự thuộc `OrgUnit` đó **hoặc bất kỳ đơn vị con cháu nào của nó** đều coi là có quyền —
  không phải so khớp đúng-1-cấp. `HasFormAccessAsync` (`WorkflowRequestService`) duyệt ngược từ
  `OrgUnit` của nhân sự lên gốc qua `ParentId`, khớp bất kỳ nút nào (kể cả chính nó) với `OrgUnitId` đã
  cấp. Áp dụng thống nhất ở mọi nơi kiểm tra `FormAccesses` (`CreateDraftAsync`, `SubmitAsync`,
  `GET .../available-forms`).

#### `FormRoutes` — nhánh duyệt theo điều kiện (ルート判定条件)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormDefinitionId` | int | FK, **Cascade** |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `SortOrder` | int | thứ tự xét khớp |
| `MinValue` / `MaxValue` | decimal(18,4) NULL | 数値範囲 |
| `ClassValue` | nvarchar(100) NULL | 区分値 |
| `IsDefault` | bit = 0 | nhánh dùng khi không khớp gì |
| `IsDeleted` | bit = 0 | |

- `UNIQUE filtered (FormDefinitionId) WHERE IsDefault = 1` — mỗi form tối đa 1 nhánh mặc định.
- Service validate theo `FormDefinitions.RouteConditionType`:
  - `None` → đúng 1 nhánh, và nhánh đó phải `IsDefault = 1`.
  - `NumericRange` → mỗi nhánh phải có `MinValue` hoặc `MaxValue`; **cảnh báo nếu các khoảng chồng nhau
    hoặc để hở**.
  - `ClassValue` → mỗi nhánh phải có `ClassValue`, và không được trùng nhau.
  - `Both` → phải có cả hai.

#### `FormApprovalSteps` — bước duyệt của MỘT nhánh

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormRouteId` | int | FK → `FormRoutes`, **Cascade**. *(Không treo thẳng vào `FormDefinitions`)* |
| `StepOrder` | int | `UNIQUE (FormRouteId, StepOrder)` |
| `NameVn` / `NameJp` | nvarchar(200) | |
| `StepType` | int | enum `StepType` |
| `OrgUnitScope` | int | enum `OrgUnitScope` — chỉ có `Fixed` và `ApplicantUnit` (§1.6) |
| `OrgUnitId` | int NULL | FK → `OrgUnits`, **Restrict**. Bắt buộc khi `OrgUnitScope = Fixed` |
| `ApproverMode` | int | enum `ApproverMode` |
| `RequireSignature` | bit = 0 | **cấu hình theo từng BƯỚC**, không theo chức danh |
| `AllowSendBack` | bit = 1 | |
| `AllowAddApprover` | bit = 0 | 承認者の追加 |
| `IsDeleted` | bit = 0 | |

`RequireSignature` đặt ở bước là bài học từ Attendance: cùng một chức danh có thể cần ký ở phòng này
nhưng chỉ cần xác nhận ở phòng khác — nên không gắn cứng vào `JobTitles` được.

#### `FormApprovalStepParticipants` — ai đứng ở bước đó

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `FormApprovalStepId` | int | FK, **Cascade** |
| `ParticipantSource` | int | enum `ParticipantSource` |
| `EmployeeId` | int NULL | FK → `Employees`, **Restrict**. Dùng khi `Source = Employee` |
| `JobTitleId` | int NULL | FK → `JobTitles`, **Restrict**. Dùng khi `Source = JobTitle` |
| `ParticipantRole` | int | enum `ParticipantRole` — `Approver` hoặc `Viewer` |
| `SortOrder` | int = 0 | |
| `IsDeleted` | bit = 0 | |

- `UNIQUE (FormApprovalStepId, EmployeeId, JobTitleId)`
- Service validate: đúng 1 trong 2 cột `EmployeeId`/`JobTitleId` khác NULL, khớp `ParticipantSource`.
- Nếu `ParticipantRole = Approver` và `ParticipantSource = Employee` → **`Employee.UserId` phải khác
  NULL** (§3.1).

**`JobTitle` là tầng gián tiếp quan trọng nhất của thiết kế:** form ghi "bước 2 = Trưởng phòng", ai
đang giữ chức đó là dữ liệu ở `EmployeeOrgUnits`. Đổi trưởng phòng → sửa 1 dòng, không phải mở lại
từng form.

### 3.3 Nhóm dữ liệu đơn

#### `WorkflowRequests` — bảng trung tâm

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `RequestCode` | nvarchar(50) | **UNIQUE**. Sinh lúc nộp, xem §5.4 |
| `FormDefinitionId` | int | FK, **Restrict** — không xoá form còn đơn |
| `FormRouteId` | int NULL | FK → `FormRoutes`, **Restrict**. Nhánh đã chọn lúc nộp |
| `RouteConditionSnapshot` | nvarchar(200) NULL | giá trị điều kiện thật đã dùng để chọn nhánh |
| `FormVersion` | int | bản form lúc nộp |
| `DataJson` | nvarchar(max) | dữ liệu người dùng nhập |
| `FormSchemaJson` | nvarchar(max) NULL | **snapshot schema lúc NỘP**. NULL khi còn `Draft` |
| `Status` | int | enum `RequestStatus` |
| `CurrentStepOrder` | int = 0 | 0 = chưa vào luồng duyệt |
| `CreatedByEmployeeId` | int | FK → `Employees`, **Restrict** |
| `CreatedByOrgUnitId` | int NULL | FK → `OrgUnits`, **Restrict**. Đơn vị chính của người nộp lúc nộp |
| `CreatedAt` | datetime2 | |
| `SubmittedAt` / `CompletedAt` | datetime2 NULL | |
| `IsDeleted` | bit = 0 | |

`FormSchemaJson` phải chứa **đủ** để dựng lại form: danh sách field, nhãn, thứ tự, `ColumnSpan`, và
các điều kiện ẩn/hiện đã áp dụng. Đây là thứ dùng cả cho xem lại lẫn in (§5.7).

#### `WorkflowRequestSteps` — snapshot luồng duyệt của riêng đơn

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `WorkflowRequestId` | int | FK, **Cascade** |
| `StepOrder` | int | `UNIQUE (WorkflowRequestId, StepOrder)` |
| `StepNameSnapshot` | nvarchar(200) | |
| `StepTypeSnapshot` | int | |
| `OrgUnitNameSnapshot` | nvarchar(200) NULL | |
| `ApproverModeSnapshot` | int | |
| `RequireSignatureSnapshot` | bit | |
| `AllowSendBackSnapshot` | bit | |
| `Status` | int | enum `StepStatus` |
| `IsAdHoc` | bit = 0 | bước chèn giữa chừng |
| `InsertedByEmployeeId` | int NULL | FK → `Employees`, **Restrict** |
| `ActedByEmployeeId` | int NULL | FK → `Employees`, **Restrict**. Ai chốt bước này |
| `ActedAt` | datetime2 NULL | |

#### `WorkflowRequestStepParticipants` — snapshot người, ĐÃ resolve ra người thật

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `WorkflowRequestStepId` | int | FK, **Cascade** |
| `EmployeeId` | int | FK → `Employees`, **Restrict** |
| `ParticipantRole` | int | `Approver` / `Viewer` |
| `ResolvedFromJobTitle` | nvarchar(200) NULL | đến từ chức danh nào (nếu resolve qua `JobTitle`) |
| `ActedAt` | datetime2 NULL | phục vụ `ApproverMode = All` |

- `UNIQUE (WorkflowRequestStepId, EmployeeId)`
- `INDEX (EmployeeId)` — phục vụ màn hình "Chờ tôi duyệt" và "Đơn tôi xem được".

#### `WorkflowRequestHistories` — audit trail, CHỈ INSERT

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `WorkflowRequestId` | int | FK, **Cascade** |
| `StepOrder` | int | 0 = Submit/Cancel |
| `ActorEmployeeId` | int | FK → `Employees`, **Restrict** |
| `OnBehalfOfEmployeeId` | int NULL | FK → `Employees`, **Restrict**. 代理承認 — duyệt thay cho ai |
| `ActorNameSnapshot` | nvarchar(200) | |
| `Action` | int | enum `RequestAction` |
| `SentBackToStepOrder` | int NULL | 差戻し có chọn đích |
| `Comment` | nvarchar(1000) NULL | |
| `SignatureImage` | varbinary(max) NULL | chụp tại thời điểm hành động, **không** trỏ về `EmployeeSignatures` |
| `ActionAt` | datetime2 | |

**Không có `IsDeleted`, không UPDATE, không DELETE.** Chỉ INSERT.

#### `WorkflowAttachments` — metadata, file nằm trên đĩa

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `WorkflowRequestId` | int | FK, **Cascade** |
| `OriginalFileName` | nvarchar(255) | |
| `StoredFileName` | nvarchar(100) | GUID |
| `RelativePath` | nvarchar(300) | |
| `ContentType` | nvarchar(100) | |
| `FileSizeBytes` | bigint | |
| `UploadedByEmployeeId` | int | FK → `Employees`, **Restrict** |
| `UploadedAt` | datetime2 | |
| `IsDeleted` | bit = 0 | |

Giới hạn dung lượng / số lượng / phần mở rộng đọc từ `WorkflowSettings`.

#### `WorkflowRequestEmailTokens` — duyệt qua email, dùng 1 lần

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `WorkflowRequestId` | int | FK, **Cascade** |
| `StepOrder` | int | |
| `ApproverEmployeeId` | int | FK → `Employees`, **Restrict** |
| `Token` | nvarchar(128) | **UNIQUE**. Sinh ngẫu nhiên bằng CSPRNG |
| `ExpiresAt` | datetime2 | |
| `UsedAt` | datetime2 NULL | |
| `CreatedAt` | datetime2 | |

**✅ Đã cài Pha 4C** (2026-08-27). Token hợp lệ khi: chưa `UsedAt`, chưa quá `ExpiresAt` — `ResolveEmailTokenAsync`
KHÔNG tự so `StepOrder` đã snapshot trong token với bước hiện tại của đơn (mirror
`Attendance.OtFormApprovalEmailToken` — xem quyết định 2026-08-27 §10): thay vào đó
`ApproveByEmailTokenAsync`/`RejectByEmailTokenAsync` luôn gọi `LoadPendingApprovalContextAsync` để tự
tra lại bước Current THẬT của đơn, rồi khớp `ApproverEmployeeId` của token với participant Approver của
bước đó — nếu bước đã trôi qua (người khác xử lý xong trước), participant không còn khớp và tự báo lỗi
rõ ràng, không cần chủ động vô hiệu hoá các token anh em cùng bước.

### 3.4 Nhóm độc lập / cấu hình

#### `ApprovalDelegations` — ủy quyền duyệt thay (代理承認)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `DelegatorEmployeeId` | int | FK → `Employees`, **Restrict**. Người đi vắng |
| `DelegateEmployeeId` | int | FK → `Employees`, **Restrict**. Người duyệt thay |
| `FormDefinitionId` | int NULL | FK, **Restrict**. NULL = ủy quyền mọi loại đơn |
| `FromDate` / `ToDate` | datetime2 | |
| `Reason` | nvarchar(500) NULL | |
| `IsDeleted` | bit = 0 | |

- `INDEX (DelegateEmployeeId, FromDate, ToDate)`
- `CHECK (DelegatorEmployeeId <> DelegateEmployeeId)`
- Service chặn ủy quyền dây chuyền (A→B, B→C) — chỉ chấp nhận **1 cấp**.
- Service cũng chặn 1 `DelegatorEmployeeId` có 2 dòng ủy quyền chồng khoảng `FromDate`/`ToDate` cho
  cùng `FormDefinitionId` (hoặc 1 trong 2 dòng là NULL = mọi loại đơn) — tránh 2 người được ủy quyền
  cùng lúc cho cùng 1 loại đơn, gây chọn người duyệt thay không xác định lúc nộp/duyệt đơn.

#### `EmployeeSignatures` — chữ ký đăng ký sẵn

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `EmployeeId` | int | FK → `Employees`, **Cascade**. **UNIQUE** |
| `SignatureImage` | varbinary(max) | ⇄ chuỗi base64 trong JSON |
| `UpdatedAt` | datetime2 | |

Cập nhật KHÔNG áp dụng ngay — luôn qua `PendingEmployeeSignatureConfirmations` + email xác nhận cho
chính chủ, chống chiếm phiên đăng nhập đổi chữ ký hộ người khác (mirror `Attendance.UserSignature`,
quyết định 2026-08-26 §10).

#### `PendingEmployeeSignatureConfirmations` — chữ ký chờ xác nhận qua email

Không nằm trong 25 bảng thiết kế gốc — thêm khi scaffold Pha 4 (§10).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `EmployeeId` | int | FK → `Employees`, **Restrict** |
| `SignatureImage` | varbinary(max) | Chữ ký MỚI, chưa áp dụng |
| `Token` | nvarchar(128) | **UNIQUE**. Sinh ngẫu nhiên bằng CSPRNG (`TokenHelper`) |
| `ExpiresAt` | datetime2 | 30 phút kể từ lúc tạo |
| `ConfirmedAt` | datetime2 NULL | Null = chưa xác nhận |
| `CreatedAt` | datetime2 | |

#### `WorkflowSequences` — cấp số atomic

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `SequenceKey` | nvarchar(50) | PK (composite) |
| `Year` | int | PK (composite) |
| `LastSequence` | int | |

Dùng chung cho `RequestCode` **và** `FormFields.AutoNumberPattern`. Xem §5.4.

#### `WorkflowSettings` — cấu hình, LUÔN 1 dòng

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int | PK, luôn = 1 |
| `MaxAttachmentSizeMb` | int = 10 | |
| `AllowedFileExtensions` | nvarchar(500) | phân tách bằng dấu phẩy |
| `MaxAttachmentPerRequest` | int = 5 | |
| `EmailTokenExpiryDays` | int = 7 | |

---

## 4. Enum

```
RouteConditionType : None=0, NumericRange=1, ClassValue=2, Both=3
FieldDataType      : Text=1, TextArea=2, Number=3, Decimal=4, Date=5, DateTime=6,
                     Time=7, Dropdown=8, Radio=9, Checkbox=10, MultiSelect=11,
                     Employee=12, OrgUnit=13, Label=14
ConditionOperator  : Equals=1, NotEquals=2, Contains=3, GreaterThan=4, LessThan=5,
                     Between=6, IsEmpty=7, IsNotEmpty=8
ConditionEffect    : Show=1, Hide=2, Require=3, ReadOnly=4
DataSourceKind     : Employees=1, OrgUnits=2, JobTitles=3, SqlQuery=4
AccessTargetType   : Role=1, OrgUnit=2, Employee=3
OrgUnitScope       : Fixed=1, ApplicantUnit=2          // KHÔNG có ApplicantAncestor, xem §1.6
StepType           : Approve=1, Confirm=2
ApproverMode       : Any=1, All=2
ParticipantSource  : Employee=1, JobTitle=2
ParticipantRole    : Approver=1, Viewer=2
RequestStatus      : Draft=1, Submitted=2, InProgress=3, Approved=4,
                     Rejected=5, SentBack=6, Cancelled=7
StepStatus         : Waiting=1, Current=2, Approved=3, Rejected=4, Skipped=5
RequestAction      : Submit=1, Approve=2, Reject=3, SendBack=4, Cancel=5,
                     AddApprover=6, Comment=7, Resubmit=8
```

---

## 5. Luật nghiệp vụ & quy ước kỹ thuật

### 5.1 Nộp đơn — thứ tự bắt buộc

Toàn bộ nằm trong **một transaction**. Nếu bất kỳ bước nào fail thì không tạo gì cả.

1. Kiểm tra `FormDefinition.IsPublished = true`.
2. Kiểm tra người nộp nằm trong `FormAccesses` (theo Role / OrgUnit — **lan xuống cây con**, xem §3.2 /
   Employee).
3. Validate `DataJson` theo `FormFields` — **có tính tới điều kiện** (§5.3): ô đang bị `Hide` thì
   không validate `IsRequired`; ô bị `Require` bởi điều kiện thì bắt buộc dù `IsRequired = 0`.
4. **Chọn nhánh** `FormRoutes` (§5.2).
5. **Resolve người duyệt** cho mọi bước của nhánh đó (§5.6). Không resolve được → **chặn nộp ngay**,
   trả lỗi rõ ràng. Tuyệt đối không tạo đơn rồi để kẹt giữa luồng.
6. Cấp `RequestCode` (§5.4).
7. Ghi `FormSchemaJson` = snapshot schema hiện tại.
8. Tạo `WorkflowRequestSteps` + `WorkflowRequestStepParticipants`.
9. `Status = Submitted`, `CurrentStepOrder` = `StepOrder` nhỏ nhất; bước đó `Status = Current`, các
   bước sau `Waiting`.
10. Ghi `WorkflowRequestHistories` với `Action = Submit`, `StepOrder = 0`.

### 5.2 Chọn nhánh theo điều kiện

Đọc `FormDefinitions.RouteConditionType`:

| Kiểu | Cách chọn |
|---|---|
| `None` | lấy nhánh duy nhất |
| `NumericRange` | đọc `DataJson[RouteNumericFieldKey]` → tìm nhánh có `MinValue <= v < MaxValue` |
| `ClassValue` | đọc `DataJson[RouteClassFieldKey]` → tìm nhánh có `ClassValue` khớp |
| `Both` | phải khớp **cả hai** |

Xét theo `SortOrder` tăng dần, lấy nhánh **đầu tiên** khớp. Không khớp gì → lấy nhánh `IsDefault`.
Không có nhánh mặc định → **chặn nộp**, báo lỗi cấu hình form.

Ghi lại giá trị đã dùng vào `RouteConditionSnapshot` để về sau tra được vì sao đơn đi nhánh đó.

### 5.3 Điều kiện ẩn/hiện field

Đánh giá theo `TargetFieldId`:
- Gom các `FormFieldConditions` cùng `TargetFieldId`, nhóm theo `LogicGroup`.
- Trong cùng `LogicGroup` → ghép **AND**. Giữa các group → ghép **OR**.
- Ô hiện khi: `DefaultVisible = 1` và không có điều kiện `Hide` nào khớp; **hoặc** `DefaultVisible = 0`
  và có điều kiện `Show` khớp.
- Điều kiện `Require` khớp → ô thành bắt buộc dù `FormFields.IsRequired = 0`.
- Điều kiện `ReadOnly` khớp → ô khoá.

**BE phải đánh giá lại toàn bộ khi nộp** — không tin FE. FE chỉ làm UX.

**Chặn vòng lặp lúc lưu cấu hình:** dựng đồ thị `SourceFieldId → TargetFieldId`, phát hiện chu trình
thì `DomainException`.

### 5.4 Cấp số

Dùng `WorkflowSequences`, khóa `(SequenceKey, Year)`:
- `RequestCode`: `SequenceKey = FormDefinitions.CodePrefix`.
- `AutoNumberPattern`: `SequenceKey` = tiền tố lấy từ chính pattern.

Placeholder hỗ trợ: `{YYYY}`, `{YY}`, `{MM}`, `{SEQ:n}` (n = số chữ số, đệm 0).

**Bắt buộc:** tăng `LastSequence` trong transaction có **khóa dòng**
(`UPDLOCK, HOLDLOCK` hoặc mức cô lập `SERIALIZABLE`). Không có khóa thì hai người nộp cùng lúc sẽ
trùng số. Đây là lỗi đã biết trước, đừng để xảy ra rồi mới sửa.

### 5.5 Resolve người duyệt

Cho mỗi `FormApprovalSteps` của nhánh đã chọn:

1. **Xác định node**:
   - `OrgUnitScope = Fixed` → dùng `OrgUnitId` của bước.
   - `OrgUnitScope = ApplicantUnit` → dùng `WorkflowRequests.CreatedByOrgUnitId`.
2. **Với mỗi `FormApprovalStepParticipants`**:
   - `ParticipantSource = Employee` → chính `EmployeeId` đó.
   - `ParticipantSource = JobTitle` → tìm trong `EmployeeOrgUnits` người đang giữ `JobTitleId` đó tại
     node vừa xác định, **còn hiệu lực theo `ValidFrom`/`ValidTo`**, `IsActive = 1`, `IsDeleted = 0`.
     Lấy **1 người đầu tiên tìm được** (`FirstOrDefault`) — chỉ cho kết quả xác định nếu
     `JobTitles.IsUniquePerOrgUnit = true` (đúng như tên chức danh này ngụ ý). Vì vậy
     `FormDefinitionService.ReplaceRoutesAsync` **chặn cấu hình** `ParticipantRole = Approver` với
     chức danh có `IsUniquePerOrgUnit = false` ngay từ lúc lưu route (§3.1, §10) — không đợi đến lúc
     nộp đơn mới phát hiện resolve ra người "bất kỳ".
3. **Chặn nộp nếu**:
   - Một bước không resolve ra **Approver** nào, hoặc
   - Approver resolve ra có `Employee.UserId IS NULL`.

Viewer thiếu người thì **không chặn** — chỉ ghi cảnh báo.

### 5.6 Duyệt, ủy quyền, trả về

**Ai được bấm duyệt bước hiện tại:**
- Có dòng trong `WorkflowRequestStepParticipants` với `ParticipantRole = Approver`, **hoặc**
- Là `DelegateEmployeeId` của một `ApprovalDelegations` còn hiệu lực (`FromDate <= now <= ToDate`,
  `FormDefinitionId` NULL hoặc khớp) mà `DelegatorEmployeeId` nằm trong danh sách Approver của bước.
  Khi đó ghi `OnBehalfOfEmployeeId = DelegatorEmployeeId` vào history.

**`ApproverMode`:**
- `Any` → một người bấm là bước xong.
- `All` → ghi `ActedAt` cho từng người; bước xong khi **mọi** Approver đã bấm.

**Từ chối** → `Status = Rejected`, đơn dừng hẳn.

**Trả về sửa (差戻し)** — chỉ khi `AllowSendBackSnapshot = 1`:
- Người duyệt chọn đích trả về → ghi `SentBackToStepOrder`.
- `Status = SentBack`, `CurrentStepOrder` = đích đó (0 = trả về người nộp).
- Các bước từ đích trở đi quay về `Waiting`.
- Chủ đơn sửa lại `DataJson` qua `PUT /{id}` (UpdateDraftAsync — nhận cả `Draft` lẫn `SentBack`), rồi
  **Nộp lại** qua `POST /{id}/resubmit` (`ResubmitAsync`, `Action = Resubmit`): bước ở `CurrentStepOrder`
  (0 → lấy `StepOrder` nhỏ nhất) chuyển lại `Current`, `Status = InProgress`. Nộp lại **KHÔNG** resolve
  lại người duyệt — giữ nguyên snapshot `WorkflowRequestSteps`/`Participants` cũ. Trước khi có
  `ResubmitAsync` (bổ sung 2026-09-29), đơn `SentBack` không có đường quay lại luồng duyệt (chỉ Cancel
  được) — xem §10.

**Thêm người duyệt giữa chừng** — chỉ khi `AllowAddApprover = 1`:
- Chèn `WorkflowRequestSteps` mới với `IsAdHoc = 1`, `InsertedByEmployeeId` = người chèn.
- Đánh lại `StepOrder` các bước phía sau trong cùng transaction.
- Ghi history `Action = AddApprover`.

### 5.6a Duyệt đủ cấp tổ chức khi cấu hình route (chốt 2026-08-29)

Người dùng phản ánh: nếu cấu hình 1 bước duyệt là Tổng giám đốc thì đơn phải được duyệt tuần tự từ
cấp thấp (vd Team Leader) lên tới Tổng giám đốc, không phải chỉ mỗi Tổng giám đốc duyệt là xong; chỉ
định chức cao nhất duyệt thì các chức thấp hơn cũng phải duyệt.

**KHÔNG lật lại §1.6** (đã chốt "ĐỪNG LẬT LẠI" — bỏ kiểu duyệt tự leo cấp trên vì Attendance từng gặp
lỗi bắc cầu sinh quá nhiều bước). Thay vào đó đây là 1 luật **validate lúc LƯU cấu hình route**
(`FormDefinitionService.ReplaceRoutesAsync`), **không đụng** `ResolveStepParticipantsAsync` (§5.5) —
runtime nộp/duyệt đơn không đổi gì.

- Chỉ xét bước `OrgUnitScope = Fixed` (có `OrgUnitId` cụ thể ngay lúc thiết kế). Bước `ApplicantUnit`
  không có đơn vị xác định trước khi nộp đơn nên không tham gia luật này.
- Cấp bậc xác định theo **cây tổ chức thật** (`OrgUnits.ParentId` + `OrgLevels.LevelNumber`), KHÔNG
  dùng `JobTitles.RankOrder` (đã chốt chỉ để hiển thị/sắp xếp, §3.1).
- Route có ≥ 2 bước Fixed nằm trên CÙNG 1 nhánh cha-con của cây tổ chức (đi ngược `ParentId` từ đơn vị
  sâu nhất) → **bắt buộc đủ bước** cho mọi đơn vị tổ tiên nằm giữa 2 đầu, và **thứ tự bước phải tăng
  dần** từ đơn vị sâu (cấp thấp) lên đơn vị cao — thiếu cấp hoặc sai thứ tự → chặn lưu
  (`DomainException`, nêu rõ tên đơn vị/route). 2 bước Fixed không có quan hệ tổ tiên-con cháu (vd 2
  phòng ban duyệt song song) không bị chặn — không phải lỗi cấu hình.
- Cài trong `GuardOrgLevelChainAsync` (private method mới, `FormDefinitionService.cs`), gọi ngay sau
  vòng lặp `GuardStepAsync` hiện có trong `ReplaceRoutesAsync`.
- **FE trợ giúp** (không bắt buộc dùng): nút "Điền chuỗi duyệt đủ cấp" ở `RouteCard.tsx` — chọn "Từ
  đơn vị"/"Đến đơn vị", tự động thêm 1 bước Fixed cho mỗi đơn vị tổ tiên còn thiếu trên đúng nhánh cây
  tổ chức (dùng lại `OrgLevelApi.getJobTitleSuggestions` đã có sẵn để pre-select chức danh gợi ý theo
  từng cấp) — người dùng vẫn sửa/xoá tự do trước khi Lưu. FE không lặp lại thuật toán validate phức
  tạp này (mirror cách `BuildNumericRangeWarning` cũng chỉ tính ở BE) — lỗi hiện qua toast khi Lưu.
- Đã kiểm tra dữ liệu sống (`YevWorkflowManagement`) trước khi triển khai: **không có route nào hiện
  có ≥ 2 bước Fixed**, nên luật mới không phá cấu hình cũ nào đang có.

### 5.7 In phiếu (chốt 2026-08-20, sửa 2026-09-05 — thêm chế độ layout Word)

**Mặc định: bản in = chính layout form trên màn hình.** Không mô phỏng biểu mẫu giấy chính thức.
**Trừ khi** form được thiết kế qua "Nhập từ Word" (§1.5) — khi đó bản in = đúng layout file `.docx`
đã nhập, snapshot trong `FormSchemaJson.layoutHtml`.

| Phần trên bản in | Nguồn |
|---|---|
| Đầu phiếu | `RequestCode`, tên form, người nộp, ngày nộp, trạng thái — luôn giống nhau ở cả 2 chế độ |
| Thân phiếu | chế độ lưới: dựng từ **`FormSchemaJson.fields`** + **`DataJson`**, theo `SortOrder`/`ColumnSpan`. Chế độ tài liệu: `FormSchemaJson.layoutHtml` (html-react-parser thay `<span data-field-key>` bằng giá trị đã điền) |
| Khối chữ ký | dựng từ `WorkflowRequestSteps` + `WorkflowRequestHistories.SignatureImage` — **không đổi ở cả 2 chế độ**, luôn là khối riêng sau thân phiếu |
| Đính kèm | danh sách tên file từ `WorkflowAttachments` |

**FE implementation** (2026-09-05): `WorkflowRequestDataView.tsx` là nơi DUY NHẤT rẽ nhánh 2 chế độ
(theo `schema.layoutHtml` có NULL hay không) — `WorkflowRequestPrintView.tsx` gọi thẳng component này
cho phần thân, không cần biết chế độ nào đang chạy. Màn điền đơn lúc Draft (trước khi có
`FormSchemaJson`) rẽ nhánh tương tự ở `WorkflowRequestDetail.tsx`, giữa `DynamicFormRenderer.tsx`
(lưới) và `DocumentFormRenderer.tsx` (tài liệu, mới) — 2 renderer dùng chung đúng 1 bản
`evaluateFlags`/`parseOptions`/`inputClassName` (export từ `DynamicFormRenderer.tsx`) để không lệch
logic điều kiện ẩn/hiện giữa 2 chế độ.

**Không cần bảng nào cho việc in.** Ba hệ quả tốt của quyết định này:

1. **Số ô chữ ký khớp số bước duyệt thật của đơn đó** — không có chuyện giấy chỉ có 4 ô mà luồng 6
   bước như OT Form phải xử lý.
2. **In lại đơn cũ tự động đúng layout cũ**, vì `FormSchemaJson` đã snapshot lúc nộp. Không cần cơ chế
   phiên bản mẫu in riêng.
3. **Không cần lập trình viên** cho từng loại đơn mới — đúng tinh thần của cả module.

**Cơ chế kỹ thuật:** `window.print()` + CSS `@media print`, giống
`yev-frontend/src/modules/attendance/components/ot-form/OtFormPrintView.tsx:680`.
**KHÔNG dùng `html2canvas`** — nó chụp DOM thành bitmap, chữ không select/tìm kiếm được và chất lượng
phụ thuộc `devicePixelRatio`. Dùng CSS print thì chữ là vector và ngắt trang là thật.

FE cần lo: `break-inside: avoid` cho từng nhóm ô và từng dòng chữ ký, `@page { size: A4; margin: … }`.

### 5.8 Quy ước `DataJson` — BẮT BUỘC theo đúng bảng này

`DataJson` là **object phẳng**, khoá = `FormFields.FieldKey`. Không lồng nhau, không mảng ở cấp gốc.

**Mọi field có trong schema đều phải có mặt trong `DataJson`.** Chưa nhập thì để `null`, KHÔNG bỏ
khoá. Nhờ vậy schema và dữ liệu luôn đối chiếu được 1-1, và biết phân biệt "chưa nhập" với
"field mới thêm sau khi đơn đã nộp".

| `FieldDataType` | Kiểu JSON | Định dạng | Ví dụ |
|---|---|---|---|
| `Text`, `TextArea` | string | | `"Mua máy in"` |
| `Number` | **number** | số nguyên | `15` |
| `Decimal` | **number** | thập phân, dấu chấm | `4500000.50` |
| `Date` | string | `yyyy-MM-dd` | `"2026-08-20"` |
| `DateTime` | string | ISO-8601 kèm offset | `"2026-08-20T14:30:00+07:00"` |
| `Time` | string | `HH:mm` | `"17:30"` |
| `Dropdown`, `Radio` | string | giá trị (không phải nhãn) | `"KHAC"` |
| `Checkbox` | boolean | | `true` |
| `MultiSelect` | array of string | | `["A","B"]` |
| `Employee` | object | snapshot 3 khoá | `{"id":42,"code":"NV0123","name":"Nguyễn Văn A"}` |
| `OrgUnit` | object | snapshot 3 khoá | `{"id":7,"code":"KT","name":"Phòng Kế toán"}` |
| `Label` | — | **không lưu** | chỉ hiển thị |

Bốn luật đi kèm, vi phạm là hỏng ngầm:

1. **`Number`/`Decimal` lưu dạng số JSON, KHÔNG lưu chuỗi.** `FormRoutes` so sánh khoảng số trực tiếp
   trên giá trị này (§5.2) — lưu chuỗi thì `"1000000" < "9"` theo thứ tự chữ cái và chọn sai nhánh.
   BE parse bằng `CultureInfo.InvariantCulture`.
2. **`Date` lưu chuỗi `yyyy-MM-dd`, KHÔNG lưu `DateTime`.** Ngày trên đơn là ngày theo lịch, không có
   giờ. Lưu `DateTime` rồi parse ở múi giờ khác sẽ lệch mất một ngày.
3. **`Dropdown`/`Radio`/`MultiSelect` lưu *giá trị*, không lưu *nhãn*.** Nhãn nằm ở `OptionsJson` và
   đã được snapshot trong `FormSchemaJson` — đổi nhãn về sau không làm sai đơn cũ.
4. **`Employee`/`OrgUnit` lưu snapshot đủ 3 khoá, do BE điền.** FE chỉ gửi `id`; BE tra ra `code` và
   `name` rồi ghi cả ba. Xem lại đơn cũ vẫn ra đúng tên tại thời điểm nộp, kể cả người đã nghỉ việc
   hoặc đổi tên. Không tin `name` FE gửi lên.

### 5.9 Index bắt buộc

Ngoài UNIQUE/PK đã nêu ở §3. Ba màn hình chính là nguồn tải nặng nhất, index dưới đây bám đúng chúng:

| Bảng | Index | Phục vụ |
|---|---|---|
| `WorkflowRequests` | `(CreatedByEmployeeId, Status, CreatedAt DESC)` | màn "Đơn của tôi" |
| `WorkflowRequests` | `(FormDefinitionId, Status)` | lọc theo loại đơn |
| `WorkflowRequestSteps` | `(Status, WorkflowRequestId)` | tìm bước đang chờ xử lý |
| `WorkflowRequestStepParticipants` | `(EmployeeId, ParticipantRole)` | màn "Chờ tôi duyệt" và "Tôi xem được" |
| `WorkflowRequestHistories` | `(WorkflowRequestId, ActionAt)` | timeline lịch sử |
| `WorkflowAttachments` | `(WorkflowRequestId)` | |
| **`EmployeeOrgUnits`** | **`(OrgUnitId, JobTitleId)`** | **resolve người duyệt theo chức danh (§5.5)** — chạy cho mọi bước, mọi lần nộp đơn |
| `EmployeeOrgUnits` | `(EmployeeId)` | tra đơn vị của một người |
| `OrgUnits` | `(ParentId)` | duyệt cây |
| `FormFields` | `(FormDefinitionId, SortOrder)` | dựng form |
| `FormFieldConditions` | `(TargetFieldId)` | đánh giá điều kiện |

### 5.10 Đặt tên trong DB

`YevWorkflowManagement` là **DB mới hoàn toàn**, KHÔNG scaffold từ hệ cũ — nên **không** áp quy ước
tên constraint tiếng Việt ở AGENTS.md §3.5 (thứ chỉ dành cho bảng kế thừa như `PK_ThietBis`).
Dùng tên tiếng Anh chuẩn EF Core: `PK_OrgUnits`, `FK_OrgUnits_OrgLevels_OrgLevelId`,
`IX_EmployeeOrgUnits_OrgUnitId_JobTitleId`.

---

## 6. API dự kiến

Route `api/Workflow/[controller]` (tiền tố `Workflow/` bắt buộc — xem §1.7), `[ApiController]`,
controller kế thừa `WorkflowBaseController`. Mọi response bọc `ApiResponse<T>`; danh sách phân trang
trả `PagedResponse<T>` (AGENTS.md §3.4).

**Đã scaffold (Pha 1):** `GET/POST/PUT/DELETE api/Workflow/OrgLevel[/{id}]` + `GET .../all`,
`GET/POST/PUT/DELETE api/Workflow/OrgUnit[/{id}]` + `GET .../tree` + `PUT .../reorder`,
`GET/POST/PUT/DELETE api/Workflow/JobTitle[/{id}]` + `GET .../all`,
`GET/POST/PUT/DELETE api/Workflow/Employee[/{id}]` + `GET/PUT .../{id}/org-units` (replace pattern).
Tất cả đứng sau `[RequirePermission("Workflow.Organization.View")]` (GET) hoặc
`"Workflow.Organization.Manage")]` (POST/PUT/DELETE).

**Đã scaffold (2026-08-27, gợi ý chức danh theo cấp):**
`GET/PUT api/Workflow/OrgLevel/{id}/job-title-suggestions` (replace pattern, cùng permission
`Workflow.Organization.View`/`Manage` như trên — không permission mới).

**Đã mở rộng (2026-08-27):** `GET api/Workflow/OrgUnit/tree` trả thêm `Members: OrgUnitTreeMemberDto[]`
mỗi node (ai đang giữ chức gì tại đơn vị đó, chỉ nhân sự còn hoạt động) — không endpoint mới, không
đổi route/permission, chỉ mở rộng response có sẵn.

**Đã scaffold (Pha 2A):**
`GET/POST/PUT/DELETE api/Workflow/FormCategory[/{id}]` + `GET .../grid-list` + `GET .../all` +
`GET/PUT .../{id}/coordinators` (replace pattern) — đứng sau `"Workflow.FormDesign.View"` (GET) /
`"Workflow.FormDesign.Manage"` (POST/PUT/DELETE/PUT coordinators).
`GET/POST/PUT/DELETE api/Workflow/FormDataSource[/{id}]` + `GET .../grid-list` + `GET .../all` —
đứng sau `"Workflow.Setting.Manage"` cho MỌI verb kể cả GET (màn admin-only, không có permission View
riêng — khác các nhóm khác). `SourceKind = SqlQuery` bị `CreateAsync`/`UpdateAsync` từ chối
(`DomainException`) cho tới khi chốt cơ chế bảo mật ở §3.2.

**Đã scaffold (Pha 2B):**
`GET/POST/PUT/DELETE api/Workflow/FormDefinition[/{id}]` + `GET .../grid-list` — đứng sau
`"Workflow.FormDesign.View"` (GET) / `"Workflow.FormDesign.Manage"` (POST/PUT/DELETE).
`CreatedByEmployeeId`/`UpdatedByEmployeeId` do Service tự resolve từ `WorkflowBaseController.
CurrentUserId` (claim JWT `"UserId"`, xem hộp trạng thái đầu file) — **không** nhận qua body. `POST`
ném `DomainException` nếu tài khoản hiện tại chưa liên kết Employee nào. `RouteConditionType` chỉ
nhận lúc `POST`, không có trong `PUT` (bất biến). `PUT`/`POST` đều validate: `RouteConditionType`
cần `RouteNumericFieldKey`/`RouteClassFieldKey` tương ứng thì 2 field đó không được rỗng (chỉ validate
"có nhập hay chưa", chưa xác thực trỏ đúng `FieldKey` thật — vẫn CHƯA nâng cấp lên dù `FormFields` đã
có ở Pha 2C, để dành đợt sau vì form lúc `POST` chưa có field nào). `DELETE` chặn nếu `IsPublished = true`.

**Đã scaffold (Pha 2C):**
`GET/PUT api/Workflow/FormDefinition/{id}/fields`, `GET/PUT api/Workflow/FormDefinition/{id}/conditions`
— cùng permission `Workflow.FormDesign.View/Manage` như trên. `PUT .../fields` **merge theo Id/FieldKey,
KHÔNG xoá-tất-tạo-lại** (khác mọi pattern "replace" khác trong module) — lý do và chi tiết thuật toán
nằm trong comment ngay tại `FormDefinitionService.ReplaceFieldsAsync`, ĐỪNG đổi thành xoá-tất-tạo-lại
dù có vẻ đơn giản hơn, sẽ làm gãy tham chiếu của `FormFieldConditions.SourceFieldId`/`TargetFieldId`.
`PUT .../conditions` xoá-tất-tạo-lại bình thường (không bảng nào tham chiếu ngược `FormFieldConditions.Id`),
nhưng validate: field thuộc đúng form, `Target ≠ Source`, giá trị so sánh đủ theo `Operator`, và
**chặn vòng lặp** bằng DFS 3 màu trên đồ thị `SourceFieldId → TargetFieldId` dựng từ toàn bộ danh
sách gửi lên trong 1 lượt lưu (không chỉ từng cặp riêng lẻ).

**Đã scaffold (2026-09-05, §1.5):** `PUT api/Workflow/FormDefinition/{id}/layout` — set thẳng
`LayoutHtml` (opaque, không validate nội dung), cùng permission `Workflow.FormDesign.Manage`.
`GetByIdAsync`/`CloneAsync` trả/copy kèm `LayoutHtml`. `GET .../form-schema/{formDefinitionId}`
(§6, Pha 3B-2, phục vụ điền Draft) cũng trả kèm `LayoutHtml` sống.

**Đã scaffold (Pha 2D):**
`GET/PUT api/Workflow/FormDefinition/{id}/accesses`, `POST api/Workflow/FormDefinition/{id}/publish`,
`POST api/Workflow/FormDefinition/{id}/clone` — cùng permission `Workflow.FormDesign.View/Manage`.
`PUT .../accesses` xoá-tất-tạo-lại (không bảng nào tham chiếu ngược `FormAccesses.Id`, khác hẳn pattern
merge-theo-Id của `fields`), validate đúng 1 trong 3 cột đích (`RoleId`/`OrgUnitId`/`EmployeeId`) khớp
`TargetType`, 2 cột còn lại NULL. `RoleId` là cross-DB (`Identity.Roles`, §1.4) nên BE không resolve
được tên — FE tự ánh xạ bằng `AuthApi.getAllRoles()`.
`POST .../publish`: chặn nếu form chưa có `FormFields` nào **hoặc chưa có `FormRoutes` nào** (bổ sung
2026-09-29 — trước đó chỉ chặn thiếu field, form có thể publish mà chưa cấu hình nhánh duyệt, khiến
`SubmitAsync.SelectRoute` chỉ ném lỗi ở phía người dùng cuối lúc nộp đơn thật, xem §10); **`Version`
chỉ tăng khi publish LẠI** (form đã `IsPublished=true` từ trước) — lần publish đầu tiên giữ nguyên
`Version=1` mặc định, đúng nghĩa "tăng mỗi lần publish lại" ở §3.2. Không có endpoint unpublish trong
roadmap.
`POST .../clone`: tạo 1 `FormDefinition` mới (Code/NameVn/NameJp do người gọi truyền vào, còn lại kế
thừa nguyên từ form gốc), sao chép toàn bộ `FormFields` (Id mới) + `FormFieldConditions` (remap qua
`FieldKey`) + **`FormRoutes`/`FormApprovalSteps`/`FormApprovalStepParticipants`** (bổ sung 2026-09-29 —
trước đó bị bỏ sót, form nhân bản trông đầy đủ nhưng publish xong không đơn nào duyệt được, xem §10),
**KHÔNG sao chép `FormAccesses`** — ai tạo đơn được là quyết định riêng cho từng form, phải cấu hình
tay lại (cùng nguyên tắc "chỉ định tay, không suy ra" của `FormCategoryCoordinators`).
Form mới luôn `IsPublished=false`, `Version=1`.

**Đã scaffold (Pha 3A):**
`GET/PUT api/Workflow/FormDefinition/{id}/routes` — cùng permission `Workflow.FormDesign.View/Manage`.
`PUT .../routes` thay NGUYÊN cả cây nhánh+bước+người trong 1 lượt (đúng nghĩa đen câu chữ ở bảng
"Nhóm" bên dưới). **`FormRoutes` merge theo Id** (mirror `FormFields` ở Pha 2C — `WorkflowRequests.
FormRouteId`, Pha 3B, sẽ là FK thật Restrict trỏ vào đây) nhưng **`FormApprovalSteps`/
`FormApprovalStepParticipants` luôn xoá-tất-tạo-lại** mỗi lần lưu route (không bảng nào tham chiếu Id
của chúng — `WorkflowRequestSteps` ở Pha 3B chỉ snapshot GIÁ TRỊ, không FK ngược). `SortOrder`/
`StepOrder` do BE tự gán theo vị trí mảng gửi lên, không tin FE. Validate theo `FormDefinitions.
RouteConditionType`: `None` bắt buộc đúng 1 route và phải `IsDefault`; mọi kiểu tối đa 1 `IsDefault`
trong 1 lượt lưu (KHÔNG bắt buộc phải CÓ `IsDefault` — đó là luật lúc NỘP đơn ở Pha 3B, không phải
điều kiện để lưu cấu hình); **nhánh `IsDefault=true` được MIỄN** yêu cầu Min/Max/ClassValue (nhánh dự
phòng không cần tự có điều kiện riêng — lỗi này bị bắt lúc test HTTP, xem §10). Guard tự thêm: mỗi
route ≥1 step, mỗi step ≥1 participant `ParticipantRole=Approver`. Cảnh báo (KHÔNG chặn lưu) khi
khoảng số `NumericRange` chồng nhau/để hở — nối vào `message` của response thành công.
Đọc nested tree (routes→steps→participants) dùng projection `.Select()` lồng nhau ngay trong
`ToListAsync<TResult>`, KHÔNG cần `ThenInclude` (repo generic chỉ hỗ trợ `Include` 1 cấp).

**Đã scaffold (Pha 3B-1):**
`POST/PUT/GET api/Workflow/WorkflowRequest[/{id}]` (Draft), `GET .../my-requests` `.../pending-my-approval`
`.../visible-to-me`, `POST .../{id}/submit` `.../cancel` `.../approve` `.../reject` `.../send-back`
`.../resubmit` `.../add-approver` — TẤT CẢ đứng sau đúng 1 permission `Workflow.Request.Create` (§7 "permission thô,
luật chi tiết là dữ liệu"; `Workflow.Request.ViewAll` chỉ đọc thẳng bằng `User.HasClaim("Permission",
"Workflow.Request.ViewAll")` trong Controller để mở rộng phạm vi xem, không gate riêng action nào).
`GET/POST/PUT/DELETE api/Workflow/ApprovalDelegation[/{id}]` — cùng permission, `DelegatorEmployeeId`
luôn resolve = người gọi (không nhận qua body, tránh impersonation).

`SubmitAsync` theo đúng 10 bước §5.1, bọc trong 1 `BeginTransactionAsync`/`CommitTransactionAsync` tường
minh (lần đầu tiên module Workflow dùng transaction tường minh — trước giờ mọi Service chỉ dựa vào 1
`SaveChangesAsync()` làm ranh giới ngầm). `RequestCode` sinh atomic bằng `WorkflowSequenceRepository.
GetNextSequenceAsync` — raw SQL `MERGE ... WITH (HOLDLOCK) ... OUTPUT INSERTED.LastSequence` chạy chung
connection/transaction với `DbContext` qua `Database.SqlQuery<int>()` (EF Core 8+), format
`"{CodePrefix}-{Year}-{Sequence:0000}"`. Test 5 lượt submit song song (PowerShell `Start-Job`) ra đúng
5 mã liên tiếp không trùng.

**Lệch số `WorkflowRequestSteps.StepOrder` so với `FormApprovalSteps.StepOrder` cấu hình gốc: +1.**
`FormApprovalSteps.StepOrder` đánh số từ 0 (Pha 3A), nhưng `0` ở tầng `WorkflowRequests` mang nghĩa
riêng ("chưa vào luồng duyệt" / đích `SendBack` = "trả về người nộp", §5.1 §5.6) — nếu giữ nguyên số
0-based thì bước duyệt ĐẦU TIÊN sẽ trùng giá trị sentinel đó. `SubmitAsync` snapshot
`WorkflowRequestStep.StepOrder = FormApprovalStep.StepOrder + 1` để tách bạch, xem comment tại
`WorkflowRequestStep.cs`.

**`WorkflowRequestSteps.AllowAddApproverSnapshot` KHÔNG có trong bảng cột liệt kê ở §3.3** (chỉ ghi
`AllowSendBackSnapshot`) — phát hiện lúc code Pha 3B-1: `AllowAddApprover` chi phối §5.6 y hệt
`AllowSendBack` nhưng `WorkflowRequestStep` không giữ FK ngược về `FormApprovalStep` gốc để tra lại sau
khi đã submit, nên PHẢI snapshot thêm cột này (mirror `AllowSendBackSnapshot`) — bổ sung vào entity +
migration, không đợi sửa lại §3.3 (coi là lỗi thiếu sót nhỏ trong bảng liệt kê, không phải quyết định
nghiệp vụ mới).

**Resolve người duyệt** (`ResolveStepParticipantsAsync`, §5.5) dùng trực tiếp `EmployeeOrgUnits` khi
`ParticipantSource=JobTitle` (lọc còn hiệu lực theo `ValidFrom`/`ValidTo`, `IsActive`, `!IsDeleted`),
chặn nộp nếu bước không ra được Approver có `UserId` khác NULL. **Đánh giá điều kiện ẩn/hiện/bắt buộc**
(`EvaluateConditions`, §5.3) đánh giá lại toàn bộ ở Service (không tin FE), tách riêng theo từng
`ConditionEffect` (Show/Hide/Require/ReadOnly kích hoạt độc lập), mỗi effect nhóm theo `LogicGroup`
(AND trong group, OR giữa group). **`DataJson` chuẩn hoá** theo đúng bảng kiểu §5.8: `Employee`/`OrgUnit`
BE tự tra lại `code`/`name` theo `id` client gửi, bỏ qua mọi `code`/`name` FE gửi kèm.

**Duyệt thay (`ApprovalDelegations`, §5.6)** — bug tự bắt được lúc test HTTP: người gọi VỪA là Approver
trực tiếp của bước VỪA là Delegate hợp lệ cho người khác cùng bước thì hệ thống không tự phân biệt được
"duyệt với tư cách ai" nếu chỉ nhìn `CurrentUserId` — gọi `Approve` lần 2 để duyệt thay bị hiểu nhầm
thành duyệt lại chính mình, báo lỗi "đã duyệt rồi". Fix: thêm `OnBehalfOfEmployeeId` (nullable) vào
`ApproveRequestDto`/`RejectRequestDto`/`SendBackRequestDto`/`AddApproverRequestDto` — để trống thì ưu
tiên hành động với tư cách bản thân nếu là Approver trực tiếp (hành vi cũ), có chỉ định thì bắt buộc
tìm đúng ủy quyền từ người đó. **Bug thứ 2 tự bắt được**: `CancelAsync` ban đầu không đổi `Status` của
`WorkflowRequestStep` đang `Current`, khiến đơn đã hủy vẫn hiện trong `GET .../pending-my-approval` —
fix bằng cách chuyển bước đó sang `StepStatus.Skipped` khi hủy.

**Guard đã bổ sung đúng vị trí `// TODO Pha 3B` đánh dấu từ Pha 3A**: `FormDefinitionService.
ReplaceRoutesAsync` giờ chặn xoá 1 `FormRoute` nếu đang có `WorkflowRequests.FormRouteId` tham chiếu —
test HTTP xác nhận chặn đúng.

**Đã scaffold (Pha 3B-2):** FE nộp/duyệt đơn (`modules/workflow/components/requests/`) +
**3 endpoint BE nhỏ bổ sung** trên `WorkflowRequestController` (cùng permission
`Workflow.Request.Create`, KHÔNG migration vì chỉ đọc) — lý do: người nộp đơn thường thường KHÔNG có
`Workflow.FormDesign.View` (chỉ người thiết kế form) nên không đọc được `FormDefinition/grid-list` hay
`FormDefinition/{id}/fields|conditions`, và JWT không mang `Employee.Id`:
- `GET .../available-forms` — danh sách `FormDefinition` đã publish + người gọi có `FormAccesses`
  (tách `GuardFormAccessAsync` cũ thành `HasFormAccessAsync` trả `bool`, dùng lại ở cả 2 nơi).
- `GET .../form-schema/{formDefinitionId}` — field/condition SỐNG (khác `FormSchemaJson` đã snapshot)
  để dựng màn điền đơn lúc còn Draft, cùng guard publish + `FormAccesses`.
- `GET .../my-employee` — `{id, employeeCode, fullName}` của người đang đăng nhập, FE dùng để biết
  "dòng participant nào là tôi" và lọc đúng chiều `ApprovalDelegations` (`GetMineAsync` trả cả 2 chiều
  Delegator/Delegate, không phân biệt).

**Bug tự bắt được lúc rà lại code (không phải lúc test HTTP lần này, phát hiện khi đối chiếu response
thật với kiểu FE)**: `WorkflowRequestService.BuildFormSchemaJson` gọi `JsonSerializer.Serialize(snapshot)`
KHÔNG kèm `PropertyNamingPolicy = CamelCase` — toàn bộ response khác của hệ thống mặc định camelCase
(ASP.NET Core default, không cấu hình `AddJsonOptions` riêng ở `Program.cs`), nhưng `FormSchemaJson`
serialize thủ công (không qua pipeline response) nên lộ PascalCase (`FieldKey`/`LabelVn`/...) — khác hẳn
phần còn lại của `WorkflowRequestDto`. Sửa bằng 1 `JsonSerializerOptions` static dùng lại. Test HTTP xác
nhận sau khi sửa: submit đơn thật rồi đọc lại `formSchemaJson` ra đúng camelCase
(`fieldKey`/`labelVn`/`dataType`/...).

**`WorkflowRequestHistoryDto` bổ sung `SignatureImageBase64`** (byte[] ⇄ base64, AGENTS.md §4.4) —
trước đó cột `SignatureImage` có trong Entity/DB (§3.3) nhưng chưa từng được chiếu ra DTO nào, nên bản
in (§5.7 "khối chữ ký dựng từ ... `WorkflowRequestHistories.SignatureImage`") không có gì để hiển thị.
Bổ sung field + set giá trị trong `BuildDtoAsync`.

**FE**: `DynamicFormRenderer.tsx` (dựng form từ `FormFieldDto[]` sống, đánh giá điều kiện client-side
CHỈ để UX — mirror chính xác thuật toán `EvaluateConditions`/`EvaluateSingleCondition` ở BE, BE luôn
đánh giá lại lúc nộp) dùng cho màn điền Draft; `WorkflowRequestDataView.tsx` (hiển thị tĩnh từ
`FormSchemaJson` snapshot + `DataJson`, KHÔNG cần đánh giá lại điều kiện vì field bị ẩn lúc nộp đã có
giá trị `null` sẵn) dùng cho xem đơn đã nộp lẫn bản in. `WorkflowRequestPrintView.tsx`: `window.print()`
+ CSS `@media print`/`@page`, KHÔNG `html2canvas` (đúng chốt §5.7 — mirror cơ chế của
`OtFormPrintView.tsx` nhưng KHÔNG mirror phần mô phỏng ảnh nền biểu mẫu giấy, vì Workflow chủ động chọn
hướng ngược lại). Chữ ký lúc duyệt: `SignatureUpload.tsx` (upload file ảnh → base64, KHÔNG canvas vẽ
tay) mirror y hệt `modules/attendance/components/signature/SignatureUpload.tsx`, tạo bản riêng trong
`modules/workflow` (không import chéo module). Trang "Chọn `OnBehalfOfEmployeeId`" tính hoàn toàn ở FE
từ `ApprovalDelegationApi.getMine()` + `WorkflowRequestApi.getMyEmployee()`, không cần thêm endpoint
BE nào khác. Nút Duyệt/Từ chối/Trả về/Thêm người duyệt LUÔN hiện khi đơn đang ở bước chờ duyệt (không
tính trước phía FE xem đúng lượt hay không) — BE tự chặn và trả lỗi tiếng Việt rõ ràng qua toast nếu
bấm nhầm, tránh logic trùng lặp không cần thiết ở FE.

| Nhóm | Endpoint chính |
|---|---|
| Tổ chức | `OrgLevel`, `OrgUnit` (+ `GET /tree`, `PUT /reorder`), `JobTitle` — CRUD |
| Nhân sự | `Employee` CRUD + `GET /{id}/org-units`, `PUT /{id}/org-units` (replace) |
| Thư mục form | `FormCategory` CRUD + `PUT /{id}/coordinators` (replace) |
| Thiết kế form | `FormDefinition` CRUD + `POST /{id}/publish`, `POST /{id}/clone` |
| | `PUT /FormDefinition/{id}/fields` (replace cả danh sách) |
| | `PUT /FormDefinition/{id}/conditions` (replace) |
| | `PUT /FormDefinition/{id}/accesses` (replace) |
| | `PUT /FormDefinition/{id}/routes` (replace cả nhánh + bước + người) |
| Nguồn dữ liệu | `FormDataSource` CRUD + `GET /{id}/preview` (giới hạn N dòng) |
| Đơn | `POST /WorkflowRequest` (Draft) · `PUT /{id}` · `POST /{id}/submit` · `POST /{id}/cancel` |
| | `POST /{id}/approve` · `POST /{id}/reject` · `POST /{id}/send-back` · `POST /{id}/resubmit` · `POST /{id}/add-approver` |
| | `GET /WorkflowRequest/my-requests` · `/pending-my-approval` · `/visible-to-me` |
| | `GET /WorkflowRequest/{id}` (kèm steps + participants + histories cho màn xem & in) |
| | `GET /WorkflowRequest/available-forms` · `/form-schema/{formDefinitionId}` · `/my-employee` (Pha 3B-2, phục vụ FE) |
| Đính kèm | `POST /WorkflowRequest/{id}/attachments` · `DELETE /attachments/{id}` · `GET /attachments/{id}/download` |
| Chữ ký | `GET /EmployeeSignature/me` · `PUT /EmployeeSignature/me` (chỉ gửi email xác nhận, không áp dụng ngay) |
| | `GET /EmployeeSignature/confirm/{token}` · `POST /EmployeeSignature/confirm/{token}` (`[AllowAnonymous]`) |
| Ủy quyền | `ApprovalDelegation` CRUD |
| Email | `GET /WorkflowApproval/by-token/{token}` · `POST /WorkflowApproval/by-token/{token}/approve` · `POST /WorkflowApproval/by-token/{token}/reject` (`[AllowAnonymous]`, controller riêng `WorkflowApprovalController`) |
| Cấu hình | `GET /WorkflowSetting` · `PUT /WorkflowSetting` |

**Pattern "replace nguyên danh sách"** dùng cho mọi cấu hình con (fields, conditions, accesses,
routes, coordinators, org-units của nhân viên) — mirror `IDepartmentApprovalStepService.ReplaceAsync`
của Attendance. Không làm Create/Update/Delete từng dòng: designer kéo-thả vốn gửi cả danh sách.

---

## 7. Phân quyền

Theo hướng đã chốt (`project_authz_architecture_direction`): **permission thô ở Identity, luật chi
tiết là dữ liệu trong DB của module.**

**Permission cần seed vào Identity** (giữ ít):

```
Workflow.Organization.View / Manage      — cây tổ chức, chức danh, nhân sự
Workflow.FormDesign.View / Manage        — thiết kế form (ai được thiết kế THƯ MỤC NÀO
                                            do FormCategoryCoordinators quyết)
Workflow.Request.Create                  — tạo đơn (form NÀO do FormAccesses quyết)
Workflow.Request.ViewAll                 — xem mọi đơn toàn công ty (dành cho HR/Admin)
Workflow.Setting.Manage                  — WorkflowSettings, FormDataSources
Workflow.Signature.Update                — đăng ký/cập nhật chữ ký điện tử của CHÍNH mình
                                            (Pha 4; 2 action "confirm" [AllowAnonymous], không cần quyền)
```

**Luật chi tiết là dữ liệu, không phải permission:**

| Câu hỏi | Trả lời bởi |
|---|---|
| Ai thiết kế được form của phòng X? | `FormCategoryCoordinators` |
| Ai tạo được đơn loại Y? | `FormAccesses` |
| Ai duyệt được bước Z của đơn này? | `WorkflowRequestStepParticipants` + `ApprovalDelegations` |
| Ai xem được đơn này? | người tạo, participants (kể cả Viewer), hoặc có `Request.ViewAll` |

`[RequirePermission]` chỉ đọc claim trong JWT nên **Service vẫn phải tự enforce** 4 luật trên.

---

## 8. Lộ trình

Nguyên tắc: mỗi pha tự chạy được và có giá trị sử dụng, không phải nửa hệ thống chờ pha sau.

| Pha | Nội dung | Bảng |
|---|---|---|
| **0** | Tài liệu này. Chưa code. | — |
| **1** | ✅ **Xong BE+FE** (2026-08-24): Entity + DbContext + Repository/UnitOfWork + Service + Controller CRUD + màn quản trị cây kéo-thả FE, migration đã chạy, permission đã seed, test qua HTTP + UI thật đều pass. | `OrgLevels` `OrgUnits` `JobTitles` `Employees` `EmployeeOrgUnits` |
| **2A** | ✅ **Xong BE+FE** (2026-08-25): Danh mục form (+ người phụ trách thiết kế, replace pattern) và nguồn dữ liệu built-in (Employees/OrgUnits/JobTitles — `SqlQuery` bị chặn tới khi chốt bảo mật). Entity/Service/Controller/FE đều xong, test qua HTTP pass. | `FormCategories` `FormCategoryCoordinators` `FormDataSources` |
| **2B** | ✅ **Xong BE+FE** (2026-08-25): Khung thông tin form (mã, tên, danh mục, mô tả, cờ đính kèm, CodePrefix, RouteConditionType). **Chưa có field designer** — form tạo ra chưa có ô nhập nào. Kèm theo: thêm claim `UserId` vào JWT toàn hệ thống để resolve `CreatedByEmployeeId`/`UpdatedByEmployeeId` (xem hộp trạng thái đầu file). | `FormDefinitions` |
| **2C** | ✅ **Xong BE+FE** (2026-08-25): Field designer kéo-thả thật (kéo từ bảng chọn kiểu ô thả vào canvas, dùng `@dnd-kit`) + điều kiện ẩn/hiện/bắt buộc. Route mới `workflow/form-definitions/detail?id=` (query string, không dùng `[id]` động — static export). | `FormFields` `FormFieldConditions` |
| **2D** | ✅ **Xong BE+FE** (2026-08-25): `FormAccesses` (ai tạo đơn được — theo Role/Đơn vị/Nhân sự, xoá-tất-tạo-lại) + `POST /publish` (chặn nếu chưa có field, Version chỉ tăng khi publish lại) + `POST /clone` (sao chép FormFields+FormFieldConditions, KHÔNG kèm FormAccesses). **Pha 2 hoàn tất** — form đủ điều kiện publish và gán quyền, chỉ còn thiếu luồng duyệt (Pha 3) để tạo `WorkflowRequest` thật. | `FormAccesses` |
| **3A** | ✅ **Xong BE+FE** (2026-08-25): Cấu hình luồng duyệt — nhánh rẽ (`FormRoutes`) + bước duyệt (`FormApprovalSteps`) + người duyệt (`FormApprovalStepParticipants`). Thuần CRUD/validate, **CHƯA nộp đơn được**. | `FormRoutes` `FormApprovalSteps` `FormApprovalStepParticipants` |
| **3B-1** | ✅ **Xong BE, CHƯA có FE** (2026-08-25): Engine nộp/duyệt đơn thật — Draft → sửa → nộp (chọn nhánh, resolve người duyệt, cấp số atomic, snapshot schema) → duyệt/từ chối/trả về/thêm người duyệt/hủy/ủy quyền duyệt thay (§5.1, §5.5, §5.6). Test qua HTTP đầy đủ (không có màn hình). | `WorkflowRequests` `WorkflowRequestSteps` `WorkflowRequestStepParticipants` `WorkflowRequestHistories` `WorkflowSequences` `ApprovalDelegations` |
| **3B-2** | ✅ **Xong BE+FE** (2026-08-26): FE form render động để nộp đơn (dựng từ `FormFieldDto` sống lúc Draft, đánh giá điều kiện ẩn/hiện client-side) + "Đơn của tôi"/"Chờ tôi duyệt"/"Tất cả" + màn xem/duyệt/in đơn + quản lý ủy quyền duyệt thay. Kèm 3 endpoint BE nhỏ đọc (`available-forms`/`form-schema`/`my-employee`), không migration. | không thêm bảng |
| **4A** | ✅ **Xong BE+FE** (2026-08-26): Chữ ký đăng ký sẵn — tự điền lúc duyệt đơn thay vì tải ảnh lên mỗi lần. Cập nhật qua email xác nhận (mirror `Attendance.UserSignature`). | `EmployeeSignatures` `PendingEmployeeSignatureConfirmations` (bảng mới, ngoài 25 bảng gốc) |
| **4B** | ✅ **Xong BE+FE** (2026-08-26): Đính kèm file — upload/xoá/tải xuống, file nằm trên đĩa (KHÔNG lưu byte[] trong DB). `WorkflowSettings` giới hạn dung lượng/số lượng/đuôi file (giá trị mặc định seed sẵn, sửa được ở màn "Cấu hình"). Chủ đơn thêm/xoá xuyên suốt tới khi đơn kết thúc (không giới hạn ở Draft). `RequireAttachment=true` chặn nộp đơn nếu chưa có file nào. | `WorkflowAttachments` `WorkflowSettings` |
| **4C** | ✅ **Xong BE+FE** (2026-08-27): Duyệt qua email — trang public `/xac-nhan-don-quy-trinh` không cần đăng nhập, chỉ hỗ trợ Duyệt/Từ chối (không SendBack/AddApprover qua email). Token gửi khi 1 bước chuyển Current (lúc Submit + lúc Approve sang bước kế), hạn dùng đọc từ `WorkflowSettings.EmailTokenExpiryDays`. | `WorkflowRequestEmailTokens` |
| **4D** | ❌ **Không làm** (quyết định 2026-08-27) — Xuất Excel danh sách đơn. Xem lý do ở §9. | — |
| **5** | Gộp nền với Attendance — **chỉ khi đạt tiêu chí §1.3** | không thêm bảng |

**Pha 4 hoàn tất (4A–4C xong, 4D chủ động bỏ) — module Workflow coi như đã đủ tính năng cho vận hành
thật, chỉ còn chờ tiêu chí gộp nền Pha 5.**

**Ước lượng có căn cứ:** Attendance mất ~3,5 tuần (27/07 → 19/08/2026) cho 10,8k dòng BE + 12,4k dòng
FE + 35 migration, với **một** loại đơn cố định và **không** có designer nào. Workflow phải làm mọi
loại đơn cộng hai giao diện designer (form và luồng duyệt) — hãy tính lớn hơn đáng kể.

---

## 9. Còn để ngỏ

| Việc | Ghi chú |
|---|---|
| **Thông báo** | POWER EGG báo khi có đơn chờ duyệt. Hiện chỉ có token email cho việc *duyệt*, chưa có gì cho việc *báo*. Có thể xử lý ở tầng service, chưa chắc cần bảng. |
| **Xuất Excel/PDF danh sách đơn** | POWER EGG có. Chủ động **bỏ** khỏi Pha 4 (quyết định 2026-08-27, xem §10) — chưa thấy nhu cầu thật, làm sau nếu người dùng cần. |
| **Đa ngôn ngữ** | Schema đã có `NameVn`/`NameJp` khắp nơi, nhưng FE i18n mới xong Header/Navigation. Làm i18n ngay từ màn hình đầu của module này, đừng để nợ. |
| **`組織図の世代管理` bản đầy đủ** | Hiện chỉ có `ValidFrom`/`ValidTo` từng dòng, chưa tách thế hệ sơ đồ thành thực thể riêng. Đủ dùng nếu tái cơ cấu không thường xuyên. |
| **`SourceKind = SqlQuery`** | Cần chốt cơ chế bảo mật (tài khoản chỉ đọc, chặn từ khóa ghi, timeout) lúc implement. Nếu chưa chốt được thì chỉ làm 3 `SourceKind` built-in. |

---

## 10. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-08-20 | Cây tổ chức dời khỏi Identity sang Workflow DB; thêm `Employees` làm điểm neo định danh; bỏ `OrgUnitManagers` |
| 2026-08-20 | Bước duyệt trỏ thẳng node cây chung; thêm `FormApprovalStepParticipants` với `Approver`/`Viewer` |
| 2026-08-20 | Bám mô hình POWER EGG: thêm `JobTitles`, `FormRoutes`, `ApprovalDelegations` |
| 2026-08-20 | Nền tảng web; bổ sung `FormFieldConditions`, `FormDataSources`, tự đánh số; bỏ bố cục mobile riêng |
| 2026-08-20 | **Module độc lập với Attendance**, tách phần chung sau khi ổn định (§1.1–1.3) |
| 2026-08-20 | **In = layout form trên màn hình**, không mô phỏng mẫu giấy (§1.5, §5.7) |
| 2026-08-20 | Bỏ `OrgUnitScope = ApplicantAncestor` (§1.6); thêm `FormCategoryCoordinators` |
| 2026-08-20 | Chốt quy ước `DataJson` (§5.8), index bắt buộc (§5.9), đặt tên DB kiểu EF chuẩn (§5.10) — gỡ 3 chỗ hở cuối trước khi scaffold |
| 2026-08-24 | **Pha 1 scaffold xong BE**: 4 project tạo mới, DB `YevWorkflowManagement` tạo thật (migration `InitialWorkflowOrganization`), permission `Workflow.Organization.View/Manage` seed vào Identity. Route API bắt buộc tiền tố `api/Workflow/` (§1.7) — phát hiện trùng route với `Attendance.EmployeeController`/`JobTitleController` lúc smoke-test, sửa ngay trước khi có FE nào gọi tới. |
| 2026-08-24 | **Pha 1 FE xong**: 4 màn quản trị (Cấp tổ chức, Cây tổ chức kéo-thả, Chức danh, Nhân sự + gán đơn vị/chức danh kiêm nhiệm), i18n vi/ja đầy đủ. |
| 2026-08-25 | **Pha 2A xong BE+FE**: `FormCategories`/`FormCategoryCoordinators`/`FormDataSources` — migration `AddFormDesignCatalog` (Workflow DB) + `AddWorkflowFormDesignPermissions` (Identity DB, seed `Workflow.FormDesign.View/Manage` + `Workflow.Setting.Manage`). Quyết định trong lúc scaffold: (a) `FormDataSource` chỉ có 1 permission `Setting.Manage` cho mọi verb kể cả GET, không có cặp View/Manage riêng như các nhóm khác — vì đây thuần màn admin-only; (b) `SourceKind = SqlQuery` bị `Create`/`UpdateAsync` từ chối bằng `DomainException` cho tới khi chốt cơ chế bảo mật (§3.2), FE ẩn hẳn lựa chọn này khỏi dropdown thay vì chỉ disable. |
| 2026-08-25 | **Thêm claim `UserId` vào JWT toàn hệ thống** (Identity module) trước khi scaffold Pha 2B — phát hiện lúc thiết kế `FormDefinitions.CreatedByEmployeeId`: JWT trước giờ chỉ có username Windows dạng chuỗi, không đủ để tra `Employees.UserId` (điểm neo cross-DB đã chốt ở §1.4). Người dùng chọn phương án thêm claim số (thay vì match theo Email hoặc thêm cột Username vào `Employees`) vì đúng với thiết kế cross-DB đã có sẵn, không cần đổi schema `Employees`. Ảnh hưởng ra ngoài Workflow: mọi JWT hệ thống phát ra từ nay có thêm claim này (JWT cũ vẫn hợp lệ, chỉ thiếu claim, không vỡ). |
| 2026-08-25 | **Pha 2B xong BE+FE**: `FormDefinitions` — migration `AddFormDefinitions`. `WorkflowBaseController.CurrentUserId` (đọc claim `"UserId"` bằng chuỗi thô, không reference `Identity.Application`) → Service resolve `Employee.Id` tương ứng, chặn thao tác nếu chưa liên kết. `RouteConditionType` xác nhận bất biến: có trong `CreateDto`, không có trong `UpdateDto`. Thêm guard tự thân (không cần bảng khác): chặn xoá form đã `IsPublished`. |
| 2026-08-25 | **Pha 2C xong BE+FE**: `FormFields`/`FormFieldConditions` — migration `AddFormFieldsAndConditions`. Quyết định kiến trúc quan trọng nhất: `ReplaceFieldsAsync` **merge theo Id/FieldKey thay vì xoá-tất-tạo-lại** — phát hiện lúc thiết kế rằng pattern "replace nguyên danh sách" cũ (dùng cho `EmployeeOrgUnits`/`FormCategoryCoordinators`) sẽ làm Id đổi liên tục mỗi lần lưu, gãy tham chiếu `FormFieldConditions.TargetFieldId`/`SourceFieldId` (2 FK trỏ thẳng `FormFields.Id`). Đã hỏi mức độ tương tác kéo-thả FE trước khi code — chốt "kéo thẳng từ palette thả vào canvas" (không phải "click-để-thêm"), nên dùng `@dnd-kit/core` (drag giữa 2 container + `DragOverlay`) thay vì chỉ `@dnd-kit/sortable`. Route detail dùng query string `?id=` (mirror `OtFormDetail`), không dùng `[id]` động vì static export không hỗ trợ. Test HTTP xác nhận: field giữ nguyên Id qua nhiều lần lưu khi vẫn còn trong danh sách, xoá field đang là `SourceFieldId` bị chặn, cấu hình điều kiện vòng lặp bị chặn. |
| 2026-08-25 | **Pha 2D xong BE+FE — Pha 2 hoàn tất**: `FormAccesses` — migration `AddFormAccesses`, xoá-tất-tạo-lại bình thường (không bảng nào tham chiếu ngược `FormAccesses.Id`, khác `FormFields`). `POST /publish`: quyết định "Version chỉ tăng khi publish LẠI, không tăng lần đầu" — đọc đúng nghĩa đen §3.2 "tăng mỗi lần publish lại"; không có endpoint unpublish nên gọi `/publish` khi đã `IsPublished=true` luôn hiểu là "vừa sửa xong, publish lại". Thêm guard tự thân: chặn publish nếu form chưa có `FormFields` nào (publish form rỗng vô nghĩa). `POST /clone`: quyết định **KHÔNG sao chép `FormAccesses`** sang form nhân bản — cùng nguyên tắc "chỉ định tay, không suy ra" đã áp dụng cho `FormCategoryCoordinators`, tránh vô tình cấp quyền tạo đơn cho form mới mà admin chưa kịp rà soát; remap `FormFieldConditions` sang Id mới bằng `FieldKey` (unique theo form) thay vì giữ tham chiếu object EF qua nhiều lần `SaveChangesAsync`. Test HTTP xác nhận đủ: publish chặn khi rỗng, version giữ 1 ở lần publish đầu và tăng lên 2 ở lần publish lại, `FormAccesses` guard đúng-1-cột-đích theo `TargetType`, clone copy đúng field+condition (remap Id) nhưng để trống accesses, dup-code bị chặn, xoá form đã publish vẫn bị chặn như Pha 2B. **Phát hiện gap ngoài phạm vi pha này** (đã ghi ở hộp trạng thái đầu file): `FormCategoryService.DeleteAsync` chưa guard "còn `FormDefinitions` đang dùng danh mục" dù `FormDefinitions` đã tồn tại từ Pha 2B — để dành sửa ở đợt code tiếp theo chạm `FormCategoryService`. |
| 2026-08-25 | **Quyết định phạm vi Pha 3**: 8 bảng + luật nghiệp vụ quá lớn để làm gọn 1 lượt như 1 pha con của Pha 2 (xem §5.1-5.6). Đã hỏi và chốt **Pha 3A: chỉ cấu hình luồng duyệt** (`FormRoutes`/`FormApprovalSteps`/`FormApprovalStepParticipants`, thuần CRUD/validate) trước, để dành nộp đơn + duyệt/từ chối/trả về/thêm người duyệt/ủy quyền (`WorkflowRequests` và các bảng liên quan) cho Pha 3B — mirror cách Pha 2 đã tách 2A-2D. |
| 2026-08-25 | **Pha 3A xong BE+FE**: `FormRoutes`/`FormApprovalSteps`/`FormApprovalStepParticipants` — migration `AddFormRoutesAndApprovalSteps`. Quyết định kiến trúc quan trọng nhất: xác nhận `GenericRepository.Delete()` là HARD delete (`_dbSet.Remove()`) — toàn bộ pattern "replace nguyên danh sách" trong module từ Pha 2A đều xoá thật chứ không set `IsDeleted=true`, nên FK Cascade thật của SQL Server tự chạy. Nhờ đó xác định được: `FormApprovalSteps`/`FormApprovalStepParticipants` **luôn xoá-tất-tạo-lại** an toàn (không bảng nào tham chiếu Id của chúng, khác bài học `FormFields` ở Pha 2C), nhưng `FormRoutes` vẫn phải **merge theo Id** vì `WorkflowRequests.FormRouteId` (Pha 3B) sẽ là FK Restrict thật trỏ vào đây dù bảng đó chưa tồn tại lúc viết Pha 3A — đã đánh dấu `// TODO Pha 3B` ngay tại chỗ xoá route, tránh lặp lại lỗi quên guard đã xảy ra thật ở `FormCategoryService` (Pha 2A→2D). Đọc cây lồng nhau (route→step→participant) dùng projection `.Select()` lồng nhau trực tiếp trong `ToListAsync`, xác nhận EF Core dịch được thành 1 câu SQL có subquery tương quan mà không cần `Include`/`ThenInclude` (repo generic chỉ hỗ trợ Include 1 cấp) — không phải sửa interface repo. **Bug tự bắt được lúc test HTTP**: `GuardRouteFields` ban đầu bắt mọi route (kể cả `IsDefault=true`) phải có Min/Max/ClassValue theo `RouteConditionType`, làm nhánh mặc định (dự phòng, đúng ra không cần điều kiện riêng) bị chặn lưu vô lý — sửa bằng cách miễn guard này cho `IsDefault=true`, phát hiện và fix ngay trong phiên test trước khi báo hoàn thành. Test HTTP xác nhận đủ 13 kịch bản: cấu trúc `RouteConditionType=None`, giới hạn 1 `IsDefault`, ≥1 step/route, ≥1 Approver/step, Employee/JobTitle đúng 1 cột đích, Approver nguồn Employee cần `UserId`, `OrgUnitScope=Fixed/ApplicantUnit` đúng ràng buộc `OrgUnitId`, trùng participant trong step, trùng `ClassValue` giữa route (case-insensitive), merge-giữ-Id qua 2 lần lưu, cảnh báo chồng/hở khoảng số không chặn lưu. |
| 2026-08-25 | **Quyết định phạm vi Pha 3B**: chốt **Pha 3B-1 — chỉ engine BE** (nộp/duyệt đơn, test qua HTTP) trước, để dành FE (form render động + inbox "Chờ tôi duyệt") cho Pha 3B-2 — mirror lần tách Pha 3A đã làm. 7 quyết định chốt trước khi code (đầy đủ trong plan, tóm tắt): `RequestCode` nullable cho Draft (unique filtered WHERE NOT NULL) + format cố định `"{CodePrefix}-{Year}-{Sequence:0000}"`; `FormFields.AutoNumberPattern` và endpoint `RequestAction.Comment` riêng ngoài phạm vi; `SendBack` về `StepOrder=0` chưa có endpoint "nộp lại"; permission approve/reject/send-back/add-approver dùng chung `Workflow.Request.Create`; `FormSchemaJson` snapshot theo `FieldKey`. |
| 2026-08-25 | **Pha 3B-1 xong BE (chưa FE)**: `WorkflowRequests`/`WorkflowRequestSteps`/`WorkflowRequestStepParticipants`/`WorkflowRequestHistories`/`WorkflowSequences`/`ApprovalDelegations` — migration `AddWorkflowRequestsAndDelegations` (Workflow DB) + `AddWorkflowRequestPermissions` (Identity DB, seed `Workflow.Request.Create`/`ViewAll`). Lần đầu module dùng transaction tường minh (`BeginTransactionAsync`/`CommitTransactionAsync`) trong `SubmitAsync`, bọc luôn bước cấp số atomic bằng raw SQL `MERGE ... WITH (HOLDLOCK) ... OUTPUT` qua `Database.SqlQuery<int>()` — test 5 lượt submit song song (`Start-Job`) ra đúng 5 `RequestCode` liên tiếp không trùng. Quyết định kỹ thuật quan trọng nhất: `WorkflowRequestSteps.StepOrder` lệch **+1** so với `FormApprovalSteps.StepOrder` cấu hình gốc (đánh số từ 0) — tránh trùng giá trị sentinel `0 = chưa vào luồng duyệt / trả về người nộp` với bước duyệt đầu tiên. Bổ sung guard đúng vị trí `// TODO Pha 3B` đã đánh dấu từ Pha 3A: `ReplaceRoutesAsync` giờ chặn xoá `FormRoute` đang có `WorkflowRequests` tham chiếu — test HTTP xác nhận chặn đúng. Phát hiện 1 thiếu sót nhỏ trong bảng cột §3.3 (không phải quyết định nghiệp vụ mới): `WorkflowRequestSteps` cần thêm cột `AllowAddApproverSnapshot` (mirror `AllowSendBackSnapshot`) vì bảng không giữ FK ngược về `FormApprovalStep` gốc để tra lại sau khi submit. **2 bug tự bắt được lúc test HTTP, sửa ngay trước khi báo xong**: (1) người gọi vừa là Approver trực tiếp vừa là Delegate hợp lệ cho người khác cùng bước thì `Approve` lần 2 (định duyệt thay) bị hiểu nhầm thành duyệt lại chính mình — sửa bằng cách thêm `OnBehalfOfEmployeeId` (nullable, để trống thì giữ hành vi ưu tiên bản thân) vào 4 action DTO; (2) `CancelAsync` không chuyển `WorkflowRequestStep` đang `Current` sang trạng thái khác, khiến đơn đã hủy vẫn hiện trong `GET .../pending-my-approval` — sửa bằng cách chuyển bước đó sang `StepStatus.Skipped`. Test HTTP trên 1 form test riêng (`TEST-3B-FORM`, `RouteConditionType=NumericRange`, còn giữ lại trong DB để tái dùng cho Pha 3B-2) xác nhận đủ: FormAccesses chặn đúng, Draft tạo/sửa, thiếu field bắt buộc chặn submit, chọn đúng nhánh theo giá trị số, resolve người duyệt qua cả `ParticipantSource=Employee` lẫn `JobTitle`+`OrgUnitScope=ApplicantUnit` (tra `EmployeeOrgUnits`), `ApproverMode=Any`/`All` (duyệt đủ mới xong bước), duyệt thay qua `ApprovalDelegations` (kèm chặn tự ủy quyền + chặn dây chuyền 2 chiều), tiến bước đúng `CurrentStepOrder`, từ chối dừng hẳn đơn, trả về (`SendBack`) reset đúng các bước từ đích trở đi, thêm người duyệt giữa chừng (`AddApprover`) renumber đúng `StepOrder` các bước sau, chuẩn hoá `Employee`-type field bỏ qua `code`/`name` do FE gửi (chỉ tin `id`), 3 endpoint danh sách (`my-requests`/`pending-my-approval`/`visible-to-me`), CRUD `ApprovalDelegation` đầy đủ, 5 submit song song không trùng `RequestCode`. **Giới hạn môi trường test đã ghi nhận**: chỉ có 1 tài khoản Windows thật đăng nhập được trong lúc test (`Employees.UserId` chỉ có đúng 1 dòng khác NULL) — kịch bản "duyệt thay" phải tạo 1 `Employee` test có `UserId` giả (`TEST3B-APV`, giữ lại trong DB) và 1 dòng `ApprovalDelegations` chèn thẳng bằng SQL (không qua API, vì `CreateUpdateApprovalDelegationDto.DelegatorEmployeeId` cố tình luôn resolve = người gọi, không nhận qua body) để mô phỏng "người khác ủy quyền cho mình" — bản thân `ApprovalDelegationController` CRUD vẫn được test đầy đủ qua HTTP ở chiều `Delegator=mình`. |
| 2026-08-26 | **Pha 3B-2 xong BE+FE**: FE nộp/duyệt đơn hoàn chỉnh (`modules/workflow/components/requests/`: `DynamicFormRenderer`, `WorkflowRequestDataView`, `WorkflowRequestList`, `NewWorkflowRequestPicker`, `WorkflowRequestDetail`, `WorkflowRequestPrintView`, `SignatureUpload`, `ApprovalDelegationList`), route mới `workflow/requests[/new\|/detail]` + `workflow/delegations` (query-string `?id=` cho trang chi tiết, mirror `form-definitions/detail`), sidebar + i18n vi/ja đầy đủ. Trước khi code phát hiện 3 lỗ hổng khiến "Pha 3B-2 chỉ FE" không khả thi (nêu rõ ở đầu file + §6): người nộp đơn thường không có `Workflow.FormDesign.View` nên không đọc được danh sách form/field sống, và JWT không mang `Employee.Id` — bổ sung 3 endpoint đọc nhỏ `GET .../available-forms`, `.../form-schema/{id}`, `.../my-employee` trên `WorkflowRequestController` (cùng permission `Workflow.Request.Create`, không migration). Rà lại code lúc viết FE phát hiện thêm 2 việc cần sửa ở BE (không phải bug nghiệp vụ, chỉ là chỗ hở kỹ thuật): (1) `BuildFormSchemaJson` serialize bằng `JsonSerializer.Serialize(snapshot)` không set `PropertyNamingPolicy=CamelCase`, làm `FormSchemaJson` lộ PascalCase khác hẳn phần còn lại của response (ASP.NET Core mặc định camelCase) — sửa bằng 1 `JsonSerializerOptions` static dùng lại, test HTTP xác nhận submit lại ra đúng camelCase; (2) `WorkflowRequestHistoryDto` chưa từng chiếu `SignatureImage` (cột đã có ở DB từ Pha 3B-1) ra ngoài — bản in cần cột này để vẽ chữ ký (§5.7), bổ sung `SignatureImageBase64` (base64, AGENTS.md §4.4). Quyết định thiết kế FE: nút Duyệt/Từ chối/Trả về/Thêm người duyệt LUÔN hiện khi đơn ở bước chờ duyệt, không tính trước "có phải lượt tôi" ở FE — để BE tự chặn và trả lỗi tiếng Việt qua toast, tránh trùng lặp logic; dropdown "Duyệt thay cho ai" tính hoàn toàn từ `ApprovalDelegationApi.getMine()` (trả cả 2 chiều Delegator/Delegate) giao với participant Approver chưa `actedAt` của bước hiện tại, không cần endpoint riêng; Dropdown/Radio/MultiSelect chỉ đọc `OptionsJson` tĩnh — nguồn dữ liệu động qua `FormDataSourceId` chưa từng có endpoint "lấy giá trị" ở bất kỳ đâu trong hệ thống (kể cả lúc thiết kế field), ngoài phạm vi phiên làm việc này. **Verify**: `dotnet build` sạch, `npx tsc --noEmit` + `eslint` sạch, `pnpm build` (static export) sinh đủ route mới không lỗi, smoke test HTTP đầy đủ qua PowerShell (3 endpoint mới trả đúng dữ liệu lọc theo quyền, tạo Draft → sửa → nộp → `formSchemaJson` đúng camelCase → duyệt → xác nhận biến mất khỏi `pending-my-approval` → `visible-to-me` đúng danh sách). **Giới hạn đã ghi nhận minh bạch**: phiên làm việc này KHÔNG có công cụ điều khiển trình duyệt (Playwright/…), nên UI thật (giao diện form render, điều kiện ẩn/hiện, layout in) chưa được tự tay bấm thử qua trình duyệt — chỉ xác nhận được qua build/type-check/lint sạch và HTTP đúng dữ liệu; cần người dùng tự kiểm tra UI trước khi coi là hoàn tất 100%. |
| 2026-08-26 | **`FormAccesses.OrgUnit` đổi từ so khớp đúng-1-cấp sang LAN XUỐNG cây con** — phát hiện khi người dùng báo "nhân sự phòng IT không thấy form nào để tạo". Tra dữ liệu thật: `FormAccesses` của form test chỉ cấp cho `OrgUnit` cha ("Xưởng Dĩ An"), nhân sự đó lại thuộc `OrgUnit` con cháu ("IT", qua "Phòng Công Vụ") — so khớp đúng-1-cấp (hành vi từ Pha 2D/3B-1, không đổi từ lúc đó tới giờ) không nhận ra quan hệ cha-con nên trả về rỗng, đúng theo luật CŨ nhưng không đúng kỳ vọng thực tế. Đã hỏi người dùng 2 hướng (sửa dữ liệu `FormAccesses` cho đúng phòng ban cụ thể, hoặc đổi luật cho lan truyền theo cây) — chọn **đổi luật**. Sửa `HasFormAccessAsync`/`GuardFormAccessAsync` (`WorkflowRequestService`) duyệt ngược `OrgUnit` của nhân sự lên gốc qua `ParentId` (giới hạn 50 bước đề phòng dữ liệu lỗi tạo vòng lặp), khớp bất kỳ nút nào trên đường đi. Ảnh hưởng TẤT CẢ chỗ dùng `FormAccesses` kiểu `OrgUnit`: `CreateDraftAsync`, `SubmitAsync` (Pha 3B-1), `GET .../available-forms` (Pha 3B-2) — sửa 1 chỗ dùng chung cho cả 3. **Verify bằng dữ liệu thật, không cần data giả**: tài khoản test (`Employees.Id=2`) vốn cũng thuộc `OrgUnit` "IT" — trước fix `available-forms` chỉ trả 2 form (cấp trực tiếp theo Employee), sau fix trả thêm `TEST-2D-FORM` (cấp theo `OrgUnit` cha "Xưởng Dĩ An") đúng như kỳ vọng. |
| 2026-08-26 | **Thêm `JobTitles.IsUniquePerOrgUnit`** — phát hiện ngay sau fix `FormAccesses` ở trên, cùng phiên: nhân sự phòng IT phản ánh không gán được chức danh phổ thông "Nhân viên" cho người thứ 2 tại cùng đơn vị. Luật cũ (từ Pha 1) áp "1 người/1 (OrgUnit,JobTitle)" cho MỌI chức danh không phân biệt — đúng mục đích ban đầu (route duyệt qua `ParticipantSource=JobTitle` cần resolve ra đúng 1 người, §5.5) nhưng sai với chức danh phổ thông thực tế có nhiều người giữ. Đã hỏi 3 hướng (sửa dữ liệu cụ thể / bỏ hẳn luật rồi đổi §5.5 sang resolve nhiều Approver / thêm cờ phân loại chức danh) — chọn **thêm cờ** `IsUniquePerOrgUnit` (mặc định `true` cho toàn bộ dữ liệu có sẵn qua migration `AddJobTitleIsUniquePerOrgUnit`, tránh âm thầm phá vỡ cấu hình route đang chạy). Sửa 2 chỗ: (1) `EmployeeService.ReplaceOrgUnitsAsync` chỉ enforce "1 người/đơn vị" khi cờ `true`; (2) `FormDefinitionService.ReplaceRoutesAsync` chặn cấu hình `ParticipantRole=Approver` với chức danh cờ `false` — hệ quả tất yếu của việc mở khoá đa-người: nếu không chặn, `ResolveStepParticipantsAsync` (§5.5) vẫn `FirstOrDefault` một người bất kỳ trong nhiều người, route sai âm thầm. FE: `JobTitleForm.tsx` thêm checkbox, `JobTitleList.tsx` thêm cột hiển thị. **Verify qua HTTP với dữ liệu thật** (không cần data giả): thử gán JobTitle "Nhân viên" (đã có nhân sự phòng IT giữ) cho 1 nhân sự IT khác — bị chặn đúng thông báo cũ; bật cờ `IsUniquePerOrgUnit=false` cho "Nhân viên" qua `PUT JobTitle/5`; thử lại → thành công; dọn dữ liệu test ngay sau đó (khôi phục tên chức danh đúng dấu, gỡ dòng gán thử ở nhân sự test), **giữ nguyên** `IsUniquePerOrgUnit=false` cho "Nhân viên" vì đó chính là fix người dùng cần. |
| 2026-08-26 | **Reset dữ liệu form/đơn để test tay Pha 3B-2 với người dùng thật.** Người dùng yêu cầu xoá sạch dữ liệu form/đơn cũ (đa số là test data tích luỹ qua Pha 2A-3B-1) để dựng lại 1 form thật gọn dựng thử luồng duyệt. Đã hỏi xác nhận phạm vi trước khi xoá (AGENTS.md — DB dùng chung) — chốt: **giữ nguyên cây tổ chức** (`OrgLevels`/`OrgUnits`/`JobTitles`/`Employees`/`EmployeeOrgUnits`, vì đã đúng sẵn cơ cấu phòng IT có Trưởng phòng + Nhân viên phù hợp kịch bản test), chỉ xoá 2 nhóm còn lại: **Định nghĩa form** (`FormCategories` `FormCategoryCoordinators` `FormDataSources` `FormDefinitions` `FormFields` `FormFieldConditions` `FormAccesses` `FormRoutes` `FormApprovalSteps` `FormApprovalStepParticipants`) và **Dữ liệu đơn** (`WorkflowRequests` `WorkflowRequestSteps` `WorkflowRequestStepParticipants` `WorkflowRequestHistories` `ApprovalDelegations` `WorkflowSequences`) — xoá bằng SQL trực tiếp (DELETE theo thứ tự con→cha, không dùng TRUNCATE vì còn FK), không qua API vì khối lượng lớn và một số bản ghi (form đã publish, route đang có `WorkflowRequests` tham chiếu) bị chính API chặn xoá theo đúng thiết kế. Dựng lại 1 form thật qua API (không SQL thẳng, để đi đúng validate/permission-seed sẵn có): `FormCategory` "NS - Đơn nhân sự" → `FormDefinition` "NGHIPHEP - Giấy nghỉ phép" (`RouteConditionType=None`, `CodePrefix="NP"`, field `loaiNghiPhep`/`tuNgay`/`denNgay`/`soNgay`/`lyDo`/`ghiChu`) → `FormAccesses` cấp `TargetType=OrgUnit` cho `OrgUnit="IT"` (mọi nhân sự IT tạo được đơn) → 1 `FormRoute` mặc định, 1 `FormApprovalStep` (`OrgUnitScope=Fixed`, `OrgUnitId=IT`, `ApproverMode=Any`) với 1 participant `ParticipantSource=JobTitle`, `JobTitleId="Trưởng phòng"`, `ParticipantRole=Approver` → publish. Verify qua HTTP: `available-forms` (gọi bằng tài khoản Trưởng phòng IT) trả đúng form vừa tạo, `GET routes` xác nhận đúng step/participant đã cấu hình. **Không tự nộp/duyệt thử đơn nào** — để dành nguyên luồng cho người dùng + đồng nghiệp tự bấm thử qua UI thật, đúng mục đích yêu cầu ban đầu. |
| 2026-08-26 | **Sửa 2 bug layout FE phát hiện lúc người dùng tự test luồng duyệt qua UI thật (Pha 3B-2), không phải nghiệp vụ mới:** (1) `SearchableSelect` nhận `triggerClassName` ngắn (vd `"h-9"`) sẽ THAY THẾ toàn bộ style mặc định (border/nền/bo góc) thay vì cộng thêm — làm ô chọn Nhân sự/Chức danh/Đơn vị trong `StepCard.tsx`/`FormAccessesPanel.tsx`/`DynamicFormRenderer.tsx` gần như vô hình, không bấm chọn được; (2) `w-28`/`w-32` ghép sau 1 class base đã có sẵn `w-full` (`StepCard.tsx`) khiến Tailwind chọn class thắng theo thứ tự sinh CSS nội bộ chứ không theo thứ tự viết trong code — select "Người duyệt" bị kéo full-width tràn màn hình. Sửa bằng cách luôn truyền đủ style qua `triggerClassName` (không dùng bare `"h-9"`) và tách 1 class base KHÔNG có `w-full` riêng cho các phần tử trong hàng flex cần độ rộng cố định. Không phải lỗi nghiệp vụ — chỉ ghi lại vì đã sửa nhiều nơi cùng lúc, tránh lặp lại khi thêm field/route designer mới. |
| 2026-08-26 | **Đơn "chưa lưu nháp lần nào" không còn tự tạo `WorkflowRequests` chỉ vì chọn loại đơn.** Người dùng phản ánh: bấm chọn 1 loại đơn ở "Tạo đơn mới" là `createDraft` chạy ngay lập tức, kể cả khi chưa nhập gì/chưa bấm "Lưu nháp" — bấm nhầm loại đơn cũng để lại rác. Sửa: `NewWorkflowRequestPicker.tsx` chỉ điều hướng sang `workflow/requests/detail?formDefinitionId=` (không gọi API); `WorkflowRequestDetail.tsx` nhận thêm `id: number \| null` — `id=null` là chế độ "đơn chưa tồn tại" (tải sẵn form-schema để hiển thị y hệt draft, dùng 1 object `WorkflowRequestDto` tạm `id=0` chỉ để thoả kiểu, `canCancel` tự chặn); `createDraft` CHỈ được gọi bên trong `handleSaveDraft`/`handleSubmit` khi người dùng chủ động bấm, xong thì `router.replace` sang `?id=<id thật>` để chuyển hẳn sang luồng cập nhật draft bình thường. Không migration, không đổi API BE. |
| 2026-08-26 | **Pha 4A xong BE+FE — chữ ký đăng ký sẵn.** Đã hỏi và chốt trước khi code: mirror ĐÚNG cơ chế `Attendance.UserSignature` — cập nhật KHÔNG áp dụng ngay, phải xác nhận qua email (chống chiếm phiên đăng nhập đổi chữ ký hộ người khác) — thay vì đơn giản hoá thành lưu ngay như thiết kế gốc 4 cột trong §3.4. Thêm 1 bảng ngoài 25 bảng gốc: `PendingEmployeeSignatureConfirmations` (mirror `PendingSignatureConfirmation`, khác biệt duy nhất: khoá theo `EmployeeId` thay vì `UserName` — đúng điểm neo Workflow đã chốt ở §1.4). Migration `AddEmployeeSignatures` (Workflow DB) + `AddWorkflowSignaturePermissions` (Identity DB, seed `Workflow.Signature.Update`, gán Admin). BE: `EmployeeSignatureController`/`Service` mirror gần như nguyên vẹn `UserSignatureController`/`Service` của Attendance (kể cả hằng số 30 phút hết hạn), chỉ đổi điểm neo `EmployeeId`; endpoint `confirm/{token}` `[AllowAnonymous]`. Email template mới `Workflow.Infrastructure/EmailTemplates/EmployeeSignature/RequestUpdateConfirmation.html` (copy layout của Attendance, đổi placeholder `UserName`→`EmployeeFullName`) — `EmailTemplateService` (`Shared.Infrastructure`) đọc chung 1 thư mục `EmailTemplates/` cạnh DLL host bất kể module nào khai `<Content>`, không cần đổi gì ở tầng đọc file. FE: trang tự quản `workflow/signature` (`EmployeeSignaturePanel.tsx`, mirror `UserSignaturePanel.tsx`) + trang xác nhận public `/xac-nhan-chu-ky-quy-trinh` (route riêng, KHÔNG dùng chung `/xac-nhan-chu-ky` của Attendance — giữ đúng nguyên tắc module độc lập §1.1); tự viết `modules/workflow/lib/bilingual.ts` (bản rút gọn chỉ có `createBilingualTranslator`, không kéo theo các hằng số bilingual riêng của OT-form) thay vì import từ `modules/attendance/lib/bilingual.ts`. Tích hợp vào màn duyệt đơn (`WorkflowRequestDetail.tsx`): tải trước chữ ký đã lưu (`savedSignatureBase64`, fetch 1 lần, im lặng khi chưa đăng ký — không toast vì đây là trạng thái bình thường) truyền vào `SignatureUpload` qua prop mới `initialBase64` chỉ để HIỂN THỊ mặc định; giá trị thật sự gửi lúc duyệt là `signatureBase64 ?? savedSignatureBase64` — tránh hẳn việc phải đồng bộ 2 state qua lại giữa cha/con. **Verify**: `dotnet build`/`npx tsc --noEmit`/`pnpm lint`/`pnpm build` (static export, 2 route mới sinh đúng cho cả /vi /ja) đều sạch; migration áp thành công vào cả 2 DB; smoke test HTTP read-only xác nhận đúng luồng permission→resolve Employee→404 "chưa đăng ký" khi chưa có dữ liệu. **Không tự test luồng ghi** (yêu cầu cập nhật chữ ký thật sẽ gửi email thật vào hộp thư người dùng) — để người dùng tự bấm thử qua UI "Chữ ký của tôi". |
| 2026-08-26 | **Pha 4B xong BE+FE — đính kèm file.** Đã hỏi và chốt trước khi code (nghiệp vụ chưa có trong thiết kế gốc): chủ đơn được thêm/xoá file đính kèm **xuyên suốt** tới khi đơn kết thúc (Approved/Rejected/Cancelled), không giới hạn ở Draft — cho phép bổ sung hồ sơ khi người duyệt yêu cầu; người duyệt chỉ xem/tải, không tự thêm được. Migration `AddWorkflowAttachmentsAndSettings` (Workflow DB) tạo `WorkflowAttachments` + `WorkflowSettings`, seed sẵn 1 dòng cấu hình mặc định (10 MB, `.pdf,.jpg,.jpeg,.png,.docx,.xlsx`, tối đa 5 file/đơn, `EmailTokenExpiryDays=7` — cột này chưa dùng tới khi Pha 4C). **Phát hiện lúc tạo migration Identity**: permission `Workflow.Setting.Manage` đã được seed sẵn từ Pha 2A (`AddWorkflowFormDesignPermissions`, dùng cho `FormDataSources`) — không cần seed lại, migration Identity dự định ban đầu bị dư nên đã `ef migrations remove`. File vật lý lưu trên đĩa server chạy host (KHÔNG lưu byte[] trong DB, đúng thiết kế §3.3): thư mục gốc cấu hình qua `appsettings.json` → `AppSettings:WorkflowAttachmentStoragePath` (mặc định `App_Data/WorkflowAttachments` tính từ `AppContext.BaseDirectory` — production nên trỏ ra đường dẫn tuyệt đối bên ngoài thư mục build để không mất file khi redeploy, chưa hỗ trợ multi-instance/network share). Trừu tượng hoá qua `IWorkflowAttachmentStorage` (interface ở `Workflow.Application`, impl `WorkflowAttachmentStorageService` ở `Workflow.Infrastructure`, tên kết thúc `Service` nên Scrutor tự đăng ký) — mirror pattern `IEmailService`. BE: 3 action mới gộp thẳng vào `WorkflowRequestService`/`WorkflowRequestController` (không tách controller riêng, đúng tiền lệ mọi entity con của aggregate `WorkflowRequest` đều nằm chung 1 controller) — `UploadAttachmentAsync` validate theo thứ tự `AllowAttachment` → dung lượng → đuôi file → số lượng (đọc từ `WorkflowSettings`), `DeleteAttachmentAsync` soft-delete DB trước rồi mới xoá file vật lý (đảm bảo không mất file nếu DB lỗi giữa chừng), `DownloadAttachmentAsync` trả `PhysicalPath` cho Controller tự `PhysicalFile(...)` (KHÔNG bọc `ApiResponse<T>` vì là nhị phân — ngoại lệ duy nhất của luật §3.4-1). Tách `GuardCanViewRequestAsync` từ logic cũ của `GetByIdAsync` (§7 luật "Ai xem được đơn này?") để dùng lại cho `DownloadAttachmentAsync`. `SubmitAsync` thêm bước 2b: `RequireAttachment=true` mà chưa có file nào thì chặn nộp. `WorkflowSettingController`/`Service` mới (`GET`/`PUT /WorkflowSetting`, luôn đúng 1 dòng Id=1, permission `Workflow.Setting.Manage`). FE: khối "Đính kèm" trong `WorkflowRequestDetail.tsx` (upload qua `<input type=file>` ẩn, tải xuống dựng `Blob` + `<a download>` y hệt pattern export Excel của Asset, mirror `formatFileSize` cục bộ) — thêm hàm `getForBlob` vào `lib/client.ts` (GET-blob, mirror `postFormForBlob` sẵn có). Trang admin mới `workflow/settings` (`WorkflowSettingPanel.tsx`) + mục sidebar "Cấu hình" (permission `Workflow.Setting.Manage`, cùng nhóm với "Nguồn dữ liệu"). `WorkflowRequestPrintView.tsx` thêm khối liệt kê tên file đính kèm (§5.7 "Đính kèm | danh sách tên file"). **Verify**: `dotnet build`/`npx tsc --noEmit`/`pnpm lint`/`pnpm build` (static export, route `/workflow/settings` sinh đúng cho cả /vi /ja) đều sạch; migration áp thành công vào Workflow DB; smoke test HTTP read-only xác nhận `GET /WorkflowSetting` trả đúng cấu hình mặc định và `GET /WorkflowRequest/{id}` trả thêm `attachments: []` không vỡ response cũ. **Không tự test luồng ghi** (upload/xoá tạo file thật + dòng DB thật trên DB chia sẻ) — để người dùng tự thử qua UI. |
| 2026-08-26 | **Sửa lỗi in đơn: hộp thoại in của trình duyệt hiện cả sidebar/layout, vỡ bố cục.** Xem trước trên màn hình (`WorkflowRequestPrintView.tsx`, overlay `z-50`) đã đúng vì z-index che được sidebar — nhưng khi trình duyệt thực sự render trang in, nó bỏ qua stacking/`position: fixed` và layout lại theo flow bình thường, nên sidebar (`fixed`, không có `print:hidden`) + margin-left/max-width của `(workflow-manager)/layout.tsx` (thiếu toàn bộ class `print:*`) vẫn chiếm chỗ. `(ot-manager)/layout.tsx` + `OtManagerSidebar.tsx` (module Attendance) đã có sẵn đúng bộ class này (`print:ml-0!`/`print:p-0`/`print:max-w-none` ở layout, `print:hidden` ở `<aside>`) nên in OT Form không bị lỗi — mirror lại y hệt cho `(workflow-manager)/layout.tsx` + `WorkflowManagerSidebar.tsx`. **Vẫn chưa đủ** (phát hiện lúc test thật bước 2): sidebar đã ẩn nhưng hộp thoại in vẫn in CẢ nội dung trang chi tiết đơn (`WorkflowRequestDetail.tsx`, các section NỘI DUNG ĐƠN/ĐÍNH KÈM/CÁC BƯỚC DUYỆT/LỊCH SỬ...) LẪN `WorkflowRequestPrintView` chồng lên nhau — vì `position: fixed` của overlay preview chỉ có tác dụng ở màn hình, lúc trình duyệt thực sự render trang in nó bỏ qua stacking context nên toàn bộ DOM (kể cả phần bị che phía dưới overlay) đều được in theo thứ tự document. Sửa triệt để: bọc riêng phần "nội dung trang" (mọi thứ trừ `WorkflowRequestPrintView`/`AttachmentPreviewDialog`) vào 1 `<div className="... print:hidden">` tách biệt (dùng Fragment `<>...</>` ở ngoài cùng), để 2 modal kia là SIBLING chứ không phải con của div bị `print:hidden` — nếu để chung 1 div rồi gắn `print:hidden` lên chính nó thì các modal con cũng bị ẩn theo (Tailwind `hidden` = `display:none`, con của phần tử `display:none` không tự "thoát" ra ngoài được dù bản thân có `fixed`). |
| 2026-08-26 | **Xem trước file đính kèm trước khi tải xuống.** Thêm `AttachmentPreviewDialog.tsx` (modal full-screen, mirror `WorkflowRequestPrintView.tsx`) — gọi lại đúng endpoint `GET .../attachments/{id}/download` sẵn có (không thêm BE), dựng `Blob` thành `<img>` (ảnh) hoặc `<iframe>` (PDF, trình duyệt tự render); loại file khác (docx/xlsx…) hiện thông báo "không hỗ trợ xem trước, tải xuống để xem" — cố tình KHÔNG kéo thêm thư viện đọc docx/xlsx phía client. Nút "Tải xuống" trong dialog dùng lại `Blob` đã tải sẵn (không gọi API lần 2). Nút mắt (Eye) mới thêm cạnh nút Tải xuống ở mỗi dòng đính kèm trong `WorkflowRequestDetail.tsx`. |
| 2026-08-27 | **Pha 4C xong BE+FE — duyệt qua email.** Nghiên cứu kỹ cơ chế mirror source `Attendance.OtFormApprovalEmailToken`/`OtFormService` trước khi code (token/gửi mail/endpoint public/trang FE) rồi rút gọn cho đúng những gì Workflow thật sự cần: **không** mirror secondary password (Workflow không có khái niệm này), **không** mirror "remove employee" action (đặc thù OT form), **chỉ** Duyệt + Từ chối qua email — KHÔNG SendBack/AddApprover (cả 2 cần UI chọn phức tạp hơn, ngoài phạm vi kênh không-đăng-nhập; quyết định mặc định theo đúng mirror source, không hỏi thêm vì đã có tiền lệ rõ). Hạn dùng token đọc từ `WorkflowSettings.EmailTokenExpiryDays` (cột đã seed sẵn từ Pha 4B nhưng chưa dùng tới) thay vì hardcode hằng số như Attendance — tận dụng đúng hạ tầng đã có, không cần thêm cấu hình. <br>**Refactor BE quan trọng**: tách lõi `ApproveAsync`/`RejectAsync` (JWT, đã qua `ResolveActingCapabilityAsync`/delegation) thành `ApplyApprovalAsync`/`ApplyRejectionAsync` dùng chung với `ApproveByEmailTokenAsync`/`RejectByEmailTokenAsync` (token tự là credential, bỏ qua capability-check nhưng vẫn chạy lại đúng bước "participant có khớp bước Current không, đã duyệt chưa") — mirror triết lý Attendance "1 core method, nhiều entry point theo kênh", tránh nhân đôi state-machine duyệt/hoàn tất-bước/chuyển-bước-kế ở 2 nơi (rủi ro lệch bug cao nếu tự viết riêng). Cũng tách `LoadPendingApprovalContextAsync` (dùng chung 4 chỗ: 2 core cũ + 2 core email). **Sửa 1 bug tiềm ẩn phát hiện khi làm việc này**: `GuardCanViewRequestAsync` (viết ở Pha 4B cho `DownloadAttachmentAsync`) resolve `currentEmployeeId` TRƯỚC KHI check `hasViewAll` — kênh email gọi `GetByIdAsync(id, currentUserId: null, hasViewAll: true)` nên sẽ luôn throw "không xác định được người dùng" dù đáng lẽ không cần đọc `currentUserId` ở nhánh `hasViewAll=true`; sửa thành thoát sớm khi `hasViewAll` trước khi đụng tới `currentUserId` — bug này chưa từng lộ ra vì tới trước Pha 4C, MỌI lời gọi `hasViewAll=true` đều đi kèm `currentUserId` hợp lệ (luôn là hậu-hành-động sau JWT-authenticated call). <br>Trigger gửi mail: `NotifyStepApproversAsync` gọi ở 2 chỗ — cuối `SubmitAsync` (SAU `CommitTransactionAsync`, không giữ transaction mở lúc gọi SMTP) cho bước Current đầu tiên, và trong `ApplyApprovalAsync` (SAU `SaveChangesAsync`) khi bước hoàn tất chuyển sang bước kế. KHÔNG cần xử lý `SendBackAsync`/`AddApproverAsync`: SendBack hiện KHÔNG có bước nào tự chuyển `Current` trở lại (đơn rơi vào `SentBack`, dead-end, chưa hỗ trợ resubmit — đã chốt ở Pha 3B-1), AddApprover chèn bước mới ở trạng thái `Waiting` (chỉ thành `Current` sau này qua đúng nhánh `ApplyApprovalAsync` đã xử lý). Chữ ký lúc duyệt qua email: tự lấy từ `EmployeeSignatures` (Pha 4A) nếu bước yêu cầu, throw lỗi rõ ràng nếu chưa đăng ký — mirror đúng Attendance, trang public không có UI chọn ảnh. <br>Controller mới `WorkflowApprovalController` (tách riêng khỏi `WorkflowRequestController` vì toàn bộ action `[AllowAnonymous]`, giữ ranh giới rõ "controller nào cần JWT"). FE: `WorkflowApprovalConfirmPage.tsx` (route `/xac-nhan-don-quy-trinh`, bilingual cố định mirror `EmployeeSignatureConfirmPage.tsx`) tái dùng `WorkflowRequestDataView` để hiển thị nội dung đơn; **file đính kèm chỉ hiện TÊN, không cho tải xuống** ở trang ẩn danh này (endpoint tải file đòi JWT+quyền xem đơn qua `WorkflowRequestController`, mở thêm cho anonymous là mở rộng bề mặt bảo mật ngoài phạm vi phase này — để dành sau nếu thật sự cần). <br>**Verify**: `dotnet build`/`npx tsc --noEmit`/`eslint`/`pnpm build` (route mới sinh đúng /vi /ja) đều sạch; migration áp thành công vào Workflow DB; smoke test HTTP xác nhận endpoint cũ (`my-requests`) không bị ảnh hưởng bởi refactor + endpoint mới (`GET by-token` với token rác) trả đúng 404 domain error, `[AllowAnonymous]` hoạt động không cần JWT. **Không tự test luồng Duyệt/Từ chối thật** (sẽ đổi trạng thái 1 đơn thật + gửi email thật trên DB chia sẻ) — để người dùng tự nộp 1 đơn test rồi bấm link trong email. <br>**Phát hiện ngoài lề lúc smoke test**: `CompanySystem.HostApi/Properties/launchSettings.json` đang hardcode `applicationUrl: http://10.45.1.155:8081`, nhưng IP thật của máy dev tại thời điểm này là `10.45.1.181` (`ipconfig`/`Get-NetIPAddress` xác nhận, adapter Ethernet, cấu hình Manual) — bind thất bại với `SocketException 10049` (address not valid). Phải chạy đè bằng `dotnet run ... --urls http://10.45.1.181:8081` mới lên được, KHÔNG sửa file `launchSettings.json` (không rõ đây là đổi IP tạm thời hay vĩnh viễn của máy dev — để người dùng tự xác nhận và cập nhật file nếu cần). |
| 2026-08-27 | **Pha 4D (xuất Excel danh sách đơn) — chủ động KHÔNG làm, theo yêu cầu người dùng.** Pha 4 coi như hoàn tất ở 4A-4C. Không có gap kỹ thuật nào bị bỏ dở — nếu sau này cần, dữ liệu nguồn (`WorkflowRequests` + join `FormDefinitions`/`Employees`) đã đủ đầy cho 1 endpoint export độc lập, không phụ thuộc gì vào việc trì hoãn này. |
| 2026-08-27 | **Gán nhân sự vào đơn vị ngay từ Cây tổ chức + bảng mới `OrgLevelJobTitleSuggestions`.** Người dùng phản ánh luồng gán đơn vị/chức danh hiện tại (phải rời màn cây, mở dialog ở màn Nhân sự, chọn `OrgUnit` từ dropdown phẳng) khó dùng — muốn bấm thẳng vào 1 node trên cây (vd "Xưởng Dĩ An") để thêm người, và hệ thống tự gợi ý đúng chức danh thường gặp ở cấp đó (Trưởng xưởng), còn cấp thấp hơn (IT) gợi ý nhiều lựa chọn hơn (Team Leader/Group Leader/Nhân viên). Đã hỏi và chốt 3 quyết định trước khi code (AGENTS.md §2 luật 2): (1) chức danh chỉ **gợi ý mặc định** (pre-select), KHÔNG giới hạn cứng — dropdown vẫn hiện đủ toàn bộ chức danh; (2) mapping cấu hình **theo `OrgLevel`** (không theo từng `OrgUnit` riêng lẻ); (3) dialog "Đơn vị/chức danh kiêm nhiệm" ở màn Nhân sự **giữ nguyên**, chỉ thêm lối tắt mới. Hệ quả kiến trúc: vì gợi ý chỉ là default và "gán 1 dòng" bản chất vẫn là sửa nguyên `EmployeeOrgUnits` của 1 nhân sự, **không thêm API "gán 1 dòng" mới** — dialog mới ở cây tổ chức chỉ build lại đúng request `PUT .../Employee/{id}/org-units` đã có sẵn từ Pha 1 (tự nó đã enforce đủ luật — tối đa 1 `IsPrimary`, chặn trùng chức danh khi `IsUniquePerOrgUnit=true`). API mới duy nhất là bảng cấu hình gợi ý `OrgLevelJobTitleSuggestions` (§3.1) — mirror chính xác pattern "replace nguyên danh sách theo thứ tự" của `FormCategoryCoordinators`/`EmployeeOrgUnits`, 2 endpoint gộp vào `OrgLevelController`/`OrgLevelService` có sẵn (không controller/permission mới). FE: `OrgLevelJobTitleSuggestionsDialog.tsx` (màn Cấp tổ chức — chọn + sắp thứ tự chức danh gợi ý bằng nút lên/xuống, không cần `@dnd-kit` vì màn nhỏ) và `AssignEmployeeDialog.tsx` (icon `UserPlus` mới trên mỗi node cây tổ chức — chọn nhân sự qua `SearchableSelect` mirror `FormAccessesPanel.tsx`, dropdown chức danh 2 `optgroup` "Gợi ý cho cấp này"/"Toàn bộ chức danh", chặn trùng `orgUnitId+jobTitleId` ở FE trước khi gọi API để lỗi rõ ràng hơn lỗi SQL thô). Migration `AddOrgLevelJobTitleSuggestions` (chỉ Workflow DB, thuần cộng bảng mới) đã áp vào `YevWorkflowManagement` sống. **Verify**: `dotnet build`/`npx tsc --noEmit`/`pnpm lint`/`pnpm build` (static export) đều sạch; smoke test HTTP xác nhận `GET .../OrgLevel/{id}/job-title-suggestions` trả `[]` đúng cho cấp chưa cấu hình, đúng 401 khi thiếu token, và `GET .../OrgUnit/tree` (endpoint cũ) không bị ảnh hưởng. **Không tự test luồng ghi** (cấu hình gợi ý thật, gán nhân sự thật) trên DB chia sẻ — để người dùng tự bấm thử qua UI. |
| 2026-08-27 | **Hiện "ai đang giữ chức gì" ngay trên Cây tổ chức.** Người dùng phản ánh: gán xong ở dialog mới vẫn phải qua tab Nhân sự mới xem được ai đang giữ chức nào tại 1 đơn vị — bất tiện. Mở rộng `OrgUnitService.GetTreeAsync()`: nạp thêm 1 lượt `EmployeeOrgUnits` (chỉ nhân sự `IsActive=true` và chưa xoá), gom nhóm theo `OrgUnitId`, gắn vào `OrgUnitTreeDto.Members` (DTO mới `OrgUnitTreeMemberDto`: `EmployeeId/EmployeeFullName/EmployeeCode/JobTitleId/JobTitleNameVn/IsPrimary`, sort theo `JobTitle.RankOrder` rồi tên) — 1 lần gọi cây vẫn trả đủ dữ liệu, không N+1, không endpoint mới. FE: `OrgUnitList.tsx` hiện 1 hàng chip nhỏ dưới mỗi node (`"{Chức danh}: {Tên nhân sự}"`, hoặc "Không chức danh" nếu `jobTitleId=null`) khi `members.length > 0`. **Verify**: `dotnet build` sạch, `npx tsc --noEmit`/`pnpm lint` sạch, smoke test HTTP xác nhận `GET .../OrgUnit/tree` trả đúng field `members` (mảng rỗng cho đơn vị chưa gán ai, không vỡ response cũ). |
| 2026-08-27 | **Hiện danh sách nhân sự kiểu cây thư mục (folder) thay vì 1 hàng phẳng.** Người dùng muốn: cùng 1 đơn vị, người chức vụ cao hơn nằm ngoài, thấp hơn thụt vào trong, cùng cấp thẳng hàng, gộp/mở được như Windows Explorer. Thêm `OrgUnitTreeMemberDto.JobTitleRankOrder` (chiếu thẳng `JobTitles.RankOrder`, không thêm cột DB nào). FE (`OrgUnitMemberTree.tsx`, component mới, tách khỏi `OrgUnitList.tsx`): gom nhân sự theo `jobTitleRankOrder` thành từng "cấp" (số nhỏ hơn = ngoài cùng, `null` coi như cấp thấp nhất), người CÙNG cấp render thẳng hàng ở cùng 1 mức thụt lề, cấp sau thụt thêm; nút mũi tên gắn ở dòng ĐẦU của mỗi cấp để gộp/mở toàn bộ các cấp lồng bên trong — gắn theo CẢ CỤM cấp bậc chứ không theo từng cá nhân, vì `RankOrder` chỉ để sắp xếp hiển thị (workflow-module.md §3.1), không mang quan hệ báo cáo người-với-người cụ thể nào để gán chevron riêng từng người. |
| 2026-08-29 | **Bắt buộc duyệt đủ cấp tổ chức khi cấu hình route (§5.6a).** Người dùng phản ánh: chọn duyệt là Tổng giám đốc thì phải duyệt tuần tự từ cấp thấp (Team Leader) lên, không phải chỉ mỗi Tổng giám đốc; chỉ định chức cao nhất duyệt thì chức thấp hơn cũng phải duyệt. Đụng trực tiếp quyết định "ĐỪNG LẬT LẠI" ở §1.6 (đã bỏ kiểu duyệt tự leo cấp trên vì Attendance từng gặp lỗi bắc cầu sinh quá nhiều bước). Đã hỏi và chốt 3 điểm để KHÔNG lật lại §1.6: (1) chỉ là ràng buộc lúc THIẾT KẾ form (lưu `FormApprovalSteps`), không suy luận runtime — `ResolveStepParticipantsAsync` (§5.5) không đổi gì; (2) cấp bậc xác định theo cây tổ chức thật (`OrgUnits.ParentId`+`OrgLevels.LevelNumber`), không dùng `JobTitles.RankOrder`; (3) bắt buộc, chặn lưu nếu thiếu cấp trung gian (không chỉ gợi ý). Cài `GuardOrgLevelChainAsync` (`FormDefinitionService.ReplaceRoutesAsync`) — chi tiết thuật toán ở §5.6a. Không bảng/migration mới. FE thêm nút "Điền chuỗi duyệt đủ cấp" ở `RouteCard.tsx` (chọn Từ/Đến đơn vị, tự động thêm bước Fixed cho từng cấp còn thiếu trên đúng nhánh cây, dùng lại `OrgLevelApi.getJobTitleSuggestions` để pre-select chức danh) — thuần trợ giúp, không bắt buộc dùng, lỗi thiếu cấp/sai thứ tự nếu tự chỉnh tay sai vẫn hiện qua toast lúc Lưu. Đã kiểm tra dữ liệu sống trước khi triển khai: không có route nào hiện có ≥2 bước Fixed nên không phá cấu hình cũ. **Verify**: `dotnet build` sạch, `npx tsc --noEmit`/`eslint` sạch. **Không tự test luồng ghi** (không tự lưu route thật) — để người dùng tự bấm thử qua UI. |
| 2026-09-05 | **Nhập mẫu đơn từ file Word — in đúng layout giấy gốc, đảo ngược một phần §1.5 chốt 2026-08-20.** Một số phòng ban đã có sẵn mẫu giấy Word chính thức và cần in đơn ra đúng y hệt layout đó, không chấp nhận quy về lưới generic như mọi form khác. Tham khảo 1 dự án thử nghiệm nội bộ (`Test-drag-drop-form/`, .NET+SQLite+Next.js độc lập) chứng minh khả thi cơ chế `docx-preview` (render `.docx` giữ nguyên layout) + `contentEditable`/native drag-drop (đặt field ngay trên văn bản) + `html-react-parser` (thay placeholder bằng input/giá trị lúc điền/xem) — nhưng **backend của POC đó là demo tối giản** (không snapshot lúc nộp, không validate field server-side, duyệt 1 cấp, auth giả header) nên **chỉ lấy phần cơ chế xử lý file ở client, không lấy mô hình lưu trữ**. Quyết định kiến trúc: cộng thêm, không thay thế — `FormFields`/`FormFieldConditions`/duyệt nhiều cấp/`FormAccesses`/permission/snapshot `FormSchemaJson` giữ nguyên 100%; chỉ thêm 1 cột `FormDefinitions.LayoutHtml` (nvarchar(max) NULL, migration `AddFormDefinitionLayoutHtml`) là HTML `docx-preview` nhúng `<span data-field-key>` khớp đúng `FormFields.FieldKey` thật (không phải id riêng như POC). BE: `UpdateLayoutAsync` (set thẳng, opaque, không validate nội dung) + endpoint `PUT .../layout`; `CloneAsync` copy `LayoutHtml` verbatim (FieldKey giữ nguyên khi clone nên vẫn khớp); `BuildFormSchemaJson` (`WorkflowRequestService`) snapshot thêm `LayoutHtml` — đơn cũ luôn in đúng layout lúc nộp dù `FormDefinitions.LayoutHtml` sau này đổi; `WorkflowRequestFormSchemaDto` (Draft, field sống) cũng trả kèm. FE: thêm `docx-preview`/`vietnamese-conversion` (jszip đã có sẵn) + `html-react-parser`; port gần nguyên vẹn từ POC 2 helper thuần `lib/caret.ts` (tìm điểm chèn caret từ toạ độ chuột) và `lib/vniFix.ts` (tự sửa font VNI-Times/VNI-Helve-Condense cũ, chỉ áp dụng cho run có khai `rFonts` là `VNI-*`, không sửa tràn lan). Field-designer thêm chế độ "Nhập từ Word" (`document-designer/`: `DocumentImportDropzone`/`DocumentFieldPalette`/`DocumentFieldCanvas`) song song chế độ kéo-khối-vào-canvas-trống hiện có (`@dnd-kit`) — cả 2 chế độ cùng ghi ra đúng 1 kiểu `FormFields` qua `replaceFields` sẵn có, khác nhau ở chỗ chế độ tài liệu tự tính `SortOrder` theo thứ tự field xuất hiện trong văn bản (đọc DOM lúc Lưu) thay vì kéo-sắp-xếp thủ công, và ẩn control `ColumnSpan` (vô nghĩa khi vị trí đã nằm trong layoutHtml) qua prop `hideColumnSpan` mới trên `FormFieldEditDialog`. Màn điền/xem/in đơn: `WorkflowRequestDataView.tsx` là nơi DUY NHẤT rẽ nhánh chế độ (theo `layoutHtml` có NULL hay không) nên `WorkflowRequestPrintView.tsx` không cần đổi gì; Draft rẽ nhánh tương tự giữa `DynamicFormRenderer.tsx` (lưới, không đổi) và `DocumentFormRenderer.tsx` (tài liệu, mới) — export thêm `evaluateFlags`/`toDateTimeLocalValue` từ `DynamicFormRenderer.tsx` để 2 renderer dùng chung đúng 1 thuật toán điều kiện ẩn/hiện, tránh lệch dần. Xoá layout (nút "Xoá layout, quay lại canvas trống") chỉ set `LayoutHtml=NULL`, giữ nguyên toàn bộ `FormFields`. **Verify**: `dotnet build`/`dotnet ef database update` (migration áp vào `YevWorkflowManagement` sống) sạch; `npx tsc --noEmit`/`pnpm lint` sạch (2 lỗi lint tồn tại từ trước ở `CreateOtFormPage.tsx`/module Attendance, không liên quan). **Chưa tự bấm thử qua UI thật** (không có công cụ điều khiển trình duyệt trong phiên này) — cần người dùng tự nhập 1 file `.docx` mẫu, đặt field, publish, nộp/duyệt/in thử trước khi coi là hoàn tất 100%, đặc biệt xác nhận đơn cũ vẫn giữ đúng layout khi sửa/xoá `LayoutHtml` của form sau đó (test cách ly qua snapshot). |
| 2026-09-07 | **Sửa `vniFix.ts`: chữ đúng nhưng vẫn hiện sai font ở trang có bảng dày đặc (bug người dùng báo, tự test lại bằng chính `docs/OT_Form.docx` thật).** Giải nén trực tiếp `OT_Form.docx` đối chiếu `document.xml`/`styles.xml`/`fontTable.xml` xác nhận: (1) mọi run khai VNI đều khai `rFonts` NGAY TRÊN run đó (không qua style/table-style kế thừa — không phải lỗi thiếu quét); (2) `applyVniFix` tự nó dịch đúng 100% các đoạn có byte VNI thật (`"Ban haønh laøn 5"` → `"Ban hành lần 5"` đúng); (3) `fontTable.xml` khai `VNI-Times`/`VNI-Helve-Condense` **không kèm font nhúng** (`w:family="auto"`, không có `word/fonts/*.fntdata`) — nghĩa là 2 font này CHƯA TỪNG có thật trên máy đọc file trừ khi máy đó tự cài legacy font. **Bug thật**: `fixVniDocx` chỉ sửa BYTE của chữ, không sửa tên font khai trong `w:rFonts` — sau khi sửa xong, run vẫn khai `ascii/hAnsi="VNI-Times"`, `docx-preview` truyền thẳng tên đó vào CSS `font-family`, trình duyệt không có font này nên tự chọn font thay thế không kiểm soát được — đây mới là nguồn "lỗi font chữ", không phải encoding. Sửa: sau khi sửa byte, ghi đè luôn `w:ascii`/`w:hAnsi` của run đó sang font Unicode thật luôn có sẵn (`VNI-Times*` → `"Times New Roman"`, `VNI-Helve*` → `"Arial"`) — áp dụng cho MỌI run có khai font VNI dù chữ có đổi byte hay không (run chữ thuần ASCII như "YAZAKI EDS VIETNAM CO., LTD." vẫn đổi font, vì giữ nguyên "VNI-Times" đằng nào cũng vô nghĩa). Điều kiện ghi đè file zip đổi từ `convertedCount === 0` sang `convertedCount === 0 && !didMutateFonts` để không bỏ sót trường hợp chỉ đổi font mà không đổi byte chữ nào. Xác minh bằng script Node đối chiếu logic (không phải test trình duyệt) trên đúng `docs/OT_Form.docx`: 69/214 run khai VNI, đúng 6 run có byte thật cần dịch (đều dịch đúng), có cả `VNI-Times` lẫn `VNI-Helve-Condense` trong file để xác nhận cả 2 nhánh thay font đều được kích hoạt. |
| 2026-09-29 | **Review toàn bộ module (8 agent song song, BE 4 project + FE ~50 file + component UI dùng chung) phát hiện 3 lỗi nghiêm trọng, đã sửa.** (1) `SendBackAsync` đặt `Status=SentBack` + bước đích về `Waiting` nhưng KHÔNG method nào từng đưa bước đó về `Current`/đơn về `InProgress` trở lại (mọi action khác chỉ nhận `Submitted`/`InProgress`) — đơn "mồ côi" vĩnh viễn, chỉ Cancel được; §5.6 vốn đã ghi "Nộp lại KHÔNG resolve lại người duyệt" ngụ ý phải có action Nộp lại nhưng chưa từng implement. Sửa: thêm `RequestAction.Resubmit=8`, `ResubmitRequestDto`, `WorkflowRequestService.ResubmitAsync` (đẩy bước ở `CurrentStepOrder`, 0→lấy `StepOrder` nhỏ nhất, về lại `Current`, đơn về `InProgress`, giữ nguyên snapshot người duyệt cũ) + endpoint `POST /{id}/resubmit`; nới `UpdateDraftAsync` nhận cả `SentBack` (trước chỉ `Draft`) để chủ đơn sửa `DataJson` trước khi nộp lại. FE: `WorkflowRequestDetail.tsx` cho chủ đơn sửa lại form (dùng chung `DynamicFormRenderer`/`DocumentFormRenderer` với Draft) + 2 nút "Lưu chỉnh sửa"/"Nộp lại" khi đơn `SentBack`, thay thông báo cũ "nghiệp vụ chưa được hỗ trợ". (2) `PublishAsync` chỉ chặn khi form chưa có field, KHÔNG chặn khi chưa có `FormRoutes` — form publish được dù chưa cấu hình nhánh duyệt, lỗi chỉ lộ ra ở `SelectRoute` lúc người dùng cuối nộp đơn thật. Sửa: thêm guard bắt buộc ≥1 `FormRoutes` chưa xoá. (3) `CloneAsync` sao chép `FormFields`+`FormFieldConditions`+`LayoutHtml` nhưng bỏ sót `FormRoutes`/`FormApprovalSteps`/`FormApprovalStepParticipants` — kết hợp lỗi (2), "Nhân bản form" tạo bản sao trông đầy đủ nhưng publish xong không đơn nào duyệt được. Sửa: `CloneAsync` giờ sao chép đủ cây route→step→participant (remap Id qua nhiều `SaveChangesAsync` trung gian, cùng pattern remap `FieldKey` đã có cho fields). Đợt sửa tiếp theo trong ngày (cùng review) đã dọn thêm: `ApplyApprovalAsync` khoá dòng `WorkflowRequests` (`WorkflowRequestRepository.LockForUpdateAsync`, `SELECT ... WITH (UPDLOCK, HOLDLOCK)`) trong 1 transaction để 2 Approver duyệt song song bước `ApproverMode.All` không còn miss update của nhau; `ApprovalDelegationService` sửa định nghĩa "đang hiệu lực" của `GuardNoDelegationChainAsync` thành đúng `FromDate <= now <= ToDate` (khớp §5.6, trước chỉ check `ToDate`) và thêm `GuardNoOverlappingDelegationAsync` chặn 1 người ủy quyền 2 lần chồng thời gian cho cùng loại đơn; `EmployeeService.ReplaceOrgUnitsAsync` đổi 2 luật ở §3.1 (unique `IsPrimary`, unique holder theo `IsUniquePerOrgUnit`) từ so "tổng số dòng"/"đang hiệu lực ngay bây giờ" sang so **chồng khoảng** `ValidFrom`/`ValidTo` (hàm `DateRangesOverlap`), đúng nghĩa "1 thời điểm bất kỳ" đã ghi trong §3.1; `ReplaceFieldsAsync` chặn xoá field làm `TargetFieldId` của 1 điều kiện (trước chỉ chặn `SourceFieldId`, còn `TargetFieldId` bị cascade DB xoá âm thầm không cảnh báo); case-sensitivity so khớp giá trị field condition (`Equals`/`NotEquals`/`Contains`) đổi sang `OrdinalIgnoreCase` khớp `SelectRoute`'s `ClassValue`; `WorkflowAttachmentStorageService` thêm `ResolveContainedPath` chặn path-traversal cho `Delete`/`GetPhysicalPath`/`SaveAsync`. FE: `FormFieldEditDialog` chặn đổi `fieldKey` trùng field khác (prop `existingFieldKeys`); nút Approve/Reject/SendBack/AddApprover ở `WorkflowRequestDetail` khoá chéo nhau lúc có hành động đang xử lý (`isActionInFlight`); `SignatureUpload` chỉ mount sau khi fetch chữ ký đã lưu xong (tránh lazy-init bắt được `null` do fetch tới muộn); layout .docx lưu xong mới xoá `pendingDocxBytes` sau khi `await onLayoutChange()` (tránh nháy về chế độ lưới/mất thao tác đang gõ); `OrgUnitList` dropdown "đơn vị cha" loại cả nhánh con, không chỉ đúng node đang sửa; `EmployeeOrgUnitsDialog` thêm kiểm tra trùng dòng (cùng đơn vị+chức danh) trước khi lưu, đổi `key={index}` sang `clientId` ổn định; `Tabs`/`FormDialog` thêm ARIA (`role=tablist/tab`, `aria-selected`, `aria-labelledby`, Escape-to-close); sửa `revokeObjectURL` gọi ngay sau `link.click()` có thể cắt ngang tải file ở một số trình duyệt. Cố ý CHƯA đụng: `CancelAsync` không xét uỷ quyền/trạng thái duyệt dở dang (audit trail vẫn giữ nguyên lịch sử duyệt trước khi huỷ, chưa rõ có cần chặn hay chỉ cảnh báo — để hỏi khi có nhu cầu thật); `GetByIdAsync` thiếu lọc `IsDeleted` (pattern có sẵn toàn bộ codebase, không riêng Workflow, sửa lẻ 1 chỗ không giải quyết gốc); `pageSize: 1000` giả định "lấy hết nhân sự" (cần endpoint "lấy tất cả" thật, không phải fix nhỏ); PUT thiếu `id` trong body ở `updateDraft`/`ApprovalDelegation.update` (hiện vô hại vì BE chỉ tin route `{id}`); `EmployeeSignaturePanel`/`WorkflowRequestDetail` im lặng khi fetch chữ ký lỗi (phân biệt "404 chưa đăng ký" khỏi lỗi thật cần sửa `lib/client.ts` app-wide, ngoài phạm vi 1 panel). **Verify**: `dotnet build Workflow.Api`/`Workflow.Infrastructure` (chain đầy đủ trừ `HostApi` — bị khoá bởi tiến trình dev đang chạy sẵn trên máy, không phải lỗi biên dịch) sạch cho cả 2 đợt sửa; `npx tsc --noEmit` và `pnpm lint` cũng sạch (3 warning còn lại thuộc module Attendance, không liên quan). **Chưa tự bấm thử qua UI thật** (không có công cụ điều khiển trình duyệt trong phiên này) — cần người dùng tự dựng 1 đơn có route, publish, nộp, trả về, sửa lại, Nộp lại, xác nhận đơn tiếp tục duyệt đúng bước đã trả về, thử 2 tab duyệt song song 1 bước `ApproverMode.All`, và thử các luồng org-unit/ủy quyền chồng ngày trước khi coi là hoàn tất 100%. |
