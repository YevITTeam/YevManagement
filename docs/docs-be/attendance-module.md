# attendance-module.md — Module Attendance (Chấm công / Giấy tăng ca)

> **Đang chạy thật.** Giấy tăng ca (OT Form): duyệt nhiều cấp theo Cây chức vụ + đơn "theo chuyền" của
> Chế Tạo, đơn tổng, phiếu ăn, giới hạn/lũy kế giờ OT, chữ ký + mật khẩu cấp 2, duyệt qua email, 4 báo
> cáo Excel + phiếu PDF hàng loạt, AI Chat lập đơn, import Excel nhân sự/lũy kế. Việc còn nợ: xem §3 cuối file.
>
> File này là tài liệu **cho dev BE** (lý do thiết kế, migration, cấu trúc code nội bộ).
> **FE đọc [attendance-api-fe.md](attendance-api-fe.md)** — hợp đồng API (request/response mẫu, enum,
> checklist màn hình).

---

## MỤC LỤC ĐỌC NHANH — đọc file này theo lát cắt

> ⚠ **File >140 KB. KHÔNG `Read` cả file** — đọc trọn nó đốt sạch context của phiên (AGENTS.md §2 luật 7).
> Cách dùng: tra bảng dưới lấy **tên mục**, `Grep` chính chuỗi đó trên file này để biết số dòng, rồi
> `Read` với `offset`/`limit` (dư ±20 dòng là đủ). Cần 1 tên field/endpoint cụ thể thì `Grep` thẳng nó.
> *(Bảng này cố ý KHÔNG ghi số dòng — file sửa gần như hằng tuần, số dòng sẽ sai ngay.)*

| Cần biết gì | Grep mục |
|---|---|
| Entity + luật nghiệp vụ còn lại (Trường hợp OT, chữ ký, từ chối, danh sách) | `§Entity`, `§Business Logic` |
| **Lũy kế & giới hạn giờ OT** (sổ lũy kế, dự kiến, snapshot, mốc ngày/tháng/năm, mốc riêng từng NV) | `§Lũy kế & giới hạn giờ OT` |
| **Phiếu ăn** (3 bậc, khung OT sớm, `DidEat`, đồng bộ khi sửa đơn, nơi chứa công thức) · **cấu hình `AttendanceSetting`** (field + mặc định, permission, FE cache) | `§Phiếu ăn`, `§Cấu hình phiếu ăn & giới hạn lũy kế` |
| **Lịch ngày nghỉ + Trường hợp OT tự động** (TH1/TH2/TH3, mốc ngày nghỉ, import theo năm) | `§Lịch ngày nghỉ` |
| **Nhân sự dưới chuyền** (`ProductionEmployee`, import/export file Chế Tạo) | `§Import nhân sự dưới chuyền` |
| **Đơn tổng** (`OtFormBatch`, mail tổng hợp hằng ngày cho 3 cấp quản lý) | `§Đơn tổng` |
| **Email**: token xác thực, mail duyệt/từ chối/loại NV, SMTP, template (font/dark-mode), test-email | `§Xác thực qua email` · mail tổng hợp: `§Đơn tổng` |
| Mật khẩu cấp 2 · song ngữ Vn/Jp · popup từ chối trên trang email | `§Mật khẩu cấp 2`, `§Song ngữ Vn/Jp`, `§Popup xác nhận Từ chối` |
| Loại nhân viên khỏi đơn (kênh email, lý do, thông báo) | `§Loại nhân viên khỏi đơn` · quyền + màn Duyệt: `§Cây chức vụ & Cây duyệt` |
| **Duyệt đơn**: Chức vụ, 3 cây duyệt (Bộ phận/Nhóm/Chuyền), suy luận chuỗi, snapshot, ai tạo/sửa/loại/xoá đơn, quyền tự cấp theo Chức vụ, Người phụ trách, đơn theo chuyền | `§Cây chức vụ & Cây duyệt` (các `####` bên trong) |
| **Permission & Role** (3 nguồn quyền, danh mục mã, whitelist theo Chức vụ, ẩn mục FE) · **Phân quyền Coordinator** (Bộ phận/Nhóm, quyền tự cấp, 3 guard scope) | `Permission & Role của Attendance`, `§Phân quyền Coordinator` |
| Phạm vi xem nhân viên (`Employee.View` toàn công ty → tự scope), `my-scope` | `§Phạm vi xem nhân viên` |
| Migration & DB | `### §DB` |
| **Danh sách controller/endpoint đã có** | `## 1. Cấu trúc code đã có` |
| **Báo cáo & export Excel/PDF** (ticket-report, 4 Excel, phiếu ZIP theo Line/Nhóm) | `§Báo cáo & export dưới chuyền` |
| **Import Excel** (lũy kế tháng, liên kết Identity, bẫy ClosedXML) | `§Import lũy kế OT` (có luôn quy ước đọc ClosedXML), `§Import Excel liên kết Identity` |
| Danh sách đơn (5 tab, filter, lịch chờ duyệt, Tất cả đơn, duyệt hàng loạt) | `§Danh sách đơn` · luật sửa/loại đơn: `§Cây chức vụ & Cây duyệt` |
| Luật giao diện (màu, khung cuộn modal, SearchableSelect) | `§Giao diện & song ngữ`, `§Chuẩn giao diện chung` |
| **Việc còn nợ / cố ý chưa làm** | `## 3. Còn nợ` |

**Quy ước viết tiếp file này** (AGENTS.md §2 luật 8): sửa thẳng vào mục đang mô tả phần đó, **không** nối
thêm mục `§… (ngày)` cho mỗi lần chỉnh. Quyết định cũ bị thay thế → gộp/xoá mục cũ, giữ 1 dòng "trước
làm X, bỏ vì Y" nếu lý do còn giá trị. Các mục có hậu tố "— trạng thái chốt" là đã được gộp theo cách này.


## 0. Chốt yêu cầu (AGENTS.md §2 luật 2)

### §Entity (`Attendance.Domain/Entities/`)

Danh mục (master data, đều có `IsDeleted`):
| Entity | Thuộc tính chính | Song ngữ (Vn/Jp)? |
|---|---|---|
| `Department` | `DepartmentCode`(unique), `DepartmentNameVn`, `DepartmentNameJp?` | Có — **entity mới** (ERD gốc không vẽ bảng Department dù OT FORM có `DepartmentId`). Tạo riêng cho Attendance, KHÔNG dùng `Asset.DeviceDepartment` (khác DB, khác ngữ cảnh nghiệp vụ). |
| `Group` | `GroupCode`(unique), `GroupNameVn`, `GroupNameJp?`, `DepartmentId`(FK, **1 Department - N Group**, theo pattern `Asset.Domain.Entities.DeviceGroup.DepartmentId`) | Có |
| `Reason` | `ReasonNameVn`, `ReasonNameJp?` | Có |
| `OtCase` | `Code`(unique), `Description?`, `RequireSignature:bool`, `RequiredApprovalLevel:int` (2026-08-07: đọc như enum **`JobTitleTerminalLevel`** — `DepartmentManager/WorkshopManager/GeneralDirector` — thay vì `ApprovalLevel` cũ, xem §Cây chức vụ & Cây duyệt; giá trị int 1/2/3 trùng nhau giữa 2 enum nên KHÔNG cần migration đổi kiểu cột) | Không |
| `Employee` | `Code`(unique), `FirstName`, `LastName`, `UserName:string?`(unique filtered — tài khoản AD, nullable), `GroupId:int?`(FK), `DepartmentId:int?`(FK), `JobTitleId:int?`(FK), `CustomMonthlyOtHourLimit?`, `CustomYearlyOtHourLimit?` | Tên riêng — không dịch. `GroupId`/`DepartmentId` bắt buộc hay cấm tuỳ `JobTitle.TerminalLevel` — xem §Cây chức vụ & Cây duyệt. **Không còn cột lũy kế nào**: `MonthToDate`/`YearToDate`/`Projected*` tính lúc đọc từ `EmployeeAccumulationHistory`/`OtFormEmployee`, xem §Lũy kế & giới hạn giờ OT. |
| `JobTitle` | `Code`(unique), `Name`, `RankOrder:int`, `TerminalLevel:int` (enum `JobTitleTerminalLevel`), `IsLineScoped:bool` | Tên riêng — không dịch. Master data chức vụ; ý nghĩa từng field ở §Cây chức vụ & Cây duyệt. |
| `DepartmentApprovalStep` | `DepartmentId`(FK), `StepOrder:int`, `JobTitleId`(FK), `RequiresSignature:bool` | Không FK song ngữ. Cây duyệt cấu hình tay cho từng Bộ phận, chỉ chứa 3 cấp cuối (`TerminalLevel != None`). Quản lý kiểu thay nguyên danh sách; không có unique index (validate không trùng `JobTitleId` ở Service). Xem §Cây chức vụ & Cây duyệt. |
| `GroupApprovalStep` | `GroupId`(FK), `StepOrder:int`, `JobTitleId`(FK), `RequiresSignature:bool`, `IsResponsible:bool` | Không FK song ngữ. Cây duyệt cấp trung gian (`TerminalLevel = None`) của từng Nhóm. Nếu có bước thì phải có **1–2 bước** `RequiresSignature` (khớp 2 ô "Người đề nghị" trên giấy in); tối đa 1 bước `IsResponsible`. |
| `ProductionApprovalStep` | `DepartmentId`(FK), `StepOrder:int`, `JobTitleId`(FK), `RequiresSignature:bool`, `IsResponsible:bool` | Không FK song ngữ. Cây duyệt riêng cho đơn **theo chuyền**: 1 danh sách duy nhất/Bộ phận, từ Line Leader tới Director. |
| `DepartmentApprovalStepCoordinator` | `DepartmentId`(FK), `EmployeeId`(FK), `IsDeleted` | Người phụ trách cấu hình Cây duyệt của 1 Bộ phận, Admin gán tay. Phải thuộc đúng Bộ phận. Xem §Phân quyền Coordinator. |
| `GroupApprovalStepCoordinator` | `GroupId`(FK), `EmployeeId`(FK), `IsDeleted` | Như trên nhưng theo Nhóm; tách biệt hoàn toàn với bản Bộ phận. |
| `JobTitlePermission` | `JobTitleId`(FK), `PermissionCode:string`, `IsDeleted` | Permission Identity tự cấp cho người giữ Chức vụ (code lưu chuỗi, không FK vì khác DB). Chỉ nhận code trong whitelist. Xem §Cây chức vụ & Cây duyệt (mục Quyền theo Chức vụ). |

> Đã bỏ `Area`/`Line` khỏi OtForm (không cần "tên công đoạn" ở cấp này). Attendance định danh người dùng bằng `UserName:string` (theo convention `Asset.Domain.Models.AuditTrail.ChangedBy`). `OtForm.CreatedByFullName` và `OtFormApprovalHistory.ApproverFullName` là snapshot claim `FullName` lúc thao tác, để mọi nơi hiển thị tên người dùng thay vì `UserName` thô.

Nghiệp vụ OT Form:
| Entity | Thuộc tính chính | Quan hệ | Ghi chú |
|---|---|---|---|
| `OtForm` | `GroupId:int?`/`DepartmentId`/`ReasonId`/`OtCaseId` (FK, Restrict), `StartTime/EndTime:TimeOnly`, `SubReason?`, `TotalHour:decimal(10,2)`, `Date:DateOnly`, `NumberOfEmployee`, `IsProductionForm:bool`, `CreatedByUserName:string`, `CreatedByFullName:string?`, `Status:int` (enum `OtFormStatus`: `InApproval=0/Completed=1/Rejected=2`), `ApprovalChainWarning:string?`, `CreatorSignatureImage:byte[]?`, `DeletedByUserName/DeletedByFullName:string?`, `DeletedAt:DateTime?`, `DeleteReason:string?`, `IsDeleted` | N-1 tới 4 danh mục trên; 1-N `OtFormEmployee`; 1-1 `ProcessPart`; 1-N `OtFormApprovalHistory`; 1-N `OtFormApprovalStep` | `GroupId` null với đơn theo chuyền. Chuỗi duyệt, snapshot, tự ký của người tạo, xoá đơn: xem §Cây chức vụ & Cây duyệt. |
| `OtFormApprovalStep` | `OtFormId`(FK Cascade), `StepOrder:int`, `JobTitleId`(FK Restrict), `JobTitleCodeSnapshot/JobTitleNameSnapshot:string`, `RequiresSignatureSnapshot/IsResponsibleSnapshot:bool`, `TerminalLevelSnapshot:int`, `Status:int` (enum `OtFormApprovalStepStatus`: `Pending=0/Approved=1/Rejected=2/Skipped=3`), `IsDeleted` | N-1 OtForm (Cascade), N-1 JobTitle (Restrict), 1-N `OtFormApprovalStepCandidate` | Chuỗi bước duyệt SNAPSHOT lúc tạo đơn, không tính lại theo tổ chức hiện tại. Xem §Cây chức vụ & Cây duyệt. |
| `OtFormApprovalStepCandidate` | `OtFormApprovalStepId`(FK Cascade), `EmployeeId:int`, `UserName/FullName:string` | N-1 OtFormApprovalStep (Cascade) | 1 dòng/người đủ điều kiện duyệt bước đó tại thời điểm snapshot; ai thao tác trước thì tính. |
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?`, `IsRemoved:bool`, `RemovedByUserName?`, `RemovedByFullName?`, `RemovedAtLevel:int?`, `RemovedAt:DateTime?`, `RemoveReason?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. `StartTime`/`EndTime` đều chỉnh riêng được cho từng người (lúc tạo lẫn lúc sửa đơn) nhưng phải nằm trong khung giờ của đơn: `OtForm.StartTime <= StartTime < EndTime <= OtForm.EndTime` — validate ở `OtFormService.EnsureEmployeeTimeWithinForm` (gọi từ `ValidateEmployeesAsync` và `UpdateAsync`). `StartTime` không gửi (`null`) → lấy `OtForm.StartTime` khi tạo / giữ nguyên giá trị hiện có khi sửa. Kiểm tra trùng giờ, giới hạn giờ OT, phiếu ăn đều tính theo `StartTime` riêng của từng người. (Trước 2026-09-24 `StartTime` luôn bằng `OtForm.StartTime`, server tự set — mở ra theo yêu cầu người dùng.) Các cột `Removed*` (2026-07-30) là **soft-remove** — người bị 1 bước duyệt loại khỏi đơn (xem §Loại nhân viên khỏi đơn) KHÔNG bị xoá dòng, chỉ đánh dấu `IsRemoved=true` + snapshot ai/lúc nào/lý do gì, để giữ nguyên audit trail của 1 văn bản có tính pháp lý. **`RemovedAtLevel` đổi ý nghĩa (2026-08-07)**: giờ lưu `OtFormApprovalStep.StepOrder` (trước đây là `ApprovalLevel` cũ) — giữ nguyên tên cột/field cho tương thích FE, chỉ đổi nội dung. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `MainTicketCount/SecondaryTicketCount/MilkCount:int`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn. `MainTicketCount`/`SecondaryTicketCount`/`MilkCount` (phiếu chính/phiếu phụ/sữa, 2026-07-16, migration `AddMealTicketCountsToProcessPart`) — số lượng từng loại phiếu ăn **chung cho cả đơn** (không phải theo từng nhân viên), người lập đơn tự nhập tay khi `IsEat = true`; BE không tự tính từ danh sách nhân viên hay từ `OtFormEmployeeDto.IsEligibleForMeal`. |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserName:string`, `ApproverFullName:string?`, `OtFormApprovalStepId:int` (FK Restrict → `OtFormApprovalStep` — **đổi từ `ApprovalLevel:int` 2026-08-07**), `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm, N-1 OtFormApprovalStep | Audit trail từng bước duyệt; `SignatureImage`/`ApproverFullName` là snapshot tại thời điểm ký (không tham chiếu ngược Identity). |
| `UserSignature` | `UserName:string`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit (nguồn thật = `OtFormApprovalHistory.SignatureImage`). |
| `SecondaryPassword` | `UserName:string`(unique), `PasswordHash:string`, `UpdatedAt` | Không FK thật | Mật khẩu cấp 2 (2026-07-30) — bắt buộc nhập lại ở MỌI hành động ký/duyệt OtForm (submit/approve/reject, kể cả kênh email), xem §Mật khẩu cấp 2. `PasswordHash` dùng `Microsoft.AspNetCore.Identity.PasswordHasher<object>`, không lưu plaintext. |
| `PendingSecondaryPasswordConfirmation` | `UserName:string`, `PasswordHash:string`, `Token:string`(unique), `ExpiresAt`, `ConfirmedAt:DateTime?`, `CreatedAt` | Không FK thật | Y hệt `PendingSignatureConfirmation` — mật khẩu cấp 2 mới KHÔNG áp dụng ngay, chờ xác nhận qua email. |
| `WorkCalendarDay` | `Date:date` (unique), `DayType:int` (1 Chủ nhật / 2 Ngày lễ / 3 Nghỉ đặc biệt), `Note?:nvarchar(255)` | Không FK | Lịch ngày nghỉ của công ty, 1 dòng/ngày nghỉ, không `IsDeleted`. Xem §Lịch ngày nghỉ. |
| `AttendanceSetting` | cấu hình phiếu ăn, giới hạn giờ OT ngày/tháng/năm, `BatchAutoSendTime:TimeOnly` | Không FK thật | Cấu hình dùng chung — bảng LUÔN đúng 1 dòng, mirror `Asset.Domain.Entities.AssetSetting`. Danh sách field + mặc định ở §Cấu hình phiếu ăn & giới hạn lũy kế; `BatchAutoSendTime` là giờ `OtFormBatchBackgroundService` gom "Đơn tổng", xem §Đơn tổng. |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (`InApproval/Completed/Rejected`), `OtFormApprovalStepStatus` (`Pending/Approved/Rejected/Skipped`), `ApprovalAction` (`Submitted/Approved/Rejected`), `JobTitleTerminalLevel` (`None/DepartmentManager/WorkshopManager/GeneralDirector`), `MealTicketType`, `OtFormBatchStatus`/`OtFormBatchFormDecision` (Đơn tổng), `OtFormEditActionType`, `WorkCalendarDayType`. Lưu dưới dạng `int` trên entity, không dùng `HasConversion`.

### §Business Logic (đã code trong `OtFormService`)

Chốt theo phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam). Cơ chế duyệt (chuỗi bước động theo Chức vụ, ai tạo/sửa/loại
nhân viên/xoá đơn) nằm ở **§Cây chức vụ & Cây duyệt**; mục này chỉ giữ các luật nghiệp vụ còn lại.

- **Trường hợp OT tự khớp theo dữ liệu, không do người dùng tuỳ chọn** (`EnsureOtCaseMatchesRulesAsync`): `TH3` nếu có nhân
  viên vượt giới hạn OT tháng/năm; ngược lại `TH2` nếu ngày đơn là ngày nghỉ (Chủ nhật/lễ/nghỉ đặc biệt, xem §Lịch ngày
  nghỉ); còn lại `TH1`. Chọn sai `OtCase` thì BE từ chối ("Trường hợp OT phải là TH… vì …"). Cấp duyệt cuối của đơn lấy từ
  `OtCase.RequiredApprovalLevel` (đọc như `JobTitleTerminalLevel`, int 1/2/3): mặc định TH1 → `DepartmentManager`, TH2 →
  `WorkshopManager`, TH3 → `GeneralDirector`.
- **Chữ ký.** Bước duyệt nào có `RequiresSignatureSnapshot = true` thì người duyệt phải đã đăng ký `UserSignature`. Ảnh chữ ký
  **không nhận qua request body**: BE lấy từ `UserSignature` của người đang thao tác rồi **snapshot** vào
  `OtFormApprovalHistory.SignatureImage` cùng `ApproverFullName` (claim `FullName` lúc ký). Nhờ vậy đơn cũ luôn hiển thị
  đúng chữ ký/tên tại thời điểm ký, kể cả khi người đó đổi chữ ký hay bàn giao chức vụ. Cột `OtCase.RequireSignature` còn
  tồn tại trong entity/DTO nhưng **logic duyệt không còn đọc nó** — cờ ký nằm theo từng bước của cây duyệt.
- **In phiếu.** Chữ ký là ảnh để stamp lên PDF, không phải chữ ký số/PKI. FE tự dựng PDF từ `GET /api/OtForm/{id}` (đủ thông
  tin đơn, nhân viên, `ProcessPart`, `approvalHistories`/`approvalSteps`); BE không dùng thư viện PDF. Ô "Tên công đoạn / 工程名"
  ở đầu giấy gốc không có field lưu trữ. Ánh xạ ô giấy → field: `attendance-otform-pdf-mapping.md`.
- **Từ chối.** `RejectOtFormDto.Comment` và mật khẩu cấp 2 đều bắt buộc; không có chữ ký (`SignatureImage = null`); `Status →
  Rejected`.
- **Danh sách** (`OtFormController`): `my-forms` (đơn mình tạo, `OTForm.View`), `pending-approvals` (+ `/count`, `/dates`,
  `OTForm.Approve`), `my-actions` (đơn mình đã xử lý), `my-participations` (đơn có tên mình trong danh sách tăng ca; tài khoản
  chưa liên kết `Employee` trả rỗng, không lỗi), `all-forms` (`OTForm.ViewAll`). Mỗi item có `approvalSummary` (lịch sử duyệt
  rút gọn, không `Comment`/`SignatureImage`) và `isEditable` — FE dùng thẳng, không tự so sánh `status`. FE gộp các danh sách
  thành 1 màn nhiều tab nhưng vẫn gọi API riêng từng tab (xem `attendance-api-fe.md §4.2`).

### §Lũy kế & giới hạn giờ OT

