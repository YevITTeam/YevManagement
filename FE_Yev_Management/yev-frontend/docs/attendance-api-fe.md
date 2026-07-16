# attendance-api-fe.md — API Attendance (Giấy tăng ca) cho Frontend

> Hợp đồng API quản lý Giấy tăng ca (OT Form). Implementation: [attendance-module.md](attendance-module.md).
> Module Identity: [identity-api-fe.md](identity-api-fe.md) · Module Asset: [asset-api-fe.md](asset-api-fe.md).

- **Base URL (Dev)**: `http://10.45.1.155:8080` (launchSettings hiện trỏ IP này, không phải `localhost:5000`) · Scalar UI `/scalar/v1`.
- **Auth**: mọi endpoint cần `Authorization: Bearer <token>` (từ `windows-login`, xem [identity-api-fe.md](identity-api-fe.md)) **và** permission tương ứng (vd `Attendance.OTForm.Create`). Thiếu token→401, thiếu permission→403. FE dựa `user.permissions` ẩn/hiện nút.
- Envelope `ApiResponse<T>`, phân trang, mã lỗi HTTP, pattern CRUD cơ bản — giống hệt Asset, xem [asset-api-fe.md §1](asset-api-fe.md#1-quy-ước-chung). Tóm tắt: mọi response bọc `{ isSuccess, message, data, errors, timestamp }`; `grid-list` trả `data.data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **byte[] qua JSON**: field kiểu `byte[]` (chữ ký `SignatureImage`) serialize/deserialize thành **chuỗi base64** — FE convert ảnh (canvas chữ ký, upload file) sang base64 trước khi gửi, và decode base64 → hiển thị `<img src="data:image/png;base64,...">` khi nhận.
- **Cập nhật 2026-07-16** (breaking đổi `CreateOtFormEmployeeItemDto`, chưa có FE nào code trước đó nên không ảnh hưởng hệ thống thật): (1) `employees[].startTime` bị bỏ khỏi `CreateOtFormDto`/`UpdateOtFormDto` — luôn bằng `startTime` của đơn; (2) thêm `PUT /api/OtForm/{id}` sửa đơn, khóa cứng khi qua 1 cấp duyệt (§4.1b); (3) `OtFormDto`/`OtFormListItemDto` thêm `createdByFullName`+`isEditable`; (4) `OtFormEmployeeDto` thêm `monthToDate`/`yearToDate`/`isEligibleForMeal` (§4.3); (5) `Employee` thêm `userName`+`accumulationYear`+`accumulationMonth`, thêm `GET /api/Employee/me` và `PATCH /api/Employee/{id}/adjust-accumulation` (§3.5, §3.6); (6) lũy kế tự cộng khi đơn đạt Completed, rollover tự động theo tháng/năm (xem [attendance-module.md](attendance-module.md)).
- **Cập nhật 2026-07-16 (đợt 2 — breaking)**: (1) bỏ `submitterSignatureImage`/`signatureImage` khỏi body `CreateOtFormDto`/`ApproveOtFormDto` — BE tự lấy chữ ký từ `UserSignature` đã đăng ký sẵn của người gọi (§4.1, §4.4, §6); (2) `POST /api/OtForm` giờ yêu cầu thêm `UserApprovalScope(approvalLevel=Submitter)` khớp `groupId`/`departmentId` của đơn (trừ Admin) — cho phép nhiều người/1 Group cùng tạo đơn (§1, §5).
- **Cập nhật 2026-07-16 (đợt 3 — breaking)**: (1) `ProcessPartDto` thêm `mainTicketCount`/`secondaryTicketCount`/`milkCount` (số lượng phiếu ăn theo loại, nhập tay, chung cho cả đơn — §4.1/§4.1b/§4.3); (2) `PUT /api/UserSignature/me` **đổi hành vi hoàn toàn** — không còn áp dụng chữ ký ngay, mà gửi email xác nhận cho chính user, chữ ký chỉ có hiệu lực sau khi bấm xác nhận qua trang public do FE tự xây (§6, §6b); (3) `POST /api/OtForm/{id}/approve` khi còn cấp duyệt tiếp theo sẽ tự gửi email kèm link Duyệt/Từ chối cho người phù hợp — kênh **bổ sung**, không thay nút trong app (§4.6); (4) thêm `EmployeeImportController` cho Admin import Excel nhân sự hàng loạt (§3.7).

## 1. Tổng quan nghiệp vụ, vai trò & luồng UI (đọc trước khi code màn hình)

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
- **Ai tạo đơn được cho Group nào** (2026-07-16): `Attendance.OTForm.Create` (Role Trưởng Group) chỉ là điều kiện **cần** — người gọi còn phải có dòng `UserApprovalScope` với `approvalLevel = 0 (Submitter)` khớp `groupId`/`departmentId` của đơn thì mới tạo được, **trừ Admin bypass**. Nhờ vậy 1 Group có thể có **nhiều người** (Trưởng Group chính + phó nhóm dự phòng) cùng được phép tạo đơn, không giới hạn đúng 1 tài khoản.
- Ở bất kỳ cấp nào, **Reject** dừng hẳn luồng (`status → Rejected`), không đi tiếp.
- Trước khi dùng module này, user (Trưởng Group/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) phải **đã được Admin**: (1) gán đúng Role qua Identity `update-user-roles`, (2) được tạo dòng `UserApprovalScope` khớp vai trò của mình — Trưởng Group thì `approvalLevel=Submitter`, Trưởng phòng/Trưởng xưởng thì `approvalLevel=DepartmentManager/WorkshopManager` (mục 5). Chữ ký (`UserSignature`, mục 6) do **chính user** tự đăng ký, không phải Admin làm hộ.
- **Kênh bổ sung qua email** (2026-07-16, không thay thế luồng trong app): cập nhật chữ ký phải tự xác nhận qua email (§6b); người duyệt (Trưởng phòng/Trưởng xưởng/TGĐ) nhận email kèm link Duyệt/Từ chối mỗi khi có đơn tới lượt họ, vì cấp quản lý ít khi mở app (§4.6). Cả 2 đều cần **FE tự xây 2 trang public** (không đăng nhập SPA, bảo mật bằng token trong URL) — xem §6b, §4.6, §8.

### 1.1 Vai trò → Menu/màn hình được thấy

FE dựng menu dựa vào `user.permissions` (không dựa `user.roles`, xem [identity-api-fe.md §3](identity-api-fe.md)). Bảng dưới liệt kê permission Attendance mỗi Role **đã được seed sẵn** — dùng để biết role nào thấy màn nào (Admin luôn thấy full, không liệt kê riêng):

| Role | Permission Attendance đã gán | Màn hình thấy được |
|---|---|---|
| **Trưởng Group** | `OTForm.Create`, `OTForm.View`, `Employee.View`, `UserSignature.Update` | "Tạo đơn tăng ca", "Đơn của tôi", "Chi tiết đơn", "Cài đặt chữ ký". **Không** thấy "Chờ tôi duyệt" (không có `OTForm.Approve`), không thấy màn Danh mục. |
| **Trưởng phòng / Trưởng xưởng / Tổng Giám Đốc** | `OTForm.View`, `OTForm.Approve`, `UserSignature.Update` | "Chờ tôi duyệt", "Chi tiết đơn" (có nút Duyệt/Từ chối), "Cài đặt chữ ký". **Không** có `OTForm.Create` → không thấy nút "Tạo đơn"; **không** có `Employee.View` → màn của họ không cần gọi API Employee (đã có sẵn tên nhân viên trong `OtFormDto.employees`). |
| **Admin** | Toàn bộ 28 permission `Attendance.*` | Tất cả màn ở trên **+** "Quản trị danh mục" (Department/Group/Reason/OtCase/Employee) **+** "Phân quyền duyệt" (UserApprovalScope). Đây là role **duy nhất** thấy 2 màn quản trị này — không role nghiệp vụ nào có quyền CRUD danh mục hay tự gán `UserApprovalScope`. |

> Lưu ý quan trọng cho điều hướng: 1 user có thể **có nhiều Role cùng lúc** (VD vừa là Trưởng Group vừa là Trưởng phòng ở 1 case đặc biệt) — JWT gộp permission của mọi Role, nên UI nên **luôn build menu theo permission**, không giả định 1 user chỉ thuộc đúng 1 nhóm màn hình.

### 1.2 Vòng đời đơn — ma trận Trạng thái × Vai trò × Hành động UI

Đây là bảng quan trọng nhất để dựng đúng nút/badge trên màn "Chi tiết đơn" và 2 màn danh sách:

| `status` | Ý nghĩa | Badge gợi ý | Ai đang "cầm bóng" | Trưởng Group thấy gì | Người đang chờ duyệt thấy gì |
|---|---|---|---|---|---|
| `0 Pending` | Vừa tạo, chờ Trưởng phòng | Vàng "Chờ Trưởng phòng duyệt" | Trưởng phòng đúng scope | Chỉ xem, không sửa/xóa được | Trưởng phòng: nút Duyệt/Từ chối trong `pending-approvals` |
| `1 ApprovedByDepartment` | Đã qua Trưởng phòng, chờ Trưởng xưởng | Vàng "Chờ Trưởng xưởng duyệt" | Trưởng xưởng đúng scope | Chỉ xem | Trưởng xưởng: nút Duyệt/Từ chối |
| `2 ApprovedByWorkshop` | Đã qua Trưởng xưởng, chờ TGĐ | Vàng "Chờ Tổng Giám Đốc duyệt" | Tổng Giám Đốc (bất kỳ ai có Role này) | Chỉ xem | TGĐ: nút Duyệt/Từ chối |
| `3 Completed` | Đã đủ cấp theo `otCase.requiredApprovalLevel` | Xanh lá "Hoàn tất" | — (kết thúc) | Chỉ xem, hiện nút "In đơn" | Không còn hiện trong `pending-approvals` nữa |
| `4 Rejected` | Bị từ chối ở 1 cấp bất kỳ | Đỏ "Từ chối" | — (kết thúc) | Chỉ xem, đọc `comment` lý do ở dòng cuối `approvalHistories` | Không còn hiện trong `pending-approvals` nữa |

Quy tắc dựng nút chung cho màn "Chi tiết đơn" (`GET /{id}`):
- Nút **Duyệt/Từ chối** chỉ hiện khi: `status` đang ở 1 trong 3 giá trị `0/1/2` **và** user hiện tại có permission `OTForm.Approve` **và** (là TGĐ khi `status=2`, hoặc có `UserApprovalScope` khớp cấp tương ứng khi `status=0/1`). FE không cần tự tính khớp scope — cứ hiện nút nếu đơn xuất hiện trong `pending-approvals`/gọi approve mà BE trả 400 thì ẩn nút + báo lỗi, đơn giản nhất là: **chỉ hiện nút Duyệt/Từ chối khi đơn này có mặt trong `GET /pending-approvals` của user hiện tại**.
- Nút **Sửa** (mới, 2026-07-16) chỉ hiện khi `otFormDto.isEditable == true` (tương đương `status = 0 Pending`) **và** `createdByUserName == user hiện tại` **và** user có permission `OTForm.Create`. Qua bất kỳ cấp duyệt nào (`status >= 1`) là `isEditable = false` vĩnh viễn — khóa cứng, không có cách nào sửa lại được nữa (kể cả Admin), chỉ có thể Reject rồi tạo đơn mới. Bấm "Sửa" → mở lại y hệt form "Tạo đơn tăng ca" (đổ dữ liệu có sẵn), submit gọi `PUT /api/OtForm/{id}` thay vì `POST`.
- Nút **In đơn** chỉ nên hiện khi `status = 3 (Completed)` (khuyến nghị UI, API không chặn — xem §8).
- `status = 4 (Rejected)` → ẩn hết nút hành động, chỉ còn xem lý do từ chối (`comment` ở dòng `approvalHistories` cuối, không có `signatureImage` vì Reject không ký).

### 1.3 Wireframe từng màn hình (bố cục gợi ý, FE tự do style)

**A. "Tạo đơn tăng ca"** (Trưởng Group, `OTForm.Create`) — dùng chung layout này cho cả "Sửa đơn" (đổ sẵn dữ liệu từ `GET /{id}`, submit gọi `PUT /{id}` thay vì `POST`)
```
[Bộ phận ▾] [Nhóm ▾ (phụ thuộc Bộ phận)] [Lý do ▾] [Trường hợp OT ▾]
[Ngày OT] [Giờ bắt đầu] [Giờ kết thúc] [Tổng giờ] [Ghi chú phụ (subReason)]
     ↑ "Giờ bắt đầu/kết thúc" ở đây là KHUNG GIỜ TỐI ĐA của cả đơn — StartTime của
       từng nhân viên bên dưới LUÔN ăn theo giờ này (không sửa được riêng); EndTime
       của từng nhân viên không được vượt quá "Giờ kết thúc" ở đây.
──────────────────────────────────────────────
Danh sách nhân viên nhóm đã chọn (checkbox chọn nhiều + giờ riêng từng người)
Lũy kế hiện tại lấy từ Employee/by-group/{groupId} — hiển thị NGAY khi chọn để Trưởng
Group tự cân nhắc trước khi gửi (vd sắp vượt 25h/tháng thì nên chọn OtCase TH3).
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
Chữ ký "Người đề nghị" (canvas vẽ tay, bắt buộc — CHỈ lúc Tạo mới, không hiện lại khi Sửa)  [ Xóa ] [ Xác nhận ]
[ Hủy ]                                                    [ Gửi đơn ] / [ Lưu thay đổi ]
```
Sau khi "Gửi đơn" thành công → điều hướng sang "Chi tiết đơn" luôn (dùng `data` trả về từ `POST`/`PUT`).
Màn "Sửa đơn" chỉ mở được khi `isEditable = true` (xem §1.2) — nếu user cố mở khi đã bị khóa, ẩn hẳn nút "Sửa" thay vì để bấm rồi nhận lỗi 400.

**B. "Đơn của tôi" / "Chờ tôi duyệt"** (danh sách, dùng chung 1 layout, khác nguồn API)
```
[Tìm kiếm theo trạng thái?] (tùy chọn, API không hỗ trợ filter status — FE tự filter client-side nếu cần)
┌────┬─────────┬───────────┬────────┬──────┬────────┬────────────┬───────────┐
│ Mã │ Nhóm    │ Bộ phận   │ TH     │ Ngày │ Tổng giờ│ Số NV     │ Trạng thái│
├────┼─────────┼───────────┼────────┼──────┼────────┼────────────┼───────────┤
│ 10 │ Nhóm 1  │ Xưởng LR  │ TH1    │ 15/7 │ 2.0     │ 1          │ 🟡 Chờ TP │  ← click vào dòng → Chi tiết
└────┴─────────┴───────────┴────────┴──────┴────────┴────────────┴───────────┘
```
"Đơn của tôi" gọi `GET /my-forms` (chỉ Trưởng Group thấy menu này); "Chờ tôi duyệt" gọi `GET /pending-approvals` (chỉ Trưởng phòng/xưởng/TGĐ thấy).

**C. "Chi tiết đơn"** (dùng chung mọi role, đổi phần action theo §1.2)
```
[Badge trạng thái]                                    [Nút "Sửa" nếu isEditable] [Nút "In đơn" nếu Completed]
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
    duyệt đối chiếu ngưỡng TH3 (>25h/tháng, >300h/năm) ngay tại đây, không cần mở màn Employee.
  ↑ "Phiếu ăn" = employees[].isEligibleForMeal (giờ KT - giờ BĐ > 2h), chỉ mang tính
    tham khảo hiển thị — không quyết định ProcessPart.isEat (cờ đó do người lập đơn tự tick).
──────────────────────────────────────────────
Phát sinh khác (ProcessPart, nếu có)
──────────────────────────────────────────────
Timeline duyệt (approvalHistories, sort theo thời gian):
  ● Submitted   — Nguyễn Văn A (Trưởng Group)     15/07 08:00   [ảnh chữ ký]
  ● Approved    — Trần Văn B (Trưởng phòng)        15/07 09:00   [ảnh chữ ký]  "Đồng ý"
  ○ (đang chờ Trưởng xưởng...)
──────────────────────────────────────────────
[Nếu đang chờ CHÍNH user này duyệt]
  Ghi chú/Comment [___]     (chữ ký tự lấy từ "Cài đặt chữ ký" — không có canvas ký ở đây nữa;
                              nếu otCase.requireSignature=true mà chưa đăng ký chữ ký → nhắc user
                              qua "Cài đặt chữ ký" trước khi bấm Duyệt)
  [ Từ chối ]                                              [ Duyệt ]
```
Dòng "○ (đang chờ...)" chỉ là gợi ý UX — suy từ `status` theo bảng §1.2, không có sẵn trong API (API chỉ trả các dòng **đã xảy ra** trong `approvalHistories`).

**D. "Cài đặt chữ ký"** (mọi role có `UserSignature.Update`, tức mọi role nghiệp vụ)
```
Chữ ký hiện tại: [ảnh preview, hoặc "Chưa đăng ký"]
Canvas vẽ chữ ký mới: [___________]   [ Xóa ]  [ Lưu ]
```

**E. "Quản trị danh mục"** (chỉ Admin) — 5 tab con Department/Group/Reason/OtCase/Employee, mỗi tab là bảng CRUD chuẩn (grid-list + form thêm/sửa) — xem mẫu ở §3, không có gì đặc biệt về UX. Tab Employee có thêm nút "Import Excel" mở màn riêng (§3.7, §8) — chọn file → xem preview → xác nhận.

**F. "Phân quyền duyệt"** (chỉ Admin) — bảng `UserApprovalScope` (grid-list) + form thêm mới (chọn user, ScopeType Group/Department, Scope cụ thể, ApprovalLevel) + nút xóa từng dòng. Không có nút Sửa (theo đúng API, xem §5).

### 1.4 Sơ đồ điều hướng tổng thể (menu tree gợi ý)

```
Giấy tăng ca (Attendance)
├── Tạo đơn tăng ca          [Trưởng Group]
├── Đơn của tôi              [Trưởng Group]  (mỗi dòng Pending do mình tạo có nút "Sửa")
├── Chờ tôi duyệt            [Trưởng phòng / Trưởng xưởng / Tổng Giám Đốc]
├── Cài đặt chữ ký           [mọi role nghiệp vụ]
├── Lũy kế của tôi           [nhân viên có Employee.UserName gán sẵn — xem §3.6]
└── Quản trị (Admin)
    ├── Danh mục (Bộ phận / Nhóm / Lý do / Trường hợp OT / Nhân viên)
    ├── Import nhân sự (Excel)
    └── Phân quyền duyệt
```
> **"Sửa đơn tăng ca" KHÔNG phải menu riêng** — chỉ là nút "Sửa" xuất hiện trong "Đơn của tôi"/"Chi tiết đơn" khi `isEditable = true`, mở lại đúng form "Tạo đơn tăng ca" (§1.3.A) với dữ liệu có sẵn.
> **"Lũy kế của tôi"** không gắn permission Attendance nào (bất kỳ user đăng nhập nào, kể cả không có Role nghiệp vụ) — chỉ hoạt động nếu Admin đã gán `Employee.UserName` = username AD của họ.
> **2 trang "Xác nhận cập nhật chữ ký" / "Xác nhận duyệt đơn qua email" (§6b, §4.6) KHÔNG nằm trong sơ đồ menu này** — đây là route **public**, chỉ mở qua link trong email, không cần đăng nhập SPA và không hiện trong bất kỳ menu điều hướng nào.

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
  "userName": "YEV\\n.van.a",                     // nullable — tài khoản AD của chính nhân viên (nếu có)
  "monthToDate": 12.5, "yearToDate": 80.0,
  "accumulationYear": 2026, "accumulationMonth": 7, // tháng/năm mà monthToDate/yearToDate đang phản ánh
  "groupId": 5, "groupNameVn": "Nhóm 1" }
