# attendance-otform-pdf-mapping.md — Ô trên phiếu giấy ↔ field dữ liệu (in PDF)

FE dựng PDF từ `GET /api/OtForm/{id}` (code: `yev-frontend/src/modules/attendance/components/ot-form/OtFormPrintView.tsx`). File này chỉ ghi **ô nào trên phiếu giấy lấy field nào**. Hợp đồng API ở `attendance-module.md §API`, nghiệp vụ ở `attendance-module.md`.

## 0. Phiếu đang mapping

| | |
|---|---|
| Mã / tên | `YEV-22-024` — GIẤY ĐỀ NGHỊ LÀM NGOÀI GIỜ (残業申請書) |
| Lần ban hành | Lần 5, cải chính 03/02/2024 (in ở footer) |
| File nguồn | `docs/Data/YEV-22-024 (LBH5)-GIAY DE NGHI LAM NGOAI GIO (A4).doc` (tối đa 40 NV, 2 trang: 10 + 30 dòng) và bản `(A5).doc` (tối đa 12 NV, 1 trang) |
| A4 vs A5 | Chỉ khác số dòng danh sách NV; field giống hệt nhau |

- Đổi mẫu phiếu: giữ lại mục lần ban hành cũ (đổi tên thành "cũ") để tra đơn đã in; so từng ô với §1–§6, ô hoàn toàn mới thì hỏi nghiệp vụ trước (AGENTS §2 luật 2), không tự nhét dữ liệu có sẵn.
- Ô cần dữ liệu hệ thống chưa lưu → phải có migration + DTO trước khi FE in được. Không hardcode toạ độ trong BE.

## 1. Bốn ô chữ ký

Chữ ký là `approvalHistories[].signatureImage`, lọc theo `approvalLevel`. Phiếu không có ô tên/ngày ký riêng (muốn in thêm thì lấy `.approverFullName` fallback `.approverUserName`, và `.actionAt`).

| Ô (Vn / Jp) | Nguồn |
|---|---|
| Tổng giám đốc / 社長 | `approvalLevel == 3` (GeneralDirector) — chỉ có khi đơn đã đi tới cấp này |
| Trưởng xưởng / 工場長 | `approvalLevel == 2` (WorkshopManager) |
| Trưởng phòng / 部長 | `approvalLevel == 1` (DepartmentManager) |
| Người đề nghị / 申請者 | **Cả 2** vào chung một ô: `approvalLevel == 0` (Submitter = Trưởng nhóm, không phải người tạo đơn) và `== 4` (GroupHead). Xếp cạnh nhau theo `actionAt` (Submitter trước) |

## 2. Khối thông tin chính

| Ô | Nguồn |
|---|---|
| Số lượng nhân viên / 人数 | `numberOfEmployee` |
| Người chịu trách nhiệm / 責任者 | Bước trong `approvalSteps[]` có `isResponsibleSnapshot == true` → `approvalHistories[stepOrder].approverFullName` (fallback `approverUserName`, rồi `createdByFullName`/`createdByUserName` nếu bước chưa duyệt hoặc chuỗi chưa đánh dấu IsResponsible). Dùng chung cho đơn Nhóm và đơn chuyền |
| Thời gian — Từ / から | `startTime` (`HH:mm`) |
| Thời gian — Đến / まで | `endTime` (`HH:mm`) — giờ kết thúc tối đa của đơn; từng NV có thể sớm hơn (§5) |
| Ngày / 日付 | `date` (`dd/MM/yyyy`) |
| Lý do / 理由 | Dòng 1: `reasonNameVn` (+ `: {subReason}` nếu có). Dòng 2 (font nhỏ hơn, bỏ nếu null): `reasonNameJp` |
| Tên công đoạn / 工程名 | Xem §3 |

## 3. Ô "Tên công đoạn / 工程名"

| Loại đơn | Nguồn |
|---|---|
| Theo Nhóm (`isProductionForm=false`) | `${departmentNameVn} — ${groupNameVn}` |
| Theo chuyền (`isProductionForm=true`, `groupNameVn = null`) | Giá trị phân biệt (bỏ `isRemoved=true`) của `employees[].teamCodeSnapshot`, `.blockCodeSnapshot` (= "Line"), `.shiftTeamCodeSnapshot`; nối `"{team}   {line}   {nhóm ca}"`, mỗi phần nhiều giá trị thì nối bằng `/` |

## 4. Khối "Phần xử lý / 処理欄"

| Cột | In | Nguồn |
|---|---|---|
| Ăn uống / 軽食 | "Ăn / 食べる" hoặc "Không ăn / 食べない" | `processPart.isEat` |
| Xe đưa đón / バス | "Có / 有" hoặc "Không / 無" | `processPart.isTransportation` |
| Copy / コピー | "Có / 有" hoặc "Không / 無" | `processPart.isUseCopyRoom` |
| Đề nghị khác / その他 | free text | `processPart.anotherSuggestionVn` (+ `anotherSuggestionJp`) |

Phiếu giấy không có ô cho số phiếu ăn. Khi `isEat=true`, ô "Ăn" **không tick ✓** mà in 3 dòng 6pt: `P.Chính: {mainTicketCount}`, `P.Phụ: {secondaryTicketCount}`, `P.Sữa: {milkCount}` (code: `FormHeaderFields`, ô `checkbox.an`).

## 5. Danh sách nhân viên / 社員の残業一覧

7 cột, lặp N dòng. FE tự chia trang khi vượt số dòng tối đa của khổ giấy (BE không giới hạn số NV/đơn).

| Cột | Nguồn |
|---|---|
| Stt | Tự sinh 1..N |
| Họ và tên / 氏名 | `employees[i].fullName` |
| Mã NV / 社員コード | `employees[i].employeeCode` |
| Thời gian / 時間 | `startTime – endTime` (`HH:mm - HH:mm`); `startTime` = giờ đầu đơn |
| Lũy kế — Tháng / 月間 | `employees[i].monthToDate + actualHours` (lũy kế **sau** khi cộng đơn này) |
| Lũy kế — Năm / 年間 | `employees[i].yearToDate + actualHours` |
| Ghi chú / 備考 | `employees[i].noteVn` (+ `noteJp`) |

## 6. Chú thích TH1/TH2/TH3 (footer)

Text tĩnh in sẵn trên phiếu; chỉ đánh dấu (đậm hoặc ✓ trước `(`) dòng khớp `otCaseCode`. `OtCase.Code` là master data admin tự đặt, không hardcode.

```
( TH1: Tăng ca ngày thường: Ký duyệt cấp Trưởng phòng
( TH2: Tăng ca ngày nghỉ quy định/chủ nhật/Lễ: Ký duyệt cấp Trưởng xưởng
( TH3: Trường hợp lũy kế tăng ca trên 25 giờ/tháng, 300h/năm: Ký duyệt cấp TGĐ
```
