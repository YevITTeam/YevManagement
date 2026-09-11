Hướng dẫn thử module Workflow
==============================

> Tài liệu này dành cho **nhóm IT Hải Phòng** tự vào thử module Workflow của YEV Management
> (form động + duyệt nhiều cấp). Nếu muốn xem tổng quan trực quan trước, mở trang giới thiệu đính
> kèm cùng email. Tài liệu này đi sâu hơn vào cách bấm thử.
>
> * Cập nhật lần cuối: 2026-09-10.
> * **Chưa có ảnh chụp màn hình thật** trong tài liệu này — sẽ bổ sung sau. Các bước dưới đây mô tả
>   đúng tên nút/tên màn hình hiện tại nên vẫn theo được, chỉ chưa có minh hoạ.

* * *

## Trước khi bắt đầu

1. **Mạng:** cần cùng mạng nội bộ công ty hoặc VPN tới hệ thống — hệ thống hiện chạy ở môi trường
   phát triển nội bộ, chưa phải bản deploy chính thức. Nếu không vào được link, báo lại để kiểm tra
   khả năng kết nối trước khi debug tiếp.
2. **Tài khoản:** dùng 1 trong 4 tài khoản test ở bảng dưới. Mật khẩu được cấp riêng qua kênh khác
   (Zalo/điện thoại), không ghi trong tài liệu này.
3. **Đăng nhập:** nếu máy không nằm trong domain công ty (không dùng được đăng nhập Windows tự động),
   vào màn hình **Đăng nhập** (`/login`) và nhập đúng tài khoản/mật khẩu được cấp — hệ thống vẫn xác
   thực qua Active Directory thật ở phía sau, không phải tài khoản riêng của app.

> ⚠️ **Lưu ý quan trọng:** 4 tài khoản test này **chỉ có quyền trong module Workflow**
> (`Workflow.*`), không phải tài khoản quản trị toàn hệ thống — không thấy/sửa được dữ liệu của
> Asset (quản lý PC) hay Attendance (chấm công, tăng ca).

### Bảng tài khoản test

| Tài khoản (đăng nhập) | Họ tên hiển thị | Chức danh | Đơn vị | Dùng để |
|---|---|---|---|---|
| `TEST\st_cvit` | [TEST] Staff - Cong vu IT | Staff | Phòng Công Vụ | **Nộp đơn** — thử tạo 1 "Đơn xin nghỉ phép" |
| `TEST\gl_cvit` | [TEST] Group Leader - Cong vu IT | Group Leader | Phòng Công Vụ | Duyệt (nếu route form yêu cầu bước này) |
| `TEST\tl_cvit` | [TEST] Team Leader - Cong vu IT | Team Leader | Phòng Công Vụ | **Duyệt "Đơn xin nghỉ phép"** do `st_cvit` nộp |
| `TEST\mgr_cv` | [TEST] Manager - Cong vu | Department Manager | Phòng Công Vụ | Duyệt form "Mua hàng" / "TEST" |

Cả 4 tài khoản đều đứng trong cùng 1 đơn vị **Phòng Công Vụ** (Xưởng Dĩ An → Công ty Yazaki), chỉ
khác nhau ở chức danh — đúng mô phỏng 1 chuỗi duyệt thật trong công ty.

* * *

## Kịch bản thử tối thiểu (khuyến nghị đi theo đúng thứ tự)

### Bước 1 — Xem thử tổ chức & nhân sự (không cần thao tác gì)

Đăng nhập bằng tài khoản bất kỳ trong bảng trên → vào **Workflow → Nhân sự** và **Workflow → Cấp tổ
chức** để xem cây đơn vị thật (Công ty Yazaki → Xưởng Dĩ An → Phòng Công Vụ → …) và danh sách nhân sự
kèm chức danh — hiểu cách hệ thống biết "ai là cấp trên của ai".

### Bước 2 — Nộp 1 đơn thử

