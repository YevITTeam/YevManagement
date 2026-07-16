# attendance-module.md — Module Attendance (Chấm công / Giấy tăng ca)

> **ĐÃ CÓ CODE** — Domain + DbContext + Migrations + Repository/UnitOfWork + DTO + Service + Controller
> đầy đủ cho tính năng đầu tiên: **Giấy tăng ca (OT Form)** với luồng duyệt nhiều cấp + phân quyền
> theo phạm vi tổ chức + chữ ký. Build sạch, đã smoke-test host khởi động OK (2026-07-14).
>
> **FE triển khai đọc [attendance-api-fe.md](attendance-api-fe.md)** — hợp đồng API đầy đủ (request/response
> mẫu, enum, checklist màn hình). File này (`attendance-module.md`) là tài liệu **cho dev BE**: lý do thiết kế,
> migration, cấu trúc code nội bộ.

## 0. Chốt yêu cầu (CLAUDE.md §4.2)

### §Entity (`Attendance.Domain/Entities/`)

Danh mục (master data, đều có `IsDeleted`):
| Entity | Thuộc tính chính | Song ngữ (Vn/Jp)? |
|---|---|---|
| `Department` | `DepartmentCode`(unique), `DepartmentNameVn`, `DepartmentNameJp?` | Có — **entity mới** (ERD gốc không vẽ bảng Department dù OT FORM có `DepartmentId`). Tạo riêng cho Attendance, KHÔNG dùng `Asset.DeviceDepartment` (khác DB, khác ngữ cảnh nghiệp vụ). |
| `Group` | `GroupCode`(unique), `GroupNameVn`, `GroupNameJp?`, `DepartmentId`(FK, **1 Department - N Group**, theo pattern `Asset.Domain.Entities.DeviceGroup.DepartmentId`) | Có |
| `Reason` | `ReasonNameVn`, `ReasonNameJp?` | Có |
| `OtCase` | `Code`(unique), `Description?`, `RequireSignature:bool`, `RequiredApprovalLevel:int` (enum `ApprovalLevel` — cấp CUỐI phải đạt) | Không |
| `Employee` | `Code`(unique), `FirstName`, `LastName`, `UserName:string?`(unique filtered — tài khoản AD của chính nhân viên, nullable), `MonthToDate:decimal(10,2)`, `YearToDate:decimal(10,2)`, `AccumulationYear:int`, `AccumulationMonth:int`, `GroupId`(FK, **BẮT BUỘC**) | Tên riêng — không dịch. Department suy ra qua `Group.DepartmentId`, không lưu trùng trên Employee. |

> **Đã bỏ `Area`/`Line`** (2026-07-14): OT Form không cần "tên công đoạn" ở cấp Area/Line. Xoá hẳn (migration `RemoveAreaLineFromOtFormAddGroupDepartment`), không giữ bảng mồ côi.
>
> **Đã bỏ `Employee.DepartmentId`, `GroupId` thành bắt buộc** (2026-07-14, migration `MakeEmployeeGroupRequiredRemoveDepartment`): Department suy ra qua `Group.DepartmentId`, tránh 2 nguồn dữ liệu lệch nhau.
>
> **Đã đổi `UserId:int` → `UserName:string`** trên `OtForm.CreatedByUserName`, `OtFormApprovalHistory.ApproverUserName`, `UserApprovalScope.UserName`, `UserSignature.UserName` (2026-07-14, migration `RenameUserIdToUserName`): JWT không có claim UserId dạng số, chỉ có `UserName` (`User.Identity.Name` — claim `ClaimTypes.Name` do `MyClaimsTransformation` nạp). Theo đúng convention `Asset.Domain.Models.AuditTrail.ChangedBy` (string) đã có sẵn trong codebase.
>
> **Thêm `Employee.UserName`, `AccumulationYear`, `AccumulationMonth`; `OtForm.CreatedByFullName`** (2026-07-16, migration `AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName`):
> - `Employee.UserName` (nullable, unique filtered index `WHERE UserName IS NOT NULL`) — map nhân viên với tài khoản AD của chính họ, dùng cho tự chỉnh lũy kế (xem §Business Logic — Điều chỉnh lũy kế thủ công).
> - `Employee.AccumulationYear`/`AccumulationMonth` — tháng/năm mà `MonthToDate`/`YearToDate` đang phản ánh, dùng để tự động rollover về 0 khi có đơn Completed rơi vào tháng/năm mới (xem `OtFormService.AccumulateEmployeeHoursAsync`). Data migration set 2 cột này = tháng/năm hiện tại cho toàn bộ nhân viên có sẵn (tránh mất lũy kế đã nhập tay trước đó).
> - `OtForm.CreatedByFullName` (nullable) — snapshot claim `FullName` lúc tạo đơn, cùng pattern với `OtFormApprovalHistory.ApproverFullName`, để mọi nơi hiển thị (list `my-forms`/`pending-approvals`, chi tiết đơn) luôn ra được **tên người dùng** thay vì `UserName` thô (yêu cầu 2026-07-16: "dữ liệu hiển thị lúc nào cũng phải là tên người dùng").

