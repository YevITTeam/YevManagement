# attendance-otform-pdf-mapping.md — Mapping ô trên phiếu giấy ↔ field dữ liệu (in PDF)

> Tài liệu này TÁCH RIÊNG khỏi `attendance-api-fe.md` (hợp đồng API) và `attendance-module.md`
> (thiết kế nghiệp vụ) — vì mục đích duy nhất của file này là ghi lại **mẫu phiếu giấy hiện hành
> trông như thế nào** và **field nào trong `GET /api/OtForm/{id}` đổ vào ô nào khi FE dựng PDF để in**.
> Khi mẫu phiếu giấy đổi (đổi layout, thêm/bớt ô, đổi lần ban hành...), chỉ cần sửa file này —
> KHÔNG cần đụng BE trừ khi phiếu mới có ô dữ liệu hoàn toàn mới mà hệ thống chưa lưu (xem
> §3 "Ô chưa có field trong DB" — quy trình xử lý khi gặp trường hợp này).

## 0. Nguồn phiếu đang mapping (cập nhật mỗi khi đổi mẫu)

| | |
|---|---|
| Mã phiếu | `YEV-22-024` |
| Tên phiếu | GIẤY ĐỀ NGHỊ LÀM NGOÀI GIỜ (残業申請書) |
| Lần ban hành | **Lần 5**, ngày cải chính **03/02/2024** (in ở footer mọi trang) |
| File nguồn | `docs/docs-be/YEV-22-024 (LBH5)-GIAY DE NGHI LAM NGOAI GIO (A4).doc` (khổ A4, tối đa 40 nhân viên/đơn, chia 2 trang) và bản `(A5).doc` (khổ A5, tối đa 12 nhân viên/đơn, 1 trang) |
| Khác biệt A4 vs A5 | **Chỉ khác số dòng danh sách nhân viên** (A4: 10 dòng trang 1 + 30 dòng trang 2 = 40; A5: 12 dòng) và vài chữ Nhật phụ đề không ảnh hưởng field. **Cấu trúc field giữa 2 khổ giống hệt nhau** — bảng mapping bên dưới dùng chung cho cả 2, chỉ khác số dòng tối đa khi FE dựng bảng nhân viên. |

**Quy trình khi có phiếu mới (đổi lần ban hành)**: mở file `.doc` mới bằng Word (hoặc `antiword` nếu chỉ cần đọc nhanh không dấu), so từng ô với bảng ở §1-§2 bên dưới — ô nào giữ nguyên ý nghĩa thì giữ mapping cũ, ô nào đổi vị trí/label thì sửa lại dòng tương ứng, ô nào **hoàn toàn mới** thì thêm vào §3. Đừng xoá bản ghi "Lần ban hành" cũ — đổi tên mục §0 thành lịch sử (VD "Lần 5 → 03/02/2024 (cũ)", "Lần 6 → dd/mm/yyyy (hiện hành)") để biết đơn in trước đó theo mẫu nào.

## 1. Khối đầu phiếu — 4 ô chữ ký

Phiếu giấy chỉ có đúng **4 ô chữ ký** (không có ô tên/ngày ký riêng, chữ ký đóng thẳng vào ô trống):

| Ô trên phiếu (Vn / Jp) | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Tổng giám đốc / 社長 | `approvalHistories[]` lọc `approvalLevel == 3 (GeneralDirector)` → `.signatureImage` | Chỉ có nếu đơn đã đi tới cấp này (`otCaseCode` = TH3 hoặc đơn đã Completed qua đủ cấp) |
| Trưởng xưởng / 工場長 | `approvalHistories[]` lọc `approvalLevel == 2 (WorkshopManager)` → `.signatureImage` | |
| Trưởng phòng / 部長 | `approvalHistories[]` lọc `approvalLevel == 1 (DepartmentManager)` → `.signatureImage` | |
| Người đề nghị / 申請者 | **CẢ 2** chữ ký cùng đổ vào chung 1 ô này: `approvalHistories[]` lọc `approvalLevel == 0 (Submitter)` **và** `approvalLevel == 4 (GroupHead)` → `.signatureImage` của từng dòng | **Đã chốt với nghiệp vụ (2026-07-20)**: Trưởng nhóm VÀ Trưởng Bộ phận đều ký chung vào ô "Người đề nghị" trên phiếu giấy — phiếu không có ô riêng cho GroupHead vì thực tế 2 người cùng ký chồng/cạnh nhau trong 1 ô. FE nên xếp 2 ảnh chữ ký cạnh nhau hoặc chồng theo đúng thứ tự ký thật (Submitter ký trước, GroupHead ký sau — xem `actionAt` để sắp thứ tự nếu cần). Chữ ký Submitter là Trưởng nhóm (`POST /{id}/submit`), KHÔNG phải người tạo đơn — xem `attendance-module.md §Người tạo đơn KHÁC Trưởng nhóm` |

FE gợi ý: nếu muốn in kèm tên người ký/ngày ký dưới mỗi ô (phiếu gốc không có dòng này nhưng thường cần cho minh bạch) thì lấy thêm `.approverFullName` (fallback `.approverUserName`) và `.actionAt` cùng dòng lọc trên.