Ba loại số giờ, **không loại nào lưu trên `Employee`** (bảng `Employees` không có cột lũy kế nào): lũy kế **thật** (sổ lũy kế), lũy kế **dự kiến** (tính lúc đọc),
và **snapshot** trên từng dòng đơn. Giờ OT của một dòng luôn là `CalculateOtHours` (giờ thô trừ nghỉ ăn nếu `DidEat`, ca khớp
đúng khung OT sớm thì không trừ — xem §Phiếu ăn).

**1. Lũy kế thật = sổ `EmployeeAccumulationHistory`** (`EmployeeId, Year, Month, TotalHours`, unique `(EmployeeId, Year, Month)`).
`Month = 0` là **số dư đầu kỳ** của năm: tính vào lũy kế năm, không tính vào lũy kế tháng nào. Ba đường ghi:

| Đường | Cách ghi |
|---|---|
| Đơn đạt `Completed` | `OtFormService.AccumulateEmployeeHoursAsync` (gọi từ `CreateAsync` khi chuỗi duyệt rỗng, từ `ApproveAsync` khi hết bước `Pending`) cộng giờ từng dòng `!IsRemoved` vào `(EmployeeId, OtForm.Date.Year, OtForm.Date.Month)`. Đơn `Rejected` hoặc dừng giữa chừng không ghi gì. |
| Sửa tay | `PUT /api/Employee/{id}/accumulation-history` (`Attendance.EmployeeAccumulation.Update`): đặt lại 12 tháng + số dư đầu kỳ của 1 năm, không bắt lý do, không ghi log. `GET .../accumulation-history/manage` cùng quyền để nạp form sửa. Admin luôn qua; Người phụ trách phải đúng Bộ phận/Nhóm của nhân viên (`EnsureCanManageDeptOrGroupScopeAsync`). |
| Import | `POST /api/EmployeeImport/monthly-accumulation?year=&month=` (cột B = MNV, C = tổng giờ tháng, D tuỳ chọn = tổng giờ cả năm) và `POST /api/ProductionEmployeeImport/apply-accumulation`; quyền `Attendance.EmployeeAccumulation.Import`. Cộng **chênh lệch** (không ghi đè) nên chạy lại cùng file ra delta 0. Cột D ghi chênh lệch vào dòng `Month = 0`. Chi tiết file ở §Import lũy kế OT theo tháng. |

Xem lịch sử: `GET /api/Employee/{id}/accumulation-history?year=` (`Attendance.OTForm.Approve`, phạm vi theo Cây chức vụ qua `EnsureInAccumulationScopeAsync`) trả 12 tháng + `InitialBalanceHours` + `YearTotalHours`. FE: `AccumulationHistoryModal`/`AccumulationHistoryTable`, `AccumulationLookupPage`.

**Số hiển thị ở danh sách nhân viên** (`MonthToDate`/`YearToDate` trên `EmployeeDto`) tính lúc đọc bằng sum sổ theo **tháng/năm thực tế hôm nay** (đồng hồ server):
`MonthToDate` = dòng `Month == tháng nay`, `YearToDate` = các dòng `Month <= tháng nay` (gồm `Month = 0`). Hệ quả: đơn ghi ngày tương lai chỉ "hiện" khi tới
tháng đó dù đã `Completed` từ trước; import/xem năm khác năm nay vẫn ghi đúng sổ nhưng chỉ xem được qua "Xem lịch sử lũy kế" chọn năm đó.

**2. Lũy kế dự kiến** — chỉ để cảnh báo, tính lúc đọc, scope theo `targetDate` (ngày trên đơn **đang tạo**, không phải hôm nay; bỏ trống = hôm nay). Đơn hợp lệ =
`!IsRemoved && OtForm.Status != Rejected && !OtForm.IsDeleted`:

- **Ngày** = mọi đơn hợp lệ của nhân viên đúng ngày đó (sổ không có số theo ngày).
- **Tháng** = dòng sổ của tháng `targetDate` + đơn hợp lệ còn `InApproval` trong tháng đó.
- **Năm** = toàn bộ dòng sổ của năm (gồm `Month = 0`) + đơn hợp lệ còn `InApproval` trong năm.
- Đơn `Completed` **không cộng lại** vì giờ đã nằm trong sổ (nơi cũng chứa số import và số sửa tay).

Công thức nằm ở **3 chỗ phải giữ đồng bộ** (mỗi service tự chứa bản `CalculateProjectedHours`/`CalculateOtHours`, không gọi chéo):
`OtFormService.ComputeAccumulatedHoursBatchAsync(employeeIds, targetDate, mealSettings, excludeFormId?)` (batch, trả `(Day, Month, Year)`; `excludeFormId` để sửa đơn
không tự cộng dồn chính các dòng hiện có), `EmployeeService.GetByGroupIdAsync(groupId, targetDate?)` (`GET /Employee/by-group/{id}?date=`),
`ProductionEmployeeService.SearchAsync(..., targetDate)` (`GET /ProductionEmployee/search?date=`). Chỉ hai hàm sau trả `ProjectedDayToDate`/`ProjectedMonthToDate`/`ProjectedYearToDate`
có nghĩa; các `EmployeeDto` khác để 0. FE (`CreateOtFormPage.tsx`) luôn truyền `date` = ngày trên đơn và gọi lại khi đổi ngày.

**3. Snapshot trên đơn** — `OtFormEmployee.MonthToDate`/`YearToDate` (decimal(10,2)) chụp **lũy kế dự kiến tháng/năm trước khi cộng chính đơn này** tại lúc dòng được thêm
(`CreateAsync` và nhánh thêm nhân viên của `UpdateAsync`, lấy từ `ComputeAccumulatedHoursBatchAsync`; query chạy trước khi lưu đơn nên không tự đếm mình). Đóng băng giống
`OtFormApprovalHistory.SignatureImage`: xem lại đơn cũ ra đúng số lúc lập. `GetByIdAsync` đọc thẳng cột này, không join `Employee`. Dòng tạo trước migration
`AddAccumulationSnapshotToOtFormEmployee` có 0 và không khôi phục được.

**4. Giới hạn giờ OT** (`AttendanceSetting`, Admin sửa qua `PUT /api/AttendanceSetting`):

| Mốc | Mặc định | Hiệu lực |
|---|---|---|
| `DailyOtHourLimit` | 4h | **Chặn cứng** ngày làm việc |
| `DailyOtHourLimitHoliday` | 12h | **Chặn cứng** ngày nghỉ (có dòng trong `WorkCalendarDay`, xem §Lịch ngày nghỉ) |
| `MonthlyOtHourLimit` / `YearlyOtHourLimit` | 25h / 300h | **Không chặn**; vượt thì đơn bắt buộc là `TH3` |

- **Chặn ngày** — `OtFormService.ValidateOtHourLimitsAsync`, gọi ở cả 2 luồng tạo (theo Nhóm và theo chuyền, qua `FinalizeCreateAsync`) và `UpdateAsync`. Tổng giờ của **một nhân viên trong cả ngày**,
  cộng mọi đơn/ca hợp lệ + giờ của đơn đang tạo/sửa; vượt thì `DomainException` liệt kê mọi nhân viên vi phạm: `Nhân viên mã {code} quá giới hạn OT ngày ({sau}h > {mốc}h)`. Người dùng tự bỏ chọn người đó
  hoặc giảm giờ; hệ thống không tự loại. Không có mốc ngày riêng theo nhân viên.
- **Mốc tháng/năm ép TH3** — `ExceedsMonthYearLimitAsync`: có nhân viên mà `lũy kế dự kiến + giờ đơn này` vượt mốc thì `EnsureOtCaseMatchesRulesAsync` đòi `OtCaseId` là `TH3`
  (ngược lại TH2 nếu ngày nghỉ, TH1 nếu ngày làm; xem §Business Logic). Sửa đơn không đổi Trường hợp OT nhưng từ chối nếu giờ sửa khiến đơn chưa phải TH3 mà vượt mốc.
- **Mốc riêng theo nhân viên** — `Employee.CustomMonthlyOtHourLimit` / `CustomYearlyOtHourLimit` (`decimal?`): `null` = dùng mặc định chung, có giá trị = dùng thẳng cho người này (thường cao hơn,
  dùng cho công nhân dưới chuyền). Không có thời hạn hiệu lực. Chỉ tháng/năm, không có ngày. Sửa qua `PUT /api/Employee/{id}/ot-limit` hoặc import giới hạn (`POST /api/EmployeeImport/ot-hour-limits`), cùng quyền `Attendance.Employee.UpdateOtLimit` (Người phụ trách được tự cấp, scope theo Bộ phận/Nhóm).
  Hai field đi theo `EmployeeDto`/`OtFormEmployeeDto`/`ProductionEmployeeSearchItemDto` (`attendance-api-fe.md §3.5/§4.3`).
- **Không hồi tố**: đổi cấu hình hay mốc riêng chỉ ảnh hưởng đơn tạo/sửa sau đó.
- **FE cảnh báo sớm** (`AccumulationCell` trong `CreateOtFormPage.tsx`, cả bảng Theo Nhóm, Theo chuyền và Sửa đơn): ô ngày đỏ khi `dự kiến + giờ đơn > mốc ngày`; ô tháng/năm vàng khi vượt (đơn phải là TH3).
  Bảng Sửa đơn không có số "dự kiến theo ngày" nên chỉ cảnh báo tháng/năm. BE luôn là nơi chặn thật; lỗi 400 hiện qua toast `getApiErrorMessage`.

**Không còn**: cột lũy kế trên `Employee` (`MonthToDate`/`YearToDate`/`AccumulationYear`/`AccumulationMonth`/`Projected*`, bỏ ở migration `RemoveEmployeeAccumulationColumns`, 2026-08-19),
endpoint `PATCH /Employee/{id}/adjust-accumulation` và `GET /Employee/me`. Lý do bỏ cache: mốc "kỳ xử lý gần nhất" làm `MonthToDate` bị reset khi đơn ngày tương lai được xử lý trước đơn gần hơn;
sổ cộng theo đúng `(Year, Month)` của từng đơn nên hết phụ thuộc thứ tự xử lý. Xoá đơn `Completed` bị chặn vì giờ đã vào sổ (số liệu lương); xoá đơn `InApproval`/`Rejected` không cần đảo gì
vì dự kiến tính lúc đọc.

### §Phiếu ăn

Nguồn yêu cầu: `docs/Note_OT.txt` (mục "Phiếu ăn"), chốt với người dùng qua nhiều vòng. Quy tắc dưới đây là
**trạng thái hiện hành**, đã đối chiếu với code.

**Loại phiếu 1 người nhận cho 1 lần OT** — 3 bậc, tính trên giờ thực tích (`actualHours`):

| `actualHours` | Loại phiếu (`MealTicketType`) |
|---|---|
| `< NoMealTicketMaxHours` (mặc định 2h) | Không có phiếu (`None = 0`) |
| `>= NoMealTicketMaxHours` và `< MainMealTicketMinHours` (mặc định 3.5h) | Phụ (`Secondary = 1`) |
| `>= MainMealTicketMinHours` | Chính (`Main = 2`) |

`actualHours` = giờ thô (`EndTime − StartTime`, làm tròn 2 số lẻ) trừ `MealBreakDeductionHours` (mặc định 0.5h).

**Ngoại lệ khung OT sớm.** Ca có `StartTime`/`EndTime` **bằng đúng** `EarlyMealWindowStartTime`/
`EarlyMealWindowEndTime` (mặc định 06:00–08:00; khớp tuyệt đối, ca 06:30–08:00 không tính) luôn nhận phiếu
Phụ và **không** bị trừ giờ nghỉ ăn, bất kể `DidEat`. Ví dụ: OT 6h–8h → phiếu Phụ, lũy kế ghi đủ 2h.

**Hai đại lượng, hai cách tính — đừng nhầm**

| | Công thức | `DidEat` ảnh hưởng? | Dùng cho |
|---|---|---|---|
| Giờ OT thực tính (`CalculateOtHours`) | giờ thô − `MealBreakDeductionHours` **nếu `DidEat`** (ngoài khung sớm) | Có | `ActualHours` hiển thị, lũy kế, hạn mức giờ OT, báo cáo |
| Loại phiếu (`CalculateMealTicketType`) | luôn tính như đã trừ nghỉ ăn | **Không** | badge "Loại phiếu ăn", số phiếu Chính/Phụ của đơn |

Tách ra để cùng 1 ca luôn ra cùng loại phiếu dù nút "Ăn" bật hay tắt (đúng `Note_OT.txt`); còn giờ lũy kế
chỉ trừ người thật sự ăn trong ca.

**`DidEat`** (`OtFormEmployee.DidEat`, mặc định `false`) nghĩa là "ăn TRONG ca nên bị trừ giờ".
- Đơn **Theo chuyền** (`IsProductionForm = true`): BE ép `DidEat = true` cho mọi nhân viên
  (`ResolveDidEat(isProductionForm, requested)`, ở cả tạo và sửa đơn). FE không hiện cột "Có ăn", chỉ hiện
  badge loại phiếu.
- Đơn **Theo Nhóm** (văn phòng): giữ giá trị FE gửi lên. FE hiển thị cột **"Ăn sau"** = đảo `!didEat`,
  mặc định tích sẵn (không trừ giờ); bỏ tích → `didEat = true`. FE: `defaultDidEatForNewEmployee =
  formMode === "production"`.
- Nhập lúc tạo đơn (`CreateOtFormEmployeeItemDto.DidEat`); sửa được tới trước khi Trưởng phòng duyệt
  (`UpdateOtFormEmployeeTimeDto.DidEat`), cùng giới hạn với sửa giờ kết thúc thực tích.

**Phiếu cả đơn (`ProcessPart`)**
- `IsEat` luôn `true`: `FinalizeCreateAsync` luôn tạo `ProcessPart`, FE không còn checkbox "Ăn uống". Xe đưa
  đón và Phòng photo vẫn tuỳ chọn.
- `MainTicketCount`/`SecondaryTicketCount` = số người nhận từng loại, tính bằng `CalculateMealTicketCounts`
  (qua `CalculateMealTicketType`, không xét `DidEat`).
  - **FE** tự tính gợi ý lúc Tạo đơn (`mealTicketCounts` trong `CreateOtFormPage.tsx`); người dùng gõ đè được
    (tắt `autoMealTicket`, hiện nút "Tính lại"). Màn Sửa đơn không tự tính.
  - **BE** tính lại (`RecalculateMealTicketCountsAsync`) ở đúng 2 nơi, trước `SaveChangesAsync`: sửa đơn
    (`UpdateAsync`) và loại nhân viên khỏi đơn (`RemoveEmployeeCoreAsync`).
- `MilkCount` luôn nhập tay 100%, BE không đụng tới.

**DTO.** `OtFormEmployeeDto.ActualHours` do BE tính sẵn — là field DUY NHẤT để hiển thị giờ OT của 1 người,
FE không tự trừ `endTime − startTime`. `OtFormEmployeeDto.MealTicketType: int` (0/1/2); `IsEligibleForMeal` đã
bỏ. FE hiển thị bằng `MealTicketTypeBadge` ở `CreateOtFormPage`, `OtFormDetail`, `OtFormBatchDetail`,
`OtFormEmailConfirmPage`. Bản in (`OtFormPrintView`) chỉ in giờ vào/ra thô, không in giờ tính toán.

**Nơi chứa công thức — đổi quy tắc thì phải đổi cả các bản mirror**

| Nơi | Vai trò |
|---|---|
| `MealTicketCalculator` (`Attendance.Application/Services`) | Nguồn chân lý BE: `IsEarlyMealWindowOt`, `CalculateOtHours`, `CalculateMealTicketType`. `OtFormService` và `ProductionOtReportService` gọi thẳng |
| `EmployeeService.CalculateProjectedHours`, `ProductionEmployeeService.CalculateProjectedHours` | Mirror độc lập chỉ phần giờ (badge "Dự kiến"); cố ý không gọi chéo giữa các service |
| `modules/attendance/lib/mealTicket.ts` (`computeActualHours`, `computeMealTicketType`, `isEarlyMealWindowOt`) | Mirror FE cho preview lúc đang tạo đơn, khi `OtFormEmployee` chưa tồn tại để BE tính |

Giờ thực tính được ghi vào lũy kế khi đơn chuyển sang `Completed` (`AccumulateEmployeeHoursAsync`).

**Đã bỏ, đừng dựng lại:** mô hình 2 bậc Chính/Phụ không có sàn dưới tính trên giờ thô (thay bằng 3 bậc trên
giờ thực tích); cộng bù +30 phút cho người không ăn (thay bằng trừ 30 phút cho người ăn, áp cả giờ hiển
thị); loại phiếu phụ thuộc `DidEat`; `IsEligibleForMeal` tính ở BE.

### §Cấu hình phiếu ăn & giới hạn lũy kế

Bảng `AttendanceSettings` luôn đúng 1 dòng (`Id = 1`), không có `IsDeleted`, Admin sửa qua API nên đổi chính
sách không cần deploy. Mirror `Asset.Domain.Entities.AssetSetting`.

| Field | Mặc định | Dùng cho |
|---|---|---|
| `MainMealTicketMinHours` | 3.5 | mốc phiếu Chính |
| `NoMealTicketMaxHours` | 2 | sàn: dưới mốc này không có phiếu |
| `MealBreakDeductionHours` | 0.5 | giờ trừ khi `DidEat` |
| `EarlyMealWindowStartTime` / `EarlyMealWindowEndTime` | 06:00 / 08:00 | khung OT sớm đặc cách |
| `DailyOtHourLimit` / `DailyOtHourLimitHoliday` | 4 / 12 | chặn cứng giờ OT trong ngày — xem §Lũy kế & giới hạn giờ OT |
| `MonthlyOtHourLimit` / `YearlyOtHourLimit` | 25 / 300 | vượt thì đơn bị đẩy lên TH3 — xem §Lũy kế & giới hạn giờ OT |
| `BatchAutoSendTime` | 15:00 | giờ `OtFormBatchBackgroundService` gom Đơn tổng — xem §Đơn tổng |

**BE**
- `AttendanceSettingService.GetOrCreateSettingEntityAsync()` tự tạo lại dòng mặc định (các hằng `Default*`
  trong service, bằng giá trị seed) nếu dòng bị xoá tay dưới DB, để không sập API và màn Tạo đơn.
- `AttendanceSettingController`: `GET /api/AttendanceSetting` **không** gắn `[RequirePermission]` — mọi tài
  khoản đăng nhập đều đọc được vì màn Tạo đơn của Trưởng nhóm/Nhân viên cần cấu hình để tự tính phiếu ăn.
  `PUT /api/AttendanceSetting` và `POST /api/AttendanceSetting/test-email` gắn `Attendance.Setting.Update`
  (migration Identity `AddAttendanceSettingPermission`, gán theo nhóm Role có `Attendance.Department.Create`,
  tức Admin).
- Migration Attendance: `AddAttendanceSetting`, `RedesignMealTicketRules` (thêm 4 cột phiếu ăn và `UPDATE`
  dòng live có mốc Chính cũ `2` sang `3.5`, vì field đổi ý nghĩa chứ không chỉ thêm cột),
  `AddBatchAutoSendTimeToAttendanceSetting`, `AddDailyOtHourLimitToAttendanceSetting`.

**FE**
- `attendance-setting.dto.ts` + `attendance-setting.api.ts` theo khuôn `huong-dan-viet-api-fe.md`.
- `hooks/useAttendanceSetting.ts` cache **1 promise dùng chung ở tầng module** (không dùng React Query):
  cấu hình được đọc ở rất nhiều màn nhưng gần như không đổi. `invalidateAttendanceSettingCache()` được gọi
  sau khi Admin lưu để các màn mở sau thấy giá trị mới ngay. `DEFAULT_ATTENDANCE_SETTING` (khớp seed) làm giá
  trị tạm lúc tải và fallback khi lỗi mạng — cố ý không toast lỗi vì cấu hình chỉ ảnh hưởng gợi ý hiển thị.
- `OtFormEmailConfirmPage` (route public, không JWT nên không gọi được `GET /AttendanceSetting`) dùng thẳng
  `DEFAULT_ATTENDANCE_SETTING`; chỉ ảnh hưởng màu cảnh báo vượt ngưỡng, không phải số liệu nghiệp vụ.
- UI: tab "Cấu hình" trong `CategoryManagement.tsx` (`/ot/categories`) → `AttendanceSettingPanel.tsx` với 4
  khối: Phiếu ăn, Giới hạn lũy kế, Đơn tổng (giờ tự động gửi + nút "Gửi ngay"), Kiểm tra gửi email; nút
  "Lưu cấu hình" gọi PUT rồi invalidate cache. Không tự kiểm quyền vì cả màn Danh mục đã khoá sau
  `Attendance.Department.Create`. Tab không có bảng/"Thêm mới" nên `CategoryManagement.tsx` ẩn nút đó khi
  `addLabel == null`.

### §Lịch ngày nghỉ — Trường hợp OT tự động, mốc ngày nghỉ, import theo năm

- **Bảng `WorkCalendarDays`** (`Date` unique, `DayType` 1 Chủ nhật / 2 Ngày lễ / 3 Nghỉ đặc biệt, `Note?`):
  mỗi dòng là 1 ngày NGHỈ; ngày không có dòng là ngày làm việc. Không có `IsDeleted` — mỗi năm được thay
  nguyên khối khi import. Migration `AddWorkCalendarAndOtCaseRules` seed lịch 2026 từ thẻ lịch Yazaki
  (52 Chủ nhật + 11 ngày lễ + 32 nghỉ đặc biệt; ngày lễ trùng Chủ nhật giữ loại ngày lễ). Năm chưa có
  lịch thì mọi ngày tính là ngày làm việc.
