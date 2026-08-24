# workflow-module.md — Module Workflow (form builder động + duyệt nhiều cấp)

> Nguồn chân lý thiết kế cho module thứ 4 của hệ thống YEV Management.
> Sơ đồ quan hệ trực quan: [`docs/workflow-erd.drawio`](../workflow-erd.drawio) (mở bằng draw.io).
> Mô hình tham chiếu: **POWER EGG 3.5 — 汎用申請ワークフロー**.
>
> **Trạng thái tính tới 2026-08-20: MỚI CÓ THIẾT KẾ. 0 dòng code, 0 migration, chưa tạo project.**
> Tài liệu này viết TRƯỚC khi scaffold theo đúng CLAUDE.md §2 luật 2.

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

### 1.5 In phiếu — không mô phỏng mẫu giấy (chốt 2026-08-20)

**Bản in = chính layout form trên màn hình.** KHÔNG mô phỏng biểu mẫu giấy chính thức có mã số như
OT Form đang làm với `YEV-22-024`.

Hệ quả: **không cần bảng nào cho việc in.** Chi tiết ở §5.7.

### 1.6 Không có kiểu duyệt "tự leo lên cấp trên"

Bản thiết kế v3 từng có `OrgUnitScope = ApplicantAncestor` (bước duyệt tự leo cây tìm cấp trên của
người nộp). **Đã gỡ bỏ.** Attendance thử đúng cơ chế này và loại ngày 2026-08-06 — xem comment trong
`Attendance.Domain/Entities/JobTitle.cs`:

> *"KHÔNG dùng để tự bắc cầu qua mọi cấp đang có người giữ nữa — bắc cầu tự động khiến 1 đơn phải
> qua quá nhiều bước nếu Phòng ban có đủ người ở mọi cấp."*

---

## 2. Bản đồ 25 bảng

| Nhóm | Bảng |
|---|---|
| **Tổ chức + nhân sự** (5) | `OrgLevels` · `OrgUnits` · `JobTitles` · `Employees` · `EmployeeOrgUnits` |
| **Định nghĩa form** (10) | `FormCategories` · `FormCategoryCoordinators` · `FormDefinitions` · `FormFields` · `FormFieldConditions` · `FormDataSources` · `FormAccesses` · `FormRoutes` · `FormApprovalSteps` · `FormApprovalStepParticipants` |
| **Dữ liệu đơn** (6) | `WorkflowRequests` · `WorkflowRequestSteps` · `WorkflowRequestStepParticipants` · `WorkflowRequestHistories` · `WorkflowAttachments` · `WorkflowRequestEmailTokens` |
| **Độc lập / cấu hình** (4) | `ApprovalDelegations` · `EmployeeSignatures` · `WorkflowSequences` · `WorkflowSettings` |

Trục chính của thiết kế: **form → nhánh → bước → người**, rồi snapshot toàn bộ lúc nộp.

---

## 3. Entity chi tiết

> Quy ước chung áp cho **mọi** entity: `partial class`, POCO thuần, không phụ thuộc gì
> (CLAUDE.md §3.2). Bảng cấu hình có `IsDeleted`; bảng audit/counter/settings **không** có.
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
  - 1 cặp (`OrgUnitId`, `JobTitleId`) chỉ có **1 người** giữ tại một thời điểm — đây là điều kiện để
    resolve người duyệt theo chức danh ra kết quả xác định.

**Đây là bảng duy nhất trả lời "ai đang là Trưởng phòng Kế toán"** — nên cũng là chỗ duy nhất phải
sửa khi nhân sự thay đổi.

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

Token hợp lệ khi: chưa `UsedAt`, chưa quá `ExpiresAt`, và `StepOrder` vẫn đúng bước hiện tại của đơn.

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

#### `EmployeeSignatures` — chữ ký đăng ký sẵn

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int IDENTITY | PK |
| `EmployeeId` | int | FK → `Employees`, **Cascade**. **UNIQUE** |
| `SignatureImage` | varbinary(max) | ⇄ chuỗi base64 trong JSON |
| `UpdatedAt` | datetime2 | |

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
                     AddApprover=6, Comment=7