Đăng nhập bằng `TEST\st_cvit` → vào **Workflow → Đơn từ → Tạo đơn mới**, chọn form **"Đơn xin nghỉ
phép"**, điền thông tin rồi bấm **Nộp**. Theo dõi trạng thái đơn ở tab **"Đơn của tôi"**.

> 💡 **Mẹo:** form này được đặt mô tả sẵn là *"test luồng duyệt Trưởng phòng IT"* — đúng mục đích của
> bộ tài khoản test này.

### Bước 3 — Duyệt đơn vừa nộp

Đăng nhập bằng `TEST\tl_cvit` → vào **Workflow → Đơn từ → tab "Chờ tôi duyệt"** → mở đơn vừa nộp ở
Bước 2 → bấm **Duyệt** (hoặc **Từ chối** để thử luồng ngược lại). Đăng nhập lại bằng `st_cvit` để xem
đơn đã chuyển sang trạng thái đã duyệt.

### Bước 4 (tuỳ chọn) — Xem các màn cấu hình

Với tài khoản bất kỳ (cả 4 đều có quyền `Workflow.FormDesign.View/Manage`), vào **Workflow → Danh mục
form** và **Workflow → Thiết kế form** để xem cách 1 form được dựng: kéo-thả field, đặt điều kiện
ẩn/hiện, cấu hình các bước duyệt.

* * *

## Các màn hình chính

| Màn hình | Xem được gì |
|---|---|
| Cấp tổ chức / Cây tổ chức | Sơ đồ đơn vị dạng cây, kéo-thả sắp xếp |
| Chức danh | Danh mục chức danh (Director, Factory Manager, Department Manager, Team Leader, Group Leader, Staff…) |
| Nhân sự | Danh sách nhân sự, gán đơn vị + chức danh kiêm nhiệm |
| Danh mục form | Nhóm các loại đơn theo danh mục |
| Thiết kế form | Kéo-thả field, đặt điều kiện, cấu hình luồng duyệt cho từng form |
| Đơn từ | Nộp đơn mới, "Đơn của tôi" / "Chờ tôi duyệt" / "Tất cả", xem chi tiết & in |
| Ủy quyền duyệt thay | Chỉ định người duyệt thay khi vắng mặt |
| Chữ ký | Đăng ký chữ ký điện tử cá nhân |
| Cấu hình | Giới hạn dung lượng/số lượng/đuôi file đính kèm |

* * *

## Câu hỏi thường gặp

**Đăng nhập báo lỗi / không vào được?**
Kiểm tra lại đã gõ đúng dạng `TEST\tenuser` (có `TEST\` phía trước) và mật khẩu được cấp riêng. Nếu
máy không domain-joined, phải dùng màn `/login`, không dùng nút đăng nhập Windows tự động.

**Nộp đơn xong nhưng không thấy ai duyệt / báo lỗi khi duyệt?**
Từng nhân sự phải được gắn đúng tài khoản đăng nhập và đặt đúng chức danh trong sơ đồ tổ chức thì mới
"nhận" được vai trò duyệt — 4 tài khoản test ở trên đã được cấu hình sẵn đúng để đi hết luồng "Đơn xin
nghỉ phép". Nếu thử 1 form khác chưa cấu hình theo đúng chuỗi này, có thể sẽ không resolve ra người
duyệt — đây là hành vi đúng thiết kế (chặn đơn "rơi vào khoảng không"), không phải lỗi.

**Có xoá/sửa được dữ liệu thật không?**
Không — 4 tài khoản test chỉ có quyền trong module Workflow và chỉ thao tác trên dữ liệu Workflow.
Không đụng được tới Asset (thiết bị) hay Attendance (chấm công).

**Muốn xem tổng quan kiến trúc trước khi bấm thử?**
Xem trang giới thiệu (link đính kèm email) — tóm tắt mô hình, tính năng đã xong và trạng thái dự án.