- **Trường hợp OT là giá trị suy ra, không do người dùng chọn**
  (`OtFormService.EnsureOtCaseMatchesRulesAsync`, gọi ở cả `CreateAsync` lẫn `CreateProductionFormAsync`):
  TH3 nếu có nhân viên nào mà lũy kế tháng/năm cộng giờ của đơn vượt `AttendanceSetting.MonthlyOtHourLimit`
  / `YearlyOtHourLimit` (mặc định 25/300; ưu tiên `Employee.CustomMonthlyOtHourLimit`/`CustomYearlyOtHourLimit`
  nếu có; lũy kế ngày không tính); ngược lại TH2 nếu ngày nằm trong lịch, còn lại TH1
  (`ExceedsMonthYearLimitAsync`). `OtFormDto`/`CreateOtFormDto` vẫn mang `otCaseId` để giữ hợp đồng, nhưng giá trị gửi
  lên khác giá trị suy ra thì BE trả 400 ghi rõ phải là TH nào. Tra TH theo `OtCase.Code`.
  Sửa đơn (`UpdateAsync`) không đổi Trường hợp OT đã có, nhưng từ chối nếu giờ sửa khiến đơn chưa phải TH3
  vượt mốc tháng/năm.
- **Mốc chặn cứng chỉ còn theo NGÀY** (`ValidateOtHourLimitsAsync`): ngày nghỉ dùng `DailyOtHourLimitHoliday`
  (mặc định 12h), ngày làm việc dùng `DailyOtHourLimit` (4h). Phân loại theo ngày nên một nhân viên không có
  chuyện vừa 4h vừa 12h trong cùng ngày. Mốc tháng/năm không còn chặn mà là mốc ép TH3.
- **Import** (`WorkCalendarService`, `WorkCalendarController`): file mẫu xuất theo năm, import thay toàn bộ
  lịch của năm, all-or-nothing; quyền `Attendance.Setting.Update` (dùng lại, không thêm permission mới
  vào Identity). Giao diện: card "Lịch ngày nghỉ" ở tab Cấu hình của màn Danh mục (`AttendanceSettingPanel`): chọn năm, tải mẫu, import, và nút "Xem lịch" mở popup lịch 12 tháng chỉ đọc (`WorkCalendarDialog` + `WorkCalendarView`) tô xanh ngày lễ, vàng nghỉ đặc biệt, chữ đỏ Chủ nhật, rê chuột xem loại/ghi chú.
  Hợp đồng API: `attendance-api-fe.md §6d-2`.
- **AI Chat lập đơn** vẫn nhận `otCaseId` từ model; nếu model chọn sai TH thì lỗi 400 ở trên được trả
  lại cho model để chọn lại.

### §Import nhân sự dưới chuyền (`ProductionEmployee`) — cùng Export và màn "Nhân viên dưới chuyền"

`ProductionEmployee` là bảng cấu trúc dưới chuyền (Line/Team/Nhóm ca/Công đoạn/Trưởng nhóm của từng người), nạp lại **mỗi tháng** từ file Excel theo format thật `docs/Data/Import_Nhan_Su_Che_Tao.xlsx` (sheet `OT(N+1)`),
dùng làm nguồn cho đơn "theo chuyền" (`GET /api/ProductionEmployee/search`, `line-options`, `team-options`, `shift-team-options`) và cho báo cáo. Luật cũ trong `ProductionEmployee.cs`: chỉ nạp dòng resolve đủ Line/Team/ShiftTeam.

**Import** — `ProductionEmployeeImportService` (`PreviewAsync` → `ConfirmAsync`, `ApplyAccumulationAsync`), `ProductionEmployeeImportController`: `POST preview`, `POST confirm`, `POST apply-accumulation`, `GET template`.
Đích **hardcode 1 Phòng ban** `CT` (Chế Tạo, `ManufacturingDepartmentCode`).
- **Cột file → field**: `MNV` → `EmployeeCode`; `BOPHAN` → `CongDoan` (raw, không FK); `HO`/`TEN` → `Employee.LastName/FirstName`; `CÔNG VIỆC` → `TaskName`; `BLOCK` → `ProductionLineId` (khớp `LineCode`); `GROUP` → dịch `A→"1"`, `B→"2"`,
  `HC→"HC"` (còn lại khớp trực tiếp, `TeamCodeTranslation`) rồi resolve `TeamId`; `NHOM` → `ShiftTeamId` (khớp `Code`); `LEADER` → `IsLeader`. Cột `KHOI SU` (mã Line thật khi `BLOCK = "LC-A"`) **chưa xử lý**; cột `1`/`2`/rác/`#REF!` bỏ qua.
  **`TeamCode` lưu mã đã chuẩn hoá** (`1`/`2`/`HC`), không phải chữ thô `A`/`B`, để khớp `ProductionTeam.Code`.
- **Line/Team/ShiftTeam không khớp → bỏ qua dòng đó, không tự tạo mới** (dữ liệu file có thể sai, người dùng chốt không cần quan tâm).
- **Nhân viên chưa có `Employee` thì tự tạo**, gán `GroupId` vào Group **"Chưa phân loại (nhập từ file chuyền)"** (`GroupCode = KHAC`) dưới Phòng ban `CT` (tạo ở lần Confirm đầu cần tới, tái dùng sau). Nhân viên đã tồn tại: **không**
  đổi `FirstName/LastName` (chỉ set khi tạo mới, tránh ghi đè tên đã chỉnh).
- **Người vắng hoàn toàn trong file mới → soft-delete `ProductionEmployee`** (dòng lỗi vẫn tính là "còn nhắc tới"). Preview phải cho thấy: dòng lỗi (kèm lý do), người tạo mới (`Employee` lẫn `ProductionEmployee`), người cập nhật
  (kèm cờ field nào đổi), người bị gỡ. FE `ProductionEmployeeImportDialog.tsx` chia Preview thành 6 tab (Tất cả/Mới/Cập nhật/Không đổi/Lỗi/Bị gỡ, lọc lại từ cùng mảng `rows`/`removedRows`, không gọi lại BE).
- **Cột `OT month`/`OT year` là bước riêng, không nằm trong Confirm cấu trúc.** Chỉ `OT month` được ghi vào lũy kế (Admin chọn tay Year/Month áp dụng, không suy theo hôm nay); `OT year` chỉ hiển thị tham khảo. Cách ghi: cộng **chênh lệch**
  `delta = OT month − lũy kế tháng hệ thống đang có` vào dòng `(Employee, Year, Month)` của sổ lũy kế (unique index nên không tách dòng điều chỉnh riêng) và **append** ghi chú vào `EmployeeAccumulationHistory.Note`
  (`nvarchar(1000)`). Quyền riêng `Attendance.EmployeeAccumulation.Import` (đụng lũy kế → ảnh hưởng lương); nút "Áp dụng lũy kế" chỉ hiện khi có quyền. Xem §Lũy kế & giới hạn giờ OT, §Import lũy kế OT theo tháng.

**Export** — `GET /api/ProductionEmployeeExport/export` (`Attendance.ProductionEmployee.Export`, `ProductionEmployeeExportService`): xuất toàn bộ `ProductionEmployee` hiện có **đúng vị trí cột A..O của file mẫu** (A = `KHOI SU` để trống, B = `MNV` … K = `GROUP`,
L/M/N trống, O = `LEADER`), khớp cột mà `ParseXlsx` đọc nên file xuất dùng lại ngay làm file Import tháng sau; **1 sheet / Phòng ban thật** (`Employee.Group.Department`, khác `BOPHAN`). `OT month`/`OT year` lấy **sống** từ sổ lũy kế lúc xuất.
Lọc theo Phòng ban phụ trách ngay ở query (người phụ trách không xuất được phòng khác).

**Màn "Nhân viên dưới chuyền"** (`ProductionEmployeeList.tsx`, toggle segment "Nhân viên / Nhân viên dưới chuyền" ở đầu `EmployeeList.tsx`; tự ẩn nếu không có quyền): đọc thẳng bảng `ProductionEmployees` qua `GET /api/ProductionEmployee/page-nation`
(`ProductionEmployeeService.GetPagedAsync`, quyền `Attendance.ProductionEmployee.View`, lọc theo Phòng ban/Nhóm người gọi phụ trách — xem §Permission & Role). Lọc Line/Team/Nhóm ca bằng 3 API option của màn "Theo chuyền".
- **Dropdown Line theo Team suy từ dữ liệu thật**: `GetLineOptionsAsync(teamId)` lấy Line có nhân viên thật thuộc Team đó (`ProductionEmployees`), **không** dùng FK tĩnh `ProductionLine.TeamId` (snapshot lúc dựng quan hệ, Team thật đổi theo từng
  lần import); `GetShiftTeamOptionsAsync` làm tương tự. Tránh cho chọn tổ hợp rồi ra danh sách rỗng.
- **Thao tác trên từng dòng**: lũy kế (nút Lịch sử → `AccumulationHistoryModal`; nút Giới hạn OT → `EmployeeOtLimitDialog`, quyền `Employee.UpdateOtLimit`) tác động lên `Employee` gốc qua `ProductionEmployeeListItemDto.EmployeeId` (ẩn nếu `null`);
  dialog Giới hạn OT gọi thêm `GET /api/Employee/{id}` lúc bấm.
- **Sửa tay cấu trúc**: nút Sửa mở `ProductionEmployeeEditDialog.tsx` (Team → Line → Nhóm ca cascade + checkbox "Là Trưởng nhóm") → `PUT /api/ProductionEmployee/{id}` (`Attendance.ProductionEmployee.Update`,
  `UpdateProductionEmployeeDto { ProductionLineId?, TeamId?, ShiftTeamId?, IsLeader }`). BE **luôn ghi lại cả cặp Id + Code từ entity đang chọn** (`LineCode`/`Team.Code`/`ShiftTeam.Code`), không nhận Code tay từ FE, để `BlockCode/TeamCode/ShiftTeamCode`
  không lệch FK. **`IsLeader` ảnh hưởng luồng duyệt thật**: là nguồn xác định Line Leader cho `JobTitleApprovalChainService` (đơn theo chuyền, §Cây chức vụ & Cây duyệt), đọc sống lúc resolve chuỗi nên có hiệu lực ngay.
  Dữ liệu sửa tay sẽ bị **ghi đè** ở lần Import kế tiếp (có hint trong dialog): chỉ dùng sửa tạm/gấp.
- Nút Import/Export gom vào dropdown "Excel" (`ActionMenu.tsx`, `components/ui/`) trên toolbar view dưới chuyền; "Import Excel" nhân viên chuẩn nằm ở toolbar view "Nhân viên".

**Permission**: `ProductionEmployee.View/Update/Import/Export` và `EmployeeAccumulation.Import/Update` — chi tiết cấp theo Chức vụ / Người phụ trách ở §Permission & Role của Attendance và §Phân quyền Coordinator.
**Sửa tay lũy kế + đổi Bộ phận/Nhóm nhân viên**: `EmployeeService.UpdateAccumulationHistoryAsync` (§Lũy kế & giới hạn giờ OT); FE nút "Sửa lũy kế" trong `AccumulationHistoryModal` (`canEdit`) với form `AccumulationHistoryEditor.tsx`;
`EmployeeForm` có ô Bộ phận để lọc danh sách Nhóm (Bộ phận của nhân viên thường vẫn suy ra từ Nhóm, không lưu riêng).

### §Song ngữ Vn/Jp trên OtFormDto — hiển thị cho cấp duyệt xem trước khi duyệt
- **Lý do**: `Group.GroupNameJp`/`Department.DepartmentNameJp`/`Reason.ReasonNameJp` (và `OtFormEmployee.NoteJp`/`ProcessPart.AnotherSuggestionJp` đã có sẵn từ trước) tồn tại trong DB nhưng `OtFormDto`/`OtFormListItemDto` trước đây chỉ trả field `*Vn` — 2 màn xem trước khi duyệt (`OtFormDetail.tsx` trong app, `OtFormEmailConfirmPage.tsx` public qua link email) chỉ hiện tiếng Việt dù master data đã có sẵn bản dịch tiếng Nhật.
- **Đã thêm**: `OtFormDto.GroupNameJp`/`DepartmentNameJp`/`ReasonNameJp` (nullable, `OtFormService.GetByIdAsync`) và `OtFormListItemDto.GroupNameJp`/`DepartmentNameJp` (nullable, `OtFormService.ToListItemDto`) — map thẳng từ navigation `Group`/`Department`/`Reason` đã `Include()` sẵn ở cả 2 chỗ, không cần query thêm.
- **KHÔNG thêm Jp cho `Employee`** — giữ đúng quyết định cũ "Tên riêng — không dịch" (xem bảng Entity đầu file).
- FE hiện dạng `"{Vn} / {Jp}"` (bỏ `/ {Jp}` nếu `null`) qua helper `bilingualText` (`yev-frontend/src/modules/attendance/lib/bilingual.ts`), áp dụng cho Phòng ban/Bộ phận/Lý do (header + card thông tin) và Ghi chú nhân viên/Đề nghị khác (đã có Jp trong DTO từ trước, giờ mới lên UI) ở cả `OtFormDetail.tsx`, `OtFormEmailConfirmPage.tsx`, và cột "Phòng ban/Bộ phận" ở `OtFormListPage.tsx`.
- Email thông báo duyệt đơn cũng đổi sang song ngữ tương ứng — xem bullet `OtForm/ApprovalNotification.html` ở §Xác thực qua email bên dưới.

### §Popup xác nhận Từ chối trên trang xác nhận qua email
- **Trước đây**: `OtFormEmailConfirmPage.tsx` (route public `/xac-nhan-don?token=...`, xem §Xác thực qua email) dùng chung 1 ô "Ghi chú/Lý do từ chối" luôn hiển thị sẵn cho cả 2 nút Duyệt/Từ chối — bấm "Từ chối" gửi thẳng luôn nếu ô đó không trống, không có bước xác nhận lại.
- **Yêu cầu người dùng**: bấm "Từ chối" phải mở popup riêng để nhập lý do trước khi thật sự gửi — tránh bấm nhầm. Đã đổi FE: ô "Ghi chú" ngoài popup giờ chỉ dùng cho "Duyệt" (tuỳ chọn); bấm "Từ chối" mở modal riêng (cùng UX với modal Ký duyệt/Duyệt/Từ chối ở `OtFormDetail.tsx` trong app) với ô lý do **bắt buộc** + nút Huỷ/Xác nhận từ chối. Không đổi gì ở BE (`POST /email-confirm/{token}/reject` vẫn nhận `RejectOtFormDto { comment }` y hệt cũ).

### §Đơn tổng — gom đơn cho cấp quản lý, mail tổng hợp hằng ngày

Ba cấp quản lý (Trưởng phòng `DepartmentManager`, Trưởng Xưởng `WorkshopManager`, Giám đốc `GeneralDirector`) không duyệt từng đơn mà nhận **1 mail tổng hợp/ngày** rồi duyệt cả mục một lần. Cấp trung gian (`TerminalLevel = None`: Staff, Group/Team Leader, SUP, CHIEF…)
không đổi: vẫn nhận mail riêng ngay khi đơn tới lượt (`QueueStepApprovalNotification` chỉ gọi khi `TerminalLevelSnapshot == None`, ở `CreateAsync` và `ApproveAsync`; xem §Xác thực qua email).

**Entity**
| Entity | Thuộc tính | Ghi chú |
|---|---|---|
| `OtFormBatch` | `Id`, `TerminalLevel:int` (enum `JobTitleTerminalLevel`), `DepartmentId:int?` (FK Restrict; chỉ có khi `TerminalLevel = DepartmentManager`, `null` với 2 cấp toàn công ty), `BatchDate:DateOnly`, `Status` (`OtFormBatchStatus` Pending=0/Processed=1), `CreatedAt`, `ProcessedAt?`, `ProcessedByUserName?`, `ProcessedByFullName?` | Không `IsDeleted` (bảng hệ thống tự quản lý) |
| `OtFormBatchEmailToken` | `OtFormBatchId` (FK Cascade), `ApproverUserName`, `ApproverFullName?`, `IsReminder`, `Token`, `ExpiresAt`, `UsedAt?`, `CreatedAt` | Mỗi lần gửi mail (mới hoặc nhắc) tạo 1 token mới |

`OtForm.OtFormBatchId:int?` (FK Restrict, `null` = chưa gom): 1 đơn chỉ thuộc đúng 1 batch trong suốt vòng đời. Enum `OtFormBatchFormDecision` (Approve=0/Reject=1) chỉ dùng trong DTO xử lý, không lưu DB.
Không có permission riêng: `Attendance.OTForm.View/Approve`; "Gửi ngay" cần `Attendance.Setting.Update`.

**"Đơn đủ điều kiện gom / còn hiệu lực"** = `InApproval`, `!IsDeleted`, và bước `Pending` có `StepOrder` nhỏ nhất của chính nó có `TerminalLevelSnapshot` đúng cấp của batch. Đơn còn kẹt ở bước trung gian chưa được gom, duyệt lẻ tới khi tới lượt.
Hai hàm nền trong `OtFormService`: `GetNewFormsAtManagerStepAsync()` (đơn chưa vào batch nào đang ở 1 trong 3 cấp quản lý, trả kèm `DepartmentId`/`TerminalLevel`) và `GetActiveFormIdsForBatchAsync(formFilter, terminalLevel)` (đơn còn hiệu lực của 1 batch).

**Logic (tất cả trong `OtFormService`, tái dùng `ApproveAsync`/`RejectAsync`/`RemoveEmployeeCoreAsync`, không viết lại luật duyệt)**
- **`RunDailyBatchSweepAsync()`** do `OtFormBatchBackgroundService` (`CompanySystem.HostApi/BackgroundServices`, đăng ký ở `Program.cs`) chạy hằng ngày vào `AttendanceSetting.BatchAutoSendTime` (mặc định 15:00 giờ VN, Admin đổi ở tab Cấu hình;
  đọc lại mỗi vòng, đổi giờ chỉ áp dụng từ lần tính delay tiếp theo). `POST /api/OtFormBatch/run-now` (`Setting.Update`, nút "Gửi ngay") gọi cùng hàm.
  (a) Gom đơn mới theo `(TerminalLevel, DepartmentId)` — `DepartmentManager` giữ `DepartmentId` thật, 2 cấp toàn công ty ép `DepartmentId = null` nên mỗi cấp chỉ có **1 batch/ngày** — tạo `OtFormBatch`, gán `form.OtFormBatch`, gửi mail lần đầu.
  (b) Mỗi batch cũ còn `Pending`: không còn đơn hiệu lực (đã duyệt/từ chối lẻ ngoài luồng batch) thì tự đóng (`Processed`, không `ProcessedBy*`, không mail); còn thì gửi **mail nhắc** (token mới, `IsReminder = true`, không gom thêm đơn).
  Batch vừa tạo ở (a) không bị nhắc trong cùng lượt.
- **`ProcessBatchAsync(batchId, approverUserName, approverFullName, ProcessOtFormBatchDto)`** (`ProcessOtFormBatchDto { SecondaryPassword, Forms[] { OtFormId, Decision, RejectReason?, ExcludedEmployeeIds? } }`). Không có Admin bypass: người gọi phải là candidate
  của bước hiện tại của **từng** đơn. Batch không còn đơn hiệu lực thì tự đóng. Ngược lại `Forms` phải **khớp chính xác** (SetEquals) tập đơn còn hiệu lực, không trùng mã. Validate fail-fast trước khi ghi: là candidate ở mọi đơn; Reject phải có lý do;
  Approve mà `ExcludedEmployeeIds` loại hết người thì 400 (dùng Reject). Mật khẩu cấp 2 verify **1 lần** cho cả batch. Mỗi đơn: Reject → `RejectAsync`; Approve → `RemoveEmployeeCoreAsync(..., "Loại khi duyệt Đơn tổng", secondaryPassword: null)` cho từng người bị loại
  (1 mail `QueueEmployeesRemovedNotification`/đơn) rồi `ApproveAsync`. Xong hết thì `Status = Processed` + `ProcessedBy*`. **Không dùng transaction DB** (theo tiền lệ codebase), nên mới phải validate fail-fast.
- **Mail**: `NotifyBatchApproversAsync` — người nhận là mọi `UserName` trong `OtFormApprovalStepCandidate` của bước đúng `batch.TerminalLevel` thuộc các đơn hiệu lực, gộp theo `UserName` (1 mail dù là candidate của nhiều đơn). Template
  `EmailTemplates/OtForm/BatchApprovalNotification.html` (tóm tắt số đơn/số NV/tổng giờ; placeholder `{{ScopeName}}` nhãn "PHẠM VI DUYỆT / 承認範囲"), subject thêm `[Nhắc nhở]` khi nhắc; link `{FrontendBaseUrl}/xac-nhan-don-tong?token={token}`.
- **Tên phạm vi**: `ResolveBatchScopeNameAsync` — Department (song ngữ) khi `DepartmentManager`, ngược lại `JobTitle.Name` theo `TerminalLevel` (chỉ bản Vn). `GetBatchesAsync`: Admin thấy tất cả; người thường chỉ thấy batch mà mình từng là candidate đúng `(TerminalLevel, DepartmentId)`
  (2 cấp toàn công ty chỉ cần đúng `TerminalLevel`); tên phạm vi toàn công ty điền gộp 1 query (`FillCompanyWideBatchScopeNamesAsync`).
- **Kênh email** (`OtFormBatchController`, `[AllowAnonymous]`): `GET email-confirm/{token}` và `POST email-confirm/{token}/approve` → `ResolveBatchEmailTokenAsync` rồi `ProcessBatchAsync`.
- **Endpoint JWT**: `GET grid-list`, `GET {id}`, `POST {id}/approve` (`OTForm.Approve`). Hợp đồng FE: `attendance-api-fe.md §6e` (`OtFormBatchListItemDto`/`OtFormBatchDto` có `terminalLevel`, `scopeNameVn/Jp`, `departmentId?`).
- `OtFormBatchItemDto` mang cả `SubReason`, `ProcessPart` và `employees[]` đủ cột lũy kế/phiếu ăn (cùng `OtFormEmployeeDto` với `OtFormDto`) để cấp duyệt thấy đủ ngữ cảnh như màn Chi tiết đơn.