Nghiệp vụ OT Form:
| Entity | Thuộc tính chính | Quan hệ | Ghi chú |
|---|---|---|---|
| `OtForm` | `GroupId/DepartmentId/ReasonId/OtCaseId` (FK, Restrict), `StartTime/EndTime:TimeOnly`, `SubReason?`, `TotalHour:decimal(10,2)`, `Date:DateOnly`, `NumberOfEmployee`, `CreatedByUserName:string`, `CreatedByFullName:string?`, `Status:int` (enum `OtFormStatus`, **có thêm `Draft=5`**, xem §Business Logic — Người tạo đơn ≠ Trưởng nhóm), `IsDeleted` | N-1 tới 4 danh mục trên; 1-N `OtFormEmployee`; 1-1 `ProcessPart`; 1-N `OtFormApprovalHistory` | |
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. `StartTime` LUÔN bằng `OtForm.StartTime` (server tự set, không nhận từ FE); `EndTime` do người lập đơn tự điều chỉnh riêng cho từng người nhưng phải `> StartTime` và `<= OtForm.EndTime` (giờ khai báo ở đầu form là **giờ kết thúc tối đa**) — validate ở `OtFormService.ValidateEmployeesAsync`. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `MainTicketCount/SecondaryTicketCount/MilkCount:int`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn. `MainTicketCount`/`SecondaryTicketCount`/`MilkCount` (phiếu chính/phiếu phụ/sữa, 2026-07-16, migration `AddMealTicketCountsToProcessPart`) — số lượng từng loại phiếu ăn **chung cho cả đơn** (không phải theo từng nhân viên), người lập đơn (Trưởng Group) tự nhập tay khi `IsEat = true`; BE không tự tính từ danh sách nhân viên hay từ `OtFormEmployeeDto.IsEligibleForMeal`. |
| `UserApprovalScope` | `UserName:string`, `ScopeType:int` (enum, `Group/Department`), `ScopeId:int`, `ApprovalLevel:int` (enum `DepartmentManager/WorkshopManager`), `IsDeleted` | Không FK thật (ScopeId đa hình theo ScopeType) | Ánh xạ 1 User (Trưởng phòng/Trưởng xưởng) phụ trách duyệt phạm vi nào. Tổng Giám Đốc KHÔNG cần dòng ở đây — bypass scope (check Role claim). |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserName:string`, `ApproverFullName:string?`, `ApprovalLevel:int`, `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm | Audit trail từng cấp duyệt; `SignatureImage`/`ApproverFullName` là snapshot tại thời điểm ký (không tham chiếu ngược Identity). |
| `UserSignature` | `UserName:string`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit (nguồn thật = `OtFormApprovalHistory.SignatureImage`). |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (Pending=0/ApprovedByDepartment=1/ApprovedByWorkshop=2/Completed=3/Rejected=4/**Draft=5**, giá trị `Draft` cố tình gán số 5 — thêm cuối cùng thay vì chèn lên đầu để không đổi int của các trạng thái cũ đã lưu DB), `ApprovalLevel` (Submitter/DepartmentManager/WorkshopManager/GeneralDirector), `ApprovalAction` (Submitted/Approved/Rejected), `ScopeType` (Group/Department). Lưu dưới dạng `int` trên entity, không dùng `HasConversion`.

### §Business Logic (đã code trong `OtFormService`)
Chốt theo phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam):

#### §Người tạo đơn KHÁC Trưởng nhóm — luồng Draft → ký duyệt (2026-07-16)
Yêu cầu thực tế chốt lại: **người tạo đơn chỉ chịu trách nhiệm nhập liệu**, còn **chữ ký "Người đề nghị" bắt buộc phải là chữ ký thật của Trưởng nhóm** — 2 việc này trước đây bị gộp làm 1 (ai gọi API tạo đơn thì chữ ký của chính người đó được dùng luôn, sai nếu người tạo không phải Trưởng nhóm). Sửa lại thành 2 bước tách biệt:
- **Bước 1 — Tạo Draft**: `POST /api/OtForm` (`OtFormService.CreateAsync`) chỉ insert `OtForm` (`Status = Draft`) + `OtFormEmployee` + `ProcessPart`, **KHÔNG** tạo `OtFormApprovalHistory`, không cần `UserSignature`. Điều kiện tạo giữ nguyên như trước (`UserApprovalScope(ApprovalLevel=Submitter)` khớp Group/Department, trừ Admin) — nhờ vậy người gọi `CreateAsync` chắc chắn nằm trong danh sách được phép ký duyệt Group đó (xem quy tắc gán scope bên dưới), dù hành động tạo tự nó chưa tính là ký.
- **Bước 2 — Trưởng nhóm ký duyệt**: `POST /api/OtForm/{id}/submit` (`OtFormService.ApproveSubmitterAsync`, permission `Attendance.OTForm.Create`) — chỉ chạy được khi `Status == Draft`; validate lại đúng `UserApprovalScope(Submitter)` của **người gọi action này** (có thể là người khác với người tạo, miễn cùng được gán scope cho Group/Department đó), lấy `UserSignature` của người gọi (bắt buộc phải đã đăng ký), insert `OtFormApprovalHistory(ApprovalLevel=Submitter, Action=Submitted, SignatureImage=...)`, chuyển `Status → Pending`. Từ đây luồng y hệt như cũ (chờ Trưởng phòng).
- **Quy tắc gán `UserApprovalScope(ApprovalLevel=Submitter)` bị xiết lại** (`UserApprovalScopeService.CreateAsync`): Admin chỉ gán được cho `UserName` **đang giữ Role `"Trưởng Group"`** — ném `DomainException` nếu không, chặn ngay từ gốc dữ liệu (không phải chặn ở lúc tạo/ký đơn). Nhờ vậy, dù nhiều người trong 1 Group cùng được cấp quyền tạo/ký (đúng thiết kế cũ — "Trưởng Group chính + phó nhóm dự phòng"), **tất cả** đều đảm bảo đang mang Role Trưởng Group, không lọt người ngoài.
- **Sửa đơn khi đang Draft hoặc Pending**: `IsEditable` (và điều kiện chặn ở `UpdateAsync`) mở rộng từ chỉ `Pending` thành `Draft || Pending` — người tạo được sửa xuyên suốt tới khi Trưởng phòng duyệt, không riêng gì lúc còn Draft (khớp yêu cầu "chỉ có quyền tạo đơn và sửa trước khi được Trưởng phòng duyệt").
- **Không có "Reject" ở cấp Draft** (cố tình, tránh phình luồng ngoài yêu cầu) — nếu Trưởng nhóm không đồng ý nội dung do người tạo nhập, chỉ cần chưa gọi `/submit`; người tạo (hoặc chính Trưởng nhóm, nếu cũng là người tạo) sửa lại qua `PUT /{id}` rồi ký sau. Gọi `/reject` (dùng cho cấp Trưởng phòng/Trưởng xưởng/TGĐ) trên đơn đang Draft sẽ bị chặn với thông báo rõ ràng ("Đơn đang ở trạng thái nháp...").
- **Email thông báo** (`NotifyEligibleApproversAsync`) dịch theo đúng 2 bước: sau `CreateAsync` gửi cho người đủ quyền ký cấp `Submitter` (Trưởng nhóm); sau `ApproveSubmitterAsync` mới gửi tiếp cho cấp `DepartmentManager` như luồng cũ. `ApproveByEmailTokenAsync` tự dispatch: token cấp `Submitter` gọi `ApproveSubmitterAsync`, các cấp khác gọi `ApproveAsync` như trước — `RejectByEmailTokenAsync` cho token cấp `Submitter` sẽ lỗi có chủ đích (đúng lý do "không có Reject ở Draft" ở trên).
- **Endpoint xem danh sách chờ ký RIÊNG với xem danh sách chờ duyệt**: Role "Trưởng Group" chỉ có permission `Attendance.OTForm.Create` (không có `.Approve`), nên KHÔNG thể gọi `GET /pending-approvals` (gate bằng `.Approve`). Đơn `Draft` chờ Trưởng nhóm ký được trả riêng qua `GET /api/OtForm/pending-submissions` (gate bằng `.Create`, `OtFormService.GetPendingSubmissionsAsync`) — cùng logic lọc theo `UserApprovalScope(Submitter)` nhưng là 1 method/route độc lập, không gộp vào `GetPendingApprovalsAsync`.

Phần dưới đây (duyệt cấp Trưởng phòng → Trưởng xưởng → TGĐ) **giữ nguyên không đổi** so với thiết kế gốc:
- Luồng duyệt **tuần tự**: `DepartmentManager` (Trưởng phòng) → `WorkshopManager` (Trưởng xưởng) → `GeneralDirector` (Tổng Giám Đốc), dừng ở cấp = `OtCase.RequiredApprovalLevel`:
  - TH1 (ngày thường) → `RequiredApprovalLevel = DepartmentManager`.
  - TH2 (ngày nghỉ/CN/lễ) → `RequiredApprovalLevel = WorkshopManager`.
  - TH3 (lũy kế > 25h/tháng hoặc > 300h/năm) → `RequiredApprovalLevel = GeneralDirector`.
- Phân quyền 2 lớp: **Permission** (`Attendance.OTForm.Approve` gate hành động) + **`UserApprovalScope`** (gate dữ liệu — khớp `ScopeType/ScopeId` với `OtForm.DepartmentId`/`GroupId` VÀ đúng `ApprovalLevel` đang chờ). `GeneralDirector` bypass scope, chỉ cần `User.IsInRole("Tổng Giám Đốc")`.
- Ký tên các cấp duyệt: nếu `OtCase.RequireSignature = true` thì người duyệt **phải đã đăng ký chữ ký** qua `UserSignature` (validate trong `OtFormService.ApproveAsync`, ném `DomainException` nếu chưa đăng ký).
- **Chữ ký không còn nhận qua request body** (2026-07-16, bỏ `CreateOtFormDto.SubmitterSignatureImage` và `ApproveOtFormDto.SignatureImage`) — lý do đặt ra: nếu người trưởng nhóm/trưởng phòng thay đổi (nghỉ việc, bàn giao), FE không còn phải tự quản lý gửi đúng ảnh chữ ký mỗi lần ký; BE tự `_unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == <người đang gọi API>)` lấy chữ ký **đã đăng ký sẵn** của đúng người đang thao tác (Submitter lúc `CreateAsync`, Approver lúc `ApproveAsync`) rồi snapshot vào `OtFormApprovalHistory.SignatureImage`. Toàn vẹn dữ liệu vẫn được giữ đúng như trước: bản ghi lịch sử duyệt luôn là **snapshot đóng băng tại đúng thời điểm ký** (không tham chiếu ngược `UserSignature`), nên nếu sau này người đó đổi chữ ký mới, hoặc bị thay thế bởi người khác giữ chức vụ, các đơn cũ vẫn hiển thị đúng chữ ký + tên người đã ký tại thời điểm đó.
- **Mục đích chữ ký = ảnh stamp lên PDF khi in, không phải chữ ký số/PKI** (đã chốt 2026-07-15) — FE tự dựng file PDF từ JSON do BE cung cấp (`GET /api/OtForm/{id}` đã đủ dữ liệu: thông tin đơn, danh sách nhân viên, ProcessPart, `ApprovalHistories` kèm `SignatureImage`+`ApproverFullName` từng cấp). BE không cần thêm thư viện PDF nào.
- **`OtFormApprovalHistory.ApproverFullName`** (2026-07-15, migration `AddApproverFullNameToOtFormApprovalHistory`): snapshot claim JWT `"FullName"` (đọc qua `BaseController.CurrentFullName`, nạp từ `Identity.User.FullName` — tự resolve từ AD `DisplayName` lúc user đăng nhập lần đầu, xem `MyClaimsTransformation.GetActualFullName`) tại đúng thời điểm Submit/Approve/Reject. Lý do snapshot thay vì để FE gọi chéo API Identity: (1) không phụ thuộc module khác lúc render PDF, (2) giữ đúng tên tại thời điểm ký kể cả khi tài khoản đổi tên sau này. `null` nếu tài khoản chưa từng có `FullName` trong Identity — FE fallback hiển thị `ApproverUserName`.
- `Employee.GroupId` (bắt buộc) — người tạo đơn chỉ được chọn nhân viên **cùng `GroupId`** với đơn (`OtFormService.CreateAsync` validate, ném `DomainException` nếu lệch nhóm).
- **Phân quyền tạo đơn theo phạm vi Group/Department — nhiều người/1 Group** (2026-07-16): trước đây bất kỳ ai có permission `Attendance.OTForm.Create` (Role "Trưởng Group") đều tạo được đơn cho **bất kỳ** `GroupId`/`DepartmentId` nào — không đúng thực tế 1 Group có thể có nhiều người thay phiên tạo đơn (Trưởng Group chính + phó nhóm dự phòng). Sửa: `OtFormService.CreateAsync` giờ check thêm **`UserApprovalScope` với `ApprovalLevel=Submitter`** (tái dùng y hệt bảng/enum đang dùng cho cấp duyệt, không tạo entity mới) — người gọi API phải có ít nhất 1 dòng `UserApprovalScope(UserName=<người gọi>, ApprovalLevel=Submitter, ScopeType=Group, ScopeId=<request.GroupId>)` hoặc `(ScopeType=Department, ScopeId=<request.DepartmentId>)`, nếu không → `DomainException`. Admin (`User.IsInRole("Admin")`) bypass hoàn toàn, giống cách `GeneralDirector` bypass lúc duyệt.
  - Cách gán: Admin gọi `POST /api/UserApprovalScope` với `ApprovalLevel=0 (Submitter)` cho **từng người** được phép tạo/ký đơn của Group đó — có thể gán nhiều `UserName` cùng `ScopeId` (1 Group nhiều người tạo/ký đơn), hoặc gán `ScopeType=Department` để 1 người được cho **mọi Group** trong Department đó. **Từ 2026-07-16**: `UserApprovalScopeService.CreateAsync` chặn gán `ApprovalLevel=Submitter` cho `UserName` chưa giữ Role `"Trưởng Group"` (ném `DomainException`) — xem §Người tạo đơn KHÁC Trưởng nhóm.
  - Role `Attendance.OTForm.Create` (Trưởng Group) vẫn là điều kiện CẦN (gate hành động); `UserApprovalScope(Submitter)` là điều kiện ĐỦ (gate đúng Group/Department nào) — giống hệt mô hình 2 lớp Permission+Scope đang dùng cho `OTForm.Approve`.
- Reject: ở bất kỳ cấp nào, `RejectOtFormDto.Comment` bắt buộc, **không có `SignatureImage`** (từ chối chỉ ghi lý do, không ký) — `OtFormApprovalHistory.SignatureImage` luôn `null` cho dòng `Action=Rejected`. `Status → Rejected`, dừng luồng.

### §Sửa đơn khi đang Draft/Pending (2026-07-16, mở rộng phạm vi cùng ngày với luồng Draft)
- `PUT /api/OtForm/{id}` (`OtFormService.UpdateAsync`) cho sửa **toàn bộ** đơn (danh mục + danh sách nhân viên + `ProcessPart`), điều kiện **cả hai**:
  1. Chỉ **chính người tạo** (`OtForm.CreatedByUserName == CurrentUserName`) mới sửa được — không phải Admin, không phải Trưởng nhóm (trừ khi Trưởng nhóm đó cũng chính là người tạo), không phải cấp duyệt nào khác.
  2. Chỉ khi `Status` là `Draft` hoặc `Pending` (**chưa tới cấp Trưởng phòng duyệt**) — qua cấp Trưởng phòng trở lên là khóa cứng, ném `DomainException`. Đây chính là câu trả lời cho yêu cầu "người tạo đơn chỉ có quyền tạo đơn và sửa trước khi được Trưởng phòng duyệt".
- Validate lại y hệt `CreateAsync`: danh mục tồn tại, nhân viên cùng nhóm, giờ kết thúc từng nhân viên hợp lệ (`ValidateEmployeesAsync` dùng chung).
- Danh sách nhân viên được **diff** thay vì xóa hết tạo lại (tránh đụng khóa kép `(OtFormId, EmployeeId)` khi 1 nhân viên vẫn còn trong danh sách mới): nhân viên bị bỏ khỏi request → xóa; còn giữ lại → update tại chỗ (`EndTime`/`Note`); nhân viên mới → thêm.
- `OtFormDto.IsEditable` / `OtFormListItemDto.IsEditable` = `Status == Draft || Status == Pending` (helper `OtFormService.IsEditableStatus`) — FE dùng field này để hiện/ẩn nút "Sửa", không cần tự so sánh status.

### §Lũy kế tháng/năm — cộng khi Completed, rollover tự động, chỉnh thủ công (2026-07-16)
- **Thời điểm cộng**: CHỈ khi đơn đạt `Completed` (đi hết luồng duyệt theo `otCase.requiredApprovalLevel`) — `OtFormService.ApproveAsync` gọi `AccumulateEmployeeHoursAsync` ngay sau khi xác định `nextStatus == Completed`, trong cùng `SaveChangesAsync`. Đơn `Rejected` hoặc dừng ở cấp trung gian thì KHÔNG cộng gì — tránh phải rollback nếu đơn bị từ chối giữa chừng.
- **Số giờ cộng** = `OtFormEmployee.EndTime - OtFormEmployee.StartTime` (giờ OT thực tế đã đăng ký của từng người trong đơn đó), cộng vào cả `MonthToDate` và `YearToDate` của `Employee` tương ứng.
- **Rollover tự động theo `OtForm.Date`**: so `Date.Year`/`Date.Month` của đơn với `Employee.AccumulationYear`/`AccumulationMonth` hiện tại — khác năm thì reset cả `YearToDate` và `MonthToDate` về 0 trước khi cộng; cùng năm nhưng khác tháng thì chỉ reset `MonthToDate`. Sau đó luôn stamp lại `AccumulationYear`/`AccumulationMonth` = năm/tháng của đơn.
- **Điều chỉnh lũy kế thủ công**: `PATCH /api/Employee/{id}/adjust-accumulation` (`AdjustEmployeeAccumulationDto { MonthToDate, YearToDate }`) — vì không phải ai cũng làm đúng giờ OT đã đăng ký trong form. Không gắn `[RequirePermission]` (chỉ cần đăng nhập, theo `FallbackPolicy`); `EmployeeService.AdjustAccumulationAsync` tự phân quyền:
  - Chính nhân viên (`Employee.UserName == CurrentUserName`) luôn chỉnh được lũy kế của chính mình.
  - Người có quyền `Attendance.Employee.Update` (Admin) chỉnh được cho bất kỳ nhân viên nào.
  - Mỗi lần chỉnh đều stamp `AccumulationYear`/`AccumulationMonth` = năm/tháng hiện tại (coi giá trị mới là "đúng tại thời điểm chỉnh"), để lần cộng lũy kế tiếp theo trong cùng tháng không bị rollover đè mất.
  - Nhân viên chưa được gán `UserName` (đa số dữ liệu hiện có) thì chưa tự chỉnh được — cần Admin gán qua `PUT /api/Employee/{id}` trước.

### §Phiếu ăn — ngưỡng giờ OT (2026-07-16)
- Nhân viên đủ điều kiện phiếu ăn khi giờ OT thực tế **lớn hơn 2 giờ** (`(EndTime - StartTime) > 2h`, không tính bằng). Đây là field **tính toán khi đọc** (`OtFormEmployeeDto.IsEligibleForMeal`), KHÔNG lưu DB — không nhầm với `ProcessPart.IsEat` (cờ "có phục vụ ăn" ở cấp cả đơn, do người lập đơn tick tay). FE tick chọn `ProcessPart.IsEat` dựa gợi ý từ `IsEligibleForMeal` của từng người, BE không tự set.
- **Số lượng phiếu ăn theo loại** (2026-07-16, migration `AddMealTicketCountsToProcessPart`): khi `IsEat = true`, người lập đơn nhập thêm 3 số lượng — `MainTicketCount` (phiếu chính), `SecondaryTicketCount` (phiếu phụ), `MilkCount` (sữa). Cả 3 đều **chung cho cả đơn** (không phải per-employee), nhập tay tự do — BE không validate tổng 3 số này phải khớp `NumberOfEmployee` hay `IsEligibleForMeal`, không tự tính.

### §Xác thực qua email — cập nhật chữ ký & duyệt đơn (2026-07-16)
Bổ sung 1 kênh xác nhận qua email (nút bấm mở trang xác nhận nhỏ) cho 2 hành động nhạy cảm — **không thay thế** luồng trong app, chỉ là kênh phụ vì cấp quản lý ít khi mở app:

- **Cập nhật chữ ký** (`UserSignatureService`): `PUT /api/UserSignature/me` **không còn áp dụng ngay** — tạo 1 dòng `PendingSignatureConfirmation` (Token, ExpiresAt = +30 phút, ConfirmedAt) rồi gửi email cho **chính người gọi** (chống chiếm phiên đăng nhập đổi chữ ký hộ). `GET/POST /api/UserSignature/confirm/{token}` (`[AllowAnonymous]`) — GET trả preview, POST áp dụng thật (gọi lại đúng logic upsert cũ) + set `ConfirmedAt` (chống dùng lại token).
- **Duyệt/Từ chối đơn qua email** (`OtFormService`): sau `CreateAsync` (cần DepartmentManager) và sau `ApproveAsync` khi còn cấp kế tiếp (`ApprovedByDepartment`→cần WorkshopManager, `ApprovedByWorkshop`→cần GeneralDirector), hàm `NotifyEligibleApproversAsync` tự tra người đủ quyền ở đúng cấp đó (qua `UserApprovalScope` như `GetPendingApprovalsAsync`, hoặc qua Role `"Tổng Giám Đốc"` nếu là GeneralDirector — không có UserApprovalScope) rồi tạo 1 `OtFormApprovalEmailToken` + gửi mail **cho từng người** (1 đơn có thể có nhiều người cùng phạm vi → nhiều token, nhiều mail). `GET /api/OtForm/email-confirm/{token}` (preview), `POST .../approve`, `POST .../reject` (`[AllowAnonymous]`) — cả 2 action đều gọi thẳng `ApproveAsync`/`RejectAsync` **đã có sẵn** (không viết logic duyệt mới), nên tự động thừa hưởng mọi validate cũ (đơn đã xử lý xong thì tự chặn — token cũ tự nhiên vô hiệu, không cần logic hủy token anh em thủ công) + tự cascade gửi mail tiếp cho cấp sau nếu còn.
- **Bề mặt `[AllowAnonymous]` đầu tiên và thứ 2 của toàn hệ thống** (trước đó không controller nào dùng, chỉ 2 dòng dev-only cho Scalar/OpenAPI) — bảo mật hoàn toàn dựa vào token ngẫu nhiên 256-bit (`Shared.Application.Helper.TokenHelper.GenerateSecureToken`), không dựa JWT/Permission. Token single-use (`ConfirmedAt`/`UsedAt`) + có hạn (`ExpiresAt`) — không cần logic thu hồi thủ công vì `LoadFormAndValidateAuthorityAsync`/status check tự nhiên chặn token cũ.
- **Cross-module không qua HTTP**: `Shared.Application.Interfaces.IUserDirectoryService`/`IEmailService` là contract đặt ở `Shared.Application` (2 module đều đã reference sẵn); implementation thật (`Identity.Application.Services.UserDirectoryService`, `Shared.Infrastructure.Services.EmailService`) được Scrutor tự nối dây lúc runtime — `Attendance.Application` **không cần** ProjectReference tới `Identity.Application` dù cần đọc Email/FullName/Role của User (nằm DB khác).
- **`Identity.User.Email`** (migration `AddEmailToUser`, DB `YevIdentityManagement`): tự resolve từ thuộc tính AD `mail` qua `MyClaimsTransformation.GetActualEmail` (dùng `UserPrincipal.EmailAddress`, cùng cơ chế `GetActualFullName`) — **chỉ set khi đang trống** (khác `DeviceName` vốn refresh mỗi lần đổi), tự "chữa lành" cho user cũ ở lần đăng nhập kế tiếp mà không cần Admin gán tay.
- **Cần cấu hình SMTP thật trước khi gửi mail thật hoạt động** — `CompanySystem.HostApi/appsettings.json` mục `EmailSettings` (SmtpHost/Port/Username/Password/FromAddress) hiện để trống placeholder; `EmailService.SendAsync` tự bắt lỗi SMTP, trả `false`, KHÔNG throw — thiếu cấu hình không làm hỏng nghiệp vụ chính (tạo đơn/duyệt đơn/cập nhật chữ ký vẫn thành công, chỉ không gửi được mail thông báo).
- `AppSettings:FrontendBaseUrl` — domain FE dùng để build link trong email (`{FrontendBaseUrl}/xac-nhan-chu-ky?token=...`, `{FrontendBaseUrl}/xac-nhan-don?token=...`); **trang xác nhận do FE tự xây** (2 route public, gọi 2 cặp API preview+action ở trên), BE không server-render HTML.
- Đã verify qua HTTP thật (2026-07-16): `PUT /me` tạo pending đúng, không áp dụng ngay; `GET/POST /confirm/{token}` preview + áp dụng đúng; gọi lại token đã dùng bị chặn (chống replay). Luồng `OtFormApprovalEmailToken` dùng lại nguyên `ApproveAsync`/`RejectAsync` đã test kỹ ở các tính năng trước nên chưa test riêng end-to-end.

### §DB
- DB: `YevOTManagement` (server `DASVRFAST`, conn `OTManagementConnection`). DbContext: `AttendanceDbContext`.
- Migrations theo thứ tự: `InitAttendance` → `AddOtCaseApprovalLevelAndEmployeeScope` → `RemoveAreaLineFromOtFormAddGroupDepartment` → `MakeEmployeeGroupRequiredRemoveDepartment` → `RenameUserIdToUserName` → `AddApproverFullNameToOtFormApprovalHistory` → `AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName` → `AddMealTicketCountsToProcessPart` → `AddEmailConfirmationTables`. Tất cả đã `database update` vào `YevOTManagement`.
- Do nhiều DbContext trong solution, mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`. Riêng migration `AddEmailToUser` (thêm `Users.Email`) nằm ở DB **Identity** (`Indentity.Infrastructure`, `--context IdentityDbContext`), không phải Attendance.

## 1. Cấu trúc code đã có

### Danh mục CRUD chuẩn (Department/Group/Reason/OtCase/Employee)
Mỗi entity có đủ: `I{Entity}Repository` (Application/Interfaces/Repository) + impl (Infrastructure/Repositories) → property trong `IAttendanceUnitOfWork`/`AttendanceUnitOfWork` → `{Entity}Dto`/`Create{Entity}Dto`/`Update{Entity}Dto` (Application/Dtos) → `{Entity}Service : BaseService<IAttendanceUnitOfWork>` → `{Entity}Controller : BaseController` (route `grid-list`/`all`/`{id}`/POST/PUT/DELETE, `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- `GroupController` có thêm `GET /by-department/{departmentId}` (dropdown phụ thuộc).
- `EmployeeController` có thêm `GET /by-group/{groupId}` (Trưởng Group chọn hàng loạt nhân viên).

### UserApprovalScope (`UserApprovalScopeController`)
- `GET /grid-list`, `GET /by-user/{userName}`, `POST` (validate `ScopeId` tồn tại đúng bảng theo `ScopeType`, chặn trùng), `DELETE /{id}` (soft-delete). Không có `PUT` — sửa = xoá + tạo lại.

### UserSignature (`UserSignatureController`)
- `GET /me`, `PUT /me` (yêu cầu cập nhật chữ ký **của chính mình** — không áp dụng ngay, gửi email xác nhận, `[RequirePermission("Attendance.UserSignature.Update")]`).
- `GET /{userName}` (admin xem chữ ký người khác, `Attendance.UserSignature.View`).
- `GET/POST /confirm/{token}` (`[AllowAnonymous]`) — xác nhận qua email, xem §Xác thực qua email.

### OtForm (`OtFormController`) — nghiệp vụ chính
- `POST /api/OtForm` — tạo đơn ở trạng thái **Draft** (`Attendance.OTForm.Create`), CHƯA ký "Người đề nghị" (xem §Người tạo đơn KHÁC Trưởng nhóm).
- `POST /api/OtForm/{id}/submit` — **Trưởng nhóm ký duyệt** "Người đề nghị", chuyển `Draft → Pending` (`Attendance.OTForm.Create`, validate `UserApprovalScope(Submitter)` của người gọi + `UserSignature`).
- `GET /api/OtForm/my-forms` — đơn do chính mình tạo (`Attendance.OTForm.View`).
- `GET /api/OtForm/pending-submissions` — đơn `Draft` đang chờ chính mình (Trưởng nhóm) ký duyệt, tự lọc theo `UserApprovalScope(Submitter)` (`Attendance.OTForm.Create` — KHÔNG dùng `.Approve` vì Role "Trưởng Group" không có permission này).
- `GET /api/OtForm/pending-approvals` — đơn đang chờ chính mình duyệt (cấp Trưởng phòng/Trưởng xưởng/TGĐ, KHÔNG bao gồm Draft), tự lọc theo `UserApprovalScope` hoặc bypass nếu `Role="Tổng Giám Đốc"` (`Attendance.OTForm.Approve`).
- `GET /api/OtForm/{id}` — chi tiết đầy đủ (Employees kèm lũy kế + phiếu ăn, ProcessPart, ApprovalHistories).
- `PUT /api/OtForm/{id}` — sửa toàn bộ đơn, chỉ chính người tạo và chỉ khi `Status` là `Draft` hoặc `Pending` (`Attendance.OTForm.Create`, xem §Sửa đơn khi đang Draft/Pending).
- `POST /api/OtForm/{id}/approve`, `POST /api/OtForm/{id}/reject` (`Attendance.OTForm.Approve`, chỉ áp dụng cấp Trưởng phòng/Trưởng xưởng/TGĐ — gọi trên đơn `Draft` sẽ báo lỗi rõ ràng, dùng `/submit` thay thế). `approve` tự cộng lũy kế nhân viên nếu đạt `Completed`, tự gửi email cho cấp duyệt kế tiếp nếu còn.
- `GET /email-confirm/{token}`, `POST /email-confirm/{token}/approve`, `POST /email-confirm/{token}/reject` (`[AllowAnonymous]`) — kênh bổ sung qua email, xem §Xác thực qua email.
- `BaseController.CurrentUserName` (`Attendance.Api/Controllers/BaseController.cs`) — helper lấy `User.Identity.Name` dùng chung cho mọi Controller cần biết "ai đang gọi API".

### EmployeeImport (`EmployeeImportController`) — import Excel nhân sự (2026-07-16)
- `POST /preview` (nhận file `.xlsx`), `POST /confirm` — pattern Preview/Confirm giống `DeviceImportController` ở module Asset (ClosedXML). Upsert theo `Employee.Code` (unique) — mã đã có thì cập nhật `FirstName/LastName/GroupId`, mã chưa có thì tạo mới kèm tự tạo `Department`/`Group` nếu mã chưa tồn tại. Gắn `[RequirePermission("Attendance.Employee.Create")]`.

### Employee — thêm endpoint tự chỉnh lũy kế (2026-07-16)
- `PATCH /api/Employee/{id}/adjust-accumulation` (`AdjustEmployeeAccumulationDto`) — không gắn `[RequirePermission]`, chỉ cần đăng nhập; phân quyền tự trong Service (chính chủ `UserName` hoặc quyền `Attendance.Employee.Update`). Xem §Lũy kế tháng/năm.

### Permission & Role đã seed (Identity migration `AddAttendancePermissionsAndRoles`)
- 28 permission `Attendance.*`: CRUD 5 danh mục + `UserApprovalScope.{View,Create,Delete}` + `UserSignature.{View,Update}` + `OTForm.{View,Create,Approve}`.
- 4 Role mới: `Trưởng Group` (Create+View OTForm, View Employee, Update UserSignature), `Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc` (View+Approve OTForm, Update UserSignature). `Admin` được gán full toàn bộ permission `Attendance.*`.
- **Chưa làm**: gán Role cho user thật (`update-user-roles`/`create-user` — API Identity có sẵn) và tạo dòng `UserApprovalScope` cho từng Trưởng phòng/Trưởng xưởng **và mỗi người được phép tạo đơn** (`ApprovalLevel=Submitter`, xem §Business Logic — Phân quyền tạo đơn) thật (`POST /api/UserApprovalScope` — API đã có).

## 2. Wiring Host — đã xong
1. `Configurations/DependencyInjection.cs`: `AddDbContext<AttendanceDbContext>` với `OTManagementConnection`.
2. `Program.cs`: `AddControllers().AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)`.
3. `Attendance.Api.csproj`: thêm `ProjectReference` tới `Attendance.Application` (cần cho DTO/Interface Service).
4. Scrutor tự động đăng ký toàn bộ `*Repository`/`*UnitOfWork`/`*Service` trong assembly `Attendance.*` (không cần khai báo `AddScoped` thủ công).

## 3. Đã smoke-test (2026-07-14, kiểm lại 2026-07-16 sau khi thêm luồng Draft)
Build 0 lỗi. Host khởi động, `/openapi/v1.json` liệt kê đủ route `Department/Group/Reason/OtCase/Employee/OtForm/UserApprovalScope/UserSignature`, kể cả route mới `POST /api/OtForm/{id}/submit`. Gọi không token → 401 đúng như thiết kế (RequirePermission hoạt động). Chưa test bằng JWT thật với dữ liệu Group/UserApprovalScope thật (cần Admin seed trước — xem mục 4).

## 4. Còn thiếu / bước tiếp theo
- Gán Role thật cho user (Trưởng Group/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) + tạo dữ liệu `UserApprovalScope` thật — lưu ý từ 2026-07-16, gán `ApprovalLevel=Submitter` chỉ thành công nếu `UserName` đã có Role "Trưởng Group" từ trước.
- Chưa test end-to-end luồng Draft mới (`Create` → `submit` → `Update` khi còn Draft/Pending → `approve`/`reject`) với dữ liệu thật.
- Seed data mẫu: 3 `OtCase` (TH1/TH2/TH3 với `RequiredApprovalLevel` tương ứng), `Department`/`Group`/`Reason`/`Employee` thật.
- Gán `Employee.UserName` cho các nhân viên có tài khoản AD riêng (nếu muốn dùng tính năng tự chỉnh lũy kế) qua `PUT /api/Employee/{id}`.
- Validate end-to-end qua Scalar UI với JWT thật (chưa test luồng Create → Update → Approve → Reject với dữ liệu thật, cũng như luồng cộng lũy kế lúc Completed và rollover tháng/năm).
- **Cấu hình SMTP thật** (`appsettings.json` mục `EmailSettings`) — hiện để trống, gửi mail sẽ tự lặng lẽ thất bại (`EmailService.SendAsync` trả `false`, không throw) cho tới khi điền đúng host/port/tài khoản gửi nội bộ (Exchange/O365).
- **FE cần xây 2 trang xác nhận công khai** (`{FrontendBaseUrl}/xac-nhan-chu-ky`, `{FrontendBaseUrl}/xac-nhan-don`, đọc `?token=` trên URL) gọi các cặp API preview+action `[AllowAnonymous]` tương ứng — chưa có hợp đồng API riêng cho FE (`attendance-api-fe.md`) cho phần này, cần bổ sung khi FE bắt đầu code.
- Chưa test end-to-end luồng `OtFormApprovalEmailToken` với dữ liệu thật (chỉ mới verify luồng `PendingSignatureConfirmation`) — nên test khi có đơn thật đang chờ duyệt.
- Cân nhắc thêm `PUT` cho `UserApprovalScope` nếu cần sửa thay vì xoá-tạo-lại.
- Phân quyền theo Role (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc dùng chung permission `OTForm.View`+`Approve`) đã đủ để "tinh gọn giao diện" — 3 role này không thấy màn Tạo đơn/Sửa đơn/Danh mục; khác biệt giữa 3 role chỉ nằm ở dữ liệu trả về (`pending-approvals` tự lọc đúng cấp qua `UserApprovalScope`/Role), không cần thêm permission riêng cho từng role. Nếu sau này cần phân biệt sâu hơn (VD Trưởng phòng không được xem đơn của Trưởng xưởng phụ trách) thì mới cần thiết kế thêm.
- FE chưa có — hợp đồng API đã tài liệu hoá đầy đủ ở [attendance-api-fe.md](attendance-api-fe.md), đội FE có thể bắt đầu code song song trong lúc BE tiếp tục seed data thật.