```
POST/PUT: `code`[Required], `firstName`[Required], `lastName`[Required], `userName?` (optional — gán tài khoản AD để nhân viên tự chỉnh lũy kế, xem §3.6), `monthToDate`, `yearToDate` (decimal, giờ OT lũy kế — dùng để cảnh báo TH3 vượt 25h/tháng hoặc 300h/năm), `groupId`[Required]. Trùng `userName` với nhân viên khác (kể cả đang active) → 400.

**Chọn nhân viên hàng loạt khi lập đơn**: `GET /api/Employee/by-group/{groupId}` → `EmployeeDto[]` toàn bộ nhân viên nhóm đó (Trưởng Group tick chọn nhiều người cho `CreateOtFormDto.employees`) — đã có sẵn `monthToDate`/`yearToDate` để hiện ngay lúc chọn (§1.3.A).

### 3.6 Điều chỉnh lũy kế thủ công — `PATCH /api/Employee/{id}/adjust-accumulation`

Vì không phải ai cũng làm đúng giờ OT đã đăng ký trong form, cần cho phép ghi đè trực tiếp `monthToDate`/`yearToDate` mà không phải đợi có đơn OT mới. Endpoint này **không gắn permission `Attendance.Employee.*`** — chỉ cần đăng nhập (có JWT hợp lệ) là gọi được, quyền hạn được BE tự kiểm tra bên trong:
- Nếu `Employee.userName` (của chính `id` đang sửa) khớp `username` của người gọi → luôn cho phép (tự chỉnh của chính mình).
- Nếu người gọi có permission `Attendance.Employee.Update` (hiện chỉ Admin có) → cho phép chỉnh của bất kỳ ai.
- Ngoài 2 trường hợp trên → 400 "Bạn không có quyền chỉnh lũy kế của nhân viên này."

```jsonc
// PATCH /api/Employee/100/adjust-accumulation — body AdjustEmployeeAccumulationDto
{ "monthToDate": 15.0, "yearToDate": 85.0 }   // cả 2 bắt buộc >= 0
// response: { "isSuccess": true, "data": true, "message": "Cập nhật lũy kế thành công." }
```
Sau khi gọi thành công, BE tự stamp `accumulationYear`/`accumulationMonth` = tháng/năm hiện tại — FE nên gọi lại `GET /api/Employee/{id}` (hoặc `GET /api/Employee/me`) để lấy giá trị mới nhất, không tự cộng dồn ở client.

**`GET /api/Employee/me`** — không gắn permission, chỉ cần đăng nhập. Trả `EmployeeDto` của chính user hiện tại (tìm theo `Employee.userName == CurrentUserName`). 404 nếu tài khoản đang đăng nhập chưa được Admin gán `userName` cho nhân viên nào.

**Màn "Lũy kế của tôi"** (mọi user đăng nhập, không cần permission): gọi `GET /api/Employee/me` để lấy `id`+`monthToDate`+`yearToDate` hiện tại, hiện form 2 ô nhập để sửa lại → `PATCH /api/Employee/{id}/adjust-accumulation`. 404 ở bước `me` → ẩn hẳn màn này, hiện thông báo "Tài khoản chưa được gán nhân viên tương ứng, liên hệ Admin".

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

| Method | Route | Permission | Việc gì |
|---|---|---|---|
| POST | `/api/OtForm` | `Attendance.OTForm.Create` | Trưởng Group tạo đơn + ký "Người đề nghị" cùng lúc |
| GET | `/api/OtForm/my-forms?pageIndex=&pageSize=` | `Attendance.OTForm.View` | Đơn do **chính mình** tạo |
| GET | `/api/OtForm/pending-approvals?pageIndex=&pageSize=` | `Attendance.OTForm.Approve` | Đơn đang **chờ chính mình** duyệt (tự lọc scope, xem §1) |
| GET | `/api/OtForm/{id}` | `Attendance.OTForm.View` | Chi tiết đầy đủ 1 đơn |
| PUT | `/api/OtForm/{id}` | `Attendance.OTForm.Create` | Sửa toàn bộ đơn — chỉ chính người tạo, chỉ khi còn Pending (§4.1b) |
| POST | `/api/OtForm/{id}/approve` | `Attendance.OTForm.Approve` | Duyệt đơn ở cấp hiện tại — tự cộng lũy kế nhân viên nếu đạt Completed |
| POST | `/api/OtForm/{id}/reject` | `Attendance.OTForm.Approve` | Từ chối đơn ở cấp hiện tại (dừng luồng) |
| GET | `/api/OtForm/email-confirm/{token}` | Không cần (`[AllowAnonymous]`) | Xem trước đơn để duyệt qua link email — xem §4.6 |
| POST | `/api/OtForm/email-confirm/{token}/approve` | Không cần (`[AllowAnonymous]`) | Duyệt qua link email — xem §4.6 |
| POST | `/api/OtForm/email-confirm/{token}/reject` | Không cần (`[AllowAnonymous]`) | Từ chối qua link email — xem §4.6 |

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
- **`submitterSignatureImage` KHÔNG còn tồn tại trong body** (bỏ từ 2026-07-16) — chữ ký "Người đề nghị" BE tự lấy từ `UserSignature` đã đăng ký sẵn của chính người gọi API (`GET/PUT /api/UserSignature/me`, mục 6). FE phải đảm bảo user đã đăng ký chữ ký trước khi vào màn "Tạo đơn"; nếu chưa đăng ký → 400 `DomainException` ("Bạn chưa đăng ký chữ ký...").
- **`processPart.mainTicketCount`/`secondaryTicketCount`/`milkCount`** (2026-07-16, số nguyên `int`, mặc định `0`) — số lượng phiếu ăn theo loại (phiếu chính/phiếu phụ/sữa), chỉ có ý nghĩa khi `isEat = true`. Người lập đơn **tự nhập tay 3 ô số lượng này** cho **cả đơn** (không phải theo từng nhân viên) — BE không tự tính, không validate tổng khớp `numberOfEmployee` hay `employees[].isEligibleForMeal`. FE nên ẩn 3 ô này khi `isEat = false`.
- **Phải có `UserApprovalScope(approvalLevel=Submitter)` khớp `groupId`/`departmentId` của đơn** (2026-07-16, trừ Admin) — người có Role Trưởng Group nhưng chưa được Admin gán scope cho đúng Group này → 400 (`DomainException` "Bạn không được phân quyền tạo đơn cho nhóm/bộ phận này..."). Nhiều người có thể cùng được gán scope cho 1 Group (mục 5).
- Response `201 Created` (Location header trỏ `GET /{id}`), `data` = `OtFormDto` (§4.3) đầy đủ luôn — không cần gọi lại `GetById`.

### 4.1b `PUT /api/OtForm/{id}` — Sửa đơn (2026-07-16)

Body `UpdateOtFormDto` giống hệt `CreateOtFormDto` ở trên (không có field chữ ký nào, cùng lý do — không ký lại khi sửa):
```jsonc
{
  "groupId": 5, "departmentId": 1, "reasonId": 2, "otCaseId": 1,
  "startTime": "17:30:00", "endTime": "20:00:00",
  "subReason": null, "totalHour": 2.5, "date": "2026-07-15",
  "employees": [ { "employeeId": 100, "endTime": "20:00:00", "noteVn": null, "noteJp": null } ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null }
}
```
- Chỉ **chính người tạo đơn** (`createdByUserName` khớp user gọi) mới gọi được — người khác gọi (kể cả Admin) → 400.
- Chỉ khi đơn còn **`status = 0 Pending`** — đã qua Trưởng phòng/Trưởng xưởng/TGĐ duyệt dù chỉ 1 cấp thì 400 "Đơn đã được duyệt ít nhất 1 cấp, không thể sửa nữa." FE nên chặn từ trước bằng `isEditable` (xem §1.2/§4.3), không đợi BE trả lỗi.
- Cho phép đổi hẳn danh sách nhân viên (thêm/bớt/đổi giờ), đổi cả `groupId`/`departmentId`/`reasonId`/`otCaseId`/`date`/giờ — validate y hệt lúc tạo (nhân viên cùng nhóm, giờ hợp lệ).
- Response `data` = `OtFormDto` (§4.3) đầy đủ sau khi sửa — không cần gọi lại `GetById`.
- Permission: `Attendance.OTForm.Create` (dùng chung với quyền tạo đơn, không có permission riêng).

### 4.2 `GET /api/OtForm/my-forms` & `pending-approvals` — Danh sách (`OtFormListItemDto`)
```jsonc
// data.data[]
{ "id": 10, "groupNameVn": "Nhóm 1", "departmentNameVn": "Xưởng lắp ráp", "otCaseCode": "TH1",
  "date": "2026-07-15", "totalHour": 2.0, "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A",
  "status": 0, "isEditable": true }
