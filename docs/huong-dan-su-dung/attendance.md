# Hướng dẫn sử dụng — Quản lý tăng ca (OT)

Tài liệu dành cho người dùng hệ thống YEV Management, module **Quản lý tăng ca**: nhân viên lập đơn, người duyệt các cấp, người phụ trách đơn vị và quản trị viên.

> Menu bạn thấy phụ thuộc vào **Chức vụ** và quyền được gán. Nếu thiếu một mục trong tài liệu này, có thể bạn chưa được cấp quyền tương ứng — liên hệ quản trị viên.

---

## Mục lục

1. [Khái niệm cơ bản](#1-khái-niệm-cơ-bản)
2. [Chuẩn bị lần đầu: Chữ ký và Mật khẩu cấp 2](#2-chuẩn-bị-lần-đầu)
3. [Quy trình tổng quát của một đơn tăng ca](#3-quy-trình-tổng-quát)
4. [Đăng ký tăng ca](#4-đăng-ký-tăng-ca)
5. [Theo dõi đơn — màn "Đơn tăng ca"](#5-theo-dõi-đơn)
6. [Duyệt đơn](#6-duyệt-đơn)
7. [Sửa đơn](#7-sửa-đơn)
8. [Đơn tổng (dành cho cấp quản lý)](#8-đơn-tổng)
9. [Ủy quyền duyệt](#9-ủy-quyền-duyệt)
10. [Tổng quan tăng ca](#10-tổng-quan-tăng-ca)
11. [Trợ lý AI đăng ký tăng ca](#11-trợ-lý-ai)
12. [Danh mục (quản trị và người phụ trách)](#12-danh-mục)
13. [Import / Export Excel](#13-import--export-excel)
14. [Câu hỏi và lỗi thường gặp](#14-câu-hỏi-và-lỗi-thường-gặp)

---

## 1. Khái niệm cơ bản

| Khái niệm | Ý nghĩa |
|---|---|
| **Xưởng** | Địa điểm nhà máy (vd Dĩ An). Một Nhóm thuộc đúng 1 Xưởng. |
| **Bộ phận / Phòng ban** | Dùng chung giữa các Xưởng. |
| **Nhóm** | Đơn vị nhỏ nhất của nhân viên văn phòng, thuộc 1 Bộ phận và 1 Xưởng. |
| **Đơn Văn phòng** | Đơn lập cho nhân viên trong cùng một Nhóm. |
| **Đơn Xưởng (theo chuyền)** | Đơn lập cho nhân viên dưới chuyền sản xuất, chọn theo Team / Line / Nhóm ca / Công đoạn. |
| **Chức vụ** | Staff, Line Leader, Group Leader, Team Leader, Manager (Trưởng phòng), Factory Manager (Trưởng xưởng), Director (Giám đốc). Chức vụ quyết định bạn duyệt đơn nào và có quyền gì. |
| **Cây duyệt** | Thứ tự các cấp phải duyệt một đơn, do quản trị viên hoặc người phụ trách đơn vị cấu hình. |
| **Trường hợp OT (TH1/TH2/TH3)** | Hệ thống **tự xác định**, quyết định cấp duyệt cuối cùng (xem [mục 4.3](#43-trường-hợp-ot-th1--th2--th3)). |
| **Lũy kế** | Tổng giờ tăng ca của nhân viên trong tháng / năm, chỉ cộng khi đơn **Hoàn tất**. |

**Trạng thái đơn:** `Đang chờ phê duyệt` → `Hoàn tất` hoặc `Không phê duyệt`.

---

## 2. Chuẩn bị lần đầu

Trước khi lập hoặc duyệt đơn, mỗi người cần thiết lập **hai thứ**. Cả hai đều xác nhận qua **email** để chống người khác đổi hộ.

### 2.1. Chữ ký của tôi

Menu **Chữ ký của tôi**.

1. Ký tay lên giấy trắng, chụp ảnh hoặc scan (PNG/JPG; ảnh HEIC của iPhone cần chuyển sang JPG trước).
2. Chọn file ảnh. Hệ thống **tự xoá nền giấy**, chỉ giữ nét ký và cắt sát chữ ký — kiểm tra ảnh xem trước.
3. Bấm **Gửi email xác nhận cập nhật**. Mở email, bấm link xác nhận trong **30 phút**. Chữ ký mới chỉ có hiệu lực sau khi xác nhận; trước đó chữ ký cũ vẫn được dùng.

Mẹo để tách nền sạch: chụp đủ sáng, giấy trắng, không có bóng đổ, tránh để chữ ký sát bảng kẻ hoặc chữ in khác.

> Chữ ký đã ký trên đơn được **lưu cố định** cùng đơn. Đổi chữ ký sau này không làm thay đổi các đơn cũ.

### 2.2. Mật khẩu cấp 2

Menu **Mật khẩu cấp 2**.

- Tối thiểu 6 ký tự, **khác** mật khẩu đăng nhập Windows.
- Bấm **Gửi email xác nhận thiết lập**, rồi bấm link trong email trong **30 phút**.
- Phải nhập mật khẩu cấp 2 mỗi khi **Đăng ký, Lưu sửa, Phê duyệt, Không phê duyệt** đơn.

---

## 3. Quy trình tổng quát

```
Người lập đơn                 Cấp trung gian              Cấp quản lý
(Đăng ký tăng ca)        (Group/Team Leader…)     (Trưởng phòng → Trưởng xưởng → Giám đốc)
      │                           │                             │
      ├─ Đăng ký ───────────────► │ nhận email từng đơn         │
      │   (mật khẩu cấp 2)        ├─ Phê duyệt / Không phê duyệt│
      │                           │   (có thể bỏ từng nhân viên)│
      │                           └───────────────────────────► │ nhận email Đơn tổng 1 lần/ngày
      │                                                         ├─ Duyệt từng đơn hoặc cả Đơn tổng
      ◄──────── email báo kết quả: ĐÃ DUYỆT / TỪ CHỐI ──────────┘
                     Đơn Hoàn tất → giờ OT cộng vào lũy kế
```

Các điểm quan trọng:

- **Không có bản nháp.** Bấm **Đăng ký** là đơn vào luồng duyệt ngay.
- Danh sách người duyệt của từng bước được **chốt lúc tạo đơn**. Thay đổi Cây duyệt hoặc chức vụ sau đó không ảnh hưởng đơn đang chạy.
- Mỗi bước có thể có nhiều người được duyệt; **một người duyệt là đủ** để sang bước tiếp.
- Một người **Không phê duyệt** là cả đơn dừng, các bước còn lại bị bỏ qua.
- Người lập đơn nhận email khi đơn **duyệt xong toàn bộ**, khi đơn **bị từ chối**, hoặc khi có nhân viên **bị loại** khỏi đơn.

---

## 4. Đăng ký tăng ca

Menu **Đăng ký tăng ca**. Đầu trang có 2 chế độ: **Văn phòng** và **Xưởng** (chỉ hiện chế độ bạn có quyền).

### 4.1. Đơn Văn phòng

1. **Đơn vị:** Bộ phận / Nhóm tự điền theo Nhóm của bạn (bị khoá nếu bạn chỉ thuộc 1 Nhóm).
2. **Ngày, Giờ bắt đầu, Giờ kết thúc** của ca tăng ca.
3. **Lý do** (bắt buộc) và **Lý do phụ** (tuỳ chọn).
4. **Yêu cầu hỗ trợ khác:** Xe đưa đón, Phòng copy, Sữa, Đề nghị khác.
5. **Số phiếu ăn** (Phiếu chính / Phiếu phụ) được tự tính theo danh sách nhân viên; có thể gõ đè hoặc bấm **Tính lại**.
6. **Danh sách nhân viên:** tích chọn người tăng ca. Có thể chỉnh giờ riêng cho từng người và cột **Ăn sau** (xem [4.5](#45-phiếu-ăn)).
7. Bấm **Đăng ký**, nhập mật khẩu cấp 2.

### 4.2. Đơn Xưởng (theo chuyền)

Dành cho **Line Leader** (hoặc người được cấp quyền).

1. Chọn **Team / Line / Nhóm ca** — nếu bạn chỉ phụ trách 1 tổ hợp, hệ thống tự điền và khoá.
2. Tìm nhân viên theo Team, Line, Nhóm ca, Công đoạn hoặc từ khoá (tối đa 500 kết quả mỗi lần tìm).
3. Bạn phải là Line Leader của **mọi Line** có trong đơn. Bản thân bạn **không bắt buộc** có tên trong danh sách tăng ca.
4. Đơn xưởng luôn tính là có ăn trong ca (bị trừ giờ nghỉ ăn).

### 4.3. Trường hợp OT (TH1 / TH2 / TH3)

Hệ thống **tự xác định**, người dùng không chọn:

| TH | Khi nào | Cấp duyệt cuối mặc định |
|---|---|---|
| **TH3** | Có nhân viên **vượt giới hạn lũy kế tháng hoặc năm** | Giám đốc |
| **TH2** | Ngày tăng ca là **ngày nghỉ** (theo Lịch ngày nghỉ) | Trưởng xưởng |
| **TH1** | Các trường hợp còn lại | Trưởng phòng |

Bấm nút **"!"** cạnh mã TH để xem mô tả các trường hợp.

### 4.4. Giới hạn giờ tăng ca

| Giới hạn | Mặc định | Vượt thì |
|---|---|---|
| Giờ OT **một ngày** (ngày làm việc) | 4h | **Chặn**, không lưu được đơn |
| Giờ OT **một ngày** (ngày nghỉ) | 12h | **Chặn**, không lưu được đơn |
| Lũy kế **tháng** | 25h | Không chặn, đơn tự chuyển **TH3** |
| Lũy kế **năm** | 300h | Không chặn, đơn tự chuyển **TH3** |

- Giới hạn ngày tính **tổng mọi đơn** của nhân viên trong ngày đó (kể cả đơn đang duyệt).
- Một số nhân viên có giới hạn tháng/năm riêng do người phụ trách cài.
- Bảng nhân viên cảnh báo trước: ô **ngày đỏ** = sẽ vượt giới hạn ngày; ô **tháng/năm vàng** = vượt giới hạn lũy kế.
- Không thể có 2 đơn **trùng giờ** cho cùng một nhân viên trong ngày.

### 4.5. Phiếu ăn

Tính theo giờ thực tế sau khi trừ 0,5h nghỉ ăn:

| Giờ thực tế | Phiếu |
|---|---|
| Dưới 2h | Không có phiếu |
| Từ 2h đến dưới 3,5h | Phiếu phụ |
| Từ 3,5h | Phiếu chính |
| Ca **đúng 06:00–08:00** | Luôn Phiếu phụ, không trừ giờ nghỉ ăn |

Cột **Ăn sau** (đơn văn phòng): tích = nhân viên ăn sau ca, **không** bị trừ 0,5h vào giờ OT. Loại phiếu không đổi dù tích hay không.

### 4.6. Cảnh báo cây duyệt

Nếu đơn vị chưa cấu hình đủ Cây duyệt hoặc có bước chưa ai giữ chức vụ, trang sẽ hiện **cảnh báo** nhưng vẫn cho tạo đơn. Đơn như vậy có thể **kẹt** ở bước không có người duyệt — hãy báo người phụ trách/quản trị viên trước khi đăng ký.

---

## 5. Theo dõi đơn

Menu **Đơn tăng ca** (số trên menu là số đơn đang chờ bạn duyệt, tự cập nhật mỗi phút). Màn hình gồm các tab:

| Tab | Nội dung |
|---|---|
| **Đơn của tôi** | Đơn do bạn lập |
| **Chờ tôi phê duyệt** | Đơn đang tới lượt bạn duyệt (kèm lịch mini các ngày còn đơn chưa duyệt — bấm ngày để lọc) |
| **Đơn đã xử lý** | Đơn bạn đã duyệt hoặc không phê duyệt |
| **Đơn tôi tham gia** | Đơn có tên bạn trong danh sách tăng ca |
| **Tất cả đơn** | Toàn bộ đơn (chỉ quản trị viên) |

**Bộ lọc:** từ ngày – đến ngày, trạng thái, Xưởng, Bộ phận → Nhóm, Team → Line → Nhóm ca. Bấm **Xoá lọc** để về mặc định. Tab đang mở được giữ nguyên khi tải lại trang hoặc đổi ngôn ngữ.

**Chi tiết đơn** (bấm vào một dòng): thông tin chung, **Tiến độ duyệt**, danh sách nhân viên (kèm người bị loại, ai loại, lý do), **Lịch sử phê duyệt**, **Lịch sử chỉnh sửa**. Các nút **In đơn**, **Sửa đơn** hiện khi đủ điều kiện.

**In đơn** ra đúng mẫu giấy YEV-22-024, có chữ ký các cấp; người bị loại không được in.

---

## 6. Duyệt đơn

Bạn chỉ duyệt được đơn khi bạn là người duyệt của **bước đang chờ** (hoặc đang được ủy quyền duyệt thay — xem [mục 9](#9-ủy-quyền-duyệt)). Quản trị viên **không** được duyệt thay.

### 6.1. Duyệt một đơn

Mở đơn ở tab **Chờ tôi phê duyệt** → thanh nút cuối trang:

- **Phê duyệt:** nhập ghi chú (tuỳ chọn) + mật khẩu cấp 2. Nếu bước của bạn yêu cầu ký, chữ ký trong **Chữ ký của tôi** được đóng tự động — chưa đăng ký chữ ký thì không duyệt được.
- **Không phê duyệt:** **bắt buộc** nhập lý do + mật khẩu cấp 2. Cả đơn dừng.

### 6.2. Loại một nhân viên khỏi đơn

Không đồng ý với **một người** thì không cần từ chối cả đơn: bấm **Không phê duyệt nhân viên** trên dòng người đó, nhập lý do, rồi duyệt tiếp phần còn lại.

- Đơn phải còn **hơn 1 người**; muốn loại hết thì dùng **Không phê duyệt** cả đơn.
- Người bị loại vẫn hiện trên đơn (gạch, kèm ai loại, lý do), không được cộng lũy kế, không in ra phiếu.
- Người lập đơn nhận email báo.

### 6.3. Duyệt hàng loạt

Tab **Chờ tôi phê duyệt** → tích chọn nhiều đơn → **Phê duyệt hàng loạt** / **Không phê duyệt hàng loạt**.

- Nhập ghi chú/lý do và mật khẩu cấp 2 **một lần** cho cả lô.
- Có khối xem lại các đơn đã chọn; link **Sửa** mở từng đơn ở tab mới.
- Mỗi đơn xử lý độc lập: đơn lỗi không làm hỏng các đơn khác, kết quả báo từng đơn.

### 6.4. Duyệt qua email

Người duyệt cấp trung gian nhận **email riêng cho từng đơn** khi tới lượt. Bấm link trong email để xem đơn, Phê duyệt / Không phê duyệt / loại nhân viên **không cần đăng nhập** — vẫn phải nhập mật khẩu cấp 2.

- Link có hạn **3 ngày** và chỉ dùng **một lần** cho Phê duyệt/Không phê duyệt (loại nhân viên không tiêu link).
- Đơn đã được người khác xử lý thì link cũ tự hết hiệu lực.

---

## 7. Sửa đơn

Nút **Sửa đơn** trên trang chi tiết (hoặc link **Sửa** khi duyệt hàng loạt). Lưu sửa cần mật khẩu cấp 2.

### 7.1. Đơn Văn phòng

- **Ai sửa:** chỉ **người lập đơn**.
- **Đến khi nào:** khi **chưa có cấp Trưởng phòng trở lên** phê duyệt. Cấp trung gian đã ký **không** khoá đơn (chữ ký của họ được giữ nguyên).
- **Sửa được:** mọi thông tin như lúc tạo **trừ Bộ phận / Nhóm** — ngày, giờ, lý do, lý do phụ, yêu cầu hỗ trợ khác, giờ từng người, thêm/bỏ nhân viên.
- Sau khi lưu, hệ thống **tính lại Trường hợp OT**. Nếu TH thay đổi (vd đổi sang ngày nghỉ → TH2), các bước **chưa duyệt** của cây duyệt được cập nhật theo TH mới; các bước đã duyệt giữ nguyên.
- Giới hạn giờ và trùng giờ được kiểm lại cho **mọi** nhân viên trong đơn.
- **Thêm nhân viên:** ô tìm kiếm ở hàng tiêu đề danh sách nhân viên, gõ để tìm và chọn.
- **Bỏ nhân viên:** người lập đơn bấm bỏ là dòng chuyển sang "sẽ bị loại khỏi đơn khi Lưu", **không cần lý do**, có nút **Hoàn tác** trước khi lưu.

### 7.2. Đơn Xưởng

- **Ai sửa:** người duyệt của **bước đang chờ**.
- **Sửa được:** giờ từng người, thêm/bỏ nhân viên. Thông tin chung (ngày, giờ, lý do…) **không** sửa được.
- Nhân viên thêm vào phải cùng Line và Nhóm ca với người đã có trong đơn.
- Bỏ nhân viên **bắt buộc** nhập lý do.

Mọi thay đổi được ghi vào **Lịch sử chỉnh sửa** của đơn. Người đã duyệt trước đó **không** nhận email báo thay đổi.

---

## 8. Đơn tổng

Menu **Đơn tổng** — dành cho **Trưởng phòng, Trưởng xưởng, Giám đốc**.

- Cấp quản lý **không** nhận email từng đơn. Mỗi ngày vào giờ cấu hình (mặc định **15:00**), hệ thống gom mọi đơn đang chờ cấp đó thành **một Đơn tổng** và gửi **một email**.
- Trưởng phòng: mỗi cặp (Bộ phận, Xưởng) là một Đơn tổng riêng. Trưởng xưởng / Giám đốc: một Đơn tổng toàn công ty mỗi ngày.
- Đơn tổng còn đơn chưa xử lý sẽ được **gửi email nhắc** vào các ngày sau.

**Cách xử lý:**

1. Mở Đơn tổng (từ menu hoặc link email). Mỗi đơn là một dòng có nút **Duyệt / Từ chối** ngay trên dòng.
2. Bấm vào dòng để xem chi tiết và **bỏ chọn** nhân viên không đồng ý.
3. Chọn Từ chối thì phải nhập lý do cho đơn đó.
4. Thanh tổng kết cố định ở đáy → bấm gửi, nhập mật khẩu cấp 2 **một lần** cho cả Đơn tổng.

Phải quyết định cho **tất cả** đơn trong Đơn tổng trong cùng một lần gửi. Bạn vẫn có thể duyệt từng đơn lẻ ở màn **Đơn tăng ca** nếu muốn.

---

## 9. Ủy quyền duyệt

Menu **Ủy quyền duyệt** (chỉ hiện khi Chức vụ của bạn được bật quyền này).

1. Bấm thêm ủy quyền, chọn **người nhận**, khoảng **từ ngày – đến ngày**, lý do (tuỳ chọn).
2. Danh sách người nhận chỉ gồm người hợp lệ:
   - **Trưởng phòng** → Team Leader thuộc các Bộ phận/Xưởng mình duyệt.
   - **Chức vụ khác** → người **cùng Chức vụ**, cùng đơn vị.
3. Trong thời gian hiệu lực, người nhận duyệt được các đơn đang chờ bạn (kể cả Đơn tổng) và nhận email "duyệt thay".

Lưu ý:

- Người nhận ký bằng **chữ ký và mật khẩu cấp 2 của chính họ**; đơn ghi "(thay mặt …)".
- Bạn vẫn tự duyệt được trong thời gian ủy quyền.
- Không ủy quyền chồng thời gian, không ủy quyền dây chuyền (A → B → C).
- Màn hình có 2 cột: **Tôi ủy quyền cho** và **Được ủy quyền duyệt thay**, mỗi dòng ghi trạng thái Đang hiệu lực / Sắp tới / Đã hết hạn.

---

## 10. Tổng quan tăng ca

Menu **Tổng quan** — chỉ hiện với quản trị viên và cấp **Trưởng phòng trở lên**.

- Chọn **tháng** và **Xưởng**.
- Số liệu chỉ tính nhân viên **trong phạm vi bạn quản lý**.
- Gồm: số nhân viên, giờ OT trong tháng (so với tháng trước), số đơn, số người **vượt giới hạn** lũy kế tháng/năm và **gần mốc** (≥ 80%), biểu đồ giờ OT theo ngày, lũy kế 12 tháng, trạng thái đơn, theo Bộ phận/Xưởng.
- Giờ theo ngày chỉ tính đơn **Hoàn tất**; lũy kế 12 tháng gồm cả giờ nhập/chỉnh tay.

---

## 11. Trợ lý AI

Menu **Trợ lý AI đăng ký tăng ca** (hiện chỉ quản trị viên được dùng).

- Mô tả bằng lời: ngày, giờ, lý do, những ai tăng ca. Trợ lý gợi ý các lựa chọn có đánh số để bạn chọn.
- Trợ lý **chỉ tạo đơn khi tin nhắn của bạn bắt đầu bằng lời xác nhận** ("đồng ý", "xác nhận", "ok", "tạo đi"…).
- Đơn tạo qua AI là **đơn thật**: vào luồng duyệt và gửi email ngay, giống đơn lập tay.

---

## 12. Danh mục

Menu **Danh mục** — dành cho quản trị viên, người phụ trách đơn vị và người xem báo cáo. Mỗi người chỉ thấy các tab mình có quyền.

| Tab | Dùng để |
|---|---|
| **Xưởng** | Danh sách Xưởng |
| **Bộ phận** | Danh sách Bộ phận / Phòng ban |
| **Nhóm** | Danh sách Nhóm, mỗi Nhóm gắn 1 Bộ phận và 1 Xưởng |
| **Lý do** | Lý do tăng ca hiển thị lúc lập đơn |
| **Trường hợp OT** | Mô tả TH1/TH2/TH3 (tiếng Việt và tiếng Nhật), cấp duyệt cuối |
| **Chức vụ** | Danh sách Chức vụ, thứ tự cấp bậc (kéo thả), **quyền tự cấp** cho người giữ chức vụ |
| **Cây duyệt** | Cấu hình các bước duyệt (xem 12.1) |
| **Nhân viên** | Quản lý nhân viên, chức vụ, giới hạn OT riêng, lũy kế (xem 12.2) |
| **Báo cáo** | Báo cáo tăng ca dưới chuyền theo ngày (xem 12.3) |
| **Cấu hình** | Phiếu ăn, giới hạn lũy kế, giờ gửi Đơn tổng, Lịch ngày nghỉ, kiểm tra email (xem 12.4) |

### 12.1. Cây duyệt

Có 2 tab con:

- **Theo Nhóm** (đơn Văn phòng):
  - Khối **cấp trung gian theo Nhóm** (Staff / Group Leader / Team Leader): chọn bước, đánh dấu bước **cần ký** (1–2 bước) và **Người chịu trách nhiệm**.
  - **Team Leader mượn:** có thể chọn Team Leader của **Nhóm khác cùng Bộ phận** làm người duyệt cho Nhóm này (họ duyệt và xem được đơn như Team Leader của Nhóm).
  - Khối **cấp cuối theo Bộ phận**: Trưởng phòng → Trưởng xưởng → Giám đốc.
- **Theo chuyền** (đơn Xưởng): một danh sách bước cho cả Bộ phận, từ Line Leader tới Giám đốc. Line Leader được xác định **tự động** từ dữ liệu import nhân sự dưới chuyền.

Ngay trên màn Cây duyệt, người phụ trách gán Chức vụ cho nhân viên trong đơn vị mình (khi gán Trưởng phòng thì chọn thêm Xưởng). Chỉ quản trị viên gán được **Trưởng xưởng / Giám đốc**.

**Người phụ trách** (do quản trị viên gán) của Bộ phận/Nhóm được tự quản Cây duyệt, nhân viên, giới hạn OT và lũy kế của đúng đơn vị đó.

> Thay đổi Cây duyệt chỉ áp dụng cho đơn **tạo sau**. Đơn đang chạy giữ nguyên.

### 12.2. Nhân viên

- **Thêm / Sửa:** chọn **Chức vụ trước**, ô tổ chức thay đổi theo chức vụ:
  - Nhân viên và cấp trung gian → chọn **Nhóm**.
  - Trưởng phòng → chọn các cặp **(Xưởng, Bộ phận)** phụ trách.
  - Trưởng xưởng / Giám đốc → không thuộc đơn vị nào (toàn công ty).
- **Giới hạn OT riêng:** đặt mốc tháng/năm riêng cho từng người (để trống = dùng mốc chung).
- **Lũy kế:** xem/sửa giờ 12 tháng và số dư đầu kỳ của một năm; bấm vào ô tháng để xem giờ theo từng ngày.
- **Nhân viên dưới chuyền:** chế độ xem riêng, sửa Line / Team / Nhóm ca / Trưởng nhóm. Lưu ý: dữ liệu sửa tay sẽ bị ghi đè ở lần import tháng sau; đánh dấu **Trưởng nhóm** ảnh hưởng trực tiếp tới người duyệt đơn xưởng.
- Bạn chỉ thấy nhân viên **trong phạm vi** mình quản lý.

### 12.3. Báo cáo

Chọn **ngày**, Bộ phận, Xưởng. Chỉ tính đơn xưởng đã **Hoàn tất**, bỏ người bị loại.

| Báo cáo | Kết quả |
|---|---|
| Báo phiếu tăng ca | PDF tổng hợp phiếu ăn theo ca A / B / C / H |
| Tổng số giờ tăng ca | Excel, 1 dòng / người / ngày |
| Số lượt tăng ca | Excel, 1 dòng / lượt |
| Xuất dữ liệu chi tiết / tổng hợp | 2 file Excel theo mẫu hệ cũ |
| Phiếu theo Line / Nhóm | File ZIP gồm các PDF phiếu YEV-22-024, mỗi tổ hợp Line–Nhóm ca một file |

### 12.4. Cấu hình

- **Phiếu ăn:** ngưỡng giờ phiếu chính/phụ, giờ trừ nghỉ ăn, khung OT sớm.
- **Giới hạn lũy kế:** giới hạn ngày (ngày thường / ngày nghỉ), tháng, năm.
- **Đơn tổng:** giờ tự gom và gửi email hằng ngày; nút **Gửi ngay** (gửi email thật, kể cả email nhắc).
- **Lịch ngày nghỉ:** **Import lịch** theo năm từ Excel (sheet "Lịch nghỉ", cột Ngày · Loại · Ghi chú; Loại là Chủ nhật / Ngày lễ / Nghỉ đặc biệt). Import **thay toàn bộ** lịch của năm đó. Năm chưa import thì chỉ Chủ nhật được tính là ngày nghỉ.
- **Kiểm tra gửi email:** gửi email thử để kiểm tra cấu hình máy chủ mail.

---

## 13. Import / Export Excel

Các nút nằm trong menu **Excel** ở tab **Nhân viên**. Mọi import đều có **Tải file mẫu** và **Xuất dữ liệu đang lọc**: nút sau tải dữ liệu hiện tại của các nhân viên đang lọc ở danh sách (theo từ khoá, Xưởng, Bộ phận, Nhóm) đúng định dạng file import, để sửa rồi import lại thay vì nhập từ đầu.

| Chức năng | Ai dùng | Ghi chú |
|---|---|---|
| **Import nhân sự** | Quản trị / người phụ trách | Cột: Mã NV, Họ tên, Mã/Tên Bộ phận, Mã/Tên Nhóm (mã chọn từ danh sách trong file). Có **Xem trước**; mã đã có thì cập nhật, chưa có thì tạo mới. Chỉ quản trị viên tạo được Bộ phận/Nhóm mới (Nhóm mới vào Xưởng đầu tiên); người phụ trách chỉ import vào đơn vị mình phụ trách. Không import được người giữ chức vụ Trưởng phòng trở lên. |
| **Import nhân sự dưới chuyền** | Người phụ trách Bộ phận Chế tạo | File Chế tạo hằng tháng. Xem trước chia tab Tất cả / Mới / Cập nhật / Không đổi / Lỗi / Bị gỡ. Người **không còn** trong file mới bị gỡ khỏi danh sách dưới chuyền. Line/Team/Nhóm ca sai thì dòng bị bỏ qua. |
| **Áp lũy kế từ file dưới chuyền** | Người có quyền import lũy kế | Bước riêng sau import, chọn năm/tháng; chỉ lấy cột OT tháng. |
| **Xuất nhân sự dưới chuyền** | Người phụ trách | Đúng mẫu file import để dùng lại tháng sau. |
| **Import lũy kế OT theo tháng** | Người phụ trách mọi Bộ phận | Cột B = Mã NV, C = tổng giờ tháng, D (tuỳ chọn) = tổng giờ năm. Áp dụng ngay, chạy lại cùng file không cộng trùng. |
| **Import giới hạn OT riêng** | Người phụ trách | Đặt mốc tháng/năm riêng cho nhiều người; ô trống = giữ nguyên. Có ở cả menu Excel của Nhân viên và Nhân viên dưới chuyền. |
| **Import liên kết tài khoản** | Chỉ quản trị viên | Thiết lập người dùng hệ thống Tăng ca trong một lần: tài khoản đăng nhập (ghi đầy đủ dạng `YEV\tên.đăng.nhập`, chưa có thì tự tạo), email nhận thông báo, Chức vụ cấp trung gian (chọn từ danh sách, quyền được cấp ngay), Người phụ trách và ảnh chữ ký (nhúng trong Excel, tự xoá nền giấy như khi upload trên màn hình). Nhân viên mới thì **Import nhân sự** trước rồi mới liên kết. Sau đó người dùng chỉ còn tự đặt mật khẩu cấp 2. Chức vụ **Trưởng phòng trở lên** phải gán ở màn Nhân viên. |

Với người phụ trách, các dòng thuộc nhân viên **ngoài phạm vi** của mình sẽ bị bỏ qua (có báo lý do), không làm hỏng cả file.

---

## 14. Câu hỏi và lỗi thường gặp

**Không thấy menu / tab nào đó?**
Chức vụ hoặc quyền của bạn chưa bao gồm mục đó. Sau khi quản trị viên cấp quyền, bấm **Làm mới quyền** ở thanh trên cùng (không cần đăng xuất).

**"Bạn chưa thiết lập mật khẩu cấp 2" / "Mật khẩu cấp 2 không đúng".**
Vào **Mật khẩu cấp 2** để thiết lập (nhớ bấm link xác nhận trong email).

**"Bạn chưa đăng ký chữ ký".**
Bước duyệt của bạn yêu cầu ký. Vào **Chữ ký của tôi**, upload và xác nhận qua email.

**"Nhân viên mã … quá giới hạn OT ngày".**
Tổng giờ của người đó trong ngày (gồm các đơn khác) vượt giới hạn. Giảm giờ hoặc bỏ người đó khỏi đơn.

**"… đã có đơn tăng ca trùng giờ trong ngày".**
Nhân viên đã có đơn khác trùng khung giờ. Đổi giờ hoặc bỏ người đó.

**Đơn không sửa được nữa.**
Đơn văn phòng đã được Trưởng phòng trở lên duyệt, hoặc đơn đã Hoàn tất / Không phê duyệt.

**Đơn đứng mãi ở một bước, không ai duyệt.**
Bước đó không có người giữ chức vụ (hoặc người đó chưa có tài khoản) tại thời điểm tạo đơn. Báo quản trị viên: đơn cần được **xoá** rồi lập lại sau khi bổ sung người duyệt. Chỉ quản trị viên xoá được đơn, và không xoá được đơn đã Hoàn tất.

**Link trong email báo đã hết hạn / đã dùng.**
Link duyệt đơn có hạn 3 ngày; link xác nhận chữ ký / mật khẩu cấp 2 có hạn 30 phút. Đơn đã được người khác xử lý thì link cũng hết tác dụng. Đăng nhập hệ thống để xử lý.

**Ảnh chữ ký sau khi tách nền còn vệt bẩn hoặc mất nét.**
Chụp lại trên giấy trắng, đủ sáng, không bóng đổ, chữ ký cách xa đường kẻ/chữ in khác.