**FE**: màn "Đơn tổng" trong app (`/ot/batches`, `OtFormBatchListPage.tsx`, `OtFormBatchDetail.tsx`, cột "Phạm vi" `bilingualText(batch.scopeNameVn, batch.scopeNameJp)`) và trang public `xac-nhan-don-tong` dùng chung 1 component; enrich bảng nhân viên
bằng đúng key i18n `Attendance.OtFormDetail.*`. Chưa verify end-to-end mail thật cho 2 cấp toàn công ty (cần tài khoản thật giữ 2 Chức vụ đó + `run-now`).

### §Xác thực qua email — kênh phụ cho chữ ký, mật khẩu cấp 2, duyệt đơn; mail thông báo; template

Kênh email là **kênh phụ** (cấp quản lý ít mở app), không thay luồng trong app. Bảo mật dựa vào **token ngẫu nhiên 256-bit** (`TokenHelper.GenerateSecureToken`) trong URL, không dựa JWT/Permission: các route
`[AllowAnonymous]` của `UserSignatureController`, `SecondaryPasswordController`, `OtFormController` (`email-confirm/...`) và `OtFormBatchController`. FE tự dựng các trang public tương ứng
(`/xac-nhan-chu-ky`, `/xac-nhan-mat-khau-cap-2`, `/xac-nhan-don`, `/xac-nhan-don-tong`; route công khai nên không qua `AuthGuard`); BE không render HTML.

**Bốn luồng**
| Luồng | Cách chạy |
|---|---|
| Cập nhật chữ ký (`UserSignatureService`) | `PUT /api/UserSignature/me` **không áp dụng ngay**: tạo `PendingSignatureConfirmation` (token, hạn 30 phút) và gửi mail cho **chính người gọi** (chống chiếm phiên đổi chữ ký hộ). `GET/POST /api/UserSignature/confirm/{token}` xem trước / áp dụng thật rồi set `ConfirmedAt` (chống dùng lại). |
| Mật khẩu cấp 2 (`SecondaryPasswordService`) | Y hệt chữ ký: `PUT /api/SecondaryPassword/me` → `PendingSecondaryPasswordConfirmation` (30 phút) → `GET/POST .../confirm/{token}`. Xem §Mật khẩu cấp 2. |
| Duyệt/Từ chối đơn lẻ (`OtFormApprovalEmailToken`, hạn **3 ngày**) | `NotifyEligibleApproversAsync(otForm, step)`: với mỗi candidate của bước vừa tới lượt (có email) tạo 1 token + 1 mail. `GET /api/OtForm/email-confirm/{token}` (xem), `POST .../approve`, `POST .../reject`, `POST .../employees/remove` gọi thẳng `ApproveAsync`/`RejectAsync`/`RemoveEmployeeCoreAsync` nên thừa hưởng mọi validate (đơn đã xử lý xong thì token cũ tự vô hiệu). Duyệt/Từ chối tiêu token (`UsedAt`) và vẫn cần mật khẩu cấp 2; loại nhân viên không tiêu token. |
| Duyệt đơn tổng | `OtFormBatchEmailToken`, xem §Đơn tổng. |

**Chỉ bước cấp trung gian (`TerminalLevelSnapshot == None`) gửi mail riêng ngay**: `CreateAsync`/`ApproveAsync` chỉ gọi `QueueStepApprovalNotification` cho các bước đó. Ba cấp quản lý chỉ nhận mail tổng hợp hằng ngày (§Đơn tổng).
Mail gửi **nền, không chặn response**: `QueueStepApprovalNotification` đẩy 2 Id vào `IBackgroundTaskQueue` (`Shared.Application`, impl `BackgroundTaskQueue` dạng Channel); `QueuedHostedService` (`HostApi/BackgroundServices`) lấy ra,
chạy trong scope DI riêng và gọi `IOtFormService.SendStepApprovalNotificationAsync(otFormId, stepId)` (tự tải lại `OtForm`/`OtFormApprovalStep` + `Candidates` theo Id, vì scope request đã dispose). Chỉ enqueue sau khi `SaveChangesAsync` xong.
`EmailService.SendAsync` best-effort: nuốt lỗi SMTP, trả `false`, không retry; `QueuedHostedService` chỉ log khi work item ném lỗi. Thiếu file template (`FileNotFoundException`) cũng bị nuốt để không làm hỏng nghiệp vụ.
(`NotifyBatchApproversAsync` không qua hàng đợi vì đã chạy trong `OtFormBatchBackgroundService`; chỉ `run-now` thủ công là chạy đồng bộ.)

**Mail báo người lập đơn** (`OtForm/RequesterNotification.html`, song ngữ Vn/Jp, không có nút CTA, gửi nền): khi **Từ chối** (`RejectAsync` → `QueueRejectedNotification` → `SendRejectedNotificationAsync`, lấy lý do/người từ
`OtFormApprovalHistory` Rejected mới nhất; phủ cả kênh email, từ chối hàng loạt và đơn tổng) và khi **loại nhân viên** (`QueueEmployeesRemovedNotification(otFormId, employeeIds)` ở `UpdateAsync`, `RemoveEmployeeAsync`,
`RemoveEmployeeByEmailTokenAsync`, `ProcessBatchAsync` — 1 mail/đơn cho mọi người bị loại trong lượt). Bỏ qua khi người thực hiện chính là người lập đơn hoặc người lập không có email. Giá trị động được `WebUtility.HtmlEncode`
vì `EmailTemplateService` không tự encode.

**Hạ tầng**
- Cross-module không qua HTTP: `IUserDirectoryService`/`IEmailService`/`IEmailTemplateRenderer` là contract ở `Shared.Application`, implementation do Scrutor nối lúc runtime, nên `Attendance.Application` không tham chiếu `Identity.Application`
  dù cần Email/FullName của User (DB khác). Người nhận lấy qua `GetContactInfoAsync(userName, EmailModules.Attendance)`: email Admin gán cho module Attendance, không có thì email chính của user (`identity-module.md §5.9`).
- SMTP: `EmailSettings` trong `appsettings.json` trỏ `VNMAIL04.yev.vn:587` (STARTTLS). Chứng chỉ server là **self-signed** (`CN=VNMAIL04`) nên **máy chạy app phải import cert vào `LocalMachine\Root`** (`Import-Certificate -FilePath vnmail04.cer -CertStoreLocation Cert:\LocalMachine\Root`, cần quyền Admin; `CurrentUser\Root` không dùng được khi chạy dưới AppPool IIS). Mỗi server deploy phải lặp lại, hoặc nhờ IT đẩy qua GPO của domain. Dùng `SmtpHost = mail.yev.vn` sẽ lỗi hostname mismatch.
- `AppSettings:FrontendBaseUrl` là domain FE dùng build link trong mail (`{FrontendBaseUrl}/xac-nhan-don?token=...`); phải đặt đúng ở môi trường thật (mặc định dev `http://localhost:3000`).
- **Template** là file `.html` trong project của module sở hữu (`Attendance.Infrastructure/EmailTemplates/{TínhNăng}/{Tên}.html`: `OtForm/ApprovalNotification`, `OtForm/BatchApprovalNotification`, `OtForm/RequesterNotification`,
  `UserSignature/RequestUpdateConfirmation`, `SecondaryPassword/RequestUpdateConfirmation`, `Test/TestEmail`; Workflow tương tự ở `Workflow.Infrastructure/EmailTemplates/`). Mỗi `.csproj` tự khai
  `<Content Include="EmailTemplates\**\*.html"><CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory></Content>`. Gọi `IEmailTemplateRenderer.Render("OtForm/ApprovalNotification.html", dict)` (thay `{{Key}}`) rồi `IEmailService.SendAsync`.
  `ApprovalNotification.html` nhận `ApproverFullName, OtFormId, RequesterFullName, DepartmentName, GroupName, ReasonName` (song ngữ `"{Vn} / {Jp}"` qua `FormatBilingual`, bỏ phần Jp nếu thiếu), `OtFormDate, OtFormTime, TotalHour, ConfirmLink, ExpiryDays`.
- **Kiểm tra gửi mail**: `POST /api/AttendanceSetting/test-email` (`{ Email }`, quyền `Attendance.Setting.Update`) render `Test/TestEmail.html` rồi gửi; `false` thì trả `Fail<bool>` kèm gợi ý kiểm tra `EmailSettings`. FE: section "Gửi email kiểm tra" ở tab Cấu hình
  (`AttendanceSettingPanel.tsx`, i18n `Attendance.AttendanceSetting.testEmail*`). Không có endpoint test rò rỉ nào khác; muốn thử mail thì đi đúng luồng nghiệp vụ.

**Luật khi sửa/thêm template (áp cho mọi template của Attendance và Workflow)** — giữ đủ 3 điều:
1. **Khai `font-family` trực tiếp trên mọi thẻ** `<p>/<span>/<strong>/<a>/<td>` có `style=""` (hiện `'Times New Roman', 'Liberation Serif', Georgia, serif`). Outlook Desktop render bằng engine Word, không đảm bảo kế thừa `font-family` qua nhiều tầng `<table>` lồng nhau;
   thẻ nào không tự khai sẽ rơi về font Normal của Word.
2. **`<meta name="color-scheme">` và `supported-color-schemes` chỉ để `"light"`.** Khai `"light dark"` mà không có khối `@media (prefers-color-scheme: dark)` làm client tự xử lý lại màu/font.
3. **Giữ attribute HTML `bgcolor`** (`#eef0f2` / `#ffffff`) song song CSS `background-color` ở 2 bảng nền chính — engine Word chỉ tin `bgcolor`, thiếu nó dễ bị dark-mode tự ghi đè.
Layout là table-based inline CSS (tương thích Outlook nội bộ), header xanh `#1a56db`, card trắng bo góc, nút CTA bấm được, footer "email tự động"; nhãn tĩnh song ngữ Vn/Jp.

### §Mật khẩu cấp 2 khi ký/duyệt OtForm

Lớp xác thực bổ sung (như PIN giao dịch) cho hành vi có giá trị pháp lý. Mỗi người tự đăng ký **mật khẩu cấp 2** riêng (≥ 6 ký tự, khác mật khẩu AD) và phải nhập lại ở **mọi** thao tác ký/duyệt/ghi:

- **Nơi verify** (`ISecondaryPasswordService.VerifyAsync(userName, password)` ngay đầu hàm, trước mọi ghi, ở tầng Service chứ không ở Controller): `CreateAsync`, `UpdateAsync` (1 lần cho cả lượt lưu), `ApproveAsync`, `RejectAsync`, `ProcessBatchAsync` (1 lần cho cả batch).
  Kênh email `approve`/`reject` thừa hưởng vì gọi thẳng `ApproveAsync`/`RejectAsync`. **Không** cần ở loại nhân viên (`RemoveEmployeeCoreAsync` luôn truyền `null`, xem §Loại nhân viên khỏi đơn). Chưa thiết lập thì ném
  "Bạn chưa thiết lập mật khẩu cấp 2…", sai thì "Mật khẩu cấp 2 không đúng." — không có ngoại lệ cho người chưa thiết lập.
- **DTO**: `[Required] SecondaryPassword` trên `CreateOtFormDto`, `UpdateOtFormDto`, `ApproveOtFormDto`, `RejectOtFormDto`, `ProcessOtFormBatchDto` (các route email-confirm dùng chung `ApproveOtFormDto`/`RejectOtFormDto`).
- **Entity**: `SecondaryPassword` (giá trị hiệu lực) + `PendingSecondaryPasswordConfirmation` (chờ xác nhận qua email), bản sao 1-1 của `UserSignature`/`PendingSignatureConfirmation`. Băm bằng `PasswordHasher<object>` của ASP.NET Core Identity
  (`Attendance.Application.csproj` có `FrameworkReference Microsoft.AspNetCore.App`), không lưu plaintext.
- **Permission** `Attendance.SecondaryPassword.Update` (`GET/PUT /api/SecondaryPassword/me`): nằm trong `JobTitlePermissionWhitelist`, cấp theo Chức vụ hoặc từng người (xem §Permission & Role của Attendance).
- **FE**: `secondary-password.{api,dto}.ts`; trang tự thiết lập `SecondaryPasswordPanel.tsx` (`/ot/secondary-password`); trang public `SecondaryPasswordConfirmPage.tsx` (`/xac-nhan-mat-khau-cap-2`); `OtFormDetail.tsx`,
  `OtFormEmailConfirmPage.tsx`, `OtFormBatchDetail.tsx` và form tạo/sửa đơn có ô nhập mật khẩu cấp 2. Hợp đồng: [attendance-api-fe.md §6c](attendance-api-fe.md).

### §Loại nhân viên khỏi đơn

Cấp đang xử lý không đồng ý cho **một** người trong đơn thì loại đúng người đó rồi duyệt tiếp phần còn lại, thay vì Từ chối cả đơn. Ai được loại và các luật kèm theo: §Cây chức vụ & Cây duyệt (mục "Ai được tạo, sửa, loại nhân viên, xoá đơn").

- **Soft-remove** trên `OtFormEmployee`, không xoá dòng: `IsRemoved`, `RemovedByUserName`, `RemovedByFullName`, `RemovedAtLevel` (= `StepOrder` đang chờ), `RemovedAt`, `RemoveReason`. Đơn là văn bản có giá trị
  pháp lý nên dấu vết ai loại ai, lúc nào, ở bước nào, vì sao phải giữ vĩnh viễn; mỗi lần loại ghi thêm `OtFormEditLog` (`EmployeeRemoved`).
- **Không đổi `OtForm.Status`** và không xoá/vô hiệu chữ ký các bước đã ký: chỉ đánh dấu 1 dòng, tính lại `NumberOfEmployee = count(!IsRemoved)` và số phiếu ăn Chính/Phụ (`RecalculateMealTicketCountsAsync`, xem §Phiếu ăn);
  đơn vẫn chờ đúng bước hiện tại.
- **Lõi dùng chung `RemoveEmployeeCoreAsync(id, userName, fullName, isAdmin, employeeId, reason, secondaryPassword?)`**, ba lối vào:

  | Lối vào | Xác thực |
  |---|---|
  | `POST /api/OtForm/{id}/employees/remove` (`OTForm.RemoveEmployee`, body `{ EmployeeId, Reason }`, trả `OtFormDto` đầy đủ) | JWT |
  | `POST /api/OtForm/email-confirm/{token}/employees/remove` (`[AllowAnonymous]`, `RemoveOtFormEmployeeByEmailTokenDto`) | token email: `ResolveEmailTokenAsync(requireUnused: false)`, **không tiêu token** nên loại nhiều người rồi mới Duyệt/Từ chối bằng cùng link |
  | `UpdateAsync` (đơn theo Nhóm, người tạo) và màn Duyệt hàng loạt | xem §Cây chức vụ & Cây duyệt, §Đơn tổng |

  **Không yêu cầu mật khẩu cấp 2 ở mọi kênh** (loại người chỉ là dọn danh sách trước khi ký, không phải ký/duyệt; token 256-bit trong URL đủ mạnh cho kênh email). `secondaryPassword` luôn truyền `null`; Duyệt/Từ chối/Ký duyệt
  vẫn cần mật khẩu cấp 2.
- **Điều kiện (400)**: đơn phải `InApproval`; người gọi là Admin hoặc nằm trong `Candidates` của bước `Pending` nhỏ nhất; nhân viên có trong đơn và chưa bị loại; đơn còn **>1** người chưa bị loại
  (loại nốt người cuối = Từ chối đơn).
- **Hệ quả ở nơi khác** (đều lọc `!IsRemoved`): người bị loại không cộng lũy kế (`AccumulateEmployeeHoursAsync`) và không tính vào lũy kế dự kiến; `UpdateAsync` không hard-delete dòng đã loại, và nếu người tạo thêm lại đúng
  `EmployeeId` đó thì xoá các cột `Removed*` (coi là thêm lại); `GetByIdAsync`/danh sách **vẫn trả** người bị loại trong `employees[]` (kèm ai loại, ở bước nào, lý do) để FE hiện dấu vết; `NumberOfEmployee` chỉ đếm người còn lại.
  Sau khi loại, `QueueEmployeesRemovedNotification` báo người lập đơn (§Xác thực qua email).
- **FE**: nút "Loại khỏi đơn" trên từng dòng ở `OtFormDetail.tsx` và `OtFormEmailConfirmPage.tsx` (ẩn khi chỉ còn 1 người), modal riêng chỉ có ô lý do, tách khỏi modal Duyệt/Từ chối/Ký duyệt. Người bị loại hiện dòng mờ gạch ngang
  kèm ai loại/bước nào/lý do; `OtFormPrintView.tsx` tự lọc `!isRemoved` khỏi danh sách in và tổng giờ. Hợp đồng: [attendance-api-fe.md §4.5a](attendance-api-fe.md).

### §Giao diện & song ngữ OT Form — các luật rút ra

> Gộp từ 5 mục changelog cùng ngày (đổi tên "Phần xử lý", làm đẹp giao diện đợt 1/2/3, sửa 2 thanh cuộn).
> Chỉ giữ phần còn giá trị khi code tiếp; chi tiết thao tác từng đợt đã bỏ.

- **Ghép chuỗi song ngữ (trang mở từ link email):** KHÔNG đưa giá trị **đã song ngữ hoá** vào
  `createBilingualTranslator` (vd `t("eatLabel", { value: t("yes") })` với `t("yes")` = `"Có / はい"`) —
  sẽ lặp nguyên cụm 2 lần. Dòng có cả nhãn lẫn giá trị động phải dựng thủ công bằng literal trong
  `bilingual.ts` (`processPartTitleBilingual`, `processPartFieldLabelsBilingual`, `bilingualYesNo()`,
  `removedByLabelBilingual`, `removedReasonLabelBilingual`) rồi ghép trong JSX. `OtFormDetail.tsx`
  (trong app, 1 locale) không dính lỗi này — giữ nguyên cách gọi `t(key, { value })`.
- **Tên khối "Yêu cầu hỗ trợ khác"** (`Attendance.OtFormDetail.processPartTitle`, vi/ja) chỉ đổi ở
  `OtFormDetail.tsx` + `OtFormEmailConfirmPage.tsx`. **`OtFormPrintView.tsx` giữ nguyên "Phần xử lý /
  処理欄"** — phải khớp phiếu giấy YEV-22-024 (`attendance-otform-pdf-mapping.md` §4).
- **`processPart == null` là giá trị hợp lệ** (đơn không tick gì), KHÔNG được ẩn khối — luôn hiện với
  3 checkbox mặc định "Không", khớp cách bản in xử lý (`processPart?.isEat ?? false`).
- **Ngữ nghĩa màu** (bài học từ lỗi tô cả bảng thành hồng): họ đỏ/hồng (`#fff4f2`/`#e9bcb6`/`#930006`/
  `#e3000f`) **chỉ** cho lỗi thật/cảnh báo thật; trạng thái trung tính (dòng đã chọn, nhãn phụ, đếm số
  lượng) dùng xám (`#e0e3e5`/`#f8fafc`/`#5e3f3a`); trạng thái tích cực dùng `emerald`. Ngưỡng cảnh báo
  lũy kế đang dùng ở UI: >25h/tháng, >300h/năm.
- **Thanh công cụ bản in:** chỉ được sửa vùng `no-print` (nút chọn khổ giấy, "Xuất PDF", "In") —
  **KHÔNG đụng** `PageFrame`/`FormHeaderFields`/`EmployeeRowFields` (ảnh nền + toạ độ `%` đo từ file gốc).
- **Chiều cao & thanh cuộn:** chỉ `[locale]/layout.tsx` được khai chiều cao và vùng cuộn
  (`body: flex h-screen flex-col overflow-hidden`, `main: min-h-0 flex-1 overflow-y-auto`). Layout con
  (`(ot-manager)`, `(pc-manager)`…) chỉ `min-h-full`, không tự `overflow-y-auto`, không lồng thêm
  `<main>`. Sidebar `fixed h-screen` là ngoại lệ hợp lệ (nằm ngoài luồng). Xem `DESIGN_SYSTEM.md §3`.

### §Cây chức vụ & Cây duyệt

Chuỗi duyệt OT **tự suy** từ Chức vụ của người giữ + 3 loại cây duyệt Admin cấu hình, rồi **snapshot** vào từng
đơn lúc tạo. Mục này là **trạng thái hiện hành**, đã đối chiếu với code; lịch sử 17 giai đoạn xây dựng đã bỏ
(tra `git log`). Đã xoá hẳn, đừng dựng lại: `UserApprovalScope`/`ApprovalLevel`/`ScopeType`, `OtFormStatus` 6 giá
trị, vai trò `Submitter`/`GroupHead`, `Group.Requester*`/`Responsible*`, giai đoạn Draft, `JobTitle.RequiresSignature`.

> Nhãn UI: entity `Department` hiển thị là **"Bộ phận"**, entity `Group` hiển thị là **"Nhóm"**. Chỉ đổi chữ hiển
> thị — tên entity, route, permission giữ nguyên.

#### Mô hình dữ liệu

**`JobTitle`** (`Code`, `Name`, `RankOrder`, `TerminalLevel`, `IsLineScoped`) — dữ liệu quản trong DB qua màn
Danh mục ▸ Chức vụ, không seed trong code. Bộ đang dùng gồm 7: Staff, Line Leader, Group Leader, Team Leader,
Manager, Factory Manager, Director.
- `TerminalLevel` (`JobTitleTerminalLevel`): `None=0` · `DepartmentManager=1` (Manager) · `WorkshopManager=2` (Factory
  Manager) · `GeneralDirector=3` (Director). Mỗi mức khác `None` chỉ 1 Chức vụ active giữ (`JobTitleService`).
- `RankOrder` (số lớn = cấp cao) chỉ dùng để loại bước ngang/thấp hơn người tạo khỏi chuỗi. Kéo-thả đổi thứ tự:
  `PUT /api/JobTitle/reorder`. Xoá Chức vụ bị chặn khi còn nhân viên đang giữ.
