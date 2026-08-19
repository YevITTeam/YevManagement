# attendance-api-fe.md — API Attendance (Giấy tăng ca) cho Frontend

> Hợp đồng API quản lý Giấy tăng ca (OT Form). Implementation: [attendance-module.md](attendance-module.md).
> Module Identity: [identity-api-fe.md](identity-api-fe.md) · Module Asset: [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8080` (launchSettings hiện trỏ IP này, không phải `localhost:5000`) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Attendance.OTForm.Create`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- Envelope `ApiResponse<T>`, phân trang, mã lỗi HTTP, pattern CRUD cơ bản — giống hệt Asset, xem [asset-api-fe.md §1](asset-api-fe.md#1-quy-ước-chung). Tóm tắt: mọi response bọc `{ isSuccess, message, data, errors, timestamp }`; `grid-list` trả `data.data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **byte[] qua JSON**: field kiểu `byte[]` (chữ ký `SignatureImage`) serialize/deserialize thành **chuỗi base64** — FE convert ảnh (**upload file ảnh chữ ký có sẵn** — PNG/JPG chụp/scan chữ ký tay thật, KHÔNG phải vẽ bằng canvas/chuột trên web) sang base64 trước khi gửi, và decode base64 → hiển thị `<img src="data:image/png;base64,...">` khi nhận.
- **Cập nhật 2026-07-16** (breaking đổi `CreateOtFormEmployeeItemDto`, chưa có FE nào code trước đó nên không ảnh hưởng hệ thống thật): (1) `employees[].startTime` bị bỏ khỏi `CreateOtFormDto`/`UpdateOtFormDto` — luôn bằng `startTime` của đơn; (2) thêm `PUT /api/OtForm/{id}` sửa đơn, khóa cứng khi qua 1 cấp duyệt (§4.1b); (3) `OtFormDto`/`OtFormListItemDto` thêm `createdByFullName`+`isEditable`; (4) `OtFormEmployeeDto` thêm `monthToDate`/`yearToDate`/`isEligibleForMeal` (§4.3); (5) `Employee` thêm `userName`+`accumulationYear`+`accumulationMonth`, thêm `GET /api/Employee/me` và `PATCH /api/Employee/{id}/adjust-accumulation` (§3.5, §3.6); (6) lũy kế tự cộng khi đơn đạt Completed, rollover tự động theo tháng/năm (xem [attendance-module.md](attendance-module.md)).
- **Cập nhật 2026-07-16 (đợt 2 — breaking)**: (1) bỏ `submitterSignatureImage`/`signatureImage` khỏi body `CreateOtFormDto`/`ApproveOtFormDto` — BE tự lấy chữ ký từ `UserSignature` đã đăng ký sẵn của người gọi (§4.1, §4.4, §6); (2) `POST /api/OtForm` giờ yêu cầu thêm `UserApprovalScope(approvalLevel=Submitter)` khớp `groupId`/`departmentId` của đơn (trừ Admin) — cho phép nhiều người/1 Group cùng tạo đơn (§1, §5).
- **Cập nhật 2026-07-16 (đợt 3 — breaking)**: (1) `ProcessPartDto` thêm `mainTicketCount`/`secondaryTicketCount`/`milkCount` (số lượng phiếu ăn theo loại, nhập tay, chung cho cả đơn — §4.1/§4.1b/§4.3); (2) `PUT /api/UserSignature/me` **đổi hành vi hoàn toàn** — không còn áp dụng chữ ký ngay, mà gửi email xác nhận cho chính user, chữ ký chỉ có hiệu lực sau khi bấm xác nhận qua trang public do FE tự xây (§6, §6b); (3) `POST /api/OtForm/{id}/approve` khi còn cấp duyệt tiếp theo sẽ tự gửi email kèm link Duyệt/Từ chối cho người phù hợp — kênh **bổ sung**, không thay nút trong app (§4.6); (4) thêm `EmployeeImportController` cho Admin import Excel nhân sự hàng loạt (§3.7).
- **Cập nhật 2026-07-16 (đợt 4 — breaking, tách "người tạo đơn" khỏi "Trưởng nhóm")**: `POST /api/OtForm` **không còn ký "Người đề nghị" ngay** — chỉ tạo đơn ở `status = 5 Draft`. Phải gọi thêm `POST /api/OtForm/{id}/submit` (Trưởng nhóm ký duyệt) thì đơn mới chuyển sang `status = 0 Pending` (chờ Trưởng phòng) — xem §4.1, §4.1a. `isEditable` (`OtFormDto`/`OtFormListItemDto`) giờ đúng khi `status` là `Draft` **hoặc** `Pending` (trước chỉ `Pending`). Admin gán `UserApprovalScope(approvalLevel=Submitter)` giờ **chỉ thành công nếu `userName` đã có Role "Trưởng nhóm"** — xem §5.
- **Cập nhật 2026-07-17 (đợt 5)**: thêm `GET /api/OtForm/my-actions` — lịch sử đơn **chính mình đã Ký/Duyệt/Từ chối** ở bất kỳ cấp nào, dùng chung cho cả 4 Role (`Attendance.OTForm.View`). Vá lỗ hổng UX: trước đó đơn vừa xử lý xong (Ký ở `/submit`, hoặc Duyệt/Từ chối ở `/approve`, `/reject`) lập tức biến mất khỏi `pending-submissions`/`pending-approvals`, không có màn nào xem lại — xem §4.2b.
- **Cập nhật 2026-07-17 (đợt 6 — breaking, thêm cấp duyệt "Trưởng Bộ phận")**: phát hiện qua email thật của công ty rằng luồng duyệt thiếu 1 cấp — sau khi Trưởng nhóm ký, đơn phải qua **Trưởng Bộ phận** (Role mới, permission giống hệt Trưởng phòng/Trưởng xưởng/TGĐ) duyệt trước khi tới Trưởng phòng. Thêm `status = 6 PendingGroupHead` (đơn đã có chữ ký Trưởng nhóm, đang chờ Trưởng Bộ phận — chèn giữa `5 Draft` và `0 Pending` về mặt nghiệp vụ). `POST /{id}/submit` giờ chuyển đơn sang `6` thay vì `0`; Trưởng Bộ phận dùng đúng `POST /{id}/approve`/`/reject` có sẵn (permission `OTForm.Approve`, `approvalLevel=4 GroupHead`), không có endpoint riêng. **Áp dụng bắt buộc cho MỌI Group ngay** — Group nào Admin chưa gán `UserApprovalScope(approvalLevel=GroupHead)` thì đơn của Group đó sẽ kẹt ở `status=6`, không ai duyệt tiếp được cho tới khi gán xong (đã xác nhận chấp nhận rủi ro này với người yêu cầu — không có cơ chế bỏ qua cấp này). Xem §1.1/§1.2/§4.1a/§4.3/§5.
- **Sửa label sai (2026-07-17)**: `Department` = **Phòng/Phòng ban** (không phải "Bộ phận" như bản trước ghi nhầm ở §3.1), `Group` = **Bộ phận** (không phải "Nhóm").
- **Cập nhật 2026-07-29 (song ngữ Vn/Jp + popup Từ chối)**: (1) `OtFormDto` thêm `groupNameJp`/`departmentNameJp`/`reasonNameJp` (nullable, §4.3), `OtFormListItemDto` thêm `groupNameJp`/`departmentNameJp` (§4.2) — cùng cơ chế `"{Vn} / {Jp}"` với `employees[].noteJp`/`processPart.anotherSuggestionJp` đã có sẵn từ trước nhưng trước đây FE chưa hiện lên UI; (2) email thông báo duyệt đơn (§4.6) giờ song ngữ Việt/Nhật cả nhãn lẫn dữ liệu, thêm hẳn 3 dòng Phòng ban/Bộ phận/Lý do vào bảng thông tin (trước đây thiếu hoàn toàn); (3) trang public "Xác nhận duyệt đơn qua email" (§4.6, §6b) đổi nút "Từ chối" thành mở popup nhập lý do (bắt buộc) thay vì dùng chung 1 ô Ghi chú luôn hiện sẵn với Duyệt.
- **Cập nhật 2026-07-30 (breaking, thêm "Loại nhân viên khỏi đơn")**: yêu cầu người dùng — cấp đang chờ ký/duyệt (kể cả Trưởng nhóm ở `/submit`) muốn không duyệt cho 1 người trong đơn nhiều người thì không còn phải Từ chối CẢ đơn nữa. Thêm `POST /api/OtForm/{id}/employees/remove` (§4.5a, permission riêng `Attendance.OTForm.RemoveEmployee`) — soft-remove 1 `OtFormEmployee`, KHÔNG đổi `status`, không ký lại các cấp trước. `OtFormEmployeeDto` (§4.3) thêm 6 field `isRemoved`/`removedByUserName`/`removedByFullName`/`removedAtLevel`/`removedAt`/`removeReason` — người bị loại **vẫn nằm trong `employees[]`** (không bị BE lọc bỏ) để giữ audit trail, FE tự lọc `isRemoved` khi tính tổng giờ OT và khi in PDF. `numberOfEmployee` chỉ đếm người **chưa** bị loại.
- **Cập nhật 2026-07-31 (mở rộng "Loại nhân viên khỏi đơn" sang kênh email + đổi tên khu vực)**: (1) thêm `POST /api/OtForm/email-confirm/{token}/employees/remove` (`RemoveOtFormEmployeeByEmailTokenDto { EmployeeId, Reason }`, **KHÔNG có `SecondaryPassword`** — khác hẳn 2 action Duyệt/Từ chối qua email vẫn giữ mật khẩu cấp 2, đã chốt qua AskUserQuestion vì token trong URL tự nó là thông tin xác thực cho hành động này — xem §4.5a); (2) đổi tên khu vực UI "Phần xử lý / 処理欄" (ăn uống/xe đưa đón/phòng copy/phiếu ăn) thành **"Yêu cầu hỗ trợ khác"** ở cả 2 màn hiển thị JSON này (`OtFormDetail.tsx` trong app, `OtFormEmailConfirmPage.tsx` qua email) — **không đổi** ở bản in PDF (`OtFormPrintView.tsx`, vẫn giữ đúng tên khối trên phiếu giấy gốc YEV-22-024, xem `attendance-otform-pdf-mapping.md`); (3) sửa lỗi hiển thị trùng lặp song ngữ trên trang email — không đổi field/response nào, chỉ là bug FE (xem `bilingual.ts`).
- **Cập nhật 2026-07-31 (cùng ngày, thêm 1 đợt sửa)**: (1) bỏ luôn `secondaryPassword` khỏi kênh JWT `POST /{id}/employees/remove` (`RemoveOtFormEmployeeDto` nay chỉ còn `{ EmployeeId, Reason }`) — người dùng phản hồi hành động loại người không cần xác thực lại, nay CẢ 2 kênh (JWT + email) loại nhân viên đều không cần mật khẩu cấp 2, chỉ Duyệt/Từ chối (§4.4/§4.5/§4.6) mới cần; (2) redesign UI khối "Yêu cầu hỗ trợ khác" ở `OtFormDetail.tsx`/`OtFormEmailConfirmPage.tsx` từ text phẳng sang badge Có/Không (icon `Check`/`X` màu xanh lá/xám) + icon theo mục (`Utensils`/`Car`/`Printer`) — không đổi field/response nào, chỉ UI.
- **Cập nhật 2026-07-31 (breaking, giới hạn lại "Sửa đơn")**: `PUT /api/OtForm/{id}` (§4.1b) trước đây sửa được toàn bộ đơn giống hệt lúc tạo, nay **chỉ còn sửa được giờ kết thúc thực tế của từng nhân viên đang có trong đơn** — chốt qua AskUserQuestion. `UpdateOtFormDto` đổi hẳn còn `{ Employees: [{ EmployeeId, EndTime }] }`, không còn `GroupId`/`DepartmentId`/`ReasonId`/`OtCaseId`/`Date`/`StartTime`/`EndTime`(chung)/`SubReason`/`TotalHour`/`ProcessPart`/`NoteVn`/`NoteJp` nào. Danh sách nhân viên trong body phải khớp **chính xác** tập nhân viên active của đơn (không thêm/bớt được nữa — bớt người dùng riêng `POST /{id}/employees/remove`, §4.5a). FE (`CreateOtFormPage.tsx`) khoá toàn bộ field khác + đổi bảng chọn nhân viên sang bảng cố định chỉ sửa được cột "Giờ kết thúc".
- **Cập nhật 2026-08-01 (mới, "Cấu hình phiếu ăn & giới hạn lũy kế")**: chốt qua AskUserQuestion — 2 nhóm ngưỡng trước đây hardcode (mốc giờ nhận phiếu ăn `> 2h` ở BE; ngưỡng cảnh báo lũy kế 25h/tháng·300h/năm ở FE) nay gộp vào `AttendanceSetting`, Admin tự sửa qua UI, không cần deploy lại. Thêm `GET/PUT /api/AttendanceSetting` (§6d) — `GET` mở cho mọi tài khoản đăng nhập, `PUT` cần permission mới `Attendance.Setting.Update` (chỉ Admin). `OtFormEmployeeDto.isEligibleForMeal` đổi ngưỡng từ hardcode `> 2h` sang `>= mainMealTicketMinHours` (mặc định 2.5h). FE `CreateOtFormPage.tsx` **tự tính** `processPart.mainTicketCount`/`secondaryTicketCount` theo giờ OT từng người (>= ngưỡng → phiếu chính, dưới → phiếu phụ, mọi người đều nhận đúng 1 trong 2 loại) — người lập đơn vẫn sửa tay được, gõ đè thì tắt tự tính và hiện nút "Tính lại". Thêm tab "Cấu hình" trong `/ot/categories` (Admin) để sửa 3 ngưỡng này.
- **Cập nhật 2026-08-06 (mới, "Đơn tổng")**: chốt qua AskUserQuestion — gom nhiều `OtForm` đang chờ đúng
  cấp Trưởng phòng (`status=0 Pending`) của cùng 1 Phòng ban thành 1 "Đơn tổng", job chạy 15:00 hằng
  ngày, gửi mail (+ nhắc lại mỗi ngày nếu chưa xử lý), Trưởng phòng duyệt/từ chối hàng loạt 1 lần thay vì
  từng đơn. Thêm hẳn `OtFormBatchController` (`/api/OtFormBatch`, §6e) — không đụng gì tới các endpoint
  `/api/OtForm` hiện có (mỗi đơn thành viên vẫn duyệt qua đúng `ApproveAsync`/`RejectAsync` nội bộ).
  Route public mới `/xac-nhan-don-tong?token=...`; menu app mới "Đơn tổng" (`/ot/batches`, §1.4).
- **Cập nhật 2026-08-07 (Giai đoạn 3.2 — redesign "Đơn tổng" theo Cây chức vụ)**: tạm ngưng ở Giai đoạn
  3.1 (gắn chặt `status=0 Pending` cũ đã bị xoá), nay hoạt động lại — điều kiện gom đổi thành "bước đang
  chờ hiện tại của đơn có `TerminalLevelSnapshot=DepartmentManager`" (xem §6e, `attendance-module.md`
  §Đơn tổng). Route/DTO/schema **không đổi** so với bản 2026-08-06.
- **Cập nhật 2026-08-08 (Giai đoạn 3.2 — dọn polish còn lại, breaking)**: (1) `OtFormListItemDto` (§4.2)
  thêm `currentStepCandidateCount:int` — số người đủ điều kiện xử lý bước đang chờ hiện tại, FE hiện
  "đang chờ 1 trong N người" khi >1; (2) **xoá hẳn** `GET /api/OtForm/pending-submissions` (§4.2a, luôn
  trả rỗng từ Giai đoạn 3.1) — không còn route/tab FE "Chờ tôi ký duyệt"; (3) **xoá hẳn** toàn bộ
  `/api/UserApprovalScope` (§5, controller/service/entity/bảng DB) — đã orphaned từ Giai đoạn 3.1, xác
  nhận với người dùng trước khi xoá dữ liệu thật; (4) `PUT /api/DepartmentApprovalStep/by-department/{id}`
  (§3.4c) thêm validate mới: tối đa 2 phần tử trong `steps[]` có Chức vụ `terminalLevel=0` (trung gian,
  dưới cấp Trưởng phòng) — 400 nếu vi phạm, khớp đúng 2 ô "Người đề nghị" cố định trên giấy in
  `YEV-22-024`. Xem `attendance-module.md` §Cây chức vụ Giai đoạn 3.2.
- **Cập nhật 2026-08-08 (mới, "Xoá đơn kẹt vĩnh viễn")**: thêm `POST /api/OtForm/{id}/delete` (body
  `{ reason }` [Required]) — **Admin only** (`Attendance.OTForm.Delete`, permission mới chỉ gán Admin).
  Soft-delete, chặn 400 nếu đơn đã `Completed`. Xem §4.1c, `attendance-module.md` §Xoá đơn kẹt vĩnh viễn.
- **Cập nhật 2026-08-08 (breaking, "Gán tổ chức theo Chức vụ")**: `Employee.groupId` **không còn bắt
  buộc** — Trưởng phòng dùng `departmentId` (mới) thay vì `groupId` (không thuộc Bộ phận cụ thể nào,
  chỉ quản lý Phòng ban); Trưởng Xưởng/Giám đốc để cả 2 field trống (dùng chung toàn công ty). Đúng 1
  trong 2 field bắt buộc/cấm tuỳ `JobTitle.terminalLevel` — sai tổ hợp → 400. Xem §3.5,
  `attendance-module.md` §Gán tổ chức theo Chức vụ.

## 1. Tổng quan nghiệp vụ, vai trò & luồng UI (đọc trước khi code màn hình)

> **⚠ SUPERSEDED (2026-08-07, Giai đoạn 3.1)** — sơ đồ luồng, bảng Role §1.1, ma trận trạng thái §1.2
> và các wireframe §1.3 tham chiếu đúng số cấp cố định (Draft/Submitter/GroupHead/DepartmentManager/
> WorkshopManager/GeneralDirector) bên dưới đều mô tả cơ chế **CŨ**, đã bị thay thế bằng chuỗi duyệt
> tự suy luận theo **Cây chức vụ** (xem `attendance-module.md` §Cây chức vụ Giai đoạn 3.1). Tóm tắt
> khác biệt cốt lõi so với mô tả cũ dưới đây:
> - **Không còn Draft** — `POST /api/OtForm` vào chuỗi duyệt ngay, `OtFormStatus` chỉ còn 3 giá trị
>   (`InApproval/Completed/Rejected`, xem §2). Bỏ hẳn `POST /{id}/submit`.
> - **Số bước duyệt co giãn theo Phòng ban** (không còn cố định 3-5 cấp) — đọc từ `OtFormDto.approvalSteps[]`
>   (đã snapshot lúc tạo đơn), không phải suy từ `status` như trước. Xem §4.3.
> - **Ai được duyệt bước nào** = có mặt trong `approvalSteps[].candidates[]` của bước đó, không còn qua
>   `UserApprovalScope` — bảng Role §1.1 (cột "Phạm vi cấu hình ở đâu") không còn đúng cho `OtForm`,
>   `UserApprovalScope` giờ là tính năng riêng lẻ/lịch sử (§5).
> - Cấu hình chuỗi duyệt làm ở 1 màn **"Cây duyệt"** (`CategoryManagement.tsx`, gộp lại 2026-08-10 —
>   trước đó là 2 tab riêng), gồm 2 khối theo đúng thứ tự đơn đi qua: khối **"Cây duyệt Nhóm"**
>   (`/api/GroupApprovalStep`, §3.4c-2 — 3 cấp trung gian Staff/Group Leader/Team Leader) rồi tới khối
>   **"Cây duyệt Bộ phận"** (`/api/DepartmentApprovalStep`, §3.4c — 3 cấp cuối Manager/Factory
>   Manager/Director), KHÔNG còn làm ở màn "Phân quyền duyệt" (`UserApprovalScope`, §5) như mô tả
>   trong §1.1/§1.2. Tab xem trước chuỗi duyệt ("Thử chuỗi duyệt") đã bị bỏ khỏi FE — endpoint BE
>   `GET /api/JobTitle/resolve-chain` vẫn còn, chỉ không còn UI riêng.
>
> Phần còn lại của §1 giữ nguyên làm tư liệu lịch sử (bố cục UI/lý do nghiệp vụ nhiều chỗ vẫn còn giá
> trị tham khảo, VD cấu trúc màn hình, cách gộp tab) — đọc kỹ phần cảnh báo này trước khi dựng màn mới.

Giấy tăng ca mô phỏng phiếu giấy thật **YEV-22-024** (Yazaki EDS Vietnam), luồng ký duyệt **tuần tự**
(mô tả GỐC, LỊCH SỬ — xem cảnh báo trên):

```
Người tạo đơn nhập liệu (POST /api/OtForm)   → status = Draft, CHƯA có chữ ký
        ↓
Trưởng nhóm ký duyệt "Người đề nghị" (POST /{id}/submit)  → status = PendingGroupHead
        ↓
Trưởng Bộ phận duyệt (GroupHead, MỚI 2026-07-17)  → status = Pending, BẮT BUỘC cho mọi Group
        ↓
Trưởng phòng duyệt (DepartmentManager)      → dừng nếu OtCase.requiredApprovalLevel = DepartmentManager (TH1)
        ↓
Trưởng xưởng duyệt (WorkshopManager)        → dừng nếu = WorkshopManager (TH2)
        ↓
Tổng Giám Đốc duyệt (GeneralDirector)        → luôn là cấp cuối khi cần (TH3)
```

- Mỗi đơn gắn 1 `OtCase` (TH1/TH2/TH3...) — `otCase.requiredApprovalLevel` quyết định cấp nào là **cấp cuối**, đủ cấp đó thì `status → Completed` ngay (không cần đi hết 3 cấp).
- **"Người tạo đơn" KHÁC "Trưởng nhóm"** (2026-07-16, đợt 4): người gọi `POST /api/OtForm` chỉ chịu trách nhiệm **nhập liệu** — đơn tạo ra ở `status = Draft`, CHƯA có chữ ký "Người đề nghị". Chữ ký này **bắt buộc phải là chữ ký thật của Trưởng nhóm**, chỉ phát sinh khi có người gọi `POST /api/OtForm/{id}/submit` (§4.1a) — có thể là chính người vừa tạo (nếu họ cũng là Trưởng nhóm) hoặc người khác cùng được cấp quyền cho Group đó. Trước khi Trưởng nhóm ký, người tạo vẫn sửa thoải mái qua `PUT /{id}` (§4.1b).
- **Trưởng Bộ phận (GroupHead, mới 2026-07-17)**: ngay sau khi Trưởng nhóm ký, đơn chuyển `status = PendingGroupHead` chứ CHƯA tới Trưởng phòng — phải có 1 người giữ Role "Trưởng Bộ phận" (được Admin gán `UserApprovalScope(approvalLevel=GroupHead)` khớp Group/Department của đơn) duyệt qua `POST /{id}/approve` thì mới chuyển tiếp sang `Pending` (chờ Trưởng phòng). **Bắt buộc cho mọi Group** — Group chưa được gán Trưởng Bộ phận thì đơn kẹt tại đây.
- **Ai duyệt được gì**: Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng chỉ duyệt đơn thuộc phạm vi được gán qua `UserApprovalScope` (Group hoặc Department cụ thể) **và** đúng cấp đang chờ. Tổng Giám Đốc **bỏ qua** `UserApprovalScope` — chỉ cần có Role `"Tổng Giám Đốc"`.
- **Ai tạo/ký được đơn cho Group nào**: `Attendance.OTForm.Create` (Role Trưởng nhóm) chỉ là điều kiện **cần** — người gọi `POST /api/OtForm` hoặc `POST /{id}/submit` còn phải có dòng `UserApprovalScope` với `approvalLevel = 0 (Submitter)` khớp `groupId`/`departmentId` của đơn, **trừ Admin bypass**. Nhờ vậy 1 Group có thể có **nhiều người** (Trưởng nhóm chính + phó nhóm dự phòng) cùng được phép tạo/ký đơn, không giới hạn đúng 1 tài khoản — nhưng **tất cả** đều phải giữ Role "Trưởng nhóm" (Admin gán `UserApprovalScope` sẽ bị chặn nếu không, xem §5).
- Ở bất kỳ cấp Trưởng phòng/Trưởng xưởng/TGĐ nào, **Reject** dừng hẳn luồng (`status → Rejected`), không đi tiếp. **Không có Reject ở bước Trưởng nhóm ký duyệt** — nếu Trưởng nhóm không đồng ý nội dung Draft, chỉ cần chưa gọi `/submit`, người tạo sửa lại qua `PUT /{id}` rồi Trưởng nhóm ký sau.
- Trước khi dùng module này, user (Trưởng nhóm/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) phải **đã được Admin**: (1) gán đúng Role qua Identity `update-user-roles`, (2) được tạo dòng `UserApprovalScope` khớp vai trò của mình — Trưởng nhóm thì `approvalLevel=Submitter` (**yêu cầu đã có Role "Trưởng nhóm"**), Trưởng phòng/Trưởng xưởng thì `approvalLevel=DepartmentManager/WorkshopManager` (mục 5). Chữ ký (`UserSignature`, mục 6) do **chính user** tự đăng ký, không phải Admin làm hộ.
- **Kênh bổ sung qua email** (2026-07-16, không thay thế luồng trong app): cập nhật chữ ký phải tự xác nhận qua email (§6b); người duyệt (Trưởng phòng/Trưởng xưởng/TGĐ) nhận email kèm link Duyệt/Từ chối mỗi khi có đơn tới lượt họ, vì cấp quản lý ít khi mở app (§4.6). Cả 2 đều cần **FE tự xây 2 trang public** (không đăng nhập SPA, bảo mật bằng token trong URL) — xem §6b, §4.6, §8.

### 1.1 Vai trò → Menu/màn hình được thấy

**Bảng tóm tắt — 6 Role nghiệp vụ, tên chính xác và CƠ CHẾ gán phạm vi của từng Role** (làm rõ để tránh nhầm lẫn — Role "Nhân viên" KHÔNG xuất hiện ở màn "Phân quyền duyệt" vì dùng cơ chế khác hẳn):

| Role (tên chính xác) | Tạo đơn? | Ký/Duyệt? | Phạm vi (Bộ phận/Phòng ban nào) cấu hình Ở ĐÂU |
|---|---|---|---|
| **Nhân viên** | ✅ chỉ cho đúng Bộ phận của chính mình | ❌ không bao giờ | **KHÔNG** qua màn "Phân quyền duyệt" — hệ thống tự suy ra từ `Employee.GroupId`. Admin cấu hình ở màn **"Quản trị danh mục" → tab Employee** (gán field `userName` = tài khoản AD của nhân viên đó vào đúng dòng Employee thuộc đúng Group) — xem §3.5, §4.1 nhánh 2 |
| **Trưởng nhóm** | ✅ cho Bộ phận được gán | ✅ chỉ cấp Submitter (ký "Người đề nghị") | Màn **"Phân quyền duyệt"** — `approvalLevel=0 Submitter`, bắt buộc `scopeType=Group` (Bộ phận) |
| **Trưởng Bộ phận** | ❌ | ✅ cấp GroupHead | Màn **"Phân quyền duyệt"** — `approvalLevel=4 GroupHead`, bắt buộc `scopeType=Group` (Bộ phận) |
| **Trưởng phòng** | ❌ | ✅ cấp DepartmentManager | Màn **"Phân quyền duyệt"** — `approvalLevel=1 DepartmentManager`, bắt buộc `scopeType=Department` (Phòng ban) |
| **Trưởng xưởng** | ❌ | ✅ cấp WorkshopManager | Màn **"Phân quyền duyệt"** — `approvalLevel=2 WorkshopManager`, bắt buộc `scopeType=Department` (Phòng ban) |
| **Tổng Giám Đốc** | ❌ | ✅ cấp cuối (khi `otCase.requiredApprovalLevel=GeneralDirector`) | **KHÔNG cần gán gì cả** — chỉ cần giữ đúng Role "Tổng Giám Đốc" trong Identity, áp dụng cho MỌI đơn cần tới cấp này, bypass hoàn toàn màn "Phân quyền duyệt" |

Vì vậy dropdown "CẤP DUYỆT" trên màn "Phân quyền duyệt" (§1.3.F, §5) chỉ có đúng **4 lựa chọn**: Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng — **không có "Nhân viên" và không có "Tổng Giám Đốc"**, cả 2 đều đúng thiết kế (không phải thiếu sót): Nhân viên cấu hình ở màn Employee, Tổng Giám Đốc không cần cấu hình gì.

FE dựng menu dựa vào `user.permissions` (không dựa `user.roles`, xem [identity-api-fe.md §3](identity-api-fe.md)). Bảng dưới liệt kê permission Attendance mỗi Role **đã được seed sẵn** — dùng để biết role nào thấy màn nào (Admin luôn thấy full, không liệt kê riêng):

> **Breaking 2026-07-17 — gộp menu "Đơn tăng ca" thành 1 mục duy nhất, chia tab bên trong**, thay cho 4 mục rời trước đây (Đơn của tôi / Chờ tôi ký duyệt / Chờ tôi duyệt / Đơn tôi đã xử lý). **Chỉ gộp ở tầng UI** — BE vẫn giữ nguyên 5 API riêng biệt (4 API cũ không đổi hành vi + 1 API mới `my-participations`), mỗi tab gọi đúng 1 API:
>
> | Tab | API | Điều kiện hiện tab |
> |---|---|---|
> | "Đơn của tôi" | `GET /my-forms` (§4.2) | có `OTForm.Create` |
> | "Chờ tôi ký duyệt" | `GET /pending-submissions` (§4.2a) | có `OTForm.Create` |
> | "Chờ tôi duyệt" | `GET /pending-approvals` (§4.2) | có `OTForm.Approve` |
> | "Đơn đã xử lý" | `GET /my-actions` (§4.2b) | luôn hiện — chỉ cần `OTForm.View` |
> | "Đơn tôi tham gia" (**mới**) | `GET /my-participations` (§4.2c) | luôn hiện — chỉ cần `OTForm.View` |
>
> Ẩn tab nào thì không gọi API tương ứng (tránh gọi API sẽ bị 403 vì thiếu permission). Mỗi dòng trong mọi tab đều có kèm `approvalSummary` (§4.2) để hiện ngay "đã được ai duyệt, đang chờ ai" trên danh sách, không cần bấm vào chi tiết.

| Role | Permission Attendance đã gán | Màn hình thấy được |
|---|---|---|
| **Trưởng nhóm** | `OTForm.Create`, `OTForm.View`, `Employee.View`, `UserSignature.Update`, `Department.View`, `Group.View`, `Reason.View`, `OtCase.View` | "Tạo đơn tăng ca", màn **"Đơn tăng ca"** với tab "Đơn của tôi" + "Chờ tôi ký duyệt" + "Đơn đã xử lý" + "Đơn tôi tham gia" (4/5 tab — **không** có tab "Chờ tôi duyệt" vì thiếu `OTForm.Approve`), "Chi tiết đơn", "Cài đặt chữ ký". Không thấy màn Danh mục (có `.View` 4 danh mục chỉ để load dropdown lúc tạo đơn, không có `.Create/.Update/.Delete`). |
| **Nhân viên** (2026-07-17) | `OTForm.Create`, `OTForm.View`, `Employee.View`, `Department.View`, `Group.View`, `Reason.View`, `OtCase.View` (giống Trưởng nhóm **trừ** `UserSignature.Update`) | "Tạo đơn tăng ca" (tạo được cho **đúng Group của chính mình** — BE suy ra qua `Employee.GroupId`, không cần Admin gán `UserApprovalScope`, xem §4.1), màn **"Đơn tăng ca"** với tab "Đơn của tôi" + "Đơn đã xử lý" + "Đơn tôi tham gia" (3/5 tab), "Chi tiết đơn" (chỉ xem, không có nút ký/duyệt nào). **Không** thấy tab "Chờ tôi ký duyệt" (không có `UserApprovalScope(Submitter)` nên luôn rỗng — ẩn hẳn tab cho gọn), **không** thấy "Cài đặt chữ ký" (không có `UserSignature.Update`) — Role này **không bao giờ ký/duyệt được**, kể cả gọi thẳng `POST /{id}/submit` cũng bị BE chặn 400. |
| **Trưởng Bộ phận / Trưởng phòng / Trưởng xưởng / Tổng Giám Đốc** | `OTForm.View`, `OTForm.Approve`, `UserSignature.Update` | Màn **"Đơn tăng ca"** với tab "Chờ tôi duyệt" + "Đơn đã xử lý" + "Đơn tôi tham gia" (3/5 tab), "Chi tiết đơn" (có nút Duyệt/Từ chối), "Cài đặt chữ ký". **Không** có `OTForm.Create` → không thấy nút "Tạo đơn" và không thấy 2 tab "Đơn của tôi"/"Chờ tôi ký duyệt"; **không** có `Employee.View` → màn của họ không cần gọi API Employee (đã có sẵn tên nhân viên trong `OtFormDto.employees`). **Trưởng Bộ phận** (mới, cấp `GroupHead`) dùng chung permission set này — về mặt UI/permission **hoàn toàn giống** Trưởng phòng/Trưởng xưởng/TGĐ, chỉ khác `approvalLevel` khi Admin gán `UserApprovalScope` (§5) và cấp đơn họ thấy trong "Chờ tôi duyệt" (`status=6 PendingGroupHead` thay vì `0/1/2`). |
| **Admin** | Toàn bộ permission `Attendance.*` | Tất cả màn ở trên (cả 5 tab) **+** "Quản trị danh mục" (Department/Group/Reason/OtCase/Employee) **+** "Phân quyền duyệt" (UserApprovalScope). Đây là role **duy nhất** thấy 2 màn quản trị này — không role nghiệp vụ nào có quyền CRUD danh mục hay tự gán `UserApprovalScope`. |

> Lưu ý quan trọng cho điều hướng: 1 user có thể **có nhiều Role cùng lúc** (VD vừa là Trưởng nhóm vừa là Trưởng phòng ở 1 case đặc biệt) — JWT gộp permission của mọi Role, nên UI nên **luôn build menu theo permission**, không giả định 1 user chỉ thuộc đúng 1 nhóm màn hình.

### 1.2 Vòng đời đơn — ma trận Trạng thái × Vai trò × Hành động UI

Đây là bảng quan trọng nhất để dựng đúng nút/badge trên màn "Chi tiết đơn" và 2 màn danh sách:

| `status` | Ý nghĩa | Badge gợi ý | Ai đang "cầm bóng" | Trưởng nhóm thấy gì | Người đang chờ duyệt thấy gì |
|---|---|---|---|---|---|
| `5 Draft` | Vừa tạo, CHƯA có chữ ký "Người đề nghị" | Xám "Nháp — chờ Trưởng nhóm ký" | Trưởng nhóm đúng scope (`approvalLevel=Submitter`) | Người tạo: sửa được (`isEditable=true`) | Trưởng nhóm: nút "Ký duyệt" (`POST /{id}/submit`) trong `pending-submissions` (§4.2a) |
| `6 PendingGroupHead` (**mới**) | Đã có chữ ký Trưởng nhóm, chờ Trưởng Bộ phận | Vàng "Chờ Trưởng Bộ phận duyệt" | Trưởng Bộ phận đúng scope (`approvalLevel=GroupHead`) | Chỉ xem, vẫn còn sửa được (`isEditable=true`) | Trưởng Bộ phận: nút Duyệt/Từ chối trong `pending-approvals` |
| `0 Pending` | Đã có chữ ký Trưởng Bộ phận, chờ Trưởng phòng | Vàng "Chờ Trưởng phòng duyệt" | Trưởng phòng đúng scope | Chỉ xem, vẫn còn sửa được (`isEditable=true`) | Trưởng phòng: nút Duyệt/Từ chối trong `pending-approvals` |
| `1 ApprovedByDepartment` | Đã qua Trưởng phòng, chờ Trưởng xưởng | Vàng "Chờ Trưởng xưởng duyệt" | Trưởng xưởng đúng scope | Chỉ xem | Trưởng xưởng: nút Duyệt/Từ chối |
| `2 ApprovedByWorkshop` | Đã qua Trưởng xưởng, chờ TGĐ | Vàng "Chờ Tổng Giám Đốc duyệt" | Tổng Giám Đốc (bất kỳ ai có Role này) | Chỉ xem | TGĐ: nút Duyệt/Từ chối |
| `3 Completed` | Đã đủ cấp theo `otCase.requiredApprovalLevel` | Xanh lá "Hoàn tất" | — (kết thúc) | Chỉ xem, hiện nút "In đơn" | Không còn hiện trong `pending-approvals` nữa |
| `4 Rejected` | Bị từ chối ở 1 cấp bất kỳ | Đỏ "Từ chối" | — (kết thúc) | Chỉ xem, đọc `comment` lý do ở dòng cuối `approvalHistories`, vẫn hiện nút "In đơn" | Không còn hiện trong `pending-approvals` nữa |

**Map badge tiện dùng** (JS, gộp từ bảng trên — FE copy thẳng để render badge trạng thái mà không cần tự suy diễn lại):
```js
const OT_FORM_STATUS_BADGE = {
  5: { text: "Nháp — chờ Trưởng nhóm ký", color: "gray" },
  6: { text: "Chờ Trưởng Bộ phận duyệt", color: "yellow" },
  0: { text: "Chờ Trưởng phòng duyệt",   color: "yellow" },
  1: { text: "Chờ Trưởng xưởng duyệt",   color: "yellow" },
  2: { text: "Chờ Tổng Giám Đốc duyệt",  color: "yellow" },
  3: { text: "Hoàn tất",                 color: "green" },
  4: { text: "Từ chối",                  color: "red" },
};
```

Quy tắc dựng nút chung cho màn "Chi tiết đơn" (`GET /{id}`):
- Nút **"Ký duyệt"** (Trưởng nhóm, mới đợt 4) chỉ hiện khi `status = 5 (Draft)` **và** user hiện tại có permission `OTForm.Create` **và** có `UserApprovalScope(approvalLevel=Submitter)` khớp group/department của đơn (hoặc Admin). Đơn giản nhất: **chỉ hiện khi đơn này có mặt trong `GET /pending-submissions` của user hiện tại** (§4.2a — endpoint riêng, không phải `pending-approvals`). Bấm → gọi `POST /api/OtForm/{id}/submit`, không cần canvas ký (chữ ký tự lấy từ `UserSignature` đã đăng ký).
- Nút **Duyệt/Từ chối** chỉ hiện khi: `status` đang ở 1 trong 4 giá trị `6/0/1/2` **và** user hiện tại có permission `OTForm.Approve` **và** (là TGĐ khi `status=2`, hoặc có `UserApprovalScope` khớp cấp tương ứng khi `status=6/0/1` — `6→GroupHead`, `0→DepartmentManager`, `1→WorkshopManager`). FE không cần tự tính khớp scope — cứ hiện nút nếu đơn xuất hiện trong `pending-approvals`/gọi approve mà BE trả 400 thì ẩn nút + báo lỗi, đơn giản nhất là: **chỉ hiện nút Duyệt/Từ chối khi đơn này có mặt trong `GET /pending-approvals` của user hiện tại**. Gọi `/approve`/`/reject` (không phải `/submit`) trên đơn `status=5 Draft` sẽ bị BE chặn với lỗi rõ ràng — FE không nên để lọt trường hợp này (dùng đúng nút "Ký duyệt" ở trên).
- Nút **Sửa** (2026-07-16) chỉ hiện khi `otFormDto.isEditable == true` (tương đương `status` là `5 Draft`, `6 PendingGroupHead` **hoặc** `0 Pending`) **và** `createdByUserName == user hiện tại` **và** user có permission `OTForm.Create`. Qua cấp Trưởng phòng trở lên là `isEditable = false` vĩnh viễn — khóa cứng, không có cách nào sửa lại được nữa (kể cả Admin), chỉ có thể Reject rồi tạo đơn mới. Bấm "Sửa" → mở lại form "Tạo đơn tăng ca" (đổ dữ liệu có sẵn), nhưng **giờ chỉ còn sửa được giờ kết thúc từng nhân viên** (2026-07-31, xem §4.1b) — mọi field khác disabled chỉ để xem, submit gọi `PUT /api/OtForm/{id}` với body rút gọn thay vì `POST`.
- Nút **In đơn** (2026-07-29, chốt lại) — hiện ở **MỌI trạng thái**, không riêng `Completed`, để người tạo/người duyệt có thể in/xuất PDF tạm ngay từ lúc `Draft` (xem trước bố cục, đưa bản giấy cho các cấp chưa dùng app ký tay ngoài luồng) chứ không phải đợi đơn xử lý xong. Các ô chữ ký của cấp chưa duyệt tới thì để trống (không có `approvalHistories` khớp cấp đó) — `OtFormPrintView`/`SignatureCell` đã tự xử lý việc này, không cần logic mới.
- `status = 4 (Rejected)` → ẩn hết nút hành động, chỉ còn xem lý do từ chối (`comment` ở dòng `approvalHistories` cuối, không có `signatureImage` vì Reject không ký).

### 1.3 Wireframe từng màn hình (bố cục gợi ý, FE tự do style)

**A. "Tạo đơn tăng ca"** (Trưởng nhóm, `OTForm.Create`) — dùng chung layout này cho cả "Sửa đơn" (đổ sẵn dữ liệu từ `GET /{id}`, submit gọi `PUT /{id}` thay vì `POST`)
```
[Phòng ban ▾] [Bộ phận ▾ (phụ thuộc Phòng ban)] [Lý do ▾] [Trường hợp OT ▾]
     ↑ Với Nhân viên/Trưởng nhóm: gọi GET /my-create-scopes (§4.0a) TRƯỚC khi mở form này — có đúng
       1 phần tử thì tự điền sẵn + khóa cả 2 dropdown này (không cần chọn); nhiều phần tử thì Bộ phận
       chỉ liệt kê đúng các phần tử trả về (không phải toàn bộ Group/by-department). Admin (mảng rỗng)
       vẫn dùng cascading dropdown tự do như mô tả bên dưới.
[Ngày OT] [Giờ bắt đầu] [Giờ kết thúc] [Tổng giờ] [Ghi chú phụ (subReason)]
     ↑ "Giờ bắt đầu/kết thúc" ở đây là KHUNG GIỜ TỐI ĐA của cả đơn — StartTime của
       từng nhân viên bên dưới LUÔN ăn theo giờ này (không sửa được riêng); EndTime
       của từng nhân viên không được vượt quá "Giờ kết thúc" ở đây.
──────────────────────────────────────────────
Danh sách nhân viên nhóm đã chọn (checkbox chọn nhiều + giờ riêng từng người)
Lũy kế hiện tại lấy từ Employee/by-group/{groupId} — hiển thị NGAY khi chọn để Trưởng
Group tự cân nhắc trước khi gửi (vd sắp vượt ngưỡng tháng cấu hình thì nên chọn OtCase TH3
— ngưỡng đọc từ GET /AttendanceSetting, mặc định 25h/tháng·300h/năm, xem §6d).
[ ] NV001 - Nguyễn Văn A   (Lũy kế: 12.5h/tháng, 80h/năm)
       Giờ kết thúc [_] (mặc định = Giờ kết thúc đơn, cho sửa nhỏ hơn)   Ghi chú [_]
[ ] NV002 - Trần Thị B     (Lũy kế: 20.0h/tháng, 150h/năm)  ...
──────────────────────────────────────────────
Phát sinh khác (ProcessPart, optional): [ ] Ăn  [ ] Xe đưa đón  [ ] Dùng phòng photo   Đề xuất khác: [___]
     ↑ Gợi ý tick "Ăn": ở màn Chi tiết đơn, mỗi nhân viên có cờ `isEligibleForMeal`
       (giờ OT thực tế > 2h) — FE có thể hiện gợi ý nhưng không bắt buộc theo.
     ↑ Tick "Ăn" xong hiện thêm 3 ô nhập số lượng (2026-07-16, nhập tay, chung cho cả
       đơn — không phải theo từng người): Phiếu chính [_] Phiếu phụ [_] Sữa [_]
       (mainTicketCount/secondaryTicketCount/milkCount, mặc định 0).
──────────────────────────────────────────────
[ Hủy ]                                                    [ Tạo đơn (nháp) ] / [ Lưu thay đổi ]
```
> Màn này **không có bước ký** — từ đợt 4 (2026-07-16), tạo đơn chỉ ra `status=Draft`, chữ ký "Người đề nghị" chuyển sang màn riêng "Chờ tôi ký duyệt" → nút "Ký duyệt" (§1.3.B, §4.1a), và chữ ký luôn tự lấy từ ảnh đã đăng ký sẵn ở "Cài đặt chữ ký" — không có ô ký/canvas nào trong màn tạo đơn.
Sau khi "Tạo đơn (nháp)"/"Lưu thay đổi" thành công → điều hướng sang "Chi tiết đơn" luôn (dùng `data` trả về từ `POST`/`PUT`).
Màn "Sửa đơn" chỉ mở được khi `isEditable = true` (xem §1.2) — nếu user cố mở khi đã bị khóa, ẩn hẳn nút "Sửa" thay vì để bấm rồi nhận lỗi 400.

**B. "Đơn tăng ca"** (1 màn duy nhất, 5 tab bên trong — gộp 2026-07-17, xem bảng tab ở §1.1, ẩn tab nào thiếu permission tương ứng)
```
[ Đơn của tôi | Chờ tôi ký duyệt | Chờ tôi duyệt | Đơn đã xử lý | Đơn tôi tham gia ]  ← tab, ẩn theo permission
[Tìm kiếm theo trạng thái?] (tùy chọn, API không hỗ trợ filter status — FE tự filter client-side nếu cần)
┌────┬─────────┬───────────┬────────┬──────┬────────┬────────────┬─────────────────┬──────────────────────┐
│ Mã │ Nhóm    │ Bộ phận   │ TH     │ Ngày │ Tổng giờ│ Số NV     │ Trạng thái       │ Tiến độ duyệt         │
├────┼─────────┼───────────┼────────┼──────┼────────┼────────────┼─────────────────┼──────────────────────┤
│ 10 │ Nhóm 1  │ Xưởng LR  │ TH1    │ 15/7 │ 2.0     │ 1          │ 🟡 Chờ TP duyệt  │ ✓ Ng.Văn A (Trg nhóm)│  ← click vào dòng → Chi tiết
└────┴─────────┴───────────┴────────┴──────┴────────┴────────────┴─────────────────┴──────────────────────┘
```
Mỗi tab gọi đúng 1 API riêng (không đổi hành vi các API cũ, chỉ gộp UI): "Đơn của tôi" → `GET /my-forms`; "Chờ tôi ký duyệt" → `GET /pending-submissions` (§4.2a, đơn Draft); "Chờ tôi duyệt" → `GET /pending-approvals` (KHÔNG gồm Draft); "Đơn đã xử lý" → `GET /my-actions` (§4.2b — đơn đã Ký/Duyệt/Từ chối, không phân biệt cấp); "Đơn tôi tham gia" (**mới**) → `GET /my-participations` (§4.2c — đơn mình CÓ TÊN trong danh sách tăng ca dù không tạo/ký/duyệt).

Cột "Tiến độ duyệt" render từ `approvalSummary[]` (mảng, mỗi phần tử = 1 lần Ký/Duyệt/Từ chối, sắp theo thời gian) — ví dụ FE hiện dạng chuỗi rút gọn "✓ Tên (Cấp)" cho từng phần tử đã có, rồi nối thêm "đang chờ {cấp kế tiếp suy từ `status`, xem bảng mapping status→cấp đang chờ ở §4.3}" nếu `status` chưa `Completed`/`Rejected`. Không cần gọi `GET /{id}` chỉ để biết đã duyệt tới đâu.

**C. "Chi tiết đơn"** (dùng chung mọi role, đổi phần action theo §1.2)
```
[Badge trạng thái]                                    [Nút "Sửa" nếu isEditable] [Nút "In đơn" — luôn hiện, mọi trạng thái]
Bộ phận / Nhóm / Lý do / Trường hợp OT / Ngày / Giờ / Tổng giờ / Người tạo (createdByFullName ?? createdByUserName)
──────────────────────────────────────────────
Danh sách nhân viên đã đăng ký (bảng, chỉ sửa được qua màn "Sửa đơn" lúc isEditable=true)
┌──────────┬────────────┬───────┬───────┬────────────┬────────────┬──────────────┐
│ Mã NV    │ Họ tên     │ Giờ BĐ│ Giờ KT│ Lũy kế tháng│ Lũy kế năm │ Phiếu ăn     │
├──────────┼────────────┼───────┼───────┼────────────┼────────────┼──────────────┤
│ NV001    │ Nguyễn Văn A│ 17:30│ 19:30 │ 12.5h      │ 80h        │ ✅ (>2h)     │
└──────────┴────────────┴───────┴───────┴────────────┴────────────┴──────────────┘
  ↑ "Lũy kế tháng/năm" lấy TRỰC TIẾP từ employees[].monthToDate/yearToDate — đây là
    giá trị HIỆN TẠI (live) của nhân viên, không phải snapshot lúc tạo đơn, giúp người
    duyệt đối chiếu ngưỡng TH3 (mặc định >25h/tháng, >300h/năm — đọc từ GET /AttendanceSetting,
    Admin sửa được, xem §6d) ngay tại đây, không cần mở màn Employee.
  ↑ "Phiếu ăn" = employees[].isEligibleForMeal (giờ KT - giờ BĐ >= ngưỡng cấu hình, mặc định
    2.5h — xem §6d), chỉ mang tính tham khảo hiển thị — không quyết định ProcessPart.isEat
    (cờ đó do người lập đơn tự tick, FE tự tính gợi ý mainTicketCount/secondaryTicketCount).
──────────────────────────────────────────────
Phát sinh khác (ProcessPart, nếu có)
──────────────────────────────────────────────
Timeline duyệt (approvalHistories, sort theo thời gian):
  ● Submitted   — Nguyễn Văn A (Trưởng nhóm)     15/07 08:00   [ảnh chữ ký]
  ● Approved    — Trần Văn B (Trưởng phòng)        15/07 09:00   [ảnh chữ ký]  "Đồng ý"
  ○ (đang chờ Trưởng xưởng...)
──────────────────────────────────────────────
[Nếu đang chờ CHÍNH user này duyệt/ký]
  [ Từ chối ]                                              [ Duyệt ]
```
Bấm "Ký duyệt"/"Duyệt"/"Từ chối" đều mở 1 popup xác nhận riêng (không sửa trực tiếp trên trang) — ô "Ghi chú" trong popup **bắt buộc** khi Từ chối, tuỳ chọn khi Ký duyệt/Duyệt (chữ ký tự lấy từ "Cài đặt chữ ký", không có canvas ký; nếu `otCase.requireSignature=true` mà chưa đăng ký chữ ký → nhắc user qua "Cài đặt chữ ký" trước khi cho bấm xác nhận trong popup). Trang public "Xác nhận duyệt đơn qua email" (§4.6, §6b) áp dụng cùng nguyên tắc cho riêng nút Từ chối (2026-07-29) — xem §4.6.
Dòng "○ (đang chờ...)" chỉ là gợi ý UX — suy từ `status` theo bảng §1.2, không có sẵn trong API (API chỉ trả các dòng **đã xảy ra** trong `approvalHistories`).

**D. "Cài đặt chữ ký"** (mọi role có `UserSignature.Update`, tức mọi role nghiệp vụ)
```
Chữ ký hiện tại: [ảnh preview, hoặc "Chưa đăng ký"]
Tải ảnh chữ ký mới lên: [ Chọn file ảnh (PNG/JPG)... ]  → preview ảnh vừa chọn   [ Xóa ]  [ Lưu ]
```
> **Upload file ảnh, KHÔNG phải canvas ký bằng chuột/tay** — chữ ký là ảnh chụp/scan chữ ký tay thật của người dùng (ký sẵn trên giấy, chụp lại hoặc scan), FE chỉ cần `<input type="file" accept="image/*">` rồi convert sang base64 gửi lên, không cần vẽ vời gì trên web. Bấm "Lưu" gọi `PUT /me` — **không** áp dụng ngay (xem §6b, cần xác nhận qua email).

**E. "Quản trị danh mục"** (chỉ Admin) — 5 tab con Department/Group/Reason/OtCase/Employee, mỗi tab là bảng CRUD chuẩn (grid-list + form thêm/sửa) — xem mẫu ở §3, không có gì đặc biệt về UX. Tab Employee có thêm nút "Import Excel" mở màn riêng (§3.7, §8) — chọn file → xem preview → xác nhận.

**F. "Phân quyền duyệt"** (chỉ Admin) — bảng `UserApprovalScope` (grid-list), mỗi dòng hiện **`userFullName ?? userName`** (tên thật, không phải tài khoản AD thô — xem §5) + `scopeName` (tên Group/Department) + `approvalLevel` (Submitter/DepartmentManager/WorkshopManager/GroupHead) để Admin nhìn ra ngay "ai đang là Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng của group/bộ phận nào" + form thêm mới + nút xóa từng dòng. Không có nút Sửa (theo đúng API, xem §5).
```
Form thêm mới (gợi ý, xử lý gợi ý Group tự động — mới 2026-07-17):
[Chọn user (userName) ▾/gõ tìm]
   → sau khi chọn, gọi ngầm GET /api/Employee/by-username/{userName} (§3.5):
     - 200 → tự động điền sẵn "Bộ phận: {groupNameVn}" (readonly, kèm nút "Đổi") — gợi ý cho Admin,
       KHÔNG tự submit hộ, Admin vẫn bấm Lưu để xác nhận.
     - 404 → không điền gì (thường gặp với Trưởng phòng/Trưởng xưởng/TGĐ/Trưởng Bộ phận — họ không
       nhất thiết có hồ sơ Employee), Admin tự chọn ScopeType/Scope thủ công như trước giờ.
[ScopeType: Group / Department ▾]   [Scope cụ thể ▾ (đổ theo ScopeType, đã gợi ý sẵn nếu có ở trên)]
[ApprovalLevel: Submitter / GroupHead / DepartmentManager / WorkshopManager ▾]
[ Lưu ]
```

### 1.4 Sơ đồ điều hướng tổng thể (menu tree gợi ý)

```
Giấy tăng ca (Attendance)
├── Tạo đơn tăng ca          [Trưởng nhóm, Nhân viên]
├── Đơn tăng ca              [mọi role nghiệp vụ]  (1 mục, 5 tab bên trong — gộp 2026-07-17, xem §1.1/§1.3.B)
│     ├── Đơn của tôi              [có OTForm.Create]
│     ├── Chờ tôi ký duyệt         [có OTForm.Create]  (đơn Draft — GET /pending-submissions, §4.2a)
│     ├── Chờ tôi duyệt            [có OTForm.Approve]
│     ├── Đơn đã xử lý             [mọi role]  (GET /my-actions, §4.2b)
│     └── Đơn tôi tham gia (mới)   [mọi role]  (GET /my-participations, §4.2c)
├── Đơn tổng (mới, 2026-08-06)  [có OTForm.Approve]  (GET /api/OtFormBatch/grid-list, §6e — dự phòng cho kênh email)
├── Cài đặt chữ ký           [mọi role nghiệp vụ]
└── Quản trị (Admin)
    ├── Danh mục (Bộ phận / Nhóm / Lý do / Trường hợp OT / Nhân viên)
    ├── Import nhân sự (Excel)
    └── Phân quyền duyệt
```
> **"Sửa đơn tăng ca" KHÔNG phải menu riêng** — chỉ là nút "Sửa" xuất hiện trong tab "Đơn của tôi"/"Chi tiết đơn" khi `isEditable = true`, mở lại đúng form "Tạo đơn tăng ca" (§1.3.A) với dữ liệu có sẵn.
> **"Lũy kế của tôi" đã xoá hẳn (2026-08-08)** — xem §3.6, chỉ Admin còn chỉnh được lũy kế, qua `PUT /Employee/{id}`.
> **3 trang "Xác nhận cập nhật chữ ký" / "Xác nhận duyệt đơn qua email" / "Xác nhận duyệt đơn tổng qua email" (§6b, §4.6, §6e) KHÔNG nằm trong sơ đồ menu này** — đây là route **public**, chỉ mở qua link trong email, không cần đăng nhập SPA và không hiện trong bất kỳ menu điều hướng nào.

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
  "monthToDate": 12.5, "yearToDate": 80.0,
  "accumulationYear": 2026, "accumulationMonth": 7, // tháng/năm mà monthToDate/yearToDate đang phản ánh
  "projectedMonthToDate": 14.5, "projectedYearToDate": 82.0, // MỚI 2026-08-06, xem §3.5b — dự kiến
  "groupId": 5, "groupNameVn": "Nhóm 1",           // cả 2 nullable từ 2026-08-08, xem ngay dưới
  "departmentId": null, "departmentNameVn": null,  // MỚI 2026-08-08
  "jobTitleId": 11, "jobTitleName": "Manager" }    // nullable, MỚI 2026-08-06 — xem §3.4b