```

---

## 5. Luật nghiệp vụ & quy ước kỹ thuật

### 5.1 Nộp đơn — thứ tự bắt buộc

Toàn bộ nằm trong **một transaction**. Nếu bất kỳ bước nào fail thì không tạo gì cả.

1. Kiểm tra `FormDefinition.IsPublished = true`.
2. Kiểm tra người nộp nằm trong `FormAccesses` (theo Role / OrgUnit / Employee).
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
- Nộp lại **KHÔNG** resolve lại người duyệt — giữ nguyên snapshot cũ.

**Thêm người duyệt giữa chừng** — chỉ khi `AllowAddApprover = 1`:
- Chèn `WorkflowRequestSteps` mới với `IsAdHoc = 1`, `InsertedByEmployeeId` = người chèn.
- Đánh lại `StepOrder` các bước phía sau trong cùng transaction.
- Ghi history `Action = AddApprover`.

### 5.7 In phiếu (chốt 2026-08-20)

**Bản in = chính layout form trên màn hình.** Không mô phỏng biểu mẫu giấy chính thức.

| Phần trên bản in | Nguồn |
|---|---|
| Đầu phiếu | `RequestCode`, tên form, người nộp, ngày nộp, trạng thái |
| Thân phiếu | dựng từ **`FormSchemaJson`** (snapshot) + **`DataJson`**, theo `SortOrder` và `ColumnSpan` |
| Khối chữ ký | dựng từ `WorkflowRequestSteps` + `WorkflowRequestHistories.SignatureImage` |
| Đính kèm | danh sách tên file từ `WorkflowAttachments` |

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
tên constraint tiếng Việt ở CLAUDE.md §3.5 (thứ chỉ dành cho bảng kế thừa như `PK_ThietBis`).
Dùng tên tiếng Anh chuẩn EF Core: `PK_OrgUnits`, `FK_OrgUnits_OrgLevels_OrgLevelId`,
`IX_EmployeeOrgUnits_OrgUnitId_JobTitleId`.

---

## 6. API dự kiến

Route `api/[controller]`, `[ApiController]`, controller kế thừa `WorkflowBaseController`.
Mọi response bọc `ApiResponse<T>`; danh sách phân trang trả `PagedResponse<T>` (CLAUDE.md §3.4).

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
| | `POST /{id}/approve` · `POST /{id}/reject` · `POST /{id}/send-back` · `POST /{id}/add-approver` |
| | `GET /WorkflowRequest/my-requests` · `/pending-my-approval` · `/visible-to-me` |
| | `GET /WorkflowRequest/{id}` (kèm steps + participants + histories cho màn xem & in) |
| Đính kèm | `POST /WorkflowRequest/{id}/attachments` · `DELETE /attachments/{id}` · `GET /attachments/{id}/download` |
| Chữ ký | `GET /EmployeeSignature/me` · `PUT /EmployeeSignature/me` |
| Ủy quyền | `ApprovalDelegation` CRUD |
| Email | `GET /WorkflowApproval/by-token/{token}` · `POST /WorkflowApproval/by-token/{token}` |
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
| **1** | Nền tổ chức + nhân sự, màn hình quản trị cây kéo-thả | `OrgLevels` `OrgUnits` `JobTitles` `Employees` `EmployeeOrgUnits` |
| **2** | Form designer + renderer, tạo/lưu nháp. **Nặng nhất về FE.** | `FormCategories` `FormCategoryCoordinators` `FormDefinitions` `FormFields` `FormFieldConditions` `FormDataSources` `FormAccesses` |
| **3** | Luồng duyệt — hết pha này hệ thống dùng được thật | `FormRoutes` `FormApprovalSteps` `FormApprovalStepParticipants` `WorkflowRequests` `WorkflowRequestSteps` `WorkflowRequestStepParticipants` `WorkflowRequestHistories` `WorkflowSequences` |
| **4** | Bổ trợ: đính kèm, chữ ký, duyệt qua email, ủy quyền, in, xuất Excel | `WorkflowAttachments` `EmployeeSignatures` `WorkflowRequestEmailTokens` `ApprovalDelegations` `WorkflowSettings` |
| **5** | Gộp nền với Attendance — **chỉ khi đạt tiêu chí §1.3** | không thêm bảng |

**Ước lượng có căn cứ:** Attendance mất ~3,5 tuần (27/07 → 19/08/2026) cho 10,8k dòng BE + 12,4k dòng
FE + 35 migration, với **một** loại đơn cố định và **không** có designer nào. Workflow phải làm mọi
loại đơn cộng hai giao diện designer (form và luồng duyệt) — hãy tính lớn hơn đáng kể.

---

## 9. Còn để ngỏ

| Việc | Ghi chú |
|---|---|
| **Thông báo** | POWER EGG báo khi có đơn chờ duyệt. Hiện chỉ có token email cho việc *duyệt*, chưa có gì cho việc *báo*. Có thể xử lý ở tầng service, chưa chắc cần bảng. |
| **Xuất Excel/PDF danh sách đơn** | POWER EGG có. Chưa mô hình hóa, dồn vào pha 4. |
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