## 2. Khối thông tin chính

| Ô trên phiếu (Vn / Jp) | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Tên công đoạn / 工程名 | **Đã chốt (2026-08-25)** — xem §3 | Khác nhau theo `isProductionForm` |
| Số lượng nhân viên / 人数 | `numberOfEmployee` | |
| Người chịu trách nhiệm / 責任者 | **Đã chốt (2026-08-07, Giai đoạn Cây chức vụ)**: `approvalSteps[]` lọc `isResponsibleSnapshot == true` → tra `approvalHistories[stepOrder]` → `.approverFullName` (fallback `.approverUserName`, rồi `createdByFullName`/`createdByUserName` nếu bước chưa duyệt tới hoặc chuỗi chưa cấu hình bước IsResponsible) | Là bước được Admin đánh dấu "người chịu trách nhiệm" khi cấu hình Cây duyệt (Nhóm hoặc Chuyền) — **không còn phải Trưởng nhóm cố định** như thiết kế cũ (`approvalLevel==0 Submitter`, đã bỏ cùng đợt thay thế `UserApprovalScope` bằng Cây chức vụ). Dùng chung logic cho cả đơn "theo Nhóm" và "theo chuyền". |
| Thời gian — Từ / から | `startTime` (format `HH:mm`) | |
| Thời gian — Đến / まで | `endTime` (format `HH:mm`) | Đây là giờ kết thúc TỐI ĐA của đơn — từng nhân viên có thể kết thúc sớm hơn, xem bảng nhân viên §4 |
| Ngày / 日付 | `date` (format `dd/MM/yyyy`) | |
| Lý do / 理由 | Dòng 1: `reasonNameVn` (+ nối thêm `subReason` nếu có, VD `"{reasonNameVn}: {subReason}"`); dòng 2 (nếu có): `reasonNameJp` | **Sửa 2026-08-27**: trước chỉ in `reasonNameVn`, thiếu hẳn tiếng Nhật dù `Reason.ReasonNameJp` đã có sẵn từ lâu — nay in 2 dòng trong cùng ô (font dòng Nhật nhỏ hơn), khớp mẫu giấy gốc vốn luôn có cả 2 ngôn ngữ. `reasonNameJp` null (Reason đó chưa dịch) thì chỉ in 1 dòng như cũ. |

## 3. Ô "Tên công đoạn / 工程名" — khác nhau theo loại đơn (đã chốt 2026-08-25)

Field cũ `AreaLine` đã bị xoá hẳn (migration `RemoveAreaLineFromOtFormAddGroupDepartment`, 2026-07-14)
khi thay bằng `Group`/`Department` — đúng cho đơn "theo Nhóm" nhưng đơn "theo chuyền"
(`isProductionForm=true`) không gắn 1 Group cố định (`groupNameVn = null`) nên cần nguồn khác:

| Loại đơn | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Theo Nhóm (`isProductionForm=false`) | `${departmentNameVn} — ${groupNameVn}` | Không đổi so với trước |
| Theo chuyền (`isProductionForm=true`) | Gộp theo GIÁ TRỊ PHÂN BIỆT từ `employees[].teamCodeSnapshot` / `.blockCodeSnapshot` / `.shiftTeamCodeSnapshot` (bỏ qua `isRemoved=true`), nối `"{teamCodes}   {lineCodes}   {shiftTeamCodes}"` | **Sửa 2026-08-27**: trước dùng nhầm `.congDoanSnapshot` ở vị trí giữa (ra mã tắt vô nghĩa như "HC GT HC"), người dùng xác nhận công thức đúng là **Team + Line + Nhóm Ca** — `.blockCodeSnapshot` (= "Line", vì `ProductionLineId` khớp `BlockCode`) thay cho `.congDoanSnapshot`. Snapshot lấy từ `ProductionEmployee` lúc thêm người vào đơn (xem `OtFormEmployee.BlockCodeSnapshot`/`TeamCodeSnapshot`/`ShiftTeamCodeSnapshot`, `attendance-module.md §Chế tạo`). Mỗi phần có thể có NHIỀU giá trị nếu nhân viên trong đơn không cùng Team/Line/Nhóm ca — nối bằng `/` |

**Quy trình chung khi gặp ô kiểu này ở phiếu mới**: KHÔNG tự ý nhét dữ liệu có sẵn khi chưa xác nhận — chỉ để trống/note "cần bổ sung" và hỏi người yêu cầu nghiệp vụ trước (đúng CLAUDE.md §2 luật 2 — không tự bịa nghiệp vụ khi thiếu thông tin).

## 4. Khối "Phần xử lý / 処理欄"

Cấu trúc bảng thật trên phiếu (đã dump từng ô qua Word COM để chắc chắn không sót):