```
POST/PUT: `code`[Required], `firstName`[Required], `lastName`[Required], `userName?` (optional — gán tài khoản AD để liên kết nhân viên với đúng người tạo/duyệt đơn OT, xem §3.5), `monthToDate`, `yearToDate` (decimal, giờ OT lũy kế — dùng để cảnh báo TH3 vượt 25h/tháng hoặc 300h/năm), `groupId?`/`departmentId?`, `jobTitleId?` (optional, MỚI 2026-08-06 — id không tồn tại/đã xóa → 404). Trùng `userName` với nhân viên khác (kể cả đang active) → 400. `projectedMonthToDate`/`projectedYearToDate` là field **chỉ đọc** (response only) — không có trong POST/PUT body.

**`groupId`/`departmentId` — đúng 1 trong 2 (hoặc cả 2 đều bỏ trống), tuỳ `TerminalLevel` của `jobTitleId` (2026-08-08, breaking so với trước — trước đó `groupId` luôn bắt buộc)**, validate ở `EmployeeService.ValidateOrganizationAssignmentAsync`, sai tổ hợp → 400 message cụ thể:
| `jobTitleId` chưa gán / Chức vụ `TerminalLevel=None` | `TerminalLevel=DepartmentManager` (Trưởng phòng) | `TerminalLevel=WorkshopManager`/`GeneralDirector` (Trưởng Xưởng/Giám đốc) |
|---|---|---|
| `groupId` **bắt buộc**, `departmentId` phải bỏ trống | `departmentId` **bắt buộc**, `groupId` phải bỏ trống | Cả 2 đều phải bỏ trống — dùng chung toàn công ty |

FE `EmployeeForm.tsx` (2026-08-08): chọn **Chức vụ trước**, dropdown Bộ phận/Phòng ban hiện đúng 1 trong 2 (hoặc ẩn cả 2 kèm ghi chú "dùng chung toàn công ty") theo `JobTitleDto.terminalLevel` của lựa chọn — đổi Chức vụ giữa 3 nhóm tự reset field cũ.

**Chọn nhân viên hàng loạt khi lập đơn**: `GET /api/Employee/by-group/{groupId}` → `EmployeeDto[]` toàn bộ nhân viên nhóm đó (Trưởng nhóm tick chọn nhiều người cho `CreateOtFormDto.employees`) — FE dùng **`projectedMonthToDate`/`projectedYearToDate`** (KHÔNG dùng `monthToDate`/`yearToDate`) để cảnh báo hạn mức TH3 ngay lúc chọn (§1.3.A, §3.5b).

**Toàn bộ nhân viên active (mọi Group)**: `GET /api/Employee/all` (`Attendance.Employee.View`, mới 2026-08-06) → `EmployeeDto[]` — dùng cho dropdown/công cụ cần chọn 1 nhân viên bất kỳ không giới hạn theo Group. Trước đó FE (`EmployeeApi.getAllEmployees()`) đã gọi sẵn route này nhưng BE chưa có action khớp — request rơi vào `GET /{id}` với `id="all"`, trả 400 `"The value 'all' is not valid"`; đã bổ sung action thật.

**Toàn bộ nhân viên active thuộc 1 Phòng ban (mọi Group con)**: `GET /api/Employee/by-department/{departmentId}` (`Attendance.Employee.View`, mới 2026-08-07) → `EmployeeDto[]`. Dùng ở khối "Cây duyệt Bộ phận" trong tab "Cây duyệt" (`ApprovalStepManager.tsx`) để: (a) hiện ngay dưới mỗi bước ai đang giữ Chức vụ đó trong Phòng ban, (b) gán nhanh `jobTitleId` cho từng nhân viên ngay tại màn này (gọi lại `PUT /api/Employee/{id}` bình thường, giữ nguyên field khác) — không cần chuyển qua màn "Nhân viên" riêng.

**Lọc `grid-list` theo Phòng ban/Bộ phận** (mới 2026-08-07): `GET /api/Employee/grid-list?...&DepartmentId=&GroupId=` — 2 query param optional, dùng cho ô lọc trên màn "Nhân viên" để dễ tìm đúng nhóm người cần gán Chức vụ trước khi cấu hình cây duyệt. `DepartmentId` lọc qua `Group.DepartmentId` (không cần biết Group con); `GroupId` lọc chính xác 1 Group; có thể kết hợp cả 2 (thực tế `GroupId` đã đủ hẹp, `DepartmentId` chỉ còn tác dụng lọc thô).

### 3.5b Lũy kế DỰ KIẾN — `projectedMonthToDate`/`projectedYearToDate` (2026-08-06)

`monthToDate`/`yearToDate` chỉ cộng khi đơn OT đạt `Completed` (xem [attendance-module.md §Lũy kế tháng/năm](attendance-module.md)) — nên nếu nhân viên đang có 1 đơn khác chưa được duyệt xong, hạn mức không phản ánh được phần đó, dễ gây trường hợp tạo 2 đơn cùng lúc mà đơn nào cũng không thấy cảnh báo vượt hạn mức. `projectedMonthToDate`/`projectedYearToDate` giải quyết việc này: cộng ngay khi đơn được **tạo** (bất kể đơn đang ở trạng thái chưa duyệt nào), trừ lại khi đơn bị **Rejected** hoặc khi 1 người bị **loại khỏi đơn**, điều chỉnh chênh lệch khi sửa "thực tích"/DidEat trước khi Trưởng phòng duyệt. Chi tiết cơ chế xem [attendance-module.md §Lũy kế dự kiến](attendance-module.md).

FE dùng field nào ở đâu:
- **`GET /api/Employee/by-group/{groupId}`** (chọn nhân viên lúc TẠO đơn mới) → dùng `projectedMonthToDate`/`projectedYearToDate`.
- **`OtFormEmployeeDto.monthToDate`/`yearToDate`** (§4.3, hiện trên 1 đơn cụ thể — chi tiết/sửa/PDF/email) → vẫn 2 tên field cũ, nhưng từ 2026-08-06 là **snapshot lũy kế dự kiến** (không phải thực tế) tại thời điểm tạo đơn, TRƯỚC khi cộng chính đơn đó — không đổi tên field, chỉ đổi nguồn.
- Màn quản lý nhân viên (`EmployeeList`, Admin sửa qua `PUT /Employee/{id}`) vẫn dùng `monthToDate`/`yearToDate` (thực tế) như cũ — không liên quan tới 1 đơn cụ thể nào.

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
`yearTotalHours` = tổng `months[].totalHours` — với năm CŨ (đã rollover) đây là **nguồn DUY NHẤT** để
biết tổng giờ cả năm đó, vì `Employee.yearToDate` chỉ còn phản ánh năm hiện tại. Với năm hiện tại, giá
trị này luôn khớp `Employee.yearToDate` (cùng 1 điểm ghi — `OtFormService.AccumulateEmployeeHoursAsync`).
Sai đơn vị (khác Nhóm/Bộ phận người gọi quản lý) → 400.

**FE:** `AccumulationHistoryTable.tsx` (bảng 12 tháng, tô đỏ theo `AttendanceSetting.monthlyOtHourLimit`/
`yearlyOtHourLimit` giống `EmployeeList.tsx`) + `AccumulationHistoryModal.tsx` (modal chọn năm, dùng
chung ở cả 3 nơi) — nút trong `EmployeeList.tsx` (Admin), icon cạnh cột Lũy kế năm trong
`OtFormDetail.tsx` (theo `canApprove`), và màn mới `/ot/accumulation` (`AccumulationLookupPage.tsx`,
gọi `GET /in-my-scope` tự tìm nhân viên, không cần mở sẵn 1 đơn) — sidebar mục "Lũy kế nhân viên", cùng
điều kiện quyền với "Đơn tổng".

### 3.6 Điều chỉnh lũy kế thủ công — ĐÃ XOÁ (2026-08-08), CHỈ CÒN Admin qua `PUT /Employee/{id}`

Trước đây `PATCH /api/Employee/{id}/adjust-accumulation` + `GET /api/Employee/me` cho phép **chính nhân
viên tự chỉnh** `monthToDate`/`yearToDate` của mình (màn "Lũy kế của tôi", không gắn permission
`Attendance.Employee.*`, mọi user đăng nhập đều gọi được). Người dùng chốt bỏ hẳn khả năng tự chỉnh này
("user không thể tự thay đổi lũy kế của họ được, việc này do Admin đảm nhận") — cả 2 endpoint trên
**đã xoá hoàn toàn** (404), route FE `/ot/accumulation` + mục sidebar "Lũy kế của tôi" cũng đã gỡ. Muốn
sửa `monthToDate`/`yearToDate` giờ chỉ còn 1 đường: **Admin** gọi `PUT /api/Employee/{id}`
(`UpdateEmployeeDto`, `Attendance.Employee.Update`) — field này vốn đã có sẵn trong form Sửa nhân viên
(§3.5), không cần gọi API riêng.

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

## 4. OtForm (`/api/OtForm`) — nghiệp vụ chính

> **⚠ Giai đoạn 3.1 (2026-08-07)** — bảng route và các mục §4.1a/§4.2a bên dưới đã lỗi thời ở phần mô
> tả Draft/Submitter/GroupHead. Đã sửa trực tiếp trong bảng route; các mục con giữ nguyên nội dung cũ
> làm tư liệu lịch sử NHƯNG được đánh dấu rõ — xem §Cây chức vụ ở `attendance-module.md` cho model hiện tại.

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtForm/my-create-scopes` | `Attendance.OTForm.Create` | Bộ phận/Phòng ban mà **chính mình** được phép tạo đơn (tối đa 1 phần tử) — gọi TRƯỚC khi mở màn "Tạo đơn tăng ca" (§4.0a) |
| POST | `/api/OtForm` | `Attendance.OTForm.Create` | Tạo đơn — vào chuỗi duyệt Cây chức vụ **ngay lập tức** (`status=InApproval`, hoặc `Completed` nếu chuỗi rỗng), không còn Draft (§4.1) |
| GET | `/api/OtForm/my-forms?pageIndex=&pageSize=` | `Attendance.OTForm.View` | Đơn do **chính mình** tạo |
| GET | `/api/OtForm/pending-approvals?pageIndex=&pageSize=` | `Attendance.OTForm.Approve` | Đơn đang **chờ chính mình** xử lý — tự lọc theo bước hiện tại (`Status=Pending`, `StepOrder` nhỏ nhất) có mặt trong `Candidates`; mỗi item có `currentStepCandidateCount` (§4.2, mới 2026-08-08) |
| GET | `/api/OtForm/my-actions?pageIndex=&pageSize=` | `Attendance.OTForm.View` | Lịch sử đơn **chính mình đã xử lý** (Ký/Duyệt/Từ chối) ở bất kỳ bước nào (§4.2b) |
| GET | `/api/OtForm/{id}` | `Attendance.OTForm.View` | Chi tiết đầy đủ 1 đơn, gồm `approvalSteps[]` (mới) |
| PUT | `/api/OtForm/{id}` | `Attendance.OTForm.Create` | Sửa đơn — chỉ còn giờ kết thúc từng nhân viên, chỉ chính người tạo, chỉ khi `status=InApproval` VÀ chưa bước nào `Approved` (§4.1b) |
| POST | `/api/OtForm/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt "bước đang chờ" hiện tại — tự cộng lũy kế nhân viên nếu đạt Completed |
| POST | `/api/OtForm/{id}/reject` | `Attendance.OTForm.Approve` | Từ chối đơn ở bước đang chờ (dừng luồng, các bước Pending còn lại chuyển Skipped) |
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

### 4.1 `POST /api/OtForm` — Tạo đơn
```jsonc
// body — CreateOtFormDto
{
  "groupId": 5, "departmentId": 1, "reasonId": 2, "otCaseId": 1,             // [Required]
  "startTime": "17:30:00", "endTime": "19:30:00",                            // TimeOnly, chuỗi "HH:mm:ss" — đây là khung giờ TỐI ĐA của đơn
  "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15",                                    // [Required], DateOnly "yyyy-MM-dd"
  "employees": [                                                             // [Required][MinLength(1)]
    { "employeeId": 100, "endTime": "19:30:00", "noteVn": null, "noteJp": null }
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null } // optional, cả object hoặc null
}
```
- **`employees[].startTime` KHÔNG còn tồn tại** (bỏ từ 2026-07-16) — giờ bắt đầu của từng nhân viên LUÔN bằng `startTime` của đơn, BE tự set, FE không gửi lên nữa.
- `employees[].endTime` do FE cho phép chỉnh riêng từng người, nhưng phải **> `startTime` của đơn** và **<= `endTime` của đơn** — sai thì 400 (`DomainException`, kèm mã nhân viên vi phạm trong message).
- `employees[].employeeId` **phải cùng `groupId`** với đơn — khác nhóm → 400 (`DomainException`).
- **`departmentId` phải đúng là Department của `groupId` đã chọn** (`Group.DepartmentId`, mới 2026-07-17) — gửi cặp `groupId`/`departmentId` không khớp nhau → 400 "Nhóm '...' không thuộc Bộ phận đã chọn." Dùng đúng cascading dropdown §3.2 (chọn Department trước, Group lọc theo `by-department/{id}`) sẽ không bao giờ gặp lỗi này.
- **KHÔNG có field chữ ký nào trong body** — chữ ký (nếu bước nào đó trong chuỗi yêu cầu) chỉ bắt buộc lúc Duyệt (§4.4), không phải lúc tạo. Đơn vào chuỗi duyệt **ngay lập tức** (`status=InApproval`), hoặc `status=Completed` ngay nếu chuỗi rỗng (người tạo đã ở cấp cao nhất áp dụng cho `otCaseId` đó) — không còn khái niệm Draft. `approvalHistories` của response sẽ **rỗng** (chưa ai duyệt).
- **`processPart.mainTicketCount`/`secondaryTicketCount`/`milkCount`** (số nguyên `int`, mặc định `0`) — số lượng phiếu ăn theo loại (phiếu chính/phiếu phụ/sữa), chỉ có ý nghĩa khi `isEat = true`. Người lập đơn **tự nhập tay 3 ô số lượng này** cho **cả đơn** (không phải theo từng nhân viên) — BE không tự tính, không validate tổng khớp `numberOfEmployee` hay `employees[].isEligibleForMeal`. FE nên ẩn 3 ô này khi `isEat = false`.
- **Điều kiện được phép tạo** (đổi 2026-08-07, Giai đoạn 3.1 — bỏ nhánh `UserApprovalScope(Submitter)`): tài khoản đang gọi API phải được liên kết với 1 `Employee` (`Employee.UserName`) có **đúng `groupId` với đơn**, hoặc là Admin (không giới hạn phạm vi). Không thoả → 400 (`DomainException` "Bạn chỉ được tạo/sửa đơn cho đúng Nhóm/Bộ phận của mình..."). Employee liên kết với người tạo cũng chính là cơ sở để suy luận chuỗi duyệt (Admin tạo hộ thì coi như cấp thấp nhất — chuỗi vẫn chạy đầy đủ từ bước đầu của Department).
- **Chuỗi duyệt không đủ KHÔNG chặn tạo đơn** — nếu Department chưa cấu hình cây duyệt, hoặc thiếu người giữ đúng Chức vụ ở 1 bước nào đó, đơn vẫn được tạo với chuỗi cắt cụt tới đâu hay tới đó; `response.data.approvalChainWarning` (string, `null` nếu đủ) cho biết lý do cụ thể — FE hiện banner cảnh báo trên màn chi tiết đơn khi field này khác `null` (xem §4.3).
- Response `201 Created` (Location header trỏ `GET /{id}`), `data` = `OtFormDto` (§4.3) đầy đủ luôn — không cần gọi lại `GetById`.

### 4.1a `POST /api/OtForm/{id}/submit` — ĐÃ XOÁ (2026-08-07, Giai đoạn 3.1)

Endpoint này **không còn tồn tại** — khái niệm "Trưởng nhóm ký duyệt Người đề nghị"/Draft đã bị xoá bỏ
hoàn toàn, thay bằng chuỗi duyệt tự động theo Cây chức vụ bắt đầu ngay từ lúc tạo đơn (§4.1). FE nào
còn gọi endpoint này sẽ nhận 404.

### 4.1b `PUT /api/OtForm/{id}` — Sửa đơn (2026-07-16, **giới hạn lại 2026-07-31**)

**Breaking 2026-07-31**: trước đây `UpdateOtFormDto` giống hệt `CreateOtFormDto` (sửa được toàn bộ đơn). Người dùng chốt lại: đơn chỉ nên sửa được **"thực tích của nhân viên"** (giờ kết thúc OT thực tế từng người) — mọi field khác và cả danh sách nhân viên đều khoá cứng sau khi tạo. Body giờ CHỈ còn:
```jsonc
// UpdateOtFormDto — CHỈ còn field này, không còn groupId/departmentId/reasonId/otCaseId/date/
// startTime/endTime/subReason/totalHour/processPart/noteVn/noteJp nào nữa.
{
  "employees": [
    { "employeeId": 100, "endTime": "20:00:00" },
    { "employeeId": 101, "endTime": "19:30:00" }
  ]
}
```
- Chỉ **chính người tạo đơn** (`createdByUserName` khớp user gọi) mới gọi được — người khác gọi (kể cả Admin) → 400.
- Chỉ khi `status == InApproval` **VÀ chưa bước nào trong `approvalSteps[]` có `status=Approved`** (2026-08-07, Giai đoạn 3.1 — thay cho điều kiện `Draft/PendingGroupHead/Pending` cũ) — đã có bước nào duyệt xong thì 400 "Đơn đã có bước duyệt được xử lý, không thể sửa nữa." FE nên chặn từ trước bằng `isEditable` (xem §1.2/§4.3), không đợi BE trả lỗi.
- **`employees[]` phải khớp CHÍNH XÁC tập nhân viên đang active của đơn** (`OtFormEmployee.IsRemoved == false`) — thiếu người, thừa người, gửi trùng `employeeId`, hoặc gửi `employeeId` đã bị 1 cấp duyệt loại khỏi đơn (§4.5a) đều bị từ chối 400 ngay ("Danh sách nhân viên trong đơn đã thay đổi — không thể thêm/bớt người khi sửa đơn, chỉ được sửa giờ kết thúc của từng người."). Muốn bớt người dùng riêng `POST /{id}/employees/remove` (§4.5a), **không** qua endpoint này nữa.
- Mỗi `endTime` vẫn validate `> otForm.StartTime && <= otForm.EndTime` — dùng giờ **hiện có của đơn** (không nhận từ request nữa, vì không đổi được nữa).
- Response `data` = `OtFormDto` (§4.3) đầy đủ sau khi sửa — không cần gọi lại `GetById`.
- Permission: `Attendance.OTForm.Create` (dùng chung với quyền tạo đơn, không có permission riêng).
- **FE (`CreateOtFormPage.tsx`, dùng chung với Tạo mới)**: bấm "Sửa" vẫn mở lại đúng form đó, nhưng khi `isEditMode`: khối "Thông tin đơn" (Phòng ban/Bộ phận/Lý do/Trường hợp OT/Ngày/Giờ/Lý do chi tiết) và khối "Yêu cầu hỗ trợ khác" đều `disabled`, chỉ để xem đối chiếu, không gửi lên. Bảng nhân viên đổi hẳn sang bảng cố định riêng (nguồn `data.employees.filter(e => !e.isRemoved)` lấy lúc tải đơn) — không còn ô tick chọn/bỏ, không còn cột Ghi chú, chỉ còn cột "Giờ kết thúc" sửa được.
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
FE: `OtFormApi.get*({ pageIndex, pageSize, fromDate, toDate, status })` (`ot-form.api.ts`) — `status` là số nên **phải** check `!== undefined` (không dùng truthy) vì `0` (Pending) là giá trị lọc hợp lệ, xem CLAUDE.md §4.4. UI bộ lọc (2 ô ngày + dropdown trạng thái + nút Tìm kiếm/Xoá lọc) nằm chung trong `OtFormListPage.tsx` — dùng cho cả 5 tab vì đây là 1 component tái dùng theo prop `mode`.
- **Hiển thị người tạo**: FE luôn dùng `createdByFullName ?? createdByUserName` (không hiển thị thẳng `createdByUserName` — yêu cầu "dữ liệu hiển thị lúc nào cũng phải là tên người dùng"). `createdByFullName` có thể `null` nếu tài khoản tạo đơn chưa từng có `FullName` trong Identity lúc tạo.
- `isEditable` (đổi 2026-08-07) = `status == InApproval && !approvalSteps.some(Approved)`, tính độc lập với người xem — ở `pending-approvals`, 1 đơn `InApproval` vẫn có `isEditable=true` nhưng KHÔNG có nghĩa người duyệt hiện tại sửa được (chỉ chính người tạo mới sửa). FE chỉ hiện nút "Sửa" khi **cả 3 điều kiện**: `isEditable=true` **và** `createdByUserName == user hiện tại` **và** có permission `OTForm.Create` — tức thực tế nút này chỉ có ý nghĩa ở tab "Đơn của tôi" (`my-forms`).
- **`approvalSummary`** — mảng rút gọn từng lần Ký/Duyệt/Từ chối đã xảy ra trên đơn (sắp theo `actionAt` tăng dần), có mặt trên **cả 5 endpoint danh sách**. Cùng shape với `approvalHistories` ở §4.3 nhưng bỏ `comment`/`signatureImage`/`hasSignature`. FE dùng field này để hiện ngay "đã được ai duyệt" trên từng dòng danh sách — danh sách **không** có tên bước đang chờ tiếp theo (field đó chỉ có ở chi tiết đơn qua `approvalSteps[]`, §4.3), FE hiện dòng "Đang chờ duyệt" chung chung khi `status==InApproval`.
- **`groupNameJp`/`departmentNameJp` (mới, 2026-07-29)** — song ngữ Việt/Nhật lấy thẳng từ `Group.GroupNameJp`/`Department.DepartmentNameJp` (nullable, `null` nếu master data chưa nhập tiếng Nhật). FE hiện dạng `"{Vn} / {Jp}"` khi có Jp, chỉ hiện Vn nếu không (xem `bilingualText` ở `modules/attendance/lib/bilingual.ts`).

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
      "monthToDate": 12.5, "yearToDate": 80.0, "isEligibleForMeal": false,
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
- **`employees[].isEligibleForMeal`** — `true` khi `(endTime - startTime) >= AttendanceSetting.mainMealTicketMinHours` (mặc định 2.5h, xem §6d). Tính sẵn ở BE, FE chỉ hiển thị (gợi ý tick `processPart.isEat`), không tự tính lại field này — nhưng FE TỰ TÍNH `processPart.mainTicketCount`/`secondaryTicketCount` theo cùng ngưỡng (§4.1/§6d), khác với `isEligibleForMeal` chỉ mang tính hiển thị tham khảo.
- **`groupNameJp`/`departmentNameJp`/`reasonNameJp`** — song ngữ Việt/Nhật (nullable), lấy thẳng từ `Group`/`Department`/`Reason` tương ứng. FE (`OtFormDetail.tsx`, `OtFormEmailConfirmPage.tsx`) hiện `"{Vn} / {Jp}"` cho Phòng ban/Bộ phận/Lý do, tương tự cho `employees[].noteJp`/`processPart.anotherSuggestionJp`.
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

### 4.5a `POST /api/OtForm/{id}/employees/remove` — Loại nhân viên khỏi đơn (mới, 2026-07-30)

**Nghiệp vụ**: đơn nhiều người, cấp đang duyệt không đồng ý cho **1 người cụ thể** trong đơn — trước đây chỉ có lựa chọn Từ chối cả đơn. Endpoint này cho loại đúng người đó ra rồi vẫn duyệt được **phần còn lại**, mà không phải Từ chối/lập lại đơn.

```jsonc
// body — RemoveOtFormEmployeeDto
{ "employeeId": 100, "reason": "Không đủ điều kiện tăng ca đợt này." }   // cả 2 field [Required], KHÔNG có secondaryPassword
```

- **Permission riêng `Attendance.OTForm.RemoveEmployee`** (KHÔNG dùng chung `.Create`/`.Approve`).
- **Ai loại được, đơn nào** (đổi 2026-08-07, Giai đoạn 3.1): người gọi phải nằm trong `candidates[]` của bước đang chờ (`OtFormApprovalStep.status=Pending`, `stepOrder` nhỏ nhất) — **Admin luôn bypass** (mở rộng so với trước, vì Submitter/"Admin bypass chỉ ở cấp tạo đơn" không còn tồn tại).
- **KHÔNG cần `secondaryPassword`** — loại người không phải hành động ký/duyệt, khác §4.4/§4.5 vẫn giữ nguyên mật khẩu cấp 2.
- **KHÔNG đổi `status` của đơn, KHÔNG xoá/vô hiệu chữ ký các cấp đã ký trước đó** — người dùng đã chốt "duyệt tiếp bình thường", không bắt ký lại từ đầu. Loại người xong, đơn vẫn ở nguyên `status` hiện tại, chờ đúng cấp đó tự bấm Duyệt/Ký tiếp (2 hành động tách biệt, KHÔNG gộp vào `/approve` — xem lý do UX ở đầu file).
- 400 nếu: nhân viên không có trong đơn; nhân viên đã bị loại từ trước; đơn chỉ còn 1 người CHƯA bị loại (dùng "Từ chối đơn" thay vì loại nốt người cuối); đơn đã `Completed`/`Rejected`; user không đúng cấp/scope (cùng lỗi như §4.4).
- Thành công → trả `data: OtFormDto` đầy đủ đã cập nhật (khác `/approve`/`/reject` chỉ trả `true`) — FE **không cần** gọi lại `GET /{id}`, dùng thẳng response để refresh màn chi tiết.
- **FE**: nút "Loại khỏi đơn" đặt trên từng dòng nhân viên ở màn Chi tiết đơn (`OtFormDetail.tsx`, trong app) — ẩn khi chỉ còn 1 người chưa bị loại, mở modal riêng (chỉ có ô lý do, không có mật khẩu cấp 2) tách biệt hoàn toàn khỏi modal Duyệt/Từ chối/Ký duyệt.
- **Kênh email cũng có hành động này (2026-07-31, mở rộng)** — `OtFormEmailConfirmPage.tsx` có cùng nút/modal, gọi `POST /email-confirm/{token}/employees/remove` (`RemoveOtFormEmployeeByEmailTokenDto { EmployeeId, Reason }`) — cùng shape với DTO kênh JWT ở trên (cả 2 kênh đều không có `secondaryPassword`, khác 2 action Duyệt/Từ chối qua email vẫn giữ mật khẩu cấp 2). `OtFormService.RemoveEmployeeByEmailTokenAsync` KHÔNG tiêu (consume) token — người duyệt có thể loại nhiều người rồi mới Duyệt/Từ chối bằng đúng token đó.

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

```jsonc
// AttendanceSettingDto — response GET, body PUT (cùng shape)
{
  "mainMealTicketMinHours": 2.5,   // decimal, [Range(0.5, 24)] khi PUT
  "monthlyOtHourLimit": 25,        // decimal, [Range(1, 744)] khi PUT
  "yearlyOtHourLimit": 300,        // decimal, [Range(1, 8784)] khi PUT
  "batchAutoSendTime": "15:00:00"  // TimeOnly "HH:mm:ss", [Required] khi PUT — mới 2026-08-08, xem §6e
}
```

- **`GET` cố tình KHÔNG gắn permission** — Role "Nhân viên"/"Trưởng nhóm" không có permission quản trị
  nào nhưng màn Tạo đơn của họ vẫn phải đọc được cấu hình này để tự tính phiếu ăn (§4.1) và tô đỏ lũy
  kế vượt ngưỡng. Chỉ hành động **SỬA** mới cần `Attendance.Setting.Update`.
- **`mainMealTicketMinHours`** — mốc giờ OT để nhận **phiếu chính**; dưới mốc này nhận **phiếu phụ**
  (không có ngưỡng sàn, mọi người tăng ca đều nhận đúng 1 trong 2 loại — chốt qua AskUserQuestion). Áp
  dụng cho cả `OtFormEmployeeDto.isEligibleForMeal` (BE tính) lẫn `processPart.mainTicketCount`/
  `secondaryTicketCount` (FE tự tính ở `CreateOtFormPage.tsx`, người dùng vẫn sửa tay được — xem §4.1).
- **`monthlyOtHourLimit`/`yearlyOtHourLimit`** — chỉ ảnh hưởng **hiển thị** (badge/pill đỏ cảnh báo ở
  `EmployeeList.tsx`, `CreateOtFormPage.tsx`, `OtFormDetail.tsx`, `OtFormBatchDetail.tsx`,
  `OtFormPrintView.tsx`), **không** chặn tạo/duyệt đơn hay Admin chỉnh lũy kế thủ công qua
  `PUT /Employee/{id}` — vẫn không giới hạn gì.
- **FE cache dùng chung** (`useAttendanceSetting.ts`) — 1 promise cấp module, không gọi lại API mỗi màn
  mount; gọi `invalidateAttendanceSettingCache()` sau khi Admin lưu cấu hình mới để các màn mở sau đó
  thấy ngay, không cần F5 cả trang.
- **Trang public qua email** (`OtFormEmailConfirmPage.tsx`, không JWT) **không gọi được endpoint này**
  — vẫn dùng cứng giá trị mặc định (2.5h/25h/300h) cho màu cảnh báo lũy kế. Chấp nhận được vì đây chỉ
  là gợi ý hiển thị, không phải số liệu quyết định nghiệp vụ.
- Thành công → `data` = `AttendanceSettingDto` đầy đủ (cả GET lẫn PUT), không cần gọi lại `GetById`.

## 6e. Đơn tổng (`/api/OtFormBatch`) — gom nhiều đơn theo Phòng ban, duyệt 1 lần (mới, 2026-08-06; redesign 2026-08-07 Giai đoạn 3.2)

> **✅ Đã redesign theo Cây chức vụ (2026-08-07)** — route/DTO không đổi so với thiết kế gốc, chỉ đổi
> điều kiện xác định "đang chờ Trưởng phòng" (xem `attendance-module.md` §Đơn tổng để biết chi tiết ánh
> xạ sang model bước động). Đã hoạt động lại bình thường, nav FE đã hiện lại mục "Đơn tổng".

**Lý do**: đơn tăng ca tới đúng bước Trưởng phòng (`OtFormApprovalStep` có `TerminalLevelSnapshot=1`,
đang `Pending`) trước đây phải duyệt riêng lẻ từng đơn. Mỗi ngày, vào giờ đọc từ
`AttendanceSetting.batchAutoSendTime` (mặc định **15:00**, Admin tự đổi qua tab Cấu hình — xem §6d),
hệ thống tự gom **các đơn MỚI, chưa từng vào batch nào** của cùng 1 Phòng ban thành 1 "Đơn tổng", gửi
mail cho Trưởng phòng — bấm vào duyệt 1 lần là cả loạt được xử lý. Batch cũ chưa xử lý xong (từ ngày
trước) được gửi **mail nhắc lại mỗi ngày** (không tạo batch mới, không gộp thêm đơn — 1 đơn chỉ thuộc
đúng 1 batch). Đơn còn kẹt ở bước trung gian (SUP/CHIEF...) trước khi tới Trưởng phòng thì KHÔNG được
gom, vẫn duyệt lẻ như bình thường. Chi tiết thiết kế BE ở
[attendance-module.md §Đơn tổng](attendance-module.md).

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| GET | `/api/OtFormBatch/grid-list?pageIndex&pageSize` | `Attendance.OTForm.Approve` | Danh sách batch (Admin thấy tất cả; còn lại chỉ thấy batch thuộc Department mình là candidate ở bước Chức vụ `TerminalLevel=DepartmentManager`, xem Cây chức vụ) |
| GET | `/api/OtFormBatch/{id}` | `Attendance.OTForm.Approve` | Chi tiết 1 batch |
| POST | `/api/OtFormBatch/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt/Từ chối hàng loạt |
| GET | `/api/OtFormBatch/email-confirm/{token}` | `[AllowAnonymous]` | Chi tiết qua link email |
| POST | `/api/OtFormBatch/email-confirm/{token}/approve` | `[AllowAnonymous]` | Duyệt/Từ chối qua link email |
| POST | `/api/OtFormBatch/run-now` | `Attendance.Setting.Update` | Chạy ngay đợt gom hằng ngày, không đợi tới giờ cấu hình (mới 2026-08-08, nút "Gửi ngay" ở tab Cấu hình — dùng khi test/cần gấp; body rỗng, response `data: true`) |