- `IsLineScoped` chỉ `true` cho Line Leader: ứng viên bước này suy theo Line, **không** theo `Employee.JobTitleId`.

**Gán tổ chức theo Chức vụ** (`EmployeeService.ValidateOrganizationAssignmentAsync`, gọi ở Create/Update). `Employee.GroupId` và `Employee.DepartmentId` đều nullable; luật theo `TerminalLevel` của Chức vụ đang gán:

| `TerminalLevel` | `GroupId` | `DepartmentId` |
|---|---|---|
| `None` (hoặc chưa gán Chức vụ) | bắt buộc | phải trống |
| `DepartmentManager` | phải trống | bắt buộc (chỉ quản lý Phòng ban, không thuộc Nhóm nào) |
| `WorkshopManager` / `GeneralDirector` | phải trống | phải trống (dùng chung toàn công ty) |

**Ba cây duyệt** — mỗi cây quản lý kiểu "thay nguyên danh sách" (`ReplaceAsync`), không có CRUD từng dòng. Non-Admin
chỉ xem/sửa được cây của đơn vị mình là Người phụ trách (xem §Phân quyền Coordinator).

| Cây | Dùng cho | Chứa | Validate khi lưu | Endpoint · permission |
|---|---|---|---|---|
| `DepartmentApprovalStep` (theo Bộ phận) | đơn theo Nhóm, **3 cấp cuối** | Chức vụ `TerminalLevel != None`; `RequiresSignature` từng bước | không trùng Chức vụ | `by-department/{id}` · `DepartmentApprovalStep.View/Update` |
| `GroupApprovalStep` (theo Nhóm) | đơn theo Nhóm, **cấp trung gian** | Chức vụ `TerminalLevel == None`; `RequiresSignature`; `IsResponsible` | không trùng; tối đa 1 `IsResponsible`; nếu có bước thì **1–2 bước** `RequiresSignature` | `by-group/{id}` · `GroupApprovalStep.View/Update` |
| `ProductionApprovalStep` (theo Bộ phận) | đơn **theo chuyền** (Chế tạo), 1 danh sách duy nhất | Line Leader → Group Leader → Team Leader → Manager → Factory Manager → Director; `RequiresSignature`; `IsResponsible` | không trùng; tối đa 1 `IsResponsible`; nếu có bước trung gian thì **1–2 bước trung gian** `RequiresSignature` | `by-department/{id}` · `ProductionApprovalStep.View/Update` |

Route đầy đủ: `GET/PUT /api/{DepartmentApprovalStep|GroupApprovalStep|ProductionApprovalStep}/...`; thêm
`GET /api/DepartmentApprovalStep/my-departments`. Lý do "1–2 người ký": giấy in YEV-22-024 chỉ có **2 ô "Người
đề nghị"**. Số bước trung gian **không** giới hạn — chỉ số bước `RequiresSignature` bị giới hạn; bước "chỉ xác nhận"
thì không in tên vào ô. `RequiresSignature` và `IsResponsible` cấu hình **theo từng bước của từng đơn vị**, không gắn
vào Chức vụ (cùng 1 Chức vụ có thể phải ký ở Bộ phận này, chỉ xác nhận ở Bộ phận khác). `IsResponsible` là người in ở
ô "Người chịu trách nhiệm" riêng, khác 2 ô "Người đề nghị".

#### Suy luận chuỗi duyệt (`JobTitleApprovalChainService`)

**Đơn theo Nhóm** (`ResolveChainForCreationAsync`):
- Chuỗi = `GroupApprovalStep` của Nhóm, **rồi** `DepartmentApprovalStep` của Bộ phận (2 nguồn `StepOrder` độc lập, nối
  theo thứ tự). Cắt tại bước đầu tiên có `TerminalLevel` khớp `OtCase.RequiredApprovalLevel`. Bước có `RankOrder <=`
  cấp người tạo bị loại (người tạo không tự duyệt đơn mình). Admin không phải Employee → coi `RankOrder = 0`.
- Ứng viên mỗi bước (đều phải `!IsDeleted` và có `UserName`): cấp trung gian → `Employee.GroupId == groupId`;
  `DepartmentManager` → `Employee.DepartmentId == dept` hoặc `Group.DepartmentId == dept`; `WorkshopManager`/
  `GeneralDirector` → toàn công ty.

**Đơn theo chuyền** (`ResolveChainForProductionCreationAsync`): chuỗi = `ProductionApprovalStep` của Bộ phận, giữ bước có
`RankOrder >= cấp người tạo` (dấu `>=`: bước Line Leader của chính người tạo **được giữ**, nên đơn dừng ở đó tới khi
họ tự ký rồi mới lên cấp trên). Ứng viên:
- **Line Leader** (`IsLineScoped`): `ProductionEmployee.IsLeader == true` **và** `ProductionLineId` khớp Line suy từ
  những người trong đơn (cột LEADER của file import nhân sự dưới chuyền, luôn mới nhất mỗi lần import). Gán
  `Employee.JobTitleId = "Line Leader"` cho ai đó **không có tác dụng** với việc suy ứng viên.
- **Group Leader / Team Leader**: cả **Bộ phận** (`Group.DepartmentId == dept` hoặc `Employee.DepartmentId == dept`),
  tìm theo `Employee.JobTitleId` gán tay — không có nguồn dữ liệu sẵn, file import chỉ có 1 cột LEADER.
- Manager theo Bộ phận; Factory Manager/Director toàn công ty.

**Chung cho cả 2 loại:**
- Thiếu cấu hình, hoặc 1 bước chưa ai giữ Chức vụ → `IsComplete = false` + `Warning` cụ thể, **không tự fallback** và
  **không chặn tạo đơn**; cảnh báo lưu ở `OtForm.ApprovalChainWarning`, FE hiện banner. Chuỗi 0 bước **và**
  `IsComplete = true` → đơn `Completed` ngay lúc tạo (cộng lũy kế luôn). Điều kiện đúng là cả 2 vế: chỉ xét
  `Steps.Count == 0` sẽ nhầm "Phòng ban chưa cấu hình" (phải kẹt `InApproval`) thành "không cần duyệt".
- **`RequiresCreatorSelfSign`**: khi **mọi** bước trung gian `RequiresSignature` đã cấu hình đều có `RankOrder <=` cấp
  người tạo (và có cấu hình ít nhất 1 bước như vậy), ô "Người đề nghị" không còn ai ký → chính người tạo ký, bằng chữ
  ký đã đăng ký ở `UserSignature`. `CreateAsync` chặn nếu người tạo chưa đăng ký chữ ký; chữ ký snapshot vào
  `OtForm.CreatorSignatureImage`, và người tạo mặc nhiên là "Người chịu trách nhiệm" (bản in tự fallback về
  `CreatedByFullName`).
- Ứng viên **chốt 1 lần lúc tạo đơn**, không resolve lại. Bước nào có 0 ứng viên thì đơn **kẹt vĩnh viễn** dù sau đó
  Admin gán đủ người — cách gỡ duy nhất là Admin xoá đơn (xem "Xoá đơn" bên dưới).
- `GET /api/JobTitle/resolve-chain?employeeId=&otCaseId=` (`JobTitle.View`) chỉ để xem trước/debug qua Scalar; FE
  không còn màn xem trước.

#### Snapshot và engine duyệt

- Lúc tạo đơn, mỗi bước chuỗi được snapshot thành `OtFormApprovalStep` (`JobTitleCodeSnapshot`, `JobTitleNameSnapshot`,
  `RequiresSignatureSnapshot`, `IsResponsibleSnapshot`, `TerminalLevelSnapshot`, `Status`) kèm `OtFormApprovalStepCandidate`
  (người đủ điều kiện). Tổ chức/cây duyệt đổi sau đó **không** ảnh hưởng đơn đang chạy.
- `OtFormStatus`: `InApproval=0` · `Completed=1` · `Rejected=2`. Mọi bước tạo `Pending`; **bước đang chờ** = bước
  `Pending` có `StepOrder` nhỏ nhất. `OtFormApprovalStepStatus`: `Pending` · `Approved` · `Rejected` · `Skipped`.
- **Tạo đơn = vào chuỗi duyệt ngay** (không còn Draft). Mail gửi cho ứng viên bước đầu; nếu bước đầu đã là 1 trong 3
  cấp quản lý thì không gửi mail riêng, chỉ có mail tổng hợp hằng ngày (xem §Đơn tổng).
- **Duyệt/Từ chối** (`ApproveAsync`/`RejectAsync`): người gọi phải nằm trong `Candidates` của bước đang chờ, **không có
  Admin bypass**; luôn cần mật khẩu cấp 2; chỉ cần chữ ký khi `RequiresSignatureSnapshot` (thiếu `UserSignature` → lỗi).
  Duyệt hết bước cuối → `Completed` + cộng lũy kế; Từ chối → các bước `Pending` còn lại thành `Skipped`, đơn `Rejected`.
- **Duyệt/Từ chối hàng loạt**: `POST /api/OtForm/bulk-approve`, `bulk-reject` (`OtForm.Approve`). Lặp lại đúng
  `ApproveAsync`/`RejectAsync` cho từng đơn; Comment và mật khẩu cấp 2 dùng chung cả loạt; mỗi đơn thành công/thất bại độc
  lập, trả `List<BulkOtFormActionResultItemDto>`.

#### Ai được tạo, sửa, loại nhân viên, xoá đơn

**Tạo đơn.**
- Cổng chặn `POST /api/OtForm`, `PUT /api/OtForm/{id}`, `POST check-overlap`: `[RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]` — **OR** nhiều permission (`PermissionRequirement.Permissions[]`, chuỗi
  policy tách bằng `|`). Bên trong `POST`, đơn theo chuyền đòi `CreateProduction`, đơn theo Nhóm đòi `Create`.
- **Theo Nhóm**: chỉ tạo cho đúng Nhóm của Employee liên kết với tài khoản (hoặc Admin). `GET my-create-scopes`
  (`Create`) trả tối đa 1 Nhóm; Admin trả rỗng = không giới hạn.
- **Theo chuyền**: cần `CreateProduction` (cấu hình theo Chức vụ hoặc từng user; tick sẵn cho Line Leader). Non-Admin
  phải là Line Leader (`ProductionEmployee.IsLeader`) của **toàn bộ** Line có trong đơn (không phải chỉ giao nhau ≥ 1
  Line), người tạo **không** cần nằm trong danh sách tăng ca. Mọi nhân viên phải có Nhóm ca (`ShiftTeamId`).
  `GET my-production-create-scopes` (`CreateProduction`) trả các tổ hợp `(Bộ phận, Team, Line, Nhóm ca)` của họ: đúng
  1 tổ hợp → FE tự điền và khoá cứng; nhiều tổ hợp → chỉ giới hạn dropdown trong các tổ hợp đó; 0 tổ hợp (Admin cấp
  riêng) → dropdown tự do. Tài khoản chỉ có `CreateProduction` vào thẳng tab "Theo chuyền", ẩn tab "Theo Nhóm".
- Mọi lần Tạo đơn và Lưu sửa đơn đều cần **mật khẩu cấp 2** (1 lần cho cả lượt lưu).

**Sửa đơn** (`PUT /api/OtForm/{id}`, `UpdateAsync`, chỉ khi `InApproval`):
- **Theo Nhóm**: chỉ **người tạo**, và **chưa có bước nào `Approved`**, cộng kiểm phạm vi Nhóm.
- **Theo chuyền**: **ứng viên của bước `Pending` hiện tại** (không Admin bypass). Bước đã ký thì bị khoá, nhưng chữ ký cũ
  **giữ nguyên** khi bước sau sửa (không bắt ký lại); mỗi cấp tự ký xong là khoá bước của mình.
- Thêm/xoá nhân viên nằm **trong** `UpdateAsync`: `Employees[]` (có thể chứa người mới) và `RemovedEmployees[]` (bắt
  buộc `Reason`); BE diff để suy người thêm/giữ/loại. Thêm vào đơn theo chuyền phải khớp ít nhất 1 cặp `(BlockCode, ShiftTeamCode)` của nhân viên còn lại; đơn theo Nhóm phải cùng `GroupId`; vẫn qua kiểm hạn mức giờ OT và trùng giờ.
  Người từng bị loại khỏi chính đơn này được tái dùng đúng dòng `OtFormEmployee` cũ. Không còn route `employees/add`.
- Mỗi thay đổi ghi `OtFormEditLog` (`TimeChanged`/`NoteChanged`/`EmployeeAdded`/`EmployeeRemoved`, 1 dòng/1 field đổi),
  đọc qua `OtFormDto.EditLogs[]`; **không** ghi lúc tạo đơn.

**Loại nhân viên ngay trên màn Duyệt** — `POST /api/OtForm/{id}/employees/remove` (`OtForm.RemoveEmployee`, body
`{ employeeId, reason }`, **không** mật khẩu cấp 2): Admin luôn được; người khác phải là ứng viên của bước đang chờ
(cho cả 2 loại đơn, khác `UpdateAsync` đơn theo Nhóm vốn chỉ người tạo). Cùng `RemoveEmployeeCoreAsync` với kênh email
(`email-confirm/{token}/employees/remove`) và với `UpdateAsync`, nên dữ liệu (`OtFormEmployee.Removed*`) và log giống
hệt. Quyền `Attendance.OTForm.AddEmployee` còn trong whitelist nhưng **không còn action nào kiểm** — treo, vô hại.

**Xoá đơn** — `POST /api/OtForm/{id}/delete` (`Attendance.OTForm.Delete`, chỉ Admin, body `{ reason }` bắt buộc). Chặn khi
`Completed` (đã cộng lũy kế thật, xoá sẽ làm sai số liệu dùng cho lương). Xoá mềm: `IsDeleted`, `DeletedByUserName`,
`DeletedByFullName`, `DeletedAt`, `DeleteReason`; `Status` giữ nguyên. Đây là lối thoát cho đơn kẹt ở bước 0 ứng viên.

#### Quyền theo Chức vụ (`JobTitlePermission`)

Gán Chức vụ xong **tự có đủ quyền vận hành**, không cần Admin cấp tay thêm.
- `JobTitlePermission(JobTitleId, PermissionCode)` — code lưu dạng **chuỗi** (không FK) vì bảng `Permissions` ở DB
  Identity, khác DB Attendance. Chỉ nhận code trong `JobTitlePermissionWhitelist.AllowedCodes` (400 nếu ngoài): nhóm
  "tham gia quy trình" — `OTForm.{View,Create,CreateProduction,Approve,RemoveEmployee,AddEmployee}`,
  `UserSignature.{View,Update}`, `SecondaryPassword.Update`, `{Department,Group,OtCase,Reason,Employee,JobTitle}.View`,
  `ProductionOtReport.View`, `ProductionEmployee.{View,Update,Import,Export}`, `EmployeeAccumulation.Import`.
  **Tuyệt đối không** đưa nhóm "quản trị" (CRUD danh mục, `Setting.Update`, `AiChat.Use`, `*ApprovalStep.Update`,
  `JobTitlePermission.*`, `OTForm.Delete`) vào whitelist — đó là hàng rào chặn việc tự leo thang quyền bằng cách đổi Chức vụ.
- API: `GET/PUT /api/JobTitlePermission/by-job-title/{id}` (`JobTitlePermission.View/Update`), `GET allowed-codes`
  (để FE không hardcode song song). FE: section "Quyền" **bên trong modal Sửa chức vụ** (`JobTitleForm.tsx` +
  `JobTitlePermissionSection.tsx`, chỉ khi `mode="edit"`, có nút Lưu riêng).
- **Đồng bộ thật**: `IUserDirectoryService.SyncAutoGrantedPermissionsAsync(userName, desiredCodes)` ghi
  `UserPermission.IsAutoGranted = true`; chỉ thêm/xoá dòng **auto**, **không bao giờ** đụng dòng Admin cấp tay
  (`IsAutoGranted = false`). Gọi khi `JobTitleId`/`UserName` của Employee đổi (Create/Update/Delete), và khi lưu mapping
  (`JobTitlePermissionService.ReplaceAsync` đồng bộ lại mọi người đang giữ Chức vụ đó).
- **Chỉ 1 hàm gộp**: `EmployeeService.SyncAutoGrantedPermissionsCoreAsync` tính lại cả quyền theo Chức vụ lẫn theo vai
  trò Người phụ trách rồi gọi hàm sync **một lần**. Hàm sync **thay nguyên** danh sách auto của user, nên gọi tách theo
  từng nguồn sẽ để nguồn gọi sau xoá mất quyền nguồn kia vừa cấp.
- Employee có Chức vụ nhưng chưa có `UserName` → không có gì để cấp; tự có hiệu lực ngay lần lưu gán `UserName`.
- "Tuỳ chỉnh quyền" của Admin (`PermissionService.UpdateUserPermissionOverridesAsync`) chỉ ghi lại phần
  `IsAutoGranted = false`. Nếu Admin chọn đúng permission đang auto thì coi là **chiếm quyền thủ công** (từ đó không còn
  đồng bộ theo Chức vụ). Bẫy EF: Delete + Add cùng khoá `(UserId, PermissionId)` trong 1 `SaveChangesAsync` không xử lý
  đúng — phải **Update tại chỗ** entity đang tracked.
- Quyền của 1 phiên đăng nhập đang mở chỉ đọc lại qua `GET /api/Auth/me` (JWT không tự refresh): sau khi quyền đổi, bấm
  "Làm mới quyền" ở Header hoặc đăng nhập lại.
- **Thêm permission mới cho 1 hành động** thì phải thêm cả vào `JobTitlePermissions` (nếu cho phép cấp theo Chức vụ),
  không chỉ seed theo Role — quên bước này là lỗi đã gặp (`AddEmployee` được seed cho Role nhưng không bao giờ tới tay
  người giữ Chức vụ). Và khi 1 quyền mới được coi là "tương đương" quyền cũ ở 1 chức năng (`CreateProduction` ≈ `Create`
  cho đơn theo chuyền), phải `grep` **tên permission cũ trên toàn solution** (mọi `[RequirePermission]` ở BE + route
  guard/sidebar/nút ở FE): `ProductionEmployeeController` từng bị sót, người dùng chỉ thấy "Không tìm thấy ai khớp bộ lọc"
  vì FE nuốt lỗi 403.

#### Người phụ trách Cây duyệt (Coordinator)

`DepartmentApprovalStepCoordinator(DepartmentId, EmployeeId)` và `GroupApprovalStepCoordinator(GroupId, EmployeeId)`:
Admin **gán tay** người phụ trách cấu hình cây duyệt của từng đơn vị (không suy theo Chức vụ). Chỉ chọn được Employee
đang thuộc **đúng** Bộ phận/Nhóm đó; Employee chưa có `UserName` vẫn gán được (quyền có hiệu lực khi liên kết tài khoản).
Bộ phận và Nhóm **tách biệt** — phụ trách Bộ phận không tự phụ trách Nhóm con. Cây `ProductionApprovalStep` dùng chung
bảng Coordinator **Bộ phận**. Quản lý bảng gán chỉ Admin (`*Coordinator.View/Update`). Quyền tự cấp, 3 guard thực thi
phạm vi và luật import: xem **§Phân quyền Coordinator**.

**Gán Chức vụ có phạm vi** — `PUT /api/Employee/{id}/department-job-title?departmentId=` (gate `DepartmentApprovalStep.Update`) và `.../group-job-title?groupId=` (gate `GroupApprovalStep.Update`): Người phụ trách tự gán Chức vụ cho nhân viên
**trong đúng đơn vị mình**, không cần `Employee.Update`. Nhân viên phải thuộc đơn vị đó; non-Admin phải có tên trong bảng
Coordinator của đơn vị; **chỉ Admin** gán được Trưởng Xưởng/Giám đốc. BE tự tính lại `GroupId`/`DepartmentId` theo
`TerminalLevel` (không nhận từ client); route nhóm chỉ nhận Chức vụ `TerminalLevel == None`.

#### FE màn "Cây duyệt" và Danh mục

- Tab **"Cây duyệt"** (`ApprovalStepManager.tsx`) có 2 tab con: **"Theo Nhóm"** (khối cấp trung gian theo Nhóm, rồi khối
  cấp cuối theo Bộ phận — đánh số bước liên tục Nhóm → Bộ phận) và **"Theo chuyền"**. Thành phần dùng chung ở
  `components/job-titles/`: `StepCard.tsx` (thẻ 1 bước), `StepHolders.tsx` ("đang giữ" + combobox thêm), `CoordinatorsBox.tsx`
  (khối Người phụ trách, dùng chung Nhóm + Bộ phận). Sắp xếp bằng kéo-thả (`useDragReorder.ts`, HTML5 thuần).
- Phần "đang giữ chức vụ" truyền qua prop `footer` vì khác nhau giữa 3 khối. Khối Chuyền: Line Leader chỉ hiện ghi chú
  "tự động theo import"; Group Leader/Team Leader có picker gán/gỡ; 3 cấp cuối chỉ trỏ sang khối Bộ phận (dùng chung
  `Employee.JobTitleId` nên gán ở đâu cũng có hiệu lực cho cả 2 luồng).
- Đổi Bộ phận/Nhóm khi state đang dirty → hỏi `ConfirmDialog`; ô chọn Bộ phận/Nhóm dùng `SearchableSelect`. Khối
  "Người phụ trách" chỉ hiện với người có `*Coordinator.View` (Admin), để Người phụ trách thường không gọi API 403.
- Sidebar mục "Danh mục" hiện với `Attendance.Department.Create` **hoặc** `*ApprovalStep.Update` (mảng `permissions`
  + `hasAnyPermission`), để Người phụ trách không phải Admin vẫn vào được màn Cây duyệt.
- `EmployeeForm.tsx`: chọn **Chức vụ trước**, ô Bộ phận/Phòng ban ẩn/hiện theo `TerminalLevel` và tự reset khi đổi
  nhóm Chức vụ.