```
`pending-approvals` tự xác định "cấp hiện tại" của user gọi API (từ Role + `UserApprovalScope`) — FE **không** truyền tham số lọc cấp, chỉ `pageIndex/pageSize`.
- **Hiển thị người tạo**: FE luôn dùng `createdByFullName ?? createdByUserName` (không hiển thị thẳng `createdByUserName` — yêu cầu "dữ liệu hiển thị lúc nào cũng phải là tên người dùng"). `createdByFullName` có thể `null` nếu tài khoản tạo đơn chưa từng có `FullName` trong Identity lúc tạo.
- `isEditable` = `status == Pending`, tính độc lập với người xem — ở `pending-approvals` của Trưởng phòng, 1 đơn Pending vẫn có `isEditable=true` nhưng KHÔNG có nghĩa Trưởng phòng sửa được (chỉ chính người tạo mới sửa). FE chỉ hiện nút "Sửa" khi **cả 3 điều kiện**: `isEditable=true` **và** `createdByUserName == user hiện tại` **và** có permission `OTForm.Create` — tức thực tế nút này chỉ có ý nghĩa ở màn "Đơn của tôi" (`my-forms`), không hiện ở "Chờ tôi duyệt".

### 4.3 `GET /api/OtForm/{id}` — Chi tiết (`OtFormDto`)
```jsonc
{
  "id": 10, "groupId": 5, "groupNameVn": "Nhóm 1", "departmentId": 1, "departmentNameVn": "Xưởng lắp ráp",
  "reasonId": 2, "reasonNameVn": "Tăng ca sản xuất gấp", "otCaseId": 1, "otCaseCode": "TH1",
  "startTime": "17:30:00", "endTime": "19:30:00", "subReason": null,
  "totalHour": 2.0, "date": "2026-07-15", "numberOfEmployee": 1,
  "createdByUserName": "YEV\\n.van.a", "createdByFullName": "Nguyễn Văn A",
  "status": 0, "isEditable": true,
  "employees": [
    { "employeeId": 100, "employeeCode": "NV001", "fullName": "Nguyễn Văn A",
      "startTime": "17:30:00", "endTime": "19:30:00", "noteVn": null, "noteJp": null,
      "monthToDate": 12.5, "yearToDate": 80.0, "isEligibleForMeal": false }
  ],
  "processPart": { "isEat": true, "mainTicketCount": 3, "secondaryTicketCount": 1, "milkCount": 0,
                    "isTransportation": false, "isUseCopyRoom": false,
                    "anotherSuggestionVn": null, "anotherSuggestionJp": null },   // null nếu tạo đơn không gửi
  "approvalHistories": [
    { "approverUserName": "YEV\\n.van.a", "approverFullName": "Nguyễn Văn A", "approvalLevel": 0, "action": 0,
      "comment": null, "hasSignature": true, "signatureImage": "iVBORw0KG...", "actionAt": "2026-07-15T08:00:00Z" }
  ]
}
```
- `approvalHistories` là **audit trail đầy đủ** từng bước ký/duyệt/từ chối — render như timeline dọc trên UI chi tiết đơn (mỗi dòng = 1 cấp đã xử lý, `action` §2 quyết định icon Ký/Duyệt/Từ chối). **Đây cũng chính là nguồn JSON để FE tự dựng file PDF in đơn** (khớp layout giấy YEV-22-024) — BE không xuất PDF, chỉ cung cấp đủ dữ liệu qua endpoint này. Dòng `action=2 Rejected` KHÔNG có chữ ký (`hasSignature=false`, `signatureImage=null`) — từ chối chỉ ghi `comment` (lý do), không ký.
- `hasSignature` — cờ tiện dùng để FE quyết định có hiện `<img>` chữ ký hay không **mà không cần** giải mã `signatureImage` trước; `signatureImage` vẫn trả kèm nếu có (base64) để hiện trực tiếp.
- `approverFullName` — Họ tên hiển thị, snapshot tại đúng thời điểm ký (không đổi theo dù sau này tài khoản đó đổi tên). **Có thể `null`** nếu tài khoản chưa từng có `FullName` trong Identity lúc ký — FE luôn fallback `approverFullName ?? approverUserName` khi hiển thị/in PDF. Áp dụng tương tự cho `createdByFullName ?? createdByUserName` ở cấp đơn.
- **Suy ra "cấp đang chờ ai duyệt tiếp"** từ `status`: `Pending`(0)→đang chờ Trưởng phòng, `ApprovedByDepartment`(1)→chờ Trưởng xưởng, `ApprovedByWorkshop`(2)→chờ Tổng Giám Đốc, `Completed`(3)/`Rejected`(4)→hết, ẩn nút Duyệt/Từ chối.
- `isEditable` = `status == Pending` — điều kiện CẦN (chưa đủ) để hiện nút "Sửa", xem §1.2 và §4.1b.
- **`employees[].monthToDate`/`yearToDate`** — lũy kế HIỆN TẠI (live, đọc thẳng từ `Employee` lúc gọi API, không phải giá trị đóng băng lúc tạo đơn) — dùng để người duyệt đối chiếu ngưỡng TH3 (>25h/tháng, >300h/năm) ngay trên màn chi tiết, không cần mở thêm màn Employee.
- **`employees[].isEligibleForMeal`** — `true` khi `(endTime - startTime) > 2 giờ`. Tính sẵn ở BE, FE chỉ hiển thị (gợi ý tick `processPart.isEat`), không tự tính lại.

### 4.4 `POST /api/OtForm/{id}/approve`
```jsonc
// body — ApproveOtFormDto
{ "comment": null }   // chỉ còn comment, optional
```
- **`signatureImage` KHÔNG còn tồn tại trong body** (bỏ từ 2026-07-16) — chữ ký cấp duyệt BE tự lấy từ `UserSignature` đã đăng ký sẵn của chính người duyệt (`GET/PUT /api/UserSignature/me`, mục 6), snapshot vào `OtFormApprovalHistory.signatureImage` tại đúng thời điểm duyệt.
- **Bắt buộc phải đã đăng ký chữ ký thực tế nếu `otCase.requireSignature = true`** — chưa đăng ký (`GET /UserSignature/me` 404) → duyệt trả 400 ("...bắt buộc phải ký khi duyệt. Vui lòng đăng ký chữ ký..."). FE nên đọc `otCase.requireSignature` (gọi thêm `GET /api/OtCase/{otCaseId}` hoặc cache list `OtCase` đã load) để chủ động nhắc user đăng ký chữ ký trước khi vào màn Duyệt.
- 400 nếu: đơn đã `Completed`/`Rejected`; user không đúng cấp đang chờ; user không có `UserApprovalScope` khớp `departmentId`/`groupId` của đơn (trừ Tổng Giám Đốc).
- Thành công → đơn tự chuyển `status` kế tiếp hoặc `Completed` nếu vừa đạt `otCase.requiredApprovalLevel`. Response `data: true` — FE tự gọi lại `GET /{id}` để refresh chi tiết.

### 4.5 `POST /api/OtForm/{id}/reject`
```jsonc
// body — RejectOtFormDto
{ "comment": "Thiếu chứng từ, cần xác nhận lại." }   // [Required]
```
`status → Rejected`, dừng hẳn luồng ở bất kỳ cấp nào.

### 4.6 Duyệt/Từ chối qua email (2026-07-16) — kênh BỔ SUNG, không thay thế §4.4/§4.5

**Lý do**: Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc ít khi mở app — mỗi khi có đơn đến lượt họ duyệt (đơn mới tạo, hoặc vừa qua 1 cấp mà còn cấp tiếp theo), BE **tự động** gửi email cho **từng người** đủ quyền duyệt ở đúng cấp đó (1 đơn có thể có nhiều người cùng phạm vi → nhiều email, ai bấm trước thì đơn được duyệt bởi người đó). Email chứa link `{FrontendBaseUrl}/xac-nhan-don?token=xxx` — **FE tự xây trang public** tại route này, gọi 3 API sau (không cần đăng nhập SPA, token tự nó là thông tin xác thực):

| Method | Route | Việc gì |
|---|---|---|
| GET | `/api/OtForm/email-confirm/{token}` | Trả `OtFormDto` đầy đủ (giống hệt §4.3) để hiện chi tiết đơn trên trang xác nhận |
| POST | `/api/OtForm/email-confirm/{token}/approve` | Body `ApproveOtFormDto` (`{ "comment": null }`, giống §4.4) — duyệt |
| POST | `/api/OtForm/email-confirm/{token}/reject` | Body `RejectOtFormDto` (`{ "comment": "..." }` [Required], giống §4.5) — từ chối |

**Trang xác nhận gợi ý** (route public, không nằm trong menu điều hướng — chỉ mở qua link email):
```
[Hiện chi tiết đơn y hệt màn "Chi tiết đơn" — §1.3.C, dùng chung component]
Ghi chú/Comment [___]
[ Từ chối ]  (bắt buộc nhập comment trước khi bấm)          [ Duyệt ]
```
- Cả 2 nút gọi thẳng đúng logic `approve`/`reject` hiện có (§4.4/§4.5) — **không cần canvas ký**, chữ ký tự lấy từ `UserSignature` đã đăng ký của người đó y hệt duyệt trong app.
- Token gắn với **đúng 1 người + đúng 1 cấp duyệt** tại thời điểm gửi mail — nếu đơn đã được người khác duyệt/từ chối trước (hoặc đã đổi cấp) từ lúc gửi mail, bấm link cũ sẽ nhận lỗi rõ ràng (400 "Đơn đã xử lý xong...") thay vì duyệt nhầm — không cần FE tự kiểm tra trạng thái trước.
- Token hết hạn sau **3 ngày** hoặc đã dùng 1 lần (Duyệt hoặc Từ chối, cái nào bấm trước) → gọi lại bất kỳ API nào trong 3 API trên đều trả 400/404 (xem §9).
- Sau khi Duyệt/Từ chối thành công qua trang này, nếu còn cấp tiếp theo cần duyệt, BE **tự động** gửi tiếp email cho cấp đó — FE trang xác nhận không cần tự gọi thêm gì.

## 5. UserApprovalScope (`/api/UserApprovalScope`) — Admin gán phạm vi duyệt/tạo đơn

Dùng để khai báo "user X là Trưởng Group/Trưởng phòng/Trưởng xưởng phụ trách Group/Department nào" — **bắt buộc có trước** khi:
- Trưởng Group tạo được đơn (`approvalLevel=0 Submitter`, 2026-07-16) — **có thể gán nhiều `userName` cùng 1 `scopeId`** để nhiều người trong cùng Group đều tạo đơn được, không giới hạn 1 tài khoản duy nhất.
- Trưởng phòng/Trưởng xưởng duyệt được đơn (`approvalLevel=1/2`).

Tổng Giám Đốc không cần dòng nào ở đây (bypass qua Role).

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
- `approvalLevel`: `0=Submitter` (quyền tạo đơn, 2026-07-16), `1=DepartmentManager`, `2=WorkshopManager` (Tổng Giám Đốc không tạo dòng này, `3=GeneralDirector` không dùng ở đây).
- **Không có PUT** — sửa = `DELETE` dòng cũ + `POST` dòng mới.
- Trùng scope (cùng `userName`+`scopeType`+`scopeId`+`approvalLevel`) → 400.

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

## 7. Tổng hợp endpoint

| Route | Ghi chú |
|---|---|
| `/api/Department`, `/api/Reason`, `/api/OtCase` | CRUD chuẩn (grid-list, all, {id}, POST, PUT, DELETE) |
| `/api/Group` (`?by-department/{id}`) | CRUD + cascading theo Department |
| `/api/Employee` (`by-group/{id}`, `me`, `{id}/adjust-accumulation`) | CRUD + liệt kê theo Group + tự tra/tự chỉnh lũy kế (không cần permission) |
| `/api/UserApprovalScope` | grid-list, `by-user/{userName}`, POST, DELETE (không PUT) |
| `/api/UserSignature` | `me` (GET/PUT), `{userName}` (GET, admin), `confirm/{token}` (GET/POST, public — §6b) |
| `/api/OtForm` | `my-forms`, `pending-approvals`, `{id}` (GET/PUT), POST, `{id}/approve`, `{id}/reject`, `email-confirm/{token}` (GET), `email-confirm/{token}/approve`, `email-confirm/{token}/reject` (public — §4.6) |
| `/api/EmployeeImport` | `preview`, `confirm` (Admin, §3.7) |

## 8. Checklist FE — màn hình chính

**"Tạo đơn tăng ca" (Trưởng Group)**
1. Dropdown Bộ phận → `Department/all`; Nhóm → `Group/by-department/{id}` (thường chỉ 1 nhóm nếu user chỉ quản 1 Group — vẫn để dropdown cho tổng quát); Lý do → `Reason/all`; Trường hợp OT → `OtCase/all`.
2. Bảng chọn nhân viên → `Employee/by-group/{groupId}`, tick nhiều dòng → build `employees[]`.
3. Chữ ký "Người đề nghị" **không còn nhập ở đây** — BE tự lấy từ `UserSignature` đã đăng ký sẵn của user gọi API. FE nên kiểm tra `GET /UserSignature/me` trước (404 → chưa đăng ký) và điều hướng sang "Cài đặt chữ ký" nếu chưa có, tránh để user bấm Submit rồi mới nhận lỗi 400.
4. Submit `POST /api/OtForm` → điều hướng sang màn chi tiết (dùng `data` trả về, không cần gọi lại).

**"Đơn của tôi"** → `GET /my-forms`, click dòng → `GET /{id}` xem chi tiết + timeline `approvalHistories`. Dòng có `isEditable=true` hiện thêm nút "Sửa" → mở lại form Tạo đơn đổ sẵn dữ liệu → `PUT /{id}`.

**"Chờ tôi duyệt" (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc)**
1. `GET /pending-approvals` — danh sách đã tự lọc đúng phạm vi/cấp của user đang đăng nhập.
2. Vào chi tiết `GET /{id}` → nút "Duyệt"/"Từ chối".
3. "Duyệt": không còn canvas ký ở màn này — BE tự lấy chữ ký từ `UserSignature` đã đăng ký của người duyệt. Nếu `otCase.requireSignature` (tra thêm `OtCase/{id}`) mà user chưa đăng ký chữ ký → nhắc điều hướng sang "Cài đặt chữ ký" trước khi cho bấm Duyệt → `POST /{id}/approve` (body chỉ còn `comment`).
4. "Từ chối": bắt buộc nhập `comment` → `POST /{id}/reject`.
5. Sau khi duyệt/từ chối → gọi lại `GET /{id}` refresh timeline + trạng thái nút.

**"Cài đặt chữ ký"** → `GET /UserSignature/me` hiện preview (chữ ký đang có hiệu lực), canvas vẽ lại → `PUT /me` → **không** áp dụng ngay, hiện thông báo "đã gửi email xác nhận, kiểm tra hộp thư trong 30 phút" (không tự refresh preview vì chữ ký chưa đổi).

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

**"In đơn / Xuất PDF"** — BE không tạo PDF, FE tự dựng file từ JSON `GET /api/OtForm/{id}` (đã đủ dữ liệu để khớp layout giấy YEV-22-024: header đơn, danh sách nhân viên, ProcessPart, và từng dòng `approvalHistories` có sẵn `signatureImage`(base64)+`approverFullName` để in đúng chữ ký/tên từng cấp đã duyệt). Thường chỉ cho phép in khi `status = Completed`(3), nhưng API không chặn — FE tự quyết định khi nào hiện nút "In".

**Admin — "Phân quyền duyệt"** → gán Role (Identity `update-user-roles`) trước, rồi `POST /api/UserApprovalScope` khai báo phạm vi cho từng Trưởng phòng/Trưởng xưởng (`approvalLevel=1/2`) **và cho từng người được phép tạo đơn** (`approvalLevel=0 Submitter`) — 1 Group có thể gán nhiều người ở `approvalLevel=Submitter`. Không có màn sửa — xóa + tạo lại.

**"Lũy kế của tôi"** (mọi user đăng nhập, không cần permission Attendance nào)
1. `GET /api/Employee/me` — 404 thì ẩn hẳn màn, báo "chưa được gán nhân viên tương ứng".
2. Hiện `monthToDate`/`yearToDate` hiện tại, form 2 ô nhập để sửa.
3. Submit → `PATCH /api/Employee/{id}/adjust-accumulation` → gọi lại `GET /me` refresh.

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân → xử lý |
|---|---|
| `POST /OtForm` 400 "khác nhóm" | 1 `employeeId` trong `employees[]` không cùng `groupId` với đơn → chỉ cho tick nhân viên từ đúng `by-group/{groupId}` đang chọn |
| `POST /{id}/approve` 400 dù đúng Role | Thiếu `UserApprovalScope` khớp `departmentId`/`groupId` của đơn + đúng cấp — báo Admin tạo qua `POST /UserApprovalScope` |
| `POST /{id}/approve` 400 "chữ ký" | `otCase.requireSignature=true` nhưng người duyệt chưa đăng ký chữ ký qua `PUT /UserSignature/me` |
| `POST /OtForm` 400 "chưa đăng ký chữ ký" | Người tạo đơn chưa đăng ký chữ ký qua `PUT /UserSignature/me` — chữ ký "Người đề nghị" luôn bắt buộc |
| `POST /OtForm` 400 "không được phân quyền tạo đơn" | Người gọi có Role Trưởng Group (permission `OTForm.Create`) nhưng chưa được Admin gán `UserApprovalScope(approvalLevel=Submitter)` khớp `groupId`/`departmentId` của đơn → báo Admin tạo qua `POST /UserApprovalScope` |
| `pending-approvals` luôn rỗng dù có đơn chờ | User Tổng Giám Đốc thiếu Role `"Tổng Giám Đốc"` (case-sensitive, kiểm tra đúng chuỗi), hoặc Trưởng phòng/xưởng thiếu `UserApprovalScope` |
| `POST /OtForm` 400 "Giờ kết thúc OT của nhân viên ... phải sau giờ bắt đầu ... và không được vượt quá giờ kết thúc của đơn" | 1 `employees[].endTime` <= `startTime` của đơn hoặc > `endTime` của đơn — FE nên giới hạn input giờ kết thúc từng nhân viên trong khoảng `(startTime, endTime]` của đơn ngay trên UI, không đợi BE trả lỗi |
| `PUT /OtForm/{id}` 400 "Bạn chỉ có thể sửa đơn do chính mình tạo" | Gọi sửa đơn không phải do mình tạo — chỉ hiện nút "Sửa" khi `createdByUserName == user hiện tại` |
| `PUT /OtForm/{id}` 400 "Đơn đã được duyệt ít nhất 1 cấp, không thể sửa nữa" | Đơn đã qua cấp duyệt nào đó (`isEditable=false`) — ẩn nút "Sửa" dựa vào field này thay vì tự đoán theo `status` |
| `PATCH /Employee/{id}/adjust-accumulation` 400 "Bạn không có quyền chỉnh lũy kế của nhân viên này" | `id` không phải nhân viên gắn với `userName` của người gọi, và người gọi cũng không có quyền `Attendance.Employee.Update` — kiểm tra lại `GET /Employee/me` trả về đúng `id` chưa |
| `GET /Employee/me` trả 404 | Tài khoản đang đăng nhập chưa được Admin gán `Employee.UserName` — yêu cầu Admin cập nhật qua `PUT /api/Employee/{id}` |
| `GET/POST /UserSignature/confirm/{token}` 404 "Yêu cầu xác nhận chữ ký..." | Token sai/không tồn tại — kiểm tra lại link email, có thể bị copy thiếu ký tự |
| `POST /UserSignature/confirm/{token}` 400 "Link xác nhận này đã được sử dụng" | Token đã bấm xác nhận trước đó (single-use) — chữ ký đã áp dụng rồi, không cần làm gì thêm |
| `GET/POST /UserSignature/confirm/{token}` 400 "Link xác nhận đã hết hạn" | Quá 30 phút kể từ lúc `PUT /me` — quay lại app gọi `PUT /me` lại để nhận email mới |
| `GET/POST /OtForm/email-confirm/{token}...` 404 "Link duyệt đơn qua email..." | Token sai/không tồn tại |
| `POST /OtForm/email-confirm/{token}/approve\|reject` 400 "Link duyệt đơn này đã được sử dụng" | Token đã bấm Duyệt hoặc Từ chối trước đó (single-use) |
| `GET/POST /OtForm/email-confirm/{token}...` 400 "Link duyệt đơn qua email đã hết hạn" | Quá 3 ngày kể từ lúc gửi mail — người duyệt cần vào app dùng `pending-approvals` thay vì link email cũ |
| `POST /OtForm/email-confirm/{token}/approve\|reject` 400 "Đơn đã xử lý xong..." | Đơn đã được người khác duyệt/từ chối (hoặc đổi cấp) từ lúc gửi mail đến lúc bấm link — bình thường khi 1 đơn có nhiều người cùng nhận được email |
| `POST /EmployeeImport/preview` 400 "File Excel không hợp lệ..." | File không phải `.xlsx` OOXML thật (VD `.xlsb`, `.xls` cũ đổi đuôi) — mở file trong Excel, Save As lại đúng "Excel Workbook (*.xlsx)" |
| 401/403 chung | Xem [identity-api-fe.md §6](identity-api-fe.md) |