```jsonc
// OtFormBatchListItemDto — item của grid-list
{
  "id": 12, "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": null,
  "batchDate": "2026-08-06", "status": 0,           // OtFormBatchStatus: 0=Pending, 1=Processed
  "formCount": 3, "employeeCount": 8, "totalHour": 14.5,
  "createdAt": "2026-08-06T15:00:00", "processedAt": null, "processedByFullName": null
}

// OtFormBatchDto — response GET /{id} (và /email-confirm/{token})
{
  "id": 12, "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp", "departmentNameJp": null,
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
  `monthToDate`/`yearToDate`/`isEligibleForMeal`/`didEat`/`noteVn`/`noteJp`), chỉ thêm mới `subReason`
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
| `/api/EmployeeImport` | `preview`, `confirm` (Admin, §3.7) |

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
| `POST /UserApprovalScope` 400 "chưa giữ Role '...'" (mở rộng cho cả 4 cấp, **2026-07-17**) | Admin gán `approvalLevel` (Submitter/GroupHead/DepartmentManager/WorkshopManager) cho `userName` chưa có đúng Role tương ứng (Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng) — gán Role qua Identity `update-user-roles` trước, rồi mới gán scope. Xem bảng mapping ở §5 |
| `POST /UserApprovalScope` 400 "Cấp duyệt này chỉ được gán theo phạm vi '...'" (**mới 2026-07-17**) | `scopeType` không khớp `approvalLevel` (VD gán `Trưởng Bộ phận` theo phạm vi "Phòng ban" thay vì "Bộ phận", hoặc `Trưởng phòng` theo phạm vi "Bộ phận" thay vì "Phòng ban") — xem bảng mapping ScopeType ở §5, FE nên ép sẵn PHẠM VI theo `approvalLevel` đã chọn để tránh lỗi này |
| `pending-approvals` luôn rỗng dù có đơn chờ | User Tổng Giám Đốc thiếu Role `"Tổng Giám Đốc"` (case-sensitive, kiểm tra đúng chuỗi), hoặc Trưởng phòng/xưởng thiếu `UserApprovalScope` |
| `POST /OtForm` 400 "Giờ kết thúc OT của nhân viên ... phải sau giờ bắt đầu ... và không được vượt quá giờ kết thúc của đơn" | 1 `employees[].endTime` <= `startTime` của đơn hoặc > `endTime` của đơn — FE nên giới hạn input giờ kết thúc từng nhân viên trong khoảng `(startTime, endTime]` của đơn ngay trên UI, không đợi BE trả lỗi |
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
  tra cứu read-only của Asset): xác nhận sẽ tạo THẬT 1 bản ghi + gửi THẬT 1 email cho candidate của
  bước đầu tiên trong chuỗi duyệt (`NotifyEligibleApproversAsync`, không có cách tắt).
  > **⚠ Chưa verify lại sau Giai đoạn 3.1 (2026-08-07)** — tool `create_ot_form_draft` gọi thẳng
  > `OtFormService.CreateAsync` đã redesign (không còn Draft, vào chuỗi duyệt Cây chức vụ ngay lập
  > tức, xem §4.1) nhưng bản thân code/prompt của AI Chat (đặt tên tool, mô tả "Draft" trong system
  > prompt) CHƯA được rà lại cho khớp — cần kiểm tra kỹ trước khi coi tính năng này hoạt động đúng ý,
  > xem [attendance-aichat-be-huong-dan.md §B3](attendance-aichat-be-huong-dan.md).