#### Dữ liệu test (chỉ dev)

16 tài khoản `TEST\...` để thử chuỗi duyệt Chế tạo: 11 Line Leader (`ll_shido`, `ll_4s`, `ll_ct`, `ll_f`, `ll_hl`,
`ll_kanbanmae`, `ll_kza`, `ll_kzm`, `ll_tc`, `ll_tca`, `ll_tqm`) cùng `gl_shido`, `tl_shido`, `mgr_ct`, `fm_01`, `dir_01`.
Chỉ đăng nhập được khi BE chạy Development (cơ chế ở `identity-module.md §5.6`). Tài khoản tạo bằng migration seed Identity
(`TestLoginAccounts`); `Employee`/`ProductionEmployee` tương ứng (mã bắt đầu `T-`) ghi tay vào DB, **không** có migration;
dòng `ProductionEmployee` test sẽ bị soft-delete ở lần Import nhân sự dưới chuyền thật kế tiếp (import là upsert-by-code +
xoá mềm mã không còn trong file) — cần tạo lại tay nếu còn cần test. Mật khẩu cấp 2/chữ ký của các tài khoản này cấu hình
tay trong DB (dùng token từ `Pending*Confirmations` thay cho link email, vì tài khoản test không có email thật).

#### Bẫy cần nhớ

- Chuỗi đơn **theo Nhóm** lọc `RankOrder > cấp người tạo` (dấu `>`), còn đơn **theo chuyền** dùng `>=`. Hệ quả chưa sửa:
  Group Leader/Team Leader tạo đơn theo Nhóm cho đúng cấp của họ sẽ bị loại bước của chính mình khỏi chuỗi.
- Đơn kẹt do 0 ứng viên chỉ gỡ được bằng xoá đơn; không có API "resolve lại chuỗi".
- Luồng theo chuyền chỉ chạy được khi Bộ phận có `ProductionApprovalStep` **và** mỗi bước có người giữ **có `UserName`**
  (ứng viên luôn lọc `UserName != null`). Nhân viên dưới chuyền được đánh dấu `IsLeader` qua import nhưng chưa liên kết tài
  khoản đăng nhập thì không phải ứng viên, đơn sẽ kẹt ở bước đó.

### §DB
- DB `YevOTManagement` (server `DASVRFAST`, conn `OTManagementConnection`), DbContext `AttendanceDbContext`, migrations ở `Attendance.Infrastructure/Migrations` (~25 migration, sắp theo tên file — thư mục là danh sách đầy đủ, doc không liệt kê lại).
- Solution có nhiều DbContext: mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`.
- Permission/Role của Attendance **không** seed ở đây mà ở migration của `Identity` (DB `YevIdentityManagement`) — xem §Permission & Role của Attendance. Migration có seed (`AddAttendanceSetting` = 1 dòng cấu hình, `AddWorkCalendarAndOtCaseRules` = lịch 2026) ghi ở mục nghiệp vụ tương ứng.


## 1. Cấu trúc code đã có

### Danh mục CRUD chuẩn (Department/Group/Reason/OtCase/JobTitle/Employee)
`DepartmentApprovalStepController`/`GroupApprovalStepController` KHÔNG theo pattern CRUD chuẩn này —
xem riêng ở §Cây chức vụ & Cây duyệt (`GET`/`PUT by-department/{departmentId}` và
`GET`/`PUT by-group/{groupId}`, quản lý theo kiểu thay nguyên danh sách).
Mỗi entity có đủ: `I{Entity}Repository` (Application/Interfaces/Repository) + impl (Infrastructure/Repositories) → property trong `IAttendanceUnitOfWork`/`AttendanceUnitOfWork` → `{Entity}Dto`/`Create{Entity}Dto`/`Update{Entity}Dto` (Application/Dtos) → `{Entity}Service : BaseService<IAttendanceUnitOfWork>` → `{Entity}Controller : BaseController` (route `grid-list`/`all`/`{id}`/POST/PUT/DELETE, `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- `GroupController` có thêm `GET /by-department/{departmentId}` (dropdown phụ thuộc).
- `EmployeeController` có thêm `GET /all` (nhân viên active mọi Group, dùng cho "Thử chuỗi duyệt"), `GET /by-group/{groupId}` (Trưởng nhóm chọn hàng loạt khi lập đơn) và các route phạm vi/lũy kế — xem §Phạm vi xem nhân viên, §Lũy kế & giới hạn giờ OT.
- `JobTitleController` có thêm `GET /resolve-chain?employeeId=&otCaseId=` (xem trước chuỗi duyệt tự
  động, đọc-only — xem §Cây chức vụ & Cây duyệt).

### UserSignature (`UserSignatureController`)
- `GET /me`, `PUT /me` (yêu cầu cập nhật chữ ký **của chính mình** — không áp dụng ngay, gửi email xác nhận, `[RequirePermission("Attendance.UserSignature.Update")]`).
- `GET /{userName}` (admin xem chữ ký người khác, `Attendance.UserSignature.View`).
- `GET/POST /confirm/{token}` (`[AllowAnonymous]`) — xác nhận qua email, xem §Xác thực qua email.

### SecondaryPassword (`SecondaryPasswordController`) — mật khẩu cấp 2
- `GET /me`, `PUT /me` (yêu cầu thiết lập/cập nhật mật khẩu cấp 2 **của chính mình** — không áp dụng
  ngay, gửi email xác nhận, `[RequirePermission("Attendance.SecondaryPassword.Update")]`).
- `GET/POST /confirm/{token}` (`[AllowAnonymous]`) — xác nhận qua email, mirror `UserSignatureController`.
- Không có `GET /{userName}` (khác `UserSignature`) — không có nhu cầu Admin xem hộ mật khẩu người khác.
- Xem §Mật khẩu cấp 2 khi ký/duyệt OtForm.

### AttendanceSetting (`AttendanceSettingController`) — cấu hình dùng chung
- `GET /api/AttendanceSetting` — **KHÔNG có `[RequirePermission]`**, mở cho mọi tài khoản đăng nhập
  vì màn Tạo đơn cần đọc để tự tính phiếu ăn/tô đỏ lũy kế.
- `PUT /api/AttendanceSetting` — `[RequirePermission("Attendance.Setting.Update")]` (chỉ Admin).
- Field `BatchAutoSendTime:TimeOnly` — giờ tự động gom "Đơn tổng", xem §Đơn tổng.
- Xem §Cấu hình phiếu ăn & giới hạn lũy kế.

### OtForm (`OtFormController`) — nghiệp vụ chính

Hợp đồng đầy đủ (request/response): `attendance-api-fe.md`. Bảng dưới là bản đồ route → quyền → hàm Service.

| Route | Quyền | Việc |
|---|---|---|
| `POST /api/OtForm` | `OTForm.Create` **hoặc** `CreateProduction` (cổng OR), rồi Controller kiểm lại đúng quyền theo `request.IsProductionForm` | Tạo đơn (`CreateAsync`), vào chuỗi duyệt ngay (không có Draft). Cần `SecondaryPassword`. |
| `PUT /api/OtForm/{id}` | `Create` hoặc `CreateProduction` | Sửa giờ/ghi chú/thêm-loại nhân viên (`UpdateAsync`, quyền thật kiểm theo bước/phạm vi trong Service) — luật ở §Cây chức vụ & Cây duyệt |
| `POST /api/OtForm/check-overlap` | `Create` hoặc `CreateProduction` | Trả danh sách nhân viên trùng giờ trước khi submit |
| `GET /api/OtForm/my-create-scopes`, `my-production-create-scopes` | `Create` / `CreateProduction` | Nhóm / tổ hợp Team-Line-Nhóm ca mà người gọi được tạo (rỗng với Admin) để FE điền sẵn và khoá dropdown |
| `GET /api/OtForm/{id}` | `OTForm.View` | Chi tiết: `employees[]` (kèm lũy kế snapshot + phiếu ăn, cả người đã bị loại), `ProcessPart`, `approvalHistories`, `approvalSteps[]` |
| `my-forms`, `pending-approvals` (+`/count`, `/dates`), `my-actions`, `my-participations`, `all-forms` | xem §Danh sách đơn | 5 danh sách + lịch chờ duyệt; `pending-approvals` mỗi item có `CurrentStepCandidateCount` (FE hiện "đang chờ 1 trong N người" khi > 1) |
| `POST /{id}/approve`, `POST /{id}/reject` | `OTForm.Approve` | Tác động lên bước `Pending` nhỏ nhất; ký thật chỉ bắt buộc khi `RequiresSignatureSnapshot`; cần `SecondaryPassword`; `approve` cộng sổ lũy kế khi đơn `Completed` |
| `POST /bulk-approve`, `POST /bulk-reject` | `OTForm.Approve` | Ký/Từ chối hàng loạt, trả 200 kèm kết quả từng đơn (`BulkOtFormActionResultItemDto`), không all-or-nothing |
| `POST /{id}/employees/remove` | `OTForm.RemoveEmployee` | Loại 1 nhân viên (§Loại nhân viên khỏi đơn) |
| `POST /{id}/delete` | `OTForm.Delete` (Admin) | Xoá đơn kẹt, chặn đơn `Completed` |
| `GET /email-confirm/{token}`, `POST .../approve`, `.../reject`, `.../employees/remove` | `[AllowAnonymous]` | Kênh email (§Xác thực qua email) |

`BaseController.CurrentUserName`/`CurrentFullName` (`Attendance.Api/Controllers/BaseController.cs`) lấy người đang gọi; Admin xác định bằng `User.IsInRole("Admin")`. Danh sách nhận chung `fromDate`/`toDate` (`OtForm.Date`, gồm hai đầu mút) và `status`.

### OtFormBatch (`OtFormBatchController`) — Đơn tổng
Route, quyền và logic: §Đơn tổng. Lưu ý vận hành: `POST /api/OtFormBatch/run-now` (`Attendance.Setting.Update`) chạy ngay `RunDailyBatchSweepAsync()`; khi đang có batch `Pending` thật nó **gửi mail nhắc thật** cho người duyệt, không phải thao tác read-only.

### AttendanceAiChat (`AttendanceAiChatController`) — trợ lý AI lập đơn tăng ca
> **Mục này là nguồn chân lý về kiến trúc/code của Attendance AI Chat**; hợp đồng FE ở
> [attendance-api-fe.md §10](attendance-api-fe.md). (File thiết kế gốc `attendance-aichat-be-huong-dan.md`
> đã xoá 2026-10-02 — phần cốt lõi gom vào đây; tra `git log` nếu cần transcript/bối cảnh cũ.)

- `POST /api/AttendanceAiChat/stream` (`Attendance.AiChat.Use`, seed migration `AddAttendanceAiChatPermission`,
  hiện chỉ gán Admin) — NDJSON streaming, cùng pattern deliberate exception "không bọc `ApiResponse<T>`"
  như `Asset.Api.Controllers.AiChatController`.
- **Khác Asset AI Chat ở điểm cốt lõi**: đây là tool GHI dữ liệu đầu tiên (`create_ot_form_draft` gọi
  thẳng `OtFormService.CreateAsync` đã có — không business logic mới, không bypass validate/scope nào).
  `AttendanceAiChatController` phải tự đọc `CurrentUserName`/`CurrentFullName`/`User.IsInRole(AdminRole)`
  rồi truyền tay xuống orchestrator (`AttendanceAiChatCallerContext { UserName, FullName, IsAdmin }`)
  → `IAttendanceAiChatToolExecutorService.ExecuteAsync(toolName, arguments, caller, ct)`. Phải truyền
  tay vì `Attendance.Application` không có `IHttpContextAccessor` ở bất kỳ đâu — khác `AiChatController`
  của Asset (không cần biết ai đang hỏi vì mọi tool đều read-only).
- **`IOllamaChatClient`/`OllamaChatClient` dùng chung với Asset**, đã chuyển từ `Asset.Application`/
  `Asset.Infrastructure` sang `Shared.Application`/`Shared.Infrastructure` (2026-07-29) — 1 registration
  DI duy nhất phục vụ cả 2 module, `tools` (JSON schema) giờ là tham số thay vì hard-code
  `AiChatToolDefinitions` của Asset.

#### 7 tool — `Attendance.Application/Dtos/AiChat/AttendanceAiChatToolDefinitions.cs`

| Tool | Gọi tới | Ghi/Đọc |
|---|---|---|
| `search_departments` | `IDepartmentService.GetAllActiveAsync()` (lọc keyword ở executor) | Đọc |
| `search_groups` | `IGroupService.GetAllActiveAsync()` / `GetByDepartmentIdAsync(id)` | Đọc |
| `search_reasons` | `IReasonService.GetAllActiveAsync()` | Đọc |
| `search_ot_cases` | `IOtCaseService.GetAllActiveAsync()` | Đọc |
| `search_employees_by_group` | `IEmployeeService.GetByGroupIdAsync(groupId)` | Đọc |
| `get_my_create_scopes` | `IOtFormService.GetMyCreateScopesAsync(caller.UserName, caller.IsAdmin)` — không tham số, luôn theo danh tính người đang chat. **Admin trả rỗng = KHÔNG giới hạn**, không phải không có quyền | Đọc |
| `create_ot_form_draft` | `IOtFormService.CreateAsync(caller.UserName, caller.FullName, caller.IsAdmin, dto)` | **GHI** — tool duy nhất |

`create_ot_form_draft` nhận đủ field như `CreateOtFormDto` thật (không rút gọn). Mọi id phải lấy từ
block dữ liệu tham chiếu/tool tra cứu — **không có validate nào ở BE chặn model bịa id**; id sai thì
`CreateAsync` ném `NotFoundException`/`DomainException`, executor bắt và trả JSON lỗi cho model đọc
lại, không vỡ stream. Chỉ `get_my_create_scopes` và `create_ot_form_draft` thực sự dùng `caller`.

#### Cổng xác nhận trước khi ghi — ràng buộc bằng CẤU TRÚC, không chỉ prompt

Cả 2 lớp nằm trong `AttendanceAiChatService.cs`:

1. **Prompt-level** — `DefaultSystemPrompt` có rule "QUY TẮC XÁC NHẬN TRƯỚC KHI TẠO ĐƠN". Cần nhưng
   **không đủ**: model nhỏ đã chứng minh không tuân prompt ổn định.
2. **Structural-level (lớp chặn thật)** — `ConfirmationPattern`, regex khớp từ khẳng định ở **ĐẦU tin
   nhắn CỦA NGƯỜI DÙNG** (`request.Message`, KHÔNG phải câu model tự sinh):
   `^\s*(đồng ý|dong y|xác nhận|xac nhan|ok(ay)?|được|duoc|tạo đi|tao di|yes|confirm)\b`.
   Trước khi thực thi `tool_calls` tên `create_ot_form_draft`, orchestrator kiểm pattern này trên lượt
   hiện tại; không khớp → không chuyển cho executor, tự tổng hợp 1 message `role:"tool"` báo "chưa xác
   nhận" và tiếp tục vòng lặp. **Model không tự vượt qua được** kể cả khi hallucinate là đã có xác nhận
   (đúng kiểu lỗi ở `asset-module.md §1.18`), vì điều kiện dựa trên chữ chính người dùng gõ.
   Đánh đổi đã chấp nhận: "Ok nhưng..." vẫn khớp; diễn đạt lạ không khớp thì bị hỏi lại (an toàn hơn).
3. `UnfulfilledPromisePattern` (port từ Asset, thêm `tạo` vào nhóm động từ hứa suông) + auto-retry
   **cùng lượt**: text khớp pattern mà không có `tool_calls` → nhúng system message nhắc và gọi lại
   model ngay trong cùng request, tối đa `MaxPromiseRetries = 2`.

#### Nạp sẵn dữ liệu tham chiếu vào context — quyết định kiến trúc chính

Mô hình cũ "bắt model tự gọi tool tra cứu danh mục" hỏng theo 3 cách cùng lúc: (1) model **bịa danh
sách kèm id SAI** — nói `TH1 (ID: 2)` trong khi DB `TH1 = id 1`, đơn tạo ra sai Trường hợp OT mà trông
hoàn toàn hợp lệ; (2) đốt hết ngân sách round (cần ≥4 lần tra trước khi tạo, `MaxToolRounds = 3`);
(3) mất trắng kết quả tra giữa các lượt vì `AttendanceAiChatMessageDto` chỉ có role `user`/`assistant`,
FE không bao giờ gửi lại `role:"tool"` → lượt sau model "nhớ" bằng cách bịa lại.

Dữ liệu danh mục ở đây nhỏ, tĩnh và luôn cần (~83 dòng text: 1 phạm vi + 3 Trường hợp OT + 7 nhân viên
+ 72 Lý do) nên phải nạp **tất định**, không đặt sau tool call model có thể bỏ qua:

