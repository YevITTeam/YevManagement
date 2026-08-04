# attendance-module.md — Module Attendance (Chấm công / Giấy tăng ca)

> **ĐÃ CÓ CODE** — Domain + DbContext + Migrations + Repository/UnitOfWork + DTO + Service + Controller
> đầy đủ cho tính năng đầu tiên: **Giấy tăng ca (OT Form)** với luồng duyệt nhiều cấp + phân quyền
> theo phạm vi tổ chức + chữ ký. Build sạch, đã smoke-test host khởi động OK (2026-07-14).
>
> **FE triển khai đọc [attendance-api-fe.md](attendance-api-fe.md)** — hợp đồng API đầy đủ (request/response
> mẫu, enum, checklist màn hình). File này (`attendance-module.md`) là tài liệu **cho dev BE**: lý do thiết kế,
> migration, cấu trúc code nội bộ.

## 0. Chốt yêu cầu (CLAUDE.md §2 luật 2)

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
| `OtFormEmployee` | khóa kép `(OtFormId, EmployeeId)`, `StartTime/EndTime:TimeOnly`, `NoteVn?`, `NoteJp?`, `IsRemoved:bool`, `RemovedByUserName?`, `RemovedByFullName?`, `RemovedAtLevel:int?`, `RemovedAt:DateTime?`, `RemoveReason?` | N-1 OtForm (Cascade), N-1 Employee (Restrict) | Giờ OT thực tế của từng nhân viên trong 1 đơn. `StartTime` LUÔN bằng `OtForm.StartTime` (server tự set, không nhận từ FE); `EndTime` do người lập đơn tự điều chỉnh riêng cho từng người nhưng phải `> StartTime` và `<= OtForm.EndTime` (giờ khai báo ở đầu form là **giờ kết thúc tối đa**) — validate ở `OtFormService.ValidateEmployeesAsync`. Các cột `Removed*` (2026-07-30) là **soft-remove** — người bị 1 cấp duyệt loại khỏi đơn (xem §Loại nhân viên khỏi đơn) KHÔNG bị xoá dòng, chỉ đánh dấu `IsRemoved=true` + snapshot ai/lúc nào/cấp nào/lý do gì, để giữ nguyên audit trail của 1 văn bản có tính pháp lý. |
| `ProcessPart` | `OtFormId`(FK unique, Cascade), `IsEat/IsTransportation/IsUseCopyRoom:bool`, `MainTicketCount/SecondaryTicketCount/MilkCount:int`, `AnotherSuggestionVn?`, `AnotherSuggestionJp?` | 1-1 OtForm | Chi tiết phát sinh riêng của từng đơn. `MainTicketCount`/`SecondaryTicketCount`/`MilkCount` (phiếu chính/phiếu phụ/sữa, 2026-07-16, migration `AddMealTicketCountsToProcessPart`) — số lượng từng loại phiếu ăn **chung cho cả đơn** (không phải theo từng nhân viên), người lập đơn (Trưởng nhóm) tự nhập tay khi `IsEat = true`; BE không tự tính từ danh sách nhân viên hay từ `OtFormEmployeeDto.IsEligibleForMeal`. |
| `UserApprovalScope` | `UserName:string`, `ScopeType:int` (enum, `Group/Department`), `ScopeId:int`, `ApprovalLevel:int` (enum `DepartmentManager/WorkshopManager`), `IsDeleted` | Không FK thật (ScopeId đa hình theo ScopeType) | Ánh xạ 1 User (Trưởng phòng/Trưởng xưởng) phụ trách duyệt phạm vi nào. Tổng Giám Đốc KHÔNG cần dòng ở đây — bypass scope (check Role claim). |
| `OtFormApprovalHistory` | `OtFormId`(FK, Cascade), `ApproverUserName:string`, `ApproverFullName:string?`, `ApprovalLevel:int`, `Action:int` (enum `Submitted/Approved/Rejected`), `Comment?`, `SignatureImage:byte[]?`, `ActionAt:DateTime` | N-1 OtForm | Audit trail từng cấp duyệt; `SignatureImage`/`ApproverFullName` là snapshot tại thời điểm ký (không tham chiếu ngược Identity). |
| `UserSignature` | `UserName:string`(unique), `SignatureImage:byte[]`, `UpdatedAt` | Không FK thật | Chữ ký đăng ký sẵn để auto-fill lúc duyệt — không phải nguồn sự thật cho audit (nguồn thật = `OtFormApprovalHistory.SignatureImage`). |
| `SecondaryPassword` | `UserName:string`(unique), `PasswordHash:string`, `UpdatedAt` | Không FK thật | Mật khẩu cấp 2 (2026-07-30) — bắt buộc nhập lại ở MỌI hành động ký/duyệt OtForm (submit/approve/reject, kể cả kênh email), xem §Business Logic — Mật khẩu cấp 2. `PasswordHash` dùng `Microsoft.AspNetCore.Identity.PasswordHasher<object>`, không lưu plaintext. |
| `PendingSecondaryPasswordConfirmation` | `UserName:string`, `PasswordHash:string`, `Token:string`(unique), `ExpiresAt`, `ConfirmedAt:DateTime?`, `CreatedAt` | Không FK thật | Y hệt `PendingSignatureConfirmation` — mật khẩu cấp 2 mới KHÔNG áp dụng ngay, chờ xác nhận qua email. |
| `AttendanceSetting` | `MainMealTicketMinHours:decimal(5,2)`, `MonthlyOtHourLimit:decimal(10,2)`, `YearlyOtHourLimit:decimal(10,2)` | Không FK thật | Cấu hình dùng chung (2026-08-01) — bảng LUÔN đúng 1 dòng, mirror `Asset.Domain.Entities.AssetSetting`. Xem §Cấu hình phiếu ăn & giới hạn lũy kế. |

