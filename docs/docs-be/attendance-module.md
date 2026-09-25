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

> ⚠ **File ~375 KB. KHÔNG `Read` cả file** — đọc trọn nó đốt sạch context của phiên (CLAUDE.md §2 luật 7).
> Cách dùng: tra bảng dưới → `Read` với `offset`/`limit` đúng dải dòng (dư ±20 dòng là đủ).
> Số dòng có thể lệch sau khi ai đó sửa file → `Grep` pattern `^#{2,4} ` trên chính file này để lấy lại
> mục lục kèm số dòng. Cần 1 tên field/endpoint cụ thể thì `Grep` thẳng chuỗi đó, đừng đọc tuần tự.

| Cần biết gì | Dải dòng | Mục |
|---|---|---|
| Entity + business logic gốc của OT Form | 47–171 | §Entity, §Business Logic, §Sửa đơn Draft/Pending |
| **Lũy kế** (ledger, snapshot đóng băng, lũy kế dự kiến) | 172–201, 581–651 | 4 mục §Lũy kế… |
| **Phiếu ăn** (ngưỡng giờ, 3 bậc, trừ 30 phút, đồng bộ khi sửa đơn) | 202–402 | 5 mục §Phiếu ăn / §Có ăn hay không |
| **Giới hạn giờ OT** (chặn cứng ngày/tháng/năm + gia hạn riêng từng NV) | 403–472 | 2 mục §Giới hạn |
| **Nhân sự dưới chuyền** (`ProductionEmployee`, import/export file Chế Tạo) | 473–580 | §Import/Export nhân sự dưới chuyền |
| Song ngữ Vn/Jp trên DTO | 652–662 | §Song ngữ Vn/Jp |
| **Đơn tổng** (`OtFormBatch`) | 663–763 | §Đơn tổng |
| **Email**: mail tổng hợp hằng ngày, token xác thực, font/dark-mode | 764–852, 3316–3342 | 3 mục §…email |
| Mật khẩu cấp 2 | 853–890 | §Mật khẩu cấp 2 |
| Loại nhân viên khỏi đơn (in-app đã xoá, còn kênh email) | 891–993 | 2 mục §Loại nhân viên |
| Luật giao diện + ghép chuỗi song ngữ | 994–1020, 3260–3288 | 2 mục §…giao diện |
| **Cây chức vụ / Cây duyệt / đơn "theo chuyền"** — Giai đoạn 1→16 | 1021–2316 | §Cây chức vụ + 16 mục con |
| Migration & DB | 2317–2321 | §DB |
| **Danh sách controller/endpoint đã có** | 2322–2461 | §1. Cấu trúc code đã có |
| **Báo cáo & export Excel/PDF** (4 báo cáo + phiếu PDF hàng loạt) | 2462–2779 | 5 mục §Báo cáo/§Excel/§PDF |
| **Phân quyền** theo Chức vụ / Phòng ban / Coordinator | 2780–2950 | §Gộp tab Quyền…, §Phân quyền theo Phòng ban, §Vá lỗ hổng Employee.View |
| **Import Excel** (lũy kế tháng, liên kết Identity, bẫy ClosedXML) | 2951–3119 | 4 mục §Import… |
| Sửa đơn / duyệt hàng loạt / filter danh sách | 3120–3242 | 3 mục §… |
| Bug đã sửa (Coordinator Chuyền, Team A/B) | 3243–3259, 3289–3315 | 2 mục §Fix bug |
| Wiring Host + **việc còn nợ / cố ý chưa làm** | 3343–hết | §2, §3 |

**Quy ước viết tiếp file này** (CLAUDE.md §2 luật 8): sửa thẳng vào mục đang mô tả phần đó, **không**
nối thêm mục `§… (ngày)` cho mỗi lần chỉnh. Quyết định cũ bị thay thế → gộp/xoá mục cũ, giữ 1 dòng
"trước làm X, bỏ vì Y" nếu lý do còn giá trị. Vài mục dưới đây đã được gộp lại theo đúng cách này.

## 0. Chốt yêu cầu (CLAUDE.md §2 luật 2)

### §Entity (`Attendance.Domain/Entities/`)

Danh mục (master data, đều có `IsDeleted`):
| Entity | Thuộc tính chính | Song ngữ (Vn/Jp)? |
|---|---|---|
| `Department` | `DepartmentCode`(unique), `DepartmentNameVn`, `DepartmentNameJp?` | Có — **entity mới** (ERD gốc không vẽ bảng Department dù OT FORM có `DepartmentId`). Tạo riêng cho Attendance, KHÔNG dùng `Asset.DeviceDepartment` (khác DB, khác ngữ cảnh nghiệp vụ). |
| `Group` | `GroupCode`(unique), `GroupNameVn`, `GroupNameJp?`, `DepartmentId`(FK, **1 Department - N Group**, theo pattern `Asset.Domain.Entities.DeviceGroup.DepartmentId`) | Có |
| `Reason` | `ReasonNameVn`, `ReasonNameJp?` | Có |
| `OtCase` | `Code`(unique), `Description?`, `RequireSignature:bool`, `RequiredApprovalLevel:int` (2026-08-07: đọc như enum **`JobTitleTerminalLevel`** — `DepartmentManager/WorkshopManager/GeneralDirector` — thay vì `ApprovalLevel` cũ, xem §Cây chức vụ Giai đoạn 3.1; giá trị int 1/2/3 trùng nhau giữa 2 enum nên KHÔNG cần migration đổi kiểu cột) | Không |
| `Employee` | `Code`(unique), `FirstName`, `LastName`, `UserName:string?`(unique filtered — tài khoản AD của chính nhân viên, nullable), `GroupId:int?`(FK, **nullable từ 2026-08-08**), `DepartmentId:int?`(FK, **mới 2026-08-08**), `JobTitleId:int?`(FK, nullable — xem §Cây chức vụ) | Tên riêng — không dịch. **Không còn cột lũy kế nào** (2026-08-19, xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc) — `MonthToDate`/`YearToDate`/`AccumulationYear`/`AccumulationMonth`/`Projected*` đã bị xoá, tính trực tiếp từ `EmployeeAccumulationHistory`/`OtFormEmployee` mỗi lần đọc. `GroupId`/`DepartmentId` xem §Cây chức vụ — Gán tổ chức theo Chức vụ (2026-08-08) ngay dưới. |
| `JobTitle` | `Code`(unique), `Name`, `RankOrder:int` (CapDo, số lớn = cao hơn — chỉ dùng loại bỏ bước ngang/thấp hơn người tạo, KHÔNG dùng bắc cầu tự động), `TerminalLevel:int` (enum `JobTitleTerminalLevel` — `None/DepartmentManager/WorkshopManager/GeneralDirector`, tối đa 1 JobTitle active/giá trị non-None) | Tên riêng — không dịch. Master data cho cây chức vụ (2026-08-06), xem §Cây chức vụ. **Thu gọn còn 6 dòng seed (2026-08-08, Giai đoạn 4)**: `STAFF/GL/TL/M/FM/GM` (Staff/Group Leader/Team Leader/Manager/Factory Manager/Director), thay 14 dòng cũ — xem §Giai đoạn 4. |
| `DepartmentApprovalStep` | `DepartmentId`(FK), `StepOrder:int`, `JobTitleId`(FK), `RequiresSignature:bool` | Không FK song ngữ. Cây duyệt cấu hình TAY cho từng Phòng ban (2026-08-06, Giai đoạn 2b), xem §Cây chức vụ. **Từ Giai đoạn 4 (2026-08-08) CHỈ còn chứa 3 cấp CUỐI** (Manager/Factory Manager/Director, `TerminalLevel != None`) — cấp trung gian dời sang `GroupApprovalStep`; cột `IsResponsible` đã bỏ (dời sang `GroupApprovalStep`). Không có unique index — Admin tự đảm bảo không lặp `JobTitleId` khi thay danh sách (validate ở Service, không phải DB). `RequiresSignature` chuyển từ `JobTitle` xuống đây (2026-08-07, Giai đoạn 2c). |
| `GroupApprovalStep` | `GroupId`(FK), `StepOrder:int`, `JobTitleId`(FK), `RequiresSignature:bool`, `IsResponsible:bool` | Không FK song ngữ. **Mới (2026-08-08, Giai đoạn 4)** — mirror `DepartmentApprovalStep` nhưng khoá theo `GroupId`, CHỈ chứa 3 cấp TRUNG GIAN (Staff/Group Leader/Team Leader, `TerminalLevel=None`). Số bước KHÔNG giới hạn tổng số — chỉ số bước có `RequiresSignature=true` phải **từ 1 đến 2** khi đang lưu 1 cây duyệt không rỗng (validate ở `GroupApprovalStepService.ReplaceAsync`, dời nguyên từ `DepartmentApprovalStepService` cũ) — khớp đúng 2 ô "Người đề nghị" cố định trên giấy in `YEV-22-024`. `IsResponsible` tối đa 1 bước/Group được đặt `true`. Xem §Giai đoạn 4. |

> **Đã bỏ `Area`/`Line`** (2026-07-14): OT Form không cần "tên công đoạn" ở cấp Area/Line. Xoá hẳn (migration `RemoveAreaLineFromOtFormAddGroupDepartment`), không giữ bảng mồ côi.
>
> **Đã bỏ `Employee.DepartmentId`, `GroupId` thành bắt buộc** (2026-07-14, migration `MakeEmployeeGroupRequiredRemoveDepartment`): Department suy ra qua `Group.DepartmentId`, tránh 2 nguồn dữ liệu lệch nhau.
>
> **Đã đổi `UserId:int` → `UserName:string`** trên `OtForm.CreatedByUserName`, `OtFormApprovalHistory.ApproverUserName`, `UserApprovalScope.UserName`, `UserSignature.UserName` (2026-07-14, migration `RenameUserIdToUserName`): JWT không có claim UserId dạng số, chỉ có `UserName` (`User.Identity.Name` — claim `ClaimTypes.Name` do `MyClaimsTransformation` nạp). Theo đúng convention `Asset.Domain.Models.AuditTrail.ChangedBy` (string) đã có sẵn trong codebase.
>
> **Thêm `Employee.UserName`; `OtForm.CreatedByFullName`** (2026-07-16, migration `AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName`):
> - `Employee.UserName` (nullable, unique filtered index `WHERE UserName IS NOT NULL`) — map nhân viên với tài khoản AD của chính họ.
> - `OtForm.CreatedByFullName` (nullable) — snapshot claim `FullName` lúc tạo đơn, cùng pattern với `OtFormApprovalHistory.ApproverFullName`, để mọi nơi hiển thị (list `my-forms`/`pending-approvals`, chi tiết đơn) luôn ra được **tên người dùng** thay vì `UserName` thô (yêu cầu 2026-07-16: "dữ liệu hiển thị lúc nào cũng phải là tên người dùng").
> - Migration này ban đầu cũng thêm `AccumulationYear`/`AccumulationMonth` — cả 2 (và toàn bộ cột lũy kế
>   khác thêm sau đó) đã bị **xoá lại 2026-08-19**, xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc.

Nghiệp vụ OT Form:
| Entity | Thuộc tính chính | Quan hệ | Ghi chú |
|---|---|---|---|
| `OtForm` | `GroupId/DepartmentId/ReasonId/OtCaseId` (FK, Restrict), `StartTime/EndTime:TimeOnly`, `SubReason?`, `TotalHour:decimal(10,2)`, `Date:DateOnly`, `NumberOfEmployee`, `CreatedByUserName:string`, `CreatedByFullName:string?`, `Status:int` (enum `OtFormStatus` — **redesign 2026-08-07, Giai đoạn 3.1**: chỉ còn `InApproval=0/Completed=1/Rejected=2`, không còn `Draft`/5-cấp cũ), `ApprovalChainWarning:string?` (cảnh báo chuỗi thiếu lúc tạo — mới 2026-08-07), `DeletedByUserName/DeletedByFullName:string?`, `DeletedAt:DateTime?`, `DeleteReason:string?` (mới 2026-08-08 — Admin xoá đơn kẹt vĩnh viễn, xem §Xoá đơn kẹt vĩnh viễn), `CreatorSignatureImage:byte[]?` (mới 2026-08-08 — chữ ký tự ký của người tạo khi không còn ai ký "Người đề nghị" thay, xem §Người tạo tự ký ô "Người đề nghị"; **đã xoá** `Requester*`/`Responsible*` cũ cùng đợt), `IsDeleted` | N-1 tới 4 danh mục trên; 1-N `OtFormEmployee`; 1-1 `ProcessPart`; 1-N `OtFormApprovalHistory`; 1-N `OtFormApprovalStep` (mới) | |
| `OtFormApprovalStep` | `OtFormId`(FK Cascade), `StepOrder:int`, `JobTitleId`(FK Restrict), `JobTitleCodeSnapshot/JobTitleNameSnapshot:string`, `RequiresSignatureSnapshot/IsResponsibleSnapshot:bool`, `TerminalLevelSnapshot:int`, `Status:int` (enum `OtFormApprovalStepStatus` — `Pending=0/Approved=1/Rejected=2/Skipped=3`), `IsDeleted` | N-1 OtForm (Cascade), N-1 JobTitle (Restrict), 1-N `OtFormApprovalStepCandidate` | **Mới (2026-08-07, Giai đoạn 3.1)** — chuỗi bước duyệt SNAPSHOT lúc tạo đơn (không tính lại theo tổ chức hiện tại), thay thế hoàn toàn `Submitter`/`GroupHead`/`UserApprovalScope`. Xem §Cây chức vụ Giai đoạn 3.1. |
| `OtFormApprovalStepCandidate` | `OtFormApprovalStepId`(FK Cascade), `EmployeeId:int`, `UserName/FullName:string` | N-1 OtFormApprovalStep (Cascade) | **Mới (2026-08-07)** — 1 dòng/người đang giữ đúng Chức vụ của bước này trong Phòng ban lúc snapshot (có thể nhiều candidate/bước, "ai thao tác trước thì tính"). |
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?`, `IsRemoved:bool`, `RemovedByUserName?`, `RemovedByFullName?`, `RemovedAtLevel:int?`, `RemovedAt:DateTime?`, `RemoveReason?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. `StartTime`/`EndTime` đều chỉnh riêng được cho từng người (lúc tạo lẫn lúc sửa đơn) nhưng phải nằm trong khung giờ của đơn: `OtForm.StartTime <= StartTime < EndTime <= OtForm.EndTime` — validate ở `OtFormService.EnsureEmployeeTimeWithinForm` (gọi từ `ValidateEmployeesAsync` và `UpdateAsync`). `StartTime` không gửi (`null`) → lấy `OtForm.StartTime` khi tạo / giữ nguyên giá trị hiện có khi sửa. Kiểm tra trùng giờ, giới hạn giờ OT, phiếu ăn đều tính theo `StartTime` riêng của từng người. (Trước 2026-09-24 `StartTime` luôn bằng `OtForm.StartTime`, server tự set — mở ra theo yêu cầu người dùng.) Các cột `Removed*` (2026-07-30) là **soft-remove** — người bị 1 bước duyệt loại khỏi đơn (xem §Loại nhân viên khỏi đơn) KHÔNG bị xoá dòng, chỉ đánh dấu `IsRemoved=true` + snapshot ai/lúc nào/lý do gì, để giữ nguyên audit trail của 1 văn bản có tính pháp lý. **`RemovedAtLevel` đổi ý nghĩa (2026-08-07)**: giờ lưu `OtFormApprovalStep.StepOrder` (trước đây là `ApprovalLevel` cũ) — giữ nguyên tên cột/field cho tương thích FE, chỉ đổi nội dung. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `MainTicketCount/SecondaryTicketCount/MilkCount:int`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn. `MainTicketCount`/`SecondaryTicketCount`/`MilkCount` (phiếu chính/phiếu phụ/sữa, 2026-07-16, migration `AddMealTicketCountsToProcessPart`) — số lượng từng loại phiếu ăn **chung cho cả đơn** (không phải theo từng nhân viên), người lập đơn tự nhập tay khi `IsEat = true`; BE không tự tính từ danh sách nhân viên hay từ `OtFormEmployeeDto.IsEligibleForMeal`. |
| ~~`UserApprovalScope`~~ | — | — | **Đã XOÁ HẲN (2026-08-08, Giai đoạn 3.2)** — entity/enum `ApprovalLevel`/`ScopeType`/service/controller/repository/DTO + bảng `UserApprovalScopes` (`DropTable`, migration `RemoveUserApprovalScope`) đều đã xoá khỏi code lẫn `YevOTManagement` thật; permission `Attendance.UserApprovalScope.*` cũng đã xoá khỏi `YevIdentityManagement` (migration `RemoveUserApprovalScopePermissions`). Không còn dùng cho đơn nào (kể cả đơn cũ) từ Giai đoạn 3.1, audit xác nhận orphaned hoàn toàn trước khi xoá. |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserName:string`, `ApproverFullName:string?`, `OtFormApprovalStepId:int` (FK Restrict → `OtFormApprovalStep` — **đổi từ `ApprovalLevel:int` 2026-08-07**), `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm, N-1 OtFormApprovalStep | Audit trail từng bước duyệt; `SignatureImage`/`ApproverFullName` là snapshot tại thời điểm ký (không tham chiếu ngược Identity). |
| `UserSignature` | `UserName:string`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit (nguồn thật = `OtFormApprovalHistory.SignatureImage`). |
| `SecondaryPassword` | `UserName:string`(unique), `PasswordHash:string`, `UpdatedAt` | Không FK thật | Mật khẩu cấp 2 (2026-07-30) — bắt buộc nhập lại ở MỌI hành động ký/duyệt OtForm (submit/approve/reject, kể cả kênh email), xem §Business Logic — Mật khẩu cấp 2. `PasswordHash` dùng `Microsoft.AspNetCore.Identity.PasswordHasher<object>`, không lưu plaintext. |
| `PendingSecondaryPasswordConfirmation` | `UserName:string`, `PasswordHash:string`, `Token:string`(unique), `ExpiresAt`, `ConfirmedAt:DateTime?`, `CreatedAt` | Không FK thật | Y hệt `PendingSignatureConfirmation` — mật khẩu cấp 2 mới KHÔNG áp dụng ngay, chờ xác nhận qua email. |
| `AttendanceSetting` | `MainMealTicketMinHours:decimal(5,2)`, `MonthlyOtHourLimit:decimal(10,2)`, `YearlyOtHourLimit:decimal(10,2)`, `BatchAutoSendTime:TimeOnly` | Không FK thật | Cấu hình dùng chung (2026-08-01) — bảng LUÔN đúng 1 dòng, mirror `Asset.Domain.Entities.AssetSetting`. Xem §Cấu hình phiếu ăn & giới hạn lũy kế. `BatchAutoSendTime` (mới 2026-08-08, mặc định 15:00) — giờ `OtFormBatchBackgroundService` chạy gom "Đơn tổng", xem §Đơn tổng. |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (redesign 2026-08-07: `InApproval=0/Completed=1/Rejected=2` — bỏ 6 giá trị cũ, KHÔNG cần tương thích ngược với đơn cũ, xem §Cây chức vụ Giai đoạn 3.1), `OtFormApprovalStepStatus` (mới — `Pending=0/Approved=1/Rejected=2/Skipped=3`), `ApprovalLevel` (Submitter/DepartmentManager/WorkshopManager/GeneralDirector/GroupHead — **không còn dùng bởi `OtFormService`**, chỉ còn ý nghĩa lịch sử/dùng bởi `UserApprovalScope`), `ApprovalAction` (Submitted/Approved/Rejected), `ScopeType` (Group/Department/All), `JobTitleTerminalLevel` (None/DepartmentManager/WorkshopManager/GeneralDirector — xem §Cây chức vụ). Lưu dưới dạng `int` trên entity, không dùng `HasConversion`.

### §Business Logic (đã code trong `OtFormService`)
Chốt theo phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam):

> **⚠ SUPERSEDED (2026-08-07, Giai đoạn 3.1)** — 4 mục con ngay dưới đây (§Người tạo đơn KHÁC Trưởng
> nhóm, §Naming chuẩn hoá lại, §Cấp duyệt mới "Trưởng Bộ phận", và phần "giữ nguyên không đổi" theo
> sau) mô tả cơ chế duyệt CŨ (`Draft`/`Submitter`/`GroupHead`/`UserApprovalScope`/5 giá trị
> `OtFormStatus` cũ) — **đã bị THAY THẾ HOÀN TOÀN** bằng chuỗi duyệt tự suy luận theo Cây chức vụ, xem
> **§Cây chức vụ (JobTitle) — Giai đoạn 3.1** ở cuối phần này. Giữ nguyên các mục dưới đây làm **tư liệu
> lịch sử** (lý do nghiệp vụ ra đời từng cấp duyệt, đối chiếu email thật của công ty vẫn còn giá trị
> tham khảo) — KHÔNG còn đúng với code đang chạy. `UserApprovalScope`/`ApprovalLevel` (enum)/`Draft`/
> `GroupHead` vẫn còn tồn tại trong DB/code (chưa xoá hẳn, xem quyết định #11 của plan) nhưng **không
> còn được `OtFormService` sử dụng** cho đơn mới.

#### §Người tạo đơn KHÁC Trưởng nhóm — luồng Draft → ký duyệt (2026-07-16, LỊCH SỬ — xem cảnh báo trên)
Yêu cầu thực tế chốt lại: **người tạo đơn chỉ chịu trách nhiệm nhập liệu**, còn **chữ ký "Người đề nghị" bắt buộc phải là chữ ký thật của Trưởng nhóm** — 2 việc này trước đây bị gộp làm 1 (ai gọi API tạo đơn thì chữ ký của chính người đó được dùng luôn, sai nếu người tạo không phải Trưởng nhóm). Sửa lại thành 2 bước tách biệt:
- **Bước 1 — Tạo Draft**: `POST /api/OtForm` (`OtFormService.CreateAsync`) chỉ insert `OtForm` (`Status = Draft`) + `OtFormEmployee` + `ProcessPart`, **KHÔNG** tạo `OtFormApprovalHistory`, không cần `UserSignature`. Điều kiện tạo giữ nguyên như trước (`UserApprovalScope(ApprovalLevel=Submitter)` khớp Group/Department, trừ Admin) — nhờ vậy người gọi `CreateAsync` chắc chắn nằm trong danh sách được phép ký duyệt Group đó (xem quy tắc gán scope bên dưới), dù hành động tạo tự nó chưa tính là ký.
- **Bước 2 — Trưởng nhóm ký duyệt**: `POST /api/OtForm/{id}/submit` (`OtFormService.ApproveSubmitterAsync`, permission `Attendance.OTForm.Create`) — chỉ chạy được khi `Status == Draft`; validate lại đúng `UserApprovalScope(Submitter)` của **người gọi action này** (có thể là người khác với người tạo, miễn cùng được gán scope cho Group/Department đó), lấy `UserSignature` của người gọi (bắt buộc phải đã đăng ký), insert `OtFormApprovalHistory(ApprovalLevel=Submitter, Action=Submitted, SignatureImage=...)`, chuyển `Status → Pending`. Từ đây luồng y hệt như cũ (chờ Trưởng phòng).
- **Quy tắc gán `UserApprovalScope(ApprovalLevel=Submitter)` bị xiết lại** (`UserApprovalScopeService.CreateAsync`): Admin chỉ gán được cho `UserName` **đang giữ Role `"Trưởng nhóm"`** — ném `DomainException` nếu không, chặn ngay từ gốc dữ liệu (không phải chặn ở lúc tạo/ký đơn). Nhờ vậy, dù nhiều người trong 1 Group cùng được cấp quyền tạo/ký (đúng thiết kế cũ — "Trưởng nhóm chính + phó nhóm dự phòng"), **tất cả** đều đảm bảo đang mang Role Trưởng nhóm, không lọt người ngoài.
- **Sửa đơn khi đang Draft hoặc Pending**: `IsEditable` (và điều kiện chặn ở `UpdateAsync`) mở rộng từ chỉ `Pending` thành `Draft || Pending` — người tạo được sửa xuyên suốt tới khi Trưởng phòng duyệt, không riêng gì lúc còn Draft (khớp yêu cầu "chỉ có quyền tạo đơn và sửa trước khi được Trưởng phòng duyệt").
- **Không có "Reject" ở cấp Draft** (cố tình, tránh phình luồng ngoài yêu cầu) — nếu Trưởng nhóm không đồng ý nội dung do người tạo nhập, chỉ cần chưa gọi `/submit`; người tạo (hoặc chính Trưởng nhóm, nếu cũng là người tạo) sửa lại qua `PUT /{id}` rồi ký sau. Gọi `/reject` (dùng cho cấp Trưởng phòng/Trưởng xưởng/TGĐ) trên đơn đang Draft sẽ bị chặn với thông báo rõ ràng ("Đơn đang ở trạng thái nháp...").
- **Email thông báo** (`NotifyEligibleApproversAsync`) dịch theo đúng 2 bước: sau `CreateAsync` gửi cho người đủ quyền ký cấp `Submitter` (Trưởng nhóm); sau `ApproveSubmitterAsync` mới gửi tiếp cho cấp `DepartmentManager` như luồng cũ. `ApproveByEmailTokenAsync` tự dispatch: token cấp `Submitter` gọi `ApproveSubmitterAsync`, các cấp khác gọi `ApproveAsync` như trước — `RejectByEmailTokenAsync` cho token cấp `Submitter` sẽ lỗi có chủ đích (đúng lý do "không có Reject ở Draft" ở trên).
- **Endpoint xem danh sách chờ ký RIÊNG với xem danh sách chờ duyệt**: Role "Trưởng nhóm" chỉ có permission `Attendance.OTForm.Create` (không có `.Approve`), nên KHÔNG thể gọi `GET /pending-approvals` (gate bằng `.Approve`). Đơn `Draft` chờ Trưởng nhóm ký được trả riêng qua `GET /api/OtForm/pending-submissions` (gate bằng `.Create`, `OtFormService.GetPendingSubmissionsAsync`) — cùng logic lọc theo `UserApprovalScope(Submitter)` nhưng là 1 method/route độc lập, không gộp vào `GetPendingApprovalsAsync`.
- **`GET /api/OtForm/my-participations` — mọi user xem được đơn mình có tên trong danh sách tăng ca (2026-07-17)**: trước đây không có cách nào cho 1 nhân viên bình thường (không tạo/ký/duyệt đơn) xem lại đơn mà chính mình được liệt kê tăng ca — `my-forms` chỉ lọc theo `createdByUserName`. `OtFormService.GetMyParticipationsAsync` tra `Employee` theo `UserName == <người gọi>`, rồi lọc `OtForm` có `OtFormEmployee.EmployeeId` khớp — account chưa liên kết `Employee` thì trả rỗng (không lỗi). Gate bằng `Attendance.OTForm.View` (mọi role nghiệp vụ đều có, kể cả Role "Nhân viên" mới thêm) — không cần permission/migration mới.
- **`OtFormListItemDto.ApprovalSummary` — tóm tắt ai đã ký/duyệt ngay trên danh sách (2026-07-17)**: trước đây danh sách chỉ có `status` (int), FE phải tự suy luận cấp đang chờ và không biết TÊN người đã duyệt nếu không bấm vào chi tiết. Giờ mọi endpoint list (`my-forms`/`pending-submissions`/`pending-approvals`/`my-actions`/`my-participations`) đều trả kèm `approvalSummary` (bản rút gọn `OtFormApprovalHistory`, bỏ `Comment`/`SignatureImage`) — dùng chung 1 `Expression<Func<OtForm, OtFormListItemDto>>` (`OtFormService.ToListItemDto`, field `private static readonly`) để tránh lặp lại cùng 1 khối `Select` ở 5 method khác nhau như trước.
- **Gộp UI ở tầng FE, KHÔNG gộp API ở tầng BE (2026-07-17)**: người dùng muốn 4 mục menu cũ (Đơn của tôi/Chờ tôi ký duyệt/Chờ tôi duyệt/Đơn tôi đã xử lý) + mục mới (Đơn tôi tham gia) gộp thành **1 màn hình duy nhất có tab** thay vì 5 mục menu rời — quyết định giữ nguyên 5 API riêng biệt (đã/đang chạy ổn định, ít rủi ro hơn viết lại 1 API UNION phức tạp), FE tự gọi đúng API theo tab đang chọn. Xem hướng dẫn UI chi tiết ở `docs/attendance-api-fe.md` §1.1/§1.4.

#### §Naming chuẩn hoá lại (2026-07-17, LỊCH SỬ — quyết định naming Phòng/Bộ phận vẫn đúng, xem cảnh báo ở đầu §Business Logic) — đối chiếu với email thật của công ty
Người dùng gửi email thật (BP Kế hoạch - 1PC4L, gồm nhóm Kế hoạch + Seppen) để làm chuẩn, đối chiếu ra:
- `Department` = **Phòng / Phòng ban** (khớp "Trưởng phòng" = `ApprovalLevel.DepartmentManager`) — **không đổi**.
- `Group` = **Bộ phận** (KHÔNG PHẢI "Nhóm" như `docs/attendance-api-fe.md` từng ghi nhầm ở §3.1 — đã sửa lại label). Cơ chế **nhiều người cùng giữ quyền ký cấp Submitter cho 1 Group** (VD Huyền/Cảng/Dung cùng phụ trách BP Kế hoạch, thay phiên tạo/ký) đã đúng sẵn qua `UserApprovalScope(ScopeType=Group, ApprovalLevel=Submitter, nhiều UserName)` — không đổi.

#### §Cấp duyệt mới "Trưởng Bộ phận" (GroupHead) — 2026-07-17, LỊCH SỬ — xem cảnh báo ở đầu §Business Logic
Từ cùng email trên, phát hiện **thiếu 1 cấp duyệt**: Ms Nhung ("Trưởng Bộ phận") **ký SAU Trưởng nhóm, TRƯỚC Trưởng phòng** ("Ms Nhung ký xong rồi tới TP ký") — khác với 3 người Huyền/Cảng/Dung (chỉ là "Trưởng nhóm"/Submitter, ký/tạo thay phiên nhau). Đây là 1 cấp duyệt hoàn toàn mới, không phải chỉ đổi tên. Luồng đúng: **Submitter (Trưởng nhóm, nhiều người/Group) → GroupHead (Trưởng Bộ phận, MỚI) → DepartmentManager (Trưởng phòng) → WorkshopManager (Trưởng xưởng) → GeneralDirector (TGĐ, tuỳ TH1/TH2/TH3)**.

- **Quyết định đã chốt với người dùng** (hỏi lại 2 lần vì đụng hệ thống đang chạy thật): cấp GroupHead **bắt buộc cho TẤT CẢ Group ngay**, không phải tuỳ chọn/rollout dần — Group nào Admin **chưa gán** `UserApprovalScope(ApprovalLevel=GroupHead)` thì đơn của Group đó sẽ **kẹt cứng** ngay sau khi Trưởng nhóm ký (`Status = PendingGroupHead`), không ai duyệt được tiếp cho tới khi Admin gán. Không có logic fallback/skip.
- **`ApprovalLevel.GroupHead = 4`** (thêm cuối enum, không chèn giữa — giữ nguyên giá trị int các cấp cũ đã lưu DB, cùng nguyên tắc `OtFormStatus.Draft = 5`).
- **`OtFormStatus.PendingGroupHead = 6`** (thêm cuối enum) — ý nghĩa "đã có chữ ký Trưởng nhóm, đang chờ Trưởng Bộ phận ký". `ApproveSubmitterAsync` giờ set status này (thay vì `Pending` như trước) và `NotifyEligibleApproversAsync(otForm, ApprovalLevel.GroupHead)` (thay vì `DepartmentManager`).
- **Sau khi GroupHead duyệt, chuyển thẳng về `OtFormStatus.Pending` cũ** (`DetermineNextStatus` case riêng, bỏ qua so sánh `OtCase.RequiredApprovalLevel` vì field này chỉ nhận DepartmentManager/WorkshopManager/GeneralDirector, GroupHead không bao giờ là điểm dừng) — nhờ tái dùng đúng status `Pending` đã có, **toàn bộ luồng từ Trưởng phòng trở lên (DetermineNextStatus/LoadFormAndValidateAuthorityAsync nhánh Pending→ApprovedByDepartment→ApprovedByWorkshop→Completed) giữ nguyên 100%, không đổi 1 dòng nào**.
- `IsEditableStatus` (+ bản inline trong `OtFormService.ToListItemDto`) mở rộng thêm `PendingGroupHead` — đơn vẫn sửa được xuyên suốt tới khi Trưởng phòng duyệt thật, chỉ dời điểm khoá theo đúng cấp mới chèn vào (giữ đúng tinh thần rule cũ).
- `GetPendingApprovalsAsync` ("Chờ tôi duyệt") thêm nhánh lọc `UserApprovalScope(ApprovalLevel=GroupHead)` khớp Group/Department + `Status == PendingGroupHead`, theo đúng pattern nhánh DepartmentManager/WorkshopManager đã có.
- **Permission**: Ms Nhung chỉ duyệt/ký (không tạo đơn) → Role mới **"Trưởng Bộ phận"** (migration `AddGroupHeadRole`, đã áp dụng vào DB) dùng lại **đúng bộ permission** của Trưởng phòng/Trưởng xưởng/TGĐ (`OTForm.View`, `OTForm.Approve`, `UserSignature.Update`) — `POST /{id}/approve`/`/reject` (endpoint có sẵn) xử lý được ngay, không cần endpoint mới. Gán scope qua `POST /api/UserApprovalScope` với `approvalLevel=4 (GroupHead)`, giống hệt cách gán DepartmentManager/WorkshopManager.
- **Không có validate "phải giữ Role Trưởng Bộ phận" khi Admin gán scope** (khác Submitter, nơi `UserApprovalScopeService.CreateAsync` bắt buộc `UserName` phải giữ Role "Trưởng nhóm") — nhất quán với cách DepartmentManager/WorkshopManager đang làm (Admin tự chịu trách nhiệm gán đúng người, không có ràng buộc Role ở tầng BE).
- **Breaking change cho FE** — `status` có thêm giá trị `6 PendingGroupHead`, chèn giữa `5 Draft` và `0 Pending` trong ý nghĩa nghiệp vụ (dù giá trị int không liền kề). Chi tiết đầy đủ + bảng mapping mới ở `docs/attendance-api-fe.md` §1.1/§1.2/§4.1a/§4.3/§5.

Phần dưới đây (duyệt cấp Trưởng phòng → Trưởng xưởng → TGĐ) mô tả thiết kế gốc — **cũng LỊCH SỬ**, xem
cảnh báo ở đầu §Business Logic (chuỗi bước giờ động theo Cây chức vụ, không còn 3 cấp cố định):
- Luồng duyệt **tuần tự**: `DepartmentManager` (Trưởng phòng) → `WorkshopManager` (Trưởng xưởng) → `GeneralDirector` (Tổng Giám Đốc), dừng ở cấp = `OtCase.RequiredApprovalLevel`:
  - TH1 (ngày thường) → `RequiredApprovalLevel = DepartmentManager`.
  - TH2 (ngày nghỉ/CN/lễ) → `RequiredApprovalLevel = WorkshopManager`.
  - TH3 (lũy kế > 25h/tháng hoặc > 300h/năm) → `RequiredApprovalLevel = GeneralDirector`.
- Phân quyền 2 lớp: **Permission** (`Attendance.OTForm.Approve` gate hành động) + **`UserApprovalScope`** (gate dữ liệu — khớp `ScopeType/ScopeId` với `OtForm.DepartmentId`/`GroupId`, hoặc `ScopeType=All` khớp mọi đơn, VÀ đúng `ApprovalLevel` đang chờ). Từ 2026-08-05, `GeneralDirector` KHÔNG còn bypass qua `User.IsInRole(...)` nữa — cũng đi qua đúng cơ chế `UserApprovalScope` như mọi cấp khác (dòng `ScopeType=All`) — xem §Permission & Role đã seed.
- Ký tên các cấp duyệt: nếu `OtCase.RequireSignature = true` thì người duyệt **phải đã đăng ký chữ ký** qua `UserSignature` (validate trong `OtFormService.ApproveAsync`, ném `DomainException` nếu chưa đăng ký).
- **Chữ ký không còn nhận qua request body** (2026-07-16, bỏ `CreateOtFormDto.SubmitterSignatureImage` và `ApproveOtFormDto.SignatureImage`) — lý do đặt ra: nếu người trưởng nhóm/trưởng phòng thay đổi (nghỉ việc, bàn giao), FE không còn phải tự quản lý gửi đúng ảnh chữ ký mỗi lần ký; BE tự `_unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == <người đang gọi API>)` lấy chữ ký **đã đăng ký sẵn** của đúng người đang thao tác (Submitter lúc `CreateAsync`, Approver lúc `ApproveAsync`) rồi snapshot vào `OtFormApprovalHistory.SignatureImage`. Toàn vẹn dữ liệu vẫn được giữ đúng như trước: bản ghi lịch sử duyệt luôn là **snapshot đóng băng tại đúng thời điểm ký** (không tham chiếu ngược `UserSignature`), nên nếu sau này người đó đổi chữ ký mới, hoặc bị thay thế bởi người khác giữ chức vụ, các đơn cũ vẫn hiển thị đúng chữ ký + tên người đã ký tại thời điểm đó.
- **Mục đích chữ ký = ảnh stamp lên PDF khi in, không phải chữ ký số/PKI** (đã chốt 2026-07-15) — FE tự dựng file PDF từ JSON do BE cung cấp (`GET /api/OtForm/{id}` đã đủ dữ liệu: thông tin đơn, danh sách nhân viên, ProcessPart, `ApprovalHistories` kèm `SignatureImage`+`ApproverFullName` từng cấp). BE không cần thêm thư viện PDF nào.
  - **Đối chiếu với form giấy gốc `YEV-22-024` (rà lại 2026-07-17)**: mọi ô trên form đã có field ánh xạ trong `OtFormDto` (4 ô chữ ký ↔ `approvalHistories` theo `ApprovalLevel`, danh sách nhân viên ↔ `OtFormEmployees`, khối Ăn uống/Xe đưa đón/Copy/Đề nghị khác ↔ `ProcessPart`) — **trừ** ô "Tên công đoạn / 工程名" ở đầu form, hiện **không có field lưu trữ tương ứng** (field `AreaLine` cũ đã bị xóa ở migration `RemoveAreaLineFromOtFormAddGroupDepartment`). Chưa quyết định bổ sung lại field này — nếu sau này cần, phải thêm migration mới cho `OtForm` + cập nhật `OtFormDto`/`CreateOtFormDto`.
- **`OtFormApprovalHistory.ApproverFullName`** (2026-07-15, migration `AddApproverFullNameToOtFormApprovalHistory`): snapshot claim JWT `"FullName"` (đọc qua `BaseController.CurrentFullName`, nạp từ `Identity.User.FullName` — tự resolve từ AD `DisplayName` lúc user đăng nhập lần đầu, xem `MyClaimsTransformation.GetActualFullName`) tại đúng thời điểm Submit/Approve/Reject. Lý do snapshot thay vì để FE gọi chéo API Identity: (1) không phụ thuộc module khác lúc render PDF, (2) giữ đúng tên tại thời điểm ký kể cả khi tài khoản đổi tên sau này. `null` nếu tài khoản chưa từng có `FullName` trong Identity — FE fallback hiển thị `ApproverUserName`.
- `Employee.GroupId` (bắt buộc) — người tạo đơn chỉ được chọn nhân viên **cùng `GroupId`** với đơn (`OtFormService.CreateAsync` validate, ném `DomainException` nếu lệch nhóm).
- **Phân quyền tạo đơn theo phạm vi Group/Department — nhiều người/1 Group** (2026-07-16): trước đây bất kỳ ai có permission `Attendance.OTForm.Create` (Role "Trưởng nhóm") đều tạo được đơn cho **bất kỳ** `GroupId`/`DepartmentId` nào — không đúng thực tế 1 Group có thể có nhiều người thay phiên tạo đơn (Trưởng nhóm chính + phó nhóm dự phòng). Sửa: `OtFormService.CreateAsync` giờ check thêm **`UserApprovalScope` với `ApprovalLevel=Submitter`** (tái dùng y hệt bảng/enum đang dùng cho cấp duyệt, không tạo entity mới) — người gọi API phải có ít nhất 1 dòng `UserApprovalScope(UserName=<người gọi>, ApprovalLevel=Submitter, ScopeType=Group, ScopeId=<request.GroupId>)` hoặc `(ScopeType=Department, ScopeId=<request.DepartmentId>)`, nếu không → `DomainException`. Admin (`User.IsInRole("Admin")`) bypass hoàn toàn, giống cách `GeneralDirector` bypass lúc duyệt.
  - Cách gán: Admin gọi `POST /api/UserApprovalScope` với `ApprovalLevel=0 (Submitter)` cho **từng người** được phép tạo/ký đơn của Group đó — có thể gán nhiều `UserName` cùng `ScopeId` (1 Group nhiều người tạo/ký đơn), hoặc gán `ScopeType=Department` để 1 người được cho **mọi Group** trong Department đó. **Từ 2026-07-16**: `UserApprovalScopeService.CreateAsync` chặn gán `ApprovalLevel=Submitter` cho `UserName` chưa giữ Role `"Trưởng nhóm"` (ném `DomainException`) — xem §Người tạo đơn KHÁC Trưởng nhóm.
  - Role `Attendance.OTForm.Create` (Trưởng nhóm) vẫn là điều kiện CẦN (gate hành động); `UserApprovalScope(Submitter)` là điều kiện ĐỦ (gate đúng Group/Department nào) — giống hệt mô hình 2 lớp Permission+Scope đang dùng cho `OTForm.Approve`.
- **Role "Nhân viên" — tách "tạo đơn" khỏi "ký duyệt Trưởng nhóm" (2026-07-17, migration `AddNhanVienRoleForOtFormCreate`)**: trước đây dù comment trong code đã ghi ý định "người tạo đơn (data entry) không nhất thiết là Trưởng nhóm", `CreateAsync` vẫn chỉ chấp nhận `UserApprovalScope(Submitter)` — mà scope này chỉ gán được cho account giữ Role "Trưởng nhóm" (`UserApprovalScopeService.CreateAsync` chặn cứng) — nên **thực tế chỉ Trưởng nhóm mới tạo được đơn**. Sửa: `OtFormService.CreateAsync` giờ chấp nhận **2 nhánh độc lập**:
  1. `UserApprovalScope(Submitter)` khớp Group/Department — cơ chế cũ, dành cho Trưởng nhóm (sau đó họ tự ký `/submit` được luôn).
  2. **Mới**: `Employee.GroupId == request.GroupId`, suy ra qua `Employee.UserName == <người gọi>` — dành cho Role "Nhân viên" (permission chỉ có `OTForm.Create`/`View` + 4 permission `.View` danh mục cần cho dropdown, KHÔNG có `UserApprovalScope` nào, KHÔNG có `UserSignature.Update`). Chỉ tạo được đơn cho **đúng Group của chính mình** (Employee liên kết), không chọn Group khác được.
  - `ApproveSubmitterAsync` (ký "Người đề nghị") **KHÔNG đổi** — vẫn chỉ chấp nhận nhánh 1 (`UserApprovalScope`), nên Role "Nhân viên" tạo đơn xong gọi `/submit` sẽ bị chặn 400 ("Bạn không được phân quyền ký duyệt...") — đúng ý đồ "tạo được, không ký được".
- Reject: ở bất kỳ cấp nào, `RejectOtFormDto.Comment` bắt buộc, **không có `SignatureImage`** (từ chối chỉ ghi lý do, không ký) — `OtFormApprovalHistory.SignatureImage` luôn `null` cho dòng `Action=Rejected`. `Status → Rejected`, dừng luồng.

### §Sửa đơn khi đang Draft/Pending (2026-07-16, mở rộng phạm vi cùng ngày với luồng Draft)
- `PUT /api/OtForm/{id}` (`OtFormService.UpdateAsync`), điều kiện **cả hai** (không đổi):
  1. Chỉ **chính người tạo** (`OtForm.CreatedByUserName == CurrentUserName`) mới sửa được — không phải Admin, không phải Trưởng nhóm (trừ khi Trưởng nhóm đó cũng chính là người tạo), không phải cấp duyệt nào khác.
  2. Chỉ khi `Status` là `Draft`, `PendingGroupHead` hoặc `Pending` (**chưa tới cấp Trưởng phòng duyệt**, `IsEditableStatus`) — qua cấp Trưởng phòng trở lên là khóa cứng, ném `DomainException` "Đơn đã được Trưởng phòng duyệt trở lên, không thể sửa nữa.". Đây chính là câu trả lời cho câu hỏi "khi nào không được sửa thông tin đơn nữa".
- `OtFormDto.IsEditable` / `OtFormListItemDto.IsEditable` = `IsEditableStatus(Status)` — FE dùng field này để hiện/ẩn nút "Sửa", không cần tự so sánh status.
- **Giới hạn lại phạm vi sửa (2026-07-31, breaking)**: trước đây `UpdateAsync` cho sửa **toàn bộ** đơn (danh mục + danh sách nhân viên + `ProcessPart`), giống hệt `CreateAsync`. Người dùng phản hồi: đơn chỉ nên sửa được **"thực tích của nhân viên"** — tức giờ kết thúc OT thực tế của từng người — chốt qua AskUserQuestion (CLAUDE.md §2 luật 2) 2 điểm:
  1. **Field được sửa**: CHỈ `EndTime` của từng nhân viên ĐANG có trong đơn. Không còn sửa `NoteVn`/`NoteJp`.
  2. **Field/danh sách bị khoá**: `GroupId`/`DepartmentId`/`ReasonId`/`OtCaseId`/`Date`/`StartTime`/`EndTime`(chung)/`SubReason`/`ProcessPart` và cả **danh sách nhân viên** (không thêm/bớt được ai) đều **cố định** sau khi tạo đơn — muốn bớt 1 người dùng riêng tính năng "Loại khỏi đơn" (`POST /{id}/employees/remove`, xem §Loại nhân viên khỏi đơn), không qua endpoint này nữa.
  - **DTO đổi hẳn**: `UpdateOtFormDto` từ giống `CreateOtFormDto` (10 field) rút gọn còn `{ Employees: List<UpdateOtFormEmployeeTimeDto { EmployeeId, EndTime }> }` — không còn field nào khác. `UpdateOtFormEmployeeTimeDto` là DTO mới, thay `CreateOtFormEmployeeItemDto` (không có `NoteVn`/`NoteJp`).
  - **`UpdateAsync` viết lại hoàn toàn**: không còn load/validate Group/Department/Reason/OtCase từ request (vì không nhận field đó nữa); chỉ load `otForm` kèm `OtFormEmployees`, so `requestedEmployeeIds` (từ `request.Employees`) với `activeEmployeeIds` (`OtFormEmployees.Where(!IsRemoved)`) bằng `SetEquals` — **khác tập** (thiếu người, thừa người, hoặc trùng `EmployeeId`) đều bị từ chối 400 ngay, không âm thầm bỏ qua. Từng `EndTime` vẫn validate `> otForm.StartTime && <= otForm.EndTime` (giữ nguyên luật cũ, chỉ đổi nguồn `StartTime`/`EndTime` từ `request` sang `otForm` hiện có vì không nhận từ request nữa). Hợp lệ → chỉ set `EndTime` trên đúng các dòng `OtFormEmployee` active, không đụng field nào khác của `OtForm`.
  - **Không còn nhánh "thêm lại người đã bị loại" trong `UpdateAsync`** — vì danh sách nhân viên đã cố định, `EmployeeId` đã bị loại (`IsRemoved=true`) sẽ không nằm trong `activeEmployeeIds` nên tự động bị endpoint này từ chối nếu FE lỡ gửi lên; muốn thêm lại người đã loại phải làm tính năng riêng (chưa có, ngoài phạm vi yêu cầu lần này).
  - **`EnsureCanCreateOrEditForScopeAsync` vẫn giữ** nhưng gọi với `otForm.GroupId`/`otForm.DepartmentId` (giá trị hiện có, không đổi được nữa) thay vì `request.GroupId`/`request.DepartmentId` — vẫn re-check quyền scope của người sửa chưa bị Admin thu hồi kể từ lúc tạo đơn, dù bản thân Group/Department không còn đổi được.
  - **FE (`CreateOtFormPage.tsx`)**: khi `isEditMode`, mọi field ở khối "Thông tin đơn" (select/date/giờ/lý do chi tiết) và cả checkbox/input "Yêu cầu hỗ trợ khác" đều `disabled`, kèm badge "Đã khoá..." ở góc phải tiêu đề khối. Bảng nhân viên đổi hẳn sang bảng CỐ ĐỊNH riêng cho Sửa đơn (nguồn dữ liệu `editEmployees` lấy thẳng từ `data.employees.filter(!isRemoved)` lúc tải đơn, KHÔNG phải `groupEmployees` chọn theo Nhóm dùng lúc Tạo mới) — không có ô tick, không có cột Ghi chú, chỉ còn cột "Giờ kết thúc" sửa được. Người bị loại (`isRemoved`) bị lọc khỏi danh sách sửa (đưa vào sẽ bị BE từ chối vì không còn trong `activeEmployeeIds`).

### §Lũy kế tháng/năm — cộng khi Completed, tính lúc đọc từ ledger (2026-07-16, REDESIGN 2026-08-19)
> Bản 2026-07-16→2026-08-08 (lưu `MonthToDate`/`YearToDate`/`AccumulationYear`/`AccumulationMonth` trực
> tiếp trên `Employee`, rollover theo `OtForm.Date`, Admin chỉnh tay qua `PUT /Employee/{id}`) đã **THAY
> THẾ HOÀN TOÀN** — xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc bên dưới để hiểu lý do và thiết
> kế mới. 4 cột đó đã bị **xoá khỏi bảng `Employees`** (migration `RemoveEmployeeAccumulationColumns`),
> Admin **không còn** chỉnh tay được lũy kế nữa.
- **Thời điểm cộng vào ledger**: CHỈ khi đơn đạt `Completed` — `OtFormService.AccumulateEmployeeHoursAsync`
  (gọi từ `CreateAsync` khi chuỗi duyệt rỗng và từ `ApproveAsync` khi hết bước Pending cuối) ghi/cộng
  dồn vào `EmployeeAccumulationHistory` theo đúng `(EmployeeId, OtForm.Date.Year, OtForm.Date.Month)`.
  Đơn `Rejected` hoặc dừng ở cấp trung gian thì KHÔNG ghi gì.
- **Số giờ cộng** = `OtFormEmployee.EndTime - OtFormEmployee.StartTime`, cộng thêm **0.5h (30 phút)** nếu
  đủ ngưỡng phiếu ăn mà `DidEat = false` (không đổi so với bản cũ — xem §Có ăn hay không theo từng nhân viên).
- **`MonthToDate`/`YearToDate` không còn lưu ở đâu** — `EmployeeService` tính trực tiếp từ ledger mỗi
  lần đọc, luôn scope theo năm/tháng **THỰC TẾ hôm nay** (không phải ngày trên bất kỳ đơn nào) — 1 đơn
  ghi ngày tương lai chỉ "hiện" ra khi tới đúng tháng đó, không cộng sớm dù đã `Completed` từ trước.

### §Lũy kế hiển thị trên đơn — snapshot đóng băng, KHÔNG join sống (2026-07-21, nguồn đổi 2026-08-06/2026-08-19)
- **Ý tưởng gốc** (vẫn đúng, chưa đổi): `OtFormEmployee.MonthToDate`/`YearToDate` (decimal(10,2)) là
  snapshot đóng băng **tại đúng thời điểm dòng `OtFormEmployee` được thêm vào đơn** — cùng nguyên tắc
  snapshot dùng cho `OtFormApprovalHistory.SignatureImage`/`ApproverFullName` — để xem lại đơn cũ luôn
  ra đúng số liệu lúc lập đơn, không bị lệch theo lũy kế đã đổi khác đi sau đó.
- **Nguồn để chụp đã đổi 2 lần**: ban đầu (2026-07-21) chụp lũy kế THẬT `Employee.MonthToDate/YearToDate`
  lúc đó → đổi (2026-08-06) sang chụp lũy kế **DỰ KIẾN** `Employee.ProjectedMonthToDate/YearToDate` (lý
  do: xem §Lũy kế dự kiến) → đổi tiếp (2026-08-19, cùng đợt bỏ hẳn cache trên `Employee`) sang gọi
  `OtFormService.ComputeProjectedHoursBatchAsync(...)` tính trực tiếp — vẫn đúng nghĩa "Dự kiến trước khi
  cộng chính đơn này", chỉ đổi cách lấy con số, KHÔNG đổi field/tên cột. `GetByIdAsync` luôn đọc thẳng
  `x.MonthToDate`/`x.YearToDate` từ `OtFormEmployee` (không join `Employee`) — không đổi qua các lần trên.
- **Giới hạn dữ liệu cũ**: các `OtFormEmployee` tạo trước migration `AddAccumulationSnapshotToOtFormEmployee`
  (2026-07-21) có `MonthToDate`/`YearToDate` = `0`, không có cách khôi phục lại lịch sử.

### §Phiếu ăn — ngưỡng giờ OT (2026-07-16, ngưỡng đưa vào cấu hình + tự tính ở FE 2026-08-01)
- Nhân viên đủ điều kiện phiếu ăn khi giờ OT thực tế **>= ngưỡng cấu hình** (`(EndTime - StartTime) >=
  AttendanceSetting.MainMealTicketMinHours`, mặc định 2.5h = 2h30 — trước 2026-08-01 hardcode `> 2h`,
  xem §Cấu hình phiếu ăn & giới hạn lũy kế). Đây là field **tính toán khi đọc**
  (`OtFormEmployeeDto.IsEligibleForMeal`), KHÔNG lưu DB — không nhầm với `ProcessPart.IsEat` (cờ "có
  phục vụ ăn" ở cấp cả đơn, do người lập đơn tick tay).
- **Số lượng phiếu ăn theo loại** (2026-07-16, migration `AddMealTicketCountsToProcessPart`): khi
  `IsEat = true`, người lập đơn nhập thêm 3 số lượng — `MainTicketCount` (phiếu chính),
  `SecondaryTicketCount` (phiếu phụ), `MilkCount` (sữa). Cả 3 đều **chung cho cả đơn** (không phải
  per-employee). `MilkCount` luôn nhập tay 100%, BE không đụng tới. `MainTicketCount`/
  `SecondaryTicketCount`: FE tự tính gợi ý lúc **Tạo đơn** (xem §Cấu hình phiếu ăn & giới hạn lũy kế);
  từ **2026-08-18**, BE cũng **tự tính lại 2 số này** mỗi khi danh sách/`DidEat` của nhân viên trong
  đơn đổi SAU lúc tạo — xem §Đồng bộ phiếu ăn khi sửa đơn/loại nhân viên.

### §Cấu hình phiếu ăn & giới hạn lũy kế (2026-08-01)
**Yêu cầu người dùng** (chốt qua AskUserQuestion trước khi code, CLAUDE.md §2 luật 2): 2 nhóm quy tắc
trước đây hardcode trong code (mốc 2h nhận phiếu ăn ở BE; ngưỡng cảnh báo lũy kế 25h/tháng, 300h/năm ở
FE) nay gộp thành 1 bảng cấu hình Admin tự sửa được, không cần deploy lại khi chính sách đổi.

- **Phiếu ăn**: tăng ca **từ** `MainMealTicketMinHours` giờ trở lên (mặc định **2h** — đổi lại từ 2.5h
  ngày 2026-08-05) → nhận **phiếu chính**; **dưới** mốc đó → nhận **phiếu phụ** (chốt: mọi người tăng ca
  đều nhận đúng 1 trong 2 loại, **không có ngưỡng sàn** riêng cho phiếu phụ). Sữa (`MilkCount`) **luôn
  nhập tay**, không tự tính.
- **Giới hạn lũy kế**: `MonthlyOtHourLimit` (mặc định 25h) và `YearlyOtHourLimit` (mặc định 300h) — vượt
  ngưỡng thì UI tô đỏ cảnh báo trên MỌI màn hiển thị lũy kế, **không chặn** tạo/duyệt đơn hay sửa lũy kế
  thủ công. **⚠ SUPERSEDED (2026-08-26)** — cả `MonthlyOtHourLimit`/`YearlyOtHourLimit` lẫn
  `DailyOtHourLimit` mới thêm giờ CHẶN CỨNG, xem §Giới hạn giờ OT ngày/tháng/năm — CHẶN CỨNG bên dưới.

### §Có ăn hay không theo từng nhân viên — trừ 30 phút nếu có ăn (2026-08-06, đổi hướng 2026-08-26)

**Yêu cầu người dùng gốc** (chốt qua AskUserQuestion trước khi code, CLAUDE.md §2 luật 2, 2026-08-06):
nhân viên đủ ngưỡng nhận phiếu ăn (`IsEligibleForMeal`) mà **không ăn** thì được cộng bù **30 phút**
vào lũy kế tháng/năm — khác hẳn `ProcessPart.IsEat`/`MainTicketCount` hiện có (cờ + số lượng **chung
cho cả đơn**, nhập tay, không theo từng người).

**Đổi hướng (2026-08-26, chốt qua AskUserQuestion, CLAUDE.md §2 luật 2)**: lật ngược công thức — VÍ DỤ
14h-18h (4h, đủ ngưỡng) → **có ăn** thì giờ OT thực tính = **3.5h** (trừ 30 phút nghỉ ăn); **không ăn**
thì giữ nguyên **4h** (bỏ hẳn phần +30 phút cộng bù trước đây). Khác biệt quan trọng so với bản gốc:
áp dụng cho **CẢ giờ hiển thị** trên đơn/danh sách/bản in, **không còn** chỉ ảnh hưởng lũy kế.

- **Entity**: `OtFormEmployee.DidEat: bool` (mới, default `false`) — chỉ có ý nghĩa khi giờ OT **thô**
  (`EndTime - StartTime`) của người đó `>= AttendanceSetting.MainMealTicketMinHours` (dùng CHUNG
  ngưỡng với việc chia phiếu chính/phụ, không phải ngưỡng riêng). Ngưỡng đủ điều kiện (`IsEligibleForMeal`)
  LUÔN tính trên giờ thô, không bao giờ tính trên giờ đã trừ — tránh vòng lặp (đủ điều kiện mới có ô
  "Có ăn" để chọn, chọn xong mới trừ giờ).
- **Nhập/sửa**: cùng luồng và cùng giới hạn thời gian với việc sửa giờ kết thúc thực tế ("thực tích") —
  nhập lúc tạo đơn (`CreateOtFormEmployeeItemDto.DidEat`), sửa được tới trước khi Trưởng phòng duyệt
  (`UpdateOtFormEmployeeTimeDto.DidEat`, cùng `OtFormService.UpdateAsync` đang giới hạn phạm vi sửa).
- **Công thức dùng chung 1 nơi** — `OtFormService.CalculateOtHours(startTime, endTime, didEat,
  mainMealTicketMinHours)`: `hours = EndTime - StartTime`; nếu `hours >= mainMealTicketMinHours &&
  didEat` thì `hours -= MealBreakDeductionHours (0.5m)`; ngược lại giữ nguyên. Mirror độc lập ở
  `EmployeeService.CalculateProjectedHours` (Dự kiến, không gọi chéo — mỗi service tự chứa logic tính
  giờ của mình, quy ước cũ giữ nguyên).
- **Nơi dùng công thức này**:
  - `OtFormService.AccumulateEmployeeHoursAsync` (ghi lũy kế, chạy đúng 1 lần khi đơn `Completed`).
  - `OtFormService.ComputeProjectedHoursBatchAsync` (snapshot `MonthToDate`/`YearToDate` lúc tạo đơn).
  - **Mới (2026-08-26)**: `OtFormEmployeeDto.ActualHours` — field mới, BE tính sẵn bằng đúng công thức
    trên (gọi `CalculateOtHours` ngay trong `GetByIdAsync`/`BuildBatchDtoAsync`), trả về FE. Đây là
    field DUY NHẤT nên dùng để hiển thị "giờ OT của 1 người" — **không** tự tính lại
    `endTime - startTime` ở FE nữa.
  - `EmployeeService.CalculateProjectedHours` — badge Dự kiến ở màn Nhân viên/chọn nhân viên tạo đơn.
- **KHÔNG dùng công thức này** (giữ nguyên giờ thô, có chủ đích): `IsEligibleForMeal`
  (`OtFormService.cs` — inline `(EndTime-StartTime) >= mainMealTicketMinHours`, cả 2 chỗ map DTO) và
  `CalculateMealTicketCounts` (số phiếu chính/phụ — comment tại chỗ đã ghi rõ "OT thực tế, CHƯA cộng
  bù 30p", nay đọc là "chưa trừ 30p", ý nghĩa không đổi: ngưỡng/số phiếu luôn theo giờ thô).
- **FE**: `ot-form.dto.ts` — `OtFormEmployeeDto.actualHours: number` (mới). `OtFormDetail.tsx`,
  `OtFormBatchDetail.tsx`, `OtFormEmailConfirmPage.tsx` — cột giờ + tổng giờ OT của form đổi từ tự tính
  `calculateHours(startTime, endTime)` (hàm `lib/time.ts`) sang đọc thẳng `employee.actualHours`.
  `CreateOtFormPage.tsx` (màn Tạo đơn) **không đổi** — trang này chỉ hiển thị `totalHour` cấp CẢ ĐƠN
  (khung giờ chung, không phải giờ từng người, không bị trừ) và dùng giờ thô cho việc gợi ý phiếu
  ăn/hiện checkbox "Có ăn" (đúng quy tắc "không dùng công thức này" ở trên) — không có cột "giờ OT thực
  tính" nào ở màn này cần đổi. `OtFormPrintView.tsx` (bản in) chỉ in giờ vào/ra thô của từng người
  (`StartTime`–`EndTime`), không in số giờ tính toán nào — không cần đổi.
- **Giá trị mặc định "Có ăn" đồng bộ theo "Ăn uống" (2026-08-06)** — `ProcessPart.IsEat` (cấp cả đơn,
  đặt suất ăn) và `OtFormEmployee.DidEat` (cấp từng người, quyết định có bị trừ 30 phút hay không) là
  2 field **độc lập ở BE**, nhưng dễ khiến người lập đơn nhầm 2 cái liên quan nhau (bỏ tích "Ăn uống"
  nhưng quên đổi tay "Có ăn" từng người → giờ OT của họ vẫn bị trừ dù thực tế không đặt suất ăn cho ai).
  Chỉ sửa ở
  FE (`CreateOtFormPage.tsx`, `mealServiceActive = processPartEnabled && processPart.isEat`), **không**
  đổi logic BE: giá trị mặc định của "Có ăn" khi chọn nhân viên mới, và khi bấm sửa giờ/ghi chú trước
  khi tick "Có ăn", đều lấy theo `mealServiceActive` thay vì hardcode `true`; mỗi lần bật/tắt "Ăn uống"
  (hoặc cả khối "Yêu cầu hỗ trợ khác") đồng bộ lại "Có ăn" cho MỌI người đang chọn theo giá trị mới —
  vẫn sửa tay được từng người sau đó. Chỉ áp dụng màn Tạo mới; màn Sửa đơn khoá hẳn khối này nên không
  áp dụng (tránh ghi đè `didEat` vừa tải từ đơn cũ).
- **Số phiếu tự tính cũng loại người "Không ăn" (2026-08-06)** — `mealTicketCounts` (`CreateOtFormPage.tsx`)
  trước đây chỉ tính theo giờ OT, không đọc `didEat`, nên người tick "Không ăn" vẫn bị tính vào phiếu
  chính/phụ. Sửa lại: người đủ ngưỡng mà `didEat=false` → **không tính vào phiếu nào cả** (không ăn thì
  không cần suất); người đủ ngưỡng và có ăn → phiếu chính (và giờ OT thực tính của họ bị trừ 30 phút,
  xem đầu mục này);
  người dưới ngưỡng (chưa có ô "Có ăn" để tự khai) → vẫn mặc định phiếu phụ như cũ.

### §Đồng bộ phiếu ăn khi sửa đơn/loại nhân viên (2026-08-18)

**Vấn đề**: quy tắc tự tính `MainTicketCount`/`SecondaryTicketCount` ở trên (mục "Số phiếu tự tính
cũng loại người 'Không ăn'") **chỉ chạy ở FE lúc Tạo đơn**. `ProcessPart` sau đó bị đóng băng — 2 chỗ
làm số liệu lệch thực tế mà không ai cập nhật lại:
1. Sửa đơn trước khi Trưởng phòng duyệt (`OtFormService.UpdateAsync`, đổi `EndTime`/`DidEat` từng
   người) — đổi "Có ăn" của 1 người không kéo theo đổi số phiếu.
2. Cấp duyệt loại người khỏi đơn (`RemoveEmployeeCoreAsync`, `POST /{id}/employees/remove`) — người bị
   loại vẫn còn bị tính trong `MainTicketCount`/`SecondaryTicketCount` dù đã không còn tăng ca nữa.

**Sửa**: thêm `OtFormService.CalculateMealTicketCounts` (hàm thuần, mirror đúng quy tắc FE ở
`CreateOtFormPage.tsx`: OT thực tế — CHƯA cộng bù 0.5h — `>= MainMealTicketMinHours` + `DidEat=true` →
+1 phiếu chính; `>= ngưỡng` + `DidEat=false` → không tính; `< ngưỡng` → luôn +1 phiếu phụ) và
`RecalculateMealTicketCountsAsync` (ghi kết quả vào `ProcessPart.MainTicketCount`/`SecondaryTicketCount`
của đúng đơn đó — no-op nếu đơn chưa từng có `ProcessPart`, tức chưa từng bật "Ăn uống" lúc tạo).
Gọi lại hàm này ở **CHÍNH XÁC 2 nơi** liệt kê ở trên, sau khi danh sách nhân viên active/`DidEat` đã
cập nhật xong nhưng trước `SaveChangesAsync()`. `MilkCount` không đụng tới — vẫn 100% nhập tay, không
có cách nào tự suy luận số sữa từ danh sách nhân viên. (mirror `Asset.Domain.Entities.AssetSetting` — bảng cấu hình 1 dòng, xem
`asset-module.md`):
- Entity mới `AttendanceSetting { Id, MainMealTicketMinHours:decimal(5,2), MonthlyOtHourLimit:decimal(10,2), YearlyOtHourLimit:decimal(10,2) }`
  — bảng `AttendanceSettings` LUÔN đúng 1 dòng (migration `AddAttendanceSetting` seed sẵn
  `(2.5, 25, 300)`), không có `IsDeleted`.
- `IAttendanceSettingRepository`/`AttendanceSettingRepository` theo đúng khuôn `GenericRepository`,
  thêm `AttendanceSettings` vào `IAttendanceUnitOfWork`/`AttendanceUnitOfWork`.
- `AttendanceSettingService.GetOrCreateSettingEntityAsync()` — tự tạo lại dòng mặc định
  (`DefaultMainMealTicketMinHours = 2.5m`, `DefaultMonthlyOtHourLimit = 25m`,
  `DefaultYearlyOtHourLimit = 300m`, đúng bằng giá trị seed migration) nếu dòng cấu hình bị xoá tay dưới
  DB — tránh sập cả API lẫn màn Tạo đơn chỉ vì thiếu cấu hình.
- `AttendanceSettingController`:
  - `GET /api/AttendanceSetting` **KHÔNG gắn `[RequirePermission]`** — cố tình mở cho MỌI tài khoản đăng
    nhập (kể cả Role "Nhân viên"), vì màn Tạo đơn của họ cần đọc cấu hình để tự tính phiếu ăn/tô đỏ lũy
    kế, dù họ không có permission quản trị nào.
  - `PUT /api/AttendanceSetting` gắn `Attendance.Setting.Update` — permission mới, migration Identity
    `AddAttendanceSettingPermission`, gán qua subquery theo `Attendance.Department.Create` (chỉ Admin,
    đúng nhóm Role được vào màn "Danh mục" — verify SQL: 1/1 Role = Admin).
- `OtFormService.GetByIdAsync` inject thêm `IAttendanceSettingService`, đọc
  `GetMainMealTicketMinHoursAsync()` thay hằng số `MinHoursForMealTicket = 2m` đã xoá.

**Thiết kế FE**:
- `attendance-setting.dto.ts` + `attendance-setting.api.ts` theo đúng khuôn `huong-dan-viet-api-fe.md`.
- `hooks/useAttendanceSetting.ts` — cache **1 promise dùng chung ở tầng module** (không dùng React
  Query) vì cấu hình này được đọc ở RẤT nhiều màn (Tạo đơn, Chi tiết đơn, danh sách nhân viên, bản in,
  Đơn tổng...) nhưng gần như không đổi — tránh mỗi component tự gọi lại API. `invalidateAttendanceSettingCache()`
  gọi sau khi Admin lưu cấu hình mới để các màn mở sau đó thấy giá trị mới ngay, không cần F5.
  `DEFAULT_ATTENDANCE_SETTING` (khớp seed) dùng làm giá trị tạm trong lúc tải + fallback khi lỗi mạng —
  cố tình KHÔNG toast lỗi vì cấu hình chỉ ảnh hưởng gợi ý hiển thị, không phải luồng nghiệp vụ chính.
- **`CreateOtFormPage.tsx`** — tự tính `mainTicketCount`/`secondaryTicketCount` theo giờ OT thực tế của
  từng nhân viên **đang chọn** (>= ngưỡng → phiếu chính, dưới → phiếu phụ), đồng bộ vào 2 ô nhập ngay
  khi danh sách nhân viên/giờ thay đổi — **NGƯỜI DÙNG VẪN SỬA TAY ĐƯỢC** (đúng yêu cầu "tiện hơn nhưng
  vẫn cho phép chỉnh"): gõ đè 1 trong 2 ô → tắt hẳn chế độ tự tính (`autoMealTicket=false`), hiện nút
  "Tính lại" để quay về số hệ thống gợi ý. Không tự tính ở màn Sửa đơn (khối này đã khoá từ đợt giới
  hạn "chỉ sửa thực tích", xem §Sửa đơn khi đang Draft/Pending).
- **6 file trước đây hardcode `> 25`/`> 300`** đổi sang đọc `setting.monthlyOtHourLimit`/
  `yearlyOtHourLimit`: `EmployeeList.tsx`, `EmployeeAccumulationPanel.tsx`, `CreateOtFormPage.tsx`,
  `OtFormDetail.tsx`, `OtFormPrintView.tsx` (nhận `setting` qua prop vì `EmployeeRowFields` không phải
  page). Riêng `OtFormEmailConfirmPage.tsx` (trang public, không JWT nên không gọi được
  `GET /AttendanceSetting`) **giữ nguyên `DEFAULT_ATTENDANCE_SETTING`** — chấp nhận được vì đây chỉ là
  màu cảnh báo hiển thị, không phải số liệu nghiệp vụ.
- **UI cấu hình**: tab mới "Cấu hình" trong `CategoryManagement.tsx` (`/ot/categories`, màn vốn đã khoá
  sau permission `Attendance.Department.Create` nên không cần tự kiểm tra quyền lần nữa) —
  `AttendanceSettingPanel.tsx`, 2 khối "Phiếu ăn" + "Giới hạn lũy kế", nút "Lưu cấu hình" gọi PUT rồi
  `invalidateAttendanceSettingCache()`. Tab này không có bảng/nút "Thêm mới" nên `CategoryManagement.tsx`
  ẩn nút đó khi `addLabel == null`.

### §Phiếu ăn — REDESIGN 3 bậc + khung OT sớm đặc cách (2026-08-26)

**Thay thế hoàn toàn** mô hình 2 bậc (Chính/Phụ, không sàn dưới) mô tả ở §Cấu hình phiếu ăn & giới hạn
lũy kế và §Có ăn hay không phía trên — chốt qua nhiều vòng trao đổi với người dùng (CLAUDE.md §2 luật
2), dựa trên `docs/Note_OT.txt`:

- **3 bậc, tính trên giờ THỰC TÍCH** (`actualHours`, sau khi trừ `MealBreakDeductionHours` nếu có ăn —
  KHÔNG còn tính trên giờ thô như bản cũ):
  - `actualHours < NoMealTicketMaxHours` (mặc định **2h**) → **KHÔNG có phiếu ăn nào** (đảo ngược quyết
    định "không có sàn dưới" ngày 2026-08-01).
  - `NoMealTicketMaxHours <= actualHours < MainMealTicketMinHours` (mặc định **3.5h**, đổi từ tính trên
    giờ thô sang thực tích) → **phiếu Phụ**.
  - `actualHours >= MainMealTicketMinHours` → **phiếu Chính**.
- **Ngoại lệ khung OT sớm** (`EarlyMealWindowStartTime`/`EarlyMealWindowEndTime`, mặc định **6h–8h**):
  ca OT có `StartTime`/`EndTime` khớp **ĐÚNG** khung này (không phải chỉ overlap — vd ca 6h30-8h **không**
  tính) luôn nhận **phiếu Phụ** và **KHÔNG** trừ `MealBreakDeductionHours`, bất kể `DidEat` là gì. Ví dụ
  chốt với người dùng: OT 6h-8h (2h) → phiếu Phụ, lũy kế ghi nhận đủ **2h** (không phải 1.5h như công
  thức thường).
- **`DidEat` vẫn giữ nguyên vai trò gate việc trừ giờ** (per-employee, KHÔNG đổi thành trừ vô điều kiện
  theo khung giờ như bản nháp đầu của `Note_OT.txt`) — lý do: 1 đơn có thể có người ăn người không ăn
  cùng lúc, mỗi người đã có field `DidEat` riêng từ 2026-08-06. `DidEat` vẫn có tác dụng ở MỌI mức giờ
  (không chỉ khi đủ phiếu Chính) — khác bản cũ chỉ ảnh hưởng khi đủ ngưỡng.
- **Cấu hình mở rộng** (`AttendanceSetting`, cả 4 field mới đều sửa được qua `PUT /api/AttendanceSetting`,
  `AttendanceSettingPanel.tsx`): `NoMealTicketMaxHours:decimal(5,2)` (default 2),
  `MealBreakDeductionHours:decimal(5,2)` (default 0.5, trước đây hardcode hằng số `0.5m`),
  `EarlyMealWindowStartTime`/`EarlyMealWindowEndTime:TimeOnly` (default 06:00/08:00). Migration
  `RedesignMealTicketRules` backfill 4 cột mới bằng default, và **UPDATE** dòng cấu hình live đang có
  `MainMealTicketMinHours=2` (mốc cũ) sang **3.5** (mốc mới) — bắt buộc vì đổi Ý NGHĨA field, không chỉ
  thêm cột.
- **Nguồn chân lý DUY NHẤT**: `OtFormService.CalculateOtHours`/`CalculateMealTicketType` (mới, enum
  `Attendance.Domain.Enums.MealTicketType: None=0/Secondary=1/Main=2`) — `CalculateMealTicketCounts`
  (tổng Chính/Phụ ghi vào `ProcessPart`) giờ gọi lại `CalculateMealTicketType` thay vì tự lặp lại
  ngưỡng, tránh 2 nơi tính lệch nhau. Mirror độc lập ở `EmployeeService.CalculateProjectedHours` (Dự
  kiến) và FE `modules/attendance/lib/mealTicket.ts` (preview lúc `CreateOtFormPage.tsx` đang tạo đơn,
  trước khi `OtFormEmployee` tồn tại để BE tính).
- **`OtFormEmployeeDto.IsEligibleForMeal` (bool) bị XOÁ HẲN**, thay bằng
  `MealTicketType: int` (0/1/2, mirror enum BE) — hiển thị badge "Loại phiếu ăn" (Chính/Phụ/Không có
  phiếu) per-employee ở `OtFormDetail.tsx`/`OtFormBatchDetail.tsx`/`OtFormEmailConfirmPage.tsx`
  (component dùng chung `MealTicketTypeBadge.tsx`) — đúng yêu cầu người dùng "cần note trong đơn ai
  được ăn loại phiếu nào". Cột "Có ăn?" (badge dựa theo `DidEat`) không còn bị ẩn theo ngưỡng nữa — LUÔN
  hiện vì `DidEat` giờ có ý nghĩa ở mọi mức giờ.
- **`CreateOtFormPage.tsx`** (màn Tạo/Sửa đơn) — khác mô tả cũ ở §Có ăn hay không ("không đổi"), bản
  redesign này CÓ đổi: cả 3 bảng chọn nhân viên (Sửa đơn/Theo chuyền/Theo Nhóm) đều thêm cột "Loại
  phiếu ăn" (preview qua `computeMealTicketType`), và checkbox "Có ăn" bị khoá + đổi thành nhãn "Khung
  sớm — luôn phiếu Phụ" khi ca khớp đúng khung OT sớm (`isEarlyMealWindowOt`).

### §Giới hạn giờ OT ngày/tháng/năm — CHẶN CỨNG tạo/sửa đơn (2026-08-26)

**Đảo ngược hoàn toàn** hành vi cũ ở §Cấu hình phiếu ăn & giới hạn lũy kế phía trên (Monthly/YearlyOtHourLimit
trước đây chỉ tô đỏ cảnh báo, KHÔNG chặn) — chốt qua trao đổi với người dùng (CLAUDE.md §2 luật 2), dựa
trên `docs/Note_OT.txt` dòng "Ngày: không tăng ca quá 4 tiếng":

- **3 mốc `AttendanceSetting`**: `DailyOtHourLimit` (mới, mặc định **4h**), `MonthlyOtHourLimit` (mặc
  định 25h), `YearlyOtHourLimit` (mặc định 300h) — Admin sửa cả 3 qua `PUT /api/AttendanceSetting`
  (`AttendanceSettingPanel.tsx`).
- **CHẶN CỨNG, không tự động loại nhân viên**: vượt BẤT KỲ mốc nào (sau khi cộng thêm giờ OT thực tích
  của chính đơn đang tạo/sửa) → `OtFormService.ValidateOtHourLimitsAsync` ném `DomainException` liệt kê
  đủ mã nhân viên + mốc bị vượt, từ chối cả yêu cầu tạo/sửa — người tạo/sửa đơn phải tự bỏ chọn nhân
  viên đó (Tạo đơn) hoặc giảm giờ/dùng "Loại khỏi đơn" (Sửa đơn) rồi thao tác lại. Áp dụng cho CẢ 2
  luồng tạo đơn (theo Nhóm `CreateAsync` lẫn theo chuyền `CreateProductionFormAsync`, dùng chung
  `FinalizeCreateAsync`) và `UpdateAsync` (sửa giờ kết thúc trước khi có bước duyệt nào được xử lý).
- **"Ngày" cộng dồn theo NHÂN VIÊN**, không phải theo ca: tổng tất cả giờ OT thực tích của 1 nhân viên
  trong đúng 1 ngày, kể cả từ nhiều đơn/nhiều ca khác nhau trong ngày đó (chốt qua AskUserQuestion —
  "Tổng theo ngày/nhân viên", không phải kiểm từng ca đơn lẻ).
  "Trước"/"sau" tính bằng `OtFormService.ComputeAccumulatedHoursBatchAsync` (đổi tên + mở rộng từ
  `ComputeProjectedHoursBatchAsync` cũ, thêm chiều Ngày + tham số `excludeFormId` để `UpdateAsync` không
  tự cộng dồn ngược với chính các dòng `OtFormEmployee` hiện có của đơn đang sửa) — nguồn dữ liệu và
  filter (`!IsRemoved && Status != Rejected && !IsDeleted`) giữ nguyên như tính Dự kiến ở §Lũy kế dự
  kiến bên dưới, chỉ thêm 1 chiều tổng hợp mới.
- **FE cảnh báo SỚM** (trước khi submit, không thay cho validate BE): `EmployeeDto.ProjectedDayToDate`
  (mới, song song `ProjectedMonthToDate`/`ProjectedYearToDate` đã có — chỉ `GetByGroupIdAsync` trả có ý
  nghĩa) — `CreateOtFormPage.tsx` tô đỏ badge khi vượt bất kỳ mốc nào trong 3 mốc. BE luôn là nguồn chặn
  thật; lỗi 400 hiện qua toast (`getApiErrorMessage`, không cần code thêm ở FE vì pattern catch/toast đã
  có sẵn).
- **Bảng "Theo chuyền" cũng có cảnh báo SỚM** (thêm cùng đợt 2026-08-26 — trước đó bảng này KHÔNG có
  cột lũy kế nào, khác bảng "Theo Nhóm" đã có từ 2026-08-06, là thiếu sót đã sửa): mirror y hệt cơ chế
  trên sang `ProductionEmployeeSearchItemDto.ProjectedDayToDate`/`ProjectedMonthToDate`/
  `ProjectedYearToDate` + `ProductionEmployeeService.SearchAsync` (tham số mới `targetDate`, tự chứa
  `CalculateProjectedHours` riêng — không gọi chéo sang `EmployeeService`, đúng quy ước mirror đã có).
  `GET /api/ProductionEmployee/search` thêm query param `date` (optional, mặc định hôm nay thực tế nếu
  bỏ trống) — FE `CreateOtFormPage.tsx` luôn truyền `date` = ngày trên đơn đang tạo, đổi ngày tự gọi
  lại API (cùng cơ chế `useFetchEffect` deps đã có cho `productionResults`).
- **Không retroactive**: đổi cấu hình chỉ ảnh hưởng đơn tạo/sửa SAU đó — không re-validate đơn đã tạo
  trước đó (kể cả đơn đang `InApproval` chưa ai duyệt) khi Admin đổi giới hạn.

### §Giới hạn OT/tháng/năm RIÊNG theo từng nhân viên — "gia hạn" cao hơn mặc định (2026-08-26)

**Yêu cầu người dùng** (chốt qua trao đổi, CLAUDE.md §2 luật 2), dựa trên `docs/Note_OT.txt` dòng
"Import lại số giờ giới hạn tăng ca của nhân viên": nhân viên có thể được "gia hạn" giờ OT cao hơn mức
mặc định chung ở trên — thường dùng cho công nhân **dưới chuyền**.

- **Chỉ Tháng + Năm được override riêng** (đã chốt — KHÔNG có Ngày riêng, Ngày luôn dùng chung đúng 1
  mốc `AttendanceSetting.DailyOtHourLimit` cho MỌI nhân viên, không ai được gia hạn riêng mốc Ngày).
- **Entity**: `Employee.CustomMonthlyOtHourLimit`/`CustomYearlyOtHourLimit` (`decimal?`, nullable) —
  `null` = dùng mặc định chung (`AttendanceSetting.MonthlyOtHourLimit`/`YearlyOtHourLimit`), có giá trị
  = dùng thẳng mốc đó cho riêng người này (thường CAO hơn mặc định, nhưng không bắt buộc). **Không có
  thời hạn hiệu lực** (chốt: "hiện không có thời hạn nên lưu trực tiếp luôn") — set thẳng, còn hiệu lực
  tới khi Admin đổi/xoá tay, không phải bảng lịch sử/effective-dated.
- **Sửa qua `EmployeeForm.tsx`** (2 field số optional, "để trống = dùng mặc định hệ thống") — chốt
  "cần được sửa thường xuyên" nên đi thẳng qua màn Sửa nhân viên hiện có, KHÔNG qua import Excel riêng.
  (Import hàng loạt số giờ giới hạn riêng — "quyết định sau" — VẪN CHƯA làm; khác với import Nhân sự
  dưới chuyền ở §Import nhân sự dưới chuyền bên dưới, vốn KHÔNG đụng tới 2 field này.)
- **`OtFormService.ValidateOtHourLimitsAsync`** (§Giới hạn giờ OT ngày/tháng/năm ở trên) đọc
  `Employee.CustomMonthlyOtHourLimit ?? AttendanceSetting.MonthlyOtHourLimit` (tương tự Năm) cho từng
  người trong đơn — Ngày luôn dùng thẳng `AttendanceSetting.DailyOtHourLimit`, không tra theo nhân viên.
- **Message đổi theo đúng mẫu người dùng yêu cầu**: `"Nhân viên mã {code} quá giới hạn OT {ngày/tháng/
  năm} ({sau}h > {mốc}h)"` — thay cho câu gộp `'{code}' (vượt ...)"` trước đó. FE
  (`CreateOtFormPage.tsx`, hàm `buildOtLimitWarning`) mirror ĐÚNG câu chữ này để hiện ngay tại badge
  lũy kế trong bảng chọn nhân viên khi tạo đơn (thay số giờ bằng câu cảnh báo khi vượt mốc), khớp yêu
  cầu "hiển thị ở phần nhân viên trong đơn khi tạo đơn" — cả 3 bảng (Sửa đơn/Theo chuyền/Theo Nhóm) đều
  áp dụng, riêng bảng Sửa đơn không có dữ liệu "Dự kiến theo ngày" (chỉ lũy kế THẬT tháng/năm) nên chỉ
  cảnh báo được tháng/năm, không cảnh báo ngày ở bảng đó (BE vẫn luôn chặn đủ cả 3 mốc lúc submit).
- **Contract mở rộng theo cùng field**: `EmployeeDto`/`OtFormEmployeeDto`/`ProductionEmployeeSearchItemDto`
  đều thêm `customMonthlyOtHourLimit`/`customYearlyOtHourLimit` (`decimal?`) — xem
  `attendance-api-fe.md` §3.5/§4.3.

### §Import/Export nhân sự dưới chuyền (`ProductionEmployee`) theo file mẫu Chế Tạo (2026-08-27)

**Yêu cầu người dùng** (chốt qua nhiều vòng trao đổi, CLAUDE.md §2 luật 2), dựa trên format thật
`docs/Data/Import_Nhan_Su_Che_Tao.xlsx` (sheet `OT(N+1)`) — trước đợt này, 1688 dòng `ProductionEmployees`
hiện có trong DB là nạp TAY 1 lần (không qua UI), đúng luật "phải resolve đủ Line/Team/ShiftTeam mới
nạp" đã ghi sẵn trong comment `ProductionEmployee.cs`. Đợt này biến luật đó thành 1 tính năng Preview →
Confirm dùng lại được mỗi tháng, cộng thêm vài thay đổi nghiệp vụ mới:

- **Cột file → field**: `MNV`→`EmployeeCode`, `BOPHAN`→`CongDoan` (raw, không FK), `HO`/`TEN`→
  `Employee.LastName`/`FirstName` (đã tách sẵn, không cần suy như `EmployeeImportService`), `CÔNG VIỆC`→
  `TaskName`, `BLOCK`→ resolve `ProductionLineId` (khớp `LineCode`), `GROUP`→ dịch A→"1"/B→"2"/HC→"HC"
  (còn lại khớp trực tiếp) rồi resolve `TeamId`, `NHOM`→ resolve `ShiftTeamId` (khớp `Code` trực tiếp),
  `LEADER`→ `IsLeader`. Cột `KHOI SU` (mã Line thật khi `BLOCK="LC-A"`) và `OT month`/`OT year` **KHÔNG**
  ảnh hưởng cấu trúc — xem 2 mục riêng bên dưới. Cột "1"/"2"/rác/`#REF!` bỏ qua hoàn toàn.
- **Line/Team/ShiftTeam không khớp được → SKIP dòng đó, KHÔNG tự tạo mới** — dữ liệu Line/Team trong
  file mẫu người dùng đưa "có thể đang có sai sót, không cần quan tâm" (chốt rõ, đảo ngược so với đề
  xuất ban đầu của tôi là tự tạo Line mới khi gặp mã lạ).
  - **Ngoại lệ**: mã nhân viên (`MNV`) KHÔNG BẮT BUỘC đã có `Employee` sẵn nữa — khác hẳn luật cũ
    (`EmployeeId` từng là 1 trong 4 khoá bắt buộc resolve). Người chưa có `Employee` được **TỰ TẠO**,
    gán `GroupId` vào Group **"Chưa phân loại (nhập từ file chuyền)"** (mã `KHAC`) dưới Phòng ban
    **Chế Tạo** (mã `CT`, đã có sẵn) — tự tạo Group này ở lần Confirm đầu tiên cần tới, tái dùng sau đó.
    Lý do: file này không cho đủ dữ liệu Nhóm thật (146 Group chi tiết hiện có kiểu "LINE A01 - GREEN
    GT" không suy ra được từ BOPHAN/BLOCK/GROUP trong file).
  - Nhân viên ĐÃ tồn tại: import **KHÔNG** đụng `FirstName`/`LastName` của họ (chỉ set khi tạo mới) —
    tránh ghi đè tên đã chỉnh đúng dấu/hoa-thường bằng bản HO/TEN thô từ file.
- **Người không còn xuất hiện trong file mới → soft-delete `ProductionEmployee`** (dòng lỗi vẫn tính là
  "còn nhắc tới", không bị gỡ — chỉ dòng nào vắng mặt HOÀN TOÀN mới bị gỡ). Preview liệt kê rõ danh
  sách sẽ bị gỡ trước khi Confirm.
- **Bản xem trước (Preview) phải cho thấy đủ**: dòng lỗi (kèm lý do), người sẽ tạo mới (Employee lẫn
  `ProductionEmployee`), người sẽ cập nhật (kèm cờ đã đổi field gì), người sẽ bị gỡ — chốt rõ theo yêu
  cầu người dùng "cần có bản xem trước như có gì bị xóa, dòng nào được cập nhật, có gì được tạo thêm".
- **Cột `OT month`/`OT year` — TÁCH THÀNH BƯỚC RIÊNG, không nằm trong Confirm cấu trúc**:
  - Chỉ `OT month` được dùng để ghi lũy kế; `OT year` CHỈ hiển thị tham khảo, KHÔNG ghi gì (hệ thống
    mới chưa có đủ lịch sử các tháng cũ trước khi entity `EmployeeAccumulationHistory` ra đời để đối
    chiếu chuẩn xác — nạp lịch sử cũ từ hệ thống khác là việc RIÊNG, chưa làm ở đợt này).
  - Admin **chọn tay Year/Month áp dụng** (không tự suy theo ngày hôm nay — sheet tên "OT(N+1)" gợi ý
    số liệu có thể là dự kiến tháng kế tiếp, không phải tháng hiện tại).
  - **Cách ghi (phương án B đã chốt)**: KHÔNG ghi đè `TotalHours`. Vì `EmployeeAccumulationHistories`
    có unique index `(EmployeeId, Year, Month)` nên không tách được 1 dòng riêng cho phần điều chỉnh —
    tính `delta = OT month trong file − TotalHours hệ thống đang có cho đúng (Employee, Year, Month)`,
    cộng thẳng `delta` vào dòng đó (có thể âm), rồi APPEND ghi chú vào `EmployeeAccumulationHistory.Note`
    (cột mới, `nvarchar(1000)`, migration `AddNoteToEmployeeAccumulationHistory`) để giữ vết đây là
    điều chỉnh từ import, không phải từ `OtForm` hoàn tất bình thường.
  - **Quyền TÁCH RIÊNG**: `Attendance.EmployeeAccumulation.Import` (khác `Attendance.ProductionEmployee.Import`
    dùng cho phần cấu trúc) — vì đụng lũy kế OT ảnh hưởng lương, chỉ người có trách nhiệm mới bấm được.
    Nút "Áp dụng lũy kế" ở FE chỉ hiện nếu user có quyền này (`ProductionEmployeeImportDialog.tsx`).
- **BE**: `ProductionEmployeeImportService` (`PreviewAsync`/`ConfirmAsync`/`ApplyAccumulationAsync`),
  `ProductionEmployeeImportController` (`POST /api/ProductionEmployeeImport/preview|confirm|apply-accumulation`).
- **Export** (`ProductionEmployeeExportService`/`ProductionEmployeeExportController`,
  `GET /api/ProductionEmployeeExport/export`, quyền `Attendance.ProductionEmployee.Export`): xuất lại
  toàn bộ `ProductionEmployee` hiện có **ĐÚNG VỊ TRÍ CỘT A..O của file mẫu** (A=`KHOI SU` để trống —
  hệ thống không lưu cột này, B=`MNV`...K=`GROUP`, L/M/N để trống, O=`LEADER` — khớp hệt vị trí cột mà
  `ProductionEmployeeImportService.ParseXlsx` đọc, 2026-08-27, theo yêu cầu người dùng "xuất theo đúng
  format file mẫu" — để file xuất ra dùng lại được ngay làm file Import tháng sau), **1 sheet / Phòng
  ban THẬT của hệ thống** (`Employee.Group.Department` — KHÁC cột `BOPHAN` trong file gốc, cột đó
  không gắn gì với Department thật). Cột `OT month`/`OT year` lấy **SỐNG** từ
  `EmployeeAccumulationHistory` tại thời điểm xuất (không phải số tĩnh đã nhập).
- **Màn "Nhân viên dưới chuyền"** (view riêng, chỉ hiển thị — 2026-08-27, theo yêu cầu người dùng
  "cần có phần chuyển sang giao diện nhân viên dưới chuyền"): `ProductionEmployeeList.tsx`, toggle
  bằng 2 nút dạng segment ("Nhân viên" / "Nhân viên dưới chuyền") ở đầu `EmployeeList.tsx`, đọc thẳng
  bảng `ProductionEmployees` (khác bảng `Employees` của view "Nhân viên") qua
  `GET /api/ProductionEmployee/page-nation` (`ProductionEmployeeService.GetPagedAsync`, dùng chung
  quyền `Attendance.Employee.View` — chỉ là 1 view khác của cùng dữ liệu nhân sự, không cần permission
  riêng). Lọc theo Line(BLOCK)/Team(GROUP)/Nhóm ca(NHOM) tái dùng 3 API option đã có sẵn cho màn "Theo
  chuyền" khi tạo đơn OT. Nguồn chính dữ liệu CẤU TRÚC (Line/Team/Nhóm ca/Trưởng nhóm) vẫn là Import
  Excel (nạp lại đè hết mỗi tháng theo `EmployeeCode`) — 2 mục bổ sung bên dưới chỉ để sửa nhanh giữa 2
  đợt import, KHÔNG thay thế import.
  **+2026-09-04a**: lũy kế thao tác được trực tiếp trên từng dòng — cột "Thao tác" thêm 2 icon button
  tái dùng nguyên xi `AccumulationHistoryModal`/`EmployeeOtLimitDialog` đã có ở view "Nhân viên" (cùng
  permission `Attendance.Employee.UpdateOtLimit` cho nút Giới hạn OT, nút Lịch sử không gate riêng — BE
  tự scope qua `EnsureInAccumulationScopeAsync`). Cả 2 thao tác trên `Employee` gốc qua
  `ProductionEmployeeListItemDto.EmployeeId` (ẩn nút nếu `null`), KHÔNG đụng bảng `ProductionEmployees`.
  Dialog Giới hạn OT cần `EmployeeDto` đầy đủ (họ/tên tách riêng, giới hạn hiện tại) không có sẵn trong
  `ProductionEmployeeListItemDto` → gọi thêm `GET /api/Employee/{id}` đúng lúc bấm nút, không tải trước
  cho cả danh sách. Đồng thời bổ sung mục "Áp dụng lũy kế OT theo tháng" vào menu Excel của view "Nhân
  viên" (trước đó chỉ có ở view "Nhân viên dưới chuyền" dù BE đã tổng quát cho mọi Phòng ban — thiếu sót
  phát hiện khi người dùng hỏi lại).
  **+2026-09-04b**: sửa tay Team/Line/Nhóm ca/Trưởng nhóm ngay trên UI (theo yêu cầu người dùng "cho
  thêm chức năng chỉnh sửa... team line ca các kiểu nữa rồi có phải leader line hay không") — nút Sửa
  (icon `Pencil`) mở `ProductionEmployeeEditDialog.tsx` (3 dropdown cascading Team→Line→Nhóm ca mirror
  đúng bộ lọc phía trên + checkbox "Là Trưởng nhóm"). BE: `PUT /api/ProductionEmployee/{id}`
  (`UpdateProductionEmployeeDto { ProductionLineId?, TeamId?, ShiftTeamId?, IsLeader }`,
  `ProductionEmployeeService.UpdateAsync`) — LUÔN ghi lại cả cặp Id+Code từ đúng entity đang chọn (tra
  `ProductionLine.LineCode`/`ProductionTeam.Code`/`ProductionShiftTeam.Code`), không nhận Code tay từ
  FE, để BlockCode/TeamCode/ShiftTeamCode không bao giờ lệch khỏi FK. Permission mới, RIÊNG với Import
  (migration `AddProductionEmployeeUpdatePermission`, gán theo Role đang giữ
  `Attendance.ProductionEmployee.Import`): `Attendance.ProductionEmployee.Update`.
  `ProductionEmployeeListItemDto` thêm `ProductionLineId`/`TeamId`/`ShiftTeamId` (trước đó chỉ có Code)
  để FE chọn sẵn đúng giá trị hiện tại khi mở dialog.
  **Quan trọng — IsLeader ảnh hưởng LUỒNG DUYỆT thật**: `ProductionEmployee.IsLeader` là nguồn xác định
  Line Leader của 1 Line cho `JobTitleApprovalChainService` (candidate duyệt đơn "theo chuyền", xem
  §Cây duyệt Chuyền) — đọc SỐNG lúc resolve chuỗi duyệt, không cache ở đâu khác nên sửa có hiệu lực
  ngay, không cần đăng nhập lại hay sync gì thêm. **Cảnh báo UX**: dữ liệu sửa tay ở đây sẽ bị GHI ĐÈ
  lại đúng theo file ở lần Import Excel kế tiếp (đã có hint trong dialog) — chỉ dùng để sửa tạm/gấp,
  không thay thế việc chỉnh sửa file gốc trước khi import tháng sau.
  **Chưa test tay qua UI thật** cả 3 điểm bổ sung (2026-09-04a/b) — mới build/`tsc`/lint sạch.
- **FE**: `ProductionEmployeeImportDialog.tsx` (mirror `EmployeeImportDialog.tsx`, thêm khối "Áp dụng
  lũy kế" hiện sau khi Confirm cấu trúc xong). Bản xem trước (Preview) tách thành **6 tab** (Tất cả/
  Mới/Cập nhật/Không đổi/Lỗi/Bị gỡ, mỗi tab có số đếm) thay vì 1 bảng dài duy nhất (2026-08-27, theo
  yêu cầu người dùng) — lọc lại từ CÙNG mảng `rows`/`removedRows` đã có sẵn cờ
  `isNew*`/`isUpdated*`/`isValid`, không gọi lại BE. Nút Import/Export nhân sự dưới chuyền gom vào 1
  dropdown "Excel" (`ActionMenu.tsx`, `components/ui/`) hiện trong toolbar của view "Nhân viên dưới
  chuyền" — tách khỏi nút "Import Excel" (nhân viên chuẩn) vẫn nằm ở toolbar view "Nhân viên", giảm số
  nút dồn chung 1 hàng như bản đầu (2026-08-27, theo yêu cầu người dùng "bớt chữ đi một xíu").
- **Permission mới** (migration Identity `AddProductionEmployeeImportPermissions`, gán theo Role đang
  giữ `Attendance.Employee.Create`): `Attendance.ProductionEmployee.Import`,
  `Attendance.ProductionEmployee.Export`, `Attendance.EmployeeAccumulation.Import`.

### §Lũy kế dự kiến — cảnh báo cả những đơn khác đang chờ duyệt (2026-08-06, REDESIGN 2026-08-19)

**Vấn đề người dùng nêu**: `MonthToDate`/`YearToDate` chỉ cộng khi đơn đạt `Completed` (xem §Lũy kế
tháng/năm) — nên nếu nhân viên A đang có đơn #1 (ngày 3) chờ duyệt, lúc lập đơn #2 cho cùng A, mọi
màn cảnh báo hạn mức đều so với lũy kế CHƯA cộng đơn #1 → không cảnh báo, dù cả 2 đơn cộng lại đã
vượt hạn mức. Bản chất: hệ thống "mù" trước các đơn khác đang treo.

> Bản 2026-08-06 (lưu `Employee.ProjectedMonthToDate`/`YearToDate` + mốc rollover riêng, cộng/trừ dần
> qua `ApplyProjectedRollover`/`ApplyProjectedDelta`/`ReverseProjectedAccumulationAsync`) đã **THAY THẾ
> HOÀN TOÀN** — xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc bên dưới. 4 cột đó đã bị **xoá khỏi
> `Employees`** cùng đợt với `MonthToDate`/`YearToDate` thật (`RemoveEmployeeAccumulationColumns`).

**Thiết kế mới**: không lưu ở đâu cả — tính trực tiếp từ `OtFormEmployee`/`OtForm` mỗi lần cần, dùng
CHUNG công thức `OtFormService.CalculateOtHours` với lũy kế thật. Điều kiện "đơn còn tính vào Dự kiến":
`!IsRemoved && OtForm.Status != Rejected && !OtForm.IsDeleted` (Completed VẪN tính — khác lũy kế thật,
Dự kiến là "tổng mọi đơn hợp lệ đang/đã claim giờ của người này", không chỉ đơn đã xong).

- **Khác biệt quan trọng với lũy kế thật**: lũy kế thật luôn scope theo **năm/tháng THỰC TẾ hôm nay**;
  Dự kiến scope theo **`targetDate`** truyền vào — CHỖ DUY NHẤT đang dùng Dự kiến (bảng chọn nhân viên
  ở màn Tạo đơn) truyền `targetDate = Date` của chính đơn đang tạo, KHÔNG phải hôm nay thực tế — để
  đúng ý nghĩa "nếu thêm người này vào đơn đang tạo (dù đơn đó cho tháng nào), họ có vượt hạn mức của
  đúng tháng đó không". Đang tạo đơn cho ngày 1/8 dù hôm nay 27/7 vẫn phải thấy Dự kiến của tháng 8.
- **`OtFormService.ComputeProjectedHoursBatchAsync(employeeIds, targetDate, mainMealTicketMinHours)`**
  — hàm duy nhất tính Dự kiến ở BE, nhận CẢ DANH SÁCH `employeeId` fetch 1 lượt (mirror batch-fetch
  ledger đã có ở `AccumulateEmployeeHoursAsync` — tránh N+1 khi đơn có nhiều người, 2026-08-19b), dùng
  trong `CreateAsync` để chụp snapshot vào `OtFormEmployee.MonthToDate`/`YearToDate` (giá trị "đã có bao
  nhiêu Dự kiến của đúng tháng đơn này, TRƯỚC khi cộng chính đơn này" — query chạy trước khi `AddAsync`
  đơn mới nên tự nhiên không tự đếm chính nó).
- **`EmployeeService.GetByGroupIdAsync(groupId, targetDate?)`** — nguồn duy nhất trả `EmployeeDto.
  ProjectedMonthToDate/YearToDate` có ý nghĩa (mặc định `targetDate` = hôm nay thực tế nếu bỏ trống);
  mọi hàm `EmployeeDto` khác (`GetPagedAsync`, `GetByIdAsync`...) để 2 field này mặc định `0`, không
  dùng tới. Query bằng cách fetch thẳng `OtFormEmployee` (không dịch qua EF LINQ subquery như lũy kế
  thật, vì công thức có `TimeOnly` trừ + điều kiện — an toàn hơn khi tính tay trong C#), gom theo
  `EmployeeId` rồi tính `CalculateProjectedHours` (mirror `CalculateOtHours`, viết lại trong
  `EmployeeService` vì không gọi chéo sang `OtFormService`).
- **`GET /Employee/by-group/{groupId}?date=YYYY-MM-DD`** — FE (`CreateOtFormPage.tsx`) truyền `date`
  state hiện tại (ngày trên đơn đang tạo) mỗi lần gọi, và gọi lại effect khi `date` đổi để badge luôn
  đúng tháng đang chọn.
- Không còn cần bất kỳ điểm "cộng/trừ" nào ở `CreateAsync`/`UpdateAsync`(sửa thực tích)/`RejectAsync`/
  `DeleteAsync`/`RemoveEmployeeCoreAsync` nữa — chỉ `CreateAsync` còn gọi `ComputeProjectedHoursBatchAsync`
  (để lấy snapshot), các nơi còn lại không đụng gì tới Dự kiến cả vì không còn state nào để cập nhật.
- Xem hợp đồng field chi tiết ở [attendance-api-fe.md §3.5b](attendance-api-fe.md).

### §Lũy kế — bỏ cache trên Employee, tính lúc đọc (2026-08-19)

**Bug phát hiện được** (trace qua kịch bản người dùng nêu): rollover cũ so `OtForm.Date` với
`Employee.AccumulationYear/Month` (mốc "kỳ của lần xử lý gần nhất") — nếu 1 đơn ngày TƯƠNG LAI được xử
lý xong TRƯỚC 1 đơn ngày gần hơn (VD tạo/duyệt đơn 1/8 trước, rồi mới xử lý đơn 29/7 trong khi hôm nay
vẫn là 27/7), mốc rollover bị đẩy sang tháng 8 rồi lại kéo về tháng 7 — `MonthToDate` bị **reset mất**
giá trị hợp lệ của lần trước thay vì cộng dồn đúng. Gốc rễ: mốc rollover dựa theo **ngày trên đơn được
xử lý gần nhất**, không phải **ngày thực tế hôm nay**.

**Yêu cầu chốt lại** (CLAUDE.md §2 luật 2): (1) 1 đơn ghi ngày tương lai, dù được duyệt xong sớm, chỉ
được cộng vào lũy kế THẬT khi lịch thực tế đã tới đúng tháng đó — "chỉ là họ đăng ký trước thôi"; (2)
Dự kiến áp dụng luật y hệt; (3) sau khi thấy tính năng "Admin chỉnh tay `MonthToDate`/`YearToDate`"
(§Lũy kế tháng/năm bản cũ) không thể tồn tại song song với ledger mà không mất tính nhất quán (chỉnh
tay không ghi lại vào ledger → tra cứu lịch sử tháng đó vẫn ra số CHƯA sửa, còn "hiện tại" thì ra số
ĐÃ sửa — lệch nhau), và lý do gốc của tính năng đó (nhập liệu lũy kế cũ khi ledger chưa tồn tại) không
còn áp dụng sau đợt reset dữ liệu demo (§DB), người dùng chốt **bỏ hẳn** tính năng chỉnh tay.

**Kết quả**: cả lũy kế THẬT lẫn DỰ KIẾN đều **không còn lưu trạng thái nào trên `Employee`** — bảng
`Employees` không còn cột lũy kế nào cả (8 cột `MonthToDate`/`YearToDate`/`AccumulationYear`/
`AccumulationMonth`/`Projected*4` bị xoá, migration `RemoveEmployeeAccumulationColumns`). Nguồn chân
lý duy nhất còn lại: `EmployeeAccumulationHistory` (ledger, cho lũy kế THẬT — xem §Lũy kế tháng/năm) và
`OtFormEmployee`/`OtForm` (cho lũy kế DỰ KIẾN — xem §Lũy kế dự kiến), cả 2 đều tính trực tiếp lúc đọc,
không cache. Hệ quả tích cực: hết luôn bug thứ tự xử lý (ledger cộng dồn theo đúng `(Year, Month)` của
từng đơn, không phụ thuộc thứ tự xử lý) — không cần sửa gì thêm để vá riêng bug đó.

`CreateEmployeeDto`/`UpdateEmployeeDto` không còn field `MonthToDate`/`YearToDate` — form Sửa Nhân viên
(`EmployeeForm.tsx`) bỏ hẳn 2 ô nhập lũy kế.

### §Song ngữ Vn/Jp trên OtFormDto — hiển thị cho Trưởng phòng/Trưởng Bộ phận xem trước khi duyệt (2026-07-29)
- **Lý do**: `Group.GroupNameJp`/`Department.DepartmentNameJp`/`Reason.ReasonNameJp` (và `OtFormEmployee.NoteJp`/`ProcessPart.AnotherSuggestionJp` đã có sẵn từ trước) tồn tại trong DB nhưng `OtFormDto`/`OtFormListItemDto` trước đây chỉ trả field `*Vn` — 2 màn xem trước khi duyệt (`OtFormDetail.tsx` trong app, `OtFormEmailConfirmPage.tsx` public qua link email) chỉ hiện tiếng Việt dù master data đã có sẵn bản dịch tiếng Nhật.
- **Đã thêm**: `OtFormDto.GroupNameJp`/`DepartmentNameJp`/`ReasonNameJp` (nullable, `OtFormService.GetByIdAsync`) và `OtFormListItemDto.GroupNameJp`/`DepartmentNameJp` (nullable, `OtFormService.ToListItemDto`) — map thẳng từ navigation `Group`/`Department`/`Reason` đã `Include()` sẵn ở cả 2 chỗ, không cần query thêm.
- **KHÔNG thêm Jp cho `Employee`** — giữ đúng quyết định cũ "Tên riêng — không dịch" (xem bảng Entity đầu file).
- FE hiện dạng `"{Vn} / {Jp}"` (bỏ `/ {Jp}` nếu `null`) qua helper `bilingualText` (`yev-frontend/src/modules/attendance/lib/bilingual.ts`), áp dụng cho Phòng ban/Bộ phận/Lý do (header + card thông tin) và Ghi chú nhân viên/Đề nghị khác (đã có Jp trong DTO từ trước, giờ mới lên UI) ở cả `OtFormDetail.tsx`, `OtFormEmailConfirmPage.tsx`, và cột "Phòng ban/Bộ phận" ở `OtFormListPage.tsx`.
- Email thông báo duyệt đơn cũng đổi sang song ngữ tương ứng — xem bullet `OtForm/ApprovalNotification.html` ở §Xác thực qua email bên dưới.

### §Popup xác nhận Từ chối trên trang xác nhận qua email (2026-07-29)
- **Trước đây**: `OtFormEmailConfirmPage.tsx` (route public `/xac-nhan-don?token=...`, xem §Xác thực qua email) dùng chung 1 ô "Ghi chú/Lý do từ chối" luôn hiển thị sẵn cho cả 2 nút Duyệt/Từ chối — bấm "Từ chối" gửi thẳng luôn nếu ô đó không trống, không có bước xác nhận lại.
- **Yêu cầu người dùng**: bấm "Từ chối" phải mở popup riêng để nhập lý do trước khi thật sự gửi — tránh bấm nhầm. Đã đổi FE: ô "Ghi chú" ngoài popup giờ chỉ dùng cho "Duyệt" (tuỳ chọn); bấm "Từ chối" mở modal riêng (cùng UX với modal Ký duyệt/Duyệt/Từ chối ở `OtFormDetail.tsx` trong app) với ô lý do **bắt buộc** + nút Huỷ/Xác nhận từ chối. Không đổi gì ở BE (`POST /email-confirm/{token}/reject` vẫn nhận `RejectOtFormDto { comment }` y hệt cũ).

### §Đơn tổng — gom nhiều OtForm theo Phòng ban, duyệt 1 lần cho Trưởng phòng (2026-08-06, REDESIGN 2026-08-07 Giai đoạn 3.2)

> **✅ Đã redesign theo Cây chức vụ (2026-08-07, Giai đoạn 3.2)** — bản mô tả dưới đây phản ánh đúng
> hành vi hiện tại. Bản gốc (2026-08-06) gắn chặt vào `OtFormStatus.Pending` cố định (đã xoá ở Giai
> đoạn 3.1); redesign chỉ đổi **điều kiện xác định "đang chờ Trưởng phòng"**, giữ nguyên toàn bộ ý
> tưởng/entity/API gốc.
>
> **✅ Mở rộng sang WorkshopManager/GeneralDirector (2026-09-05)** — mọi chỗ nói "Trưởng phòng"/"Phòng
> ban" dưới đây giờ áp dụng cho CẢ 3 cấp quản lý (Trưởng phòng theo Department, Trưởng Xưởng/Giám đốc
> company-wide — 1 batch/cấp/ngày). Chi tiết đổi gì ở §Bỏ mail riêng ở 3 cấp quản lý bên dưới.

**Yêu cầu người dùng**: Trưởng phòng phải duyệt từng đơn một, rất mất công khi 1 Phòng ban có nhiều Bộ
phận cùng gửi đơn trong ngày. Chốt qua AskUserQuestion (CLAUDE.md §2 luật 2):
- Mỗi ngày **15:00** (giờ hệ thống, `TimeHelper.GetCurrentUtcTime()` = UTC+7), job tự động gom **các đơn
  MỚI, chưa từng vào batch nào**, theo `DepartmentId` thành 1 `OtFormBatch` mới, gửi mail lần đầu. Batch
  cũ chưa xử lý xong được gửi **mail nhắc lại** (token mới, KHÔNG tạo batch mới, KHÔNG gộp thêm đơn) —
  1 đơn chỉ thuộc đúng 1 batch trong suốt vòng đời của nó.
- Trong màn duyệt, ngoài bỏ chọn từng nhân viên (loại khỏi đơn), Trưởng phòng có thể **Từ chối cả 1 đơn
  nhỏ** ngay tại đây (đơn 1 người mà không muốn duyệt thì phải Từ chối, vì "Loại nhân viên" chặn xoá hết).
- Có thêm màn "Đơn tổng" trong app (`/ot/batches`), không chỉ qua email.

**Điều kiện gom "đang chờ Trưởng phòng" ở model Cây chức vụ (chốt lại 2026-08-07 qua AskUserQuestion)**:
model cũ có 1 trạng thái CỐ ĐỊNH cho việc này; model mới mỗi đơn có chuỗi bước ĐỘNG (số bước trung gian
co giãn theo Phòng ban). 1 đơn "đủ điều kiện gom/còn hiệu lực trong Đơn tổng" khi và chỉ khi **bước đang
chờ xử lý HIỆN TẠI của chính nó** (bước `OtFormApprovalStep.Status=Pending` có `StepOrder` nhỏ nhất) có
`TerminalLevelSnapshot = JobTitleTerminalLevel.DepartmentManager (1)`. Đơn còn kẹt ở bước trung gian
trước đó (SUP/CHIEF...) thì **không** được gom, vẫn phải duyệt lẻ tới khi tự nó tới lượt Trưởng phòng.
Hàm private `GetFormIdsAtDepartmentManagerStepAsync(formFilter)` trong `OtFormService` là nền tảng dùng
chung cho cả sweep/detail/process (đọc y hệt logic `GetPendingApprovalsAsync` — nhóm bước Pending theo
`OtFormId`, lấy `StepOrder` nhỏ nhất mỗi nhóm, lọc theo `TerminalLevelSnapshot`).

**Entity** (`Attendance.Domain/Entities/`, KHÔNG đổi so với bản gốc):
| Entity | Thuộc tính | Ghi chú |
|---|---|---|
| `OtFormBatch` | `Id`, `DepartmentId`(FK Restrict), `BatchDate:DateOnly`, `Status:int` (enum `OtFormBatchStatus` Pending=0/Processed=1), `CreatedAt`, `ProcessedAt:DateTime?`, `ProcessedByUserName:string?`, `ProcessedByFullName:string?` | Không `IsDeleted` — bảng hệ thống tự quản lý, giống `OtFormApprovalEmailToken`. |
| `OtFormBatchEmailToken` | `Id`, `OtFormBatchId`(FK Cascade), `ApproverUserName`, `ApproverFullName?`, `IsReminder:bool`, `Token`, `ExpiresAt`, `UsedAt:DateTime?`, `CreatedAt` | Bản sao mẫu `OtFormApprovalEmailToken` — mỗi lần gửi mail (mới hoặc nhắc) tạo 1 token mới. |

`OtForm.OtFormBatchId:int?` (FK Restrict → `OtFormBatch`, nullable — `null` = chưa được gom). Migration
`AddOtFormBatch` (2026-08-06, schema không đổi ở redesign). Enum `OtFormBatchStatus`,
`OtFormBatchFormDecision` (Approve=0/Reject=1, chỉ dùng trong DTO xử lý, không lưu DB). **Không có
permission mới** — tái dùng `Attendance.OTForm.View`/`Attendance.OTForm.Approve`.

**Business logic, tất cả nằm trong `OtFormService`** (không tạo service riêng — tái dùng trực tiếp
`ApproveAsync`/`RejectAsync`/`RemoveEmployeeAsync` **public** đã có, không viết lại logic duyệt/từ
chối/loại nhân viên):
- `RunDailyBatchSweepAsync()` — gọi bởi `OtFormBatchBackgroundService` hằng ngày vào giờ đọc từ
  `AttendanceSetting.BatchAutoSendTime` (mặc định 15:00, Admin tự đổi qua tab Cấu hình — đọc lại MỖI
  vòng lặp, không cache; đổi giờ chỉ áp dụng từ lần tính delay TIẾP THEO, không đánh thức sớm vòng chờ
  đang chạy dở, 2026-08-08). Bản sao mẫu `DeviceLiquidationBackgroundService`, đăng ký lại ở
  `Program.cs` 2026-08-07. Có thêm `POST /api/OtFormBatch/run-now` (permission
  `Attendance.Setting.Update`, nút "Gửi ngay" ở tab Cấu hình) để chạy sweep ngay lập tức khi test/cần
  gấp, không cần đợi tới giờ cấu hình — gọi thẳng cùng hàm `RunDailyBatchSweepAsync()`, không có
  logic riêng. (a) Gom đơn chưa từng
  batch (`OtFormBatchId==null`) mà đang đúng bước Trưởng phòng theo `DepartmentId` → tạo `OtFormBatch`
  mới, gán `form.OtFormBatch = newBatch` (EF tự fixup FK) → gửi mail lần đầu. (b) Với mỗi batch cũ còn
  `Pending`: nếu KHÔNG còn đơn nào thoả điều kiện "còn hiệu lực" ở trên (đã bị duyệt/từ chối lẻ tay ở
  tab "Chờ tôi duyệt" bình thường, ngoài luồng batch) → tự đóng batch (`Status=Processed`, không
  `ProcessedByUserName`), không gửi mail; còn lại → gửi mail nhắc (`IsReminder=true`). Batch vừa tạo
  trong CHÍNH lần chạy (a) không bị nhắc lại ngay trong cùng lượt sweep.
- `ProcessBatchAsync(batchId, approverUserName, approverFullName, ProcessOtFormBatchDto)` — **không có
  Admin bypass** (đúng tinh thần `ApproveAsync`/`RejectAsync` ở đơn lẻ — batch chỉ là lớp gom nhóm, auth
  vẫn y hệt: người gọi phải là candidate của đúng bước Trưởng phòng của TỪNG đơn). Nếu batch không còn
  đơn nào hiệu lực (đã bị xử lý lẻ tay hết) → tự đóng, bỏ qua `request.Forms`. Ngược lại: `request.Forms`
  phải khớp **chính xác** (SetEquals) tập `OtFormId` còn hiệu lực của batch — thiếu/thừa → 400. Validate
  fail-fast TRƯỚC khi ghi gì: (1) người gọi phải là candidate của bước hiện tại của MỌI đơn trong
  request; (2) Reject thiếu lý do → 400; (3) Approve mà `ExcludedEmployeeIds` khiến đơn còn 0 người
  active → 400 báo dùng Reject thay vì loại hết. Verify `SecondaryPassword` 1 lần ở cấp batch (các lệnh
  gọi bên dưới vẫn tự verify lại, rẻ và không cần sửa chữ ký của chúng). Với từng đơn: Reject → gọi
  thẳng `RejectAsync`; Approve → loop `RemoveEmployeeAsync` (isAdmin=false) cho từng nhân viên bị loại
  rồi gọi thẳng `ApproveAsync` — mỗi đơn tiếp tục đúng luồng hiện có (snapshot chuỗi, cộng lũy kế, gửi
  mail cấp kế tiếp nếu còn) không đổi 1 dòng logic duyệt. Xong hết → `batch.Status=Processed`. **Không
  dùng transaction DB** (theo đúng tiền lệ codebase) — rủi ro xử lý dở dang giảm thiểu nhờ validate
  fail-fast trước khi ghi bất cứ gì.
- Người nhận mail = mọi `UserName` xuất hiện trong `OtFormApprovalStepCandidate` của bất kỳ bước Trưởng
  phòng nào (Pending) thuộc các đơn còn hiệu lực của batch, gộp theo `UserName` (1 người là candidate
  của nhiều đơn trong batch chỉ nhận 1 mail, không lặp) — hàm private `NotifyBatchApproversAsync`, mirror
  `NotifyEligibleApproversAsync` (đơn lẻ) nhưng gộp nhiều đơn vào 1 email tóm tắt. Template
  `EmailTemplates/OtForm/BatchApprovalNotification.html` (bản tóm tắt — số đơn/số NV/tổng giờ, KHÔNG liệt
  kê chi tiết từng đơn) — Subject thêm tiền tố `[Nhắc nhở]` khi `IsReminder`, dùng chung 1 template. Link
  `{FrontendBaseUrl}/xac-nhan-don-tong?token={token}`.
- Kênh public (`OtFormBatchController`, `[AllowAnonymous]`): `GET/POST email-confirm/{token}` (approve)
  — y hệt cấu trúc `OtFormController` email-confirm, resolve token (`ResolveBatchEmailTokenAsync`) rồi
  gọi thẳng `ProcessBatchAsync`.
- `GetBatchesAsync`: Admin thấy toàn bộ batch; người thường chỉ thấy batch của Phòng ban mà mình từng là
  candidate ở bước Trưởng phòng (không giới hạn batch hiện tại — chỉ cần từng hợp lệ ở đúng cấp đó).
- Đã verify sống qua API thật (2026-08-07): sweep tự động gom đúng 1 đơn test (TH2, đang chờ Manager) vào
  1 batch mới của đúng Department; `GET grid-list`/`GET {id}` trả đúng dữ liệu; gọi `POST {id}/approve`
  bằng tài khoản KHÔNG phải candidate bị chặn 400 đúng message trước khi verify `SecondaryPassword` (xác
  nhận thứ tự validate fail-fast). Chưa verify được nhánh Approve/Reject thành công thật (cần tài khoản
  thật của Trưởng phòng đăng nhập, ngoài khả năng của agent).
- **`OtFormBatchItemDto` bổ sung `SubReason`/`ProcessPart` (2026-08-08)** — trước đây chỉ có
  `Employees[]` (đã sẵn đủ field lũy kế/phiếu ăn qua `OtFormEmployeeDto` dùng chung với `OtFormDto`), màn
  `OtFormBatchDetail.tsx` chỉ render 1 bảng rút gọn (Chọn/Mã NV/Họ tên/Thời gian/Số giờ) — Trưởng phòng
  không thấy đủ ngữ cảnh để quyết định Duyệt/Từ chối như màn Chi tiết đơn thường (thiếu "Yêu cầu hỗ trợ
  khác", lý do chi tiết, cột Tháng/Năm/Ăn/Đã ăn/Ghi chú của từng nhân viên). Đã bổ sung `SubReason` (có
  sẵn trên `OtForm`, chỉ cần thêm vào DTO) và `ProcessPart` (query thêm theo `activeFormIds`, cùng cách
  `employeesByFormId` đã làm) vào `BuildBatchDtoAsync`; FE enrich lại bảng nhân viên trong
  `OtFormBatchDetail.tsx` khớp đúng các cột ở `OtFormDetail.tsx` (tái dùng y hệt key i18n
  `Attendance.OtFormDetail.*` qua `useTranslations` thứ 2, không tạo trùng key). Áp dụng cho CẢ 2 kênh
  (trong app + trang public qua email) vì dùng chung 1 component.

### §Bỏ mail riêng ở 3 cấp quản lý — chỉ còn mail tổng hợp hằng ngày (2026-09-05)

**Yêu cầu người dùng**: Trưởng phòng/Trưởng Xưởng/Giám đốc quá tải vì vừa nhận mail riêng NGAY khi 1
đơn tới lượt họ (`NotifyEligibleApproversAsync`, xem §Xác thực qua email bên dưới) VỪA nhận mail tổng
hợp mỗi ngày 15:00 (§Đơn tổng ở trên) — trùng lặp cho cùng 1 đơn. Chốt qua AskUserQuestion (CLAUDE.md
§2 luật 2): bỏ hẳn mail riêng ở **cả 3 cấp quản lý** (DepartmentManager/WorkshopManager/GeneralDirector),
chỉ giữ đúng 1 kênh mail tổng hợp/ngày cho cả 3 cấp. Cấp trung gian (`TerminalLevel=None` — Staff/Group
Leader/Team Leader/SUP/CHIEF...) **không đổi gì** — vẫn nhận mail riêng ngay như cũ vì chưa có cơ chế
gom cho cấp đó và không nằm trong yêu cầu.

Trước đó "Đơn tổng" (§Đơn tổng) CHỈ gom được cấp DepartmentManager (theo Department) — muốn bỏ mail
riêng ở cả 3 cấp thì phải mở rộng chính cơ chế gom đó sang WorkshopManager/GeneralDirector, KHÔNG viết
thêm 1 cơ chế song song. 2 cấp này company-wide (candidate không lọc theo Department, xem
`JobTitleApprovalChainService`) → gom **1 batch/cấp/ngày cho toàn công ty** thay vì theo Department.

**Thay đổi BE**:
- `OtFormBatch`: thêm cột `TerminalLevel:int` (enum `JobTitleTerminalLevel`, batch nào cũng có, không
  còn ngầm định DepartmentManager); `DepartmentId` đổi thành `int?` — chỉ có giá trị khi
  `TerminalLevel=DepartmentManager`, `null` cho 2 cấp company-wide. Migration `AddOtFormBatchTerminalLevel`
  backfill `TerminalLevel=1` (DepartmentManager) cho mọi batch cũ (trước migration này chỉ có loại đó).
- `OtFormService.CreateAsync`/`ApproveAsync`: điểm gọi `QueueStepApprovalNotification` giờ có thêm điều
  kiện `step.TerminalLevelSnapshot == JobTitleTerminalLevel.None` — bỏ mail riêng đúng 3 cấp quản lý,
  giữ nguyên cho cấp trung gian. Không đổi gì ở `RejectAsync` (Reject không gửi mail cấp kế tiếp).
- Đổi tên/generalize các hàm nội bộ dùng để "Đơn tổng" hoạt động với nhiều TerminalLevel:
  - `GetFormIdsAtDepartmentManagerStepAsync` (cũ, hardcode DepartmentManager) → tách làm 2:
    `GetActiveFormIdsForBatchAsync(formFilter, terminalLevel)` (còn hiệu lực của 1 batch cụ thể, dùng ở
    `BuildBatchDtoAsync`/`ProcessBatchAsync`/vòng "nhắc lại" của `RunDailyBatchSweepAsync`) và
    `GetNewFormsAtManagerStepAsync()` (đơn MỚI chưa vào batch nào, trả kèm `DepartmentId`/`TerminalLevel`
    để nhóm đúng phạm vi ở bước tạo batch mới).
  - `RunDailyBatchSweepAsync` bước (a): nhóm đơn mới theo `(TerminalLevel, DepartmentId)` — riêng
    DepartmentManager giữ `DepartmentId` thật, 2 cấp company-wide ép `DepartmentId=null` trước khi nhóm
    (nên tự động gộp thành đúng 1 batch/cấp dù đơn thuộc nhiều Department khác nhau).
  - `NotifyBatchApproversAsync`: điều kiện lọc candidate đổi từ hardcode `TerminalLevelSnapshot==
    DepartmentManager` sang `== batch.TerminalLevel`.
  - `ResolveBatchScopeNameAsync` (mới) — tên hiển thị phạm vi batch: Department (bilingual) nếu
    `TerminalLevel=DepartmentManager`, ngược lại tra `JobTitle.Name` theo đúng `TerminalLevel` (company-
    wide, JobTitle không có bản Jp nên `ScopeNameJp=null` trong trường hợp này). Dùng ở cả
    `BuildBatchDtoAsync` (chi tiết 1 batch) và email tóm tắt (`NotifyBatchApproversAsync`).
  - `GetBatchesAsync` (phân trang danh sách): scoping cho non-Admin đổi từ "chỉ so DepartmentId" sang so
    theo `(TerminalLevel, DepartmentId)` — DepartmentManager so đúng Department mình từng là candidate,
    2 cấp company-wide chỉ cần từng là candidate ở đúng TerminalLevel đó (không lọc Department). Tên
    hiển thị công ty-wide tra riêng qua `FillCompanyWideBatchScopeNamesAsync` (1 query gộp cho cả trang,
    không N+1 như query từng dòng).
- **DTO đổi tên field (breaking change, không cần tương thích ngược — dữ liệu OT là dev)**:
  `OtFormBatchListItemDto`/`OtFormBatchDto` bỏ `departmentNameVn`/`departmentNameJp`, thêm `terminalLevel`
  + `scopeNameVn`/`scopeNameJp` (bilingual khi DepartmentManager, chỉ có bản Vn khi company-wide);
  `departmentId` đổi `int` → `int?`. Xem schema mới ở `attendance-api-fe.md §6e`.
- Email `EmailTemplates/OtForm/BatchApprovalNotification.html`: placeholder `{{DepartmentName}}` (nhãn
  "PHÒNG BAN / 部署") đổi thành `{{ScopeName}}` (nhãn "PHẠM VI DUYỆT / 承認範囲") — vẫn 1 template dùng
  chung cho cả 3 cấp, chỉ khác giá trị truyền vào.
- FE: `ot-form-batch.dto.ts` đổi field khớp DTO mới; `OtFormBatchListPage.tsx`/`OtFormBatchDetail.tsx`
  đổi `bilingualText(batch.departmentNameVn, ...)` → `bilingualText(batch.scopeNameVn, batch.scopeNameJp)`,
  cột "Bộ phận" đổi thành "Phạm vi" (`colScope`, message keys `vi.json`/`ja.json`).
- Đã build BE sạch (0 lỗi), tạo + áp dụng migration `AddOtFormBatchTerminalLevel` lên DB thật (dev), FE
  `npx tsc --noEmit` sạch cho các file đã sửa (lỗi `jszip` module hiện ra là môi trường thiếu
  dependency, không liên quan tới thay đổi này). Chưa verify end-to-end mail thật cho WorkshopManager/
  GeneralDirector company-wide (cần dữ liệu Employee thật giữ 2 Chức vụ đó + `run-now` để kiểm tra).

### §Xác thực qua email — cập nhật chữ ký & duyệt đơn (2026-07-16)
Bổ sung 1 kênh xác nhận qua email (nút bấm mở trang xác nhận nhỏ) cho 2 hành động nhạy cảm — **không thay thế** luồng trong app, chỉ là kênh phụ vì cấp quản lý ít khi mở app:

- **Cập nhật chữ ký** (`UserSignatureService`): `PUT /api/UserSignature/me` **không còn áp dụng ngay** — tạo 1 dòng `PendingSignatureConfirmation` (Token, ExpiresAt = +30 phút, ConfirmedAt) rồi gửi email cho **chính người gọi** (chống chiếm phiên đăng nhập đổi chữ ký hộ). `GET/POST /api/UserSignature/confirm/{token}` (`[AllowAnonymous]`) — GET trả preview, POST áp dụng thật (gọi lại đúng logic upsert cũ) + set `ConfirmedAt` (chống dùng lại token).
- **Duyệt/Từ chối đơn qua email** (`OtFormService`): sau `CreateAsync` (cần DepartmentManager) và sau `ApproveAsync` khi còn cấp kế tiếp (`ApprovedByDepartment`→cần WorkshopManager, `ApprovedByWorkshop`→cần GeneralDirector), hàm `NotifyEligibleApproversAsync` tự tra người đủ quyền ở đúng cấp đó (qua `UserApprovalScope` như `GetPendingApprovalsAsync`, hoặc qua Role `"Tổng Giám Đốc"` nếu là GeneralDirector — không có UserApprovalScope) rồi tạo 1 `OtFormApprovalEmailToken` + gửi mail **cho từng người** (1 đơn có thể có nhiều người cùng phạm vi → nhiều token, nhiều mail). `GET /api/OtForm/email-confirm/{token}` (preview), `POST .../approve`, `POST .../reject` (`[AllowAnonymous]`) — cả 2 action đều gọi thẳng `ApproveAsync`/`RejectAsync` **đã có sẵn** (không viết logic duyệt mới), nên tự động thừa hưởng mọi validate cũ (đơn đã xử lý xong thì tự chặn — token cũ tự nhiên vô hiệu, không cần logic hủy token anh em thủ công) + tự cascade gửi mail tiếp cho cấp sau nếu còn.
  > **⚠ Cập nhật 2026-09-05** — mô tả trên vẫn đúng cho bước ở cấp trung gian (`TerminalLevel=None`).
  > Với bước ở 1 trong 3 cấp quản lý (DepartmentManager/WorkshopManager/GeneralDirector),
  > `NotifyEligibleApproversAsync` **không còn được gọi ngay** sau `CreateAsync`/`ApproveAsync` nữa —
  > xem §Bỏ mail riêng ở 3 cấp quản lý bên dưới. Kênh `email-confirm/{token}` của `OtFormController` vẫn
  > tồn tại y nguyên (đơn lẻ, dùng chung `ApproveAsync`/`RejectAsync`) nhưng từ giờ chỉ CÒN được tạo token
  > qua nhánh cấp trung gian — người ở 3 cấp quản lý nhận link duyệt qua kênh "Đơn tổng"
  > (`email-confirm/{token}` của `OtFormBatchController`, xem §Đơn tổng) thay vì kênh đơn lẻ này.
- **Bề mặt `[AllowAnonymous]` đầu tiên và thứ 2 của toàn hệ thống** (trước đó không controller nào dùng, chỉ 2 dòng dev-only cho Scalar/OpenAPI) — bảo mật hoàn toàn dựa vào token ngẫu nhiên 256-bit (`Shared.Application.Helper.TokenHelper.GenerateSecureToken`), không dựa JWT/Permission. Token single-use (`ConfirmedAt`/`UsedAt`) + có hạn (`ExpiresAt`) — không cần logic thu hồi thủ công vì `LoadFormAndValidateAuthorityAsync`/status check tự nhiên chặn token cũ.
- **Cross-module không qua HTTP**: `Shared.Application.Interfaces.IUserDirectoryService`/`IEmailService` là contract đặt ở `Shared.Application` (2 module đều đã reference sẵn); implementation thật (`Identity.Application.Services.UserDirectoryService`, `Shared.Infrastructure.Services.EmailService`) được Scrutor tự nối dây lúc runtime — `Attendance.Application` **không cần** ProjectReference tới `Identity.Application` dù cần đọc Email/FullName/Role của User (nằm DB khác).
- **`Identity.User.Email`** (migration `AddEmailToUser`, DB `YevIdentityManagement`): tự resolve từ thuộc tính AD `mail` qua `MyClaimsTransformation.GetActualEmail` (dùng `UserPrincipal.EmailAddress`, cùng cơ chế `GetActualFullName`) — **chỉ set khi đang trống** (khác `DeviceName` vốn refresh mỗi lần đổi), tự "chữa lành" cho user cũ ở lần đăng nhập kế tiếp mà không cần Admin gán tay.
- **Gửi email duyệt chạy nền, không chặn response (2026-09-03)** — `CreateAsync`/`ApproveAsync` không còn `await NotifyEligibleApproversAsync(...)` trực tiếp (mỗi lần gọi là 1 vòng SMTP connect/auth/send tới `VNMAIL04` cho từng candidate, có thể mất vài trăm ms tới vài giây/người, cộng dồn vào response). Thay bằng `QueueStepApprovalNotification(otFormId, stepId)` — đẩy 1 work item (chỉ chứa 2 Id) vào `Shared.Application.Interfaces.IBackgroundTaskQueue` (Channel-based, Singleton, impl `Shared.Infrastructure.Services.BackgroundTaskQueue`); `CompanySystem.HostApi.BackgroundServices.QueuedHostedService` (đăng ký `AddHostedService` trong `Program.cs`, cùng nhóm với `DeviceLiquidationBackgroundService`/`OtFormBatchBackgroundService`) dequeue rồi chạy trong scope DI riêng của nó, gọi `IOtFormService.SendStepApprovalNotificationAsync(otFormId, otFormApprovalStepId)` — hàm này tự tải lại `OtForm`/`OtFormApprovalStep` (kèm `Candidates`) theo Id (KHÔNG dùng lại entity đã load ở request cũ vì scope đó đã dispose) rồi gọi lại đúng `NotifyEligibleApproversAsync` như trước. An toàn về tính đúng đắn vì `CreateAsync`/`ApproveAsync` đã `SaveChangesAsync()` xong phần nghiệp vụ chính TRƯỚC khi enqueue — hoãn gửi mail không ảnh hưởng gì tới đơn. Không đổi guarantee cũ: `EmailService.SendAsync` vẫn best-effort (tự nuốt lỗi SMTP, không retry) — `QueuedHostedService` chỉ log lỗi nếu work item throw, không có cơ chế thử lại. **Cố ý CHƯA áp dụng** cho `NotifyBatchApproversAsync`/`RunDailyBatchSweepAsync` (đơn tổng) vì luồng đó vốn đã chạy trong `OtFormBatchBackgroundService` (không chặn request nào) — chỉ endpoint Admin `POST /api/OtFormBatch/run-now` còn block, nhưng đây là thao tác thủ công hiếm dùng, chấp nhận được.
- **SMTP thật đã cấu hình và verify hoạt động (2026-07-17)** — `CompanySystem.HostApi/appsettings.json` mục `EmailSettings` trỏ tới mail server nội bộ `VNMAIL04.yev.vn:587` (STARTTLS). `EmailService.SendAsync` vẫn giữ nguyên tự bắt lỗi SMTP, trả `false`, KHÔNG throw — thiếu cấu hình/SMTP lỗi không làm hỏng nghiệp vụ chính (tạo đơn/duyệt đơn/cập nhật chữ ký vẫn thành công, chỉ không gửi được mail thông báo).
  - **Bẫy chứng chỉ TLS đã gặp và cách sửa**: ban đầu cấu hình `SmtpHost = mail.yev.vn` bị lỗi `SslHandshakeException` — chứng chỉ server thật ghi tên `VNMAIL04`/`VNMAIL04.yev.vn` (hostname mismatch). Đổi `SmtpHost` sang `VNMAIL04.yev.vn` thì hết mismatch nhưng lộ ra chứng chỉ đó là **self-signed** (`Subject = Issuer = CN=VNMAIL04`) → `UntrustedRoot` nếu máy chạy app chưa tin cậy cert này.
  - **Máy nào chạy app cũng cần tự import cert này** vào Trusted Root của máy đó (không tự động theo code) — export cert bằng `openssl`/PowerShell `X509Certificate2`, rồi trên máy host chạy `Import-Certificate -FilePath vnmail04.cer -CertStoreLocation Cert:\LocalMachine\Root` (cần quyền Admin; máy dev không có Admin thì tạm dùng `Cert:\CurrentUser\Root` qua `X509Store` API — chỉ đủ cho user hiện tại, KHÔNG dùng được nếu sau này host chạy dưới AppPool identity của IIS). Khi deploy IIS thật, phải lặp lại bước import trên đúng server đó (`LocalMachine\Root`, vì AppPool chạy user riêng) — cân nhắc nhờ IT đẩy cert qua Group Policy chung của domain `yev.vn` thay vì import tay từng server (domain đã có tiền lệ đẩy các cert nội bộ khác qua GPO).
- **Template email tách ra file `.html` riêng, tổ chức theo module/tính năng (2026-07-17)** — không còn ghép chuỗi HTML thủ công trong C#:
  - `Shared.Application.Interfaces.IEmailTemplateRenderer` (contract) + `Shared.Infrastructure.Services.EmailTemplateService` (impl, Scrutor tự đăng ký vì tên kết thúc `Service`) — đọc file `.html` từ thư mục `EmailTemplates/` cạnh DLL sau build (`AppContext.BaseDirectory`), thay placeholder dạng `{{Key}}` bằng giá trị thật.
  - File nguồn nằm trong project của module sở hữu nội dung, KHÔNG gộp chung vào `Shared.Infrastructure` (Shared giữ vai trò cơ chế/generic, không chứa nội dung nghiệp vụ) — Attendance: `Attendance.Infrastructure/EmailTemplates/{TínhNăng}/{TênTemplate}.html`, cụ thể `UserSignature/RequestUpdateConfirmation.html` (mail xác nhận cập nhật chữ ký) và `OtForm/ApprovalNotification.html` (mail thông báo có đơn chờ duyệt). Mỗi module tự khai `<Content Include="EmailTemplates\**\*.html"><CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory></Content>` trong `.csproj` của mình để file được copy ra output — module nào cũng làm được, không phụ thuộc `Shared.Infrastructure`.
  - Gọi `_emailTemplateRenderer.Render("OtForm/ApprovalNotification.html", new Dictionary<string,string>{...})` rồi mới `_emailService.SendAsync(...)`. Bọc `try/catch (FileNotFoundException)` quanh bước `Render` — thiếu file template (lỗi deploy quên copy) không được làm hỏng nghiệp vụ chính, cùng nguyên tắc với `EmailService.SendAsync` nuốt lỗi SMTP.
  - **Giao diện template đã làm lại (2026-07-17)** — layout table-based inline CSS (tương thích Outlook nội bộ dùng `VNMAIL04`), header xanh `#1a56db` + tên "YevManagement", card trắng bo góc, nút CTA bấm được thay vì link thô, footer disclaimer "email tự động". Placeholder của từng file:
    - `UserSignature/RequestUpdateConfirmation.html`: `{{UserName}}` (fullName từ `GetContactInfoAsync`, fallback `userName`), `{{RequestedAt}}`, `{{ConfirmLink}}`, `{{ExpiryMinutes}}`.
    - `OtForm/ApprovalNotification.html`: `{{ApproverFullName}}`, `{{OtFormId}}`, `{{RequesterFullName}}` (từ `otForm.CreatedByFullName`, fallback `CreatedByUserName`), `{{OtFormDate}}` (`dd/MM/yyyy`), `{{OtFormTime}}` (`HH:mm - HH:mm`), `{{TotalHour}}`, `{{ConfirmLink}}`, `{{ExpiryDays}}` — thêm khối "thông tin đơn" (info card) hiển thị nhanh không cần bấm link mới biết đơn của ai/ngày nào.
      **+3 placeholder (2026-07-29)**: `{{DepartmentName}}`/`{{GroupName}}`/`{{ReasonName}}` — chuỗi song ngữ `"{Vn} / {Jp}"` (helper `OtFormService.FormatBilingual`, bỏ phần `/ {Jp}` nếu master data không có tên tiếng Nhật) do `NotifyEligibleApproversAsync` tự truy `Group`/`Department`/`Reason` theo Id của đơn trước khi render (không dùng navigation property của `otForm` vì các luồng gọi hàm này — `CreateAsync`/`ApproveSubmitterAsync`/`ApproveAsync` — không phải lúc nào cũng `Include()` đủ 3 bảng). Toàn bộ nhãn tĩnh trong template cũng đổi sang song ngữ (VD "Phòng ban / 部署") theo yêu cầu người dùng "email thông báo duyệt đơn cần có tiếng Nhật".
- **Đã xóa endpoint test rò rỉ** `GET /api/Employee/test` (`[AllowAnonymous]`, Controller tự inject thẳng `IEmailService` gửi mail hardcode) — vi phạm kiến trúc (Controller không được gọi thẳng service tầng dưới ngoài `I{Module}Service` của chính nó) và là lỗ hổng để bất kỳ ai (không cần đăng nhập) trigger gửi mail qua SMTP thật. Muốn test gửi mail giờ dùng đúng luồng nghiệp vụ thật (`PUT /api/UserSignature/me`, tạo/duyệt `OtForm`) hoặc 1 project console rời ngoài solution.
- `AppSettings:FrontendBaseUrl` — domain FE dùng để build link trong email (`{FrontendBaseUrl}/xac-nhan-chu-ky?token=...`, `{FrontendBaseUrl}/xac-nhan-don?token=...`); **trang xác nhận do FE tự xây** (2 route public, gọi 2 cặp API preview+action ở trên), BE không server-render HTML.
- Đã verify qua HTTP thật (2026-07-16): `PUT /me` tạo pending đúng, không áp dụng ngay; `GET/POST /confirm/{token}` preview + áp dụng đúng; gọi lại token đã dùng bị chặn (chống replay). Luồng `OtFormApprovalEmailToken` dùng lại nguyên `ApproveAsync`/`RejectAsync` đã test kỹ ở các tính năng trước nên chưa test riêng end-to-end. Riêng việc SMTP gửi được thật (kết nối + auth + send) đã verify độc lập qua console test (2026-07-17) — chưa verify lại trọn vẹn 2 luồng trên với mail thật gửi đi thành công (mới verify tới bước tạo token + gọi `SendAsync`, chưa xác nhận hộp thư nhận được đúng nội dung từ 2 luồng nghiệp vụ này).

### §Mail báo người lập đơn khi đơn bị từ chối / bị loại nhân viên

Trước đây người lập đơn (`OtForm.CreatedByUserName`) không nhận tín hiệu nào khi approver Từ chối đơn hoặc
Loại nhân viên khỏi đơn. Nay gửi 1 mail cho người lập, template `OtForm/RequesterNotification.html` (song ngữ
Vn/Jp, không có nút CTA), chạy nền qua `IBackgroundTaskQueue` như mail duyệt:
- **Từ chối**: `RejectAsync` (sau `SaveChangesAsync`) → `QueueRejectedNotification` → `SendRejectedNotificationAsync`
  (lấy lý do/người từ chối từ `OtFormApprovalHistory` Rejected mới nhất). Phủ luôn kênh email, từ chối hàng loạt, đơn tổng.
- **Loại nhân viên**: `QueueEmployeesRemovedNotification(otFormId, employeeIds)` gọi ở 3 nơi: `UpdateAsync` (approver sửa đơn
  theo chuyền có `RemovedEmployees`), `RemoveEmployeeByEmailTokenAsync`, và `ProcessBatchAsync` (đơn tổng — gom **1 mail/đơn**
  cho mọi NV bị loại, không phải 1 mail/NV). `SendEmployeesRemovedNotificationAsync` đọc lại `OtFormEmployee.Removed*` từ DB.
- **Bỏ qua** nếu người thực hiện chính là người lập đơn (tự sửa đơn của mình) hoặc người lập không có email. Giá trị động
  (lý do, tên) được `WebUtility.HtmlEncode` vì `EmailTemplateService` không tự encode.
- Chưa verify mail thật gửi tới hộp thư (mới `dotnet build` sạch).

### §Mật khẩu cấp 2 khi ký/duyệt OtForm (2026-07-30)
**Yêu cầu người dùng** (chốt qua AskUserQuestion trước khi code, CLAUDE.md §2 luật 2): thêm 1 lớp xác
thực bổ sung (giống PIN giao dịch ngân hàng) cho hành vi có tính pháp lý — ký/duyệt phiếu tăng ca.
Mỗi user tự đăng ký 1 **mật khẩu cấp 2** riêng (khác hẳn mật khẩu đăng nhập AD), và phải nhập lại
đúng mật khẩu này ở **MỌI** bước ký/duyệt: `POST /{id}/submit` (Trưởng nhóm ký "Người đề nghị"),
`POST /{id}/approve`, `POST /{id}/reject` (mọi cấp Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng/TGĐ),
**kể cả kênh email** `email-confirm/{token}/approve|reject` — không có ngoại lệ, không có logic
bỏ qua cho user chưa thiết lập (chặn cứng, bắt thiết lập trước).

- **Entity**: `SecondaryPassword` (giá trị đang có hiệu lực) + `PendingSecondaryPasswordConfirmation`
  (chờ xác nhận email) — bản sao 1-1 của `UserSignature`/`PendingSignatureConfirmation` cả về cấu
  trúc lẫn luồng nghiệp vụ (`SecondaryPasswordService` mirror `UserSignatureService`: `PUT /me` chỉ
  tạo pending + gửi email, `ConfirmAsync` mới thật sự upsert).
- **Hash**: `Microsoft.AspNetCore.Identity.PasswordHasher<object>` (cần `FrameworkReference
  Microsoft.AspNetCore.App` trong `Attendance.Application.csproj`, trước đó project này chưa có) —
  không dùng thư viện hash ngoài, không lưu plaintext.
- **Gate ở tầng Service, không phải Controller**: `OtFormService` inject thêm `ISecondaryPasswordService`,
  gọi `VerifyAsync(callerUserName, request.SecondaryPassword)` **ngay đầu** `ApproveSubmitterAsync`/
  `ApproveAsync`/`RejectAsync` (trước bất kỳ ghi nào) — ném `DomainException` nếu chưa thiết lập
  ("Bạn chưa thiết lập mật khẩu cấp 2...") hoặc sai mật khẩu ("Mật khẩu cấp 2 không đúng."). 2 hàm
  `ApproveByEmailTokenAsync`/`RejectByEmailTokenAsync` **không cần sửa gì** — tự động thừa hưởng vì
  gọi thẳng 3 hàm trên với cùng `request` đã có field `SecondaryPassword`.
- **DTO**: thêm `[Required] string SecondaryPassword` vào `ApproveOtFormDto`/`RejectOtFormDto` — vì
  `submit`/`approve`/2 action email-confirm đều tái dùng đúng 2 DTO này, sửa 1 chỗ phủ đủ cả 5 entry
  point (submit, approve, reject, email-confirm/approve, email-confirm/reject).
- **Permission `Attendance.SecondaryPassword.Update`** (migration Identity `AddSecondaryPasswordPermission`)
  — gán qua subquery cho **đúng các Role đang giữ `Attendance.UserSignature.Update`** (Admin, Trưởng
  nhóm, Trưởng Bộ phận, Trưởng phòng, Trưởng xưởng, Tổng Giám Đốc) thay vì hardcode tên Role, tự động
  khớp nếu danh sách Role đó đổi sau này. Đã verify qua SQL thật (2026-07-30): đúng 6 Role, khớp
  UserSignature.Update 100%.
- **FE**: `modules/attendance/{api,types}/secondary-password.{api,dto}.ts` mirror `user-signature.*`;
  trang tự thiết lập `SecondaryPasswordPanel.tsx` (route `/ot/secondary-password`, nav sidebar); trang
  public xác nhận email `SecondaryPasswordConfirmPage.tsx` (route `/xac-nhan-mat-khau-cap-2`, mirror
  `SignatureConfirmPage.tsx`). `OtFormDetail.tsx` (modal ký/duyệt trong app) và
  `OtFormEmailConfirmPage.tsx` (trang public qua link email) đều thêm ô nhập mật khẩu cấp 2 và gửi
  kèm `secondaryPassword` trong mọi request submit/approve/reject.
- Hợp đồng FE đầy đủ ở [attendance-api-fe.md §6c](attendance-api-fe.md).

### §Loại nhân viên khỏi đơn (2026-07-30)
**Yêu cầu người dùng** (chốt qua AskUserQuestion trước khi code, CLAUDE.md §2 luật 2): đơn nhiều
người tăng ca, cấp đang ký/duyệt không đồng ý cho **1 người cụ thể** — trước đây chỉ có lựa chọn Từ
chối cả đơn (`RejectAsync`), buộc lập lại từ đầu dù 9/10 người vẫn hợp lệ. Thêm khả năng loại đúng
người đó rồi vẫn ký/duyệt được phần còn lại.

**3 quyết định đã chốt qua AskUserQuestion** (không tự suy diễn vì đụng luồng duyệt đang chạy thật):
1. **Cấp được loại**: MỌI cấp thực sự ký/duyệt đơn — kể cả Trưởng nhóm ở bước `/submit` (Draft), không
   riêng Trưởng phòng trở lên.
2. **Sau khi loại, luồng duyệt xử lý ra sao**: duyệt tiếp bình thường — **không** quay lại từ đầu, không
   xoá/vô hiệu chữ ký các cấp đã ký trước đó. Đơn giữ nguyên `Status`.
3. **Thao tác loại người thực hiện lúc nào**: **endpoint riêng, tách biệt khỏi approve** (Phương án B) —
   loại người trước, xem lại đơn, rồi mới bấm Duyệt (nhập mật khẩu cấp 2 cho action Duyệt) — KHÔNG gộp
   việc loại người vào cùng 1 request với `/approve` (đã cân nhắc phương án gộp, đổi lại được 1 lần xác
   thực nhưng người dùng chọn tách để có bước xem lại đơn trước khi duyệt thật). Action loại người **không
   cần mật khẩu cấp 2** ở cả 2 kênh (JWT lẫn email) — chốt lại 2026-07-31, xem bullet cuối mục "Thiết kế".

**Thiết kế**:
- **Soft-remove trên `OtFormEmployee`** (không xoá dòng) — 6 cột `IsRemoved`/`RemovedByUserName`/
  `RemovedByFullName`/`RemovedAtLevel`/`RemovedAt`/`RemoveReason` (migration
  `AddRemovedFieldsToOtFormEmployee`), cùng nguyên tắc snapshot-đóng-băng đã dùng cho
  `OtFormApprovalHistory`/`OtFormEmployee.MonthToDate` — đơn là văn bản có tính pháp lý, phải giữ được
  dấu vết ai loại ai, lúc nào, ở cấp nào, vì sao, vĩnh viễn.
- **`OtFormService.RemoveEmployeeAsync(id, userName, fullName, isAdmin, isGeneralDirector, request)`** —
  entry point mới, KHÔNG tái dùng `ApproveAsync`/`ApproveSubmitterAsync`. Suy `currentLevel` từ `Status`
  giống hệt `LoadFormAndValidateAuthorityAsync`, **trừ** `Draft` được chấp nhận (map sang
  `ApprovalLevel.Submitter`, vì Trưởng nhóm ở bước ký cũng loại được) — `LoadFormAndValidateAuthorityAsync`
  gốc ném lỗi ngay khi gặp `Draft` nên không tái dùng được nguyên hàm, phải viết logic suy cấp riêng.
  Xác thực 2 lớp Permission + `UserApprovalScope` y hệt `ApproveAsync` (Admin bypass ở cấp Submitter
  giống `ApproveSubmitterAsync`, TGĐ bypass scope giống `ApproveAsync`).
- **KHÔNG đổi `OtForm.Status`** — chỉ đánh dấu `IsRemoved` trên đúng 1 `OtFormEmployee`, cập nhật lại
  `OtForm.NumberOfEmployee = count(!IsRemoved)`, `SaveChangesAsync()`. Đơn tiếp tục chờ đúng cấp hiện tại
  tự bấm Duyệt/Ký như luồng cũ. **(2026-08-18)** cùng lúc đó cũng tính lại
  `ProcessPart.MainTicketCount`/`SecondaryTicketCount` theo danh sách nhân viên còn active — xem
  §Đồng bộ phiếu ăn khi sửa đơn/loại nhân viên.
- **Validate 400**: nhân viên không có trong đơn; đã bị loại từ trước; đơn chỉ còn ≤1 người chưa bị loại
  (loại nốt người cuối = Từ chối cả đơn, dùng `RejectAsync` thay thế, không cho đơn trống nhân viên);
  đơn đã `Completed`/`Rejected`; sai cấp/scope (cùng lỗi §Business Logic — Chữ ký các cấp duyệt).
- **KHÔNG yêu cầu mật khẩu cấp 2** — ban đầu (2026-07-30) kênh JWT có verify, nhưng đã bỏ (2026-07-31,
  chốt qua yêu cầu người dùng) để nhất quán với kênh email vốn đã không yêu cầu ngay từ đầu; xem
  §Loại nhân viên khỏi đơn — mở rộng sang kênh email.
- **Ảnh hưởng các nơi khác trong `OtFormService`** (đều lọc `!IsRemoved`):
  `AccumulateEmployeeHoursAsync` (người bị loại không cộng lũy kế); `UpdateAsync` diff nhân viên (dòng
  đã bị loại **không** bị hard-delete kể cả khi không còn trong `request.Employees` — audit trail phải
  sống sót qua mọi lần sửa đơn sau đó; nếu người tạo cố tình thêm lại đúng `EmployeeId` đã bị loại vào
  request, `UpdateAsync` xoá sạch 5 cột `Removed*` — coi là "thêm lại", không phải "khôi phục").
  `GetByIdAsync`/`ToListItemDto` **KHÔNG** lọc `IsRemoved` khỏi `employees[]` — người bị loại vẫn trả về
  trong response để FE hiện được audit trail trên màn chi tiết, chỉ có `NumberOfEmployee` là đếm riêng
  theo `!IsRemoved`.
- **Permission riêng `Attendance.OTForm.RemoveEmployee`** (migration Identity
  `AddOtFormRemoveEmployeePermission`) — KHÔNG dùng chung `.Create`/`.Approve` vì người gọi endpoint này
  trải trên **cả 2 phía** của ranh giới quyền cũ (Trưởng nhóm chỉ có `.Create`, các cấp trên chỉ có
  `.Approve`). Gán theo subquery cho đúng Role đang giữ `Attendance.UserSignature.Update` (Admin +
  5 Role nghiệp vụ), y hệt cách `AddSecondaryPasswordPermission` đã làm — Role "Nhân viên" (chỉ tạo đơn,
  không ký/duyệt, không có `UserSignature.Update`) cố tình **không** được gán, verify qua SQL thật
  (2026-07-30): 6/6 Role khớp `UserSignature.Update`.
- **Endpoint**: `POST /api/OtForm/{id}/employees/remove` (`RemoveOtFormEmployeeDto { EmployeeId, Reason }`,
  cả 2 `[Required]`, KHÔNG có `SecondaryPassword`) — trả `OtFormDto` đầy đủ đã cập nhật (khác
  `/approve`/`/reject` chỉ trả `true`), để FE không phải gọi lại `GET /{id}`.
- **FE**: nút "Loại khỏi đơn" trên từng dòng nhân viên ở `OtFormDetail.tsx` (ẩn khi chỉ còn 1 người chưa
  bị loại), modal RIÊNG (chỉ có ô lý do) tách biệt hoàn toàn khỏi modal Duyệt/Từ chối/Ký duyệt.
  Người bị loại hiện dòng riêng (mờ + gạch ngang) kèm ai loại/cấp nào/lý do gì thay vì biến mất khỏi
  bảng. `OtFormPrintView.tsx` (bản in PDF) tự lọc `!isRemoved` khỏi danh sách in/tổng giờ OT.
  Hợp đồng FE đầy đủ ở [attendance-api-fe.md §4.5a](attendance-api-fe.md).

#### §Loại nhân viên khỏi đơn — mở rộng sang kênh email (2026-07-31)
Người dùng test thực tế phát hiện: kênh xem trước/duyệt qua email (`OtFormEmailConfirmPage.tsx`) chưa
có nút "Loại khỏi đơn" — cấp Trưởng phòng/Trưởng Bộ phận/Trưởng xưởng/TGĐ ít khi mở app (đúng lý do kênh
email tồn tại từ đầu, xem §Xác thực qua email) nên không loại được người khi duyệt qua link email.

- **Quyết định đã chốt qua AskUserQuestion**: hành động này qua kênh email **KHÔNG cần mật khẩu cấp 2**
  — khác hẳn 2 action Duyệt/Từ chối qua email (`ApproveByEmailTokenAsync`/`RejectByEmailTokenAsync`) vẫn
  giữ nguyên yêu cầu mật khẩu cấp 2. Lý do: token 256-bit trong URL tự nó đã là thông tin xác thực đủ
  mạnh cho hành động này (người dùng tự đánh giá rủi ro thấp hơn ký/duyệt/từ chối cả đơn).
- **`OtFormService.RemoveEmployeeAsync` refactor thành 3 hàm**: `RemoveEmployeeCoreAsync` (private, logic
  gốc — suy cấp từ `Status`, xác thực Permission+Scope, ghi 5 cột `Removed*`, cập nhật
  `NumberOfEmployee`) dùng chung bởi 2 wrapper:
  - `RemoveEmployeeAsync` (public, JWT) — gọi thẳng Core (lúc này vẫn còn verify `SecondaryPassword`
    trước, xem bullet sửa lại bên dưới — 2026-07-31 bỏ luôn bước này).
  - `RemoveEmployeeByEmailTokenAsync` (public, mới) — resolve `OtFormApprovalEmailToken` qua
    `ResolveEmailTokenAsync(token, requireUnused: false)` **KHÔNG tiêu token** (khác
    `ApproveByEmailTokenAsync`/`RejectByEmailTokenAsync` luôn set `UsedAt` sau khi chạy) — người duyệt
    có thể loại nhiều người rồi mới Duyệt/Từ chối bằng đúng token đó, không phải mở lại email. Bỏ qua
    hoàn toàn bước verify mật khẩu cấp 2, gọi thẳng Core với `isAdmin: false` (không có khái niệm Admin
    qua kênh email, giống `ApproveByEmailTokenAsync`).
- **DTO riêng `RemoveOtFormEmployeeByEmailTokenDto { EmployeeId, Reason }`** (không có `SecondaryPassword`)
  — không tái dùng `RemoveOtFormEmployeeDto` vì lúc đó 2 DTO có tập field bắt buộc khác nhau (nay đã cùng
  shape sau bullet sửa lại bên dưới, vẫn giữ 2 type riêng ở FE vì gắn với 2 endpoint khác nhau).
- **Endpoint**: `POST /api/OtForm/email-confirm/{token}/employees/remove` (`[AllowAnonymous]`, cạnh 3
  action email-confirm có sẵn) — trả `OtFormDto` đầy đủ như endpoint JWT.
- **FE**: `OtFormEmailConfirmPage.tsx` thêm cùng nút/modal như `OtFormDetail.tsx`, chỉ bớt ô mật khẩu
  cấp 2. Gọi `OtFormApi.removeOtFormEmployeeByEmailToken(token, { employeeId, reason })`.
- **Sửa lại (2026-07-31, cùng ngày)**: người dùng phản hồi thêm — kênh JWT (`RemoveEmployeeAsync`) cũng
  KHÔNG cần mật khẩu cấp 2, bỏ luôn bước `_secondaryPasswordService.VerifyAsync(...)` từng thêm lúc tạo
  tính năng ban đầu (2026-07-30). Lý do người dùng đưa ra: hành động loại người không phải là ký/duyệt
  văn bản, chỉ là bước dọn danh sách trước khi ký/duyệt thật — không cần xác thực lại. `RemoveOtFormEmployeeDto`
  bỏ field `SecondaryPassword` (nay cùng shape `{ EmployeeId, Reason }` như bản email). FE
  (`OtFormDetail.tsx`) bỏ ô nhập mật khẩu cấp 2 + hint "chưa thiết lập mật khẩu" khỏi modal loại nhân
  viên — modal Duyệt/Từ chối/Ký duyệt (`submit`/`approve`/`reject`) KHÔNG đổi, vẫn giữ nguyên mật khẩu
  cấp 2. Nhân dịp này redesign UI khối "Yêu cầu hỗ trợ khác" (`OtFormDetail.tsx` +
  `OtFormEmailConfirmPage.tsx`) từ text phẳng sang badge Có/Không (icon `Check`/`X`, màu xanh lá/xám)
  + icon theo mục (`Utensils`/`Car`/`Printer`) cho dễ đọc hơn.

#### §Giao diện & song ngữ OT Form — các luật rút ra (2026-07-31)

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

### §Cây chức vụ (JobTitle) — Giai đoạn 1: nền tảng (2026-08-06)

Chuẩn bị thay thế `UserApprovalScope` thủ công bằng 1 cây chức vụ tự suy luận chuỗi duyệt OT (theo
`RankOrder`, bắc cầu qua các cấp trống trong cùng Department, dừng ở đúng 1 trong 3 `TerminalLevel`).
Thiết kế đầy đủ + các quyết định đã chốt với người dùng: `~/.claude/plans/role-ng-vai-m-t-wise-mountain.md`.

**Đã xong (Giai đoạn 1 — nền tảng, CHƯA đụng vào logic duyệt OtForm hiện tại):**
- Entity `JobTitle` + enum `JobTitleTerminalLevel` (`None=0/DepartmentManager=1/WorkshopManager=2/GeneralDirector=3`).
- CRUD chuẩn `JobTitleController` (`Attendance.JobTitle.{View,Create,Update,Delete}`, seed migration
  Identity `AddJobTitlePermissions`, gán qua subquery theo `Attendance.Department.Create` — chỉ Admin).
  `JobTitleService` validate: mã trùng (`ThrowIfDuplicateCode`), tối đa 1 `TerminalLevel` non-None đang
  active, không xoá được nếu còn `Employee` đang giữ chức vụ đó.
- `Employee.JobTitleId` (nullable FK, `OnDelete Restrict`) — 1 nhân viên chỉ giữ đúng 1 chức vụ, không
  kiêm nhiệm. `EmployeeDto`/`Create`/`UpdateEmployeeDto` có thêm `jobTitleId`/`jobTitleName`.
- Migration `AddJobTitle` (Attendance DB) — tạo bảng `JobTitles`, cột `Employees.JobTitleId`, seed sẵn
  14 chức vụ theo bảng người dùng cung cấp. Mã `Id` gốc 15 ("Senior Manager") trùng mã `SM` với `Id`
  gốc 12 ("Section Manager") trong dữ liệu gốc — lỗi nhập liệu đã xác nhận với người dùng, seed dùng
  mã `SRM` thay thế. 3 chức vụ cuối (`M`=Manager, `FM`=Factory Manager, `GM`=General Director) seed sẵn
  `TerminalLevel` tương ứng Trưởng phòng/Trưởng Xưởng/TGĐ và `RequiresSignature=true`; 11 chức vụ còn
  lại `TerminalLevel=None`, `RequiresSignature=false` — Admin tự chỉnh lại qua màn "Danh mục ▸ Chức vụ"
  nếu cần.
- FE: tab "Chức vụ" trong `CategoryManagement.tsx` (`JobTitleList.tsx`/`JobTitleForm.tsx`, khuôn giống
  `OtCaseList`/`OtCaseForm`); `EmployeeForm.tsx` có thêm dropdown gán Chức vụ (tuỳ chọn); `EmployeeList.tsx`
  có thêm cột Chức vụ, hiện badge đỏ "Chưa gán chức vụ" khi `jobTitleId == null` để Admin rà soát trước
  khi bật tính năng chuỗi duyệt tự động cho 1 Department.

**Đã xong (Giai đoạn 2 — engine suy luận chuỗi, XÂY SONG SONG, chốt qua AskUserQuestion 2026-08-06),
SAU ĐÓ ĐÃ SỬA LẠI THEO PHẢN HỒI NGƯỜI DÙNG cùng ngày (xem Giai đoạn 2b ngay dưới):**
- `IJobTitleApprovalChainService`/`JobTitleApprovalChainService` (`Attendance.Application/Services/`)
  — thuật toán suy luận thuần đọc, xem chi tiết bản MỚI ở Giai đoạn 2b.
- Endpoint xem trước: `GET /api/JobTitle/resolve-chain?employeeId=&otCaseId=` (`Attendance.JobTitle.View`,
  read-only, không tạo/sửa gì) — trả `ResolveApprovalChainResultDto` (giữ nguyên shape, không đổi khi
  sửa thuật toán ở Giai đoạn 2b).
- FE: tab "Thử chuỗi duyệt" trong `CategoryManagement.tsx` (`ApprovalChainPreviewPanel.tsx`) — chọn 1
  Nhân viên + 1 Trường hợp OT, xem ngay chuỗi bước + candidate từng bước trên dữ liệu thật, để kiểm tra
  thuật toán đúng trước khi quyết định wiring/xoá dữ liệu cũ.
- **Chưa được `OtFormService` gọi tới ở bất kỳ đâu** — cơ chế duyệt OT hiện tại (§Business Logic ở trên)
  vẫn chạy y nguyên, hoàn toàn tách biệt khỏi engine mới này.

**Đã xong (Giai đoạn 2b — sửa thuật toán suy luận + entity `DepartmentApprovalStep`, 2026-08-06):**

Bản đầu của Giai đoạn 2 tự bắc cầu qua MỌI `RankOrder` đang có người giữ giữa người tạo đơn và cấp
đích — người dùng phản hồi cách này khiến 1 đơn phải đi qua quá nhiều bước nếu Phòng ban có đủ người ở
mọi cấp (VD 10 bước cho 1 đơn). Đã sửa theo hướng: **cây duyệt cấu hình TAY cho từng Phòng ban**, không
còn tự động suy ra từ toàn bộ 14 Chức vụ.

- Entity mới `DepartmentApprovalStep` (`DepartmentId`, `StepOrder`, `JobTitleId`, `IsDeleted`) —
  mỗi dòng = 1 bước duyệt CỐ ĐỊNH của 1 Department, theo đúng thứ tự Admin sắp xếp. KHÔNG có
  Create/Update/Delete từng dòng riêng — quản lý kiểu "thay nguyên danh sách" một lần.
- `IDepartmentApprovalStepService`: `GetByDepartmentAsync` (đọc), `ReplaceAsync` (xoá hết bước cũ của
  Department đó, chèn lại theo đúng thứ tự mảng `JobTitleIds` gửi lên — `StepOrder` = index+1). Validate:
  không trùng `JobTitleId` trong cùng 1 lần replace, mọi `JobTitleId` phải tồn tại/active.
- `DepartmentApprovalStepController`: `GET /by-department/{departmentId}`
  (`Attendance.DepartmentApprovalStep.View`), `PUT /by-department/{departmentId}` body
  `{ jobTitleIds: number[] }` (`Attendance.DepartmentApprovalStep.Update`) — seed migration Identity
  `AddDepartmentApprovalStepPermissions`, gán qua subquery theo `Attendance.Department.Create` (Admin).
- `JobTitleApprovalChainService.ResolveChainAsync` viết lại: đọc `DepartmentApprovalStep` của Department
  người tạo (không còn dùng `JobTitle.RankOrder` để bắc cầu tự động — field này giờ CHỈ dùng để loại bỏ
  các bước cấu hình ở cấp ngang/thấp hơn người tạo, tức người tạo không tự duyệt đơn của mình), cắt danh
  sách tại bước đầu tiên có `TerminalLevel` khớp `OtCase.RequiredApprovalLevel`. Nếu Department chưa cấu
  hình cây duyệt, hoặc cây duyệt không tới đúng cấp cần thiết, hoặc 1 bước nào đó chưa có ai giữ đúng
  Chức vụ trong Department → `IsComplete=false` kèm `Warning` cụ thể (**không tự fallback**, đúng
  nguyên tắc quyết định #10 của plan). Bước có `TerminalLevel=WorkshopManager` HOẶC `GeneralDirector`
  tìm candidate TOÀN CÔNG TY (không lọc Department), mirror `ScopeType.All` — sửa 2026-08-08: trước đó
  chỉ `GeneralDirector` dùng chung toàn công ty, `WorkshopManager` vẫn bị lọc theo Department như
  `DepartmentManager`, không khớp nghiệp vụ thật (Trưởng Xưởng cũng là 1 người dùng chung cho nhiều
  Phòng ban, giống Giám đốc — chỉ `DepartmentManager`/cấp trung gian mới thật sự theo từng Department).
  Hệ quả cho việc gán `Employee.GroupId`/`JobTitleId`: **không cần cột phân biệt nào mới** — Trưởng
  Xưởng/Giám đốc gán `GroupId` vào Group bất kỳ (không ảnh hưởng phạm vi duyệt, chỉ cần có 1 Group hợp
  lệ vì FK bắt buộc); Trưởng phòng gán `GroupId` vào BẤT KỲ Group nào thuộc đúng Department cần quản lý
  (filter chỉ so `Group.DepartmentId`, không so giá trị `GroupId` — Trưởng phòng không cần "thuộc" 1 Bộ
  phận cụ thể theo nghĩa thành viên), lưu ý Group đó cũng dùng để liệt kê nhân viên khi lập đơn OT nên
  Trưởng phòng có thể xuất hiện trong danh sách chọn nhân viên của Group đó (cosmetic, không phải lỗi).
- FE: tab "Cây duyệt Phòng ban" (`DepartmentApprovalStepManager.tsx`) — chọn 1 Phòng ban, xem/sửa danh
  sách bước (thêm Chức vụ, xoá, chuyển lên/xuống bằng nút mũi tên), bấm "Lưu cây duyệt" mới gọi API thay
  nguyên danh sách. Phòng ban chưa cấu hình gì → danh sách rỗng, panel "Thử chuỗi duyệt" sẽ báo kẹt.
- Migration `AddDepartmentApprovalStep` (Attendance DB, chỉ tạo bảng `DepartmentApprovalSteps`, KHÔNG
  seed dữ liệu — Admin tự cấu hình từng Phòng ban khi cần) — tách RIÊNG khỏi migration
  `AddRequesterResponsible` (cột `Requester*`/`Responsible*` trên `Group`/`OtForm`, tính năng khác không
  liên quan tới Cây chức vụ, đã có sẵn trong code nhưng chưa từng được migrate — 2 migration được tạo
  tách bạch để không lỡ áp dụng chung 2 việc không liên quan).

**Đã xong (Giai đoạn 2c — chuyển `RequiresSignature` từ `JobTitle` xuống `DepartmentApprovalStep`,
2026-08-07):**

Người dùng chỉ ra lỗ hổng thiết kế: `JobTitle.RequiresSignature` là cờ TOÀN CỤC nên cùng 1 Chức vụ
(VD "Manager") không thể vừa bắt ký ở Phòng ban này vừa chỉ cần xác nhận ở Phòng ban khác — trái với
chính triết lý "cấu hình riêng theo từng Phòng ban" đã chốt ở Giai đoạn 2b. Đã chuyển cờ này xuống
đúng cấp `DepartmentApprovalStep` — mỗi BƯỚC trong cây duyệt của mỗi Phòng ban tự quyết định ký hay
chỉ xác nhận, độc lập với các Phòng ban khác dùng cùng Chức vụ đó.

- `JobTitle` bỏ hẳn `RequiresSignature` — Chức vụ giờ chỉ còn `Code/Name/RankOrder/TerminalLevel`.
- `DepartmentApprovalStep` thêm cột `RequiresSignature:bool` (mặc định `false`).
- `ReplaceDepartmentApprovalStepsDto.JobTitleIds:List<int>` đổi thành `Steps:List<ReplaceDepartmentApprovalStepItemDto>`
  (`{ JobTitleId, RequiresSignature }`) — thứ tự phần tử vẫn là `StepOrder`.
- `JobTitleApprovalChainService.ResolveChainAsync`: `ResolvedApprovalStepDto.RequiresSignature` giờ đọc
  từ `DepartmentApprovalStep.RequiresSignature` (không còn `JobTitle.RequiresSignature`) — shape response
  không đổi, chỉ đổi nguồn dữ liệu.
- FE: bỏ checkbox "Bắt buộc ký khi duyệt" khỏi `JobTitleForm.tsx` + cột tương ứng khỏi `JobTitleList.tsx`.
  `DepartmentApprovalStepManager.tsx`: mỗi bước thêm mới mặc định `requiresSignature=false`; badge
  "Bắt buộc ký"/"Chỉ xác nhận" cạnh mỗi bước giờ là **nút bấm để đổi trạng thái** (`handleToggleSignature`),
  không còn chỉ hiển thị tĩnh — Admin tự bật/tắt cho từng bước trước khi "Lưu cây duyệt".
- Migration `MoveRequiresSignatureToDepartmentApprovalStep` (Attendance DB) — `DropColumn
  JobTitles.RequiresSignature` + `AddColumn DepartmentApprovalSteps.RequiresSignature` (default `false`,
  Admin cần vào lại "Cây duyệt Phòng ban" bật ký cho đúng bước sau khi migrate vì dữ liệu cũ không có
  chỗ suy ra giá trị này theo từng bước).

**Đã xong (Giai đoạn 2d — cờ `IsResponsible` trên `DepartmentApprovalStep`, 2026-08-07):**

Người dùng hỏi: cây duyệt Phòng ban đã có cách chọn "người chịu trách nhiệm" trên form in chưa? Trả
lời: chưa — cơ chế cũ (`Group.RequesterEmployeeId`/`ResponsibleEmployeeId`, cấu hình qua
`GroupForm.tsx`) là tính năng KHÁC, không liên quan Cây chức vụ, và hiện là dữ liệu chết (không FE nào
đọc `OtForm.ResponsibleFullName`). Ô "người chịu trách nhiệm" thật trên `OtFormPrintView.tsx` đang lấy
từ snapshot người duyệt cấp 0 (`OtFormApprovalHistory`, cơ chế Submitter/GroupHead cũ) — cơ chế này
KHÔNG áp dụng được nguyên trạng cho chuỗi động mới vì số bước/thứ tự bước thay đổi theo Phòng ban.
Đã chốt: Admin tự đánh dấu tường minh **đúng 1 bước** trong cây duyệt của mỗi Phòng ban là "người chịu
trách nhiệm" (phương án linh hoạt nhất trong 3 phương án đưa ra — thay vì mặc định cứng "luôn là bước
đầu" hay "luôn là bước cuối").

- `DepartmentApprovalStep` thêm cột `IsResponsible:bool` (mặc định `false`) — đánh dấu bước này là
  "người chịu trách nhiệm" trên form in. Validate ở `DepartmentApprovalStepService.ReplaceAsync`: tối
  đa 1 phần tử trong `Steps` được đặt `IsResponsible=true` mỗi lần replace (400 nếu vi phạm) — có thể
  để cả cây duyệt không có bước nào được đánh dấu (Phòng ban chưa xác định).
- `ReplaceDepartmentApprovalStepItemDto` thêm `IsResponsible:bool`; `DepartmentApprovalStepDto` và
  `ResolvedApprovalStepDto` (kết quả `resolve-chain`, §3.4d) đều có thêm field này để phản ánh đúng
  cấu hình khi xem trước chuỗi duyệt.
- FE: `DepartmentApprovalStepManager.tsx` — mỗi bước thêm badge/nút thứ 2 (biểu tượng ngôi sao,
  `handleSetResponsible`) cạnh badge chữ ký, hành vi kiểu "radio" (bấm bước khác → tự bỏ đánh dấu bước
  cũ, khớp validate "tối đa 1" ở BE; bấm lại chính bước đang đánh dấu → bỏ chọn). `ApprovalChainPreviewPanel.tsx`
  hiển thị thêm badge "Người chịu trách nhiệm" cạnh bước tương ứng khi xem trước.
- Migration `AddIsResponsibleToDepartmentApprovalStep` (Attendance DB) — `AddColumn
  DepartmentApprovalSteps.IsResponsible` (default `false`).
- **Vẫn CHƯA áp dụng vào form in thật** — `OtFormPrintView.tsx` tiếp tục dùng snapshot cấp 0 cũ cho
  tới khi Giai đoạn 3 wiring chuỗi mới vào `OtFormService` thật; lúc đó "người chịu trách nhiệm" sẽ đổi
  nguồn sang bước có `IsResponsible=true` trong chuỗi đã snapshot của đơn, theo đúng pattern
  snapshot-từ-người-duyệt-thật đã dùng cho `OtFormApprovalHistory.ApproverFullName`.

**Đã xong (Giai đoạn 3.1 — wiring thật vào `OtFormService`, 2026-08-07):**

Thay máu hoàn toàn cơ chế xác định người duyệt OT — persist chuỗi đã suy luận vào entity mới
`OtFormApprovalStep`/`OtFormApprovalStepCandidate` (snapshot lúc TẠO đơn, không tính lại theo tổ chức
hiện tại sau đó), thay thế `Submitter`/`GroupHead`/`UserApprovalScope`/`OtFormStatus` 6-giá-trị cũ.
Quyết định thêm đã chốt qua trao đổi với người dùng khi bắt tay code (CLAUDE.md §2 luật 2):
1. **Ai được tạo/sửa đơn cho 1 Group** — bỏ hẳn nhánh `UserApprovalScope(Submitter)`, chỉ còn
   `Employee.GroupId == request.GroupId` (suy qua `Employee.UserName == người gọi`) hoặc Admin. Không
   còn khái niệm "được Admin cấp quyền tạo hộ Group khác mình" — mỗi user chỉ tạo được đơn cho đúng
   Group của chính Employee liên kết với tài khoản mình.
2. **Admin không phải Employee** (tạo hộ đơn) — coi như cấp thấp nhất (`RankOrder=0` ảo) khi suy luận
   chuỗi, chuỗi vẫn chạy đầy đủ từ bước đầu tiên của Department đó.
3. **Chuỗi không đủ (thiếu cấu hình/thiếu người giữ Chức vụ)** — KHÔNG chặn tạo đơn. Đơn vẫn được tạo
   với chuỗi bước cắt cụt tới đâu hay tới đó, `OtForm.ApprovalChainWarning` lưu lại lý do cụ thể, FE
   hiện banner cảnh báo trên màn chi tiết. Đơn có 0 bước (người tạo đã ở cấp cao nhất áp dụng) →
   `Status=Completed` ngay lúc tạo, cộng lũy kế luôn.
4. **"Đơn tổng"** — tạm ngưng hoạt động ở Giai đoạn 3.1, đã redesign xong ở Giai đoạn 3.2 (xem §Đơn tổng).

Chi tiết implementation:
- Entity mới `OtFormApprovalStep` (snapshot `JobTitleCodeSnapshot/NameSnapshot/RequiresSignatureSnapshot/
  IsResponsibleSnapshot/TerminalLevelSnapshot` + `Status` riêng của TỪNG đơn) + `OtFormApprovalStepCandidate`
  (danh sách người đủ điều kiện duyệt bước đó tại thời điểm snapshot) — xem bảng Entity ở đầu phần này.
- `OtFormStatus` redesign sạch: `InApproval=0/Completed=1/Rejected=2`. `OtFormApprovalHistory`/
  `OtFormApprovalEmailToken` đổi cột `ApprovalLevel:int` → `OtFormApprovalStepId:int` (FK).
- `IJobTitleApprovalChainService` thêm `ResolveChainForCreationAsync(creatorEmployeeId?, departmentId,
  otCaseId)` — bản MỀM của `ResolveChainAsync` dùng cho preview (không ném lỗi nếu thiếu Employee/JobTitle,
  mặc định `RankOrder=0`), tách khỏi `ResolveChainAsync` gốc (vẫn "fail loud", dùng cho panel "Thử chuỗi
  duyệt"). Cả 2 dùng chung 1 `ResolveChainCoreAsync` private.
- `OtFormService.CreateAsync`: sau khi tạo `OtForm`, gọi `ResolveChainForCreationAsync` → tạo hàng loạt
  `OtFormApprovalStep`(`Status=Pending`) + `OtFormApprovalStepCandidate` theo đúng thứ tự `StepOrder` →
  set `Status=Completed` nếu 0 bước, ngược lại `InApproval` + gửi mail cho candidate bước đầu tiên.
  **Không còn giai đoạn Draft** — tạo đơn = vào chuỗi duyệt ngay lập tức.
- `ApproveAsync`/`RejectAsync`: tìm "bước đang chờ" = `OtFormApprovalStep` có `Status=Pending` +
  `StepOrder` nhỏ nhất; validate người gọi nằm trong `Candidates` của bước đó; ký thật chỉ bắt buộc nếu
  `RequiresSignatureSnapshot=true`. Approve hết bước cuối → `Completed` + cộng lũy kế; Reject → mọi bước
  `Pending` còn lại chuyển `Skipped`, `Status=Rejected`.
- `RemoveEmployeeCoreAsync`: Admin **luôn bypass** (mở rộng so với cũ — trước chỉ bypass ở cấp Submitter,
  giờ Submitter không còn tồn tại); non-Admin phải là candidate của bước hiện tại.
- Bỏ hẳn `POST /{id}/submit` + `IOtFormService.ApproveSubmitterAsync`. `GetPendingSubmissionsAsync` giữ
  lại (luôn trả rỗng) chỉ để tab FE cũ không 404 — dọn hẳn ở lần dọn FE tiếp theo.
- `GetMyCreateScopesAsync` rút gọn: trả tối đa 1 scope (Group của chính Employee liên kết) hoặc rỗng
  (Admin/tài khoản chưa liên kết Employee).
- Migration `GiaiDoan3JobTitleApprovalStepWiring` (rename cột, tạo 2 bảng mới, đổi FK) — **đã apply lên
  DB thật** (2026-08-07, sau khi người dùng tự xoá dữ liệu OT cũ trên `YevOTManagement`, xem lịch sử ở
  cảnh báo cũ bên dưới, nay đã giải quyết).
- FE (`yev-frontend/src/modules/attendance`): `ot-form.dto.ts`/`ot-form.api.ts` cập nhật theo contract
  mới (`approvalSteps[]`, `approvalChainWarning`, `stepOrder`+`jobTitleNameSnapshot` thay `approvalLevel`).
  `OtFormListPage.tsx`/`OtFormDetail.tsx`/`OtFormEmailConfirmPage.tsx` bỏ hẳn timeline cố định 5-cấp,
  vẽ timeline ĐỘNG từ `form.approvalSteps` (số bước co giãn theo Phòng ban). `CreateOtFormPage.tsx` bỏ
  đường dẫn `/submit`. Nav sidebar ẩn tạm mục "Đơn tổng" ở Giai đoạn 3.1, bật lại ở Giai đoạn 3.2
  (`OtManagerSidebar.tsx`).
  `OtFormPrintView.tsx`: 3 ô ký cuối (Trưởng phòng/Trưởng xưởng/TGĐ) tra theo `TerminalLevelSnapshot`
  (vẫn đúng vì 3 giá trị 1/2/3 trùng cả 2 enum cũ/mới); "Người chịu trách nhiệm" đổi nguồn sang bước có
  `IsResponsibleSnapshot=true` (đúng nguyên bản dự tính ở Giai đoạn 2d); 2 ô "Người đề nghị" (thiết kế
  giấy chỉ có 2 chỗ trống) tạm dùng bước trung gian ĐẦU và CUỐI của chuỗi — **giải pháp tạm**, số bước
  trung gian giờ co giãn nên không còn khớp hoàn toàn ý nghĩa "Trưởng nhóm | Trưởng Bộ phận" cũ, cần
  thiết kế lại đúng nghĩa ở Giai đoạn 3.2.

> **✅ Đã giải quyết (2026-08-07)**: migration `GiaiDoan3JobTitleApprovalStepWiring` cần xoá dữ liệu OT
> cũ trên DB thật `YevOTManagement` trước khi apply (FK mới không tương thích ngược với `OtForm`/
> `OtFormApprovalHistory`/`OtFormApprovalEmailToken` cũ). Lệnh `DELETE` bị hệ thống agent tự động chặn
> (an toàn tầng công cụ) nên người dùng đã tự chạy SQL xoá; sau đó migration apply thành công, backend
> đã chạy lại và luồng mới đã test sống qua API thật.
>
> **Bug phát sinh trong lúc test + đã sửa (2026-08-07)**: điều kiện set `Status=Completed` lúc tạo đơn ở
> `OtFormService.CreateAsync` (dòng ghi chú "Đơn có 0 bước → Status=Completed" ở trên) qua 2 lần sửa sai
> trước khi đúng: (1) ban đầu chỉ xét `Steps.Count==0`, conflate với case "Phòng ban chưa cấu hình chuỗi"
> (cũng ra `Steps.Count==0` nhưng phải kẹt ở `InApproval`, không phải `Completed`); (2) lần sửa đầu đổi
> nhầm sang chỉ xét `chainResult.IsComplete`, nhưng `IsComplete` cũng `true` khi chuỗi có ĐỦ bước thật +
> đủ candidate (nghĩa "chuỗi sẵn sàng", không phải "đơn đã xong") → mọi đơn có chuỗi hợp lệ bị tự đánh
> dấu `Completed` sai ngay từ đầu. Điều kiện đúng: `Steps.Count == 0 && IsComplete == true` (thật sự
> không có bước nào cần duyệt). 2 đơn test dính bug (Id=30 xoá mềm vì là data rác trước khi cấu hình
> xong, Id=31 sửa lại `Status=InApproval` vì có 2 bước thật đang chờ, không mất dữ liệu).

**Đã xong (2026-08-07 — hỗ trợ thao tác gán Chức vụ, theo phản hồi người dùng khi test Giai đoạn 3.1):**

Sau khi test Giai đoạn 3.1 sống, người dùng nhận thấy 2 điểm bất tiện khi cấu hình Cây chức vụ: (a) màn
"Nhân viên" không lọc được theo Phòng ban/Bộ phận nên khó tìm đúng người cần gán Chức vụ; (b) màn "Cây
duyệt Phòng ban" không cho biết ai đang giữ mỗi Chức vụ, cũng không gán được Chức vụ ngay tại đó — phải
mở riêng màn "Nhân viên" để tra/sửa từng người. Đã bổ sung:

- **BE**: `GET /api/Employee/grid-list` thêm 2 query param optional `DepartmentId`/`GroupId` (lọc qua
  `Group.DepartmentId`/`GroupId`, xem [attendance-api-fe.md §3.5](attendance-api-fe.md)). `GET
  /api/Employee/by-department/{departmentId}` (mới) → toàn bộ nhân viên active của Phòng ban (mọi Group
  con), dùng cho màn Cây duyệt.
- **FE `EmployeeList.tsx`**: thêm 2 dropdown lọc Phòng ban (load 1 lần)/Bộ phận (cascading theo Phòng
  ban đã chọn, giống pattern `GroupApi.getGroupsByDepartment` đã dùng ở nơi khác) cạnh ô tìm kiếm.
- **FE `DepartmentApprovalStepManager.tsx`**: khi chọn 1 Phòng ban, gọi thêm `Employee/by-department`,
  render ngay dưới mỗi bước trong cây duyệt:
  - Danh sách ai đang giữ đúng Chức vụ đó trong Phòng ban (badge tên + mã NV, rỗng thì báo "chưa có ai
    giữ"), mỗi badge có nút "x" nhỏ để **bỏ** Chức vụ của người đó (gọi `PUT /api/Employee/{id}` với
    `jobTitleId=null`, áp dụng ngay).
  - Ô dropdown "+ Thêm người giữ" liệt kê nhân viên Phòng ban CHƯA giữ đúng Chức vụ này (kèm Chức vụ
    hiện tại nếu có, để biết đang "chuyển" từ đâu) — chọn 1 người là gán ngay `jobTitleId` = Chức vụ của
    bước đó, tự reset về rỗng sau khi gán xong.
  - Cả 2 thao tác gọi thẳng `PUT /api/Employee/{id}` áp dụng ngay lập tức, **không** qua nút "Lưu cây
    duyệt" (nút đó chỉ lưu danh sách bước `DepartmentApprovalStep`, khác hẳn sửa `Employee.JobTitleId`).
  - Thiết kế ban đầu (2026-08-07) từng thử 1 bảng riêng liệt kê TOÀN BỘ nhân viên Phòng ban kèm dropdown
    Chức vụ đặt bên dưới cây duyệt — người dùng phản hồi dài dòng khó dùng, đã bỏ hẳn bảng đó, chuyển
    thao tác thêm/xoá vào ngay trong khối "Đang giữ" của từng bước như mô tả trên.

**Đã xong (Giai đoạn 3.2 — Redesign "Đơn tổng", 2026-08-07):** xem §Đơn tổng ở trên — điều kiện gom đổi
từ `OtFormStatus.Pending` cố định sang "bước đang chờ hiện tại có TerminalLevelSnapshot=DepartmentManager",
toàn bộ logic duyệt/từ chối/loại nhân viên tái dùng nguyên `ApproveAsync`/`RejectAsync`/`RemoveEmployeeAsync`
không đổi. Background service + nav FE đã bật lại.

**Đã xong (Giai đoạn 3.2 — dọn polish còn lại, 2026-08-08):**
1. **Giới hạn 1–2 bước trung gian ĐƯỢC "BẮT BUỘC KÝ"/Phòng ban** — khớp đúng 2 ô "Người đề nghị" cố định
   trên giấy in `YEV-22-024` (ảnh nền, không thêm ô được), và LUÔN phải có ít nhất 1 người ký ở đây (không
   cho đơn đi thẳng từ người tạo lên Trưởng phòng mà bỏ trống cả 2 ô).
   **Sửa 2 lần trong cùng ngày (2026-08-08), lần 2 mới là thiết kế đúng — người dùng phản hồi qua UI
   thật:**
   - *Bản 1* (sai): giới hạn tổng SỐ BƯỚC trung gian (`JobTitle.TerminalLevel=None`) trong khoảng [1,2],
     bất kể bước đó `RequiresSignature` là gì. Chỉ validate tối đa lúc đầu (bản 0, thiếu tối thiểu), thêm
     tối thiểu ở bản 1.
   - *Bản 2* (đúng, thay thế hoàn toàn bản 1): người dùng chỉ ra 2 khái niệm bị nhầm lẫn — **"bước duyệt
     trung gian"** (1 cấp phải chủ động xác nhận đơn mới đi tiếp, số lượng KHÔNG giới hạn) khác với
     **"người ký vào ô Người đề nghị"** (chỉ những bước có `RequiresSignature=true`, đúng số này mới bị
     giới hạn 1-2 vì giấy in chỉ có 2 ô). Ví dụ thật: Department 6 có 2 bước trung gian (CHIEF, SM) —
     CHIEF chỉ "Chỉ xác nhận" (`RequiresSignature=false`), SM cũng vậy — tức Phòng ban này hiện có 2 bước
     trung gian nhưng **0 người thực sự ký**, đúng lỗ hổng mà bản 1 không bắt được (bản 1 chỉ đếm SỐ
     BƯỚC=2, coi là hợp lệ). `DepartmentApprovalStepService.ReplaceAsync` đổi sang đếm số bước
     `TerminalLevel=None && RequiresSignature=true`, ném `DomainException` nếu ngoài khoảng [1,2] khi
     `request.Steps.Count > 0` (Phòng ban chưa cấu hình gì — danh sách rỗng — vẫn là trạng thái hợp lệ
     riêng, không bị chặn); KHÔNG còn giới hạn tổng số bước trung gian.
   - Đã verify sống trên Department 6 thật (capture nguyên trạng trước, restore đúng nguyên trạng sau —
     xem ghi chú restore bên dưới): gửi lại đúng cấu hình gốc (CHIEF/SM đều `RequiresSignature=false`, M
     `=true`) → 400 đúng lỗi mới (0 người ký) — **xác nhận Department 6 thật sự đang có lỗ hổng dữ liệu
     này, cần Admin vào bật "Bắt buộc ký" cho ít nhất 1 trong CHIEF/SM**; thêm 1 bước trung gian thứ 3
     (SUP, `RequiresSignature=false`) cùng CHIEF `=true` (1 người ký, 3 bước tổng) → lưu thành công, đúng
     ý "không giới hạn tổng số bước"; bật cả 3 bước trung gian `RequiresSignature=true` → 400 (vẫn giới
     hạn tối đa 2 người ký). Sau khi test xong, phục hồi lại ĐÚNG nguyên trạng ban đầu của Department 6
     bằng SQL trực tiếp (không qua API) — vì chính nguyên trạng đó (0 người ký) giờ bị validate mới từ
     chối, không thể phục hồi qua API được nữa; đây KHÔNG phải sửa dữ liệu, chỉ là undo thao tác test.
   - FE `DepartmentApprovalStepManager.tsx`: bỏ hẳn giới hạn tổng số bước trung gian ở dropdown "+ Thêm
     bước" (không còn ẩn bớt lựa chọn); `handleToggleSignature` chặn bật "Bắt buộc ký" cho bước trung
     gian thứ 3 trở lên (toast lỗi), tắt luôn được phép không giới hạn; khoá nút "Lưu" + hint đỏ khi 0
     bước "Bắt buộc ký".
   - `OtFormPrintView.tsx`: `FormHeaderFields.intermediateSteps` đổi từ "toàn bộ bước
     `TerminalLevelSnapshot=None`" sang "chỉ bước `TerminalLevelSnapshot=None && RequiresSignatureSnapshot=true`"
     — vì giờ có thể có nhiều bước "Chỉ xác nhận" không nên bị in tên vào ô "Người đề nghị". Logic
     "đầu"/"cuối" trong danh sách ĐÃ LỌC này vẫn đúng như trước (luôn ≤2 phần tử).
2. **UX "Chờ tôi duyệt" khi 1 bước có nhiều candidate** — `OtFormListItemDto` thêm
   `CurrentStepCandidateCount:int` (đếm candidate của bước Pending có StepOrder nhỏ nhất; 0 nếu đơn
   không còn `InApproval`). FE: danh sách (`OtFormListPage.tsx`) hiện "Đang chờ duyệt (1 trong N người)"
   thay vì chỉ "Đang chờ duyệt" khi N>1; timeline chi tiết đơn (`OtFormDetail.tsx` +
   `OtFormEmailConfirmPage.tsx`, dùng chung `OtFormApprovalStepDto.candidates[]` đã có sẵn từ Giai đoạn
   3.1) hiện "Đang chờ (1/N)" kèm tooltip liệt kê tên từng candidate ở bước đang chờ.
3. **Dọn hẳn `GetPendingSubmissionsAsync`** (luôn trả rỗng từ Giai đoạn 3.1) — xoá method khỏi
   `IOtFormService`/`OtFormService`, xoá route `GET /OtForm/pending-submissions` khỏi
   `OtFormController`. FE: xoá tab "Chờ tôi ký duyệt" khỏi `OtFormTabsPage.tsx`, xoá mode
   `pending-submissions` khỏi `OtFormListPage.tsx`, xoá hàm `getPendingSubmissions` khỏi `ot-form.api.ts`,
   xoá key i18n liên quan (`tabPendingSubmissions`/`titlePendingSubmissions`/`descPendingSubmissions`).
4. **Xoá hẳn `UserApprovalScope`/`ApprovalLevel`/`ScopeType`** — audit xác nhận không còn nơi nào trong
   luồng duyệt OT thật đọc tới (chỉ tự tham chiếu trong chính CRUD của nó), người dùng xác nhận xoá luôn
   (không chỉ ẩn UI). Đã xoá: entity `UserApprovalScope`, enum `ApprovalLevel`/`ScopeType`, service/
   controller/repository/DTO tương ứng, property `UserApprovalScopes` khỏi `IAttendanceUnitOfWork`/
   `AttendanceUnitOfWork`/`AttendanceDbContext`. Migration `RemoveUserApprovalScope` (Attendance DB) —
   `DropTable UserApprovalScopes` — đã apply lên `YevOTManagement` thật (bảng có 17 dòng, 5 active, đã
   mất theo đúng thao tác xoá dữ liệu thật được xác nhận trước). Migration
   `RemoveUserApprovalScopePermissions` (Identity DB) — xoá 3 permission
   `Attendance.UserApprovalScope.View/Create/Delete` + `RolePermissions` liên quan — đã apply lên
   `YevIdentityManagement`. FE: xoá màn `UserApprovalScopeManager.tsx` + route `/ot/approval-scopes` +
   `user-approval-scope.api.ts`/`.dto.ts`, gỡ mục "Phân quyền duyệt" khỏi `OtManagerSidebar.tsx`, xoá
   namespace i18n `Attendance.UserApprovalScope` + 2 const dead code liên quan (`APPROVAL_LEVEL_SCOPE_TYPE`,
   `scopeTypeLabels` trong `enums.ts`). `OtCase.RequiredApprovalLevel`/`approvalLevelLabels` (đọc như
   `JobTitleTerminalLevel` từ Giai đoạn 3.1) **giữ nguyên**, không liên quan — đã sửa lại comment cho
   đúng thay vì còn ghi "enum ApprovalLevel" (đã xoá).

#### §Xoá đơn kẹt vĩnh viễn (2026-08-08)

Gap đã biết từ Giai đoạn 3.1 nhưng chưa xử lý: nếu lúc tạo đơn, Phòng ban chưa có ai giữ đúng Chức vụ ở
1 bước nào đó, `OtFormApprovalStep` tương ứng có 0 `OtFormApprovalStepCandidate` — đơn kẹt cứng ở bước
đó **vĩnh viễn**, kể cả sau khi Admin gán đủ người sau này, vì candidate đã snapshot 1 lần lúc tạo và
không có cơ chế resolve lại. Approve/Reject không có bypass Admin (khác RemoveEmployee) nên không ai gỡ
được. Người dùng chốt hướng xử lý: **cho Admin xoá thẳng đơn đó** thay vì xây API "resolve lại chuỗi".

- `POST /api/OtForm/{id}/delete`, body `{ reason }` (`[Required]`) — `[RequirePermission("Attendance.OTForm.Delete")]`,
  permission mới **CHỈ gán cho Admin** (migration `AddOtFormDeletePermission`, piggyback trên
  `Attendance.Department.Create` như `AddAttendanceSettingPermission`).
- **Chặn nếu `Status=Completed`** (400) — đơn đó đã cộng lũy kế THẬT vào ledger
  (`EmployeeAccumulationHistory`), xoá sẽ làm sai số liệu đã dùng cho lương, không tự động đảo ngược an
  toàn được. Chỉ xoá được đơn `InApproval` (đúng use-case kẹt vĩnh viễn) hoặc `Rejected`.
- Soft-delete (`IsDeleted=true`) — giữ nguyên toàn bộ dữ liệu đơn để audit, set thêm
  `DeletedByUserName/DeletedByFullName/DeletedAt/DeleteReason` trên `OtForm` (cùng triết lý với
  `OtFormEmployee.RemovedAt*`). `Status` giữ nguyên giá trị cũ, không đổi.
- **(2026-08-19)** Không còn bước "đảo ngược lũy kế Dự kiến" nào nữa — Dự kiến không lưu ở đâu cả, tính
  lại từ `OtFormEmployee`/`OtForm` mỗi lần cần (xem §Lũy kế dự kiến); đơn vừa `IsDeleted=true` tự động
  không còn được tính vào Dự kiến ở lần đọc kế tiếp (điều kiện lọc có `!OtForm.IsDeleted`), không cần
  code gì thêm ở `DeleteAsync`.
- Migration `AddOtFormDeleteFields` (Attendance DB) — `AddColumn` 4 cột trên `OtForms`.
- FE: nút "Xoá đơn" (icon `Trash2`, viền đỏ) ở `OtFormDetail.tsx`, chỉ hiện khi có permission **và**
  `status !== Completed` (ẩn sẵn thay vì để user bấm rồi mới nhận lỗi 400) — modal xác nhận bắt buộc
  nhập lý do, thành công thì điều hướng về `/ot/list` (đơn đã xoá không còn xem được qua `GET /{id}`).
- Đã verify sống qua API thật (2026-08-08): tạo 1 đơn test → xoá thiếu `reason` → 400 đúng message; xoá
  có `reason` → thành công, `GET /{id}` sau đó trả 404; DB xác nhận `IsDeleted=1` + đủ 4 field audit.
  Permission xác nhận chỉ Role `Admin` được gán. **Chưa verify lại** phần lũy kế Dự kiến sau đợt
  REDESIGN 2026-08-19 (xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc).

#### §Gán tổ chức theo Chức vụ — Trưởng phòng/Trưởng Xưởng/Giám đốc (2026-08-08)

Gap phát hiện khi trao đổi với người dùng: `Employee.GroupId` trước đây **bắt buộc** (NOT NULL) cho
MỌI nhân viên — kể cả Trưởng phòng/Trưởng Xưởng/Giám đốc, dù thực tế 3 vai trò này không thuộc 1 Bộ
phận cụ thể nào (Trưởng phòng quản lý CẢ Phòng ban, không phải 1 Bộ phận riêng; Trưởng Xưởng/Giám đốc
dùng chung 1 người cho toàn công ty). Trước bản sửa này, `JobTitleApprovalChainService` đã coi
`WorkshopManager`/`GeneralDirector` là "dùng chung toàn công ty, không lọc Department" trong TRUY VẤN
tìm candidate — nhưng `Employee.GroupId` vẫn buộc phải trỏ vào 1 Group cụ thể, tạo dữ liệu "kỹ thuật"
không phản ánh đúng nghiệp vụ. Người dùng chốt hướng **đổi schema cho tường minh** thay vì chỉ vá ở FE.

- `Employee.GroupId` đổi thành **nullable** (`int?`); thêm cột mới `Employee.DepartmentId:int?` (FK
  Restrict tới `Department`, không có `ICollection<Employee>` ngược trên `Department`).
- Quy tắc field nào bắt buộc/cấm phụ thuộc **`JobTitle.TerminalLevel`** của `JobTitleId` đang gán, validate
  ở `EmployeeService.ValidateOrganizationAssignmentAsync` (gọi từ cả `CreateAsync`/`UpdateAsync`, KHÔNG
  phải constraint DB vì mỗi Chức vụ có luật khác nhau):
  - `None` (chưa gán Chức vụ, hoặc Chức vụ trung gian) → `GroupId` **bắt buộc**, `DepartmentId` phải để trống.
  - `DepartmentManager` (Trưởng phòng) → `DepartmentId` **bắt buộc**, `GroupId` phải để trống (không
    thuộc Bộ phận cụ thể nào — chỉ quản lý Phòng ban).
  - `WorkshopManager`/`GeneralDirector` (Trưởng Xưởng/Giám đốc) → cả `GroupId` lẫn `DepartmentId` đều
    phải để trống (dùng chung toàn công ty).
- `JobTitleApprovalChainService.ResolveChainCoreAsync` (nhánh dept-scoped, tức `DepartmentManager`/cấp
  trung gian) sửa để khớp CẢ 2 đường tới Department: qua `Group.DepartmentId` (nhân viên thường) HOẶC
  trực tiếp `Employee.DepartmentId` (Trưởng phòng). `ResolveChainAsync` (endpoint test thủ công
  `GET /api/JobTitle/resolve-chain`) thêm guard: từ chối rõ ràng nếu `creator.GroupId` null (Trưởng
  phòng/Trưởng Xưởng/Giám đốc không tạo đơn OT cho chính họ qua luồng này).
- `EmployeeService` — mọi query khác (`GetPagedAsync`/`GetAllActiveAsync`/`GetByDepartmentIdAsync`/
  `GetByIdAsync`/`GetByUserNameAsync`) cập nhật projection `GroupNameVn`/`DepartmentNameVn` nullable-safe;
  bộ lọc `DepartmentId` ở `GetPagedAsync`/`GetByDepartmentIdAsync` khớp cả 2 đường (trực tiếp + qua Group).
- Migration `MakeEmployeeGroupNullableAddDepartment` (Attendance DB) — `AlterColumn GroupId NULL` +
  `AddColumn DepartmentId` + FK + index. KHÔNG cần migration Identity (không thêm permission mới).
- FE `EmployeeForm.tsx`: đổi thứ tự — chọn **Chức vụ trước**, Bộ phận/Phòng ban theo sau và ẩn/hiện tự
  động theo `TerminalLevel` của Chức vụ đã chọn (đổi Chức vụ giữa 3 nhóm sẽ tự reset field Group/Department
  cũ để tránh gửi lẫn). `EmployeeList.tsx` cột "Bộ phận/Phòng ban" hiện `groupNameVn` → fallback
  `departmentNameVn` → fallback "Toàn công ty" (Trưởng Xưởng/Giám đốc).
- FE `DepartmentApprovalStepManager.tsx` (nút gán nhanh Chức vụ) — **sửa lại cùng ngày** (bản đầu chỉ
  pass-through `groupId`/`departmentId` cũ, gán nhanh sang Trưởng phòng/Trưởng Xưởng/Giám đốc cho 1
  người đang có `GroupId` thật luôn bị BE từ chối 400): giờ tự tính `groupId`/`departmentId` mới theo
  `TerminalLevel` của Chức vụ VỪA CHỌN — chọn Trưởng phòng → set `departmentId` = đúng Phòng ban đang
  xem trên màn này, `groupId=null`; chọn Trưởng Xưởng/Giám đốc → cả 2 đều `null`; bỏ hẳn Chức vụ (nút
  X) của 1 người đang là Trưởng phòng/Trưởng Xưởng/Giám đốc (không có `groupId` thật) → màn này không
  đủ thông tin chọn lại đúng Bộ phận, chặn trước bằng toast lỗi thay vì để BE trả 400 khó hiểu, yêu cầu
  sửa qua form Nhân viên đầy đủ.
- Sửa thêm 1 lỗi phát hiện lúc audit (không liên quan trực tiếp thay đổi trên, nhưng cùng file):
  `EmployeeService.GetByIdAsync` trước đó thiếu `!IsDeleted` trong predicate — nhân viên đã xoá mềm vẫn
  gọi `GET /api/Employee/{id}` ra được. Đã thêm điều kiện lọc.
- **Dữ liệu thật đã chuẩn hoá lại (2026-08-08)**: nhân viên duy nhất đang giữ 1 Chức vụ cấp cuối lúc audit
  (`Id=3371`, mã `72266`, Trưởng phòng) vẫn còn `GroupId=6` từ trước khi có field `DepartmentId` — đã sửa
  qua chính `PUT /api/Employee/3371` (không sửa tay SQL) thành `GroupId=null`/`DepartmentId=6` (đúng
  Department của Group cũ). Xác nhận lại bằng .NET `SqlClient` đọc trực tiếp — `LastName` "Nguyễn Văn"
  giữ nguyên đúng Unicode code point (U+1EC5 `ễ`, U+0103 `ă`) sau khi sửa.
- Đã verify sống qua API thật (2026-08-08): tạo nhân viên test JobTitle=FM không kèm Group/Department
  → thành công; kèm `groupId` → 400 đúng message; tạo JobTitle=M không kèm `departmentId` → 400; kèm
  `departmentId` → thành công, `groupId` trả về null. Gán thêm `UserName` cho nhân viên FM test rồi gọi
  `resolve-chain` cho 1 nhân viên ở Department 6 (không liên quan gì tới Department của nhân viên FM
  test) — candidate xuất hiện đúng ở bước FM, xác nhận cơ chế "dùng chung toàn công ty" hoạt động đúng
  dù nhân viên đó không gắn với Department nào cả. Lọc `GetPagedAsync` theo `DepartmentId=6` xác nhận có
  nhân viên M test (gán trực tiếp `DepartmentId=6`) nhưng KHÔNG có nhân viên FM test (đúng, vì FM không
  gắn Department cụ thể nào). Đã xoá 2 nhân viên test ngay sau khi verify xong (soft-delete).

#### §Người tạo tự ký ô "Người đề nghị" khi không còn ai ký thay (2026-08-08)

Gap phát hiện từ chính bug report §Cây duyệt Phòng ban ở trên: khi người tạo đơn đã ở cấp cao hơn/bằng
MỌI Chức vụ trung gian "Bắt buộc ký" của Phòng ban (VD chính họ đã là Section Manager, tạo đơn cho
nhóm mình), `JobTitleApprovalChainService` lọc bỏ hết các bước đó khỏi chuỗi (đúng luật "người tạo
không tự duyệt đơn của mình") — nhưng hệ quả là ô "Người đề nghị" trên giấy in **không còn ai để in
tên/chữ ký vào**, dù thực tế người tạo chính là người cần đứng tên ở đó. Người dùng chốt: trường hợp
này chính người tạo phải tự ký ô đó (dùng chữ ký đã đăng ký sẵn ở `UserSignature`, không cần thao tác
ký riêng lúc tạo đơn) và mặc nhiên cũng là "Người chịu trách nhiệm".

- `ResolveApprovalChainResultDto.RequiresCreatorSelfSign:bool` (mới) — tính trong
  `JobTitleApprovalChainService.ResolveChainCoreAsync`: `true` khi TOÀN BỘ Chức vụ trung gian
  `TerminalLevel=None && RequiresSignature=true` đã cấu hình cho Department có `RankOrder <=` cấp của
  chính người tạo (`creatorRank`), VÀ Department có cấu hình ít nhất 1 Chức vụ như vậy (Department chưa
  cấu hình gì thì KHÔNG tính là self-sign — đó là gap dữ liệu khác, đã có cảnh báo riêng). Tính trước
  khi lọc `relevantSteps` (phải so với toàn bộ Chức vụ đã cấu hình, không chỉ phần còn lại trong chuỗi
  của đơn này) và áp dụng cho MỌI nhánh return (kể cả nhánh "người tạo đã ở cấp bằng/cao hơn cấp duyệt
  cuối — 0 bước nào cả", đảm bảo chữ ký người tạo vẫn được snapshot dù đơn hoàn tất ngay không qua bước
  duyệt nào).
- `OtFormService.CreateAsync`: khi `chainResult.RequiresCreatorSelfSign`, tra `UserSignature` của chính
  `createdByUserName` — không có (chưa đăng ký chữ ký) → `DomainException` chặn tạo đơn, cùng message/cơ
  chế với `ApproveAsync` khi 1 bước `RequiresSignatureSnapshot=true` (yêu cầu `PUT /api/UserSignature/me`
  trước). Có → snapshot `SignatureImage` vào cột mới `OtForm.CreatorSignatureImage:byte[]?`.
- **"Người chịu trách nhiệm" KHÔNG cần field/logic riêng** — `OtFormPrintView.tsx` đã fallback sẵn về
  `createdByFullName` khi không có bước nào `isResponsibleSnapshot` trong `form.approvalSteps` (đúng
  trường hợp này, vì bước đó cũng đã bị lọc khỏi chuỗi cùng lý do), nên tự động đúng mà không cần sửa.
- `OtFormPrintView.tsx`: `SignatureCell` đổi prop `history` từ `OtFormApprovalHistoryDto` đầy đủ sang
  type con `SignatureDisplay` (chỉ 4 field cần để vẽ 1 ô ký) — dùng chung được cho cả lịch sử duyệt thật
  (`findHistory`) lẫn `selfSignDisplay` tổng hợp từ `createdByFullName`/`createdByUserName`/
  `creatorSignatureImage` (không có `OtFormApprovalHistory` tương ứng vì đây không phải 1 hành động
  duyệt thật). Ô "Người đề nghị" slot `"first"` nhận `selfSignDisplay` khi `intermediateSteps.length===0`
  (không còn bước "Bắt buộc ký" nào); slot `"last"` luôn để trống trong trường hợp này (chỉ 1 người ký).
- **Dọn hẳn cơ chế `Group.RequesterEmployeeId/ResponsibleEmployeeId` cũ** (thiết kế trước Cây chức vụ,
  Admin gán tay "Người đề nghị/Người chịu trách nhiệm mặc định" per-Group qua `GroupForm.tsx`) — xác
  nhận không còn được `OtFormPrintView.tsx` đọc (đã chuyển hẳn sang đọc từ `approvalSteps`/
  `isResponsibleSnapshot` từ Giai đoạn 3.1), người dùng xác nhận xoá luôn thay vì giữ song song 2 cơ chế.
  Xoá: `Group.RequesterEmployeeId/ResponsibleEmployeeId` + nav `RequesterEmployee/ResponsibleEmployee`,
  `OtForm.RequesterEmployeeId/RequesterFullName/RequesterUserName/ResponsibleEmployeeId/
  ResponsibleFullName/ResponsibleUserName`, field tương ứng trên `GroupDto`/`CreateGroupDto`/
  `UpdateGroupDto`/`CreateOtFormDto`/`OtFormDto`, toàn bộ mapping trong `GroupService.cs`/
  `OtFormService.cs`, 2 dropdown "Người đề nghị/chịu trách nhiệm mặc định" trong `GroupForm.tsx`. Migration
  `RemoveOldRequesterResponsibleAddCreatorSignature` (Attendance DB).
  - **Lưu ý migration**: `dotnet ef migrations add` tự sinh `DropIndex IX_Groups_RequesterEmployeeId/
    ResponsibleEmployeeId` (vì model C# TRƯỚC đó khai báo FK, EF quy ước tạo index) nhưng DB thật
    **không có** 2 index này — khớp ghi chú cũ ở `AddRequesterResponsible` (schema này được áp tay ngoài
    EF từ trước, migration gốc chỉ stamp vào `__EFMigrationsHistory` chứ không chạy lại DDL) — đã bỏ 2
    `DropIndex` khỏi migration. Tương tự, `OtForms` có sẵn 2 FK vật lý `FK_OtForms_Employees_Requester/
    Responsible` mà model C# của `OtForm` chưa từng khai báo (không có navigation property) nên
    `migrations add` không tự sinh `DropForeignKey` cho chúng — phải thêm tay trước khi `DropColumn`,
    nếu không SQL Server báo lỗi 5074 (cột đang bị FK khác tham chiếu). Cả 2 lỗi đều làm transaction tự
    rollback (không mất dữ liệu) khi phát hiện lúc `dotnet ef database update`, đã sửa xong migration
    trước khi apply thật.
- Đã verify sống qua API thật (2026-08-08, read-only): `GET /api/JobTitle/resolve-chain?employeeId=3370&otCaseId=1`
  (nhân viên SM rank 9, chính là người tạo đơn #33 ở Department 6) trả `requiresCreatorSelfSign: true`,
  đúng bug report gốc. `GET /api/Group/grid-list`, `GET /api/OtForm/33` sau migration vẫn trả đúng, không
  còn field cũ, `creatorSignatureImage: null` cho đơn tạo trước khi có tính năng này (đúng, không snapshot
  ngược cho đơn cũ).

#### §Giai đoạn 4 — Thu gọn Chức vụ 6 cấp + Cây duyệt tách theo Nhóm + đổi nhãn hiển thị (2026-08-08)

Theo yêu cầu người dùng khi áp Cây chức vụ vào tổ chức thật: (1) 14 cấp Chức vụ quá vụn so với thực
tế — thu gọn còn 6 cấp; (2) nhãn hiển thị FE đổi: cái đang gọi "Phòng ban" (entity `Department`) →
hiển thị **"Bộ phận"**, cái đang gọi "Bộ phận" (entity `Group`) → hiển thị **"Nhóm"** (chỉ đổi CHỮ
hiển thị, KHÔNG đổi tên entity/bảng/cột/route); (3) cây duyệt cấp trung gian phải tách nhỏ xuống theo
từng Nhóm thay vì dùng chung 1 danh sách cho cả Bộ phận.

1. **Thu gọn `JobTitle` 14→6 cấp** — seed mới:

   | Code | Name | RankOrder | TerminalLevel |
   |---|---|---|---|
   | STAFF | Staff | 1 | None |
   | GL | Group Leader | 2 | None |
   | TL | Team Leader | 3 | None |
   | M | Manager | 4 | DepartmentManager |
   | FM | Factory Manager | 5 | WorkshopManager |
   | GM | Director | 6 | GeneralDirector |

   Người dùng chốt: **KHÔNG tự động remap** `Employee.JobTitleId` cũ sang Chức vụ mới — reset về
   `NULL`, Admin tự gán lại thủ công qua UI Nhân viên. Vì `OtFormApprovalSteps.JobTitleId` cũng FK
   thẳng tới `JobTitles` (không chỉ snapshot theo mã/tên), và người dùng xác nhận xoá luôn toàn bộ dữ
   liệu đơn OT hiện có để dễ test lại — migration `SimplifyJobTitleTo6Levels` xoá theo đúng thứ tự FK:
   `OtFormApprovalStepCandidates` → `OtFormApprovalEmailTokens` → `OtFormApprovalHistories` →
   `OtFormApprovalSteps` → `ProcessParts` → `OtFormEmployees` → `OtForms` → `OtFormBatchEmailTokens` →
   `OtFormBatches` → `DepartmentApprovalSteps` → `GroupApprovalSteps` → `UPDATE Employees SET
   JobTitleId=NULL` → xoá 14 `JobTitles` cũ → insert 6 dòng mới. Đã verify sống: `GET
   /api/JobTitle/all` trả đúng 6 dòng, `OtForms`/`Employees.JobTitleId` về 0.

2. **Cây duyệt tách theo Nhóm** — entity mới `GroupApprovalStep` (mirror `DepartmentApprovalStep`,
   khoá `GroupId` thay vì `DepartmentId`) chứa 3 cấp TRUNG GIAN (Staff/Group Leader/Team Leader,
   `TerminalLevel=None`). `DepartmentApprovalStep` rút gọn — chỉ còn chứa 3 cấp CUỐI (Manager/Factory
   Manager/Director), bỏ hẳn cột `IsResponsible` (dời sang `GroupApprovalStep` — "người chịu trách
   nhiệm" luôn là người ở cấp trung gian sát người tạo đơn nhất). Validate 1–2 bước "Bắt buộc ký" +
   tối đa 1 "chịu trách nhiệm" (khớp 2 ô "Người đề nghị" cố định trên giấy in YEV-22-024) dời nguyên
   từ `DepartmentApprovalStepService.ReplaceAsync` cũ sang `GroupApprovalStepService.ReplaceAsync`
   mới; `DepartmentApprovalStepService.ReplaceAsync` giờ chỉ validate không trùng `JobTitleId` +
   `TerminalLevel != None`. `GroupApprovalStepService.ReplaceAsync` thêm validate ngược:
   `TerminalLevel == None` bắt buộc.
   - `IGroupApprovalStepRepository`/`GroupApprovalStepRepository`, DTO
     `Dtos/GroupApprovalSteps/{GroupApprovalStepDto,ReplaceGroupApprovalStepsDto}.cs`,
     `GroupApprovalStepController` (`GET/PUT /by-group/{groupId}`,
     `Attendance.GroupApprovalStep.View/Update`) — theo đúng khuôn `DepartmentApprovalStep*`.
   - `JobTitleApprovalChainService.ResolveChainCoreAsync` thêm tham số `groupId`: đọc
     `GroupApprovalStep` theo `groupId` (cấp trung gian) rồi nối tiếp `DepartmentApprovalStep` theo
     `departmentId` (cấp cuối) — LUÔN đi hết Nhóm trước rồi mới tới Bộ phận (2 nguồn `StepOrder` độc
     lập, ghép bằng `Concat` theo đúng thứ tự, không dùng `OrderBy(StepOrder)` chung). Ứng viên cấp
     trung gian đổi từ lọc theo `Group.DepartmentId == departmentId` (cũ, gộp cả Bộ phận) sang lọc
     chặt `Employee.GroupId == groupId` (đúng Nhóm) — 3 cấp cuối giữ nguyên scope cũ (Manager theo
     Department, Factory Manager/Director dùng chung công ty). `ResolveChainForCreationAsync` thêm
     tham số `groupId` (truyền từ `OtFormService.CreateAsync` — đã có sẵn `request.GroupId`).
     `ResolveChainAsync(employeeId, otCaseId)` (dùng ở panel "Thử chuỗi duyệt") KHÔNG đổi chữ ký —
     `groupId` tự suy ra từ `creator.Group.Id`.
   - FE: `GroupApprovalStepManager.tsx` (mới, `components/job-titles/`) — mirror
     `DepartmentApprovalStepManager.tsx`, chọn 1 Nhóm → cấu hình 3 bước trung gian, dùng
     `EmployeeApi.getEmployeesByGroup` (đã có sẵn). `DepartmentApprovalStepManager.tsx` rút gọn: bỏ
     toggle "Người chịu trách nhiệm", `availableJobTitles` lọc còn `terminalLevel !== 0`. Cả 2 dùng
     chung hook `useDragReorder.ts` (mục 3). Tab mới "Cây duyệt Nhóm" trong `CategoryManagement.tsx`
     (song song "Cây duyệt Bộ phận", KHÔNG gộp chung 1 màn — đơn giản hơn cho việc mount lazy/loading
     state theo khuôn `ListHandle` sẵn có của các tab khác).
   - Migration `AddGroupApprovalStepRemoveDeptResponsible` (Attendance DB) — `CreateTable
     GroupApprovalSteps`, `DropColumn DepartmentApprovalSteps.IsResponsible`. Permission migration
     Identity `AddGroupApprovalStepPermissions` (seed `Attendance.GroupApprovalStep.View/Update`, gán
     qua subquery theo `Attendance.Department.Create` — cùng cách `AddDepartmentApprovalStepPermissions`).

3. **Kéo thả sắp xếp thay 2 nút mũi tên** — `useDragReorder.ts` (hook dùng chung, HTML5 Drag & Drop
   thuần, không thêm thư viện ngoài) áp dụng cho cả 2 danh sách bước (Nhóm lẫn Bộ phận). Icon
   `GripVertical` (lucide-react) làm tay cầm kéo, bỏ hẳn `ArrowUp`/`ArrowDown`.

4. **Đổi nhãn hiển thị FE** — rà theo TỪNG key (không tìm-thay toàn cục vì 2 chiều đổi chồng lên
   nhau: "Phòng ban"→"Bộ phận" và "Bộ phận"→"Nhóm"), dựa vào tên field liền kề
   (`fieldDepartment`/`colDepartment`/`tabDepartments` → Department; `fieldGroup`/`colGroup`/
   `tabGroups` → Group) để xác định đúng entity mỗi key đang nói tới. Áp dụng cho toàn bộ
   `messages/vi.json` phần `Attendance.*` (Department/Group/DepartmentApprovalStep/GroupApprovalStep/
   Employee/CategoryManagement/OtFormList/CreateOtFormPage/OtFormBatchList) — KHÔNG đụng phần
   `Asset.*` (`DeviceDepartment`/`DeviceGroup` là khái niệm khác của module Asset, không liên quan).
   `ja.json` KHÔNG cần đổi — đã dùng 2 từ độc lập sẵn khớp nghĩa mới (部署=Bộ phận, グループ=Nhóm).
   Không đổi tên entity/bảng/cột/route/permission code (`Department`, `Group`, `DepartmentId`,
   `GroupId`, `/api/Department`, `/api/Group`... giữ nguyên) — chỉ đổi chữ hiển thị.

#### §Giai đoạn 5 — Gộp 2 tab Cây duyệt, bỏ tab xem trước, dropdown Bộ phận/Nhóm có tìm kiếm (2026-08-10)

FE-only, không có migration mới. Theo phản hồi người dùng khi dùng thật màn "Danh mục": 2 tab "Cây
duyệt Bộ phận"/"Cây duyệt Nhóm" tách rời gây bất tiện (phải nhớ chuyển qua lại tab đúng Bộ phận/Nhóm
tương ứng), và tab "Thử chuỗi duyệt" chỉ là công cụ debug giai đoạn xây dựng, không cần giữ ở màn vận
hành thật nữa.

1. **Gộp tab**: `ApprovalStepManager.tsx` (mới, `components/job-titles/`) thay thế hoàn toàn
   `DepartmentApprovalStepManager.tsx` + `GroupApprovalStepManager.tsx` (2 file cũ đã xoá) — 1 tab
   "Cây duyệt" duy nhất trong `CategoryManagement.tsx`. Chọn 1 Bộ phận ở trên cùng, bên dưới hiện 2
   khối liền mạch theo đúng thứ tự đơn đi qua thật: khối "Cấp trung gian (theo Nhóm)" (chọn 1 Nhóm con
   của Bộ phận đang chọn, dùng `GroupApprovalStepApi`) rồi tới khối "Cấp cuối (theo Bộ phận)" (dùng
   `DepartmentApprovalStepApi`, không cần chọn lại vì đã dùng chung Bộ phận đã chọn ở trên). Đổi Bộ
   phận thì Nhóm đang chọn tự reset (Nhóm cũ có thể không thuộc Bộ phận mới). 2 `useTranslations`
   namespace `Attendance.DepartmentApprovalStep`/`Attendance.GroupApprovalStep` giữ nguyên, chỉ thêm
   key `intro`/`sectionTitle` (cả 2 namespace) và `chooseGroupHint` (namespace Group) — không đổi tên
   namespace, tránh phải rewrite toàn bộ i18n hiện có.
2. **Bỏ tab "Thử chuỗi duyệt"** — `ApprovalChainPreviewPanel.tsx` xoá hẳn, namespace i18n
   `Attendance.ApprovalChainPreview` xoá khỏi `vi.json`/`ja.json`. Endpoint BE
   `GET /api/JobTitle/resolve-chain` (§3.4d `attendance-api-fe.md`) **vẫn còn nguyên** — không ai yêu
   cầu bỏ khả năng debug qua Scalar UI, chỉ bỏ UI xem trước ở FE.
3. **Dropdown nhiều item phải có ô tìm kiếm** — quy tắc mới, ghi ở
   [DESIGN_SYSTEM.md §4.3](../docs-fe/DESIGN_SYSTEM.md). Áp dụng ngay: ô chọn Bộ phận và ô chọn Nhóm
   trong `ApprovalStepManager.tsx` đổi từ `<select>` thường sang `SearchableSelect` (component có sẵn,
   trước đó mới chỉ dùng cho ô "+ Thêm người giữ"). Dropdown "+ Thêm bước" (chọn Chức vụ để thêm vào
   cây duyệt) giữ `<select>` thường vì luôn ≤ 3 lựa chọn (đã lọc theo cấp + loại Chức vụ đã dùng).
4. Đã sửa lại wording vài chỗ nhắc "màn Cây duyệt Nhóm"/"màn Cây duyệt Bộ phận" như 2 màn tách biệt
   (`JobTitleApprovalChainService`, `GroupApprovalStepService`, `DepartmentApprovalStepService`) thành
   "phần ... (màn Cây duyệt)" cho khớp UI gộp mới — chỉ đổi câu chữ thông báo lỗi, không đổi logic.

#### §Giai đoạn 6 — Quyền theo Chức vụ: tự động cấp/thu hồi permission Identity khi gán Chức vụ (2026-08-10)

**Bối cảnh:** Role Identity duy nhất cho OT (`Quản lý tăng ca`) cố ý seed KHÔNG kèm permission nào
(xem migration `AddQuanLyTangCaRole`) — Admin phải tự cấp permission riêng từng người qua "Tuỳ chỉnh
quyền" (`UserPermissionOverride`), tách bạch hẳn khỏi việc gán Chức vụ ở khu OT. Người dùng nhận thấy
việc này khiến vận hành phải làm 2 bước (gán Chức vụ ở OT → sang trang Admin cấp permission), muốn
gộp lại: gán Chức vụ xong tự động có đủ quyền vận hành.

**Quyết định kiến trúc đã chốt (qua trao đổi 2026-08-10):**
- **Cách 2 — Cấp VÀ thu hồi đối xứng** (không phải chỉ cấp thêm): đổi/gỡ Chức vụ của 1 người phải tự
  thu hồi đúng phần quyền đã tự động cấp trước đó, KHÔNG BAO GIỜ đụng tới quyền Admin cấp tay riêng —
  cần cột đánh dấu nguồn gốc để phân biệt 2 loại override.
- **Whitelist cứng** cho danh sách permission được phép cấu hình tự động — chỉ nhóm "tham gia quy
  trình", loại hẳn nhóm "quản trị" (xem mục 2 dưới) để không lặp lại đúng rủi ro đã gỡ bỏ khi xoá
  `UserApprovalScope`: 1 người có thể tự leo thang quyền quản trị chỉ bằng cách tự đổi Chức vụ.
- **Tự động hoá khi gán `UserName` sau này**: Employee có Chức vụ nhưng chưa có `UserName` (chưa link
  tài khoản đăng nhập) → không có gì để cấp (no-op). Khi sau đó `UserName` được gán vào Employee đó,
  lần lưu đó tự kích hoạt đồng bộ đúng bộ quyền theo Chức vụ hiện tại — không cần thao tác thủ công gì
  thêm.

**Dọn Role thừa:** Role legacy `Nhân viên` (Identity, seed ở `AddNhanVienRoleForOtFormCreate`
2026-07-17) đã xác nhận **0 người giữ** trên DB thật trước khi xoá — hết cần thiết từ sau refactor
"1 Role duy nhất cho OT" (2026-08-05), không còn chỗ nào hardcode check tên Role này. Xoá bằng
migration `RemoveNhanVienRole` (2026-08-10, Identity DB) — đã `database update` lên DB thật, xác
nhận lại còn đúng 5 Role: `Admin`, `Basic`, `Quản lý Hợp Đồng`, `Quản lý tăng ca`, `Quản lý Thiết bị`.

1. **`UserPermission` (Identity) thêm cột `IsAutoGranted` (bool, default false)** — phân biệt dòng do
   Attendance tự động cấp (`true`) với dòng Admin cấp tay qua "Tuỳ chỉnh quyền" (`false`). Composite
   key `(UserId, PermissionId)` giữ nguyên — 1 permission/user chỉ có đúng 1 trạng thái tại 1 thời
   điểm (không thể vừa auto vừa manual).

2. **`JobTitlePermission` (Attendance, entity mới)** — bảng nối `(JobTitleId, PermissionCode, IsDeleted)`,
   quản lý kiểu "thay nguyên danh sách" (mirror `GroupApprovalStep`). `PermissionCode` lưu dạng CHUỖI
   (không FK) vì bảng `Permissions` nằm ở DB Identity (`YevIdentityManagement`) khác hẳn DB Attendance
   (`YevOTManagement`) — không FK được xuyên database.
   - `JobTitlePermissionWhitelist.AllowedCodes` (`Attendance.Domain/Constants/`) — hằng số cố định 13
     mã: `OTForm.{View,Create,Approve,RemoveEmployee}`, `UserSignature.{View,Update}`,
     `SecondaryPassword.Update`, `{Department,Group,OtCase,Reason,Employee,JobTitle}.View`.
     `JobTitlePermissionService.ReplaceAsync` validate MỌI code phải nằm trong whitelist này (400 nếu
     không) — đây CHÍNH LÀ hàng rào chặn leo thang quyền, phải review kỹ nếu sau này cần mở rộng.
   - `JobTitlePermissionController`: `GET/PUT /by-job-title/{jobTitleId}` (`Attendance.JobTitlePermission.View/Update`),
     `GET /allowed-codes` (trả whitelist cho FE lọc UI, không hardcode song song 2 phía).
   - `ReplaceAsync` sau khi lưu mapping mới: tìm mọi `Employee` đang giữ đúng `JobTitleId` đó (có
     `UserName`) rồi gọi đồng bộ ngay — sửa mapping có hiệu lực tức thì, không cần đợi ai đó động vào
     Employee của từng người.

3. **Đồng bộ thật — `IUserDirectoryService.SyncAutoGrantedPermissionsAsync(userName, desiredCodes)`**
   (`Shared.Application` interface, impl ở `Identity.Application/Services/UserDirectoryService.cs`,
   theo đúng khuôn `UserHasPermissionAsync` đã có — Attendance gọi qua interface, không đụng thẳng
   DbContext Identity):
   - `userName` null/rỗng hoặc không khớp `User` nào ở Identity → no-op.
   - So `desiredCodes` với override hiện có của user: permission desired chưa có override nào (auto
     lẫn manual) → **thêm** dòng `IsGranted=true, IsAutoGranted=true`; dòng đang `IsAutoGranted=true`
     mà không còn trong `desiredCodes` → **xoá**; **không đụng** bất kỳ dòng nào `IsAutoGranted=false`
     (Admin cấp tay), dù trùng permission.
   - Gọi từ `EmployeeService.CreateAsync`/`UpdateAsync`/`DeleteAsync` (Attendance) mỗi khi
     `JobTitleId`/`UserName` đổi — `UpdateAsync` chụp lại `UserName` CŨ trước khi ghi đè, nếu đổi sang
     `UserName` khác thì thu hồi hết quyền auto khỏi tài khoản cũ trước, rồi mới đồng bộ tài khoản
     mới theo `JobTitleId` hiện tại. `DeleteAsync` (xoá mềm) thu hồi hết quyền auto của người đó.

4. **`PermissionService.UpdateUserPermissionOverridesAsync` (Admin "Tuỳ chỉnh quyền") sửa hành vi** —
   trước đây xoá SẠCH mọi override của 1 user rồi ghi lại theo đúng 2 mảng gửi lên; giờ **chỉ xoá/ghi
   lại phần `IsAutoGranted=false`**, không đụng phần `IsAutoGranted=true` — nếu giữ nguyên hành vi cũ,
   MỌI lần Admin lưu màn này cho 1 người (dù chỉ sửa 1 quyền không liên quan) sẽ vô tình xoá sạch mọi
   quyền do Chức vụ họ đang giữ tự cấp. Nếu 1 id trong `grantPermissionIds`/`denyPermissionIds` trùng
   đúng permission đang `IsAutoGranted=true` → coi là Admin **chiếm quyền thủ công** dòng đó (từ đó
   không còn bị đồng bộ tự động theo Chức vụ nữa). **Bẫy đã gặp khi code**: chiếm quyền lúc đầu viết
   theo kiểu Xoá dòng auto cũ + Add dòng mới cùng khoá chính `(UserId, PermissionId)` trong CÙNG 1
   `SaveChangesAsync` — verify sống phát hiện EF Core KHÔNG xử lý đúng cặp Delete+Add trùng khoá này
   (dòng cũ "sống sót" với `IsAutoGranted` giữ nguyên `true`, chỉ `IsGranted` đổi) — sửa bằng cách
   **Update tại chỗ** trên entity đang tracked thay vì Delete+Add, tránh hẳn phụ thuộc hành vi đó.
   - `UserPermissionDto`/`GetUserPermissionOverridesAsync` thêm field `IsAutoGranted` để FE phân biệt.
   - FE `UserPermissionOverrideManager.tsx`: chỉ đưa override `isAutoGranted=false` vào state
     "choices" (phần chỉnh sửa + gửi lên) — permission đang tự động cấp hiện nhãn riêng "Tự động
     (Chức vụ)" (đọc-only cho tới khi Admin chủ động bấm đổi), không đi vào payload `PUT` nếu không bị
     đụng tới, tránh mỗi lần lưu vô tình "khoá cứng" toàn bộ quyền tự động thành quyền tay.

5. **FE Attendance**: tick permission từ đúng danh sách `GET /allowed-codes` (mô tả tiếng Việt lấy từ
   `PermissionApi.getAll()` có sẵn, không hardcode song song 2 nơi), "Lưu" gọi `PUT /by-job-title/{id}`.
   ~~Tab riêng "Quyền theo Chức vụ" trong `CategoryManagement.tsx`~~ (`JobTitlePermissionManager.tsx`)
   — **đã bỏ, gộp thẳng vào modal Sửa chức vụ (2026-09-03d, theo yêu cầu người dùng)**, xem
   `JobTitlePermissionSection.tsx` bên dưới.

6. **Verify sống 2026-08-10** (dùng tài khoản Admin thật + 1 Employee/User thật đang có sẵn Chức vụ
   test từ trước, hoàn tác đầy đủ sau khi xong — không để lại dữ liệu rác):
   - `PUT` mã ngoài whitelist (`Attendance.Employee.Update`) → 400 đúng message.
   - `PUT` mã hợp lệ trên Chức vụ đang có người giữ (có `UserName`) → `UserPermissions` xuất hiện đúng
     dòng mới `IsGranted=1, IsAutoGranted=1`, KHÔNG đụng 6 dòng override thủ công có sẵn của người đó.
   - `PUT` mảng rỗng → dòng auto biến mất, override thủ công giữ nguyên.
   - Admin lưu "Tuỳ chỉnh quyền" cho CÙNG người đó (không đụng permission đang auto) → dòng auto **sống
     sót** qua lần lưu (xác nhận fix hành vi mục 4 hoạt động đúng).
   - Admin tick tay đúng permission đang auto (Thu hồi) → dòng chuyển `IsAutoGranted=0` đúng như thiết
     kế (sau khi sửa bug Delete+Add trùng khoá ở trên).

#### §Giai đoạn 7 — Người phụ trách Cây duyệt: phân quyền cấu hình theo Bộ phận/Nhóm (2026-08-11)

**Bối cảnh:** §3.4c/§3.4c-2 (Cây duyệt Bộ phận/Nhóm) trước đây chỉ Admin sửa được — quyền
`Attendance.DepartmentApprovalStep.Update`/`GroupApprovalStep.Update` là quyền PHẲNG, không giới hạn
phạm vi (ai có quyền này sửa được cây duyệt của TẤT CẢ Bộ phận/Nhóm). Với công ty nhiều Bộ phận/Nhóm,
Admin phải tự tay cấu hình hết, tốn thời gian/công sức — người dùng muốn giao việc này cho người khác
phụ trách theo từng đơn vị.

**Quyết định kiến trúc đã chốt (qua trao đổi 2026-08-11):**
- **KHÔNG suy luận theo Chức vụ** (khác hẳn hướng ban đầu) — dù Chức vụ Manager/Group Leader/Team
  Leader trông giống "người đứng đầu" đúng Bộ phận/Nhóm, thực tế người giữ chức vụ cao ít khi trực
  tiếp ngồi cấu hình cây duyệt, việc này thường giao cho 1 người khác phụ trách. Vì vậy **gán tay
  tường minh** — Admin chỉ định đích danh người phụ trách.
- **Tách biệt hoàn toàn Bộ phận và Nhóm** — phụ trách Bộ phận KHÔNG tự động phụ trách Nhóm con bên
  trong, phải gán riêng nếu cần. Đơn giản, tường minh, không suy luận ngầm theo cấu trúc tổ chức.
- **Không đưa vào `JobTitlePermissionWhitelist`** — nếu để `*ApprovalStep.Update` tự động cấp theo
  Chức vụ thì tái tạo đúng rủi ro tự leo thang quyền quản trị đã loại bỏ khi xoá `UserApprovalScope`
  (xem comment trong `JobTitlePermissionWhitelist.cs`).

**Sửa 2026-08-11b (theo phản hồi thêm của người dùng, cùng ngày)** — 2 điểm bản đầu (2026-08-11) chưa
đúng ý:
- **Chỉ chọn được Employee đang thuộc ĐÚNG Bộ phận/Nhóm đó** (trước đó cho chọn BẤT KỲ tài khoản
  Identity nào, không giới hạn) — khoá bảng gán theo `EmployeeId` (FK) thay vì `UserName` (chuỗi tự
  do), validate ở `*CoordinatorService.ReplaceAsync` bằng đúng điều kiện khớp Department đã dùng ở
  `EmployeeService.GetPagedAsync` (`Employee.DepartmentId == departmentId ||
  (Employee.GroupId != null && Employee.Group.DepartmentId == departmentId)` cho Bộ phận;
  `Employee.GroupId == groupId` cho Nhóm).
- **Employee CHƯA liên kết tài khoản đăng nhập (`UserName == null`) vẫn gán được** — quyền thô
  (`*ApprovalStep.{View,Update}` + `Department.View`/`Group.View`/`JobTitle.View`/`Employee.View`)
  giờ **TỰ ĐỘNG cấp/thu hồi**, không còn bước Admin cấp tay qua "Tuỳ chỉnh quyền" như bản đầu — nếu
  Employee đó chưa có `UserName`, việc cấp quyền tạm hoãn tới khi Admin liên kết tài khoản cho họ (qua
  màn Nhân viên, `EmployeeService.UpdateAsync`), lúc đó tự có hiệu lực ngay, không cần thao tác gì
  thêm. Đây CHÍNH LÀ cơ chế "tự động cấp permission theo Chức vụ" đã có ở §Giai đoạn 6
  (`IUserDirectoryService.SyncAutoGrantedPermissionsAsync`), mở rộng thêm 1 NGUỒN nữa (vai trò Người
  phụ trách) cùng đi qua 1 hàm gộp DUY NHẤT — xem mục 3 dưới.

1. **2 entity mới** (Attendance, mirror `JobTitlePermission` — quản lý kiểu "thay nguyên danh sách",
   không Create/Update/Delete từng dòng riêng):
   - `DepartmentApprovalStepCoordinator`: `Id`, `DepartmentId` (FK), `EmployeeId` (FK →
     `Employees.Id`), `IsDeleted`.
   - `GroupApprovalStepCoordinator`: mirror, khoá theo `GroupId`.
   - 1 Bộ phận/Nhóm có thể có nhiều người phụ trách (dự phòng/chia việc); 1 Employee có thể phụ trách
     nhiều Bộ phận/Nhóm; PHẢI thuộc đúng đơn vị đó (xem "Sửa 2026-08-11b" ở trên).

2. **Service** (`DepartmentApprovalStepCoordinatorService`/`GroupApprovalStepCoordinatorService`) —
   không còn phụ thuộc `IUserDirectoryService` (không cần kiểm tra tài khoản Identity nữa — hiển thị
   `FullName`/`EmployeeCode` lấy thẳng từ `Employee`, `UserName` pass-through nullable).
   `ReplaceAsync` validate mọi `EmployeeId` gửi lên phải khớp Employee active thuộc đúng đơn vị (400
   `DomainException` nếu không), rồi gọi `IEmployeeService.SyncAutoGrantedPermissionsForEmployeeAsync`
   cho HỢP của tập Employee cũ + mới (thêm lẫn bị gỡ) để quyền có hiệu lực ngay.

3. **`ApprovalStepCoordinatorPermissions`** (`Attendance.Domain/Constants/`, mirror
   `JobTitlePermissionWhitelist` nhưng KHÔNG phải whitelist do Admin chọn — là hằng số CỐ ĐỊNH, không
   qua validate whitelist vì không có rủi ro Admin tự nhập chuỗi tuỳ ý):
   `BaseViewCodes` (`Department.View`/`Group.View`/`JobTitle.View`/`Employee.View`/
   `DepartmentApprovalStep.View`/`GroupApprovalStep.View` — cấp cho BẤT KỲ ai phụ trách ít nhất 1 Bộ
   phận HOẶC 1 Nhóm, vì màn "Cây duyệt" là 1 màn hợp nhất cả 2 khối, đọc thiếu bên nào cũng lỗi khi
   tải) + `DepartmentUpdateCode`/`GroupUpdateCode` (chỉ cấp đúng phía đang phụ trách).
   `EmployeeService.SyncAutoGrantedPermissionsCoreAsync(employee)` — hàm GỘP DUY NHẤT tính lại toàn bộ
   permission tự động cấp (theo Chức vụ + theo vai trò Người phụ trách) rồi gọi 1 LẦN
   `IUserDirectoryService.SyncAutoGrantedPermissionsAsync` (hàm này THAY NGUYÊN danh sách
   `IsAutoGranted=true` của user — gọi tách rời theo từng nguồn sẽ khiến nguồn gọi sau xoá mất
   permission nguồn kia vừa cấp, đã sửa `JobTitlePermissionService.ReplaceAsync` gọi qua
   `IEmployeeService.SyncAutoGrantedPermissionsForEmployeeAsync` thay vì gọi thẳng
   `IUserDirectoryService` như trước, để không bị lỗi này).

4. **Scope-check trong `DepartmentApprovalStepService`/`GroupApprovalStepService`** (§3.4c/§3.4c-2,
   sửa CHỮ KÝ HÀM — thêm `userName`/`isAdmin`, mirror pattern `isAdmin` bypass đã có ở
   `OtFormController`/`EmployeeService.RemoveEmployeeCoreAsync`): `EnsureCanManageDepartmentAsync`/
   `EnsureCanManageGroupAsync` — Admin (`User.IsInRole("Admin")`) bỏ qua kiểm tra; người khác phải có
   dòng trong bảng gán ứng với ĐÚNG `departmentId`/`groupId` đang thao tác (so khớp qua
   `Employee.UserName == userName`, không phải cột trực tiếp trên bảng gán nữa — xem mục 1), sai thì
   `DomainException` dù có quyền thô. Áp dụng cho CẢ `GetBy*Async` (xem) lẫn `ReplaceAsync` (sửa) —
   người phụ trách Bộ phận A không xem/sửa được cây duyệt Bộ phận B dù cùng có quyền
   `DepartmentApprovalStep.Update`.

5. **Permission mới** (Identity, migration `AddApprovalStepCoordinatorPermissions`) — 4 mã:
   `Attendance.DepartmentApprovalStepCoordinator.{View,Update}`,
   `Attendance.GroupApprovalStepCoordinator.{View,Update}`, seed CHỈ cho Role đang giữ
   `Attendance.Department.Create` (thực tế chỉ Admin) — quản lý BẢNG GÁN (ai được làm người phụ trách)
   luôn là việc của Admin, không delegate được; KHÁC với quyền thao tác Cây duyệt thật
   (`*ApprovalStep.{View,Update}`) — quyền đó mới là phần tự động cấp cho người phụ trách (mục 3).

6. **FE**: `ApprovalStepManager.tsx` (tab "Cây duyệt") có khối "Người phụ trách" ngay trong mỗi phần
   Bộ phận/Nhóm — chip hiển thị người đang phụ trách (kèm nhãn "chưa liên kết tài khoản" nếu
   `Employee.UserName == null`) + ô `SearchableSelect` gõ tìm thêm, nguồn dữ liệu là
   `deptEmployees`/`groupEmployees` (đã tải sẵn cho khối "Đang giữ" Chức vụ ngay bên dưới — TÁI DÙNG,
   không gọi thêm API), áp dụng ngay không cần nút Lưu riêng. Khối này chỉ hiện với người có quyền
   `*Coordinator.View` (Admin) — 1 Người phụ trách bình thường (không phải Admin) mở màn này (được vào
   qua sidebar từ mục 7 dưới) sẽ KHÔNG thấy khối này, tránh gọi API `*Coordinator.View` mà họ không có
   quyền (403). Sidebar (`OtManagerSidebar.tsx`) — mục "Danh mục" trước đây chỉ hiện với
   `Attendance.Department.Create` (Admin), giờ `permissions` là MẢNG (đổi `hasPermission`→
   `hasAnyPermission`), thêm `DepartmentApprovalStep.Update`/`GroupApprovalStep.Update` làm điều kiện
   thay thế — người phụ trách (không phải Admin) mới thấy được mục để vào tab Cây duyệt.

7. **Checklist khi Admin gán 1 người làm phụ trách** — GIỜ CHỈ CÒN 1 BƯỚC (khác bản đầu 2026-08-11):
   thêm họ (chọn trong đúng danh sách nhân viên của Bộ phận/Nhóm) vào danh sách phụ trách ở màn Cây
   duyệt, khối "Người phụ trách" — quyền thao tác tự động có hiệu lực ngay nếu họ đã liên kết tài
   khoản đăng nhập, hoặc tự có hiệu lực ngay khi Admin liên kết tài khoản cho họ sau đó (không cần
   thao tác thêm ở "Tuỳ chỉnh quyền").

8. **Gán Chức vụ CÓ PHẠM VI cho nhân viên trong đơn vị mình phụ trách (2026-08-11c)** — người dùng yêu
   cầu thêm: Người phụ trách cũng cần tự gán được Chức vụ cho nhân viên, nhưng CHỈ trong đúng Bộ
   phận/Nhóm họ phụ trách (không phải toàn quyền `Attendance.Employee.Update`, quyền đó vẫn giữ nguyên
   chỉ Admin — sửa được TOÀN BỘ hồ sơ mọi nhân viên qua màn Nhân viên đầy đủ). Giải pháp: 2 action MỚI
   tách riêng khỏi `PUT /api/Employee/{id}` (`UpdateAsync`, không đổi):
   - `PUT /api/Employee/{id}/department-job-title?departmentId=` — gán Chức vụ CẤP CUỐI, gate bằng
     CHÍNH `Attendance.DepartmentApprovalStep.Update` (đã tự động cấp cho Người phụ trách Bộ phận, xem
     mục 3) thay vì `Employee.Update`. `EmployeeService.AssignDepartmentJobTitleAsync` tự kiểm tra: (a)
     Employee đang thao tác PHẢI thuộc đúng `departmentId` (trực tiếp hoặc qua Group con) — không
     "mượn" nhân viên Bộ phận khác; (b) non-Admin PHẢI có tên trong `DepartmentApprovalStepCoordinators`
     của đúng `departmentId` đó; (c) non-Admin KHÔNG được gán Chức vụ Trưởng Xưởng/Giám đốc
     (`TerminalLevel` = WorkshopManager/GeneralDirector — 2 cấp này dùng chung TOÀN CÔNG TY, vượt hẳn
     phạm vi 1 Bộ phận, chỉ Admin mới thăng được). BE tự tính lại `GroupId`/`DepartmentId` theo
     `TerminalLevel` của Chức vụ mới (không nhận trực tiếp từ client) — mirror logic đã có ở FE trước
     đây (`handleAssignDeptJobTitle`), giờ dời xuống BE làm nguồn chân lý.
   - `PUT /api/Employee/{id}/group-job-title?groupId=` — gán Chức vụ TRUNG GIAN, gate bằng
     `Attendance.GroupApprovalStep.Update`. `AssignGroupJobTitleAsync` kiểm tra Employee phải có đúng
     `GroupId` này, non-Admin phải có tên trong `GroupApprovalStepCoordinators` của đúng `groupId`,
     Chức vụ gửi lên phải `TerminalLevel = None`. Không đổi `GroupId`/`DepartmentId` (Chức vụ trung
     gian không đổi tổ chức).
   - Cả 2 gọi lại `SyncAutoGrantedPermissionsCoreAsync` sau khi lưu (JobTitle đổi → permission tự động
     theo Chức vụ có thể đổi theo). FE (`ApprovalStepManager.tsx`) đổi 2 handler quick-assign sang gọi
     endpoint mới thay vì `EmployeeApi.updateEmployee` full-profile, không còn tự tính
     `nextGroupId`/`nextDepartmentId` ở FE nữa (BE làm, tránh 2 nguồn logic lệch nhau).

**Chưa verify sống** (khác với Giai đoạn 6) — do khối lượng thay đổi lớn trong 1 lượt, mới dừng ở build
sạch + apply migration lên DB thật (bảo toàn đúng 1 dòng test có sẵn ở `GroupApprovalStepCoordinators`,
map `UserName`→`EmployeeId` qua `Employees.UserName` trùng khớp) + xác nhận permission seed đúng qua
SQL. Nên test tay qua UI thật (gán 1 người phụ trách test CHƯA liên kết tài khoản, xác nhận quyền CHƯA
có hiệu lực; sau đó liên kết `UserName` cho họ qua màn Nhân viên, xác nhận quyền tự bật lên; tự đăng
nhập tài khoản đó, thử sửa đúng/sai Bộ phận) trước khi coi tính năng này là ổn định.

#### §Giai đoạn 8 — Lịch sử lũy kế theo tháng/năm + reset dữ liệu demo (2026-08-11d)

> **Cập nhật 2026-08-19**: mô tả bên dưới ("ghi ledger SONG SONG với `MonthToDate`/`YearToDate` cũ")
> đúng tại thời điểm viết (2026-08-11d) nhưng đã lỗi thời — `MonthToDate`/`YearToDate`/`Projected*` đã
> bị xoá khỏi `Employee` hoàn toàn, ledger giờ là nguồn DUY NHẤT cho lũy kế thật (không còn "song song"
> với gì cả). Xem §Lũy kế — bỏ cache trên Employee, tính lúc đọc để biết thiết kế hiện hành.

**Bối cảnh:** `Employee.MonthToDate`/`YearToDate` (+ `ProjectedMonthToDate`/`ProjectedYearToDate`) chỉ
là bộ đếm SỐNG, bị ghi đè về 0 mỗi khi rollover sang tháng/năm mới (`AccumulateEmployeeHoursAsync`,
`ApplyProjectedRollover`) — không có nơi nào lưu lại lịch sử giờ cộng dồn theo từng tháng đã qua.
Người dùng cần: (a) reset lũy kế về 0 phục vụ demo, và (b) tra cứu lại lũy kế theo tháng/năm — tính
năng hoàn toàn MỚI, chưa từng tồn tại dưới bất kỳ hình thức nào.

**Quyết định kiến trúc đã chốt:**
- Ledger **aggregate theo tháng** (`EmployeeAccumulationHistory`, 1 dòng/`(EmployeeId, Year, Month)`),
  KHÔNG line-item theo từng đơn — khớp đúng nhu cầu đọc (bảng 12 dòng Tháng|Giờ), khớp đúng bản chất
  `MonthToDate`/`YearToDate` hiện tại (vốn đã là bộ đếm thuần, không traceability về nguồn đơn) — ledger
  chỉ thêm chiều THỜI GIAN, không cam kết thêm khả năng truy vết-về-đơn hệ thống chưa từng có.
- Ghi dần từ khi entity ra đời (append-only, mirror `OtFormApprovalHistory` — KHÔNG có `IsDeleted`),
  KHÔNG backfill dữ liệu cũ.
- Người xem: Admin + bất kỳ ai giữ `Attendance.OTForm.Approve`, nhưng CHỈ trong phạm vi nhân viên
  thuộc đơn vị mình (Nhóm/Bộ phận) — phạm vi suy theo ĐÚNG vị trí Cây chức vụ của người gọi (KHÁC hẳn
  bảng Người phụ trách Cây duyệt ở §Giai đoạn 7 — đó là uỷ quyền cấu hình cây duyệt, còn đây là phạm vi
  xem/duyệt theo đúng cấp bậc thật họ đang giữ, vì `OTForm.Approve` vốn đã gắn với JobTitle qua
  `JobTitlePermissionWhitelist`).

1. **`EmployeeAccumulationHistory`** (entity mới, `Attendance.Domain/Entities/`) — `Id`, `EmployeeId`
   (FK Restrict → `Employees`), `Year`, `Month`, `TotalHours` (decimal 10,2). Unique index
   `(EmployeeId, Year, Month)`. Repository/UnitOfWork wiring đúng khuôn `JobTitlePermission`. Migration
   `AddEmployeeAccumulationHistory` — `CreateTable` sạch, không cần data migration (bảng mới hoàn
   toàn). Đã `database update` lên `YevOTManagement`.

2. **Ghi ledger — `OtFormService.AccumulateEmployeeHoursAsync`** (KHÔNG phải
   `ApplyProjectedDelta`/`ApplyProjectedRollover` — 2 cơ chế đó dành cho lũy kế DỰ KIẾN, hoàn toàn tách
   biệt, đã xác minh lại kỹ trước khi code vì đây là điểm dễ nhầm nhất). Hàm này chỉ có ĐÚNG 2 call
   site, cả 2 đều là chuyển trạng thái THẬT sang `Completed`: `CreateAsync` (đơn Hoàn tất ngay lúc tạo
   — chuỗi duyệt rỗng) và `ApproveAsync` (hết bước Pending). Batch-fetch dòng ledger đã có TRƯỚC vòng
   lặp (tránh N+1) — chỉ cần khoá theo `EmployeeId` (không cần thêm Year/Month vào key tra cứu) vì
   INVARIANT: trong 1 lần gọi, mọi nhân viên xử lý đều thuộc CHUNG đúng 1 `OtForm` nên dùng chung đúng 1
   `otForm.Date`. Trong vòng lặp: cộng dồn vào dòng ledger có sẵn hoặc tạo dòng mới, SONG SONG với logic
   `MonthToDate`/`YearToDate` cũ (không đổi gì logic cũ).

3. **DTO** (`Attendance.Application/Dtos/EmployeeAccumulationHistories/`):
   `EmployeeAccumulationHistoryDto { Month, TotalHours }`,
   `EmployeeAccumulationHistoryYearDto { EmployeeId, EmployeeCode, EmployeeFullName, Year, Months (12
   phần tử, tháng trống = 0 — điền ở Service, KHÔNG lưu dòng rỗng trong DB), YearTotalHours (=
   Sum(Months) — với năm CŨ đã rollover đây là NGUỒN DUY NHẤT biết tổng năm đó, vì `YearToDate` chỉ còn
   phản ánh năm hiện tại; với năm hiện tại giá trị này luôn khớp `Employee.YearToDate`, cùng 1 điểm ghi
   — dùng làm phép kiểm tra chéo lúc test tay) }`.

4. **`EmployeeService` — 2 method mới** (không tạo service riêng):
   - `GetInScopeAsync(callerUserName, isAdmin, pageIndex, pageSize, keyword)` → `PagedResponse<EmployeeDto>`.
   - `GetAccumulationHistoryAsync(callerUserName, isAdmin, employeeId, year)` → `EmployeeAccumulationHistoryYearDto`.
   Logic phạm vi (code MỚI, KHÔNG tái dùng nguyên xi hàm có sẵn nào — chỉ cùng tinh thần resolve
   "Employee của người gọi" đã có ở `EnsureCanCreateOrEditForScopeAsync`):
   - Admin → không giới hạn.
   - `caller.JobTitle.TerminalLevel ∈ {WorkshopManager, GeneralDirector}` (Trưởng Xưởng/Giám đốc) →
     toàn công ty.
   - `caller.DepartmentId` có giá trị (Manager) → nhân viên có `DepartmentId` trùng, hoặc
     `Group.DepartmentId` trùng.
   - Còn lại (Staff/Group Leader/Team Leader, cấp Nhóm, hoặc chưa gán Chức vụ — vẫn bắt buộc có
     `GroupId` theo `ValidateOrganizationAssignmentAsync`) → chỉ nhân viên có `GroupId` trùng.
   - Người gọi chưa liên kết Employee (`UserName` không khớp ai) → `DomainException` từ chối.

5. **`EmployeeController` — 2 action mới**, gate bằng `Attendance.OTForm.Approve` (KHÔNG phải
   `Attendance.Employee.View`) — permission có sẵn, KHÔNG cần migration Identity nào:
   - `GET /api/Employee/in-my-scope?pageIndex=&pageSize=&keyword=` — route literal đứng cùng cấp
     `{id}`, ASP.NET Core tự ưu tiên segment tường minh hơn param (đã có tiền lệ tương tự `all`, không
     đụng `GetById`). Đây là cách DUY NHẤT để người chỉ giữ `OTForm.Approve` (không có `Employee.View`)
     tự liệt kê được nhân viên trong phạm vi mình — mọi action khác trên `EmployeeController` đều gate
     `Employee.View`.
   - `GET /api/Employee/{id}/accumulation-history?year=` → `EmployeeAccumulationHistoryYearDto`.

6. **FE**: `AccumulationHistoryTable.tsx` (bảng 12 tháng thuần, tái dùng công thức badge đỏ đã có ở
   `EmployeeList.tsx` so với `AttendanceSetting.monthlyOtHourLimit`/`yearlyOtHourLimit`) +
   `AccumulationHistoryModal.tsx` (modal chọn năm + gọi API, dùng CHUNG ở cả 3 điểm vào) — nút "Xem
   lịch sử lũy kế" trong `EmployeeList.tsx` (Admin), icon cạnh cột Lũy kế năm trong `OtFormDetail.tsx`
   (ẩn/hiện theo `canApprove`), và màn mới `AccumulationLookupPage.tsx` (route `/ot/accumulation`, gọi
   `GET /in-my-scope` để tự tìm nhân viên trong phạm vi, không cần mở sẵn 1 đơn). Sidebar thêm mục "Lũy
   kế nhân viên" cùng điều kiện quyền với "Đơn tổng" (`Attendance.OTForm.Approve`).

**Chưa verify sống** (build + migration đã áp lên DB thật, smoke test xác nhận API vẫn boot sạch và
pipeline Auth/RBAC không bị ảnh hưởng — nhưng chưa test tay luồng thật: tạo 1 đơn demo → duyệt tới Hoàn
tất → xác nhận `MonthToDate`/`YearToDate` VÀ `GET .../accumulation-history?year=` cùng ra đúng số; gọi
`GET /in-my-scope` bằng tài khoản chỉ có `OTForm.Approve` xác nhận không 403 và đúng phạm vi; gọi thử
tài khoản khác Nhóm/Bộ phận xác nhận bị từ chối). Nên làm trước khi coi ổn định.

#### §Giai đoạn 9 — Đơn "theo chuyền" (Chế tạo): Cây duyệt riêng (2026-08-24, sửa 2026-08-27)

Đơn OT "theo chuyền" (chọn người qua `ProductionEmployee` thay vì `Group` cố định — xem §Import/Export
nhân sự dưới chuyền) dùng 1 cây duyệt **cấu hình tay riêng** theo từng Bộ phận, KHÔNG tách 2 tầng
Group/Department như đơn "theo Nhóm": entity `ProductionApprovalStep` (1 danh sách DUY NHẤT/Bộ phận,
đi từ Line Leader → Group Leader → Team Leader → Manager → Factory Manager → Director, mỗi dòng =
1 `JobTitleId`), service `ProductionApprovalStepService` (`GetByDepartmentAsync`/`ReplaceAsync` — thay
NGUYÊN danh sách 1 lần, không CRUD từng dòng), controller `ProductionApprovalStepController`
(`GET/PUT /api/ProductionApprovalStep/by-department/{id}`), permission
`Attendance.ProductionApprovalStep.View/Update` (dùng chung Người phụ trách với đơn theo Nhóm —
`DepartmentApprovalStepCoordinator`, không tạo bảng phụ trách riêng). FE: tab "Theo chuyền" trong
`ApprovalStepManager.tsx` (cùng màn "Cây duyệt" với tab "Theo Nhóm"), kéo-thả sắp xếp
(`useDragReorder`), tối đa 1 bước `IsResponsible`, 1-2 bước cấp trung gian `RequiresSignature` (khớp 2
ô "Người đề nghị" cố định trên giấy in).

`JobTitle.IsLineScoped` (chỉ `true` cho "Line Leader") đánh dấu bước này cần lọc thêm theo Line —
`JobTitleApprovalChainService.ResolveChainForProductionCreationAsync` suy `derivedProductionLineId` từ
chính `ProductionEmployee.ProductionLineId` của những người đang được thêm vào đơn (không có 1
`ProductionLineId` cố định trên `OtForm`; nếu người trong đơn lẫn nhiều Line khác nhau thì coi như
không suy được, bước Line Leader sẽ không có ứng viên — cảnh báo qua `Warning`).

**Sửa 2026-08-27 (theo yêu cầu người dùng)** — cách tìm ứng viên bước **Line Leader** đổi hẳn:
- **TRƯỚC**: gán tay `Employee.JobTitleId = "Line Leader"` qua Cây chức vụ (không có UI riêng để gán —
  phải vòng qua tab "Nhân viên" sửa từng người), cộng thêm điều kiện `ProductionEmployee.ProductionLineId`
  khớp Line của đơn.
- **SAU**: bỏ hẳn việc đọc `Employee.JobTitleId` cho bước này — lấy THẲNG từ
  `ProductionEmployee.IsLeader == true` (cột `LEADER` trong file `Import_Nhan_Su_Che_Tao.xlsx`, luôn
  mới nhất mỗi lần import lại — xem §Import/Export nhân sự dưới chuyền) kết hợp
  `ProductionEmployee.ProductionLineId` khớp Line của đơn. Lý do: dữ liệu "ai là Line Leader của Line
  nào" đã có sẵn trong file nhân sự dưới chuyền mà Tổng vụ import mỗi tháng — không cần (và không nên)
  bắt Admin gán tay lại 1 lần nữa qua Cây chức vụ. `JobTitle` "Line Leader" vẫn tồn tại làm 1 dòng
  trong `ProductionApprovalStep` (để hiển thị/sắp xếp đúng vị trí + cấu hình "Bắt buộc ký"/"Người chịu
  trách nhiệm"), nhưng gán `Employee.JobTitleId = "Line Leader"` cho ai đó giờ **không còn tác dụng gì**
  tới việc suy luận ứng viên nữa.

**Group Leader/Team Leader thì NGƯỢC LẠI — không có nguồn dữ liệu sẵn nào tương tự** (file import chỉ
có 1 cột LEADER duy nhất, không phân cấp lãnh đạo) — vẫn phải gán tay qua `Employee.JobTitleId` như cũ
(phạm vi tìm ứng viên suy theo `Employee.GroupId` của người trong đơn, mirror Line Leader nhưng theo
Group thay vì Line). Vì trước đó tab "Theo chuyền" hoàn toàn không có UI gán tay (khác tab "Theo Nhóm" đã có khối "Ai đang
giữ chức vụ" từ đầu), đã thêm khối này riêng cho từng bước trong `ApprovalStepManager.tsx`, phân biệt
theo `TerminalLevel`/`IsLineScoped`:
- Bước `terminalLevel=0 && isLineScoped` (Line Leader): chỉ hiện dòng chú thích, không có picker (tự
  động theo import, xem trên).
- Bước `terminalLevel=0 && !isLineScoped` (Group Leader/Team Leader): hiện khối "Ai đang giữ" + picker
  gán/gỡ — TÁI DÙNG NGUYÊN state/handler đã có sẵn cho khối "Cấp cuối (Bộ phận)" của tab "Theo Nhóm"
  (`deptEmployees`, `handleAssignDeptJobTitle`/`handlePickDeptHolder`/`buildHolderOptions`, gọi
  `PUT /api/Employee/{id}/department-job-title`) — hàm này vốn đã tổng quát cho mọi `TerminalLevel`,
  không cần viết thêm state/handler riêng.
- Bước `terminalLevel!=0` (Manager/Factory Manager/Director): chỉ hiện dòng chú thích trỏ sang khối
  "Cấp cuối (Bộ phận)" ở tab "Theo Nhóm" — 3 cấp này dùng CHUNG `Employee.JobTitleId` với đơn theo
  Nhóm nên gán 1 lần ở đâu cũng có tác dụng cho cả 2 luồng, không cần lặp lại UI.

DTO `ProductionApprovalStepDto`/`JobTitleDto` (cả BE lẫn FE) thêm field `isLineScoped: boolean` để FE
biết bước nào cần ẩn/hiện khối nào ở trên.

#### §Giai đoạn 10 — Sửa đơn "theo chuyền" theo từng bước + Ký/Từ chối hàng loạt + Import giới hạn OT (2026-08-27)

Theo yêu cầu người dùng (đối chiếu `docs/Note_OT.txt`), làm 3 việc độc lập:

**1. Quyền sửa đơn "theo chuyền" đi theo TỪNG BƯỚC** (`OtFormService.UpdateAsync`) — trước đây (từ
lúc `ProductionFormSupport` ra đời 2026-08-24) đơn theo chuyền dùng CHUNG luật với đơn theo Nhóm: chỉ
người tạo sửa được, và chỉ trước khi có bước nào Approved (ghi rõ trong code cũ là "tạm đủ, chưa thiết
kế Giai đoạn 5" — nay chính là giai đoạn đó). Đã chốt lại với người dùng:
- Group Leader/Team Leader **sửa trực tiếp được dữ liệu** (giờ kết thúc, `DidEat`, ghi chú) ở bước của
  họ — không chỉ xem/viết ghi chú như 1 phương án đã cân nhắc.
- Sửa dữ liệu sau khi cấp trước đã ký **KHÔNG huỷ** chữ ký/xác nhận cũ của cấp đó (giữ nguyên, không
  bắt ký lại) — khác với đề xuất "huỷ xác nhận" ban đầu.
- Mỗi cấp tự ký xong bước của họ thì bị **khoá lại theo đúng cấp đó** (giống Line Leader) — chỉ bước
  đang `Pending` (StepOrder nhỏ nhất) mới sửa được.

Cài đặt: `UpdateAsync` branch theo `otForm.IsProductionForm` — đơn theo chuyền dùng lại
`GetCurrentPendingStepAsync` (helper mới, tách từ `LoadFormAndCurrentStepAsync` để dùng chung cho cả
Approve/Reject/Update) để tìm bước Pending hiện tại + validate `currentUserName` là 1 candidate của
bước đó (không có Admin bypass, cùng nguyên tắc Approve/Reject); đơn theo Nhóm giữ NGUYÊN luật cũ
(chỉ người tạo, chỉ trước khi có bước nào Approved). `IsEditable` (cả ở `OtFormListItemDto` lẫn
`OtFormDto`) cũng branch tương tự — đơn theo chuyền chỉ cần `Status==InApproval` là coi như "có người
sửa được" (không quan tâm đã có bước nào Approved chưa), đơn theo Nhóm giữ nguyên. FE (`canEdit` ở
`OtFormDetail.tsx`) theo đúng pattern đã dùng cho nút Duyệt/Từ chối: không tự lọc theo candidate ở FE,
chỉ kiểm `isEditable` + quyền `Attendance.OTForm.Create` (+ với đơn theo Nhóm thì thêm điều kiện chính
người tạo) — để BE là nguồn chặn thật, trả lỗi rõ ràng nếu bấm Sửa mà không đúng lượt.

`UpdateOtFormEmployeeTimeDto` (cả BE lẫn FE) có lại `NoteVn`/`NoteJp` (đã bỏ từ 2026-07-31) — Group
Leader/Team Leader ghi chú trao đổi qua từng nhân viên khi sửa đơn, thay thế việc ghi giấy như trước.
FE: `CreateOtFormPage.tsx` bảng sửa đơn (`isEditMode`) thêm cột "Ghi chú" (input `noteVn`, mirror cột
Note đã có sẵn ở bảng tạo đơn "theo chuyền" — `noteJp` có field/state nhưng CHƯA có input UI ở bất kỳ
đâu, kể cả lúc tạo đơn, giữ nguyên khoảng trống cũ, không mở rộng thêm trong đợt này).

**2. Ký hàng loạt / Từ chối hàng loạt** (`POST /api/OtForm/bulk-approve`, `POST /api/OtForm/bulk-reject`,
permission `Attendance.OTForm.Approve` — dùng lại, không tạo permission mới) — cho Team Leader/Trưởng
phòng xử lý nhanh nhiều đơn khi có nhiều Group Leader/Team Leader bên dưới. `BulkApproveOtFormDto`/
`BulkRejectOtFormDto` kế thừa `ApproveOtFormDto`/`RejectOtFormDto` (Comment/SecondaryPassword dùng
CHUNG cho cả loạt — đã chốt với người dùng, không nhập riêng từng đơn), thêm `OtFormIds: List<int>`.
`OtFormService.BulkApproveAsync`/`BulkRejectAsync` lặp gọi lại NGUYÊN `ApproveAsync`/`RejectAsync` đơn
lẻ cho từng Id (chấp nhận verify lại mật khẩu cấp 2 mỗi lần thay vì tách riêng logic — ưu tiên không
đụng luồng đơn lẻ đã ổn định) — mỗi đơn thành công/thất bại ĐỘC LẬP (bắt `DomainException`/
`NotFoundException` riêng từng đơn), trả về `List<BulkOtFormActionResultItemDto>` (`OtFormId, Success,
Error`) để FE báo đúng đơn nào lỗi thay vì 1 thông báo chung. FE: tab "Chờ tôi duyệt"
(`OtFormListPage.tsx`, `mode="pending-approvals"`) thêm cột checkbox (chỉ hiện khi có quyền
`Attendance.OTForm.Approve`) + 2 nút "Ký hàng loạt"/"Từ chối hàng loạt" khi có đơn được chọn + modal
Comment/Mật khẩu cấp 2 dùng chung — sau khi xử lý xong tự refetch danh sách, toast tổng kết
"X thành công, Y lỗi" kèm chi tiết lỗi từng đơn nếu có.

**3. Import hàng loạt giới hạn giờ OT tháng/năm** (`POST /api/EmployeeImport/ot-hour-limits`,
permission `Attendance.Employee.Update` — action này chỉ UPDATE, không tạo nhân viên mới, khác 2
action Preview/Confirm cùng controller đang dùng `Attendance.Employee.Create`) — khớp
`docs/Note_OT.txt`: "Import lại số giờ giới hạn tăng ca của nhân viên". File Excel: cột A bỏ trống
(theo đúng quy ước các file import khác trong module), B=MNV, C=Giới hạn Tháng, D=Giới hạn Năm, dò
dòng tiêu đề bằng cột B="MNV". KHÔNG dùng cơ chế Preview/Confirm 2 bước như
`EmployeeImportService.PreviewAsync`/`ConfirmAsync` (import nhân sự đầy đủ, có tạo Department/Group
phụ thuộc cần rà trước) — vì action này chỉ update 2 field số nullable
(`Employee.CustomMonthlyOtHourLimit`/`CustomYearlyOtHourLimit`) trên nhân viên ĐÃ TỒN TẠI, không có rủi
ro tạo sai entity, nên áp dụng thẳng 1 bước và trả lại kết quả từng dòng (`EmployeeOtHourLimitImportResultDto`)
để xem lại ngay trong dialog. Ô Giới hạn Tháng/Năm để TRỐNG ở 1 dòng = **GIỮ NGUYÊN** override cũ của
nhân viên đó (không phải xoá) — đã chốt với người dùng. Mã nhân viên không tìm thấy → tính vào
`SkippedCount`, không chặn các dòng khác. FE: dialog mới `EmployeeOtHourLimitImportDialog.tsx`, mở từ
`ActionMenu` "Excel" đã có sẵn trên màn Nhân viên (thêm 1 item "Import giới hạn OT").

**4. File mẫu tải xuống cho 3 chức năng import Attendance** (theo yêu cầu người dùng, cùng ngày) —
`GET /api/EmployeeImport/template`, `GET /api/EmployeeImport/ot-hour-limits/template`,
`GET /api/ProductionEmployeeImport/template` (trả file `.xlsx` trực tiếp, không bọc `ApiResponse<T>`,
cùng pattern `ProductionEmployeeExportController.Export` — permission dùng lại đúng permission của
action Preview/Import tương ứng, không tạo permission mới). Mỗi service có thêm method ĐỒNG BỘ (không
`async`, không đụng DB) dựng workbook tĩnh trong bộ nhớ bằng ClosedXML: header đúng vị trí cột +
1 dòng ví dụ minh hoạ (không phải dữ liệu thật). File mẫu "Nhân sự dưới chuyền" dùng lại NGUYÊN mảng
header với `ProductionEmployeeExportService` để 2 file (mẫu import / xuất) luôn khớp cột nhau. FE:
mỗi dialog import (`EmployeeImportDialog.tsx`/`EmployeeOtHourLimitImportDialog.tsx`/
`ProductionEmployeeImportDialog.tsx`) thêm nút "Tải file mẫu" cạnh ô chọn file, tải qua
`getForBlob` + tạo link `<a download>` tạm (cùng cơ chế `ProductionEmployeeExportApi.exportExcel`).

**5. "Nhân viên dưới chuyền" — khớp thuật ngữ với màn "chọn nhân viên" + lọc theo Bộ phận** (theo yêu
cầu người dùng, cùng ngày) — `ProductionEmployeeList.tsx` trước đó dùng thẳng tên cột thô của file
Excel (BLOCK/GROUP/NHOM) không khớp với cách gọi ở `CreateOtFormPage.tsx` (màn "chọn nhân viên" khi
tạo đơn theo chuyền, dùng "Line"/"Team"/"Nhóm ca"/"Công đoạn") — đổi lại nhãn cột + filter cho khớp
("Block"/"Team"/"Nhóm ca", filter "Tất cả Line"/"Tất cả Team"/"Tất cả Nhóm ca"), thêm cột "Công đoạn"
(field `congDoan` đã có sẵn trên DTO nhưng trước đó chưa render ra cột nào). Thêm filter theo **Bộ
phận** (`departmentId`) — `ProductionEmployeeService.GetPagedAsync` lọc qua
`Employee.Group.DepartmentId` (ProductionEmployee về lý thuyết không giới hạn cứng chỉ 1 Bộ phận
"Chế tạo", dù thực tế thường vậy), `GET /api/ProductionEmployee/page-nation` thêm query
`DepartmentId`. FE: dropdown Bộ phận mới (tái dùng `DepartmentApi.getAllDepartments()`, mirror
`EmployeeList.tsx`), đặt trước 3 dropdown Line/Team/Nhóm ca.

**Chưa verify sống** cả 5 việc trên (build sạch, `tsc`/`eslint` sạch — nhưng chưa test tay qua UI thật
với tài khoản Group Leader/Team Leader/Trưởng phòng thật để xác nhận đúng luồng khoá-theo-từng-bước,
ký hàng loạt xử lý đúng khi trộn lẫn đơn hợp lệ/không hợp lệ, import file giới hạn OT mẫu thật, các
file mẫu tải xuống mở được đúng bằng Excel thật, và lọc Bộ phận trên "Nhân viên dưới chuyền" ra đúng
kết quả).

#### §Giai đoạn 11 — Thêm nhân viên vào đơn + mật khẩu cấp 2 khi Tạo/Sửa đơn + Lịch sử chỉnh sửa (2026-08-28)

Theo yêu cầu người dùng (2026-08-28): "chỉnh sửa đơn" cho phép sửa giờ tăng ca (đã có) VÀ loại/thêm
nhân viên (loại đã có sẵn từ trước — §Loại nhân viên khỏi đơn — chỉ "thêm" là mới); mọi thao tác thay
đổi đơn phải log lại ai/khi nào/đổi gì và xem lại được; Lưu sửa đơn hay Tạo đơn đều phải nhập mật khẩu
cấp 2; nhân viên thiếu Nhóm ca không được vào đơn. 4 câu hỏi qua `AskUserQuestion` đã chốt: (1) áp
dụng cho CẢ đơn theo chuyền lẫn đơn thường (không chỉ Chế tạo); (2) mật khẩu cấp 2 dùng lại
`SecondaryPassword`/`UserSignature` đã có (không thêm luồng xác thực mới); (3) Nhóm ca bắt buộc chặn
CẢ lúc Import lẫn lúc tạo đơn; (4) log hiển thị ngay trong `OtFormDetail.tsx`.

**1. `AddEmployeeAsync`/`POST /api/OtForm/{id}/employees/add`** (mới) — chiều ngược của
`RemoveEmployeeAsync` đã có. `AddOtFormEmployeeDto { EmployeeId, EndTime, DidEat, NoteVn, NoteJp,
SecondaryPassword }`. Cùng điều kiện phân quyền với Remove: candidate của bước `Pending` hiện tại
(hoặc Admin) + permission riêng **`Attendance.OTForm.AddEmployee`** (migration Identity
`AddOtFormAddEmployeePermission`, gán cho đúng các Role đang giữ `Attendance.OTForm.RemoveEmployee`
qua subquery, mirror migration `AddOtFormRemoveEmployeePermission` — cũng thêm vào
`JobTitlePermissionWhitelist`). Validate: đơn `InApproval`; nhân viên chưa có mặt active trong đơn
(nếu trước đó đã bị loại khỏi CHÍNH đơn này thì TÁI DÙNG lại đúng dòng `OtFormEmployee` cũ — set
`IsRemoved=false`, xoá 5 field `Removed*`, không tạo dòng mới); giờ kết thúc trong khoảng
`[StartTime, EndTime]` của đơn; đơn theo chuyền phải có `ProductionEmployee` tương ứng VÀ
`ShiftTeamId != null` (xem mục 3); đơn theo Nhóm phải cùng `GroupId`; giới hạn ngày/tháng/năm
(`ValidateOtHourLimitsAsync`, `excludeFormId` = chính đơn); không trùng giờ OT ngày đó
(`EnsureNoOverlappingOtFormsAsync`). Snapshot `MonthToDate`/`YearToDate` Dự kiến TRƯỚC khi thêm
(`ComputeAccumulatedHoursBatchAsync`, cùng nguyên tắc với `CreateAsync`). Sau khi thêm: tính lại
`ProcessPart.MainTicketCount`/`SecondaryTicketCount` (`RecalculateMealTicketCountsAsync`) +
`OtForm.NumberOfEmployee`, ghi 1 dòng `OtFormEditLog` (mục 4). FE (`OtFormDetail.tsx`): nút "Thêm
nhân viên" (điều kiện hiện giống hệt nút Loại — `canAddEmployee = hasPermission(...AddEmployee) &&
showApprovalActions`) mở modal 2 bước — (a) ô tìm theo Mã/Tên + nút Tìm (đơn theo chuyền gọi
`ProductionEmployeeApi.search({keyword})` đã hỗ trợ sẵn tìm theo Mã; đơn theo Nhóm gọi
`EmployeeApi.getEmployeesByGroup(groupId)` rồi lọc client-side, danh sách 1 Nhóm thường nhỏ, loại sẵn
người đã có trong đơn), (b) chọn 1 người → nhập Giờ kết thúc/Có ăn/Ghi chú/Mật khẩu cấp 2 → Submit.

**2. Mật khẩu cấp 2 bắt buộc khi Tạo đơn VÀ Lưu sửa đơn** — trước đây chỉ Duyệt/Từ chối (kể cả hàng
loạt) mới cần. `CreateOtFormDto`/`UpdateOtFormDto` thêm `SecondaryPassword` (`[Required]`),
`OtFormService.CreateAsync`/`UpdateAsync` gọi `_secondaryPasswordService.VerifyAsync(...)` SỚM (đầu
hàm, trước khi làm việc gì khác — cùng vị trí với `ApproveAsync`). `RemoveOtFormEmployeeDto` (Loại
nhân viên, action trong app) **đảo ngược quyết định 2026-07-31** — nay CŨNG bắt buộc
`SecondaryPassword` (đồng bộ với Add/Update ở trên); kênh email
(`RemoveOtFormEmployeeByEmailTokenDto`) **giữ nguyên KHÔNG cần** (quyết định riêng biệt, token là
thông tin xác thực duy nhất, không đổi). FE: `CreateOtFormPage.tsx` (dùng chung cho cả Tạo lẫn Sửa)
thêm 1 field Mật khẩu cấp 2 ngay trên nút Lưu, fetch `SecondaryPasswordApi.getMyStatus()` KHÔNG điều
kiện `isEditMode` (khác `hasSignature` — Sửa đơn không ký lại nên không cần chữ ký, nhưng vẫn cần mật
khẩu cấp 2). `OtFormDetail.tsx`: modal Loại nhân viên thêm field Mật khẩu cấp 2 (trước đây không có).

**3. Nhóm ca bắt buộc trước khi tạo/thêm vào đơn** — Import nhân sự dưới chuyền **đã chặn từ
2026-08-24** (`ProductionEmployeeImportService.ValidateAndResolveRowsAsync` báo lỗi "Thiếu mã NHOM"
nếu cột trống — mọi `ProductionEmployee` hợp lệ trong DB vốn LUÔN có `ShiftTeamId` do chính sách nạp
"đủ FK mới nạp, thiếu thì bỏ qua" đã có sẵn, xem comment đầu `ProductionEmployee.cs`). Thêm lớp
phòng vệ THỨ 2 (2026-08-28) trực tiếp ở `CreateProductionFormAsync`/`AddEmployeeAsync`: tra
`ProductionEmployee.ShiftTeamId` của mọi nhân viên được chọn, `null` thì chặn tạo/thêm với message
liệt kê đúng mã nhân viên thiếu — phòng trường hợp hiếm dữ liệu cũ/sửa tay ngoài Import.

**4. `OtFormEditLog` — nhật ký chỉnh sửa đơn** (entity mới, migration `AddOtFormEditLog`) — khác
`OtFormApprovalHistory` (chỉ ghi Approve/Reject): ghi CÁC THAY ĐỔI DỮ LIỆU sau khi tạo đơn — sửa
giờ/`DidEat`/ghi chú của 1 nhân viên (`UpdateAsync`, chỉ ghi field THỰC SỰ đổi giá trị, so sánh trước
khi gán), thêm nhân viên (`AddEmployeeAsync`), loại nhân viên (`RemoveEmployeeCoreAsync`, CẢ kênh
trong app lẫn email — kênh email vẫn ghi log dù không cần mật khẩu cấp 2, 2 việc độc lập nhau). KHÔNG
ghi khi `CreateAsync` (đơn mới đã có `CreatedByUserName`/`CreatedAt` làm log riêng). Field:
`{OtFormId, ActionByUserName, ActionByFullName, ActionAt, ActionType (enum
TimeChanged=0/NoteChanged=1/EmployeeAdded=2/EmployeeRemoved=3), EmployeeId, EmployeeCodeSnapshot,
FieldName, OldValue, NewValue}` — 1 dòng/1 field đổi (hoặc 1 hành động Add/Remove), KHÔNG gộp nhiều
field vào 1 dòng. Đọc qua `OtFormDto.EditLogs[]` (embed thẳng trong `GET /api/OtForm/{id}`, sắp mới
nhất trước — không có endpoint riêng, người dùng chốt hiển thị ngay trong `OtFormDetail.tsx`). FE:
khu vực "Lịch sử chỉnh sửa" mới, đặt dưới "Lịch sử duyệt", bảng Thời điểm/Người thực hiện/Nhân
viên/Thao tác/Thay đổi (`oldValue → newValue`), rỗng thì hiện "Chưa có thay đổi nào" thay vì ẩn hẳn
khối.

**Chưa verify sống** cả 4 việc trên (build sạch, migration đã `database update` lên DB thật, smoke
test 7 bước vẫn pass, `tsc`/`eslint` sạch — nhưng chưa test tay qua UI thật: thêm nhân viên vào đơn
theo chuyền lẫn theo Nhóm, tái dùng dòng đã bị loại trước đó, mật khẩu cấp 2 khi Tạo/Sửa đơn, nhân
viên thiếu Nhóm ca bị chặn đúng chỗ, và bảng Lịch sử chỉnh sửa hiển thị đúng sau vài lần sửa/thêm/loại
thật).

#### §Giai đoạn 12 — Phát hiện: Cây duyệt Chuyền của Chế tạo hoàn toàn kẹt (không ai duyệt được) + 6 tài khoản TEST (2026-08-28)

Tra dữ liệu thật khi debug đơn #44 phát hiện: Bộ phận **Chế tạo (Id=7)** — Bộ phận DUY NHẤT có cấu
hình `ProductionApprovalStep` — **không có ai duyệt được ở BẤT KỲ cấp nào**:
- **Line Leader**: 17 người được đánh dấu `ProductionEmployee.IsLeader=1` qua file import, nhưng
  **0/17 có `Employees.UserName`** (nhân viên dưới chuyền không có tài khoản AD) → không ai xác thực
  được để trở thành candidate (xem §Giai đoạn 9, `JobTitleApprovalChainService` lọc
  `Employee.UserName != null`).
- **Group Leader/Team Leader/Manager/Factory Manager/Director**: **không ai** trong Bộ phận Chế tạo
  giữ các Chức vụ này (chỉ có 4 tài khoản test cũ — Cường/Vinh/Tuấn/Tiến — thuộc Nhóm/Bộ phận IT,
  không liên quan).

Hệ quả: **mọi đơn "theo chuyền" tạo ra trước 2026-08-28 đều kẹt cứng ngay bước 1**, không phải lỗi
riêng đơn nào — đây là khoảng trống dữ liệu tổ chức, không phải bug code. Đã báo người dùng, người
dùng chọn hướng: **tạo tài khoản TEST** (không đụng nhân viên thật) để test được Cây duyệt Chuyền,
scope theo Line SHIDO/Team HC — xem [identity-module.md §5.6](identity-module.md) cho cơ chế đăng
nhập TEST (bypass AD, chỉ Development).

**Dữ liệu Attendance đã tạo** (`YevOTManagement`, ghi tay qua `sqlcmd` — không có migration vì đây là
dữ liệu nghiệp vụ/test, không phải schema):
- 6 `Employee` mới, `Code` bắt đầu `T-` (`T-LL-SHIDO`/`T-GL-SHIDO`/`T-TL-SHIDO`/`T-MGR-CT`/`T-FM-01`/
  `T-DIR-01`), `UserName` khớp đúng `TestLoginAccount` tương ứng ở Identity — Line Leader/Group
  Leader/Team Leader gán `GroupId=35` (Nhóm "SHIDO"), Manager gán `DepartmentId=7` (Chế tạo — không
  `GroupId`, đúng quy ước Trưởng phòng), Factory Manager/Director không gán Nhóm/Bộ phận (dùng chung
  toàn công ty). `T-LL-SHIDO` gán thêm `JobTitleId=21` ("Line Leader") — dù không dùng để suy candidate
  (§Giai đoạn 9, Line Leader suy qua `ProductionEmployee.IsLeader`), vẫn cần set để permission tự động
  cấp theo Chức vụ hoạt động đúng (khớp cách 17 Line Leader thật cũng đều có `JobTitleId=21`).
- 1 `ProductionEmployee` mới (`EmployeeCode='T-LL-SHIDO'`, `BlockCode='SHIDO'`, `ProductionLineId=98`,
  `TeamCode='HC'`, `ShiftTeamCode='HC'`, `IsLeader=1`) để `T-LL-SHIDO` là candidate Line Leader hợp lệ
  của Line SHIDO. **Rủi ro đã biết**: dòng này sẽ bị `ProductionEmployeeImportService` soft-delete
  (`IsDeleted=true`) ở lần Import nhân sự dưới chuyền thật tiếp theo, vì `EmployeeCode='T-LL-SHIDO'`
  không có trong file Excel thật (import là upsert-by-code + xoá mềm mọi code không còn xuất hiện) —
  cần tạo lại tay sau mỗi lần Import nếu vẫn cần test.
- `JobTitlePermissions` cho Chức vụ "Director" (Id=20) — **trống hoàn toàn trước đó** (không phải lỗi
  do đợt này, phát hiện thêm khi setup) — đã copy nguyên 12 permission của "Factory Manager" (Id=19)
  sang Director để tài khoản test Director dùng được (an toàn vì chưa có nhân viên thật nào giữ Chức
  vụ Director).
- 6 dòng `UserPermissions` (Identity, `IsAutoGranted=true`) tương ứng — seed tay 1 lần vì lúc tạo dữ
  liệu `Identity.User` của 5/6 tài khoản còn chưa tồn tại (JIT-provision chỉ xảy ra lúc đăng nhập lần
  đầu — xem [identity-module.md §5.6](identity-module.md)); từ nay sửa Chức vụ các Employee này qua UI
  bình thường sẽ tự sync lại đúng cơ chế, không cần lặp lại bước tay này.

**6 tài khoản TEST** (đăng nhập qua `POST /api/Auth/login`, mật khẩu chung `Test@2026`, CHỈ hoạt động
khi BE chạy Development):

| UserName | Vai trò | Phạm vi |
|---|---|---|
| `TEST\ll_shido` | Line Leader | Line SHIDO |
| `TEST\gl_shido` | Group Leader | Nhóm SHIDO |
| `TEST\tl_shido` | Team Leader | Nhóm SHIDO |
| `TEST\mgr_ct` | Manager | Bộ phận Chế tạo |
| `TEST\fm_01` | Factory Manager | Toàn công ty |
| `TEST\dir_01` | Director | Toàn công ty |

**Mật khẩu cấp 2 + chữ ký đã cấu hình đủ (2026-08-28)** — cả 6 tài khoản đều đã đăng ký Mật khẩu cấp 2
(`Test@2026`, cùng giá trị với mật khẩu đăng nhập TEST cho dễ nhớ); riêng 3 tài khoản ở bước
`RequiresSignature=true` theo `ProductionApprovalStep` của Chế tạo (`TEST\gl_shido`, `TEST\tl_shido`,
`TEST\mgr_ct`) đã đăng ký thêm chữ ký (ảnh PNG 1x1 placeholder — chỉ để vượt qua check "đã có chữ ký
chưa", không phải chữ ký thật). `TEST\ll_shido`/`TEST\fm_01`/`TEST\dir_01` KHÔNG cần chữ ký (bước
tương ứng `RequiresSignature=false`) nên cố tình không đăng ký.

Vì tài khoản TEST không có Email thật (JIT-provision không resolve được AD thật), luồng xác nhận qua
email bình thường (`RequestUpdateAsync` gửi mail) không áp dụng được — đã tự lấy `Token` thẳng từ
`PendingSecondaryPasswordConfirmations`/`PendingSignatureConfirmations` (DB) rồi gọi thẳng
`POST .../confirm/{token}` ([AllowAnonymous], vốn dùng cho link email) để kích hoạt, KHÔNG bypass
service/hasher — đi đúng luồng `SecondaryPasswordService`/`UserSignatureService` sẵn có, chỉ thay bước
"nhận link qua email" bằng đọc token trực tiếp.

**Chưa verify sống** — đã xác nhận 6 tài khoản đăng nhập được, trả đúng permission, có đủ Mật khẩu cấp
2/chữ ký theo yêu cầu từng bước, nhưng CHƯA thử tạo 1 đơn "theo chuyền" thật cho Line SHIDO rồi đi hết
chuỗi duyệt Line Leader → Group Leader → Team Leader → Manager qua UI thật (chỉ mới test tay từng
API bằng `curl`/PowerShell).

#### §Giai đoạn 13 — Group Leader/Team Leader "theo chuyền" đổi sang duyệt CHUNG cả Bộ phận + thêm 10 Line Leader TEST (2026-08-28)

Theo yêu cầu người dùng ("Riêng ở dưới chuyền thì việc GL và TL sẽ là người duyệt tổng được luôn"):
đơn "theo chuyền" (`ProductionApprovalStep`, §Giai đoạn 9) đổi phạm vi tìm ứng viên bước **Group
Leader/Team Leader** từ **theo đúng Nhóm của người trong đơn** sang **CHUNG cả Bộ phận Chế tạo** —
khớp đúng cách Manager đã hoạt động (`deptCandidates`), KHÔNG còn cần `derivedGroupId`/khớp
`Employee.GroupId` nữa. **Chỉ áp dụng cho đơn "theo chuyền"** — đơn "theo Nhóm" (`GroupApprovalStep`,
§Giai đoạn 4) vẫn giữ nguyên scoping theo từng Nhóm như cũ, không đổi gì.

Sửa `JobTitleApprovalChainService.ResolveChainForProductionCreationAsync`
(`Attendance.Application/Services/JobTitleApprovalChainService.cs`): xoá hẳn việc suy `derivedGroupId`
từ `employeeIds` (không còn dùng); `groupScopedCandidates` đổi predicate từ `x.GroupId ==
derivedGroupId` sang `(x.Group != null && x.Group.DepartmentId == departmentId) || x.DepartmentId ==
departmentId` (y hệt `deptCandidates`). Hệ quả: `TEST\gl_shido`/`TEST\tl_shido` (Giai đoạn 12) giờ là
candidate hợp lệ cho **MỌI** đơn theo chuyền của Chế tạo, không riêng gì Line SHIDO/Nhóm SHIDO.

**Thêm 10 tài khoản TEST Line Leader** cho 10 Line thật khác của Chế tạo (đều đang có Leader thật qua
`ProductionEmployee.IsLeader=1` nhưng không ai có `UserName`, cùng tình trạng đã phát hiện ở Giai đoạn
12) — nhờ thay đổi trên, giờ chỉ cần thêm Line Leader là đủ đi hết chuỗi duyệt cho Line đó, không cần
tạo thêm Group Leader/Team Leader riêng nữa. Migration `AddMoreTestLineLeaderAccounts` (Identity, seed
`TestLoginAccounts`, cùng mật khẩu `Test@2026`) + `Employee`/`ProductionEmployee` tương ứng ghi tay
(`YevOTManagement`, cùng cơ chế Giai đoạn 12 — không có migration data vì là dữ liệu nghiệp vụ/test).
Mỗi tài khoản đã cấu hình Mật khẩu cấp 2 (`Test@2026`, KHÔNG cần chữ ký — bước Line Leader của Chế tạo
`RequiresSignature=false`):

| UserName | Line (`BlockCode`/`ProductionLineId`) |
|---|---|
| `TEST\ll_4s` | 4S / 75 |
| `TEST\ll_ct` | CT / 78 |
| `TEST\ll_f` | F / 92 |
| `TEST\ll_hl` | HL / 66 |
| `TEST\ll_kanbanmae` | KANBAN-MAE / 85 |
| `TEST\ll_kza` | KZ-A / 87 |
| `TEST\ll_kzm` | KZ-M / 91 |
| `TEST\ll_tc` | TC / 57 |
| `TEST\ll_tca` | TCA / 94 |
| `TEST\ll_tqm` | TQM / 99 |

Tổng cộng 16 tài khoản TEST hiện có cho Attendance (11 Line Leader + `gl_shido`/`tl_shido`/`mgr_ct`/
`fm_01`/`dir_01`) — đủ để tạo + duyệt hết 1 đơn "theo chuyền" trên BẤT KỲ Line nào trong 11 Line kể
trên, không riêng gì SHIDO.

**Chưa verify sống** — build sạch, cả 2 migration (Identity) đã `database update` lên DB thật, smoke
test 7 bước vẫn pass, đã xác nhận qua SQL rằng `gl_shido`/`tl_shido` khớp đúng điều kiện ứng viên mới
(department-wide) — nhưng CHƯA tạo/duyệt thật 1 đơn nào trên các Line mới thêm qua UI.

#### §Giai đoạn 14 — Sửa quyền tạo đơn "theo chuyền": Line Leader không cần tự tăng ca (2026-08-28)

Người dùng phát hiện lỗi thiết kế khi test bằng `TEST\ll_shido`: quy tắc CŨ ở
`CreateProductionFormAsync` bắt creator (không phải Admin) **phải nằm trong chính danh sách nhân viên
của đơn** — comment gốc thú nhận đây chỉ là giải pháp tạm ("không có Group để check như đơn theo
Nhóm"). Hệ quả sai: Line Leader đứng ra lập đơn OT cho cả Line mình phụ trách nhưng bản thân KHÔNG
tăng ca hôm đó sẽ bị chặn vô lý bởi thông báo "Bạn chỉ được tạo đơn có chính bạn trong danh sách nhân
viên."

**Quy tắc mới** (đã xác nhận với người dùng): Admin luôn được tạo (không đổi); người thường phải là
**Line Leader thật** (`ProductionEmployee.IsLeader=true`) của **ít nhất 1 Line** có mặt trong danh
sách nhân viên của đơn — không còn yêu cầu chính họ có tên trong danh sách tăng ca. Sửa
`OtFormService.CreateProductionFormAsync`: suy `orderLineIds` (các `ProductionLineId` phân biệt của
những nhân viên trong `request.Employees`, qua `ProductionEmployee`), rồi kiểm tra
`creatorEmployee.Id` có ít nhất 1 dòng `ProductionEmployee.IsLeader=true` trùng 1 trong các
`orderLineIds` đó không.

Không đổi `AddEmployeeAsync`/`UpdateAsync` (đơn theo chuyền) — 2 hàm đó vốn đã dùng đúng quy tắc
"candidate của bước Pending hiện tại", không mắc lỗi tương tự.

**Chưa verify sống** — build sạch, smoke test 7 bước vẫn pass — nhưng CHƯA test tay qua UI thật việc
`TEST\ll_shido` tạo đơn cho các đồng nghiệp Line SHIDO khi chính mình không có tên trong danh sách.

#### §Giai đoạn 15 — Sửa lỗi: permission `Attendance.OTForm.AddEmployee` chưa từng được cấp qua Chức vụ (2026-08-28)

Người dùng phát hiện đăng nhập bằng `TEST\gl_shido` (Group Leader) rồi thử "Thêm nhân viên vào đơn"
(tính năng Giai đoạn 11) thì không làm được. Nguyên nhân: `Attendance.OTForm.AddEmployee` (permission
mới thêm ở Giai đoạn 11) **được seed gán cho Role** (migration `AddOtFormAddEmployeePermission`,
copy quyền theo Role đang giữ `RemoveEmployee`), nhưng **quên thêm vào bảng `JobTitlePermissions`**
(cơ chế cấp quyền tự động theo Chức vụ, §Cây chức vụ) — nên bất kỳ ai được cấp quyền qua Chức vụ (toàn
bộ luồng "theo chuyền"/"theo Nhóm" hiện tại, không dùng Role phân quyền tay nữa) đều thiếu quyền này
dù đúng là candidate hợp lệ của bước đang chờ — bị chặn ở tầng `[RequirePermission]` trước khi vào tới
logic nghiệp vụ.

**Đã sửa**: thêm `Attendance.OTForm.AddEmployee` vào `JobTitlePermissions` cho đúng 7 Chức vụ đang có
sẵn `Attendance.OTForm.RemoveEmployee` (Staff/Line Leader/Group Leader/Team Leader/Manager/Factory
Manager/Director — mirror y hệt danh sách Chức vụ đang giữ Remove), cộng thêm cấp thẳng
`UserPermissions` (Identity, `IsAutoGranted=true`) cho MỌI tài khoản đang có sẵn Identity.User và giữ 1
trong 7 Chức vụ đó (cả tài khoản TEST lẫn tài khoản thật: `m.cuong.da.pcd.it`, `m.khoi80419`,
`n.truong.da.pcd.it`, `t.sang80972`, `tuan.system.da`, `v.vinh72266` — riêng `tien.section.da` chưa có
Identity.User nào cả, vì chưa từng đăng nhập lần nào, sẽ tự có quyền này khi có ai sync lại Chức vụ
của họ sau lần đăng nhập đầu, không cần thao tác tay thêm). Ghi tay qua `sqlcmd` (không phải migration
vì đây là sửa DATA, không đổi schema) — về sau Admin sửa `JobTitlePermissions` qua UI bình thường
(`PUT /api/JobTitlePermission/{jobTitleId}`) vẫn hoạt động đúng, không bị ghi đè lại.

**Đã verify sống** — gọi lại `POST /api/Auth/login` bằng `TEST\gl_shido`, xác nhận
`Attendance.OTForm.AddEmployee` đã có trong danh sách permission trả về.

Lưu ý FE khi Admin sửa quyền qua Chức vụ (hoặc BE seed tay như trên): permission của 1 phiên đăng
nhập đang mở chỉ đọc lại khi gọi `GET /api/Auth/me` (JWT không tự refresh) — nút "Làm mới quyền" ở
Header đã có sẵn cho đúng trường hợp này, cần bấm lại (hoặc đăng nhập lại) sau khi quyền vừa đổi mới
thấy nút/hành động mới xuất hiện ở FE.

#### §Giai đoạn 16 — Màn Chi tiết đơn hiện Line/Team/Nhóm ca cho đơn "theo chuyền" (2026-08-29)

Người dùng chỉ ra `OtFormDetail.tsx` (màn Chi tiết đơn) hiển thị y hệt đơn "theo Nhóm" dù đang xem 1
đơn "theo chuyền" — không có gì cho biết Line/Team/Nhóm ca, dù dữ liệu snapshot
(`blockCodeSnapshot`/`teamCodeSnapshot`/`shiftTeamCodeSnapshot`) đã có sẵn trên `OtFormEmployeeDto`
(màn Sửa đơn `CreateOtFormPage.tsx` đã hiện từ Giai đoạn trước, riêng màn Chi tiết đơn thì quên).
Thêm 2 chỗ, gate theo `form.isProductionForm`:
- Khối "Thông tin đơn": 3 ô Line/Team/Nhóm ca — giá trị PHÂN BIỆT gộp từ toàn bộ nhân viên còn active
  trong đơn (`useMemo productionSummary`, lọc `!employee.isRemoved`).
- Bảng danh sách nhân viên: 3 cột Line/Team/Nhóm ca chèn ngay sau "Họ và tên" — đúng theo TỪNG người
  (khác đơn theo Nhóm, các Line trong 1 đơn theo chuyền có thể khác nhau giữa các nhân viên). Dòng đã
  bị loại khỏi đơn (`isRemoved`) tăng `colSpan` của ô ghi chú loại bỏ thêm 3 (6→9) để không lệch bảng.

Thêm i18n key `colBlockCode`/`colTeamCode`/`colShiftTeam` vào namespace `Attendance.OtFormDetail`
(vi.json/ja.json) — namespace riêng với `Attendance.CreateOtForm` (đã có 3 key cùng tên/nghĩa từ
trước), không dùng chung được vì next-intl không share key giữa 2 namespace.

**Sửa tiếp (2026-08-29, theo phản hồi người dùng ngay sau khi thêm 3 cột trên)**: bảng bị nhận xét
"rối chữ" — cột "Có ăn" đổi từ pill có icon+chữ (`✓ Có ăn`/`✗ Không ăn`) sang CHỈ 1 icon căn giữa
(`Check`/`X`, `lucide-react`), bỏ chữ vì header cột đã ghi rõ ý nghĩa rồi — `title`/`aria-label` vẫn
giữ nguyên text cũ để hover/screen reader không mất thông tin. Lucide icon component không nhận prop
`title` trực tiếp (lỗi kiểu `LucideProps` không có `title`) — phải bọc icon trong `<span title=...>`.
Các cột khác (Loại phiếu ăn — 3 trạng thái, không rút gọn về icon đơn được) giữ nguyên, chưa đổi.

**Đã verify** — `tsc --noEmit`/`eslint` sạch trên `OtFormDetail.tsx`. Chưa test tay qua UI thật (cần
mở lại 1 đơn theo chuyền để xem — đơn #47 trong ảnh chụp màn hình người dùng gửi là ví dụ phù hợp).

### §DB
- DB: `YevOTManagement` (server `DASVRFAST`, conn `OTManagementConnection`). DbContext: `AttendanceDbContext`.
- Migrations theo thứ tự: `InitAttendance` → `AddOtCaseApprovalLevelAndEmployeeScope` → `RemoveAreaLineFromOtFormAddGroupDepartment` → `MakeEmployeeGroupRequiredRemoveDepartment` → `RenameUserIdToUserName` → `AddApproverFullNameToOtFormApprovalHistory` → `AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName` → `AddMealTicketCountsToProcessPart` → `AddEmailConfirmationTables` → `AddSecondaryPassword` (2026-07-30, bảng `SecondaryPasswords`/`PendingSecondaryPasswordConfirmations`) → `AddRemovedFieldsToOtFormEmployee` (2026-07-30, 6 cột soft-remove trên `OtFormEmployees`) → `AddAttendanceSetting` (2026-08-01, bảng `AttendanceSettings` 1 dòng, seed `(2.5, 25, 300)` — xem §Cấu hình phiếu ăn & giới hạn lũy kế) → `AddOtFormBatch` (2026-08-06, bảng `OtFormBatches`/`OtFormBatchEmailTokens` — xem §Đơn tổng) → `AddProjectedAccumulationToEmployee` (2026-08-06, 4 cột `Projected*` trên `Employees` — xem §Lũy kế dự kiến) → `AddJobTitle` (2026-08-06, bảng `JobTitles` + cột `Employees.JobTitleId` + seed 14 chức vụ — xem §Cây chức vụ) → `AddRequesterResponsible` (2026-08-06, cột `Requester*`/`Responsible*` trên `Group`/`OtForm` — tính năng KHÁC, không thuộc Cây chức vụ; **DB thật đã có sẵn schema này từ trước** do ai đó áp dụng tay ngoài EF, migration được **stamp thẳng vào `__EFMigrationsHistory` chứ không chạy lại DDL**, xem ghi chú cuối §Cây chức vụ Giai đoạn 2b) → `AddDepartmentApprovalStep` (2026-08-06, bảng `DepartmentApprovalSteps`, không seed dữ liệu — xem §Cây chức vụ Giai đoạn 2b) → `MoveRequiresSignatureToDepartmentApprovalStep` (2026-08-07, `DropColumn JobTitles.RequiresSignature` + `AddColumn DepartmentApprovalSteps.RequiresSignature` — xem §Cây chức vụ Giai đoạn 2c) → `AddIsResponsibleToDepartmentApprovalStep` (2026-08-07, `AddColumn DepartmentApprovalSteps.IsResponsible` — xem §Cây chức vụ Giai đoạn 2d) → `GiaiDoan3JobTitleApprovalStepWiring` (2026-08-07, rename `ApprovalLevel→OtFormApprovalStepId` trên `OtFormApprovalHistories`/`OtFormApprovalEmailTokens`, `AddColumn OtForms.ApprovalChainWarning`, `CreateTable OtFormApprovalSteps`/`OtFormApprovalStepCandidates` — xem §Cây chức vụ Giai đoạn 3.1) → `RemoveUserApprovalScope` (2026-08-08, Giai đoạn 3.2, `DropTable UserApprovalScopes` — xoá hẳn feature orphaned, xem §Cây chức vụ Giai đoạn 3.2 mục 4) → `AddOtFormDeleteFields` (2026-08-08, `AddColumn` 4 cột `Deleted*`/`DeleteReason` trên `OtForms` — xem §Xoá đơn kẹt vĩnh viễn) → `MakeEmployeeGroupNullableAddDepartment` (2026-08-08, `AlterColumn Employees.GroupId NULL` + `AddColumn Employees.DepartmentId` + FK + index — xem §Gán tổ chức theo Chức vụ) → `AddBatchAutoSendTimeToAttendanceSetting` (2026-08-08, `AddColumn AttendanceSettings.BatchAutoSendTime:TimeOnly` default `15:00:00` — xem §Đơn tổng) → `RemoveOldRequesterResponsibleAddCreatorSignature` (2026-08-08, `DropColumn` toàn bộ `Requester*`/`Responsible*` trên `Groups`/`OtForms` + FK liên quan, `AddColumn OtForms.CreatorSignatureImage:byte[]?` — xem §Người tạo tự ký ô "Người đề nghị") → `AddGroupApprovalStepRemoveDeptResponsible` (2026-08-08, `CreateTable GroupApprovalSteps` + `DropColumn DepartmentApprovalSteps.IsResponsible` — xem §Giai đoạn 4) → `SimplifyJobTitleTo6Levels` (2026-08-08, xoá toàn bộ dữ liệu đơn OT + cấu hình cây duyệt cũ, reset `Employees.JobTitleId=NULL`, thu gọn `JobTitles` 14→6 dòng — xem §Giai đoạn 4) → `AddJobTitlePermission` (2026-08-10, `CreateTable JobTitlePermissions` — xem §Giai đoạn 6) → `AddApprovalStepCoordinators` (2026-08-11, `CreateTable DepartmentApprovalStepCoordinators`/`GroupApprovalStepCoordinators` — xem §Giai đoạn 7) → `ChangeApprovalStepCoordinatorsToEmployeeId` (2026-08-11b, đổi khoá 2 bảng trên từ `UserName` sang `EmployeeId` FK, MAP dữ liệu cũ qua `Employees.UserName` trùng khớp trước khi xoá cột — xem §Giai đoạn 7, mục "Sửa 2026-08-11b") → `AddEmployeeAccumulationHistory` (2026-08-11d, `CreateTable EmployeeAccumulationHistories` — xem §Giai đoạn 8). Tất cả đã `database update`/stamp vào `YevOTManagement` (permission Identity tương ứng `AddJobTitlePermissions`/`AddDepartmentApprovalStepPermissions`/`AddGroupApprovalStepPermissions`/`AddJobTitlePermissionPermissions`/`AddApprovalStepCoordinatorPermissions` cũng đã apply vào `YevIdentityManagement`, cùng `AddIsAutoGrantedToUserPermission` — `AddColumn UserPermissions.IsAutoGranted` — xem §Giai đoạn 6). Đã xác nhận lại 2026-08-08 qua `__EFMigrationsHistory` trên DB thật: `GiaiDoan3JobTitleApprovalStepWiring` đứng đầu danh sách migration đã apply — dòng cảnh báo "CHƯA apply" trước đây đã lỗi thời, xoá bỏ.
- Do nhiều DbContext trong solution, mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`. Riêng migration `AddEmailToUser` (thêm `Users.Email`), `AddAttendancePermissionsAndRoles` (seed Permission/Role), `AddCategoryViewPermissionsToTruongGroup` (2026-07-17, vá lỗ hổng thiếu 4 permission View danh mục cho Role Trưởng nhóm — xem §Permission & Role đã seed), `AddSecondaryPasswordPermission` (2026-07-30, seed `Attendance.SecondaryPassword.Update`), `AddOtFormRemoveEmployeePermission` (2026-07-30, seed `Attendance.OTForm.RemoveEmployee` — xem §Loại nhân viên khỏi đơn), `AddAttendanceSettingPermission` (2026-08-01, seed `Attendance.Setting.Update` — xem §Cấu hình phiếu ăn & giới hạn lũy kế), `RemoveUserApprovalScopePermissions` (2026-08-08, xoá 3 permission `Attendance.UserApprovalScope.View/Create/Delete` + `RolePermissions` liên quan), `AddOtFormDeletePermission` (2026-08-08, seed `Attendance.OTForm.Delete`, chỉ gán Admin — xem §Xoá đơn kẹt vĩnh viễn), `AddGroupApprovalStepPermissions` (2026-08-08, seed `Attendance.GroupApprovalStep.View/Update` — xem §Giai đoạn 4), `AddIsAutoGrantedToUserPermission` (2026-08-10, `AddColumn UserPermissions.IsAutoGranted` — xem §Giai đoạn 6), `AddJobTitlePermissionPermissions` (2026-08-10, seed `Attendance.JobTitlePermission.View/Update` — xem §Giai đoạn 6), `RemoveNhanVienRole` (2026-08-10, xoá Role legacy `Nhân viên` — 0 người giữ, xác nhận trước khi xoá, xem §Giai đoạn 6), và `AddApprovalStepCoordinatorPermissions` (2026-08-11, seed `Attendance.DepartmentApprovalStepCoordinator.{View,Update}`/`Attendance.GroupApprovalStepCoordinator.{View,Update}`, chỉ gán Admin — xem §Giai đoạn 7) nằm ở DB **Identity** (`Indentity.Infrastructure`, `--context IdentityDbContext`), không phải Attendance.

## 1. Cấu trúc code đã có

### Danh mục CRUD chuẩn (Department/Group/Reason/OtCase/JobTitle/Employee)
`DepartmentApprovalStepController`/`GroupApprovalStepController` KHÔNG theo pattern CRUD chuẩn này —
xem riêng ở §Cây chức vụ Giai đoạn 2b/Giai đoạn 4 (`GET`/`PUT by-department/{departmentId}` và
`GET`/`PUT by-group/{groupId}`, quản lý theo kiểu thay nguyên danh sách).
Mỗi entity có đủ: `I{Entity}Repository` (Application/Interfaces/Repository) + impl (Infrastructure/Repositories) → property trong `IAttendanceUnitOfWork`/`AttendanceUnitOfWork` → `{Entity}Dto`/`Create{Entity}Dto`/`Update{Entity}Dto` (Application/Dtos) → `{Entity}Service : BaseService<IAttendanceUnitOfWork>` → `{Entity}Controller : BaseController` (route `grid-list`/`all`/`{id}`/POST/PUT/DELETE, `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- `GroupController` có thêm `GET /by-department/{departmentId}` (dropdown phụ thuộc).
- `EmployeeController` có thêm `GET /all` (toàn bộ nhân viên active, mọi Group — mới 2026-08-06, dùng
  cho "Thử chuỗi duyệt" §Cây chức vụ; trước đó `EmployeeApi.getAllEmployees()` ở FE gọi endpoint này
  nhưng BE chưa có action tương ứng, ra lỗi 400 `"The value 'all' is not valid"` vì rơi vào route
  `GET /{id}` — đã vá) và `GET /by-group/{groupId}` (Trưởng nhóm chọn hàng loạt nhân viên).
- `JobTitleController` có thêm `GET /resolve-chain?employeeId=&otCaseId=` (xem trước chuỗi duyệt tự
  động, đọc-only — xem §Cây chức vụ).

### UserSignature (`UserSignatureController`)
- `GET /me`, `PUT /me` (yêu cầu cập nhật chữ ký **của chính mình** — không áp dụng ngay, gửi email xác nhận, `[RequirePermission("Attendance.UserSignature.Update")]`).
- `GET /{userName}` (admin xem chữ ký người khác, `Attendance.UserSignature.View`).
- `GET/POST /confirm/{token}` (`[AllowAnonymous]`) — xác nhận qua email, xem §Xác thực qua email.

### SecondaryPassword (`SecondaryPasswordController`) — mật khẩu cấp 2 (2026-07-30)
- `GET /me`, `PUT /me` (yêu cầu thiết lập/cập nhật mật khẩu cấp 2 **của chính mình** — không áp dụng
  ngay, gửi email xác nhận, `[RequirePermission("Attendance.SecondaryPassword.Update")]`).
- `GET/POST /confirm/{token}` (`[AllowAnonymous]`) — xác nhận qua email, mirror `UserSignatureController`.
- Không có `GET /{userName}` (khác `UserSignature`) — không có nhu cầu Admin xem hộ mật khẩu người khác.
- Xem §Mật khẩu cấp 2 khi ký/duyệt OtForm.

### AttendanceSetting (`AttendanceSettingController`) — cấu hình dùng chung (2026-08-01)
- `GET /api/AttendanceSetting` — **KHÔNG có `[RequirePermission]`**, mở cho mọi tài khoản đăng nhập
  (kể cả Role "Nhân viên") vì màn Tạo đơn cần đọc để tự tính phiếu ăn/tô đỏ lũy kế.
- `PUT /api/AttendanceSetting` — `[RequirePermission("Attendance.Setting.Update")]` (chỉ Admin).
- Field `BatchAutoSendTime:TimeOnly` (mới 2026-08-08) — giờ tự động gom "Đơn tổng", xem §Đơn tổng.
- Xem §Cấu hình phiếu ăn & giới hạn lũy kế.

### OtForm (`OtFormController`) — nghiệp vụ chính

> Danh sách endpoint bên dưới đã cập nhật theo Giai đoạn 3.1 (2026-08-07) — mọi tham chiếu
> Draft/Submitter/GroupHead/PendingGroupHead trong các đoạn cũ khác của tài liệu này không còn đúng.

- `POST /api/OtForm` — tạo đơn, vào chuỗi duyệt Cây chức vụ **ngay lập tức** (`Attendance.OTForm.Create`)
  — không còn giai đoạn Draft. Xem §Cây chức vụ Giai đoạn 3.1.
- `GET /api/OtForm/my-forms` — đơn do chính mình tạo (`Attendance.OTForm.View`).
- `GET /api/OtForm/pending-approvals` — đơn đang chờ chính mình duyệt, tự lọc theo bước hiện tại
  (`OtFormApprovalStep.Status=Pending`, `StepOrder` nhỏ nhất) có mặt trong `Candidates` (`Attendance.OTForm.Approve`).
  Mỗi item có thêm `CurrentStepCandidateCount:int` (2026-08-08, Giai đoạn 3.2) — số người đủ điều kiện
  xử lý bước đang chờ; FE hiện "đang chờ 1 trong N người" khi >1, xem §UX Chờ tôi duyệt.
  Endpoint `GET /api/OtForm/pending-submissions` (Draft/ký "Người đề nghị" cũ, luôn trả rỗng) đã **xoá
  hẳn** ở Giai đoạn 3.2 — không còn method/route/tab FE tương ứng.
- `GET /api/OtForm/my-actions` — lịch sử đơn **CHÍNH mình đã Ký/Duyệt/Từ chối** ở bất kỳ bước nào, gate bằng `Attendance.OTForm.View`. `OtFormService.GetMyActionsAsync` truy `OtFormApprovalHistory.ApproverUserName == user hiện tại` lấy `OtFormId` (distinct) rồi trả về `OtForm` tương ứng — gồm cả đơn từng bị chính user đó **Từ chối**.
- **Lọc theo ngày + trạng thái** (2026-08-06) — cả 5 endpoint danh sách trên nhận thêm `fromDate`/`toDate` (`OtForm.Date`, bao gồm 2 đầu mút) và `status` (đúng giá trị `OtFormStatus` mới) — cả 3 optional. FE: bộ lọc dùng chung trong `OtFormListPage.tsx` — xem hợp đồng field ở [attendance-api-fe.md §4.2](attendance-api-fe.md).
- `GET /api/OtForm/{id}` — chi tiết đầy đủ (Employees kèm lũy kế + phiếu ăn, ProcessPart, ApprovalHistories, **`ApprovalSteps[]` mới**).
- `PUT /api/OtForm/{id}` — sửa (chỉ còn giờ kết thúc từng nhân viên), chỉ chính người tạo và chỉ khi `Status==InApproval` VÀ chưa bước nào `Approved` (`Attendance.OTForm.Create`).
- `POST /api/OtForm/{id}/approve`, `POST /api/OtForm/{id}/reject` (`Attendance.OTForm.Approve`) — tác động lên "bước đang chờ" (`Status=Pending`, `StepOrder` nhỏ nhất), ký thật chỉ bắt buộc nếu `RequiresSignatureSnapshot=true`. `approve` tự cộng lũy kế nhân viên nếu đạt `Completed` (hết bước), tự gửi email cho candidate bước kế tiếp nếu còn.
- `POST /api/OtForm/{id}/employees/remove` (`Attendance.OTForm.RemoveEmployee`) — loại 1 nhân viên khỏi đơn để duyệt được phần còn lại; Admin luôn bypass, non-Admin phải là candidate của bước hiện tại. Không đổi `Status`, không ký lại bước trước. Xem §Loại nhân viên khỏi đơn.
- `GET /email-confirm/{token}`, `POST /email-confirm/{token}/approve`, `POST /email-confirm/{token}/reject` (`[AllowAnonymous]`) — kênh bổ sung qua email, xem §Xác thực qua email.
- `BaseController.CurrentUserName` (`Attendance.Api/Controllers/BaseController.cs`) — helper lấy `User.Identity.Name` dùng chung cho mọi Controller cần biết "ai đang gọi API".

### OtFormBatch (`OtFormBatchController`) — Đơn tổng (2026-08-06, redesign Giai đoạn 3.2 2026-08-07 — xem §Đơn tổng)
- `GET /api/OtFormBatch/grid-list`, `GET /api/OtFormBatch/{id}`, `POST /api/OtFormBatch/{id}/approve`,
  `GET/POST email-confirm/{token}` — route không đổi, Service phía sau đã redesign đầy đủ theo Cây chức
  vụ (xem §Đơn tổng). `OtFormBatchBackgroundService` đã đăng ký lại ở `Program.cs`, job chạy hằng ngày
  vào giờ đọc từ `AttendanceSetting.BatchAutoSendTime`.
- `POST /api/OtFormBatch/run-now` (mới 2026-08-08, permission `Attendance.Setting.Update`) — chạy ngay
  `RunDailyBatchSweepAsync()` thay vì đợi tới giờ cấu hình, dùng khi test hoặc cần gửi gấp. Gọi endpoint
  này khi đang có batch `Pending` thật sẽ gửi mail nhắc thật cho người duyệt — không phải thao tác
  read-only.

### AttendanceAiChat (`AttendanceAiChatController`) — trợ lý AI lập đơn tăng ca (2026-07-29)
- `POST /api/AttendanceAiChat/stream` (`Attendance.AiChat.Use`, seed migration `AddAttendanceAiChatPermission`,
  hiện chỉ gán Admin) — NDJSON streaming, cùng pattern deliberate exception "không bọc `ApiResponse<T>`"
  như `Asset.Api.Controllers.AiChatController`. Thiết kế đầy đủ, bảng 7 tool, cơ chế xác nhận trước khi
  ghi ở [attendance-aichat-be-huong-dan.md](attendance-aichat-be-huong-dan.md); hợp đồng FE ở
  [attendance-api-fe.md §10](attendance-api-fe.md).
- **Khác Asset AI Chat ở điểm cốt lõi**: đây là tool GHI dữ liệu đầu tiên (`create_ot_form_draft` gọi
  thẳng `OtFormService.CreateAsync` đã có — không business logic mới, không bypass validate/scope nào).
  `AttendanceAiChatController` phải tự đọc `CurrentUserName`/`CurrentFullName`/`User.IsInRole(AdminRole)`
  rồi truyền tay xuống orchestrator (`AttendanceAiChatCallerContext`) — khác `AiChatController` của
  Asset (không cần biết ai đang hỏi vì mọi tool đều read-only).
- **`IOllamaChatClient`/`OllamaChatClient` dùng chung với Asset**, đã chuyển từ `Asset.Application`/
  `Asset.Infrastructure` sang `Shared.Application`/`Shared.Infrastructure` (2026-07-29) — 1 registration
  DI duy nhất phục vụ cả 2 module, `tools` (JSON schema) giờ là tham số thay vì hard-code
  `AiChatToolDefinitions` của Asset.

### EmployeeImport (`EmployeeImportController`) — import Excel nhân sự (2026-07-16)
- `POST /preview` (nhận file `.xlsx`), `POST /confirm` — pattern Preview/Confirm giống `DeviceImportController` ở module Asset (ClosedXML). Upsert theo `Employee.Code` (unique) — mã đã có thì cập nhật `FirstName/LastName/GroupId`, mã chưa có thì tạo mới kèm tự tạo `Department`/`Group` nếu mã chưa tồn tại. Gắn `[RequirePermission("Attendance.Employee.Create")]`.

### Employee — endpoint tự chỉnh lũy kế — ĐÃ XOÁ (2026-08-08)
`PATCH /api/Employee/{id}/adjust-accumulation` và `GET /api/Employee/me` (thêm 2026-07-16) **không còn tồn
tại** — người dùng chốt bỏ hẳn khả năng tự chỉnh lũy kế của user thường, chỉ Admin làm qua
`PUT /api/Employee/{id}` bình thường. Xem §Lũy kế tháng/năm.

### Permission & Role đã seed (Identity migration `AddAttendancePermissionsAndRoles`)
- 28 permission `Attendance.*`: CRUD 5 danh mục + `UserApprovalScope.{View,Create,Delete}` + `UserSignature.{View,Update}` + `OTForm.{View,Create,Approve}`. **+1** (2026-07-29, migration riêng `AddAttendanceAiChatPermission`): `Attendance.AiChat.Use`, hiện chỉ gán Admin — xem mục `AttendanceAiChatController` ở trên. **+1** (2026-07-30, migration `AddSecondaryPasswordPermission`): `Attendance.SecondaryPassword.Update`, gán qua subquery cho đúng các Role đang giữ `UserSignature.Update` (Admin + 5 Role nghiệp vụ) — xem §Mật khẩu cấp 2 khi ký/duyệt OtForm. **+1** (2026-07-30, migration `AddOtFormRemoveEmployeePermission`): `Attendance.OTForm.RemoveEmployee`, cùng cách gán qua subquery theo `UserSignature.Update` — xem §Loại nhân viên khỏi đơn. **+1** (2026-08-01, migration `AddAttendanceSettingPermission`): `Attendance.Setting.Update`, gán qua subquery theo `Attendance.Department.Create` (chỉ Admin) — xem §Cấu hình phiếu ăn & giới hạn lũy kế. `GET /api/AttendanceSetting` cố tình KHÔNG có permission riêng (mở cho mọi tài khoản đăng nhập).
**+4** (2026-08-06, migration `AddJobTitlePermissions`): `Attendance.JobTitle.{View,Create,Update,Delete}`, cùng cách gán qua subquery theo `Attendance.Department.Create` (chỉ Admin) — xem §Cây chức vụ. **+2** (2026-08-06, migration `AddDepartmentApprovalStepPermissions`): `Attendance.DepartmentApprovalStep.{View,Update}`, cùng cách gán qua subquery — xem §Cây chức vụ Giai đoạn 2b.
- 4 Role mới: `Trưởng nhóm` (Create+View OTForm, View Employee, Update UserSignature, **+ View Department/Group/Reason/OtCase** — xem ngay dưới), `Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc` (View+Approve OTForm, Update UserSignature). `Admin` được gán full toàn bộ permission `Attendance.*`.
- **Lỗ hổng đã vá (2026-07-17, migration `AddCategoryViewPermissionsToTruongGroup`)**: seed ban đầu (`AddAttendancePermissionsAndRoles`) chỉ gán `Trưởng nhóm` 4 permission (`OTForm.Create/View`, `Employee.View`, `UserSignature.Update`) — THIẾU `Department.View`/`Group.View`/`Reason.View`/`OtCase.View` (permission riêng biệt cho từng danh mục, không nằm trong `OTForm.View`). Hậu quả: Trưởng nhóm gọi `GET /api/Department/all`, `GET /api/Group/by-department/{id}`, `GET /api/Reason/all`, `GET /api/OtCase/all` (4 API load dropdown cho màn "Tạo đơn tăng ca") đều bị 403 — màn Tạo đơn không dùng được trên thực tế dù mọi API OtForm đã sẵn sàng. Đã bổ sung 4 permission này cho Role `Trưởng nhóm`, verify lại qua SQL trực tiếp trên DB thật (2026-07-17) — Role này hiện có đủ 8 permission `Attendance.*`.
- **Chưa làm**: gán Role cho user thật (`update-user-roles`/`create-user` — API Identity có sẵn) và tạo dòng `UserApprovalScope` cho từng Trưởng phòng/Trưởng xưởng **và mỗi người được phép tạo đơn** (`ApprovalLevel=Submitter`, xem §Business Logic — Phân quyền tạo đơn) thật (`POST /api/UserApprovalScope` — API đã có). Nhớ: từ 2026-07-16, chỉ gán được `ApprovalLevel=Submitter` cho `UserName` đã có Role `Trưởng nhóm` từ trước.

### Gom Role về 1 Role duy nhất (`Quản lý tăng ca`) — 2026-08-05

Chốt theo yêu cầu người dùng: cắt gốc việc Identity phình Role mỗi khi Attendance mọc thêm cấp duyệt
mới (điển hình `AddGroupHeadRole` — thêm đúng 1 cấp duyệt mà phải sinh 1 Role mới ở Identity). Kế
hoạch chi tiết + lý do từng quyết định: `~/.claude/plans/attendance-single-role-permission-refactor.md`.

- **Migration Identity mới `AddQuanLyTangCaRole`**: seed **đúng 1 Role `Quản lý tăng ca`**, **KHÔNG
  gán permission nào kèm theo** (khác hẳn `AddGroupHeadRole`) — Admin tự cấp permission theo từng
  người qua "Quản lý người dùng > Tuỳ chỉnh quyền" (`UserPermissionOverride`, UI có sẵn:
  `UserPermissionOverrideManager.tsx`). **Giữ nguyên 32 permission `Attendance.*` hiện có** — refactor
  này KHÔNG đụng vào permission, chỉ gom Role.
- **Cập nhật 2026-08-05 (migration `RemoveLegacyOtRoles`, đã chạy lên DB thật)**: 5 Role legacy
  (`Trưởng nhóm`/`Trưởng Bộ phận`/`Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc`) **đã bị xoá hẳn**
  khỏi Identity — ban đầu định giữ lại làm nhãn legacy nhưng người dùng yêu cầu dọn luôn. Trước khi
  xoá, đã migrate an toàn 4 user thật đang giữ các Role này (`m.khoi80419`, `t.nhung50`,
  `tuan.system.da`, `v.vinh72266`, verify qua SQL read-only trước khi làm): gán `Quản lý tăng ca` +
  cấp lại đúng bộ permission Role cũ của họ qua `UserPermissionOverride` — permission hiệu lực của cả
  4 người **không đổi**, đã verify lại bằng SQL sau khi chạy migration. Không còn Role nào đại diện
  cho 1 cấp duyệt cụ thể trong Identity nữa — Identity giờ chỉ có `Basic/Admin/Quản lý Hợp Đồng/Quản
  lý Thiết bị/Nhân viên/Quản lý tăng ca`.
- **Gỡ hardcode tên Role** — `RequiredRoleByApprovalLevel` ở `UserApprovalScopeService.cs` (map
  `ApprovalLevel` → tên Role tiếng Việt, chặn Admin gán scope sai người) đã đổi thành
  `RequiredPermissionByApprovalLevel` (check qua `IUserDirectoryService.UserHasPermissionAsync`, tính
  cả `UserPermissionOverride`): Submitter cần `Attendance.OTForm.Create`; GroupHead/DepartmentManager/
  WorkshopManager/**GeneralDirector** (mới, xem dưới) cần `Attendance.OTForm.Approve`.
- **`ScopeType` thêm `All = 2`** (`Attendance.Domain/Enums/ScopeType.cs`) — dành cho
  `ApprovalLevel.GeneralDirector`. TGĐ nay có **1 dòng `UserApprovalScope(ScopeType=All, ScopeId=0,
  ApprovalLevel=GeneralDirector)`** thay vì bypass `User.IsInRole("Tổng Giám Đốc")` như trước — mọi
  chỗ so khớp scope (`OtFormService`: `LoadFormAndValidateAuthorityAsync`, `RemoveEmployeeCoreAsync`,
  `ResolveEligibleApproverUserNamesAsync`, `GetPendingApprovalsAsync`) đã thêm nhánh
  `|| ScopeType.All` để khớp vô điều kiện.
- **`IUserDirectoryService`**: xoá `IsUserInRoleAsync`/`GetUserNamesInRoleAsync` (không còn nơi nào
  cần tra theo tên Role), thêm `UserHasPermissionAsync(userName, permissionCode)`.
- **⚠ Vận hành sau khi deploy migration này — bắt buộc làm ngay, không thì TGĐ không duyệt được gì**:
  vào khu OT → "Phân quyền duyệt" → chọn Cấp duyệt "Tổng Giám Đốc" (phạm vi tự động "Toàn công ty",
  không cần chọn Group/Department) → gán cho (các) UserName đang là TGĐ thật. Trước đây việc này làm
  qua gán Role ở trang Admin; từ nay phải làm ở khu OT như mọi cấp khác.
- FE: `UserApprovalScopeManager.tsx` thêm lựa chọn "Tổng Giám Đốc"/"Toàn công ty"; bỏ hẳn cảnh báo
  "chưa giữ Role X" (không còn tra được theo Role nữa, BE chặn bằng permission ở tầng Service).
  `OtFormTabsPage.tsx`: tab "Chờ tôi ký duyệt" trước đây ẩn cho ai không giữ Role `Trưởng nhóm`, nay
  hiện cho mọi người có `Attendance.OTForm.Create` (không còn cách nào tra "là Trưởng nhóm" từ FE).

### §Báo cáo dưới chuyền theo ngày (2026-08-28)

2 báo cáo cho đơn "dưới chuyền" (`IsProductionForm=true`) đã **Hoàn tất** (`Status=Completed` — qua
đủ mọi cấp duyệt, không chỉ riêng Trưởng phòng), theo yêu cầu người dùng khớp `docs/Note_OT.txt` mục
1 dòng 10 và mục 2 (người dùng đưa 2 file mẫu từ hệ cũ `docs/Data/Reports/22-08.pdf`/`.xlsx` để đối
chiếu cột). Code mới: `MealTicketCalculator.cs` (tách `IsEarlyMealWindowOt`/`CalculateOtHours`/
`CalculateMealTicketType` ra khỏi `OtFormService` để dùng chung — `OtFormService` gọi lại qua
`using static`), `Dtos/Reports/ProductionTicketReportDto.cs`, `ProductionOtReportService.cs`,
`ProductionOtReportController.cs`, permission `Attendance.ProductionOtReport.View` (migration
`AddProductionOtReportPermission`, gán theo Role đang giữ `Attendance.Employee.Create`, cùng cách
`AddProductionEmployeeImportPermissions`). FE: `modules/attendance/components/reports/
ProductionOtReportPanel.tsx` (2026-08-28b: đổi từ trang riêng ở sidebar sang tab "Báo cáo" trong
`CategoryManagement.tsx` (`/ot/categories`), theo yêu cầu người dùng gom lại + bỏ hẳn mục "Lũy kế
nhân viên" khỏi sidebar — route `/ot/accumulation`/`AccumulationLookupPage.tsx` vẫn còn, chỉ không
còn link trực tiếp).

**1. `GET /api/ProductionOtReport/ticket-report?date=yyyy-MM-dd`** — "Xuất số lượng phiếu đã sử
dụng" (mục 2 Note_OT.txt). Trả JSON (`ApiResponse<ProductionTicketReportDto>`), FE tự dựng PDF bằng
jsPDF/jspdf-autotable (BE không sinh PDF) — cùng pattern `DeviceListReportPrintDialog.tsx`.
- Gom mọi `OtForm` Completed đúng ngày theo tổ hợp (`CongDoanSnapshot`, `TeamCodeSnapshot`,
  `BlockCodeSnapshot`, `ShiftTeamCodeSnapshot`, `StartTime`, `EndTime` CHÍNH XÁC — không chỉ theo CA,
  vì cùng 1 Line/CA có thể có nhiều dòng khác giờ do người về sớm/vào trễ, khớp đúng cách hệ cũ tách
  dòng trong file mẫu). Nhiều đơn trùng đúng tổ hợp thì **cộng dồn**.
- Phiếu Chính/Phụ/Sữa đọc **THẲNG** từ `ProcessPart.MainTicketCount/SecondaryTicketCount/MilkCount`
  của từng đơn — **KHÔNG** suy luận lại từ `MealTicketType` từng nhân viên (chốt lại với người dùng
  sau khi họ chỉ ra `MilkCount` đã là số liệu thật lưu sẵn per-đơn, tính lại sẽ sai nếu có sửa tay).
- CA (A/B/C/H) suy từ `StartTime`/`EndTime` của đơn theo khung giờ cố định (người dùng chốt
  2026-08-28): H=6-8h, B=10-14h, A=14-18h, C=18-22h — khớp khi `StartTime >= khung.Start && EndTime
  <= khung.End` (không cần trùng khớp tuyệt đối, vì về sớm/vào trễ vẫn thuộc đúng CA gốc). Không khớp
  khung nào → nhãn "Khac" (chưa gặp trong dữ liệu thật, chỉ phòng hờ).
- "Line_ca" hiển thị = `BlockCodeSnapshot + "-" + ShiftTeamCodeSnapshot` — hậu tố G/O/HC là mã
  **Nhóm màu** (`ProductionShiftTeam` Green/Orange/HC), **KHÔNG phải giờ ca** (nhầm lẫn ban đầu đã
  sửa lại sau khi đọc code `ProductionShiftTeam.cs`).
- Verify bằng dữ liệu thật (2026-08-28, đơn #47+#48 cùng ngày 2026-08-29): tổng khớp đúng
  (Phụ=1+1=2, Chính=3+2=5, Sữa=2+0=2), tách đúng 2 dòng theo Line khác nhau (`4S-HC`/`HL-HC`), CA
  suy đúng "A" cho khung 14:00-18:00.

**2. `GET /api/ProductionOtReport/hours-report-excel?date=yyyy-MM-dd`** — "Tổng số giờ tăng ca 1
người trong 1 ngày" (mục 1 dòng 10 Note_OT.txt). Trả file `.xlsx` trực tiếp (`ClosedXML`, không qua
`ApiResponse<T>` — cùng pattern `ProductionEmployeeExportController`).
- **Gộp 1 dòng/người/ngày** (chốt với người dùng — báo cáo "số LƯỢT tăng ca" ở Note_OT.txt mục 1 dòng
  9 là báo cáo khác, **chưa làm**): cộng tổng giờ OT thực tính (`MealTicketCalculator.CalculateOtHours`,
  cùng công thức trừ 30 phút ăn với mọi nơi khác) của mọi lượt trong ngày; Giờ bắt đầu/kết thúc lấy
  sớm nhất/muộn nhất trong ngày; Lý do/Công việc/Block/Nhóm gộp distinct nếu nhiều lượt khác nhau.
- Cột "Lũy kế tháng"/"Lũy kế năm" scope theo **Năm/Tháng của `date` báo cáo** (không phải "hôm nay"
  thực tế như `MonthToDate`/`YearToDate` ở màn danh sách nhân viên) — hợp lý hơn cho báo cáo về 1
  ngày cụ thể trong quá khứ/tương lai; đọc từ `EmployeeAccumulationHistories` (Year=date.Year,
  Month<=date.Month cho Năm, Month=date.Month cho Tháng).
- Verify bằng dữ liệu thật (2026-08-29): 9 nhân viên, tổng giờ đúng công thức trừ 30 phút ăn (VD
  14:00-18:00 có ăn → 3.5h), Lũy kế tháng/năm = tổng giờ (đúng vì đây là lượt OT đầu trong tháng/năm
  của họ).

**Vị trí UI (sửa 2026-08-28b, theo yêu cầu người dùng)**: KHÔNG còn là mục riêng ở sidebar — chuyển
thành tab "Báo cáo" trong `CategoryManagement.tsx` (`/ot/categories`). Cùng đợt, bỏ hẳn mục "Lũy kế
nhân viên" khỏi sidebar (route `/ot/accumulation` vẫn còn, chỉ không còn link trực tiếp).

**Group Leader tự xem được báo cáo (2026-08-28b, theo yêu cầu người dùng)**: đã thêm
`Attendance.ProductionOtReport.View` vào `JobTitlePermissionWhitelist.AllowedCodes` (nhóm "tham gia
quy trình", không phải "quản trị") rồi gán cho Chức vụ **Group Leader** (`JobTitle.Code="GL"`, Id=16
trên DB thật lúc gán) qua `PUT /api/JobTitlePermission/by-job-title/16` — verify lại bằng SQL:
2 nhân viên thật đang giữ Chức vụ này (`m.cuong.da.pcd.it`, `TEST\gl_shido`) đã có
`UserPermissions.IsAutoGranted=1` cho permission này ngay sau khi gọi API (không cần đăng nhập lại).
- Vì tab "Báo cáo" nằm chung trang với các tab quản trị khác (Department/Group/Reason/OtCase/JobTitle/
  ApprovalStep/Employee/Settings — vốn chỉ Admin/Người phụ trách Cây duyệt được vào; tab
  JobTitlePermission RIÊNG đã bỏ từ 2026-09-03d, gộp vào modal Sửa chức vụ, xem bên dưới),
  `CategoryManagement.tsx` phải tự lọc tab hiển thị theo permission: ai chỉ có
  `ProductionOtReport.View` (không có `Department.Create`/`*ApprovalStep.Update`) vào "Danh mục" vẫn
  chỉ thấy đúng 1 tab "Báo cáo", không lộ UI CRUD của các tab kia. Sidebar mục "otCategories" cũng thêm
  `ProductionOtReport.View` vào danh sách OR-permission để Group Leader thấy được mục "Danh mục".
- Muốn gán quyền này cho Chức vụ khác (VD Team Leader) hoặc gỡ khỏi Group Leader: vào "Danh mục" →
  tab "Chức vụ" → bấm "Sửa" đúng Chức vụ đó, phần "Quyền tự động cấp theo Chức vụ này" ngay trong
  modal (2026-09-03d) — không cần sửa code.

**Format xuất chưa giống file mẫu — đã sửa (2026-08-28c, theo phản hồi người dùng)**:
- PDF thiếu hẳn khối bảng tổng hợp đầu trang so với `22-08.pdf` — đã thêm lại (`buildPivotRows` trong
  `ProductionOtReportPanel.tsx`, tự gộp từ `report.rows` đã có, không cần BE trả thêm dữ liệu): nhóm
  theo CA (thứ tự cố định A→B→C→H, không phải alphabet) rồi tới CA_Dãy bên trong, có dòng tổng mỗi CA
  (tô đậm/nền xám) và dòng "TỔNG" cuối cùng (tô hồng). Có 1 điểm khác biệt CÓ CHỦ ĐÍCH so với mẫu: bỏ
  cột "giờ" ở từng dòng CA_Dãy (mẫu gốc chỉ hiện 1 giờ dù 1 CA_Dãy có thể gồm nhiều Line với giờ khác
  nhau do người về sớm/vào trễ — hiện 1 giờ sẽ sai/gây hiểu lầm, xem đủ giờ ở bảng chi tiết bên dưới).
- Excel đổi tên cột về đúng chữ trong `22-08.xlsx` (`MNV/BOPHAN/HO/TEN/Ngay_TC/Gio_BD/Gio_KT/Lydo/
  CONGVIEC/OT_Thang/OT_Nam/BLOCK/NHOM`) thay vì tên tiếng Việt tự đặt trước đó — không đổi Ý NGHĨA dữ
  liệu (vẫn gộp 1 dòng/người/ngày như đã chốt), chỉ đổi CHỮ hiển thị cho quen mắt.

**Đợt sửa tiếp theo (2026-08-28d, người dùng gửi lại ảnh chụp file mẫu)** — bản trên vẫn thiếu khung
viền + màu sắc giống bản gốc, đã làm lại `buildTicketReportPdf`/`buildPivotRows` trong
`ProductionOtReportPanel.tsx` cho khớp ảnh chụp:
- Khung viền cyan (`doc.rect`, màu `[77,208,225]`) bao quanh tiêu đề + bảng tổng hợp, độ rộng khung tự
  co theo độ dài tiêu đề (`doc.getTextWidth`) để không bị cắt chữ khi tên ngày dài.
- Bảng tổng hợp thêm lại cột "giờ đại diện" mỗi dòng CA_Dãy (bỏ ở đợt trước, người dùng muốn giữ đúng
  bản gốc) — lấy `StartTime` của dòng chi tiết ĐẦU TIÊN trong nhóm (`teamRows[0]`), chấp nhận không
  hoàn toàn chính xác nếu 1 CA_Dãy gồm nhiều Line lệch giờ nhau (hiếm, xem đủ giờ ở bảng chi tiết).
- Dòng đầu bảng tổng hợp lặp lại 3 số tổng cộng (đỏ đậm) làm "tiêu đề số" — giữ đúng quirk hiển thị
  gốc thay vì đổi thành chữ "Phiếu Phụ/Chính/Sữa".
  Màu: nhóm CA tím đậm `[106,27,154]`, dòng CA_Dãy xanh lá `[46,125,50]` + nền xám nhạt
  `[241,245,249]`, tiêu đề+TỔNG đỏ `[211,47,47]`, tiêu đề trang xanh dương đậm `[21,67,96]`.
- "TỔNG :" tách RIÊNG ra ngoài khung (dưới khung, không phải dòng cuối trong bảng) — đúng vị trí bản
  gốc.
- Bảng chi tiết bên dưới cũng đổi qua `theme: "grid"` viền cyan + header chữ xanh dương, khớp phong
  cách viền ô của ảnh chụp.
- Verify bằng script Node độc lập (`jsPDF`/`jspdf-autotable` chạy trực tiếp trong `node`, dựng PDF từ
  dữ liệu mẫu rồi đọc lại bằng công cụ đọc PDF) trước khi báo xong — không chỉ tin code review, đã
  thấy đúng bố cục khung/màu/cột trước khi coi là hoàn tất.

**Đợt sửa cuối cùng khớp bản gốc (2026-08-29, đọc trực tiếp `docs/Data/Reports/22-08.pdf` thay vì ảnh
chụp)** — 2 lỗi màu/khổ giấy do đọc nhầm ảnh mờ ở đợt trước:
- **Khổ giấy: A4 DỌC** (`orientation: "portrait"`), không phải ngang như đợt trước.
- Màu đúng bản gốc: nhóm CA **tím** `[106,61,154]` (giữ nguyên); dòng CA_Dãy — nhãn/giờ/cột "Phiếu
  Phụ" chữ **đen** `[0,0,0]` trên nền xám nhạt `[242,242,242]`, riêng 2 cột **"Chính"/"Sữa" chữ xanh
  lá** `[46,125,50]` (quirk màu của file mẫu, không phải lỗi — chỉ 2/3 cột số ở dòng leaf tô xanh);
  tiêu đề trang + header bảng chi tiết đổi từ xanh navy sang **xanh lam đậm** `[26,115,140]`.
- Thêm chân trang lặp lại mọi trang: ngày giờ in (trái) + "Page X of Y" (phải) — dùng
  `doc.getNumberOfPages()`/`doc.setPage(i)`, khớp bản gốc tự ngắt trang khi nhiều dòng (file mẫu thật
  ra tới `Page 1 of 3`).
- Verify: render script Node với 120 dòng giả (ép ngắt 6 trang, kiểm chân trang lặp đúng mỗi trang) +
  đối chiếu trực tiếp ảnh render với `22-08.pdf` gốc (không phải ảnh chụp lại).

### §Excel "Tổng số giờ tăng ca" — mở rộng đủ 23 cột + lọc theo Phòng ban (2026-08-29)

Người dùng gửi ảnh chụp bản Excel gốc đầy đủ hơn (23 cột, không phải 13 cột đã làm ở đợt trước) và yêu
cầu thêm bộ lọc Phòng ban ("chọn chuyền ở phòng ban nào"). Cột mới bổ sung vào `ExportHoursReportAsync`
(`ProductionOtReportService.cs`), tất cả vẫn theo đúng quy tắc **gộp 1 dòng/người/ngày** đã chốt —
field nào ở cấp ĐƠN (không phải cấp nhân viên) mà 1 người có thể có nhiều đơn khác nhau trong ngày thì
gộp `string.Join("; ", ...Distinct())` giống `Block`/`ShiftTeam` đã làm trước đó:

| Cột | Nguồn dữ liệu |
|---|---|
| `LYDO_JP` | `Reason.ReasonNameJp` |
| `Lydo_phu` | `OtForm.SubReason` (tách riêng khỏi `Lydo`, KHÔNG còn gộp chung như bản 13 cột cũ) |
| `An` | `OtFormEmployee.DidEat` — gộp `g.Any(x => x.DidEat)` nếu nhiều lượt/ngày |
| `NOTE` | `OtFormEmployee.NoteVn` |
| `Gio_Hienta` | Giờ OT thực tính CỦA NGÀY ĐÓ — cùng giá trị `TotalHours` đang cộng vào lũy kế (đặt
  cạnh `OT_Thang`/`OT_Nam` theo mạch ngày→tháng→năm), người dùng xác nhận 2026-08-29 |
| `Line_Muon` | `BlockCodeSnapshot + "-" + ShiftTeamCodeSnapshot` (đúng công thức `LineCa` dùng ở PDF) |
| `MNV_LC` | Mã nhân viên người **lập** đơn — tra `OtForm.CreatedByUserName` → `Employee.Code` qua
  `Employee.UserName` |
| `MNV_SC` | Mã nhân viên **sửa gần nhất** đúng dòng nhân viên đó trong đúng đơn đó — tra bảng
  `OtFormEditLog` (lấy `ActionAt` mới nhất khớp `(OtFormId, EmployeeId)`, resolve `ActionByUserName` →
  `Employee.Code`), người dùng xác nhận "Đồng ý" 2026-08-29 |
| `BP` | `OtForm.Department.DepartmentCode` |
| `Ngay_lap` | `OtForm.CreatedAt` (sớm nhất nếu nhiều đơn/ngày), format `dd-MMM-yy` (`InvariantCulture`
  để luôn ra tháng viết tắt tiếng Anh khớp mẫu, không phụ thuộc locale server) |

**Lưu ý quan trọng đã verify bằng dữ liệu thật (2026-08-29, đơn #46-57, DepartmentId=7)**: người dùng
kỳ vọng cột `BP` ra chữ **"SX"** cho đơn của "Chế tạo" (dựa theo file mẫu cũ), nhưng
`Department.DepartmentCode` thật của "Chế tạo" trong hệ thống là **`"CT"`**, không phải `"SX"` — không
có Phòng ban nào tên mã `"SX"` trong bảng `Departments` hiện tại (8 Phòng ban:
MN/TV/QLCL/KT/CV/CT/CBSX/QL). Export hiện ra đúng `"CT"` cho đơn của Chế tạo (đã verify qua file thật
tải về, đọc `sheet1.xml`) — đây là lựa chọn có chủ đích (đọc thẳng mã Phòng ban thật, tự đổi đúng khi
dùng bộ lọc Phòng ban mới, không hardcode `"SX"`) vì `"SX"` là nhãn hệ CŨ không map 1-1 với mã hệ mới.
Người dùng xác nhận 2026-08-29 **giữ nguyên `"CT"`** (không dịch riêng về `"SX"`) — chốt, không cần
thêm bước map nhãn hiển thị.

**Bộ lọc Phòng ban** (đơn "dưới chuyền" có thể tạo dưới BẤT KỲ Phòng ban nào —
`OtFormService.CreateProductionFormAsync` nhận `request.DepartmentId` tự do, không khoá cứng về "Chế
tạo"): cả 2 endpoint (`GET ticket-report`, `GET hours-report-excel`) thêm query param `departmentId`
(`int?`, null = không lọc, giữ hành vi cũ). FE (`ProductionOtReportPanel.tsx`) thêm dropdown "Phòng ban
(chuyền)" bên cạnh ô chọn ngày, tải danh sách qua `DepartmentApi.getAllDepartments()` (đã có sẵn, dùng
lại nguyên `useFetchEffect`), mặc định "Tất cả".

Verify: build BE sạch; smoke test + gọi tay `ticket-report`/`hours-report-excel` với `departmentId=7`
(khớp 2 dòng đúng dữ liệu thật) và `departmentId=3` (Tổng vụ, không có đơn dưới chuyền → 0 dòng, không
lỗi); tải file `.xlsx` thật, giải nén đọc `sheet1.xml`/`sharedStrings.xml` xác nhận đủ 23 cột đúng thứ
tự, `MNV_SC` có giá trị ở dòng có sửa đơn thật và trống ở dòng chưa sửa, `Line_Muon`/`BP`/`Ngay_lap`
đúng công thức. FE `npx tsc --noEmit` + `pnpm lint` sạch (còn 2 cảnh báo/lỗi cũ không liên quan ở
`CreateOtFormPage.tsx`/`OtFormPrintView.tsx`, đã có từ trước).

### §Excel "Số LƯỢT tăng ca 1 người/1 ngày" — báo cáo thứ 3 (2026-08-29)

Note_OT.txt mục 1 dòng 9 — **khác hẳn** báo cáo "tổng giờ" (§Excel ở trên): report đó CỐ Ý gộp 1 dòng/
người/ngày; report này ngược lại, **KHÔNG gộp** — người dùng gửi file mẫu
`docs/Data/Reports/Qry_So_lan_tang_Ca_trong_ngay_sx_2026-08-1_CV.xlsx` (chỉ có dòng tiêu đề, không có
dữ liệu mẫu, nên chốt cấu trúc qua trao đổi trực tiếp + ví dụ cụ thể) xác nhận: **mỗi dòng = 1 lượt**
(1 `OtFormEmployee`, tức 1 đơn/1 ngày của người đó), không merge lại. 2 cột số (`LAN_TANG_CA_TRONG_
NGAY`, `Gio_Hientai`) là tổng hợp CẢ NGÀY, lặp lại giống nhau trên mọi dòng của người đó trong ngày.

`GET /api/ProductionOtReport/times-report-excel?date=&departmentId=` (`ExportTimesReportAsync` trong
`ProductionOtReportService.cs`, cùng gate permission, cùng pattern trả `.xlsx` trực tiếp). 9 cột đúng
tên trong file mẫu, theo thứ tự:

| Cột | Nguồn dữ liệu |
|---|---|
| `MNV` | `Employee.Code` |
| `BLOCK` | `OtFormEmployee.BlockCodeSnapshot` — của ĐÚNG lượt đó, không gộp |
| `NHOM` | `OtFormEmployee.ShiftTeamCodeSnapshot` — của ĐÚNG lượt đó |
| `NOTE` | `OtFormEmployee.NoteVn` — của ĐÚNG lượt đó |
| `Ngay_TC` | `date` (tham số báo cáo) |
| `LAN_TANG_CA_TRONG_NGAY` | Số `OtFormId` PHÂN BIỆT của người đó trong ngày — tổng hợp cả ngày, lặp
  lại trên mọi dòng |
| `Gio_Hientai` | Tổng giờ OT thực tính CẢ NGÀY (`MealTicketCalculator.CalculateOtHours` cộng dồn) —
  tổng hợp cả ngày, lặp lại trên mọi dòng (CÙNG định nghĩa với `Gio_Hientai` ở báo cáo tổng giờ) |
| `BP` | `OtForm.Department.DepartmentCode` — của ĐÚNG lượt đó (đơn nào tạo dưới Phòng ban nào) |
| `MNV_TP` | **Mới** — mã nhân viên Trưởng Phòng đã **duyệt (Approved)** đúng đơn đó, tra qua
  `OtFormApprovalHistory` join `OtFormApprovalStep` lọc `TerminalLevelSnapshot ==
  JobTitleTerminalLevel.DepartmentManager && Action == Approved`, resolve `ApproverUserName` →
  `Employee.Code` (cùng cơ chế UserName→Code với `MNV_LC`/`MNV_SC`). Người dùng xác nhận 2026-08-29
  "MNV_TP là mã TP đã ký duyệt đơn đó". |

Verify bằng dữ liệu thật (2026-08-29, `departmentId=7`): tải file thật, giải nén đọc `sheet1.xml`/
`sharedStrings.xml` — ra đúng 9 dòng (9 nhân viên, mỗi người đúng 1 lượt hôm đó nên
`LAN_TANG_CA_TRONG_NGAY=1` mọi dòng), `BP="CT"` mọi dòng, `MNV_TP="T-MGR-CT"` mọi dòng (khớp đúng 1
Trưởng phòng duy nhất đã duyệt hết các đơn hôm đó). FE thêm nút "Xuất Excel — Số lượt tăng ca theo
ngày" cạnh 2 nút xuất đã có trong `ProductionOtReportPanel.tsx`, dùng chung ô chọn ngày/Phòng ban.
`npx tsc --noEmit` + `pnpm lint` sạch.

### §3 export mới + phiếu PDF hàng loạt theo Line/Nhóm (2026-09-03c)

Người dùng gửi 6 file thật (`docs/Data/Reports/`, trừ `22-08.pdf`/`22-08.xlsx` — 2 file đó là tham
chiếu khác, không thuộc bộ deliverable hàng ngày) — đúng nguyên văn các file kế toán lương nhận được
mỗi ngày SAU KHI Trưởng phòng ký: 3 Excel + N PDF (N = số Block-Nhóm có OT hôm đó). Phân tích tên file +
đối chiếu dữ liệu thật rồi chốt với người dùng (không tự bịa — CLAUDE.md §2 luật 2):

**Quy tắc đặt tên (áp dụng cho MỌI export mới ở mục này)**:
- Excel: `"{TenQuery}_{yyyy-MM-d}_{MaPhongBan}.xlsx"` — ngày dùng đặc tả `"yyyy-MM-d"` (`d` KHÔNG
  `dd`): tháng có số 0 đầu, NGÀY thì KHÔNG (`2026-08-1`, không phải `2026-08-01`). `MaPhongBan` =
  `Department.DepartmentCode` của `departmentId` dùng lọc report (không lọc thì bỏ hẳn hậu tố).
  Implement ở `ProductionOtReportService.BuildRealFileNameAsync`.
- PDF phiếu: `"{SoLuongNhanVien}-SAN XUAT TANG CA {BLOCK}-{NHOM} ngay {dd-MM-yyyy}.pdf"` — NGƯỢC LẠI
  với Excel, ngày ở đây CÓ số 0 đầu cả tháng lẫn ngày.

**3 export mới** (`ProductionOtReportService.cs`, `ProductionOtReportController.cs`) — người dùng xác
nhận CẢ 3 ĐỘC LẬP với `hours-report-excel` (23 cột) đã có từ trước, KHÔNG thay thế/gộp cột dù cùng kiểu
gộp 1 dòng/người/ngày (giữ nguyên `hours-report-excel`, không đụng):

1. **`GET qry-export-excel?date=&departmentId=`** — "Qry_EXPORT_EXCEL", 17 cột đúng nguyên văn file
   thật: `MNV/BOPHAN/HO/TEN/Ngay_TC/Gio_BD/Gio_KT/Lydo/Lydo_phu/An/BLOCK/NHOM/NOTE/Gio_Thuc_Te/BP/
   QUAN_LY_TC_SX/MNV_TP`. `QUAN_LY_TC_SX` = mã nhân viên đã **duyệt (Approved) ở bước Chức vụ "TL"**
   (Team Leader — người dùng xác nhận "MNV team leader"), tra qua
   `OtFormApprovalStep.JobTitleCodeSnapshot == "TL"` (mirror cách `MNV_TP` đã tra theo
   `TerminalLevelSnapshot=DepartmentManager`) — 2 hàm dùng chung
   `ResolveApprovalCodesByJobTitleCodeAsync`/`ResolveApprovalCodesByTerminalLevelAsync`.
2. **`GET sum-export-data?date=&departmentId=`** — "SUM_EXPORT_DATA", 7 cột tóm tắt
   `MNV/BOPHAN/HO/TEN/Ngay_TC/Gio_thuc_te/BP` — người dùng xác nhận **độc lập mục đích** với
   Qry_EXPORT_EXCEL (không phải bản rút gọn thay thế).
3. `times-report-excel` (đã có, 9 cột đã khớp sẵn "Qry_So_lan_tang_Ca_trong_ngay_sx") — CHỈ sửa lại
   đúng tên file theo quy tắc thật ở trên (trước đó tự đặt `SoLuotTangCa_yyyyMMdd.xlsx`), không đổi cột.

Cả 3 dùng chung 1 hàm nền `BuildGroupedDailyRowsAsync` (gộp 1 dòng/người/ngày, KHÔNG dùng lại
`ExportHoursReportAsync`'s pipeline để tránh đụng logic 23-cột đang chạy ổn định — chấp nhận trùng 1
phần logic).

**Verify bằng dữ liệu thật** (`departmentId=7` Chế tạo, `date=2026-08-29`, đơn #47/#48 đã biết từ trước):
tải cả 3 file qua `curl` + JWT thật, giải nén đọc `sheet1.xml` — đúng 10 dòng/file, đúng thứ tự 17/7
cột, `QUAN_LY_TC_SX="T-TL-SHIDO"` mọi dòng (đúng 1 Team Leader TEST duy nhất đã duyệt), `MNV_TP=
"T-MGR-CT"` mọi dòng (khớp lại đúng giá trị đã verify ở báo cáo Số lượt trước đó) — xác nhận cơ chế
đúng. Tên file test với ngày `2026-08-1` (ngày 1, không phải 29) ra đúng `..._2026-08-1_CT.xlsx` —
khớp quy tắc không số 0 đầu ở phần ngày.

**Phiếu PDF hàng loạt theo Line/Nhóm** (`GET ticket-batch?date=&departmentId=`, trả JSON
`ProductionTicketBatchGroupDto[]` — 1 phần tử/tổ hợp Block-Nhóm có OT Hoàn tất trong ngày, gộp đúng
tổ hợp với `GetTicketReportAsync` nhưng trả DANH SÁCH TỪNG NGƯỜI thay vì chỉ đếm). Đây là phiếu
"Giấy đề nghị làm ngoài giờ" mẫu YEV-22-024 THẬT — KHÁC hẳn PDF pivot tổng hợp `ticket-report` hiện có
(dựng theo mẫu `22-08.pdf`, KHÔNG phải phiếu từng Line):
- BE chỉ trả phần "nền" (danh sách nhân viên gộp + `PrimaryOtFormId` đại diện) — phần chữ ký/lý do/
  ProcessPart FE lấy lại qua `GET /api/OtForm/{PrimaryOtFormId}` đã có sẵn (dùng đúng data
  `OtFormPrintView.tsx` đang dùng để in 1 đơn lẻ), chỉ override `employees`/`numberOfEmployee` bằng
  dữ liệu gộp ở `ticket-batch`.
- FE (`src/modules/attendance/lib/productionTicketBatchPdf.tsx`, mới) — TÁI DÙNG NGUYÊN layout %
  toạ độ đã đo sẵn ở `OtFormPrintView.tsx` (export thêm `PageFrame`/`FormHeaderFields`/
  `EmployeeRowFields`/`buildEmployeePages`/`HEADER_LAYOUTS`/`A4_PAGE1_EMPLOYEE`/`A4_PAGE2_EMPLOYEE` —
  chỉ thêm từ khoá `export`, KHÔNG đổi logic bên trong) thay vì vẽ lại bằng jsPDF thô: render off-screen
  từng trang (`createRoot` vào 1 `<div>` đặt ngoài màn hình), chụp qua `html2canvas` (2x scale), nhúng
  ảnh chụp vào `jsPDF` (khổ Letter 612x792pt, khớp đúng khổ giấy thật của mẫu) — mỗi tổ hợp 1 file PDF
  riêng, gộp tất cả vào 1 file `.zip` (`jszip`, **thư viện MỚI thêm vào FE**, chưa dùng ở đâu khác)
  rồi tải về 1 lần. Luôn khổ A4 (không tự chọn A5 như bản in đơn lẻ — khớp khổ giấy thật của 3 file mẫu
  đã đọc).
- Chỉ tính đơn **Hoàn tất (Completed)** — người dùng xác nhận "vẫn sẽ xuất ra được nhưng chỉ những đơn
  mà đã hoàn tất tức được kí duyệt đã không còn bước tiếp theo nữa" — cùng bộ lọc `Status=Completed`
  đã dùng cho mọi report khác trong màn này, không cần logic mới.
- Nút "Xuất phiếu theo Line/Nhóm (zip)" trong `ProductionOtReportPanel.tsx`, hiện tiến độ
  "Đang xuất X/Y..." (mỗi tổ hợp xử lý tuần tự, không song song — tránh quá tải trình duyệt khi nhiều
  tổ hợp/nhiều trang).
- **Verify**: BE `ticket-batch` gọi tay qua JWT thật (`departmentId=7`, `date=2026-08-29`) ra đúng 2
  nhóm (`4S-HC` 5 người, `HL-HC` 4 người — khớp đúng dữ liệu đơn #47/#48 đã biết từ trước). Build BE +
  `npx tsc --noEmit`/`pnpm lint` FE sạch, trang "Báo cáo" (`/ot/categories`) tải lại được sau khi
  Turbopack hot-reload (không lỗi compile). **CHƯA bấm thử nút xuất zip thật trên trình duyệt** — đây
  là kỹ thuật MỚI trong dự án (`html2canvas` lần đầu thực sự được dùng, dù đã khai báo sẵn trong
  `package.json` từ trước) nên rủi ro cao nhất nằm ở bước render off-screen + chụp canvas, không thể
  verify qua API call thuần — cần người dùng tự bấm thử trong trình duyệt (nút "Xuất phiếu theo
  Line/Nhóm (zip)" trong tab Báo cáo) và mở thử vài file PDF trong zip trước khi coi là ổn định.

### §Phiếu PDF hàng loạt theo Line/Nhóm — trạng thái chốt (2026-09-03e→h)

> Gộp từ 4 lượt sửa liên tiếp (tràn chữ → sai dữ liệu → chữ đè viền → viết lại bằng jsPDF).
> **Tính năng "Xuất phiếu theo Line/Nhóm (zip)" đã HOÀN TẤT, người dùng xác nhận ổn.**

**Cách vẽ (bắt buộc giữ):** `productionTicketBatchPdf.tsx` **tự vẽ thẳng lên `jsPDF`**, KHÔNG render
React off-screen, KHÔNG `html2canvas`. `doc.addImage()` cho ảnh nền (`/ot-form/a4-page1.png`,
`a4-page2.png`), `doc.text()` cho chữ, `doc.line()` vẽ tay dấu ✓ (font Roboto nhúng không chắc có glyph
Dingbats). Toạ độ % + business logic **tái dùng** từ `OtFormPrintView.tsx` (đã export sẵn:
`formatDate/formatTime/formatDateTime/findHistory/findStepByTerminalLevel/getGivenName/`
`getProductionCongDoanLabel/columnBox` + hằng `REASON_*`, `HEADER_LAYOUTS`, `A4_PAGE1_EMPLOYEE`,
`A4_PAGE2_EMPLOYEE`) — **đừng chép lại logic**, chỉ đổi cách "vẽ ra". Font tiếng Việt: nhúng Roboto qua
VFS bằng `registerVietnameseFont` + base64 ở `modules/pc-management/lib/pdf-fonts.ts` (mỗi nơi tự giữ
bản nhỏ — convention hiện có, đừng gom helper chung). Đo chữ bằng chính `doc.getTextWidth` /
`doc.splitTextToSize` (cùng engine đo và vẽ → hết lệch tỷ lệ). Ảnh chữ ký: `Image().decode()` lấy
`naturalWidth/naturalHeight` thật trước khi `addImage` (tương đương `object-contain`).

**Dữ liệu (bắt buộc giữ):** `ProductionOtReportService.GetTicketBatchAsync` phải lấy đúng **snapshot đã
đóng băng trên `OtFormEmployee`**, y hệt `OtFormService.GetOtFormByIdAsync` của bản in đơn lẻ:
- Projection có `StartTime`, `MonthToDate`, `YearToDate` + 5 field snapshot (`CongDoanSnapshot`,
  `TaskNameSnapshot`, `BlockCodeSnapshot`, `TeamCodeSnapshot`, `ShiftTeamCodeSnapshot`) — thiếu thì ô
  "Tên công đoạn" trống trơn (`getProductionCongDoanLabel` không có gì để ghép).
- Lũy kế đọc thẳng cột `OtFormEmployee.MonthToDate/YearToDate`, **KHÔNG** tính lại từ
  `EmployeeAccumulationHistories` (ledger sống ≠ số đã ký trên giấy — xem `OtFormEmployee.cs` dòng 29-34).
- Thứ tự nhân viên `.OrderBy(eg => eg.Key)` (EmployeeId, thứ tự tự nhiên) — **KHÔNG** sắp lại theo
  `EmployeeCode` (bản in đơn lẻ không sắp gì cả).

**Bài học `html2canvas` — đừng quay lại:** đã vá 3 lần vẫn hỏng, vì thư viện hỗ trợ CSS không đầy đủ ở
`overflow:hidden`+`nowrap`, `flex align-items:center`, `display:table-cell`, và `aspect-ratio` (lệch tỷ
lệ tích luỹ theo chiều dọc — càng xuống cuối trang càng lệch). Xem `CLAUDE.md §4.8`.

**Phần vẫn dùng cho bản in đơn lẻ:** `AutoFitLine` + hook `useAutoFitLineWidth` (đo `scrollWidth`/
`clientWidth` thật rồi thu nhỏ cỡ chữ, sàn 55%; canh giữa dọc bằng `line-height` = chiều cao thật của ô,
không dùng flex/table) và `ReasonAutoFit` — thay cho `nowrapBoxStyle` cũ, áp cho mọi ô 1 dòng trong
`FormHeaderFields`/`EmployeeRowFields` và `SignatureNameLine`. Giữ nguyên: đây là đường in qua
`window.print()` của trình duyệt.

### §Gộp tab "Quyền theo Chức vụ" vào modal Sửa chức vụ (2026-09-03d)

Theo yêu cầu người dùng ("tích hợp nó vào chỗ chức vụ luôn"): bỏ hẳn tab riêng "Quyền theo Chức vụ"
(vốn phải chọn lại đúng Chức vụ 1 lần nữa từ dropdown, tách rời khỏi tab "Chức vụ") — chuyển thẳng
thành 1 section BÊN TRONG modal Sửa chức vụ (`JobTitleForm.tsx`, chỉ hiện khi `mode="edit"`, vì phần
quyền cần Id của Chức vụ đã tồn tại).

- **`JobTitlePermissionSection.tsx`** (mới, `components/job-titles/`) — rút gọn từ
  `JobTitlePermissionManager.tsx` cũ (đã XOÁ): bỏ phần chọn Chức vụ (nhận thẳng `jobTitleId` từ
  `JobTitleForm`), giữ nguyên 100% nguồn dữ liệu/logic tick-lưu (`GET .../allowed-codes`,
  `GET .../by-job-title/{id}`, `PUT .../by-job-title/{id}`). Có nút "Lưu" RIÊNG, độc lập với nút Lưu
  của phần thông tin cơ bản (Code/Tên/Cấp duyệt cuối) phía trên — 2 API khác nhau, không gộp chung 1
  lần submit.
- `JobTitleForm.tsx` nới rộng modal (`max-w-lg` khi edit, `max-w-md` khi create) + thêm scroll
  (`max-h-[85vh] overflow-y-auto`) để chứa vừa cả 2 phần.
- `CategoryManagement.tsx`: bỏ hẳn tab `job-title-permissions` (key, ref, loading handler, khối mount) —
  còn lại các tab quản trị khác giữ nguyên vị trí.
- Đổi `useEffect` gọi trực tiếp `Promise.all().then()` (bản `JobTitlePermissionManager.tsx` cũ) sang
  **`useFetchEffect`** khi viết lại — bản cũ set `setIsLoading(true)` NGAY ĐẦU effect (đồng bộ) từng
  lọt qua vì chưa từng bật React Compiler lint kiểm tra file này, nhưng khi viết file MỚI thì
  `react-hooks/set-state-in-effect` chặn ngay (đúng luật CLAUDE.md §4.3 "Fetch dữ liệu — luôn dùng
  useFetchEffect") — sửa bằng cách gộp cả 3 nguồn dữ liệu (`allowed-codes`/`PermissionApi.getAll`/
  `by-job-title`) vào 1 `Promise.all` làm fetcher duy nhất truyền cho hook.
- **Verify**: `npx tsc --noEmit` + `pnpm lint` sạch (2 cảnh báo/lỗi cũ ở `CreateOtFormPage.tsx`/
  `OtFormPrintView.tsx` không liên quan, có từ trước). Chưa test sống thao tác tick/lưu quyền trong
  modal mới trên trình duyệt (chỉ đổi UI, không đổi API/logic quyền nào — rủi ro thấp, nhưng cần bấm
  thử 1 lần trước khi coi ổn định).

### §Phân quyền theo Phòng ban — mở rộng vai trò Coordinator (2026-08-29)

Người dùng muốn "người phụ trách 1 Phòng ban" tự làm được, KHÔNG cần Admin: cập nhật nhân sự dưới
chuyền, cập nhật lũy kế, sửa giới hạn OT/tháng/năm riêng từng người — TẤT CẢ chỉ giới hạn trong ĐÚNG
Phòng ban họ phụ trách (không phải toàn công ty). Đã có sẵn "cây duyệt" dùng cơ chế tương tự — TÁI SỬ
DỤNG nguyên khái niệm `DepartmentApprovalStepCoordinator` (Admin gán tay qua UI "Cây duyệt", KHÔNG
suy luận theo Chức vụ) thay vì phát minh khái niệm mới hay dùng `JobTitlePermissionWhitelist` (whitelist
đó cố tình loại trừ permission "quản trị" để tránh 1 người tự leo thang quyền qua đổi Chức vụ).

- **`IDepartmentAccessGuard`** (`Attendance.Application/Interfaces/Service/IDepartmentAccessGuard.cs` +
  `DepartmentAccessGuardService.cs`) — trích ra từ logic riêng lẻ trước đó của
  `DepartmentApprovalStepService.EnsureCanManageDepartmentAsync`, dùng CHUNG cho mọi tính năng scope
  theo Phòng ban: `EnsureCanManageDepartmentAsync(userName, isAdmin, departmentId)` (Admin bỏ qua, else
  bắt buộc có dòng Coordinator đúng Phòng ban) + `GetManagedDepartmentIdsAsync(userName)` (dùng khi cần
  scope THEO TỪNG DÒNG dữ liệu tự do, không hardcode 1 Phòng ban).
- **Tự động cấp quyền cho Coordinator** — mở rộng `ApprovalStepCoordinatorPermissions` (đã có sẵn cơ
  chế `SyncAutoGrantedPermissionsCoreAsync` cấp `DepartmentApprovalStep.Update` cho Coordinator từ
  trước) thêm 3 permission mới, TẤT CẢ tự cấp NGAY khi Admin gán ai đó làm Coordinator của 1 Phòng ban
  (không cần bước gán Role riêng): `Attendance.ProductionEmployee.Import`,
  `Attendance.EmployeeAccumulation.Import`, `Attendance.Employee.UpdateOtLimit` (mới, xem dưới) — hiệu
  lực ngay, không cần đăng nhập lại (cùng cơ chế `SyncAutoGrantedPermissionsAsync` đã có).
- **`ProductionEmployeeImportService.PreviewAsync`/`ConfirmAsync`** — thêm `(userName, isAdmin)`, check
  1 LẦN cho cả file qua `EnsureManufacturingDepartmentAccessAsync` (đích đã hardcode cứng vào Phòng ban
  "CT" — `ManufacturingDepartmentCode`, nên không cần scope theo dòng).
- **`ApplyAccumulationAsync`** — khác ở trên (nhận `EmployeeCode` TỰ DO từ Excel, không hardcode 1
  Phòng ban): scope THEO TỪNG DÒNG — lấy trước `GetManagedDepartmentIdsAsync`, mỗi dòng resolve Phòng
  ban thật của nhân viên đó (`employee.DepartmentId ?? employee.Group.DepartmentId`, projection
  `int?` an toàn — KHÔNG dùng `x.Group!.DepartmentId` trực tiếp, dễ vỡ khi Group null), dòng ngoài phạm
  vi bị skip với lý do "Nhân viên không thuộc Phòng ban bạn phụ trách." (không throw huỷ cả file).
- **`Attendance.Employee.UpdateOtLimit`** (permission MỚI, migration `AddEmployeeUpdateOtLimitPermission`
  — Identity DB, gán thêm cho Role đang giữ `Attendance.Employee.Update`) — tách RIÊNG khỏi
  `Attendance.Employee.Update` (permission đó còn cho sửa Code/Tên/Group/... của MỌI nhân viên, quá
  rộng để cấp cho người phụ trách 1 Phòng ban). Endpoint mới `PUT /api/Employee/{id}/ot-limit`
  (`EmployeeService.UpdateOtLimitAsync`) — CHỈ set `CustomMonthlyOtHourLimit`/`CustomYearlyOtHourLimit`,
  scope qua `IDepartmentAccessGuard` (resolve Phòng ban nhân viên đó rồi check). `UpdateEmployeeDto`/
  `EmployeeService.UpdateAsync` (PUT /{id} chung) KHÔNG còn đụng 2 field này nữa (cố ý — tránh
  wipe về null mỗi khi Admin sửa thông tin cơ bản qua form chung) — đã verify sống: set giá trị test
  qua endpoint mới → gọi PUT /{id} chung với dữ liệu khác không đổi → xác nhận 2 field KHÔNG bị mất →
  khôi phục lại giá trị gốc.
- **`EmployeeImportController.ImportOtHourLimits`/`DownloadOtHourLimitTemplate`** — đổi permission gate
  từ `Attendance.Employee.Update` sang `Attendance.Employee.UpdateOtLimit`;
  `EmployeeImportService.ImportOtHourLimitsAsync` thêm scope THEO TỪNG DÒNG (cùng cách `ApplyAccumulationAsync`
  — `FindAsync` không include navigation nên tra riêng 1 lượt `Group.DepartmentId` cho các dòng
  `DepartmentId=null`).
- **FE**: `EmployeeForm.tsx` bỏ 2 field giới hạn OT khỏi form Sửa nhân viên chung, CHỈ còn hiện lúc Tạo
  mới; sửa sau này đi qua dialog mới `EmployeeOtLimitDialog.tsx` (gọi `PUT /{id}/ot-limit`), nút mở
  dialog + nút Sửa/Xoá nhân viên + các mục trong menu Excel (Import/Xuất nhân sự dưới chuyền, Import
  giới hạn OT) đều gate RIÊNG theo đúng permission tương ứng trong `EmployeeList.tsx` (không còn dùng
  chung 1 điều kiện hiển thị) — người chỉ có 1-2 trong các quyền trên sẽ chỉ thấy đúng hành động họ
  được phép.
- **KHÔNG cần sửa `CategoryManagement.tsx`/`OtManagerSidebar.tsx`** — cả 2 nơi đã gate tab "Nhân viên"/
  mục sidebar "Danh mục" theo `hasAnyPermission([...,"Attendance.DepartmentApprovalStep.Update",...])`
  từ trước; vì Coordinator ĐÃ được tự động cấp permission đó, họ tự động thấy được tab/mục nav này mà
  không cần sửa gì thêm — kiểm tra kỹ trước khi định thêm điều kiện mới, tránh trùng lặp không cần thiết.
- **Giới hạn đã biết của lượt verify này**: `windows-login` chỉ đăng nhập được bằng Windows Negotiate
  của user hiện tại (không có cách lấy JWT cho 1 tài khoản khác để giả lập không phải Admin) — nên
  CHƯA test sống được đường non-Admin bị chặn đúng khi thao tác ngoài phạm vi Phòng ban của họ
  (chỉ verify được: Admin vẫn hoạt động bình thường qua mọi endpoint đã sửa, và logic scope đã review
  kỹ qua code). Nên test tay qua UI thật với 1 tài khoản Coordinator thật trước khi coi là ổn định.

### §Vá lỗ hổng: `Employee.View` theo Chức vụ trả nguyên danh sách TOÀN CÔNG TY (2026-09-03)

Rà soát lại phân quyền Attendance theo yêu cầu người dùng, phát hiện `Attendance.Employee.View`
(permission nằm trong `JobTitlePermissionWhitelist` — tức MỌI nhân viên từ Staff trở lên đều có) gate
2 endpoint trả **nguyên danh sách nhân viên cả công ty**, không hề scope theo Phòng ban/Nhóm của người
gọi: `GET /api/Employee/grid-list` (`departmentId`/`groupId` chỉ là filter TUỲ CHỌN, không enforce) và
`GET /api/Employee/all`. `EmployeeDto` trả cả `MonthToDate`/`YearToDate` (lũy kế giờ OT thật) và
`CustomMonthlyOtHourLimit`/`CustomYearlyOtHourLimit` — dữ liệu nhạy cảm hơn nhiều so với danh mục
Department/Group thuần tuý, nên 1 nhân viên Staff bất kỳ trước đây xem được lũy kế/giới hạn OT của
TOÀN BỘ nhân viên công ty, không riêng gì phòng ban mình. (Đối chiếu: `Attendance.OTForm.Approve` cũng
cấp toàn công ty qua Chức vụ nhưng AN TOÀN vì `OtFormService.ApproveAsync` còn 1 lớp kiểm tra riêng qua
`LoadFormAndCurrentStepAsync` — phải đúng người trong danh sách candidate của bước duyệt mới approve
được; 2 endpoint Employee ở trên KHÔNG có lớp kiểm tra tương đương.)

- **Đã có sẵn logic phạm vi đúng ý** ở `EmployeeService.GetInScopeAsync` (dùng cho `GET /in-my-scope`,
  Giai đoạn 8) — suy theo ĐÚNG vị trí Cây chức vụ của người gọi (Admin: không giới hạn; Trưởng
  Xưởng/Giám đốc: toàn công ty; có `DepartmentId` (Manager): theo Phòng ban; còn lại: theo `GroupId`).
  Trích logic này ra 2 helper dùng chung trong `EmployeeService`: `ResolveCallerScopeAsync(callerUserName)`
  (trả `EmployeeScope { CompanyWide, DepartmentId, GroupId }`, throw `DomainException` nếu người gọi
  chưa liên kết Employee hoặc chưa gán Nhóm/Bộ phận) + `ApplyScope(query, scope)` (áp lên
  `IQueryable<Employee>`). `GetInScopeAsync` đổi sang gọi qua 2 helper này (hành vi không đổi).
- **`GetPagedAsync`/`GetAllActiveAsync`** — thêm tham số `(callerUserName, isAdmin)`, không phải Admin
  thì áp `ApplyScope` TRƯỚC khi áp filter `departmentId`/`groupId` tuỳ chọn (2 filter đó giờ chỉ còn
  tác dụng thu hẹp THÊM trong đúng phạm vi, không mở rộng ra ngoài được). `EmployeeController.GetPaged`/
  `GetAllActive` truyền `CurrentUserName, User.IsInRole("Admin")` — cùng pattern `GetInMyScope` đã có.
  Không đổi route/param/response shape nên KHÔNG cần sửa gì ở FE (`employee.api.ts`) — chỉ đổi ai xem
  được gì, hoàn toàn phía BE.
- **Không đụng** `GetByDepartmentIdAsync`/`GetByGroupIdAsync` (nhận thẳng Id, dùng cho màn Cây duyệt/lập
  đơn — phạm vi do route quyết định, không phải liệt kê tự do) hay `GetByIdAsync`/`GetByUserNameAsync`
  (tra 1 người, rủi ro thấp hơn nhiều so với xuất hàng loạt).
- Verify: build sạch; smoke test 7 check pass; gọi tay `grid-list`/`all` bằng JWT Admin thật xác nhận
  vẫn ra đúng `totalCount=3386`/`count=3386` (không regression cho Admin, vì Admin bypass hoàn toàn).
  **Chưa verify sống đường non-Admin bị scope đúng** — cùng giới hạn đã ghi ở mục Coordinator ngay
  trên (không có JWT của 1 tài khoản Staff thật để gọi thử ngoài Windows Negotiate của user hiện tại,
  vốn luôn là Admin). Nên test tay qua UI thật với 1 tài khoản Staff/Nhóm cụ thể trước khi coi ổn định.

- **UX đi kèm (cùng ngày, theo yêu cầu người dùng)** — dropdown lọc Phòng ban/Nhóm ở `EmployeeList.tsx`
  trước đó vẫn gọi `DepartmentApi.getAllDepartments()`/`GroupApi.getAllGroups()` vô điều kiện (liệt kê
  TOÀN CÔNG TY), nên non-Admin bị scope ở BE chọn nhầm 1 Phòng ban/Nhóm ngoài phạm vi sẽ ra bảng rỗng
  không rõ lý do. Thêm endpoint mới **`GET /api/Employee/my-scope`** (`Attendance.Employee.View`,
  `EmployeeService.GetMyScopeAsync`, DTO `EmployeeScopeDto { CompanyWide, DepartmentId,
  DepartmentNameVn, GroupId, GroupNameVn }`) — tái dùng nguyên `ResolveCallerScopeAsync`, CHỈ phục vụ
  UX (không phải lớp chặn bảo mật, lớp đó đã có ở `GetPagedAsync`/`GetAllActiveAsync`). `EmployeeList.tsx`
  gọi 1 lần lúc mount: `companyWide=true` → giữ nguyên hành vi cũ (dropdown đầy đủ); có `DepartmentId`
  (Manager) → khoá dropdown Phòng ban còn đúng 1 lựa chọn, dropdown Nhóm tải qua
  `GroupApi.getGroupsByDepartment(departmentId)` (vẫn thấy hết Nhóm CON của Phòng ban mình, không phải
  chỉ 1 Nhóm); chỉ có `GroupId` (Staff/GL/TL...) → **ẩn hẳn** dropdown Phòng ban (không có gì để lọc
  thêm), dropdown Nhóm khoá còn đúng 1 lựa chọn. `handleSelectDepartment` khi gỡ lựa chọn cũng đổi sang
  gọi lại `getGroupsByDepartment(scope.departmentId)` thay vì `getAllGroups()` cho case bị giới hạn,
  tránh nạp lại toàn bộ Nhóm công ty vào dropdown làm mất tác dụng thu hẹp.
- Verify: `npx tsc --noEmit` sạch, `pnpm lint` không phát sinh lỗi mới (3 lỗi/cảnh báo còn lại thuộc
  `CreateOtFormPage.tsx`/`OtFormPrintView.tsx`, có từ trước, không liên quan). Gọi tay
  `GET /api/Employee/my-scope` bằng JWT Admin xác nhận đúng `companyWide: true`. **Chưa test sống UI
  bằng 1 tài khoản Staff/Manager thật** (cùng giới hạn ở trên) — nên bấm thử màn "Nhân viên" bằng 1 tài
  khoản không phải Admin để xác nhận dropdown thu hẹp đúng trước khi coi ổn định.

### §Line Leader phải tự ký bước của mình trước khi đơn "theo chuyền" gửi lên cấp trên (2026-09-03)

**Lỗi gốc**: `JobTitleApprovalChainService.ResolveChainForProductionCreationAsync` lọc
`configuredSteps.Where(x => x.RankOrder > creatorRank)` — Line Leader tạo đơn thì `creatorRank` =
đúng `RankOrder` của bước Line Leader, nên `>` (không phải `>=`) loại luôn bước của CHÍNH họ khỏi
chuỗi. Hệ quả: `OtFormApprovalStep` đầu tiên tạo ra là bước Group Leader, `FinalizeCreateAsync` gửi
mail thông báo thẳng cho Group Leader ngay lúc tạo đơn — Line Leader không có bước Pending nào của
riêng mình để tự duyệt/sửa trước khi đơn "gửi lên trên" (đúng yêu cầu người dùng: đơn phải dừng ở
bước Line Leader tới khi họ tự ký).

**Sửa**: đổi `>` thành `>=`, CHỈ trong `ResolveChainForProductionCreationAsync` (dòng ~337) — không
đụng `ResolveChainCoreAsync` (đơn "theo Nhóm", dòng ~161, cùng pattern nhưng khác method). An toàn vì
người tạo đơn "theo chuyền" không phải Admin bắt buộc là Line Leader thật của Line trong đơn
(`OtFormService.CreateProductionFormAsync`) — `creatorRank` ở hàm này chỉ có 2 khả năng: `0` (Admin,
không đổi hành vi vì không JobTitle nào có RankOrder=0) hoặc đúng RankOrder Line Leader. `StepOrder`
tự renumber lại sau filter nên Group Leader tự lùi xuống đúng vị trí kế tiếp, không cần sửa gì thêm;
candidate của bước Line Leader (suy từ `ProductionEmployee.IsLeader`) đã tự động đúng, không cần thêm
plumbing. Không đổi FE — quyền sửa theo từng bước (Giai đoạn 10) tự áp dụng đúng.

**Lưu ý phụ (chưa sửa)**: `ResolveChainCoreAsync` (đơn "theo Nhóm") có cùng pattern lý thuyết có thể
gặp lỗi tương tự nếu Group Leader/Team Leader tạo đơn cho đúng cấp của họ — người dùng chỉ yêu cầu sửa
cho Line Leader/"theo chuyền" lần này, chưa đụng nhánh kia.

**Verify**: build sạch. **Chưa test sống** bằng tài khoản Line Leader thật (account TEST `ll_shido`
hoặc 1 trong 10 Line Leader TEST khác có sẵn) — nên tạo 1 đơn thật để xác nhận đơn dừng đúng ở bước
Line Leader, Group Leader chỉ thấy được sau khi Line Leader tự ký.

### §Import lũy kế OT theo tháng — tổng quát cho MỌI Phòng ban (2026-09-03)

Theo yêu cầu người dùng (xem file `docs/Data/phép năm và tăng ca 062026- Công Vụ.xlsx`, đọc trực tiếp
bằng cách giải nén xlsx đọc XML — 3 sheet: `062026(tc)` = tổng giờ OT riêng tháng 6/2026,
`luytien(tc)` = luỹ kế từ đầu năm (không tách được từng tháng, chỉ dùng đối chiếu), `phep nam con lai
062026` = phép năm — NGOÀI PHẠM VI, hệ thống chưa có tính năng phép năm). Chỉ lấy đúng 2 cột cần thiết
(MNV + Tổng giờ tháng) theo FORMAT RIÊNG của hệ thống (không khớp 9 cột tách loại giờ của file gốc —
ledger hiện chỉ lưu tổng giờ/tháng).

- **Tái dùng 90% hạ tầng có sẵn** — permission `Attendance.EmployeeAccumulation.Import` **đã tồn tại**
  và **đã tự động cấp cho Coordinator của BẤT KỲ Phòng ban nào** (không hardcode "Chế tạo", xem §Phân
  quyền theo Phòng ban ở trên) — KHÔNG cần permission/migration mới.
- Method mới `EmployeeImportService.ImportMonthlyAccumulationAsync(Stream, year, month, userName,
  isAdmin)` (đặt cạnh `ImportOtHourLimitsAsync`, mirror pattern 1-bước-upload-áp-dụng-luôn, KHÔNG có
  Preview riêng) — cùng logic delta-upsert với `ProductionEmployeeImportService.ApplyAccumulationAsync`
  (unique index `(EmployeeId, Year, Month)` buộc cộng dồn CHÊNH LỆCH thay vì ghi đè) + cùng cơ chế scope
  theo từng dòng qua `IDepartmentAccessGuard.GetManagedDepartmentIdsAsync`. Không trích thành helper
  dùng chung (2 service khác lớp cha) — chấp nhận lặp ~15 dòng logic, cùng tinh thần các `ParseXlsx`
  khác trong module không share code.
- File: cột A bỏ trống, B=MNV, C=Tổng giờ OT tháng đó. `Year`/`Month` là query param riêng (không đọc
  từ cột file).
- Endpoint mới `POST /api/EmployeeImport/monthly-accumulation?year=&month=` (multipart, field `file`)
  + `GET .../monthly-accumulation/template`, dùng lại đúng permission trên. FE: dialog mới
  `EmployeeMonthlyAccumulationImportDialog.tsx`, mở từ menu Excel trong `ProductionEmployeeList`
  (`EmployeeList.tsx`, cùng ActionMenu với "Import giới hạn OT"), gate hiện nút theo
  `hasPermission(user, "Attendance.EmployeeAccumulation.Import")` — không cần sửa gì ở tầng ẩn/hiện
  tab/sidebar vì permission đó đã có từ trước.
- **Verify**: build BE sạch, `npx tsc --noEmit`/`pnpm lint` sạch (3 lỗi/cảnh báo cũ không liên quan).
  **Phát hiện + sửa 1 lỗi có sẵn** khi test sống (xem mục riêng ngay dưới về lỗi ClosedXML

#### §Mở rộng — cột D "Tổng giờ OT năm" cũng được ghi (2026-09-04)

Khác hẳn cột "OT year" của `ProductionEmployeeImportService` ở mục **§Import nhân sự dưới chuyền**
phía trên (đó vẫn CHỈ tham khảo, không ghi gì) — cột D của **chính import này** (`ImportMonthlyAccumulationAsync`)
đã được nối dây để ghi thật, độc lập với cột C:

- Cột D **tuỳ chọn** (bỏ trống = không đụng gì tới lũy kế năm). Có giá trị → tính
  `deltaYear = D trong file − tổng lũy kế NĂM hệ thống đang có` (tổng này đã gồm cả điều chỉnh cột C
  vừa áp cùng lượt, do 2 bước dùng chung 1 danh sách `EmployeeAccumulationHistory` nạp 1 lần rồi sửa
  tại chỗ) — cộng thẳng `deltaYear` vào 1 dòng ledger đặc biệt **`Month = 0`** ("số dư đầu kỳ/các
  tháng trước"), KHÔNG đụng số liệu của 12 tháng thật. Idempotent — chạy lại cùng file ra delta = 0.
- `Month = 0` đã được `EmployeeService` xử lý đúng ở **mọi** nơi tính `MonthToDate`/`YearToDate` (6 chỗ
  trong `EmployeeService.cs` + `GetRealAccumulationAsync`): lọt vào `YearToDate` (điều kiện `Month <=
  todayMonth` luôn đúng với 0) nhưng **không** lọt vào `MonthToDate` (`Month == todayMonth`) — đúng ý
  nghĩa "số dư đầu kỳ", không phải giờ của riêng tháng nào.
- **Xem lại**: `AccumulationHistoryModal`/`AccumulationHistoryTable.tsx` đã có sẵn dòng riêng "Số dư đầu
  kỳ" (field `EmployeeAccumulationHistoryYearDto.InitialBalanceHours`, tính ở
  `EmployeeService.GetAccumulationHistoryAsync`) hiển thị đúng dòng `Month=0` này, tách biệt khỏi 12
  tháng — không bị ẩn.
- **Lưu ý khi dùng** (giới hạn có sẵn của TOÀN hệ thống lũy kế, không riêng cột D): mọi cột lũy kế hiển
  thị ở danh sách Nhân viên chỉ tính theo **năm hiện tại thực tế** (`todayYear`, so bằng đồng hồ server)
  — import cho 1 `year` khác năm nay (backfill năm cũ) vẫn ghi đúng vào ledger nhưng **không hiện** ở
  cột danh sách, chỉ xem được qua "Xem lịch sử lũy kế" rồi chọn đúng năm đó.
- **Kết quả trả về** thêm `AdjustedYearCount`/`TotalDeltaYearHours` (`ProductionEmployeeAccumulationResultDto`),
  FE dialog hiện thêm khi có giá trị (`!== undefined`).
- **Chưa verify sống** riêng cột D (build sạch, đã review logic — chưa gọi tay bằng file thật có cột D).
  range-relative indexing) — sau khi sửa, gọi tay endpoint `ot-hour-limits` (import khác, cùng lỗi) qua
  `curl` với chính file mẫu `GenerateOtHourLimitTemplate()` sinh ra xác nhận đọc đúng header/dữ liệu.
  **Chưa nạp dữ liệu thật Công Vụ tháng 6/2026** — đã chuẩn bị xong tính năng, còn chờ xác nhận trước
  khi ghi thật (dữ liệu OT ảnh hưởng lương của ~164 người).

### §Phát hiện + sửa lỗi ClosedXML đọc sai cột khi cột A trống hoàn toàn (2026-09-03)

Khi test sống 2 tính năng mới ở trên, phát hiện: `usedRange.RowsUsed()` rồi đọc `row.Cell(n)`
(range-relative) — nếu cột A của file **trống hoàn toàn** (đúng quy ước "cột A bỏ trống" nhiều import
trong module dùng, VD file mẫu do chính `GenerateTemplate()`/`GenerateOtHourLimitTemplate()` sinh ra),
ClosedXML tự thu hẹp `usedRange` bắt đầu từ cột B — khiến `Cell(2)` (tưởng là cột B) thực ra trỏ sang
cột C, làm mọi cột đọc sai 1 vị trí. Lỗi này đã tồn tại từ trước (không phải do các tính năng mới ở
trên gây ra) nhưng **chưa từng bị phát hiện** vì file thật của "Nhân sự dưới chuyền"
(`ProductionEmployeeImportService`) luôn có cột A = "KHOI SU" (không trống) nên không trúng lỗi; còn
`EmployeeImportService` (import Nhân viên + Giới hạn OT, cột A cố tình để trống) thì trước giờ có lẽ
chưa từng test bằng ĐÚNG file mẫu tự sinh ra — tái hiện được ngay khi gọi live `ot-hour-limits` bằng
chính `Mau_Import_GioiHanOT.xlsx` vừa tải xuống.

**Sửa**: đổi mọi chỗ đọc `xlRow.Cell(n)`/`r.Cell(n)` sang `worksheet.Cell(xlRow.RowNumber(), n)`
(tuyệt đối theo worksheet, không phụ thuộc `usedRange` bắt đầu từ cột nào) — áp dụng cho
`EmployeeImportService.ParseXlsx` (import Nhân viên), `ImportOtHourLimitsAsync`, và
`ImportMonthlyAccumulationAsync`/`EmployeeIdentityLinkImportService.ParseXlsx` (2 tính năng mới ở
trên, viết đúng ngay từ đầu theo phát hiện này). `ProductionEmployeeImportService.ParseXlsx` KHÔNG cần
sửa (cột A luôn có dữ liệu thật, không trúng lỗi) — để nguyên, tránh đụng code đang chạy ổn định không
cần thiết.

**Verify**: tái hiện lỗi + xác nhận đã sửa bằng dữ liệu thật qua `curl` (POST file mẫu tới
`/api/EmployeeImport/ot-hour-limits` — trước khi sửa báo "không tìm thấy dòng tiêu đề", sau khi sửa đọc
đúng header + dòng `NV001`, báo đúng "không tìm thấy nhân viên" vì mã đó không tồn tại thật — đúng hành
vi mong đợi, không ghi gì vào DB).

### §Import Excel liên kết Identity ↔ Attendance + tự tạo tài khoản + gán chữ ký (2026-09-03)

Theo yêu cầu người dùng: Admin import Excel hàng loạt để (a) liên kết `Employee.UserName` với tài
khoản đăng nhập, (b) **tự tạo tài khoản Identity nếu UserName đó chưa tồn tại**, (c) gán luôn chữ ký —
sau khi import xong người đó dùng được hệ thống ngay (kể cả quyền theo Chức vụ có hiệu lực ngay lập
tức, không cần đăng nhập lại).

- **Định dạng file**: cột A bỏ trống, B=MNV, C=UserName (không kèm domain, khớp đúng cách lưu hiện
  tại), D=RoleName (để trống = mặc định "Basic", khớp đúng hành vi JIT-provision hiện có ở
  `MyClaimsTransformation`). Ảnh chữ ký **nhúng trực tiếp vào Excel**, neo theo đúng hàng của mỗi nhân
  viên (đọc qua `IXLPicture.TopLeftCell.Address.RowNumber` để map ảnh ↔ đúng dòng, `ImageStream` lấy
  bytes).
- **Cross-module** (Identity User ở DB `YevIdentityManagement`, Employee/UserSignature ở
  `YevOTManagement` — không transaction chung được):
  - `IUserDirectoryService` (Shared.Application) thêm method mới **`EnsureUserExistsAsync(userName,
    fullName, roleName)`** — idempotent (UserName đã có thì no-op, GIỮ NGUYÊN Role hiện tại, khác
    `UserService.CreateUserAsync` throw nếu trùng). Implement ở `Identity.Application/Services/
    UserDirectoryService.cs`.
  - `IUserSignatureService` thêm method mới **`AdminSetSignatureAsync(userName, signatureImage)`** —
    set thẳng, KHÔNG qua luồng email-confirm tự phục vụ (`RequestUpdateAsync`/`ConfirmAsync` vẫn giữ
    nguyên là đường DUY NHẤT cho người dùng tự đổi chữ ký của chính mình — đây là đánh đổi bảo mật CÓ
    CHỦ ĐÍCH, chỉ Admin gọi được qua đúng 1 luồng import này).
- **Service mới `EmployeeIdentityLinkImportService`** (Preview→Confirm, nhưng khác các import khác:
  **CẢ 2 bước đều nhận lại NGUYÊN file** thay vì Rows qua JSON — vì mỗi dòng có thể kèm ảnh nhị phân,
  không tiện round-trip qua JSON; Confirm tự đọc + re-validate lại từ đầu, không tin gì từ Preview).
  Thứ tự ghi mỗi dòng: `EnsureUserExistsAsync` (Identity) TRƯỚC → nếu lỗi (VD RoleName không tồn tại)
  thì KHÔNG ghi gì xuống Attendance DB cho dòng đó (tránh nửa vời) → set `Employee.UserName` (thu hồi
  quyền tự động của UserName CŨ nếu đổi sang UserName khác, cùng nguyên tắc
  `EmployeeService.UpdateAsync`) → `EmployeeService.SyncAutoGrantedPermissionsForEmployeeAsync` (hàm
  PUBLIC có sẵn) → `AdminSetSignatureAsync` nếu dòng có ảnh. Mỗi dòng độc lập, lỗi 1 dòng không huỷ
  file.
- **Permission mới `Identity.User.BulkImport`** (migration `AddIdentityUserBulkImportPermission`, DB
  `YevIdentityManagement`, seed + gán **CHỈ** Role Admin — hành động nhạy cảm nhất hệ thống, KHÔNG
  auto-grant qua JobTitle/Coordinator) — **đã chạy migration lên DB thật**, verify bằng SQL đọc
  `RolePermissions` xác nhận đúng gán cho Admin.
- Controller mới `EmployeeIdentityLinkImportController` — `POST preview`, `POST confirm`, `GET
  template`, cùng gate permission trên. FE: dialog mới `EmployeeIdentityLinkImportDialog.tsx`, nút mở
  cạnh "Import Excel" trong `EmployeeList.tsx`, gate `hasPermission(user, "Identity.User.BulkImport")`.
- **Verify**: build BE sạch (cả 2 project Identity + Attendance), `npx tsc --noEmit`/`pnpm lint` sạch.
  Gọi tay sống qua `curl`: tải file mẫu → gọi `preview` với chính file mẫu (dòng ví dụ mã "NV001" —
  đúng ra báo "không tìm thấy nhân viên", xác nhận parser đọc đúng header/cột sau khi sửa lỗi
  ClosedXML ở mục trên) — **hoàn toàn read-only, không ghi gì**. JWT sau khi gọi lại `windows-login`
  xác nhận permission `Identity.User.BulkImport` đã có ngay trong claim, không cần chờ gì thêm.
  **Chưa test sống luồng Confirm thật** (tạo User mới/set chữ ký) — cố tình không test bằng dữ liệu
  thật vì đây là hành động ghi (tạo tài khoản đăng nhập + đổi chữ ký), không phải thao tác read-only —
  nên test tay bằng 1 UserName test trước khi coi ổn định (VD 1 trong các tài khoản TEST có sẵn).

**Mở rộng 2026-09-03b — thêm cột Chức vụ + Người phụ trách Cây duyệt.** Theo yêu cầu người dùng (dùng
import này ngay tại màn "Nhân viên dưới chuyền" — Role mặc định đã là "quản lý tăng ca" — nên cần import
kèm luôn Chức vụ hoặc gán họ làm Người phụ trách Cây duyệt của Bộ phận/Nhóm họ đang thuộc):

- **Cột mới**: E=MaChucVu (mã `JobTitle.Code`, để trống = không đổi Chức vụ), F=NguoiPhuTrach (nhập
  `"1"` = có, để trống/khác = không — mirror đúng quy ước cột `LEADER` của
  `ProductionEmployeeImportService`, KHÔNG tự nghĩ ra convention mới).
- **Phạm vi LUÔN suy ra từ tổ chức HIỆN TẠI của Employee** (`Employee.DepartmentId`/`GroupId`, đã có sẵn
  từ import nhân sự trước đó) — file này **không** cho đổi Bộ phận/Nhóm của ai, chỉ gán Chức vụ/người
  phụ trách đúng nơi họ đang thuộc về. Employee có `DepartmentId` (Trưởng phòng) → thao tác ở khối Bộ
  phận; có `GroupId` (nhân viên thường) → thao tác ở khối Nhóm; không có cả 2 → lỗi dòng.
- **Chức vụ**: tái dùng NGUYÊN 2 hàm có sẵn `EmployeeService.AssignDepartmentJobTitleAsync`/
  `AssignGroupJobTitleAsync` (vốn dựng sẵn cho đúng use-case "gán Chức vụ có phạm vi", đã tự validate
  TerminalLevel — VD không cho gán Chức vụ Trưởng phòng cho người đang ở trong 1 Nhóm) — gọi với
  `isAdmin=true` (import chỉ Admin mới gọi được) nên bỏ qua check "phải là Coordinator của đúng Bộ
  phận/Nhóm đó", `userName` truyền rỗng vì không dùng tới khi `isAdmin=true`. KHÔNG viết lại logic
  validate mới.
- **Người phụ trách Cây duyệt**: đây là khái niệm **khác** Chức vụ — `DepartmentApprovalStepCoordinator`/
  `GroupApprovalStepCoordinator` (người được chỉ định tay cấu hình Cây duyệt của 1 Bộ phận/Nhóm, xem
  §Cây chức vụ). 2 service quản lý coordinator hiện có (`DepartmentApprovalStepCoordinatorService`/
  `GroupApprovalStepCoordinatorService`) chỉ có `ReplaceAsync` (**thay NGUYÊN danh sách** — gọi trực
  tiếp từ import sẽ XOÁ MẤT mọi người phụ trách khác đã gán từ trước qua màn hình quản lý). Thêm method
  MỚI **`EnsureCoordinatorAsync(scopeId, employeeId)`** ở cả 2 interface/service — CHỈ THÊM nếu chưa có
  (no-op nếu đã là coordinator), validate employee thuộc đúng phạm vi (mirror check của `ReplaceAsync`),
  rồi gọi lại `SyncAutoGrantedPermissionsForEmployeeAsync` — dùng đúng cho trường hợp "thêm dần từng
  người qua import" khác hẳn "thay nguyên danh sách qua UI quản lý Cây duyệt".
- DTO/Preview: thêm `resolvedJobTitleName`, `coordinatorScopeDescription` (VD "Nhóm ABC"/"Bộ phận XYZ"),
  đếm `rowsWithJobTitleCount`/`rowsWithCoordinatorCount` (Preview) và
  `jobTitleAssignedCount`/`coordinatorAddedCount` (Confirm).
- Template (`GenerateTemplate()`) thêm 2 cột E/F, dòng ví dụ đặt sẵn `NguoiPhuTrach = "1"`.
- **Verify**: build BE sạch. Chưa test sống Confirm thật (cùng lý do như phần gốc ở trên — hành động
  ghi, không phải read-only) — cần test tay bằng 1 Employee test trước khi dùng thật, đặc biệt kiểm tra
  đúng: (1) gán Chức vụ Trưởng phòng cho người đang ở Nhóm bị từ chối đúng như mong đợi; (2) import lại
  cùng 1 người 2 lần với `NguoiPhuTrach=1` không tạo trùng dòng coordinator (idempotent).

### §Gộp thêm/xóa NV vào Sửa đơn + khóa phạm vi Line/Nhóm ca (2026-09-04)

Thay thế kênh trong-app của §Loại nhân viên khỏi đơn (2026-07-30) và §Giai đoạn 11 — Thêm nhân viên vào
đơn (2026-08-28): 2 action riêng `POST {id}/employees/add`/`POST {id}/employees/remove` (mỗi thao tác
gọi API + xác nhận mật khẩu cấp 2 riêng, hiện ngay ở `OtFormDetail.tsx`) đã **XOÁ HẲN**, gộp toàn bộ vào
`PUT /api/OtForm/{id}` (`UpdateAsync`) — người dùng chốt: thêm/xóa NV chỉ là thay đổi TẠM ở màn "Sửa
đơn" (`CreateOtFormPage.tsx` edit mode), chỉ áp dụng thật + log lại khi bấm "Lưu thay đổi" (1 lần nhập
mật khẩu cấp 2 cho TOÀN BỘ thay đổi trong phiên sửa, không hỏi lại riêng từng thao tác nữa).

- **Kênh email KHÔNG đổi** — `RemoveEmployeeByEmailTokenAsync`/`RemoveEmployeeCoreAsync` vẫn y nguyên,
  chỉ refactor `RemoveEmployeeCoreAsync` để dùng lại được từ `UpdateAsync` (tham số
  `secondaryPassword: null` để bỏ qua verify khi gọi từ trong 1 giao dịch đã verify sẵn ở đầu).
- **`UpdateOtFormDto`** thêm `RemovedEmployees: List<UpdateOtFormRemovedEmployeeDto>` (`EmployeeId` +
  `Reason` bắt buộc). `Employees` giờ có thể chứa NV MỚI (không có trong đơn trước đó) — `UpdateAsync` tự
  diff `requested vs active` để suy `toAdd`/`toKeep`/`toRemove` (từ `RemovedEmployees`), validate
  `toKeepIds ⊆ requestedEmployeeIds` (thiếu ai → lỗi "dùng chức năng Loại khỏi đơn"), tổng NV còn lại
  phải ≥ 1.
- **Luật phạm vi MỚI khi thêm NV vào đơn theo chuyền** (trước đây KHÔNG hề kiểm tra — xác nhận đúng báo
  cáo người dùng "nhân viên Line khác vẫn thêm được"): so `(ProductionEmployee.BlockCode, ShiftTeamCode)`
  SỐNG của người mới với tập `(BlockCodeSnapshot, ShiftTeamCodeSnapshot)` DISTINCT của NV còn lại (sau
  khi trừ người bị xóa cùng lượt lưu) — khớp ít nhất 1 cặp là được, không ép cả đơn cùng 1 Line (giữ tinh
  thần multi-Line đã có sẵn từ `CreateProductionFormAsync`). Đơn theo Nhóm giữ nguyên check cũ
  `employee.GroupId != otForm.GroupId`. Nếu đơn trống người "gốc" sau khi trừ xóa (hiếm) thì bỏ qua check.
- **Quyền thêm/xóa NV** giờ dùng ĐÚNG quyền sửa đơn hiện có của `UpdateAsync` (đơn theo Nhóm: chỉ người
  tạo + chưa có bước Approved; đơn theo chuyền: candidate của bước Pending hiện tại) — không còn quyền
  riêng "candidate bước hiện tại cho MỌI loại đơn" mà 2 action cũ dùng (thu hẹp có chủ đích cho đơn theo
  Nhóm, khớp đúng "1 cổng, 1 luật" người dùng yêu cầu).
- **`OtFormEditLog`** (đã có sẵn từ Giai đoạn 11) tiếp tục ghi đủ `EmployeeAdded`/`EmployeeRemoved`/
  `TimeChanged`/`NoteChanged` — nhiều dòng log cùng 1 lượt Lưu giờ có `ActionAt` xấp xỉ nhau (tự nhiên
  "gộp phiên" mà không cần thêm field session-id nào).
- Xóa code chết: `AddEmployeeAsync`/`RemoveEmployeeAsync` (public, in-app) khỏi `OtFormService.cs` +
  `IOtFormService.cs`; 2 route `{id}/employees/add`/`{id}/employees/remove` (bản in-app, KHÔNG phải
  email-token) khỏi `OtFormController.cs`; DTO `AddOtFormEmployeeDto.cs`/`RemoveOtFormEmployeeDto.cs`
  (bản in-app — `RemoveOtFormEmployeeByEmailTokenDto` vẫn còn, dùng cho kênh email). Permission
  `Attendance.OTForm.AddEmployee`/`Attendance.OTForm.RemoveEmployee` vẫn còn trong seed (không xoá
  migration) nhưng không còn action nào check nữa — coi như treo, vô hại.
- `ProcessBatchAsync` ("Đơn tổng") trước đó gọi `RemoveEmployeeAsync` nội bộ khi loại NV lúc duyệt gộp —
  sửa gọi thẳng `RemoveEmployeeCoreAsync` (private, cùng class), không đổi hành vi.
- **FE `CreateOtFormPage.tsx` edit mode**: bỏ giới hạn "danh sách NV cố định" — thêm khối tìm NV mới
  (keyword-only search qua `ProductionEmployeeApi.search`/`EmployeeApi.getEmployeesByGroup`, KHÔNG lọc
  Line/Nhóm ca ở FE — BE mới là nơi chặn thật, chọn sai sẽ báo lỗi rõ khi Lưu) + nút "Loại khỏi đơn" trên
  từng dòng NV cũ (yêu cầu lý do qua 1 panel nhỏ, lưu tạm vào state `pendingRemovals`, KHÔNG gọi API
  ngay). `selectedEmployeeIds`/`employeeOverrides` (đã có sẵn, vốn dùng cho cả 2 mode) tự phản ánh đúng
  roster cuối cùng — submit build `Employees` + `RemovedEmployees` gộp 1 lần.
- **FE `OtFormDetail.tsx`**: xóa hẳn 2 modal + nút "Thêm nhân viên"/"Loại khỏi đơn" — nút "Sửa đơn" có
  sẵn (trỏ `/ot/forms/edit`) là lối duy nhất để đổi nhân viên.
- **Verify**: `dotnet build` sạch (0 warning), `npx tsc --noEmit`/`pnpm lint` sạch (2 warning +1 lỗi lint
  còn lại đều CÓ TRƯỚC, không liên quan thay đổi này — xem `overlappingEmployeeIds` effect trong
  `CreateOtFormPage.tsx`). Smoke test 7 check qua `smoke.ps1` PASS hết; xác nhận route cũ
  `{id}/employees/add` trả 404. **Chưa test tay** luồng thêm/xóa NV thật trong Sửa đơn qua UI (cần tài
  khoản TEST có đơn theo chuyền đang chờ duyệt) — người dùng tự kiểm khi dùng thử.

### §Nâng cấp màn Duyệt hàng loạt — lịch ngày chưa duyệt + lọc Line/Ca + xem/sửa trước khi xác nhận (2026-09-04)

`OtFormListPage.tsx` (mode `pending-approvals`, dùng chung khung sườn với 3 tab khác) thêm:

- **`GET /api/OtForm/pending-approvals/dates?fromDate&toDate`** (permission `Attendance.OTForm.Approve`,
  service `GetPendingApprovalDatesAsync` — tái dùng đúng scoping `GetMyCurrentPendingFormIdsAsync` của
  `GetPendingApprovalsAsync`) → `List<PendingApprovalDateCountDto {Date, Count}>`, group theo `Date`. FE
  hiện lịch mini (điều hướng tháng bằng nút trước/sau, không phải lưới ngày-trong-tuần đầy đủ — đơn giản
  hoá cho gọn) với badge số đơn trên mỗi ngày có dữ liệu; bấm 1 ngày → set `fromDate=toDate=ngày đó` rồi
  tự tìm lại.
- **Filter mới** trên `GET pending-approvals`: `productionLineId`/`productionTeamId`/`productionShiftTeamId`
  (int?, cùng nguồn dropdown Line/Team/ShiftTeam dùng ở `CreateOtFormPage`) — service resolve mỗi ID sang
  `Code` (qua `ProductionLines`/`ProductionTeams`/`ProductionShiftTeams` repo) rồi lọc
  `x.OtFormEmployees.Any(e => !e.IsRemoved && e.BlockCodeSnapshot == lineCode)` (tương tự Team/ShiftTeam)
  — so trực tiếp snapshot code đã lưu trên `OtFormEmployee`, KHÔNG join `ProductionEmployee` sống. **Mở
  rộng ra cả 5 endpoint danh sách** (xem §Mở rộng filter bên dưới, 2026-09-04, cùng ngày).
- **`OtFormListItemDto`** thêm `ProductionLineNames`/`ProductionShiftTeamNames` (string?, distinct
  `BlockCodeSnapshot`/`ShiftTeamCodeSnapshot` nối `", "`) — tính ở `EnrichWithProductionLineInfoAsync`
  (query RIÊNG sau khi đã phân trang, gộp Distinct ở C# thay vì nhét `string.Join`/`Distinct` vào
  `ToListItemDto` — expression đó dùng chung cho các endpoint danh sách, rủi ro không dịch được sang SQL
  nếu thêm logic phức tạp). **Giờ cả 5 endpoint đều gọi enrich này** (trước đây chỉ `pending-approvals`).
  FE thêm cột "Line/Nhóm ca" vào bảng (hiện `—` khi không phải đơn theo chuyền hoặc field null).
- **Xem/sửa trước khi xác nhận duyệt hàng loạt**: modal "Ký/Từ chối hàng loạt" hiện có (Comment +
  SecondaryPassword, không đổi API `bulkApprove`/`bulkReject`) thêm 1 khối review NGAY TRONG modal đó,
  liệt kê các đơn đã chọn (lấy từ `forms` đang có sẵn trên trang, không gọi API thêm) — mỗi dòng có link
  "Sửa" mở `/ot/forms/edit?id=` ở **TAB MỚI** (`target="_blank"`, dùng `getPathname` để giữ đúng tiền tố
  locale) thay vì nhúng cả `CreateOtFormPage` vào trong dialog (giảm độ phức tạp, không mất lựa chọn/
  modal hàng loạt đang mở ở tab gốc) — sửa xong (kể cả thêm/xóa NV, §Gộp thêm/xóa NV ở trên) đóng tab đó,
  quay lại tab gốc bấm tiếp Comment/Password để xác nhận duyệt như cũ.
- **Verify**: BE build sạch. Gọi tay `GET pending-approvals` (không lỗi, `productionLineNames` có mặt
  trong response dù tài khoản test hiện tại 0 đơn chờ duyệt nên chưa thấy giá trị thật) và `GET
  pending-approvals/dates` (không lỗi) qua JWT thật. FE `tsc`/`lint` sạch (cùng 1 lỗi lint có-trước-đó,
  không liên quan). **Chưa test tay** lịch/filter/review-trước-khi-duyệt qua UI thật với tài khoản có đơn
  theo chuyền đang chờ — người dùng tự kiểm khi dùng thử.

### §Mở rộng filter (Bộ phận/Nhóm + Line/Team/Nhóm ca) ra mọi tab + tab "Tất cả đơn" cho Admin (2026-09-04)

Theo yêu cầu người dùng sau khi dùng thử màn "Chờ tôi duyệt": filter Line/Team/Nhóm ca trước đó chỉ có ở
`pending-approvals`, và không tab nào lọc được theo Bộ phận/Nhóm (đơn văn phòng) dù `OtFormListItemDto`
đã hiển thị sẵn 2 field này.

- **`OtFormService.cs`**: tách 2 helper filter dùng chung cho MỌI endpoint danh sách —
  `ApplyOfficeFilter(query, groupId, departmentId)` (so trực tiếp `OtForm.GroupId`/`DepartmentId`, đơn
  theo Nhóm có cả 2, đơn theo chuyền chỉ có `DepartmentId` — filter vô hại với loại kia) và
  `ApplyProductionFilterAsync(...)` (tách nguyên logic resolve Id→Code cũ ra khỏi
  `GetPendingApprovalsAsync`, không đổi hành vi). `GetMyFormsAsync`/`GetPendingApprovalsAsync`/
  `GetMyActionsAsync`/`GetMyParticipationsAsync` đều nhận thêm 5 param optional
  `groupId/departmentId/productionLineId/productionTeamId/productionShiftTeamId` và gọi cả 2 helper +
  `EnrichWithProductionLineInfoAsync` (trước đây chỉ `GetPendingApprovalsAsync` enrich).
- **Endpoint mới `GET /api/OtForm/all-forms`** (`GetAllFormsAsync`) — "Tất cả đơn" cho Admin, KHÔNG lọc
  theo user gọi API (khác 4 endpoint kia), chỉ áp `ApplyListFilters`/`ApplyOfficeFilter`/
  `ApplyProductionFilterAsync` như nhau. Gate bằng permission mới **`Attendance.OTForm.ViewAll`**
  (migration `AddOtFormViewAllPermission`, piggyback insert vào `RolePermissions` của mọi role đang có
  `Attendance.Department.Create` — cùng cách làm với `Attendance.OTForm.Delete` — **CHỈ Admin có**, không
  thêm vào `JobTitlePermissionWhitelist` vì đây là quyền "xem toàn cục", không phải quyền tham gia quy
  trình theo Chức vụ).
- **FE `OtFormListPage.tsx`**: thêm dropdown "Bộ phận"/"Nhóm" (cascading, nguồn `DepartmentApi.getAllDepartments()`
  + `GroupApi.getGroupsByDepartment(departmentId)`, cùng pattern Team→Line→Nhóm ca có sẵn) — hiện ở MỌI
  tab (không riêng `pending-approvals` nữa, `showProductionFilter` đổi thành hằng `true`). Thêm mode
  `"all-forms"` vào `OtFormListMode`, gọi `OtFormApi.getAllForms`.
- **FE `OtFormTabsPage.tsx`**: thêm tab "Tất cả đơn", hiện khi `hasPermission(user, "Attendance.OTForm.ViewAll")`.
- **`GetOtFormListParams`/`appendOtFormListParams`** (`ot-form.api.ts`): thêm `groupId`/`departmentId`,
  gửi `GroupId`/`DepartmentId` — dùng chung cho cả 5 hàm gọi API (kể cả `getAllForms` mới).
- **Verify**: `dotnet build` sạch. Gọi tay qua JWT Admin thật: `GET all-forms` trả đúng toàn bộ đơn
  (21 đơn, kể cả đơn của user khác); `GET all-forms?departmentId=6` (Công vụ) trả đúng 6/21 đơn; `GET
  my-forms` kèm param mới không lỗi. FE `npx tsc --noEmit` sạch; `pnpm lint` chỉ còn đúng 1 lỗi + 2
  warning có-từ-trước (`CreateOtFormPage.tsx`/`OtFormPrintView.tsx`, không liên quan thay đổi này) —
  riêng 3 file vừa sửa (`OtFormListPage.tsx`/`OtFormTabsPage.tsx`/`ot-form.api.ts`) lint sạch 100%.
  **Chưa test tay UI thật** (chọn Bộ phận/Nhóm trên giao diện, xem tab "Tất cả đơn" hiện đúng cho Admin)
  — người dùng tự kiểm khi dùng thử.

### §Fix bug — Người phụ trách Bộ phận không sửa được Cây duyệt Chuyền (2026-09-05)

Khi thêm tab "Theo chuyền" vào màn Cây duyệt (24/08, xem §Giai đoạn 7 phía trên), quyền tự động cấp cho
"Người phụ trách Bộ phận" (`ApprovalStepCoordinatorPermissions.BaseViewCodes` + logic trong
`EmployeeService.SyncAutoGrantedPermissionsCoreAsync`) chỉ được nối thêm `DepartmentApprovalStep.*` +
`GroupApprovalStep.*` — **quên hẳn** `Attendance.ProductionApprovalStep.View/Update` — nên người phụ
trách xem/sửa được khối "Theo Nhóm" nhưng bị 403 ở khối "Theo chuyền". Đã sửa: thêm
`Attendance.ProductionApprovalStep.View` vào `BaseViewCodes` (cấp cho cả `isDeptCoordinator` lẫn
`isGroupCoordinator`, giống 2 permission `.View` kia — màn không lỗi khi tải dù chỉ phụ trách 1 phía) +
thêm hằng `ProductionUpdateCode` gán riêng cho `isDeptCoordinator` (cùng scope Bộ phận với
`DepartmentUpdateCode`). **Chỉ có hiệu lực NGAY cho người phụ trách gán MỚI sau khi fix** — người đã
được gán từ trước (đã xác nhận qua DB: `YEV\m.cuong.da.pcd.it` phụ trách Công vụ, `TEST\gl_shido`/
`TEST\tl_shido` phụ trách Chế tạo) cần 1 lần re-save danh sách "Người phụ trách" của đúng Bộ phận đó
(xoá rồi thêm lại, hoặc bất kỳ thao tác Lưu nào chạm vào `DepartmentApprovalStepCoordinatorApi.replaceByDepartment`)
để `SyncAutoGrantedPermissionsForEmployeeAsync` chạy lại với bộ quyền mới — không có cách nào hồi tố tự
động vì quyền chỉ tính lại đúng lúc danh sách được ghi.

### §Chuẩn giao diện rút ra sau đợt polish (2026-09-05)

> Gộp từ 3 mục changelog cùng ngày (polish Cây duyệt, polish Báo cáo, dọn trùng lặp). Giữ phần còn dùng
> lại được; diễn biến từng lượt sửa đã bỏ.

- **Component dùng chung của màn Cây duyệt** (`job-titles/`): `StepCard.tsx` (thẻ 1 bước — drag handle,
  số thứ tự, tên/mã/cấp Chức vụ, pill "Cần ký", pill "Chịu trách nhiệm" *(optional)*, nút xoá),
  `StepHolders.tsx` (chip-list "đang giữ" + combobox thêm), `CoordinatorsBox.tsx` (khối "Người phụ
  trách", dùng chung Nhóm + Bộ phận vì 2 DTO Coordinator cùng shape
  `{employeeId, employeeCode, fullName, userName}`). Phần "đang giữ chức vụ" truyền qua prop
  `footer: React.ReactNode` — khác nhau quá nhiều giữa 3 khối (khối Chuyền có 3 nhánh theo
  `terminalLevel`/`isLineScoped`), đừng cố nhét vào `StepCard`.
- **`SearchableSelect` thay mọi `<select>` thường** (DESIGN_SYSTEM §4.3) — đã áp cho 3 dropdown chọn
  chức vụ ở Cây duyệt, filter Phòng ban ở màn Báo cáo, và 3 dropdown "Theo chuyền" ở `CreateOtFormPage`.
- **Đổi Bộ phận/Nhóm khi state đang dirty** (`isDeptDirty`/`isGroupDirty`/`isProductionDirty`) phải hỏi
  `ConfirmDialog` trước — trước đây xoá thẳng state, mất dữ liệu im lặng. Đổi **tab** thì không cần hỏi
  (state 2 tab đều ở component cha).
- **Đánh số bước liên tục**: khối Bộ phận bắt đầu từ `groupSteps.length + 1` (Nhóm → Bộ phận là 1 chuỗi
  duyệt liền mạch, không đánh lại từ 1).
- **Màu "warning"** `bg-[#fff4e5]`/`border-[#f5d0a9]`/`text-[#9a5b00]` đã ghi chính thức vào
  `DESIGN_SYSTEM.md §1.3` (dùng cho "chưa liên kết tài khoản"/"đang chờ xác nhận"/"sắp đạt giới hạn").
- **`MealTicketTypeBadge`** chỉ có đúng 1 bản dùng chung `ot-form/MealTicketTypeBadge.tsx` (props
  `{type, t}`) — đừng tạo bản cục bộ trong màn khác.
- **Khung cuộn modal (5 dialog Import)**: `flex max-h-[85vh] flex-col`, header đứng yên, **đúng 1** vùng
  `flex-1 overflow-auto` — không cuộn cả trang. Chiều rộng tuỳ nội dung (`max-w-2xl` cho bảng 2-4 cột,
  `max-w-6xl` cho bảng nhiều cột) — khác nhau là ĐÚNG, chỉ khung cuộn phải nhất quán.
- **Nhãn nút xuất Excel màn Báo cáo** không lộ tên query hệ cũ ra UI ("Chi tiết theo người/ngày",
  "Tóm tắt theo ngày"); tên kỹ thuật `Qry_EXPORT_EXCEL`/`SUM_EXPORT_DATA` giữ trong `title` tooltip.

### §Fix bug — Team A/B lệch chuẩn hoá + dropdown Line theo Team lọc ra danh sách rỗng (2026-09-05)

Người dùng báo: chọn Team A + 1 Line cụ thể ở màn "Nhân viên dưới chuyền" rồi search thì ra 0 kết quả dù
Line đó có nhân viên thật. Rà ra 2 vấn đề độc lập:

- **Dữ liệu**: `ProductionEmployee.TeamCode` lưu nguyên chữ thô từ cột GROUP trong file Excel (`A`/`B`)
  thay vì mã đã chuẩn hoá khớp `ProductionTeam.Code` (`1`/`2`) — dù `TeamId` (FK dùng để lọc/join) đã
  luôn đúng. `ProductionEmployeeImportService.TeamCodeTranslation` (A→1, B→2, HC→HC) trước đây chỉ dùng
  để tra `TeamId` rồi vứt kết quả dịch, còn `TeamCode` ghi xuống DB vẫn là chữ thô — sửa: hoist biến
  `translatedTeamCode` ra ngoài (`ValidateAndResolveRowsAsync`), dùng nó cho cả tra cứu `TeamId`, so
  sánh dirty-check (`isUpdatedProductionEmployee`), và gán vào `TeamCode` trả về (thay vì `teamCode` thô)
  — từ giờ mọi lần import lại (kể cả tháng sau) đều tự lưu đúng mã chuẩn hoá, không cần sửa tay nữa.
  Đã chạy 1 lần `UPDATE ProductionEmployees SET TeamCode='1' WHERE TeamCode='A'` (784 dòng) và tương tự
  `B`→`2` (823 dòng) trên DB thật để dọn sạch dữ liệu tồn cũ.
- **Bug rỗng danh sách (nguyên nhân thật của báo lỗi)**: `ProductionEmployeeService.GetLineOptionsAsync`
  lọc Line theo Team qua `ProductionLine.TeamId` — 1 FK **snapshot tĩnh** set 1 lần từ file tham chiếu
  gốc lúc dựng quan hệ (2026-08-21, xem migration `ConnectProductionLineToTeam`), không cập nhật lại
  theo thời gian. Trong khi đó Team thật của nhân viên được nạp lại MỖI THÁNG qua Import — 1 Line có thể
  đã đổi Team thực tế (VD Line `TCA` snapshot ghi Team `"1"` nhưng toàn bộ nhân viên thật hiện tại trên
  đó đã là Team `"ab"`) mà FK tĩnh không hề biết, khiến dropdown vẫn cho chọn tổ hợp Team+Line không còn
  khớp thực tế → search ra rỗng. Sửa: đổi `GetLineOptionsAsync` sang suy Line có sẵn theo Team **từ dữ
  liệu `ProductionEmployees` thật** (cùng cách `GetShiftTeamOptionsAsync` bên cạnh đã áp dụng từ
  2026-08-25 cho đúng vấn đề tương tự ở Nhóm ca) thay vì theo FK tĩnh trên `ProductionLine`.
- **Verify**: `dotnet build YevManagement.slnx` sạch (0 lỗi). Đã kiểm tra lại dữ liệu thật qua SQL sau
  khi UPDATE — đúng 784/823 dòng đổi thành `1`/`2`, không đụng `AB`/`HC`. **Chưa test tay qua UI thật**
  (mở màn "Nhân viên dưới chuyền", chọn lại đúng tổ hợp Team+Line từng bị rỗng để xác nhận ra kết quả).

### §Template email — trạng thái chốt về font & dark-mode (2026-09-05)

> Gộp từ 5 lượt sửa liên tiếp trong ngày (Georgia→Arial → `color-scheme` → thử Times New Roman →
> tìm ra gốc rễ). **Áp cho cả 7 template** ở `Attendance.Infrastructure/EmailTemplates/` và
> `Workflow.Infrastructure/EmailTemplates/`.

**Luật khi sửa/thêm template email — giữ đủ 3 điều:**
1. **Khai `font-family` TRỰC TIẾP trên MỌI thẻ** `<p>/<span>/<strong>/<a>/<td>` có `style=""` — hiện là
   `'Times New Roman', 'Liberation Serif', Georgia, serif` (239 chỗ). Outlook Desktop render bằng engine
   Word, **không đảm bảo kế thừa `font-family`** qua nhiều tầng `<table>` lồng nhau (mà email HTML thì
   bắt buộc lồng nhiều tầng) → thẻ nào không tự khai sẽ rơi về font Normal của Word. Đây là **gốc rễ
   thật**, đã loại trừ mọi giả thuyết khác (registry `FontSubstitutes` bình thường; bảng Font
   Substitution của Word báo "All fonts used in this email are available").
2. **`<meta name="color-scheme">` và `supported-color-schemes` chỉ được để `"light"`.** Khai
   `"light dark"` trong khi template KHÔNG có khối `@media (prefers-color-scheme: dark)` khiến client tự
   ý xử lý lại màu/font theo cách riêng — máy được máy không.
3. **Giữ attribute HTML `bgcolor`** (`#eef0f2` / `#ffffff`) song song CSS `background-color` cho 2 bảng
   nền chính — engine Word chỉ tin `bgcolor`; thiếu nó càng dễ bị dark-mode tự động ghi đè.

**Công cụ tự kiểm tra:** `POST /api/AttendanceSetting/test-email` (`SendTestEmailDto { Email }`,
`[Required]`+`[EmailAddress]`, quyền `Attendance.Setting.Update` — không tạo permission mới) render
template `Test/TestEmail.html` (mirror header/footer thật, KHÔNG có nút CTA để không bị tưởng là yêu cầu
duyệt thật) rồi gọi `IEmailService.SendAsync`; trả `bool`, `false` → `Fail<bool>` kèm gợi ý kiểm tra
`EmailSettings` trong `appsettings.json`. FE: section "Gửi email kiểm tra" trong
`AttendanceSettingPanel.tsx` (tab Cấu hình), i18n `Attendance.AttendanceSetting.testEmail*` đủ vi/ja.


## 2. Wiring Host — đã xong
1. `Configurations/DependencyInjection.cs`: `AddDbContext<AttendanceDbContext>` với `OTManagementConnection`.
2. `Program.cs`: `AddControllers().AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)`.
3. `Attendance.Api.csproj`: thêm `ProjectReference` tới `Attendance.Application` (cần cho DTO/Interface Service).
4. Scrutor tự động đăng ký toàn bộ `*Repository`/`*UnitOfWork`/`*Service` trong assembly `Attendance.*` (không cần khai báo `AddScoped` thủ công).

## 3. Còn nợ / cố ý chưa làm (cập nhật 2026-09-10)

> Mục này thay cho 2 mục cũ "Đã smoke-test (2026-07-14)" + "Còn thiếu / bước tiếp theo" — cả hai đã lỗi
> thời (còn nhắc `UserApprovalScope` đã xoá 2026-08-08, "FE chưa có" trong khi FE đã chạy production).

**Cố ý chưa làm — chờ yêu cầu, đừng tự triển khai:**
- **Cột `KHOI SU`** trong file mẫu Chế Tạo: export để trống, import bỏ qua (xem §Import/Export nhân sự
  dưới chuyền).
- **Import hàng loạt số giờ giới hạn OT riêng theo từng nhân viên** — "quyết định sau" (xem §Giới hạn
  OT/tháng/năm RIÊNG theo từng nhân viên).
- **Backfill lũy kế lịch sử từ hệ thống cũ** vào `EmployeeAccumulationHistories` — việc riêng, không nằm
  trong luồng import nhân sự.
- **Báo cáo thứ 4 trở đi** (mục 9 trong danh sách báo cáo gốc).
- **Làm đẹp giao diện đợt 2** cho phần CRUD danh mục/phạm vi duyệt/chữ ký/mật khẩu cấp 2.

**Việc vận hành khi dựng server production:** import cert self-signed của `VNMAIL04` vào
`Cert:\LocalMachine\Root` trên chính server đó (hoặc nhờ IT đẩy qua GPO domain `yev.vn`) — nếu không,
SMTP sẽ fail TLS. SMTP đã verify gửi được từ máy dev (2026-07-17).