- `IAttendanceAiChatToolExecutorService.BuildReferenceContextAsync(caller, ct)` trả 1 block **plain
  text** (không JSON — model tái tạo "id 1 = TH1" chính xác hơn, tốn ít token hơn): ngày hôm nay,
  phạm vi tạo đơn kèm `groupId`/`departmentId` thật, nhân viên của Nhóm (**chỉ nạp khi có đúng 1 phạm
  vi**), toàn bộ Trường hợp OT, toàn bộ Lý do. Không bao giờ throw — lỗi tra cứu thì giữ phần lấy được
  + chèn dòng CẢNH BÁO yêu cầu dùng tool cho phần thiếu (danh sách cắt dở chính là thứ model hay "hoàn
  thiện" bằng cách bịa).
- `StreamChatAsync` chèn block này thành **message `system` thứ hai, mỗi lượt** (không dựa history vì
  history không mang dữ liệu tool).
- Ngân sách round riêng: `AiChatSettings:AttendanceMaxToolRounds = 5` — **không** nâng `MaxToolRounds`
  dùng chung, luồng read-only của Asset không cần headroom này (mỗi round ~20-30s trên Ollama CPU).
- 6 tool tra cứu hạ xuống thành **đường dự phòng** (Admin không giới hạn phạm vi, hoặc cần Nhóm khác).

Đo thật sau khi đổi: số tool call để hỏi xong thông tin 4+ → **0**; Trường hợp OT và nhân viên khớp
100% id trong DB; tự nhận đúng Nhóm/Bộ phận thay vì hỏi lại.

#### System prompt — nguồn chân lý là code

`AttendanceAiChatService.DefaultSystemPrompt`, **không chép nội dung prompt ra doc**. Prompt ràng buộc
4 nhóm quy tắc, sửa code thì giữ nguyên tinh thần: (1) luôn trả lời tiếng Việt; (2) lấy id từ đúng
block dữ liệu tham chiếu, **cấm suy đoán id theo thứ tự xuất hiện**; (3) bắt buộc liệt kê lựa chọn
đánh số thay vì hỏi suông ("ai tham gia tăng ca?") — gọi `search_reasons`/`search_ot_cases`/
`search_employees_by_group` NGAY trước khi hỏi, không bắt người dùng tự nhớ tên/mã; (4) cổng xác nhận
trước khi ghi.

#### Còn nợ

- `Attendance.AiChat.Use` chỉ Admin có (không nằm trong `JobTitlePermissionWhitelist`); mở cho người khác phải gán từng user và cần xác nhận với Admin trước.
- Tool ghi duy nhất tên `create_ot_form_draft` nhưng gọi thẳng `OtFormService.CreateAsync` (đơn vào chuỗi duyệt ngay, không có Draft): tên tool và chữ "Draft" trong system prompt vẫn còn, cần rà cho khớp.
- Chưa test luồng model đưa `employeeId` khác Group với `groupId` đã chọn (`ValidateEmployeesAsync` sẽ
  ném `DomainException`, executor bắt — đúng theo review code nhưng chưa có transcript thật).
- Nếu số Lý do tăng lên hàng trăm, cân nhắc lọc sẵn phía server thay vì nạp full vào context.

**FE**: `yev-frontend/src/modules/attendance-ai-chat/` — module top-level, song song `modules/ai-chat/`
(Asset), KHÔNG lồng trong `modules/attendance/`. Dùng lại `readAiChatStream` + `MarkdownMessage` của
Asset qua import thẳng (không fork). `AttendanceAiChatBox.tsx` fork từ `AiChatBox.tsx`: đổi
`TOOL_LABELS`, đổi sự kiện `device`→`otform`, thêm dải cảnh báo cố định "xác nhận sẽ tạo THẬT + gửi
THẬT email". Route `/ot/ai-chat`, tile ở `ot/page.tsx` **có** gate permission (khác 2 tile cũ).

### EmployeeImport (`EmployeeImportController`) — import Excel nhân sự
- `POST /preview` (nhận file `.xlsx`), `POST /confirm` — pattern Preview/Confirm giống `DeviceImportController` ở module Asset (ClosedXML). Upsert theo `Employee.Code` (unique) — mã đã có thì cập nhật `FirstName/LastName/GroupId`, mã chưa có thì tạo mới kèm tự tạo `Department`/`Group` nếu mã chưa tồn tại. Gắn `[RequirePermission("Attendance.Employee.Create")]`.

### Permission & Role của Attendance

Seed ở Identity (`Indentity.Infrastructure/Migrations`, thư mục gõ sai là cố ý — xem AGENTS.md §3.5); mã permission thêm mới phải seed bằng migration Identity và gán cho `Admin`.

**Role.** Attendance không còn Role theo cấp duyệt. Identity chỉ giữ `Admin` (toàn bộ `Attendance.*`) và 1 Role `Quản lý tăng ca` seed **không kèm permission nào** (nhãn nhóm; quyền thật cấp theo người). 5 Role cũ
(`Trưởng nhóm`/`Trưởng Bộ phận`/`Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc`) và `Nhân viên` đã xoá. Code không tra theo tên Role: `IUserDirectoryService.UserHasPermissionAsync(userName, code)` (tính cả
`UserPermissionOverride`) thay cho `IsUserInRoleAsync`. Ai duyệt được đơn nào do Chức vụ + Cây duyệt quyết định (§Cây chức vụ & Cây duyệt), không phải Role.

**Một người có permission từ 3 nguồn:**

| Nguồn | Cách cấp |
|---|---|
| Role (`Admin`) | Gán ở trang Admin |
| `UserPermissionOverride` | Admin tuỳ chỉnh từng người (`UserPermissionOverrideManager.tsx`) |
| Tự động (`UserPermission.IsAutoGranted = true`) | Đồng bộ bởi `EmployeeService.SyncAutoGrantedPermissionsCoreAsync` từ **Chức vụ** (`JobTitlePermission`, chỉ code trong `JobTitlePermissionWhitelist`) **gộp chung** với quyền của **Người phụ trách** (`ApprovalStepCoordinatorPermissions`) trong 1 lần gọi — xem §Cây chức vụ & Cây duyệt (Quyền theo Chức vụ) và §Phân quyền Coordinator |

**Danh mục permission** (khớp `[RequirePermission]` ở `Attendance.Api`):

| Nhóm | Mã `Attendance.*` |
|---|---|
| Danh mục | `Department`, `Group`, `Reason`, `OtCase`, `JobTitle` × `View/Create/Update/Delete` (`Group.View`, `Department.View`… cũng cần để nạp dropdown ở màn Tạo đơn) |
| Nhân viên | `Employee.View/Create/Update/Delete`, `Employee.UpdateOtLimit`, `EmployeeAccumulation.Update/Import` |
| Đơn tăng ca | `OTForm.View` (đơn của mình), `OTForm.ViewAll`, `OTForm.Create` (theo Nhóm), `OTForm.CreateProduction` (theo chuyền), `OTForm.Approve`, `OTForm.RemoveEmployee`, `OTForm.Delete` (Admin) |
| Chữ ký / mật khẩu cấp 2 | `UserSignature.View/Update`, `SecondaryPassword.Update` |
| Cây duyệt | `DepartmentApprovalStep`, `GroupApprovalStep`, `ProductionApprovalStep` × `View/Update`; `DepartmentApprovalStepCoordinator`, `GroupApprovalStepCoordinator` × `View/Update`; `JobTitlePermission.View/Update` |
| Dưới chuyền / báo cáo | `ProductionEmployee.View/Update/Import/Export`, `ProductionOtReport.View` |
| Khác | `Setting.Update` (`GET /api/AttendanceSetting` **không** cần permission, mở cho mọi tài khoản đăng nhập), `AiChat.Use` |

`OTForm.AddEmployee` còn trong whitelist và DB nhưng không còn endpoint nào kiểm nó (thêm nhân viên vào đơn đã tạo đã bỏ).

**Whitelist theo Chức vụ** (`JobTitlePermissionWhitelist.AllowedCodes`) chỉ gồm nhóm "tham gia quy trình": `OTForm.View/Create/CreateProduction/Approve/RemoveEmployee/AddEmployee`,
`UserSignature.View/Update`, `SecondaryPassword.Update`, `Department/Group/OtCase/Reason/Employee/JobTitle.View`, `ProductionOtReport.View`, `ProductionEmployee.View/Update/Import/Export`,
`EmployeeAccumulation.Import`. **Không bao giờ** thêm permission quản trị (CRUD danh mục, `Setting.Update`, `AiChat.Use`, `*ApprovalStep.Update`, `JobTitlePermission.*`, `OTForm.Delete`) vào đây: người dùng
đổi Chức vụ của chính mình sẽ tự leo thang quyền. Validate ở `JobTitlePermissionService.ReplaceAsync`.

**Ẩn mục theo quyền (FE).** Bảng quyền theo trang `/ot/*` nằm ở `modules/attendance/lib/otRoutePermissions.ts` (có 1 trong các quyền là vào được), dùng chung cho menu (`OtManagerSidebar`) và chặn
vào thẳng URL (`OtAccessGuard`); mỗi tab ở "Danh mục" (`CategoryManagement.tsx`) gate riêng theo quyền quản trị của nó. `/ot/create` nhận cả `OTForm.Create` lẫn `OTForm.CreateProduction`
(Line Leader chỉ có quyền thứ hai). BE luôn enforce lại ở từng API.

**Phạm vi xem nhân sự dưới chuyền.** Có `ProductionEmployee.View` không có nghĩa xem toàn công ty: `ProductionEmployeeService.GetPagedAsync(callerUserName, isAdmin, ...)` lọc theo Phòng ban
(`GetManagedDepartmentIdsAsync`) hoặc Nhóm (`GroupApprovalStepCoordinators`) mà người gọi phụ trách; Admin không bị lọc. Dòng `ProductionEmployee` chưa gắn `Employee` luôn bị ẩn với người xem có phạm vi hẹp.

**Chưa làm:** gán Role/permission cho user thật là việc vận hành (API Identity có sẵn `update-user-roles`/`create-user`).


### §Báo cáo & export dưới chuyền theo ngày

Các báo cáo cho đơn "dưới chuyền" (`IsProductionForm = true`) trong 1 ngày, mẫu theo các file thật trong `docs/Data/Reports/` (`22-08.pdf`/`22-08.xlsx` cho PDF pivot + Excel giờ;
3 file `*_2026-08-1_CV.xlsx` cho 3 Excel của kế toán lương; 3 PDF `*-SAN XUAT TANG CA ... ngay 01-08-2026.pdf` cho phiếu theo Line/Nhóm).
Code: `ProductionOtReportController` + `ProductionOtReportService`, DTO ở `Dtos/Reports/`, công thức giờ dùng chung `MealTicketCalculator`. FE: tab **"Báo cáo"** trong `CategoryManagement.tsx`
(`/ot/categories`) = `modules/attendance/components/reports/ProductionOtReportPanel.tsx`, API `production-ot-report.api.ts`.

**Quy tắc chung (mọi endpoint)**
- Quyền `Attendance.ProductionOtReport.View` (nằm trong `JobTitlePermissionWhitelist`, gán cho Chức vụ nào là cấu hình ở modal Sửa chức vụ — không phải code).
- Chỉ tính dòng `OtFormEmployee` còn hiệu lực (`!IsRemoved`) của đơn `IsProductionForm && !IsDeleted && Status == Completed` (đã qua đủ mọi cấp duyệt) và `Date == date`.
- `departmentId` (`int?`, null = tất cả): đơn dưới chuyền có thể tạo dưới Phòng ban bất kỳ (`CreateProductionFormAsync` nhận `DepartmentId` tự do), nên mọi báo cáo đều lọc được theo Phòng ban.
- Số liệu "chuyền" lấy từ **snapshot trên `OtFormEmployee`** (`CongDoanSnapshot`, `TeamCodeSnapshot`, `BlockCodeSnapshot`, `ShiftTeamCodeSnapshot`), không tra lại `ProductionEmployee`.
- "Line_ca" / "Line_Muon" = `BlockCodeSnapshot + "-" + ShiftTeamCodeSnapshot`; hậu tố G/O/HC là **mã Nhóm màu** (`ProductionShiftTeam`), không phải giờ ca.
- Cột `BP` = `Department.DepartmentCode` thật (ví dụ Chế tạo = `CT`, không phải `SX` của hệ cũ — chủ ý, không map nhãn).
- Người → mã nhân viên: các cột `MNV_*` tra `UserName` → `Employee.Code` (đơn chỉ lưu UserName); không tra được thì để trống.
- Excel trả thẳng file `.xlsx` (ClosedXML, không bọc `ApiResponse`). Tên file Excel: `{TenQuery}_{yyyy-MM-d}_{MaPhongBan}.xlsx` (ngày `d` **không** số 0 đầu: `2026-08-1`; bỏ hậu tố khi không lọc Phòng ban,
  `BuildRealFileNameAsync`); riêng `hours-report-excel` còn dùng `TongGioTangCa_{yyyyMMdd}.xlsx`. PDF phiếu: `{SoNV}-SAN XUAT TANG CA {BLOCK}-{NHOM} ngay {dd-MM-yyyy}.pdf` (ngày **có** số 0 đầu).

**Endpoint** (`GET /api/ProductionOtReport/...?date=yyyy-MM-dd&departmentId=`)

| Route | Trả về | Gộp |
|---|---|---|
| `ticket-report` | JSON `ProductionTicketReportDto` → FE dựng PDF pivot "BÁO PHIẾU TĂNG CA" | theo tổ hợp (Công đoạn, Team, Line-Nhóm, `StartTime`, `EndTime` **chính xác**), nhiều đơn trùng tổ hợp thì cộng dồn |
| `hours-report-excel` | Excel 23 cột "Tổng số giờ tăng ca" | 1 dòng/người/ngày |
| `times-report-excel` | Excel 9 cột "Số lượt tăng ca" (`Qry_So_lan_tang_Ca_trong_ngay_sx`) | **không gộp**: 1 dòng = 1 lượt (`OtFormEmployee`) |
| `qry-export-excel` | Excel 17 cột `Qry_EXPORT_EXCEL` | 1 dòng/người/ngày (`BuildGroupedDailyRowsAsync`) |
| `sum-export-data` | Excel 7 cột `SUM_EXPORT_DATA` | 1 dòng/người/ngày |
| `ticket-batch` | JSON `ProductionTicketBatchGroupDto[]` → FE dựng ZIP phiếu YEV-22-024 | 1 phần tử/tổ hợp Block-Nhóm |

Bốn Excel gộp theo người **độc lập nhau** (không thay thế nhau, cố ý trùng một phần logic gộp để không đụng báo cáo đã chạy ổn).

**`ticket-report`.** Phiếu Chính/Phụ/Sữa đọc **thẳng** `ProcessPart.MainTicketCount/SecondaryTicketCount/MilkCount` của từng đơn (số lưu sẵn, có thể sửa tay), **không** suy lại từ `MealTicketType` từng người.
CA suy từ `StartTime/EndTime` đơn theo khung cố định `H = 6–8h`, `B = 10–14h`, `A = 14–18h`, `C = 18–22h`, khớp khi đơn nằm **trọn** trong khung (về sớm/vào trễ vẫn thuộc CA gốc); không khớp = `"Khac"`.

**`hours-report-excel` (23 cột).** `MNV, BOPHAN(=Công đoạn), HO, TEN, Ngay_TC, Gio_BD(sớm nhất), Gio_KT(muộn nhất), Lydo, LYDO_JP, Lydo_phu(=OtForm.SubReason), An(=Any DidEat), CONGVIEC(=TaskName), OT_Thang, OT_Nam, BLOCK, NHOM,
NOTE, Gio_Hienta, Line_Muon, MNV_LC, MNV_SC, BP, Ngay_lap`. Field cấp đơn mà 1 người có nhiều đơn trong ngày thì nối `"; "` giá trị distinct.
- `Gio_Hienta` = tổng giờ OT thực tính của ngày đó (`CalculateOtHours`, cùng giá trị cộng vào lũy kế).
- `OT_Thang`/`OT_Nam` = sổ lũy kế (`EmployeeAccumulationHistory`) theo **năm/tháng của `date` báo cáo** (không phải hôm nay): tháng = `Month == date.Month`, năm = `Month <= date.Month` (gồm `Month = 0`).
- `MNV_LC` = mã người **lập** đơn (`OtForm.CreatedByUserName`); `MNV_SC` = mã người **sửa gần nhất** đúng dòng nhân viên đó trong đúng đơn đó (`OtFormEditLog`, `ActionAt` mới nhất).
- `Ngay_lap` = `OtForm.CreatedAt` sớm nhất, định dạng `dd-MMM-yy` bằng `InvariantCulture` (tháng tiếng Anh không phụ thuộc locale server).

**`times-report-excel` (9 cột).** `MNV, BLOCK, NHOM, NOTE, Ngay_TC, LAN_TANG_CA_TRONG_NGAY, Gio_Hientai, BP, MNV_TP`. `BLOCK/NHOM/NOTE/BP` là của đúng lượt đó; `LAN_TANG_CA_TRONG_NGAY` (số đơn phân biệt
của người đó trong ngày) và `Gio_Hientai` (tổng giờ cả ngày) là tổng hợp cả ngày, lặp trên mọi dòng của người đó. `MNV_TP` = mã Trưởng phòng đã **duyệt** đơn đó (`OtFormApprovalHistory` Approved ở bước
`TerminalLevelSnapshot == DepartmentManager`).

**`qry-export-excel` (17 cột).** `MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_BD, Gio_KT, Lydo, Lydo_phu, An, BLOCK, NHOM, NOTE, Gio_Thuc_Te, BP, QUAN_LY_TC_SX, MNV_TP`. `QUAN_LY_TC_SX` = mã người đã duyệt ở bước Chức vụ
`JobTitleCodeSnapshot == "TL"` (Team Leader); `MNV_TP` như trên (`ResolveApprovalCodesByJobTitleCodeAsync` / `ResolveApprovalCodesByTerminalLevelAsync`). **`sum-export-data` (7 cột):**
`MNV, BOPHAN, HO, TEN, Ngay_TC, Gio_thuc_te, BP` — bản tóm tắt cho mục đích riêng, không phải rút gọn của `Qry_EXPORT_EXCEL`.

**PDF pivot (`buildTicketReportPdf` + `buildPivotRows` trong `ProductionOtReportPanel.tsx`).** Vẽ bằng jsPDF/jspdf-autotable, **A4 dọc**, khớp `22-08.pdf`: khung viền + tiêu đề `BÁO PHIẾU TĂNG CA NGÀY: …`,
bảng tổng hợp nhóm theo CA (thứ tự cố định A→B→C→H) rồi CA_Dãy có dòng tổng mỗi CA, "TỔNG" nằm ngoài khung, bảng chi tiết bên dưới, chân trang ngày giờ in + "Page X of Y". Dòng CA_Dãy hiện `StartTime`
của dòng chi tiết đầu tiên trong nhóm (xấp xỉ khi 1 CA_Dãy có nhiều Line lệch giờ; xem đủ giờ ở bảng chi tiết). Dữ liệu gộp hoàn toàn từ `report.rows`, BE không trả thêm.

**ZIP phiếu YEV-22-024 theo Line/Nhóm (`buildProductionTicketZip` ở `modules/attendance/lib/productionTicketBatchPdf.tsx`).**
- BE `ticket-batch` chỉ trả phần nền: danh sách nhân viên đã gộp + `PrimaryOtFormId` (đơn nhỏ nhất của nhóm). FE lấy phần chữ ký/lý do/`ProcessPart` qua `GET /api/OtForm/{PrimaryOtFormId}` rồi ghi đè
  `employees`/`numberOfEmployee` bằng dữ liệu gộp; mỗi tổ hợp 1 PDF khổ Letter 612×792pt, gộp thành `Phieu_TangCa_{dd-MM-yyyy}.zip` (`jszip`), xử lý tuần tự và hiện tiến độ "Đang xuất X/Y".
- **Phải tự vẽ thẳng bằng jsPDF**, không `html2canvas` (AGENTS.md §4.8): `addImage` cho ảnh nền (`/ot-form/a4-page1.png`, `a4-page2.png`), `text()` cho chữ, `line()` vẽ dấu ✓ (font Roboto nhúng không chắc có glyph).
  Toạ độ % và logic hiển thị **tái dùng từ `OtFormPrintView.tsx`** (đã export `HEADER_LAYOUTS`, `A4_PAGE1_EMPLOYEE`, `A4_PAGE2_EMPLOYEE`, `buildEmployeePages`, `formatDate…`, `findHistory`,
  `getProductionCongDoanLabel`…) — đừng chép lại logic. Font tiếng Việt: Roboto nhúng qua VFS (`registerVietnameseFont`, `modules/pc-management/lib/pdf-fonts.ts`; mỗi nơi tự giữ bản nhỏ).
  Đo chữ bằng `doc.getTextWidth`/`splitTextToSize` (cùng engine đo và vẽ); ảnh chữ ký lấy `naturalWidth/naturalHeight` thật rồi mới `addImage`.
- **Dữ liệu phải là snapshot đóng băng**, như `OtFormService.GetOtFormByIdAsync`: projection của `GetTicketBatchAsync` gồm `StartTime`, `MonthToDate`, `YearToDate` và 5 field snapshot
  (thiếu thì ô "Tên công đoạn" trống); lũy kế đọc cột `OtFormEmployee.MonthToDate/YearToDate`, **không** tính lại từ sổ (sổ là số sống ≠ số đã ký trên giấy); thứ tự nhân viên theo `EmployeeId`,
  không sắp lại theo mã.
- `OtFormPrintView.tsx` (in 1 đơn qua `window.print()`) vẫn dùng `AutoFitLine`/`useAutoFitLineWidth`/`ReasonAutoFit` để co chữ cho vừa ô; đó là đường in riêng, không liên quan ZIP.

**Gate UI.** `CategoryManagement.tsx` tự lọc tab theo permission: người chỉ có `ProductionOtReport.View` (ví dụ Group Leader được gán qua Chức vụ) vào "Danh mục" chỉ thấy tab "Báo cáo"; `OtManagerSidebar` mục
"Danh mục" có `ProductionOtReport.View` trong danh sách OR-permission (`otRoutePermissions.ts`). Route `/ot/accumulation` (`AccumulationLookupPage`) còn tồn tại nhưng không có link ở sidebar.

### §Phân quyền Coordinator (Bộ phận / Nhóm) — trạng thái chốt

> Gộp từ 3 mục rời (2026-08-29, và 2 mục 2026-09-28 trong đó 1 mục **đảo ngược** quyết định cũ) — đọc
> riêng lẻ sẽ ra kết luận trái ngược nhau. Đây là trạng thái đang chạy.

**Khái niệm:** "Coordinator" = người được Admin **gán tay** qua màn "Cây duyệt"
(`DepartmentApprovalStepCoordinator` / `GroupApprovalStepCoordinator`) để tự quản nhân sự trong đúng
phạm vi mình phụ trách, **không cần Admin**. Cố ý **không** suy luận theo Chức vụ và **không** dùng
`JobTitlePermissionWhitelist` (whitelist đó cố tình loại trừ permission "quản trị" để không ai tự leo
thang quyền bằng cách đổi Chức vụ của mình).

**Quyền tự cấp** — qua `EmployeeService.SyncAutoGrantedPermissionsCoreAsync`
(xem `ApprovalStepCoordinatorPermissions`), **hiệu lực ngay, không cần đăng nhập lại**:

| Permission | Dept Coordinator | Group Coordinator |
|---|---|---|
| `DepartmentApprovalStep.Update` · `ProductionApprovalStep.Update` | ✔ | – |
| `Employee.UpdateOtLimit` · `EmployeeAccumulation.Update` · `EmployeeAccumulation.Import` | ✔ | ✔ |
| `Employee.Create` / `.Update` / `.Delete` (hồ sơ đầy đủ) | ✔ | ✔ |
| `ProductionEmployee.View` / `.Update` / `.Import` / `.Export` | ✔ | ✖ **không cấp** |

`ProductionEmployee` là khái niệm **cấp Phòng ban** (gắn Line/Team/Nhóm ca của cả 1 phòng sản xuất,
thường "Chế Tạo") nên không tách theo Nhóm con — nhánh `if (isDeptCoordinator)`.
`Employee.Create/Update/Delete` **đảo ngược** quyết định 2026-08-29 ("quá rộng, chỉ Admin"): nay cấp cho
cả 2 vai trò nhưng **khoá cứng theo scope** thay vì mở hoàn toàn.

**Đổi rule auto-grant thì phải chạy lại** `POST /api/Employee/resync-coordinator-permissions` — nếu không,
Coordinator đã gán từ trước sẽ thiếu quyền mới cho tới khi có ai gán/gỡ lại họ.

**3 guard thực thi phạm vi** — dùng lại, đừng viết guard mới:
- `IDepartmentAccessGuard` (`DepartmentAccessGuardService`): `EnsureCanManageDepartmentAsync(userName,
  isAdmin, departmentId)` (Admin bỏ qua) + `GetManagedDepartmentIdsAsync(userName)` khi cần scope theo
  từng dòng dữ liệu tự do.
- `EmployeeService.EnsureCanManageDeptOrGroupScopeAsync` — phạm vi **hiện tại** của nhân viên đang
  sửa/xoá; gọi NGAY ĐẦU hàm `UpdateAsync`/`DeleteAsync`.
- `EmployeeService.EnsureAssignmentInCallerScopeAsync` — phạm vi **sắp gán tới**, chạy sau khi
  `ValidateOrganizationAssignmentAsync` resolve `(groupId, departmentId)`. `UpdateAsync` phải gọi **cả
  hai** để chặn "chuyển" nhân viên từ Nhóm mình quản sang Nhóm ngoài phạm vi. Chức vụ Trưởng Xưởng/Giám
  đốc (`groupId` và `departmentId` đều null) LUÔN ngoài phạm vi mọi Coordinator — chỉ Admin gán được.

**Luật scope theo từng dòng (import Excel):** `ImportOtHourLimitsAsync` /
`ImportMonthlyAccumulationAsync` / `ApplyAccumulationAsync` resolve Phòng ban/Nhóm thật của từng
`EmployeeCode` (`employee.DepartmentId ?? employee.Group.DepartmentId`, projection `int?` an toàn —
**không** viết `x.Group!.DepartmentId`, vỡ khi Group null) rồi **skip dòng ngoài phạm vi** với lý do
"Nhân viên không thuộc Phòng ban/Nhóm bạn phụ trách" — **không throw huỷ cả file**.
`ProductionEmployeeImportService.Preview/Confirm` thì hardcode Phòng ban "CT"
(`ManufacturingDepartmentCode`) nên check 1 lần cho cả file.
`ProductionEmployeeService.GetPagedAsync`/`UpdateAsync` và `ProductionEmployeeExportService.ExportAsync`
đều lọc/chặn theo **chỉ Bộ phận** phụ trách (Export lọc ngay ở query, không xuất được sheet phòng khác).

**`Employee.UpdateOtLimit` tách riêng khỏi `Employee.Update`** vì `Update` còn cho sửa Code/Tên/Group của
mọi nhân viên. Endpoint `PUT /api/Employee/{id}/ot-limit` CHỈ set `CustomMonthlyOtHourLimit`/
`CustomYearlyOtHourLimit`; `UpdateEmployeeDto` + `UpdateAsync` (PUT chung) **cố ý không đụng 2 field này**
để Admin sửa thông tin cơ bản không wipe chúng về null (đã verify sống).

**FE:** `EmployeeForm.tsx` nhận prop `scope?: EmployeeScopeDto | null` (nguồn `GetMyScopeAsync`, cùng
nguồn với dropdown lọc) → dropdown Bộ phận/Nhóm trong form Tạo/Sửa chỉ hiện đúng phạm vi, không gọi lại
`getAllGroups`/`getAllDepartments`. 2 field giới hạn OT chỉ còn ở form Tạo mới; sửa sau đi qua
`EmployeeOtLimitDialog.tsx`. Mọi nút/tab (`EmployeeList.tsx`, `ProductionEmployeeList.tsx`,
`otRoutePermissions.ts`, `CategoryManagement.tsx`, `OtManagerSidebar.tsx`) đã gate **theo từng permission
code** từ trước → Coordinator chỉ phụ trách Nhóm tự động không thấy phần "Nhân sự dưới chuyền", **không
cần sửa UI khi đổi rule auto-grant**. Kiểm tra kỹ chỗ này trước khi định thêm điều kiện mới.

**Vẫn Admin-only:** gán Chức vụ **Trưởng Xưởng/Giám đốc** (2 cấp dùng chung toàn công ty), import liên kết Identity (`Identity.User.BulkImport`), và mọi Danh mục khác (Department/Group/JobTitle/Reason/OtCase/AttendanceSetting). Gán Chức vụ **trong đúng đơn vị mình phụ trách** thì Người phụ trách tự làm được (`AssignDepartmentJobTitle`/`AssignGroupJobTitle`, xem §Cây chức vụ & Cây duyệt).

**Chưa test sống đường non-Admin:** `windows-login` chỉ lấy được JWT của chính user hiện tại nên không
giả lập được tài khoản Coordinator thật — chỉ verify Admin vẫn chạy đúng qua mọi endpoint đã sửa. Test
tay qua UI bằng 1 tài khoản Coordinator thật trước khi coi là ổn định. Không hồi tố: chỉ ảnh hưởng thao
tác sau khi đổi.

### §Phạm vi xem nhân viên

`Attendance.Employee.View` được cấp **toàn công ty** qua Chức vụ (có trong `JobTitlePermissionWhitelist`) nên không tự giới hạn gì; `EmployeeDto` lại mang lũy kế thật và mốc OT riêng (dữ liệu nhạy cảm).
Vì vậy mọi endpoint liệt kê nhân viên tự do đều phải tự áp phạm vi của người gọi:

- **`ResolveCallerScopeAsync` + `ApplyScope`** (`EmployeeService`) cho ra `EmployeeScope { CompanyWide, DepartmentIds, GroupIds }`: Admin và Chức vụ Trưởng Xưởng/Giám đốc = toàn công ty; còn lại = **hợp** vị trí thật
  (`Employee.DepartmentId` của Trưởng phòng, `Employee.GroupId` của cấp Nhóm) với mọi Bộ phận/Nhóm đang được gán làm **Người phụ trách** (`GetManagedDepartmentIdsAsync` + `GroupApprovalStepCoordinators`).
  Hợp nhất để quyền sửa tự cấp cho Người phụ trách (§Phân quyền Coordinator) luôn có người để sửa trên màn "Nhân viên". Không có vị trí lẫn phụ trách nào thì ném "Tài khoản của bạn chưa được gán Nhóm/Bộ phận nào".
- **Áp scope ở**: `GetPagedAsync` (`GET grid-list`), `GetAllActiveAsync` (`GET all`), `GetInScopeAsync` (`GET in-my-scope`, quyền `OTForm.Approve`). Filter `departmentId`/`groupId` tuỳ chọn chỉ **thu hẹp thêm** trong phạm vi.
- **Không áp scope ở** `GetByGroupIdAsync`/`GetByDepartmentIdAsync` (route đã chốt phạm vi: màn lập đơn, màn Cây duyệt) và `GetByIdAsync`/`GetByUserNameAsync` (tra 1 người).
  Lớp an toàn tương ứng của `OTForm.Approve` là danh sách candidate của bước duyệt (`LoadFormAndCurrentStepAsync`), nên quyền đó không cần scope riêng.
- **`GET /api/Employee/my-scope`** (`Attendance.Employee.View`, `GetMyScopeAsync`) chỉ phục vụ UX, không phải lớp chặn: trả `EmployeeScopeDto { CompanyWide, Departments[], Groups[] }` (Groups = Nhóm con của mọi Phòng ban
  trong phạm vi **hợp** Nhóm đang phụ trách trực tiếp). `EmployeeList.tsx` gọi 1 lần lúc mount: `companyWide` thì dropdown đầy đủ; ngược lại đổ dropdown Phòng ban/Nhóm thẳng từ `scope.departments`/`scope.groups`
  (không gọi thêm API; chọn Phòng ban chỉ lọc `scope.groups` phía client; chỉ có Nhóm thì ẩn dropdown Phòng ban).
- **Chưa test sống đường non-Admin**: `windows-login` chỉ lấy được JWT của user hiện tại (Admin); phải bấm thử màn "Nhân viên" bằng 1 tài khoản Nhóm/Trưởng phòng thật.

### §Import lũy kế OT theo tháng — mọi Phòng ban

Nạp số giờ OT đã có (từ file lương/chấm công) vào sổ lũy kế (`EmployeeAccumulationHistory`, xem §Lũy kế & giới hạn giờ OT). Dùng **format riêng của hệ thống**, không phải 9 cột tách loại giờ của
file gốc (sổ chỉ lưu tổng giờ/tháng).

- **Endpoint**: `POST /api/EmployeeImport/monthly-accumulation?year=&month=` (multipart, field `file`; 1 bước, áp dụng luôn, không có Preview) và
  `GET .../monthly-accumulation/template`. Quyền `Attendance.EmployeeAccumulation.Import`, **tự cấp cho Người phụ trách của bất kỳ Bộ phận nào** (không hardcode "Chế tạo").
  Logic ở `EmployeeImportService.ImportMonthlyAccumulationAsync(stream, year, month, userName, isAdmin)`; kết quả `ProductionEmployeeAccumulationResultDto`
  (`AdjustedCount/UnchangedCount/SkippedCount/SkippedRows/TotalDeltaHours` + `AdjustedYearCount/TotalDeltaYearHours` cho cột D).
- **File**: cột A bỏ trống, B = MNV, C = tổng giờ OT của tháng, D (tuỳ chọn) = tổng giờ OT cả năm. `year`/`month` là query param, không đọc từ file.
- **Cộng chênh lệch, không ghi đè**: unique `(EmployeeId, Year, Month)` nên mỗi dòng ghi `delta = C − lũy kế tháng đang có`; chạy lại cùng file ra delta 0.
  Cùng logic với `ProductionEmployeeImportService.ApplyAccumulationAsync` (cố ý lặp ~15 dòng, 2 service khác lớp cha).
- **Cột D** (bỏ trống = không đụng lũy kế năm): `deltaYear = D − tổng lũy kế năm hiện có` (đã gồm điều chỉnh cột C vừa áp cùng lượt, hai bước dùng chung 1 danh sách sổ nạp 1 lần), cộng
  vào dòng **`Month = 0`** (số dư đầu kỳ), không đụng 12 tháng thật. Khác cột "OT year" của import nhân sự dưới chuyền (cột đó chỉ tham khảo, không ghi).
- **Phạm vi**: Admin ghi mọi người; Người phụ trách chỉ ghi nhân viên thuộc Bộ phận (`IDepartmentAccessGuard.GetManagedDepartmentIdsAsync`) hoặc Nhóm (`GroupApprovalStepCoordinator`)
  mình phụ trách, kiểm theo từng dòng; dòng ngoài phạm vi hoặc không tìm thấy mã vào `SkippedRows`.
- **FE**: `EmployeeMonthlyAccumulationImportDialog.tsx`, mở từ menu Excel của `EmployeeList`/`ProductionEmployeeList`, hiện nút theo `hasPermission(user, "Attendance.EmployeeAccumulation.Import")`.
- **Quy ước đọc Excel (ClosedXML)**: mọi parser của module phải đọc ô bằng `worksheet.Cell(row.RowNumber(), n)` (tuyệt đối theo worksheet), **không** dùng `row.Cell(n)` (tương đối theo `RangeUsed()`).
  Lý do: khi cột A trống hoàn toàn (đúng quy ước file mẫu của module), ClosedXML thu hẹp range bắt đầu từ cột B và `Cell(2)` trỏ nhầm sang cột C. Áp dụng ở
  `EmployeeImportService` (import nhân viên, giới hạn OT, lũy kế tháng) và `EmployeeIdentityLinkImportService`; `ProductionEmployeeImportService.ParseXlsx` không trúng vì cột A (KHOI SU) luôn có dữ liệu.

### §Import Excel liên kết Identity ↔ Attendance + tự tạo tài khoản + gán chữ ký

Admin import Excel hàng loạt để (a) liên kết `Employee.UserName` với tài khoản đăng nhập, (b) **tự tạo tài khoản Identity nếu UserName chưa tồn tại**, (c) gán chữ ký, (d) gán Chức vụ, (e) thêm làm Người phụ trách Cây duyệt.
Sau import người đó dùng được hệ thống ngay (quyền theo Chức vụ có hiệu lực tức thì).

- **Endpoint**: `EmployeeIdentityLinkImportController` — `POST preview`, `POST confirm`, `GET template`, quyền **`Identity.User.BulkImport`** (migration `AddIdentityUserBulkImportPermission`; chỉ Role `Admin`, **không** cấp tự động
  qua Chức vụ/Người phụ trách vì là hành động nhạy cảm nhất hệ thống). FE: `EmployeeIdentityLinkImportDialog.tsx`, nút cạnh "Import Excel" trong `EmployeeList.tsx`, gate `hasPermission(user, "Identity.User.BulkImport")`.
- **Format file**: cột A trống; B = MNV; C = UserName (không kèm domain); D = RoleName (trống = `Basic`, khớp JIT-provision ở `MyClaimsTransformation`); E = MaChucVu (`JobTitle.Code`, trống = không đổi Chức vụ);
  F = NguoiPhuTrach (`"1"` = có, quy ước giống cột `LEADER` của import dưới chuyền). Ảnh chữ ký **nhúng trong Excel**, neo theo hàng của nhân viên (`IXLPicture.TopLeftCell.Address.RowNumber` map ảnh ↔ dòng).
- **Cả Preview lẫn Confirm đều nhận lại NGUYÊN file** (không round-trip rows qua JSON vì có ảnh nhị phân); Confirm đọc và validate lại từ đầu, không tin gì từ Preview. Mỗi dòng độc lập, lỗi 1 dòng không huỷ file.
- **Cross-module** (Identity ở `YevIdentityManagement`, Employee/UserSignature ở `YevOTManagement`, không có transaction chung): `IUserDirectoryService.EnsureUserExistsAsync(userName, fullName, roleName)` (idempotent: UserName đã có thì no-op và **giữ nguyên Role**;
  impl ở `Identity.Application/Services/UserDirectoryService.cs`) và `IUserSignatureService.AdminSetSignatureAsync(userName, signatureImage)` (set thẳng, **bỏ qua** luồng email-confirm tự phục vụ — đánh đổi bảo mật có chủ đích, chỉ Admin qua đúng luồng import này).
- **Thứ tự ghi mỗi dòng** (`EmployeeIdentityLinkImportService`): `EnsureUserExistsAsync` (Identity) **trước** — lỗi (ví dụ RoleName không tồn tại) thì không ghi gì xuống Attendance cho dòng đó → set `Employee.UserName` (thu hồi quyền tự động của UserName cũ
  nếu đổi, như `EmployeeService.UpdateAsync`) → Chức vụ → Người phụ trách → `SyncAutoGrantedPermissionsForEmployeeAsync` → `AdminSetSignatureAsync` nếu dòng có ảnh.
- **Phạm vi Chức vụ/Người phụ trách luôn suy từ tổ chức hiện tại của Employee** (file không đổi Bộ phận/Nhóm của ai): có `DepartmentId` (Trưởng phòng) → khối Bộ phận; có `GroupId` → khối Nhóm; không có cả hai → lỗi dòng.
  **Chức vụ** tái dùng `EmployeeService.AssignDepartmentJobTitleAsync`/`AssignGroupJobTitleAsync` (gọi `isAdmin: true`, đã validate `TerminalLevel`). **Người phụ trách** là khái niệm khác Chức vụ
  (`DepartmentApprovalStepCoordinator`/`GroupApprovalStepCoordinator`); vì `ReplaceAsync` thay nguyên danh sách nên import dùng `EnsureCoordinatorAsync(scopeId, employeeId)` ở cả 2 service — chỉ **thêm nếu chưa có** (idempotent),
  validate nhân viên thuộc đúng phạm vi, rồi sync quyền tự động.
- Preview trả thêm `resolvedJobTitleName`, `coordinatorScopeDescription`, `rowsWithJobTitleCount`, `rowsWithCoordinatorCount`; Confirm trả `jobTitleAssignedCount`, `coordinatorAddedCount`. Đọc ô theo quy ước ClosedXML ở §Import lũy kế OT theo tháng.
- **Chưa test sống Confirm** (hành động ghi: tạo tài khoản đăng nhập, đổi chữ ký): thử bằng 1 UserName test, kiểm (1) gán Chức vụ Trưởng phòng cho người đang ở Nhóm bị từ chối, (2) import lại cùng người với `NguoiPhuTrach = 1` không tạo trùng dòng coordinator.

### §Danh sách đơn — 5 endpoint, filter chung, lịch chờ duyệt, "Tất cả đơn"

`OtFormListPage.tsx` (nhận `mode`) dùng chung 1 khung cho 5 tab; `OtFormTabsPage.tsx` ghép tab theo quyền:

| Tab / `mode` | Endpoint | Quyền | Phạm vi dữ liệu |
|---|---|---|---|
| Đơn của tôi | `GET my-forms` | `OTForm.View` | đơn mình tạo |
| Chờ tôi duyệt | `GET pending-approvals` (+ `/count`, `/dates`) | `OTForm.Approve` | đơn mà mình là candidate của bước `Pending` nhỏ nhất (`GetMyCurrentPendingFormIdsAsync`) |
| Tôi đã xử lý | `GET my-actions` | `OTForm.View` | đơn mình đã duyệt/từ chối |
| Tôi có tên trong đơn | `GET my-participations` | `OTForm.View` | đơn có mình trong danh sách tăng ca |
| Tất cả đơn | `GET all-forms` (`GetAllFormsAsync`) | `OTForm.ViewAll` (chỉ Admin; **không** nằm trong `JobTitlePermissionWhitelist` vì là quyền xem toàn cục) | không lọc theo người gọi |

- **Filter chung cho cả 5 endpoint**: `fromDate/toDate/status` (`ApplyListFilters`), `groupId/departmentId` (`ApplyOfficeFilter`: so `OtForm.GroupId/DepartmentId`; đơn theo chuyền chỉ có `DepartmentId`),
  `productionLineId/productionTeamId/productionShiftTeamId` (`ApplyProductionFilterAsync`: đổi Id → `Code` rồi lọc `OtFormEmployees.Any(e => !e.IsRemoved && e.BlockCodeSnapshot == lineCode)`, tương tự Team/ShiftTeam —
  so trực tiếp **snapshot** trên `OtFormEmployee`, không join `ProductionEmployee`). FE gửi qua `GetOtFormListParams`/`appendOtFormListParams` (`ot-form.api.ts`, PascalCase `GroupId`/`DepartmentId`…).
- **`OtFormListItemDto.ProductionLineNames`/`ProductionShiftTeamNames`** (distinct `BlockCodeSnapshot`/`ShiftTeamCodeSnapshot` nối `", "`) điền bởi `EnrichWithProductionLineInfoAsync`, một query riêng **sau khi phân trang**
  (không nhét `Distinct`/`Join` vào `ToListItemDto` vì expression đó dùng chung, dễ không dịch được sang SQL). Cả 5 endpoint đều gọi. FE hiện cột "Line/Nhóm ca" (`—` khi không phải đơn theo chuyền).
- **Lịch chờ duyệt**: `GET pending-approvals/dates?fromDate&toDate` (`GetPendingApprovalDatesAsync`, cùng phạm vi `GetMyCurrentPendingFormIdsAsync`) → `PendingApprovalDateCountDto { Date, Count }`. FE vẽ lịch mini
  (nút tháng trước/sau) với badge số đơn mỗi ngày; bấm 1 ngày đặt `fromDate = toDate` rồi tìm lại.
- **FE bố cục filter**: dropdown Bộ phận → Nhóm (cascade: `DepartmentApi.getAllDepartments()` + `GroupApi.getGroupsByDepartment`) và Team → Line → Nhóm ca hiện ở **mọi tab**.
- **Duyệt/Từ chối hàng loạt** (modal chung Comment + `SecondaryPassword`, API `bulkApprove`/`bulkReject`): có khối xem lại ngay trong modal, liệt kê các đơn đã chọn (lấy từ danh sách đang có, không gọi thêm API), mỗi dòng có link
  "Sửa" mở `/ot/forms/edit?id=` ở **tab mới** (`target="_blank"`, `getPathname` để giữ locale) rồi quay lại tab gốc xác nhận (luật sửa đơn: §Cây chức vụ & Cây duyệt).

### §Chuẩn giao diện chung của màn OT

- **Màn Cây duyệt** (`components/job-titles/`): `StepCard.tsx` (thẻ 1 bước: drag handle, số thứ tự, Chức vụ, pill "Cần ký", pill "Chịu trách nhiệm"), `StepHolders.tsx` (chip-list "đang giữ" + combobox thêm),
  `CoordinatorsBox.tsx` (khối "Người phụ trách", dùng chung Nhóm + Bộ phận vì 2 DTO cùng shape `{employeeId, employeeCode, fullName, userName}`). Phần "đang giữ chức vụ" truyền qua prop `footer: React.ReactNode` — 3 khối
  (Nhóm/Bộ phận/Chuyền) khác nhau quá nhiều, đừng nhét vào `StepCard`. Đánh số bước **liên tục** (khối Bộ phận bắt đầu từ `groupSteps.length + 1`: Nhóm → Bộ phận là 1 chuỗi). Đổi Bộ phận/Nhóm khi state dirty
  (`isDeptDirty`/`isGroupDirty`/`isProductionDirty`) phải hỏi `ConfirmDialog`; đổi **tab** thì không.
- **`SearchableSelect` thay mọi `<select>`** (DESIGN_SYSTEM §4.3). **`MealTicketTypeBadge`** chỉ có 1 bản `ot-form/MealTicketTypeBadge.tsx` (props `{type, t}`) — đừng tạo bản cục bộ. Màu "warning"
  (`bg-[#fff4e5]`/`border-[#f5d0a9]`/`text-[#9a5b00]`) đã ghi ở DESIGN_SYSTEM §1.3.
- **Khung cuộn modal (5 dialog Import)**: `flex max-h-[85vh] flex-col`, header đứng yên, **đúng 1** vùng `flex-1 overflow-auto`; chiều rộng theo nội dung (`max-w-2xl` bảng 2–4 cột, `max-w-6xl` bảng nhiều cột).
- **Nút xuất Excel ở màn Báo cáo** không lộ tên query hệ cũ ra UI ("Chi tiết theo người/ngày", "Tóm tắt theo ngày"); tên kỹ thuật (`Qry_EXPORT_EXCEL`, `SUM_EXPORT_DATA`) để ở `title` tooltip.

## 2. Wiring Host — đã xong
1. `Configurations/DependencyInjection.cs`: `AddDbContext<AttendanceDbContext>` với `OTManagementConnection`.
2. `Program.cs`: `AddControllers().AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)`.
3. `Attendance.Api.csproj`: thêm `ProjectReference` tới `Attendance.Application` (cần cho DTO/Interface Service).
4. Scrutor tự động đăng ký toàn bộ `*Repository`/`*UnitOfWork`/`*Service` trong assembly `Attendance.*` (không cần khai báo `AddScoped` thủ công).

## 3. Còn nợ / cố ý chưa làm

**Cố ý chưa làm — chờ yêu cầu, đừng tự triển khai:**
- **Cột `KHOI SU`** trong file mẫu Chế Tạo: export để trống, import bỏ qua (xem §Import nhân sự
  dưới chuyền).
- **Báo cáo thứ 4 trở đi** (mục 9 trong danh sách báo cáo gốc).
- **Làm đẹp giao diện đợt 2** cho phần CRUD danh mục/phạm vi duyệt/chữ ký/mật khẩu cấp 2.

**Đã làm xong rồi, ĐỪNG làm lại** (từng nằm trong danh sách còn nợ): import hàng loạt giới hạn OT riêng
theo từng nhân viên (`POST /api/EmployeeImport/ot-hour-limits`), và nạp lũy kế năm qua cột D của file
import lũy kế tháng.

**Việc vận hành khi dựng server production:** import cert self-signed của `VNMAIL04` vào
`Cert:\LocalMachine\Root` trên chính server đó (hoặc nhờ IT đẩy qua GPO domain `yev.vn`) — nếu không,
SMTP sẽ fail TLS. SMTP đã verify gửi được từ máy dev.

**Chưa xong, chặn bởi hạ tầng:** AI Chat lập đơn tăng ca treo ~5 phút rồi lỗi vì LM Studio không xử lý
được request kèm `tools` — xem `asset-module.md §1.18` (blocker dùng chung cho cả 2 AI Chat).