Enum (`Attendance.Domain/Enums/`): `OtFormStatus` (Pending=0/ApprovedByDepartment=1/ApprovedByWorkshop=2/Completed=3/Rejected=4/**Draft=5**, giá trị `Draft` cố tình gán số 5 — thêm cuối cùng thay vì chèn lên đầu để không đổi int của các trạng thái cũ đã lưu DB), `ApprovalLevel` (Submitter/DepartmentManager/WorkshopManager/GeneralDirector), `ApprovalAction` (Submitted/Approved/Rejected), `ScopeType` (Group/Department). Lưu dưới dạng `int` trên entity, không dùng `HasConversion`.

### §Business Logic (đã code trong `OtFormService`)
Chốt theo phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam):

#### §Người tạo đơn KHÁC Trưởng nhóm — luồng Draft → ký duyệt (2026-07-16)
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

#### §Naming chuẩn hoá lại (2026-07-17) — đối chiếu với email thật của công ty
Người dùng gửi email thật (BP Kế hoạch - 1PC4L, gồm nhóm Kế hoạch + Seppen) để làm chuẩn, đối chiếu ra:
- `Department` = **Phòng / Phòng ban** (khớp "Trưởng phòng" = `ApprovalLevel.DepartmentManager`) — **không đổi**.
- `Group` = **Bộ phận** (KHÔNG PHẢI "Nhóm" như `docs/attendance-api-fe.md` từng ghi nhầm ở §3.1 — đã sửa lại label). Cơ chế **nhiều người cùng giữ quyền ký cấp Submitter cho 1 Group** (VD Huyền/Cảng/Dung cùng phụ trách BP Kế hoạch, thay phiên tạo/ký) đã đúng sẵn qua `UserApprovalScope(ScopeType=Group, ApprovalLevel=Submitter, nhiều UserName)` — không đổi.

#### §Cấp duyệt mới "Trưởng Bộ phận" (GroupHead) — 2026-07-17
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

Phần dưới đây (duyệt cấp Trưởng phòng → Trưởng xưởng → TGĐ) **giữ nguyên không đổi** so với thiết kế gốc:
- Luồng duyệt **tuần tự**: `DepartmentManager` (Trưởng phòng) → `WorkshopManager` (Trưởng xưởng) → `GeneralDirector` (Tổng Giám Đốc), dừng ở cấp = `OtCase.RequiredApprovalLevel`:
  - TH1 (ngày thường) → `RequiredApprovalLevel = DepartmentManager`.
  - TH2 (ngày nghỉ/CN/lễ) → `RequiredApprovalLevel = WorkshopManager`.
  - TH3 (lũy kế > 25h/tháng hoặc > 300h/năm) → `RequiredApprovalLevel = GeneralDirector`.
- Phân quyền 2 lớp: **Permission** (`Attendance.OTForm.Approve` gate hành động) + **`UserApprovalScope`** (gate dữ liệu — khớp `ScopeType/ScopeId` với `OtForm.DepartmentId`/`GroupId` VÀ đúng `ApprovalLevel` đang chờ). `GeneralDirector` bypass scope, chỉ cần `User.IsInRole("Tổng Giám Đốc")`.
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

### §Lũy kế tháng/năm — cộng khi Completed, rollover tự động, chỉnh thủ công (2026-07-16)
- **Thời điểm cộng**: CHỈ khi đơn đạt `Completed` (đi hết luồng duyệt theo `otCase.requiredApprovalLevel`) — `OtFormService.ApproveAsync` gọi `AccumulateEmployeeHoursAsync` ngay sau khi xác định `nextStatus == Completed`, trong cùng `SaveChangesAsync`. Đơn `Rejected` hoặc dừng ở cấp trung gian thì KHÔNG cộng gì — tránh phải rollback nếu đơn bị từ chối giữa chừng.
- **Số giờ cộng** = `OtFormEmployee.EndTime - OtFormEmployee.StartTime` (giờ OT thực tế đã đăng ký của từng người trong đơn đó), cộng vào cả `MonthToDate` và `YearToDate` của `Employee` tương ứng.
- **Rollover tự động theo `OtForm.Date`**: so `Date.Year`/`Date.Month` của đơn với `Employee.AccumulationYear`/`AccumulationMonth` hiện tại — khác năm thì reset cả `YearToDate` và `MonthToDate` về 0 trước khi cộng; cùng năm nhưng khác tháng thì chỉ reset `MonthToDate`. Sau đó luôn stamp lại `AccumulationYear`/`AccumulationMonth` = năm/tháng của đơn.
- **Điều chỉnh lũy kế thủ công**: `PATCH /api/Employee/{id}/adjust-accumulation` (`AdjustEmployeeAccumulationDto { MonthToDate, YearToDate }`) — vì không phải ai cũng làm đúng giờ OT đã đăng ký trong form. Không gắn `[RequirePermission]` (chỉ cần đăng nhập, theo `FallbackPolicy`); `EmployeeService.AdjustAccumulationAsync` tự phân quyền:
  - Chính nhân viên (`Employee.UserName == CurrentUserName`) luôn chỉnh được lũy kế của chính mình.
  - Người có quyền `Attendance.Employee.Update` (Admin) chỉnh được cho bất kỳ nhân viên nào.
  - Mỗi lần chỉnh đều stamp `AccumulationYear`/`AccumulationMonth` = năm/tháng hiện tại (coi giá trị mới là "đúng tại thời điểm chỉnh"), để lần cộng lũy kế tiếp theo trong cùng tháng không bị rollover đè mất.
  - Nhân viên chưa được gán `UserName` (đa số dữ liệu hiện có) thì chưa tự chỉnh được — cần Admin gán qua `PUT /api/Employee/{id}` trước.

### §Lũy kế hiển thị trên đơn — snapshot đóng băng, KHÔNG join sống (2026-07-21)
- **Bug đã sửa**: `OtFormService.GetByIdAsync` trước đây map `OtFormEmployeeDto.MonthToDate/YearToDate` trực tiếp từ `x.Employee.MonthToDate/YearToDate` (join sống tới `Employee` hiện tại) — nên xem lại đơn cũ luôn ra lũy kế **hiện tại**, không phải lũy kế **tại thời điểm lập đơn** (đơn càng cũ, giá trị hiển thị càng sai vì `Employee.MonthToDate/YearToDate` đã bị cộng dồn thêm bởi các đơn khác kể từ đó).
- **Cách sửa**: thêm cột `OtFormEmployee.MonthToDate`/`YearToDate` (decimal(10,2), migration `AddAccumulationSnapshotToOtFormEmployee`, đã apply DB) — snapshot đóng băng giá trị `Employee.MonthToDate/YearToDate` **tại đúng thời điểm dòng `OtFormEmployee` được thêm vào đơn**, cùng nguyên tắc snapshot đã dùng cho `OtFormApprovalHistory.SignatureImage`/`ApproverFullName`.
  - `CreateAsync`: snapshot lúc tạo đơn (dùng lại `List<Employee>` mà `ValidateEmployeesAsync` đã trả về, không query thêm).
  - `UpdateAsync` **không còn thêm/bớt nhân viên** (giới hạn lại 2026-07-31, xem §Sửa đơn khi đang Draft/Pending) nên không còn nhánh "nhân viên mới thêm lúc sửa" — snapshot `MonthToDate`/`YearToDate` chỉ còn được ghi 1 lần duy nhất lúc `CreateAsync`, không đổi khi sửa `EndTime`.
  - `GetByIdAsync` giờ đọc `x.MonthToDate`/`x.YearToDate` từ chính `OtFormEmployee`, không còn `x.Employee.MonthToDate/YearToDate`.
- **Giới hạn dữ liệu cũ**: các `OtFormEmployee` đã tồn tại từ trước migration này có `MonthToDate`/`YearToDate` = `0` (default cột mới, không có cách khôi phục lại giá trị lịch sử vì trước đây chưa từng lưu) — chỉ đơn tạo/sửa **sau** khi apply migration mới có snapshot đúng.

### §Phiếu ăn — ngưỡng giờ OT (2026-07-16, ngưỡng đưa vào cấu hình + tự tính ở FE 2026-08-01)
- Nhân viên đủ điều kiện phiếu ăn khi giờ OT thực tế **>= ngưỡng cấu hình** (`(EndTime - StartTime) >=
  AttendanceSetting.MainMealTicketMinHours`, mặc định 2.5h = 2h30 — trước 2026-08-01 hardcode `> 2h`,
  xem §Cấu hình phiếu ăn & giới hạn lũy kế). Đây là field **tính toán khi đọc**
  (`OtFormEmployeeDto.IsEligibleForMeal`), KHÔNG lưu DB — không nhầm với `ProcessPart.IsEat` (cờ "có
  phục vụ ăn" ở cấp cả đơn, do người lập đơn tick tay).
- **Số lượng phiếu ăn theo loại** (2026-07-16, migration `AddMealTicketCountsToProcessPart`): khi
  `IsEat = true`, người lập đơn nhập thêm 3 số lượng — `MainTicketCount` (phiếu chính),
  `SecondaryTicketCount` (phiếu phụ), `MilkCount` (sữa). Cả 3 đều **chung cho cả đơn** (không phải
  per-employee). BE không validate tổng 3 số này phải khớp `NumberOfEmployee` hay `IsEligibleForMeal`,
  không tự tính — **FE mới là nơi tự tính** `MainTicketCount`/`SecondaryTicketCount` (xem §Cấu hình
  phiếu ăn & giới hạn lũy kế), `MilkCount` luôn nhập tay 100%.

### §Cấu hình phiếu ăn & giới hạn lũy kế (2026-08-01)
**Yêu cầu người dùng** (chốt qua AskUserQuestion trước khi code, CLAUDE.md §2 luật 2): 2 nhóm quy tắc
trước đây hardcode trong code (mốc 2h nhận phiếu ăn ở BE; ngưỡng cảnh báo lũy kế 25h/tháng, 300h/năm ở
FE) nay gộp thành 1 bảng cấu hình Admin tự sửa được, không cần deploy lại khi chính sách đổi.

- **Phiếu ăn**: tăng ca **từ** `MainMealTicketMinHours` giờ trở lên (mặc định 2.5h = 2h30) → nhận
  **phiếu chính**; **dưới** mốc đó → nhận **phiếu phụ** (chốt: mọi người tăng ca đều nhận đúng 1 trong 2
  loại, **không có ngưỡng sàn** riêng cho phiếu phụ). Sữa (`MilkCount`) **luôn nhập tay**, không tự tính.
- **Giới hạn lũy kế**: `MonthlyOtHourLimit` (mặc định 25h) và `YearlyOtHourLimit` (mặc định 300h) — vượt
  ngưỡng thì UI tô đỏ cảnh báo trên MỌI màn hiển thị lũy kế, **không chặn** tạo/duyệt đơn hay sửa lũy kế
  thủ công.

**Thiết kế BE** (mirror `Asset.Domain.Entities.AssetSetting` — bảng cấu hình 1 dòng, xem
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
  Lũy kế của tôi...) nhưng gần như không đổi — tránh mỗi component tự gọi lại API. `invalidateAttendanceSettingCache()`
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

### §Song ngữ Vn/Jp trên OtFormDto — hiển thị cho Trưởng phòng/Trưởng Bộ phận xem trước khi duyệt (2026-07-29)
- **Lý do**: `Group.GroupNameJp`/`Department.DepartmentNameJp`/`Reason.ReasonNameJp` (và `OtFormEmployee.NoteJp`/`ProcessPart.AnotherSuggestionJp` đã có sẵn từ trước) tồn tại trong DB nhưng `OtFormDto`/`OtFormListItemDto` trước đây chỉ trả field `*Vn` — 2 màn xem trước khi duyệt (`OtFormDetail.tsx` trong app, `OtFormEmailConfirmPage.tsx` public qua link email) chỉ hiện tiếng Việt dù master data đã có sẵn bản dịch tiếng Nhật.
- **Đã thêm**: `OtFormDto.GroupNameJp`/`DepartmentNameJp`/`ReasonNameJp` (nullable, `OtFormService.GetByIdAsync`) và `OtFormListItemDto.GroupNameJp`/`DepartmentNameJp` (nullable, `OtFormService.ToListItemDto`) — map thẳng từ navigation `Group`/`Department`/`Reason` đã `Include()` sẵn ở cả 2 chỗ, không cần query thêm.
- **KHÔNG thêm Jp cho `Employee`** — giữ đúng quyết định cũ "Tên riêng — không dịch" (xem bảng Entity đầu file).
- FE hiện dạng `"{Vn} / {Jp}"` (bỏ `/ {Jp}` nếu `null`) qua helper `bilingualText` (`yev-frontend/src/modules/attendance/lib/bilingual.ts`), áp dụng cho Phòng ban/Bộ phận/Lý do (header + card thông tin) và Ghi chú nhân viên/Đề nghị khác (đã có Jp trong DTO từ trước, giờ mới lên UI) ở cả `OtFormDetail.tsx`, `OtFormEmailConfirmPage.tsx`, và cột "Phòng ban/Bộ phận" ở `OtFormListPage.tsx`.
- Email thông báo duyệt đơn cũng đổi sang song ngữ tương ứng — xem bullet `OtForm/ApprovalNotification.html` ở §Xác thực qua email bên dưới.

### §Popup xác nhận Từ chối trên trang xác nhận qua email (2026-07-29)
- **Trước đây**: `OtFormEmailConfirmPage.tsx` (route public `/xac-nhan-don?token=...`, xem §Xác thực qua email) dùng chung 1 ô "Ghi chú/Lý do từ chối" luôn hiển thị sẵn cho cả 2 nút Duyệt/Từ chối — bấm "Từ chối" gửi thẳng luôn nếu ô đó không trống, không có bước xác nhận lại.
- **Yêu cầu người dùng**: bấm "Từ chối" phải mở popup riêng để nhập lý do trước khi thật sự gửi — tránh bấm nhầm. Đã đổi FE: ô "Ghi chú" ngoài popup giờ chỉ dùng cho "Duyệt" (tuỳ chọn); bấm "Từ chối" mở modal riêng (cùng UX với modal Ký duyệt/Duyệt/Từ chối ở `OtFormDetail.tsx` trong app) với ô lý do **bắt buộc** + nút Huỷ/Xác nhận từ chối. Không đổi gì ở BE (`POST /email-confirm/{token}/reject` vẫn nhận `RejectOtFormDto { comment }` y hệt cũ).

### §Xác thực qua email — cập nhật chữ ký & duyệt đơn (2026-07-16)
Bổ sung 1 kênh xác nhận qua email (nút bấm mở trang xác nhận nhỏ) cho 2 hành động nhạy cảm — **không thay thế** luồng trong app, chỉ là kênh phụ vì cấp quản lý ít khi mở app:

- **Cập nhật chữ ký** (`UserSignatureService`): `PUT /api/UserSignature/me` **không còn áp dụng ngay** — tạo 1 dòng `PendingSignatureConfirmation` (Token, ExpiresAt = +30 phút, ConfirmedAt) rồi gửi email cho **chính người gọi** (chống chiếm phiên đăng nhập đổi chữ ký hộ). `GET/POST /api/UserSignature/confirm/{token}` (`[AllowAnonymous]`) — GET trả preview, POST áp dụng thật (gọi lại đúng logic upsert cũ) + set `ConfirmedAt` (chống dùng lại token).
- **Duyệt/Từ chối đơn qua email** (`OtFormService`): sau `CreateAsync` (cần DepartmentManager) và sau `ApproveAsync` khi còn cấp kế tiếp (`ApprovedByDepartment`→cần WorkshopManager, `ApprovedByWorkshop`→cần GeneralDirector), hàm `NotifyEligibleApproversAsync` tự tra người đủ quyền ở đúng cấp đó (qua `UserApprovalScope` như `GetPendingApprovalsAsync`, hoặc qua Role `"Tổng Giám Đốc"` nếu là GeneralDirector — không có UserApprovalScope) rồi tạo 1 `OtFormApprovalEmailToken` + gửi mail **cho từng người** (1 đơn có thể có nhiều người cùng phạm vi → nhiều token, nhiều mail). `GET /api/OtForm/email-confirm/{token}` (preview), `POST .../approve`, `POST .../reject` (`[AllowAnonymous]`) — cả 2 action đều gọi thẳng `ApproveAsync`/`RejectAsync` **đã có sẵn** (không viết logic duyệt mới), nên tự động thừa hưởng mọi validate cũ (đơn đã xử lý xong thì tự chặn — token cũ tự nhiên vô hiệu, không cần logic hủy token anh em thủ công) + tự cascade gửi mail tiếp cho cấp sau nếu còn.
- **Bề mặt `[AllowAnonymous]` đầu tiên và thứ 2 của toàn hệ thống** (trước đó không controller nào dùng, chỉ 2 dòng dev-only cho Scalar/OpenAPI) — bảo mật hoàn toàn dựa vào token ngẫu nhiên 256-bit (`Shared.Application.Helper.TokenHelper.GenerateSecureToken`), không dựa JWT/Permission. Token single-use (`ConfirmedAt`/`UsedAt`) + có hạn (`ExpiresAt`) — không cần logic thu hồi thủ công vì `LoadFormAndValidateAuthorityAsync`/status check tự nhiên chặn token cũ.
- **Cross-module không qua HTTP**: `Shared.Application.Interfaces.IUserDirectoryService`/`IEmailService` là contract đặt ở `Shared.Application` (2 module đều đã reference sẵn); implementation thật (`Identity.Application.Services.UserDirectoryService`, `Shared.Infrastructure.Services.EmailService`) được Scrutor tự nối dây lúc runtime — `Attendance.Application` **không cần** ProjectReference tới `Identity.Application` dù cần đọc Email/FullName/Role của User (nằm DB khác).
- **`Identity.User.Email`** (migration `AddEmailToUser`, DB `YevIdentityManagement`): tự resolve từ thuộc tính AD `mail` qua `MyClaimsTransformation.GetActualEmail` (dùng `UserPrincipal.EmailAddress`, cùng cơ chế `GetActualFullName`) — **chỉ set khi đang trống** (khác `DeviceName` vốn refresh mỗi lần đổi), tự "chữa lành" cho user cũ ở lần đăng nhập kế tiếp mà không cần Admin gán tay.
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
  tự bấm Duyệt/Ký như luồng cũ.
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

#### §Đổi tên khu vực "Phần xử lý" + sửa lỗi hiển thị song ngữ (2026-07-31)
Người dùng phản hồi tên "Phần xử lý / 処理内容" (khu vực Ăn uống/Xe đưa đón/Phòng copy/Phiếu ăn) khó
hiểu, và văn bản hiển thị trên trang email bị lặp (vd `"Ăn uống: Có / はい / 食事：Có / はい"`).

- **Nguyên nhân lỗi lặp**: `OtFormEmailConfirmPage.tsx` dùng `createBilingualTranslator` (ghép bản dịch
  `vi` + `ja` của CÙNG 1 key/values thành 1 chuỗi) cho các dòng dạng `t("eatLabel", { value: t("yes") })`
  — nhưng `t("yes")` TỰ NÓ đã trả về chuỗi song ngữ `"Có / はい"` (không phải giá trị đơn theo locale),
  nên khi nhét `value` đó vào `t("eatLabel", ...)` rồi ghép tiếp 1 lần nữa, cả cụm nhãn+giá trị bị lặp
  y hệt 2 lần (1 lần trong bản "vi", 1 lần trong bản "ja" — cả 2 bản đều chèn cùng `value` song ngữ).
  Cùng lỗi cho `transportationLabel`/`copyRoomLabel`/`anotherSuggestionLabel`, và dòng
  `removedInlineNote` (§Loại nhân viên khỏi đơn) khi `level` truyền vào là
  `approvalLevelLabelsBilingual[...]` (đã song ngữ sẵn).
- **Cách sửa**: KHÔNG đưa giá trị đã song ngữ hoá vào `createBilingualTranslator` nữa — với các dòng có
  cả nhãn lẫn giá trị động, dựng thủ công bằng literal string trong `bilingual.ts`
  (`processPartTitleBilingual`, `processPartFieldLabelsBilingual`, `bilingualYesNo()`,
  `removedByLabelBilingual`, `removedReasonLabelBilingual`) rồi ghép trực tiếp trong JSX thay vì gọi
  `t(key, { value })`. `OtFormDetail.tsx` (trong app, `useTranslations` 1 locale, không có khái niệm
  ghép vi+ja) **không bị lỗi này** nên giữ nguyên cách cũ.
- **Đổi tên**: `processPartTitle` (namespace `Attendance.OtFormDetail`, dùng chung bởi cả
  `OtFormDetail.tsx` và `OtFormEmailConfirmPage.tsx`) đổi `"Phần xử lý"` → `"Yêu cầu hỗ trợ khác"` (vi),
  `"処理内容"` → `"その他のご要望"` (ja). **KHÔNG đổi** ở `OtFormPrintView.tsx` (bản in PDF) — khối này
  trên ảnh nền in vẫn giữ đúng tên gốc "Phần xử lý / 処理欄" khớp phiếu giấy thật YEV-22-024, xem
  `attendance-otform-pdf-mapping.md` §4.
- **Không đổi field/response BE nào** — thuần sửa UI text + cách ghép chuỗi ở FE.
- **Sửa thêm (2026-07-31, cùng đợt)**: `OtFormDetail.tsx`/`OtFormEmailConfirmPage.tsx` trước đây ẩn hẳn
  cả khối "Yêu cầu hỗ trợ khác" khi `form.processPart == null` (đơn không tick "Yêu cầu hỗ trợ khác"
  lúc tạo) — khiến người dùng nhầm là thiếu thông tin dù đây là giá trị mặc định hợp lệ (đơn #22 xác
  minh qua SQL: `ProcessParts` không có dòng tương ứng, không phải lỗi lưu dữ liệu). Đã sửa để LUÔN hiện
  khối này, mặc định 3 checkbox "Không" khi `processPart` null — khớp đúng cách `OtFormPrintView.tsx`
  (bản in PDF) đã xử lý từ trước (`processPart?.isEat ?? false`), 2 màn hiển thị giờ nhất quán với bản in.

#### §Làm đẹp giao diện OT Form — đợt 1 (2026-07-31)
Người dùng yêu cầu "làm đẹp lại giao diện" cho toàn module Attendance — quy mô lớn (~25 màn), chốt qua
AskUserQuestion làm theo đợt, ưu tiên các màn OT Form trước (chạm nhiều nhất), hướng thiết kế:
badge/pill thay text phẳng + card/spacing nhất quán + bảng gọn hơn. `OtFormDetail.tsx`/
`OtFormEmailConfirmPage.tsx` đã làm ở đợt trước (xem mục "Yêu cầu hỗ trợ khác" ở trên). Đợt này:

- **`OtFormListPage.tsx`** (5 tab danh sách, §4.2): thu gọn padding ô bảng `px-6 py-4` → `px-4 py-3`
  (đúng thang "danh sách gọn" ở `DESIGN_SYSTEM.md` §2.3, bảng này 8-9 cột nên ưu tiên gọn hơn thưa);
  `totalHour` đổi từ số trần sang badge pill; empty-state thêm icon `Inbox` xám nhạt phía trên dòng
  "Không có dữ liệu". Không đổi field/API nào.
- **`CreateOtFormPage.tsx`** (form tạo/sửa đơn): (1) 3 checkbox Ăn uống/Xe đưa đón/Phòng copy trong khối
  "Yêu cầu hỗ trợ khác" đổi từ checkbox+label phẳng sang `ToggleOptionCard` — ô bo góc có icon
  (`Utensils`/`Car`/`Printer`), đổi viền/nền sang xanh lá nhạt khi chọn (cùng ngôn ngữ hình ảnh
  `ProcessPartTile` đã dùng ở màn Chi tiết); input thật vẫn là `<input type="checkbox">` (`sr-only`,
  giữ nguyên hành vi/accessibility, chỉ đổi lớp vỏ hiển thị). (2) Bảng chọn nhân viên: dòng đã chọn tô
  nền hồng nhạt `bg-[#fff4f2]/60` để dễ nhìn; cột luỹ kế giờ OT (`monthToDate`/`yearToDate`) đổi từ text
  trần sang badge pill, đỏ nhạt kèm icon `AlertTriangle` khi vượt ngưỡng (>25h/tháng hoặc >300h/năm),
  xám trung tính khi bình thường — cùng bộ màu semantic ở `DESIGN_SYSTEM.md` §1.3. (3) Dòng "Đã chọn N
  nhân viên" chuyển từ text dưới bảng lên thành badge ở góc phải tiêu đề section (mẫu Card có badge,
  `DESIGN_SYSTEM.md` §4.1). Không đổi logic validate/submit nào.
- Các màn OT Form còn lại (`OtFormTabsPage.tsx` — tab bar, `OtFormDetail.tsx`/`OtFormEmailConfirmPage.tsx`
  — đã làm đợt trước) giữ nguyên, đã khớp `DESIGN_SYSTEM.md`. Các nhóm màn khác của module (danh mục
  CRUD Group/Department/Employee/Reason/OtCase, phạm vi duyệt, chữ ký, mật khẩu cấp 2) **CHƯA làm** —
  để ở đợt sau theo đúng thứ tự người dùng chọn.

#### §Làm đẹp giao diện — đợt 2 (2026-07-31, danh mục CRUD + phạm vi duyệt + chữ ký + mật khẩu cấp 2)
Tiếp nối đợt 1 (OT Form). Cùng hướng: badge/pill thay text phẳng, bảng gọn hơn (`px-6 py-4` → `px-4
py-3`, header `py-3` → `py-2.5`), empty-state thêm icon `Inbox`. Áp dụng cho `DepartmentList.tsx`,
`GroupList.tsx`, `ReasonList.tsx`, `OtCaseList.tsx`, `EmployeeList.tsx`, `UserApprovalScopeManager.tsx`.

- **Badge hoá field boolean/enum trong bảng**: `OtCaseList.tsx` — `requireSignature` đổi từ text "Có"/
  "Không" sang badge xanh lá (icon `Check`)/xám (icon `X`); `requiredApprovalLevel` sang badge xám
  trung tính. `UserApprovalScopeManager.tsx` — `scopeType` sang badge xám, `approvalLevel` sang badge đỏ
  nhạt (accent, không phải cảnh báo — không có badge lỗi nào khác trong cùng bảng nên không xung đột
  ngữ nghĩa). `GroupList.tsx` — tên Phòng ban của mỗi Bộ phận sang badge xám. `EmployeeList.tsx` — cột
  luỹ kế giờ OT tháng/năm đổi từ text `font-semibold` màu đỏ sang badge pill (đỏ nhạt + icon
  `AlertTriangle` khi vượt ngưỡng >25h/tháng hoặc >300h/năm, xám khi bình thường) — cùng bộ màu đã
  chuẩn hoá ở `CreateOtFormPage.tsx` (đợt 1).
- **Bài học từ lỗi đợt 1** (xem báo cáo người dùng kèm ảnh chụp màn hình ngay sau khi đợt 1 xong):
  dùng nhầm màu "Accent nhạt / Error" (`#fff4f2`/`#e9bcb6`/`#930006`) cho trạng thái "đã chọn" (không
  phải lỗi/cảnh báo) ở bảng chọn nhân viên `CreateOtFormPage.tsx` khiến cả bảng nhìn như đang báo lỗi
  hàng loạt — đã sửa lại dòng đã chọn sang `bg-[#f8fafc]` (xám trung tính) và badge "Đã chọn N nhân
  viên" cũng đổi từ đỏ sang xám. Đợt 2 rút kinh nghiệm: chỉ dùng họ màu đỏ/hồng (`#fff4f2`/`#e9bcb6`/
  `#930006`/`#e3000f`) cho lỗi thật/cảnh báo thật/badge accent KHÔNG đứng cạnh cảnh báo khác trong cùng
  view; trạng thái trung tính (đã chọn, nhãn phụ, đếm số lượng) luôn dùng xám (`#e0e3e5`/`#f8fafc`/
  `#5e3f3a`); trạng thái tích cực dùng `emerald`.
- **`UserSignaturePanel.tsx`/`SecondaryPasswordPanel.tsx`**: thêm icon vào các ô trạng thái đã có sẵn
  màu (emerald=đã đăng ký kèm `Check`, amber=chưa đăng ký kèm `AlertTriangle`, amber=đã gửi email xác
  nhận kèm `Clock`) — các ô này vốn đã đúng ngữ nghĩa màu từ trước, chỉ thêm icon cho rõ hơn, không đổi
  logic.
- **`EmployeeAccumulationPanel.tsx`**: thêm 2 thẻ KPI (mẫu Stat Card `DESIGN_SYSTEM.md` §4.1) hiện
  monthToDate/yearToDate hiện tại phía trên form chỉnh — đỏ nhạt kèm icon `AlertTriangle` khi vượt
  ngưỡng, xám kèm icon `Clock` khi bình thường.
- **`EmployeeImportDialog.tsx`**: sửa màu xanh lá hardcode `#16a34a` (không có trong bảng màu
  `DESIGN_SYSTEM.md`) thành `emerald-600` chuẩn — không đổi layout/logic.
- Modal form (`DepartmentForm.tsx`/`GroupForm.tsx`/`ReasonForm.tsx`/`OtCaseForm.tsx`/`EmployeeForm.tsx`)
  và `SignatureUpload.tsx`: đã khớp `DESIGN_SYSTEM.md` §4.7 từ trước, **không sửa**.
- Còn lại (nếu có): các trang public qua email/link xác nhận ngoài OT Form (`SignatureConfirmPage.tsx`,
  `SecondaryPasswordConfirmPage.tsx`) chưa rà — để đợt sau nếu người dùng yêu cầu tiếp.

#### §Làm đẹp giao diện — đợt 3 (2026-07-31, thanh công cụ in đơn)
Người dùng phản hồi thanh công cụ phía trên bản in (`OtFormPrintView.tsx`) xấu — 2 nút chọn khổ giấy
nhét nguyên câu mô tả dài (`"A4 (tối đa 10 người/trang đầu, 30 người/trang sau)"`) làm nút bị xuống
dòng, phình to, lệch layout so với nút "Xuất PDF"/"In" bên cạnh.

- **Chỉ sửa thanh công cụ `no-print`** (2 nút chọn khổ giấy + "Xuất PDF" + "In") — **KHÔNG đụng** phần
  render bản in thật (`PageFrame`/`FormHeaderFields`/`EmployeeRowFields`, ảnh nền + toạ độ `%` đo từ file
  gốc), theo đúng nguyên tắc đã ghi ở đầu file component: bản in phải khớp tuyệt đối phiếu giấy gốc
  YEV-22-024, không tự thêm/bớt gì ngoài ảnh nền.
- Rút nút khổ giấy về nhãn ngắn (`"A4"`/`"A5 ngang"`, key mới `paperSizeA4Short`/`paperSizeA5Short`) +
  icon phân biệt hướng giấy (`RectangleVertical` cho A4 dọc, `RectangleHorizontal` cho A5 ngang). Câu mô
  tả sức chứa đầy đủ cũ (`paperSizeA4`/`paperSizeA5`, giữ nguyên nội dung) chuyển xuống thành 1 dòng chú
  thích nhỏ màu xám bên dưới thanh nút, chỉ hiện đúng 1 câu khớp khổ đang chọn — không còn nhét trong nút.
- Nút "In" thêm icon `Printer` cho đồng bộ với nút "Xuất PDF" (đã có icon `Download` từ trước).

#### §Sửa lỗi 2 thanh cuộn chồng nhau ở khung app (2026-07-31)
Người dùng báo bảng nhân viên ở `/ot/create` bị "che, bị cắt" và tồn tại 2 thanh cuộn cùng lúc — dựng
lại được bằng thao tác dev tools, xác định đây là lỗi cấu trúc CSS ở khung ứng dụng
(`(ot-manager)/layout.tsx`, dùng chung bởi MỌI trang OT chứ không riêng gì `/ot/create`), không phải
lỗi riêng của `CreateOtFormPage.tsx`.

**Phải sửa 3 lượt mới dứt** (người dùng test lại và báo còn lỗi sau mỗi lượt) — ghi lại đầy đủ để
không lặp lại lối mò mẫm này:

1. **Lượt 1 — thêm `min-h-0` vào `<main>`**: `flex-1 overflow-y-auto` là flex item, mà flex item mặc
   định `min-height: auto` nên không chịu co theo chiều cao khối cha. Đúng nhưng **chưa đủ**.
2. **Lượt 2 — đổi `max-h-screen` → `h-[calc(100vh-4rem)]`**: `Header`
   (`modules/common/components/Header.tsx`) cao `h-16` = `4rem`, là `sticky` chứ **không** `fixed` nên
   **chiếm chỗ thật** trong luồng. Khung OT/PC nằm dưới header mà vẫn khai `100vh` → tổng chiều cao
   trang `100vh + 4rem` → tràn viewport → `document` sinh thanh cuộn riêng. Đúng hướng nhưng **vẫn tái
   phát**, vì mới chỉ chỉnh con số chứ chưa bỏ được việc nhiều tầng cùng tranh quản chiều cao.
3. **Lượt 3 (dứt điểm) — dồn toàn bộ chiều cao + vùng cuộn về `[locale]/layout.tsx`**:
   - `body`: `min-h-screen flex flex-col` → **`flex h-screen flex-col overflow-hidden`** (+
     `print:h-auto print:overflow-visible`) — chặn hẳn document tự cuộn.
   - root `<main>`: `flex-grow` → **`min-h-0 flex-1 overflow-y-auto`** — trở thành vùng cuộn **duy
     nhất** của toàn app.
   - `(ot-manager)/layout.tsx` + `(pc-manager)/layout.tsx`: **bỏ sạch** mọi khai báo chiều cao/cuộn của
     riêng mình, chỉ còn `min-h-full`; `<main>` bên trong đổi thành `<div>` (root layout đã có `<main>`
     rồi — lồng 2 `<main>` là HTML không hợp lệ).
   - Dọn theo cho nhất quán: `OtAccessGuard`/`PcAccessGuard` `min-h-screen` → `min-h-full`;
     `(admin)/admin/page.tsx` `h-[calc(100vh-4rem)]` → `h-full` và `<main>` lồng bên trong → `<div>`.
- Quy tắc rút ra đã ghi thành mục riêng ở `DESIGN_SYSTEM.md` §3: **chỉ root layout được khai chiều cao
  và vùng cuộn**; layout con chỉ dùng `h-full`/`min-h-full`, không tự `overflow-y-auto`, không lồng
  `<main>`. Sidebar vẫn `fixed h-screen` — đúng, vì `fixed` nằm ngoài luồng.
- Không đổi cấu trúc/hành vi nghiệp vụ nào — thuần sửa lỗi CSS layout.

### §DB
- DB: `YevOTManagement` (server `DASVRFAST`, conn `OTManagementConnection`). DbContext: `AttendanceDbContext`.
- Migrations theo thứ tự: `InitAttendance` → `AddOtCaseApprovalLevelAndEmployeeScope` → `RemoveAreaLineFromOtFormAddGroupDepartment` → `MakeEmployeeGroupRequiredRemoveDepartment` → `RenameUserIdToUserName` → `AddApproverFullNameToOtFormApprovalHistory` → `AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName` → `AddMealTicketCountsToProcessPart` → `AddEmailConfirmationTables` → `AddSecondaryPassword` (2026-07-30, bảng `SecondaryPasswords`/`PendingSecondaryPasswordConfirmations`) → `AddRemovedFieldsToOtFormEmployee` (2026-07-30, 6 cột soft-remove trên `OtFormEmployees`) → `AddAttendanceSetting` (2026-08-01, bảng `AttendanceSettings` 1 dòng, seed `(2.5, 25, 300)` — xem §Cấu hình phiếu ăn & giới hạn lũy kế). Tất cả đã `database update` vào `YevOTManagement`.
- Do nhiều DbContext trong solution, mọi lệnh `dotnet ef` cho module này phải thêm `--context AttendanceDbContext`. Riêng migration `AddEmailToUser` (thêm `Users.Email`), `AddAttendancePermissionsAndRoles` (seed Permission/Role), `AddCategoryViewPermissionsToTruongGroup` (2026-07-17, vá lỗ hổng thiếu 4 permission View danh mục cho Role Trưởng nhóm — xem §Permission & Role đã seed), `AddSecondaryPasswordPermission` (2026-07-30, seed `Attendance.SecondaryPassword.Update`), `AddOtFormRemoveEmployeePermission` (2026-07-30, seed `Attendance.OTForm.RemoveEmployee` — xem §Loại nhân viên khỏi đơn), và `AddAttendanceSettingPermission` (2026-08-01, seed `Attendance.Setting.Update` — xem §Cấu hình phiếu ăn & giới hạn lũy kế) nằm ở DB **Identity** (`Indentity.Infrastructure`, `--context IdentityDbContext`), không phải Attendance.

## 1. Cấu trúc code đã có

### Danh mục CRUD chuẩn (Department/Group/Reason/OtCase/Employee)
Mỗi entity có đủ: `I{Entity}Repository` (Application/Interfaces/Repository) + impl (Infrastructure/Repositories) → property trong `IAttendanceUnitOfWork`/`AttendanceUnitOfWork` → `{Entity}Dto`/`Create{Entity}Dto`/`Update{Entity}Dto` (Application/Dtos) → `{Entity}Service : BaseService<IAttendanceUnitOfWork>` → `{Entity}Controller : BaseController` (route `grid-list`/`all`/`{id}`/POST/PUT/DELETE, `[RequirePermission("Attendance.{Entity}.{Action}")]`).
- `GroupController` có thêm `GET /by-department/{departmentId}` (dropdown phụ thuộc).
- `EmployeeController` có thêm `GET /by-group/{groupId}` (Trưởng nhóm chọn hàng loạt nhân viên).

### UserApprovalScope (`UserApprovalScopeController`)
- `GET /grid-list`, `GET /by-user/{userName}`, `POST` (validate `ScopeId` tồn tại đúng bảng theo `ScopeType`, chặn trùng), `DELETE /{id}` (soft-delete). Không có `PUT` — sửa = xoá + tạo lại.

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
- Xem §Cấu hình phiếu ăn & giới hạn lũy kế.

### OtForm (`OtFormController`) — nghiệp vụ chính
- `POST /api/OtForm` — tạo đơn ở trạng thái **Draft** (`Attendance.OTForm.Create`), CHƯA ký "Người đề nghị" (xem §Người tạo đơn KHÁC Trưởng nhóm).
- `POST /api/OtForm/{id}/submit` — **Trưởng nhóm ký duyệt** "Người đề nghị", chuyển `Draft → Pending` (`Attendance.OTForm.Create`, validate `UserApprovalScope(Submitter)` của người gọi + `UserSignature`).
- `GET /api/OtForm/my-forms` — đơn do chính mình tạo (`Attendance.OTForm.View`).
- `GET /api/OtForm/pending-submissions` — đơn `Draft` đang chờ chính mình (Trưởng nhóm) ký duyệt, tự lọc theo `UserApprovalScope(Submitter)` (`Attendance.OTForm.Create` — KHÔNG dùng `.Approve` vì Role "Trưởng nhóm" không có permission này).
- `GET /api/OtForm/pending-approvals` — đơn đang chờ chính mình duyệt (cấp Trưởng phòng/Trưởng xưởng/TGĐ, KHÔNG bao gồm Draft), tự lọc theo `UserApprovalScope` hoặc bypass nếu `Role="Tổng Giám Đốc"` (`Attendance.OTForm.Approve`).
- `GET /api/OtForm/my-actions` (mới, 2026-07-17) — lịch sử đơn **CHÍNH mình đã Ký/Duyệt/Từ chối** ở bất kỳ cấp nào (Submitter/DepartmentManager/WorkshopManager/GeneralDirector), gate bằng `Attendance.OTForm.View` (dùng chung cho cả 4 Role vì đều có sẵn permission này). Vá lỗ hổng: trước đây KHÔNG có cách nào xem lại đơn đã xử lý — `my-forms` chỉ lọc theo người **tạo** đơn (không phải người ký/duyệt), còn `pending-submissions`/`pending-approvals` chỉ hiện đơn **chưa** xử lý, đơn vừa xử lý xong lập tức biến mất khỏi 2 danh sách đó. `OtFormService.GetMyActionsAsync` truy `OtFormApprovalHistory.ApproverUserName == user hiện tại` lấy `OtFormId` (distinct) rồi trả về `OtForm` tương ứng — gồm cả đơn từng bị chính user đó **Từ chối** (không chỉ Ký/Duyệt), vì đây là lịch sử "đã xử lý" chứ không phải "đã đồng ý".
- `GET /api/OtForm/{id}` — chi tiết đầy đủ (Employees kèm lũy kế + phiếu ăn, ProcessPart, ApprovalHistories).
- `PUT /api/OtForm/{id}` — sửa (2026-07-31: **chỉ còn** giờ kết thúc từng nhân viên, không còn sửa toàn bộ), chỉ chính người tạo và chỉ khi `Status` là `Draft`/`PendingGroupHead`/`Pending` (`Attendance.OTForm.Create`, xem §Sửa đơn khi đang Draft/Pending).
- `POST /api/OtForm/{id}/approve`, `POST /api/OtForm/{id}/reject` (`Attendance.OTForm.Approve`, chỉ áp dụng cấp Trưởng phòng/Trưởng xưởng/TGĐ — gọi trên đơn `Draft` sẽ báo lỗi rõ ràng, dùng `/submit` thay thế). `approve` tự cộng lũy kế nhân viên nếu đạt `Completed`, tự gửi email cho cấp duyệt kế tiếp nếu còn.
- `POST /api/OtForm/{id}/employees/remove` (mới, 2026-07-30, `Attendance.OTForm.RemoveEmployee` — permission riêng, không dùng chung `.Create`/`.Approve`) — loại 1 nhân viên khỏi đơn để duyệt được phần còn lại, áp dụng cho MỌI cấp (kể cả Trưởng nhóm ở `Draft`). Không đổi `Status`, không ký lại các cấp trước. Xem §Loại nhân viên khỏi đơn.
- `GET /email-confirm/{token}`, `POST /email-confirm/{token}/approve`, `POST /email-confirm/{token}/reject` (`[AllowAnonymous]`) — kênh bổ sung qua email, xem §Xác thực qua email.
- `BaseController.CurrentUserName` (`Attendance.Api/Controllers/BaseController.cs`) — helper lấy `User.Identity.Name` dùng chung cho mọi Controller cần biết "ai đang gọi API".

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

### Employee — thêm endpoint tự chỉnh lũy kế (2026-07-16)
- `PATCH /api/Employee/{id}/adjust-accumulation` (`AdjustEmployeeAccumulationDto`) — không gắn `[RequirePermission]`, chỉ cần đăng nhập; phân quyền tự trong Service (chính chủ `UserName` hoặc quyền `Attendance.Employee.Update`). Xem §Lũy kế tháng/năm.

### Permission & Role đã seed (Identity migration `AddAttendancePermissionsAndRoles`)
- 28 permission `Attendance.*`: CRUD 5 danh mục + `UserApprovalScope.{View,Create,Delete}` + `UserSignature.{View,Update}` + `OTForm.{View,Create,Approve}`. **+1** (2026-07-29, migration riêng `AddAttendanceAiChatPermission`): `Attendance.AiChat.Use`, hiện chỉ gán Admin — xem mục `AttendanceAiChatController` ở trên. **+1** (2026-07-30, migration `AddSecondaryPasswordPermission`): `Attendance.SecondaryPassword.Update`, gán qua subquery cho đúng các Role đang giữ `UserSignature.Update` (Admin + 5 Role nghiệp vụ) — xem §Mật khẩu cấp 2 khi ký/duyệt OtForm. **+1** (2026-07-30, migration `AddOtFormRemoveEmployeePermission`): `Attendance.OTForm.RemoveEmployee`, cùng cách gán qua subquery theo `UserSignature.Update` — xem §Loại nhân viên khỏi đơn. **+1** (2026-08-01, migration `AddAttendanceSettingPermission`): `Attendance.Setting.Update`, gán qua subquery theo `Attendance.Department.Create` (chỉ Admin) — xem §Cấu hình phiếu ăn & giới hạn lũy kế. `GET /api/AttendanceSetting` cố tình KHÔNG có permission riêng (mở cho mọi tài khoản đăng nhập).
- 4 Role mới: `Trưởng nhóm` (Create+View OTForm, View Employee, Update UserSignature, **+ View Department/Group/Reason/OtCase** — xem ngay dưới), `Trưởng phòng`/`Trưởng xưởng`/`Tổng Giám Đốc` (View+Approve OTForm, Update UserSignature). `Admin` được gán full toàn bộ permission `Attendance.*`.
- **Lỗ hổng đã vá (2026-07-17, migration `AddCategoryViewPermissionsToTruongGroup`)**: seed ban đầu (`AddAttendancePermissionsAndRoles`) chỉ gán `Trưởng nhóm` 4 permission (`OTForm.Create/View`, `Employee.View`, `UserSignature.Update`) — THIẾU `Department.View`/`Group.View`/`Reason.View`/`OtCase.View` (permission riêng biệt cho từng danh mục, không nằm trong `OTForm.View`). Hậu quả: Trưởng nhóm gọi `GET /api/Department/all`, `GET /api/Group/by-department/{id}`, `GET /api/Reason/all`, `GET /api/OtCase/all` (4 API load dropdown cho màn "Tạo đơn tăng ca") đều bị 403 — màn Tạo đơn không dùng được trên thực tế dù mọi API OtForm đã sẵn sàng. Đã bổ sung 4 permission này cho Role `Trưởng nhóm`, verify lại qua SQL trực tiếp trên DB thật (2026-07-17) — Role này hiện có đủ 8 permission `Attendance.*`.
- **Chưa làm**: gán Role cho user thật (`update-user-roles`/`create-user` — API Identity có sẵn) và tạo dòng `UserApprovalScope` cho từng Trưởng phòng/Trưởng xưởng **và mỗi người được phép tạo đơn** (`ApprovalLevel=Submitter`, xem §Business Logic — Phân quyền tạo đơn) thật (`POST /api/UserApprovalScope` — API đã có). Nhớ: từ 2026-07-16, chỉ gán được `ApprovalLevel=Submitter` cho `UserName` đã có Role `Trưởng nhóm` từ trước.

## 2. Wiring Host — đã xong
1. `Configurations/DependencyInjection.cs`: `AddDbContext<AttendanceDbContext>` với `OTManagementConnection`.
2. `Program.cs`: `AddControllers().AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)`.
3. `Attendance.Api.csproj`: thêm `ProjectReference` tới `Attendance.Application` (cần cho DTO/Interface Service).
4. Scrutor tự động đăng ký toàn bộ `*Repository`/`*UnitOfWork`/`*Service` trong assembly `Attendance.*` (không cần khai báo `AddScoped` thủ công).

## 3. Đã smoke-test (2026-07-14, kiểm lại 2026-07-16 sau khi thêm luồng Draft)
Build 0 lỗi. Host khởi động, `/openapi/v1.json` liệt kê đủ route `Department/Group/Reason/OtCase/Employee/OtForm/UserApprovalScope/UserSignature`, kể cả route mới `POST /api/OtForm/{id}/submit`. Gọi không token → 401 đúng như thiết kế (RequirePermission hoạt động). Chưa test bằng JWT thật với dữ liệu Group/UserApprovalScope thật (cần Admin seed trước — xem mục 4).

## 4. Còn thiếu / bước tiếp theo
- Gán Role thật cho user (Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) + tạo dữ liệu `UserApprovalScope` thật — lưu ý từ 2026-07-16, gán `ApprovalLevel=Submitter` chỉ thành công nếu `UserName` đã có Role "Trưởng nhóm" từ trước.
- Chưa test end-to-end luồng Draft mới (`Create` → `submit` → `Update` khi còn Draft/Pending → `approve`/`reject`) với dữ liệu thật.
- Seed data mẫu: 3 `OtCase` (TH1/TH2/TH3 với `RequiredApprovalLevel` tương ứng), `Department`/`Group`/`Reason`/`Employee` thật.
- Gán `Employee.UserName` cho các nhân viên có tài khoản AD riêng (nếu muốn dùng tính năng tự chỉnh lũy kế) qua `PUT /api/Employee/{id}`.
- Validate end-to-end qua Scalar UI với JWT thật (chưa test luồng Create → Update → Approve → Reject với dữ liệu thật, cũng như luồng cộng lũy kế lúc Completed và rollover tháng/năm).
- **SMTP đã cấu hình thật và verify gửi được (2026-07-17)** — xem §Xác thực qua email. Còn lại: khi deploy server IIS thật, nhớ import cert self-signed của `VNMAIL04` vào `Cert:\LocalMachine\Root` trên đúng server đó (hoặc nhờ IT đẩy qua GPO domain `yev.vn`) — chưa làm vì server production chưa dựng.
- Chưa verify bằng mắt hộp thư thật nhận đúng nội dung từ 2 luồng nghiệp vụ dùng template mới (`UserSignature/RequestUpdateConfirmation.html`, `OtForm/ApprovalNotification.html`) — mới verify SMTP connect/auth/send qua console test rời, chưa gọi qua đúng API nghiệp vụ với dữ liệu thật.
- **FE cần xây 2 trang xác nhận công khai** (`{FrontendBaseUrl}/xac-nhan-chu-ky`, `{FrontendBaseUrl}/xac-nhan-don`, đọc `?token=` trên URL) gọi các cặp API preview+action `[AllowAnonymous]` tương ứng — chưa có hợp đồng API riêng cho FE (`attendance-api-fe.md`) cho phần này, cần bổ sung khi FE bắt đầu code.
- Chưa test end-to-end luồng `OtFormApprovalEmailToken` với dữ liệu thật (chỉ mới verify luồng `PendingSignatureConfirmation`) — nên test khi có đơn thật đang chờ duyệt.
- Cân nhắc thêm `PUT` cho `UserApprovalScope` nếu cần sửa thay vì xoá-tạo-lại.
- Phân quyền theo Role (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc dùng chung permission `OTForm.View`+`Approve`) đã đủ để "tinh gọn giao diện" — 3 role này không thấy màn Tạo đơn/Sửa đơn/Danh mục; khác biệt giữa 3 role chỉ nằm ở dữ liệu trả về (`pending-approvals` tự lọc đúng cấp qua `UserApprovalScope`/Role), không cần thêm permission riêng cho từng role. Nếu sau này cần phân biệt sâu hơn (VD Trưởng phòng không được xem đơn của Trưởng xưởng phụ trách) thì mới cần thiết kế thêm.
- FE chưa có — hợp đồng API đã tài liệu hoá đầy đủ ở [attendance-api-fe.md](attendance-api-fe.md), đội FE có thể bắt đầu code song song trong lúc BE tiếp tục seed data thật.