| Cột trên phiếu | Lựa chọn in trên phiếu | Nguồn dữ liệu |
|---|---|---|
| Ăn uống / 軽食 | "Ăn / 食べる" hoặc "Không ăn / 食べない" | `processPart.isEat` (true→"Ăn", false→"Không ăn") |
| Xe đưa đón / バス | "Có / 有" hoặc "Không / 無" | `processPart.isTransportation` |
| Copy / コピー | "Có / 有" hoặc "Không / 無" | `processPart.isUseCopyRoom` |
| Đề nghị khác / その他 | free text | `processPart.anotherSuggestionVn` (+ `anotherSuggestionJp` nếu cần song ngữ) |

> **Đã chốt (2026-08-10)**: `processPart.mainTicketCount`/`secondaryTicketCount`/`milkCount` (phiếu chính/phiếu phụ/sữa) — 3 field này có trong DB từ trước (migration `AddMealTicketCountsToProcessPart`, 2026-07-16) nhưng KHÔNG có ô riêng nào trên mẫu phiếu `YEV-22-024 (Lần 5)` gốc. Theo yêu cầu người dùng, in đè cả 3 số này ngay **bên trong ô "Ăn / 食べる"** (không có ô riêng trên giấy), chỉ khi `isEat=true` — và khi đó KHÔNG còn tick dấu ✓ nữa, thay hẳn bằng 3 dòng (cỡ chữ nhỏ 6pt vì ô gốc rất hẹp): `P.Chính: {mainTicketCount}`, `P.Phụ: {secondaryTicketCount}`, `P.Sữa: {milkCount}`. Xem `OtFormPrintView.tsx` → `FormHeaderFields`, ô `checkbox.an`.

## 5. Khối "Danh sách nhân viên làm ngoài giờ / 社員の残業一覧"

7 cột, lặp lại N dòng (A4 tối đa 40 dòng qua 2 trang, A5 tối đa 12 dòng 1 trang):

| Cột trên phiếu | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Stt | Số thứ tự dòng (tự sinh khi in, 1..N) | Không lưu DB |
| Họ và tên / 氏名 | `employees[i].fullName` | |
| Mã NV / 社員コード | `employees[i].employeeCode` | |
| Thời gian / 時間 | `employees[i].startTime` – `employees[i].endTime` (format `HH:mm - HH:mm`) | `startTime` luôn = giờ đầu đơn; `endTime` có thể sớm hơn giờ cuối đơn |
| Lũy kế — Tháng / 月間 | `employees[i].monthToDate` | |
| Lũy kế — Năm / 年間 | `employees[i].yearToDate` | |
| Ghi chú / 備考 | `employees[i].noteVn` (+ `noteJp` nếu cần song ngữ) | |

FE cần tự chia trang nếu số nhân viên vượt số dòng tối đa của khổ giấy đang in (40 với A4, 12 với A5) — BE không giới hạn số nhân viên/đơn.

## 6. Khối chú thích TH1/TH2/TH3 (footer)

Đây là text tĩnh in sẵn trên phiếu (không đổi theo dữ liệu), chỉ cần **đánh dấu đúng dòng TH nào khớp với đơn đang in**:

```
( TH1: Tăng ca ngày thường: Ký duyệt cấp Trưởng phòng
( TH2: Tăng ca ngày nghỉ quy định/chủ nhật/Lễ: Ký duyệt cấp Trưởng xưởng
( TH3: Trường hợp lũy kế tăng ca trên 25 giờ/tháng, 300h/năm: Ký duyệt cấp TGĐ
```

Đánh dấu (tô đậm/thêm dấu ✓ trước ký tự `(`) dòng có `otCaseCode` khớp với `otFormDto.otCaseCode` (`TH1`/`TH2`/`TH3` — đây là `OtCase.Code`, master data admin tự đặt tên, không hardcode).

## 7. Nguyên tắc "tự chủ" khi phiếu đổi mẫu trong tương lai

1. **Không hardcode toạ độ/pixel trong code BE hay FE** — BE chỉ trả JSON đầy đủ qua `GET /api/OtForm/{id}` (đã đủ dữ liệu cho mọi field ở bảng trên), việc "điền vào đúng ô nào" là trách nhiệm của FE dựa theo file mapping này, tách biệt hoàn toàn khỏi hợp đồng API.
2. **Mỗi lần đổi mẫu phiếu**: cập nhật §0 (lần ban hành mới), rà lại từng bảng ở §1-§6 xem ô nào đổi vị trí/label, thêm ô mới vào §3 nếu chưa có field — **không suy đoán/tự chế field**, hỏi lại nghiệp vụ như quy trình đã áp dụng cho "Tên công đoạn"/"Người chịu trách nhiệm".
3. **Giữ lại lịch sử các lần ban hành cũ** trong file này (không ghi đè) — đơn cũ đã in theo mẫu cũ vẫn cần biết tra cứu đúng layout nào nếu có tranh chấp/kiểm tra lại giấy tờ.
4. **Field mới phát sinh từ mẫu mới → luôn cần migration thật** (thêm cột DB + cập nhật DTO liên quan) trước khi FE có thể in — không có cách nào "tự chủ" bỏ qua bước này, vì PDF chỉ có thể in dữ liệu mà hệ thống đã lưu.
