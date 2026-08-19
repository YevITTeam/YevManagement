# Hướng dẫn sử dụng module Quản lý tăng ca (OT)

Tài liệu này hướng dẫn cách sử dụng phần mềm **Quản lý tăng ca**, viết cho người mới bắt đầu, chưa
từng dùng phần mềm này bao giờ. Bạn không cần biết gì về máy tính hay phần mềm trước đó — chỉ cần làm
theo đúng từng bước và xem ảnh minh hoạ đi kèm.

Tài liệu chia làm 3 phần theo 3 công việc khác nhau trong phần mềm:

- **Phần II, III**: dành cho người phụ trách thiết lập ban đầu (thường gọi là **Quản trị viên**).
- **Phần IV**: dành cho người **lập đơn tăng ca**.
- **Phần V**: dành cho người **ký duyệt đơn tăng ca**.

Nếu công việc của bạn chỉ là lập đơn hoặc chỉ là ký duyệt, bạn có thể bỏ qua các phần không liên quan
đến mình.

> Giao diện phần mềm có 2 ngôn ngữ Việt/Nhật. Một vài trang (như trang duyệt đơn qua email) sẽ hiện
> chữ song ngữ, ví dụ nút "Duyệt / 承認".

## Mục lục

- [I. Bắt đầu sử dụng](#i-truy-cap-tong-quan)
- [II. Thiết lập Danh mục tăng ca](#ii-danh-muc)
  - [1. Bộ phận](#ii-1-bo-phan)
  - [2. Nhóm](#ii-2-nhom)
  - [3. Lý do](#ii-3-ly-do)
  - [4. Trường hợp OT](#ii-4-truong-hop-ot)
  - [5. Chức vụ](#ii-5-chuc-vu)
  - [6. Quyền theo Chức vụ](#ii-6-quyen-theo-chuc-vu)
  - [7. Nhân viên & thêm hàng loạt từ Excel](#ii-7-nhan-vien)
  - [8. Cài đặt chung](#ii-8-cau-hinh)
- [III. Thiết lập đường đi duyệt đơn (Cây duyệt)](#iii-cay-duyet)
- [IV. Lập và quản lý đơn tăng ca](#iv-tao-don)
  - [1. Lập đơn tăng ca mới](#iv-1-tao-don)
  - [2. Xem lại và sửa đơn](#iv-2-sua-don)
  - [3. Loại 1 người ra khỏi đơn](#iv-3-loai-khoi-don)
- [V. Ký duyệt đơn tăng ca](#v-ky-duyet)
  - [1. Chuẩn bị trước khi ký: Chữ ký & Mật khẩu cấp 2](#v-1-chuan-bi)
  - [2. Duyệt / Từ chối ngay trong phần mềm](#v-2-duyet-trong-app)
  - [3. Duyệt / Từ chối qua Email](#v-3-duyet-qua-email)
- [Phụ lục A — Các trạng thái của 1 đơn tăng ca](#phu-luc-a)
- [Phụ lục B — Giải thích các từ hay gặp](#phu-luc-b)
- [Phụ lục C — Ai được làm gì](#phu-luc-c)
- [Phụ lục D — Câu hỏi thường gặp](#phu-luc-d)

---

<a id="i-truy-cap-tong-quan"></a>

## I. Bắt đầu sử dụng

**1. Mở phần mềm và vào đúng khu vực**

![Trang chủ YEV Management](https://dubble-prod-01.s3.amazonaws.com/assets/919af317-1716-4da8-9826-4df7b9505c85.png?0)

Mở trình duyệt web, vào địa chỉ phần mềm của công ty, đăng nhập bằng tài khoản máy tính công ty (tài
khoản Windows) bạn vẫn dùng hằng ngày. Sau khi vào được trang chủ, bấm vào ô **"Quản lý tăng ca"**.

![Chọn Quản lý tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2adb85e4-bfd5-4e65-ade4-97496f329533/2.5/35.251046025105/31.60930907173?0)

**2. Làm quen với menu bên trái**

![Sidebar OT Manager](https://dubble-prod-01.s3.amazonaws.com/assets/d1385749-f4da-488e-86b5-1166ebdcf0b4.png?1)

Menu bên trái là nơi bạn di chuyển giữa các màn hình. Menu sẽ **không hiện đủ hết** các mục dưới đây —
bạn chỉ thấy những mục phù hợp với công việc của mình:

| Mục trong menu | Ai thường thấy | Dùng để làm gì |
|---|---|---|
| Tạo đơn tăng ca | Người lập đơn | Mở màn hình lập 1 đơn tăng ca mới |
| Đơn tăng ca | Hầu như ai cũng thấy | Xem lại các đơn: đơn mình đã tạo / đơn đang chờ mình duyệt / đơn đã xử lý xong |
| Đơn tổng | Người duyệt cấp cao | Gom nhiều đơn lại để duyệt 1 lần cho nhanh |
| Danh mục | Quản trị viên | Nơi thiết lập ban đầu — xem Phần II, III |
| Chữ ký của tôi | Hầu như ai cũng thấy | Đăng ký ảnh chữ ký tay để dùng khi ký duyệt |
| Mật khẩu cấp 2 | Hầu như ai cũng thấy | Đặt mật khẩu riêng, bắt buộc dùng mỗi lần ký duyệt |

Nếu bạn không thấy 1 mục mà đồng nghiệp khác có, đừng lo lắng — có thể công việc của bạn chưa cần đến
mục đó, hoặc cần nhờ Quản trị viên cấp thêm quyền.

---

<a id="ii-danh-muc"></a>

## II. Thiết lập Danh mục tăng ca

*(Phần này dành cho Quản trị viên. Nếu bạn chỉ lập đơn hoặc chỉ ký duyệt, có thể bỏ qua và đi thẳng
tới [Phần IV](#iv-tao-don) hoặc [Phần V](#v-ky-duyet).)*

Vào menu **Danh mục**, bạn sẽ thấy 1 hàng nút bấm ngang phía trên gồm: Bộ phận, Nhóm, Lý do, Trường
hợp OT, Chức vụ, Quyền theo Chức vụ, Nhân viên, Cài đặt chung (còn 1 nút nữa tên "Cây duyệt" — nút này
được hướng dẫn riêng ở [Phần III](#iii-cay-duyet) vì cách dùng khác hẳn các nút còn lại).

![Màn Danh mục tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2d75b661-6e66-47fb-8c97-a932eb47d2af/1/55.753138075314/46.439873417722?1)

Các mục từ 1 đến 5 dưới đây đều làm việc theo **đúng 1 cách giống hệt nhau** — chỉ cần hiểu 1 lần là dùng
được cho cả 5 mục:

- **Xem danh sách**: mỗi mục là 1 bảng liệt kê, có ô tìm kiếm phía trên để gõ tìm nhanh theo tên.
- **Thêm mới**: bấm nút **"+ Thêm..."**, 1 khung nhỏ hiện ra để bạn điền thông tin. Điền xong bấm
  **"Lưu"** để ghi lại, hoặc bấm **"Huỷ"** nếu muốn đóng lại mà không lưu gì cả.
- **Sửa**: bấm nút "Sửa" trên dòng muốn sửa, khung điền thông tin hiện lại với dữ liệu cũ, sửa xong
  bấm "Lưu" hoặc "Huỷ" như trên.
- **Xoá**: bấm nút "Xoá" trên dòng muốn xoá, phần mềm sẽ hỏi lại 1 lần nữa cho chắc chắn trước khi xoá
  thật — nếu đổi ý, bấm "Huỷ" trong hộp hỏi lại đó. Dòng đã xoá sẽ không hiện ra để chọn nữa, nhưng
  những đơn tăng ca cũ đã dùng tới dòng đó vẫn xem lại được bình thường, không bị mất dữ liệu.

> **⚠️ 2 điều dễ nhầm, cần nhớ:**
> 1. **Mã không được trùng nhau** — mỗi Bộ phận/Nhóm/Lý do/Trường hợp OT/Chức vụ cần 1 mã riêng, không
>    trùng với bất kỳ mã nào đã có từ trước.
>    2. **Xoá xong thì mã đó coi như đã dùng, không đặt lại được nữa** — kể cả khi đã xoá 1 dòng, nếu
>    sau này bạn thêm mới và gõ lại đúng mã cũ, phần mềm vẫn báo trùng. Muốn dùng lại tên đó, hãy đặt
>    mã mới hơi khác đi (ví dụ thêm số phía sau).
>
> Mẹo nhỏ: nếu bạn chỉ muốn xem thử màn hình Thêm/Sửa/Xoá trông như thế nào mà chưa muốn thay đổi gì
> thật, cứ bấm vào để xem rồi bấm **"Huỷ"** ở bước cuối — sẽ không có gì bị lưu lại hay bị xoá cả.

<a id="ii-1-bo-phan"></a>

### 1. Bộ phận

**Thêm mới**

![Form thêm Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/32a6b2af-5e98-4f8f-b14f-35ae7b0943d4/2.5/89.225941422594/10.152953586498?1)

Bấm "+ Thêm bộ phận", điền:

- **Mã Bộ phận** — bắt buộc, mỗi Bộ phận cần 1 mã riêng, không được trùng với mã đã dùng trước đó.
- **Tên Bộ phận** — bắt buộc, tên tiếng Việt sẽ hiển thị khắp nơi trong phần mềm.
- **Tên tiếng Nhật** — không bắt buộc, chỉ cần điền nếu công ty có dùng tới tiếng Nhật.

Bấm "Lưu" để hoàn tất. Bộ phận là đơn vị **lớn nhất** trong sơ đồ tổ chức của phần mềm — mỗi Nhóm (xem
mục tiếp theo) đều thuộc về 1 Bộ phận, và những người duyệt ở cấp cao nhất (Quản lý, Trưởng xưởng,
Giám đốc) cũng được sắp xếp theo từng Bộ phận.

**Sửa**

![Form sửa Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/c52a8569-6cc5-4427-842a-3c62d6fc992e/2.5/86.373071391213/38.132911392405?1)

**Xoá**

![Xác nhận xoá Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/79c587f9-44eb-4d02-880f-b0509f86c029/2.5/88.336820083682/38.132911392405?1)

Nên cân nhắc kỹ trước khi xoá 1 Bộ phận đang có Nhóm hoặc Nhân viên bên trong — hãy chắc chắn Bộ phận
đó không còn cần dùng nữa.

<a id="ii-2-nhom"></a>

### 2. Nhóm

![Chuyển sang tab Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/6fe4bee6-ee21-404b-8653-f49e3bc653c5/2.5/27.419750261506/17.668776371308?1)

Danh sách Nhóm có thể lọc theo Bộ phận, giúp dễ tìm hơn khi công ty có nhiều Bộ phận, mỗi Bộ phận lại
có nhiều Nhóm nhỏ bên trong:

![Lọc Nhóm theo Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/0b61342c-1d57-44e7-a1a3-f9f41f1a37fd/1/55.753138075314/25.263713080169?1)

**Thêm mới** — bấm "+ Thêm nhóm". Trước tiên phải chọn **Bộ phận** mà Nhóm này thuộc về, rồi mới điền
Mã và Tên Nhóm:

![Form thêm Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/27207425-8ef6-41e1-af38-7f93ebb28b9c/2.5/89.225941422594/10.152953586498?1)

**Sửa** và **Xoá** làm giống hệt như mục Bộ phận:

![Form sửa Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2a465725-aee5-49b7-800d-a2084652be63/2.5/86.373071391213/38.238396624473?1)

![Xác nhận xoá Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/236b4285-68ab-4400-9d3c-1a37cb228ce8/2.5/88.336820083682/38.238396624473?1)

Nhóm là đơn vị **nhỏ nhất** — mỗi nhân viên thuộc về đúng 1 Nhóm. Điều này khá quan trọng, bạn nên nhớ:

> **⚠️ Mỗi đơn tăng ca chỉ dành cho nhân viên trong cùng 1 Nhóm** — khi lập đơn, người lập đơn sẽ
> không ghép được nhân viên ở 2 Nhóm khác nhau vào chung 1 đơn. Nếu 2 người ở 2 Nhóm khác nhau cùng
> tăng ca 1 đợt, phải lập 2 đơn riêng.

- Việc ai duyệt đơn ở những bước đầu tiên (thường là Tổ trưởng, Trưởng nhóm) được sắp xếp **riêng cho
  từng Nhóm**, ở [Phần III](#iii-cay-duyet) — 2 Nhóm khác nhau hoàn toàn có thể có người duyệt khác
  nhau.

<a id="ii-3-ly-do"></a>

### 3. Lý do

![Chuyển sang tab Lý do](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/66483ffa-1e3a-44b6-8896-066113046bea/2.5/31.66268959205/17.668776371308?1)

Đây là danh sách các lý do tăng ca thường gặp (ví dụ: "Xử lý gấp đơn hàng", "Bảo trì máy móc định kỳ",
"Kiểm kê cuối tháng"…) để người lập đơn chọn cho nhanh, không phải gõ tay mỗi lần. Mục này chỉ để hiển
thị trên đơn, không ảnh hưởng gì tới việc đơn được duyệt như thế nào.

**Thêm mới / Sửa / Xoá** làm giống hệt mục Bộ phận và Nhóm:

![Form thêm Lý do](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b3be8970-e03a-4267-b75d-c8626b917b3e/2.5/89.225941422594/10.152953586498?1)

![Form sửa Lý do](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b9407576-e3e3-400f-89d3-0ad6b41bb264/2.5/86.373071391213/38.132911392405?1)

![Xác nhận xoá Lý do](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b7356f88-4135-4ae1-9dd6-90b0069f8451/2.5/88.336820083682/38.132911392405?1)

<a id="ii-4-truong-hop-ot"></a>

### 4. Trường hợp OT

![Chuyển sang tab Trường hợp OT](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/c9aeb846-1273-4a8d-95e2-eb569e6628ea/2.5/35.68171417364/17.668776371308?1)

Đây là mục **quan trọng nhất** trong phần thiết lập — mỗi lần lập đơn, người lập đơn bắt buộc phải
chọn 1 "Trường hợp OT" (ví dụ TH1, TH2, TH3…), và lựa chọn này quyết định 2 điều cho cả đơn:

1. **Đơn cần duyệt tới cấp nào thì được coi là xong** — ví dụ tăng ca ngày thường có thể chỉ cần Quản
   lý duyệt là xong, còn tăng ca ngày lễ/Chủ nhật có thể cần duyệt lên tới Giám đốc. Bảng dưới đây là
   1 ví dụ thường gặp để bạn dễ hình dung:

   | Trường hợp | Ví dụ tình huống | Duyệt xong tới cấp |
   |---|---|---|
   | TH1 | Tăng ca ngày thường | Quản lý (Manager) |
   | TH2 | Tăng ca ngày nghỉ / Chủ nhật / lễ | Trưởng xưởng (Factory Manager) |
   | TH3 | Nhân viên đã tăng ca nhiều trong tháng/năm | Giám đốc (Director) |

   *(Đây chỉ là ví dụ để dễ hình dung — tên gọi và cấp duyệt thật của từng Trường hợp OT do Quản trị
   viên tự đặt, có thể khác với ví dụ trên tuỳ theo công ty.)*

2. **Có bắt buộc phải ký tên hay không** — nếu bật "Yêu cầu chữ ký", người duyệt ở những bước cần ký
   sẽ phải có sẵn ảnh chữ ký đã đăng ký trước ([xem Phần V, mục 1](#v-1-chuan-bi)), nếu chưa đăng ký thì sẽ
   không duyệt được:

   ![Bật/tắt yêu cầu chữ ký](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/66dbd404-3505-4663-bd0d-9686f697bf87/1/50/53.428270042194?1)

**Thêm mới** — điền Mã, Mô tả, chọn cấp duyệt xong và bật/tắt yêu cầu chữ ký như trên:

![Form thêm Trường hợp OT](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/e4a4f38d-cc86-4df8-a0e0-7bf5f6480327/2.5/89.225941422594/10.152953586498?1)

<a id="ii-5-chuc-vu"></a>

### 5. Chức vụ

![Chuyển sang tab Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/93f2b222-f2ad-4a86-beeb-d75e0a1adc2b/2.5/43.530171286611/17.668776371308?1)

Có ô tìm kiếm riêng để tìm nhanh khi danh sách dài:

![Tìm kiếm Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/7e691a5d-c2cd-4829-886b-552b901b9d58/1/55.753138075314/25.263713080169?1)

Phần mềm dùng sẵn **6 Chức vụ** để sắp xếp việc ký duyệt, chia làm 2 nhóm:

| Chức vụ | Loại | Ai duyệt trong phạm vi nào |
|---|---|---|
| Staff (Nhân viên) | Duyệt bước đầu | Trong Nhóm |
| Group Leader (Tổ trưởng) | Duyệt bước đầu | Trong Nhóm |
| Team Leader (Trưởng nhóm) | Duyệt bước đầu | Trong Nhóm |
| Manager (Quản lý) | Duyệt bước cuối | Trong Bộ phận |
| Factory Manager (Trưởng xưởng) | Duyệt bước cuối | Toàn công ty |
| Director (Giám đốc) | Duyệt bước cuối | Toàn công ty |

> **⚠️ Lưu ý**: phần mềm chỉ cho phép có **đúng 1 Chức vụ** giữ vai trò "Quản lý", đúng 1 Chức vụ giữ
> vai trò "Trưởng xưởng", và đúng 1 Chức vụ giữ vai trò "Giám đốc" — không thêm được Chức vụ thứ hai
> cũng đóng vai trò duyệt cấp cuối giống vậy. (Nhiều nhân viên khác nhau vẫn có thể cùng giữ 1 trong 3
> Chức vụ này — ví dụ mỗi Bộ phận có 1 người giữ Chức vụ "Quản lý" riêng.)

**Thêm mới / Sửa / Xoá**:

![Form thêm Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/1ea39276-b617-4159-8453-32f1a695d2ea/2.5/89.225941422594/10.152953586498?1)

![Form sửa Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/79c3a4bd-daa7-4a6a-8fe6-5b5d50d276f8/2.5/86.373071391213/38.238396624473?1)

![Xác nhận xoá Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/efb72046-be05-4680-8886-995fe2969278/2.5/88.336820083682/38.238396624473?1)

<a id="ii-6-quyen-theo-chuc-vu"></a>

### 6. Quyền theo Chức vụ

![Chuyển sang tab Quyền theo Chức vụ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/45772bc9-9054-4492-bbf2-e214b94e96d7/2.5/53.612872646444/17.668776371308?1)

Mục này quyết định **mỗi Chức vụ được phép làm gì** trong phần mềm. Điểm hay của mục này: bạn không
cần cấp quyền riêng cho từng người — chỉ cần cấu hình 1 lần cho 1 Chức vụ, thì **mọi nhân viên đang
giữ Chức vụ đó** sẽ tự động có đúng những quyền này ngay lập tức.

![Chọn Chức vụ để cấu hình quyền](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/deb98303-9dd5-415d-9605-c059ce0a1e62/2.5/23.587866108787/36.023206751055?1)

Chọn 1 Chức vụ ở ô trên cùng, rồi tick chọn những việc muốn cho phép Chức vụ đó làm. Các việc có thể
cho phép gồm:

- Lập đơn tăng ca
- Duyệt đơn tăng ca
- Loại 1 nhân viên khỏi đơn đang lập
- Xem và đăng ký chữ ký cá nhân
- Đặt mật khẩu cấp 2
- Xem (không sửa) các danh mục: Bộ phận, Nhóm, Trường hợp OT, Lý do, Nhân viên, Chức vụ

Ví dụ cách làm thường gặp: với Staff/Tổ trưởng/Trưởng nhóm — tick "Lập đơn" và "Xem/đăng ký chữ ký"
(để họ tự lập đơn và tự ký nếu cần); với Quản lý/Trưởng xưởng/Giám đốc — tick "Duyệt đơn" và "Xem/đăng
ký chữ ký" (thường các cấp này chỉ duyệt, không tự lập đơn).

> Nếu sau này đổi Chức vụ của 1 nhân viên, các quyền cũ của họ sẽ tự động được thu lại và thay bằng
> quyền của Chức vụ mới — bạn không cần làm gì thêm.

<a id="ii-7-nhan-vien"></a>

### 7. Nhân viên & thêm hàng loạt từ Excel

![Chuyển sang tab Nhân viên](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/cf5be503-9393-4f5b-8ae5-f1c6e0fb130a/2.5/69.8777458159/7.120253164557?1)

Mỗi nhân viên cần được điền đủ 3 thông tin sau, thiếu 1 trong 3 thì nhân viên đó sẽ không dùng phần
mềm được đúng cách dù đã đăng nhập:

- **Nhóm** — nhân viên thuộc Nhóm nào.
- **Chức vụ** — nhân viên giữ Chức vụ gì (xem [Phần II, mục 5](#ii-5-chuc-vu)), từ đó quyết định họ được làm gì
  và có phải duyệt đơn ở bước nào không.
- **Tài khoản đăng nhập** — tài khoản Windows dùng để đăng nhập vào phần mềm phải khớp với đúng dòng
  Nhân viên này thì mới hoạt động đúng.

Trong bảng danh sách còn có cột hiển thị số giờ tăng ca lũy kế của mỗi người trong tháng và trong năm
— nếu ai vượt mức cảnh báo đã cài đặt ở [Phần II, mục 8](#ii-8-cau-hinh), dòng đó sẽ được tô màu nổi bật để dễ
nhận ra.

**Thêm mới**:

![Form thêm Nhân viên](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2c3e44b6-81e3-41ec-bab3-9af0e34d4e10/2.5/89.225941422594/10.152953586498?1)

**Sửa / Xoá**:

![Form sửa Nhân viên](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/91efdc2e-8206-4ba0-bb00-25fd9bd9958b/2.5/86.373071391213/38.238396624473?1)

![Xác nhận xoá Nhân viên](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/55b003ac-ce94-4a9a-8f59-0407a7b2d3c2/2.5/88.336820083682/38.238396624473?1)

**Thêm nhiều nhân viên cùng lúc bằng Excel** — dùng khi cần thêm rất nhiều người, đỡ phải nhập tay
từng dòng:

![Nút Import Excel](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b9b4f09e-dbac-40c1-ac17-2a4c62f3fe1b/2.5/73.732511767782/26.951476793249?1)

Bấm vào, 1 hộp thoại hiện lên để bạn chọn file Excel từ máy tính:

![Hộp thoại Import Excel](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/6db10ac8-f1e9-4ec7-9322-0395c754a7a7/2.5/70.487382322176/67.879746835443?1)

Chọn file Excel theo đúng mẫu, phần mềm sẽ hiện trước danh sách sẽ được thêm để bạn kiểm tra lại, sau
đó mới bấm xác nhận để lưu thật.

> Số giờ tăng ca lũy kế của nhân viên **chỉ Quản trị viên mới chỉnh được**, qua đúng màn Sửa nhân viên
> này — không có màn nào để tự chỉnh lũy kế của chính mình.

<a id="ii-8-cau-hinh"></a>

### 8. Cài đặt chung

![Chuyển sang tab Cấu hình](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/4c00053e-1f2e-482e-bf4e-fa187927c19d/2.5/75.651314069038/17.668776371308?1)

Mục này chứa vài con số dùng chung cho toàn công ty, thường chỉ cần đặt 1 lần lúc mới bắt đầu dùng
phần mềm rồi để nguyên:

| Cài đặt | Ý nghĩa | Giá trị gợi ý |
|---|---|---|
| Số giờ tối thiểu để được tính phiếu ăn | Tăng ca đủ số giờ này trở lên thì được tính có ăn 1 bữa | 2,5 giờ |
| Mức cảnh báo lũy kế theo tháng | Khi 1 người tăng ca nhiều hơn mức này trong 1 tháng, phần mềm sẽ cảnh báo | 25 giờ |
| Mức cảnh báo lũy kế theo năm | Tương tự nhưng tính theo cả năm | 300 giờ |
| Giờ gom Đơn tổng tự động | Mỗi ngày, tới giờ này phần mềm sẽ tự gom các đơn đang chờ Quản lý duyệt lại thành 1 lần duyệt | 15:00 |

---

<a id="iii-cay-duyet"></a>

## III. Thiết lập đường đi duyệt đơn (Cây duyệt)

*(Dành cho Quản trị viên, hoặc người được Quản trị viên giao riêng phụ trách 1 Bộ phận/Nhóm.)*

Đây là nơi bạn quyết định: 1 đơn tăng ca của Nhóm/Bộ phận nào đó sẽ **phải qua tay những ai** trước
khi được coi là xong. Đây là bước **bắt buộc phải làm trước**, nếu bỏ qua thì sau này nhân viên lập
đơn xong sẽ không có ai nhận để duyệt tiếp. Vào **Danh mục → Cây duyệt**.

Mỗi đơn sẽ đi qua **2 chặng nối tiếp nhau**, đi hết chặng trước rồi mới sang chặng sau:

1. **Chặng đầu (theo Nhóm)** — người duyệt là Staff, Tổ trưởng hoặc Trưởng nhóm, sắp xếp **riêng cho
   từng Nhóm**.
2. **Chặng cuối (theo Bộ phận)** — người duyệt là Quản lý, Trưởng xưởng hoặc Giám đốc, sắp xếp **riêng
   cho từng Bộ phận** (dùng chung cho mọi Nhóm nhỏ bên trong Bộ phận đó).

Tuỳ Trường hợp OT của đơn ([Phần II, mục 4](#ii-4-truong-hop-ot)), đơn có thể dừng lại sớm mà không cần đi hết
cả 2 chặng.

> **⚠️ Chức vụ cao hơn không tự động duyệt thay cho chức vụ thấp hơn.** Ví dụ: nếu Giám đốc chưa được
> xếp vào đúng bước nào đó, Giám đốc sẽ **không** duyệt thay được cho Quản lý ở bước đó chỉ vì chức vụ
> cao hơn — mỗi bước phải được xếp rõ ràng ai duyệt thì người đó (đúng Chức vụ đó) mới duyệt được.

**Bước 1 — Chọn Bộ phận cần thiết lập**

![Chọn Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/12ceddc9-45cd-437a-895f-9e762e3678c3/2.5/24.267782426778/34.96835443038?0)

Ô chọn Bộ phận/Nhóm cho phép gõ để tìm nhanh, rất tiện khi công ty có nhiều Bộ phận/Nhóm.

**Bước 2 — Sắp xếp chặng đầu (theo Nhóm)**: chọn 1 Nhóm nhỏ bên trong Bộ phận vừa chọn.

![Chọn Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/fe30f702-092e-4d2c-8afe-3a5cd953f683/2.5/23.195606694561/60.073839662447?0)

Chọn 1 Chức vụ muốn thêm vào rồi bấm **"Thêm bước"**. Làm lặp lại để xếp đủ các Chức vụ cần duyệt theo
đúng thứ tự bạn muốn (không bắt buộc phải dùng đủ cả 3 Chức vụ — có thể bỏ bớt nếu Nhóm không cần):

![Chọn Chức vụ cho bước mới](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/4e31844e-1829-4732-a22c-cd7c8d8eb0f0/1.2541787321884/51.698973587866/51.951476793249?0)

![Bấm Thêm bước](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b12f5644-b927-44b7-a9cf-230ec6fe8e50/2.5/87.526150627615/51.951476793249?0)

Sau khi thêm xong, bạn có thể **kéo-thả** để đổi thứ tự các bước (giữ chuột vào tay cầm ở đầu mỗi
dòng rồi kéo lên/xuống) — thứ tự trên màn hình chính là thứ tự duyệt thật. Mỗi bước còn có 2 lựa chọn
cần quyết định:

- **"Chỉ xác nhận" hoặc "Bắt buộc ký"** — chọn "Bắt buộc ký" nếu người duyệt bước này cần có chữ ký đã
  đăng ký; chọn "Chỉ xác nhận" nếu chỉ cần bấm nút Duyệt, không cần ký. Với chặng theo Nhóm, chỉ được
  chọn **tối đa 2 bước** là "Bắt buộc ký".

  ![Bật Chỉ xác nhận / Bắt buộc ký](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/df0d389b-e843-41e3-a234-756061a49e72/2.5/37.578451882845/45.516877637131?0)

- **"Người chịu trách nhiệm"** — nếu muốn, đánh dấu 1 bước là người chịu trách nhiệm chính của Nhóm
  (chỉ chọn được 1 bước, có thể để trống nếu không cần):

  ![Bỏ đánh dấu người chịu trách nhiệm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/015af8d8-4e37-44bb-a409-a3ae8c85257f/2.5/52.147211689331/69.778481012658?0)

Ngoài ra còn có ô **"Người phụ trách"** — nếu bạn là Quản trị viên, bạn có thể chọn 1 hoặc vài nhân
viên trong Nhóm này để họ tự vào chỉnh sửa lại phần này sau này, không cần nhờ bạn làm mỗi lần (xem
thêm ở [Phụ lục B](#phu-luc-b)). Ô này chỉ Quản trị viên nhìn thấy.

Xong phần Nhóm, bấm **"Lưu cây duyệt"**:

![Lưu cây duyệt Nhóm](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/245ed906-3e98-46e1-a6d0-15bac78dbf0e/2/78.225075358798/29.024645249406?0)

**Bước 3 — Sắp xếp chặng cuối (theo Bộ phận)**: ngay bên dưới, thêm tiếp các bước Quản lý → Trưởng
xưởng → Giám đốc theo đúng thứ tự cần duyệt (không cần chọn lại Bộ phận, dùng chung với Bước 1):

![Thêm bước cấp Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2aa92b76-9e73-48b1-96f7-dd120e779ae5/2.5/87.526150627615/86.339662447257?0)

Bấm **"Lưu cây duyệt"** thêm lần nữa để lưu phần này:

![Lưu cây duyệt Bộ phận](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/7b72d79f-633e-4ca4-b18c-9f43609b4adb/2.5/87.526150627615/93.090717299578?0)

> **Lưu ý quan trọng**: nếu 1 Nhóm hoặc Bộ phận chưa được sắp xếp bước duyệt nào, đơn của họ sẽ **bị
> kẹt mãi mãi** ở đó, không ai duyệt tiếp được. Vì vậy, hãy sắp xếp xong phần này trước khi để nhân
> viên của Nhóm/Bộ phận đó bắt đầu lập đơn.

---

<a id="iv-tao-don"></a>

## IV. Lập và quản lý đơn tăng ca

*(Dành cho người được phép lập đơn tăng ca.)*

<a id="iv-1-tao-don"></a>

### 1. Lập đơn tăng ca mới

**Bước 1 — Mở màn hình lập đơn**

![Vào Tạo đơn tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/71e1a71c-72a5-4a1a-9d9a-d0be8430131f/2.5/31.928735321906/8.5263397262542?0)

![Form Tạo đơn tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/f45c70a1-0474-42e6-9f80-7bb43d39ec29/1.5/65.483870967742/41.442586285772?0)

Màn hình có 3 phần, điền lần lượt từ trên xuống:

**1. Thông tin chung** — Bộ phận và Nhóm (nếu bạn chỉ thuộc 1 Nhóm duy nhất, 2 ô này sẽ tự điền sẵn),
Lý do, Trường hợp OT, Ngày tăng ca, và khung **Giờ bắt đầu — Giờ kết thúc** chung cho cả đơn.

> **⚠️ Cần nhớ về giờ:** đây là khung giờ tối đa cho cả đơn. **Giờ bắt đầu** của mọi nhân viên trong
> đơn đều lấy theo đúng giờ bắt đầu chung này, không sửa riêng từng người được. **Giờ kết thúc** thì
> mỗi người có thể khác nhau (điền ở bước 2 dưới đây), nhưng **không được muộn hơn** giờ kết thúc
> chung đã chọn ở đây.

**2. Danh sách nhân viên** — tick chọn những nhân viên tham gia đợt tăng ca này. Danh sách chỉ hiện
nhân viên **cùng Nhóm** với đơn đang lập — không chọn được người ở Nhóm khác. Bên cạnh tên mỗi người
có hiển thị sẵn số giờ tăng ca lũy kế hiện tại (tháng/năm) để bạn tham khảo trước khi gửi đơn — nếu ai
đó sắp vượt mức cảnh báo, nên cân nhắc chọn lại Trường hợp OT cho phù hợp. Với từng người đã chọn, bạn
có thể sửa riêng **Giờ kết thúc** nếu người đó về sớm hơn giờ chung.

**3. Phát sinh khác** (không bắt buộc) — nếu có, tick "Ăn"/"Xe đưa đón"/"Dùng phòng photo". Khi tick
"Ăn", màn hình hiện thêm 3 ô để nhập số lượng phiếu ăn (phiếu chính, phiếu phụ, sữa) cho cả đơn.

**Bước 2 — Gửi đơn**

![Bấm Tạo đơn](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/de19acdc-08c6-486b-9574-7eea5c29c27d/1/63.779918567508/0?0)

Bấm **"Tạo đơn"**. Đơn sẽ được gửi đi ngay để chờ người có trách nhiệm duyệt — không có bước "lưu tạm"
riêng, nên hãy kiểm tra kỹ thông tin trước khi bấm. Sau khi bấm, màn hình sẽ chuyển sang trang xem
Chi tiết đơn vừa gửi.

<a id="iv-2-sua-don"></a>

### 2. Xem lại và sửa đơn

**Xem danh sách đơn của mình**

![Vào Đơn tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/608e4e0d-d230-4864-8d7e-6e2fa825c0e4/2.5/0/16.877637130802?0)

![Tab Đơn của tôi](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/31b000b1-295b-4387-a0e7-a0d35d777db1/2.5/28.9470013947/8.84867585015?0)

Màn hình "Đơn tăng ca" có nhiều thẻ (tab) để xem đơn theo từng góc khác nhau — thẻ nào bạn thấy tuỳ
theo công việc của bạn:

| Thẻ | Xem gì |
|---|---|
| Đơn của tôi | Những đơn do chính bạn lập |
| Chờ tôi duyệt | Những đơn đang chờ bạn duyệt — xem thêm ở [Phần V, mục 2](#v-2-duyet-trong-app) |
| Đơn đã xử lý | Những đơn bạn đã từng ký/duyệt/từ chối trước đó |
| Đơn tôi tham gia | Những đơn có tên bạn trong danh sách tăng ca, dù bạn không lập/không duyệt |

Ở thẻ "Đơn của tôi", mỗi dòng có 1 nhãn màu cho biết trạng thái đơn, và 1 cột tóm tắt xem đơn đã được
ai duyệt tới đâu rồi. Bạn có thể lọc nhanh theo trạng thái, ví dụ "Đang chờ duyệt":

![Lọc theo trạng thái Đang chờ duyệt](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/eef3d248-3672-46ea-8bb8-ff6c43238688/2.5/83.3543083159/58.966244725738?0)

Bấm vào 1 dòng để xem chi tiết đơn đó:

![Chi tiết đơn](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/83b85b77-6afb-4a61-a03b-529bb1c7e7d4/1.5/64.393136725604/20.458244941931?0)

**Sửa đơn** — nút này chỉ hiện khi đơn còn chưa duyệt xong hết, và **chỉ đúng người đã tạo ra đơn đó**
mới thấy và sửa được — kể cả người duyệt hay Quản trị viên cũng không sửa hộ được:

![Bấm Sửa đơn](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/884fcaed-85ff-4a27-a53d-ba5b46b4ee20/2.5/84.385623692469/10.04746835443?0)

Trong màn Sửa đơn, bạn **chỉ sửa được Giờ kết thúc** của từng người — mọi thông tin khác đã điền lúc
lập đơn đều không sửa được nữa:

![Chỉnh Giờ kết thúc](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/05b26c63-f832-4dad-a513-3ca692273e23/1.5/71.756504968619/55.116033755274?0)

![Điều chỉnh giá trị giờ](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/85675a5a-f3b9-465e-b4a9-be45e7bc8e9d/2.5/81.393828451883/53.111814345992?0)

Sửa xong, bấm **"Lưu thay đổi"**:

![Lưu thay đổi](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/253107d2-3964-4263-aa8f-38033b1fbd36/2.5/88.833682008368/95.727848101266?0)

> Khi đơn đã được duyệt xong tới cấp cuối cùng, nút "Sửa" sẽ biến mất hẳn — không ai sửa lại được
> nữa, kể cả Quản trị viên. Nếu cần thay đổi, chỉ còn cách chờ đơn bị Từ chối (nếu còn đang chờ duyệt)
> rồi lập lại đơn mới. Nếu chỉ muốn bớt 1 người khỏi danh sách (không phải sửa giờ), dùng nút "Loại
> khỏi đơn" ở trang Chi tiết đơn — xem [mục 3 ngay dưới đây](#iv-3-loai-khoi-don).

**In đơn** — nút này luôn hiện, ở bất kỳ trạng thái nào của đơn, để bạn có thể xem hoặc in ra giấy bất
cứ lúc nào cần. Những cấp nào chưa duyệt tới thì ô chữ ký của họ trên bản in sẽ để trống.

<a id="iv-3-loai-khoi-don"></a>

### 3. Loại 1 người ra khỏi đơn

Nếu 1 người trong đơn không thể tham gia tăng ca nữa (ví dụ xin nghỉ đột xuất), bạn không cần huỷ hay
lập lại cả đơn — chỉ cần loại đúng người đó ra khỏi đơn.

Vào trang Chi tiết đơn (giống bước ở [mục 2 phía trên](#iv-2-sua-don)), tìm tên người cần loại trong bảng
danh sách nhân viên, ở cột cuối cùng bấm vào biểu tượng **"Loại khỏi đơn"** (hình người có dấu X) ngay
trên dòng của người đó:

![Nút Loại khỏi đơn trên từng dòng nhân viên](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/8d749133-9ea8-4390-bce0-c242a9a5932d/2.5/87.526150627615/62.341772151899?0)

1 hộp thoại hiện lên, bắt buộc gõ lý do loại trước khi xác nhận:

![Hộp thoại Loại khỏi đơn](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/4c4d147a-64fc-4173-a584-2301bca41d2e/1/50/50?0)

Gõ lý do xong, bấm **"Xác nhận loại khỏi đơn"** để hoàn tất, hoặc bấm "Huỷ" nếu đổi ý.

> **⚠️ Cần nhớ:**
> - Người bị loại **không bị xoá tên khỏi lịch sử đơn** — vẫn xem lại được là họ từng có trong đơn,
>   chỉ là không còn tính giờ và lũy kế tăng ca cho đợt này nữa.
> - Đây là thao tác **khác** với nút "Sửa đơn" ở mục 2 phía trên — nút Sửa chỉ chỉnh được giờ kết thúc, không
>   thêm/bớt được người. Muốn bớt người, luôn dùng nút "Loại khỏi đơn" này.
> - Người đã bị loại **không thêm lại được** vào đúng đơn đó nữa — nếu cần, phải lập 1 đơn mới cho
>   người đó.

---

<a id="v-ky-duyet"></a>

## V. Ký duyệt đơn tăng ca

*(Dành cho người được phép duyệt đơn — có thể là Tổ trưởng, Trưởng nhóm, Quản lý, Trưởng xưởng hoặc
Giám đốc, tuỳ vị trí của bạn trong Cây duyệt.)*

<a id="v-1-chuan-bi"></a>

### 1. Chuẩn bị trước khi ký: Chữ ký & Mật khẩu cấp 2

Trước khi có thể ký hoặc duyệt bất kỳ đơn nào, bạn cần chuẩn bị đủ 2 thứ dưới đây — nếu thiếu, phần
mềm sẽ không cho bạn duyệt dù đúng lượt của bạn. Cả 2 đều do chính bạn tự đăng ký, chỉ cần làm 1 lần.

**Đăng ký chữ ký**

![Vào Chữ ký của tôi](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/a70efabe-8224-40f4-b67e-73dcb523dcd9/2.5/0/30.801687763713?0)

![Màn Chữ ký của tôi](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/a8a33f72-608e-4357-9305-6be33a7b5ccb/1/55.753138075314/36.524261603376?0)

Chụp hoặc quét lại chữ ký tay thật của bạn (ảnh PNG/JPG), rồi tải ảnh đó lên. Đây **không phải** là ký
trực tiếp bằng chuột trên màn hình — chỉ cần 1 ảnh chữ ký tay có sẵn. Sau khi tải lên, phần mềm sẽ
tự động đóng dấu ảnh chữ ký này lên đơn mỗi lần bạn ký duyệt, bạn không cần ký lại từng đơn một.

Sau khi bấm "Lưu", phần mềm sẽ gửi 1 email tới hộp thư của bạn — bạn cần mở email đó và bấm vào link
xác nhận thì chữ ký mới thật sự có hiệu lực. Trước khi xác nhận, chữ ký cũ (nếu có) vẫn được dùng bình
thường.

**Đặt mật khẩu cấp 2**

![Vào Mật khẩu cấp 2](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/f05ccf1c-cd5b-49e8-a931-5aa1fc03d6ae/2.5/0/35.443037974684?0)

![Màn Mật khẩu cấp 2](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/3b9f8d79-0b85-4b88-91ce-a68f44ab5a85/1/55.753138075314/33.043248945148?0)

Đây là **mật khẩu riêng, khác với** mật khẩu bạn dùng để đăng nhập máy tính. Mỗi lần bạn ký, duyệt
hoặc từ chối 1 đơn — dù làm trong phần mềm hay qua email — bạn sẽ được yêu cầu gõ lại đúng mật khẩu
này để xác nhận, coi như 1 lớp bảo đảm thêm rằng chính bạn là người ký. Cũng giống như chữ ký, mật
khẩu mới chỉ có hiệu lực sau khi bạn xác nhận qua email.

<a id="v-2-duyet-trong-app"></a>

### 2. Duyệt / Từ chối ngay trong phần mềm

**Mở danh sách đơn đang chờ bạn duyệt**

![Vào Đơn tăng ca](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b5dca779-eaf5-4e23-b233-1f935a1288f0/2.5/0/16.877637130802?0)

![Tab Chờ tôi duyệt](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/e808a59c-ad83-4213-a771-b09c3259cf31/2.5/28.655367416318/17.668776371308?0)

Thẻ này chỉ hiện đúng những đơn **đang chờ tới lượt bạn** — các đơn đang chờ người khác duyệt (dù
cùng Nhóm/Bộ phận với bạn) sẽ không hiện ở đây. Có thể lọc theo trạng thái "Đang chờ duyệt" cho gọn:

![Lọc Đang chờ duyệt](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/b3a55a7b-ca1b-48fa-9ab6-d295cc001272/2.5/76.108132845188/56.540084388186?0)

Bấm vào 1 đơn để xem chi tiết:

![Mở Chi tiết đơn #39](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/5a14d47c-ae31-421d-a7cf-d7e66dd7f109/1/55.360878661088/80.274261603376?0)

**Từ chối đơn** — bấm nút "Từ chối":

![Bấm Từ chối](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/2aa8ae71-9f7d-4f7d-b77a-6ebf86a3a107/2.5/84.20175209205/95.7805907173?0)

1 hộp thoại nhỏ hiện lên, có ô để bạn gõ lý do từ chối:

![Hộp thoại Từ chối, gõ lý do](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/0f9ee8c9-643e-4ecd-81dc-b58ead7738dd/2.5/50/39.60970464135?0)

Nếu đổi ý không muốn từ chối nữa, bấm "Huỷ" để đóng hộp thoại lại mà không gửi gì:

![Đóng hộp thoại Từ chối](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/1a76ce0e-d215-4559-9357-f942dddc0f53/2.5/50/69.145569620253?0)

**Duyệt đơn** — bấm nút "Duyệt", nhập mật khẩu cấp 2 để xác nhận (chữ ký sẽ tự lấy từ ảnh bạn đã đăng
ký ở [Phần V, mục 1](#v-1-chuan-bi), không cần làm gì thêm), có thể ghi chú thêm nếu muốn:

![Bấm Duyệt](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/dbbe5631-22fe-4b20-ba55-62410261f3a9/2.5/88.833682008368/95.7805907173?0)

![Xác nhận Duyệt đơn](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/87a4229a-0ba6-477f-8400-dd44251ca621/1.5475161987041/50/50?0)

Sau khi bạn duyệt, đơn sẽ tự động chuyển tới người tiếp theo cần duyệt. Nếu bạn là người duyệt cuối
cùng của đơn đó, đơn sẽ chuyển sang trạng thái **"Hoàn tất"** ngay. Nếu bấm Từ chối, đơn sẽ dừng lại
hẳn, không đi tiếp nữa — người lập đơn có thể xem lại lý do từ chối trong trang Chi tiết đơn.

> Ngay trên trang Chi tiết đơn này cũng có nút **"Loại khỏi đơn"** cho từng nhân viên — xem cách dùng
> ở [Phần IV, mục 3](#iv-3-loai-khoi-don).

<a id="v-3-duyet-qua-email"></a>

### 3. Duyệt / Từ chối qua Email

Ngoài cách duyệt trong phần mềm ở trên, bạn cũng có thể duyệt ngay từ email — tiện cho những lúc không
tiện mở phần mềm. Mỗi khi có đơn tới lượt bạn duyệt, bạn sẽ nhận được 1 email kèm link để duyệt hoặc
từ chối trực tiếp, **không cần đăng nhập lại**.

![Mở email nhận được](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/253e33cc-9dc1-4ab5-a46c-8ad7c537e791/1/0/0?0)

Bấm vào link trong email để mở trang xem đơn (có cả tiếng Việt và tiếng Nhật), trang này hiện đầy đủ
thông tin đơn đang chờ bạn duyệt:

![Trang xác nhận công khai](https://dubble-prod-01.s3.amazonaws.com/assets/a54b642c-0029-4b0f-996b-86500609a71b.png?0)

![Chi tiết đơn trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/6ff53ece-6ec4-4c79-8d4c-8b695310aad2/1/50/53.428270042194?0)

> Ngay trên trang này, mỗi dòng nhân viên cũng có biểu tượng **"Loại khỏi đơn"** giống hệt trong phần
> mềm — bấm vào sẽ hiện đúng hộp thoại song ngữ để gõ lý do (xem thêm ở
> [Phần IV, mục 3](#iv-3-loai-khoi-don)):
>
> ![Hộp thoại Loại khỏi đơn trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/768c64f1-66aa-4b7f-bdc2-c2d28c0d0fb1/2/50.146106087191/49.400565812211?0)

Trang này có 2 nút: **"Từ chối / 却下"** và **"Duyệt / 承認"**:

![Nút Từ chối trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/22ec284d-40bc-4cd3-b8e3-ea0ec7b493c6/2.5/73.85836166318/93.987341772152?0)

Bấm "Từ chối / 却下" cũng sẽ hiện 1 ô để gõ lý do, giống hệt cách làm trong phần mềm:

![Hộp thoại Từ chối trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/e1aaf8ed-a822-4f41-a6a2-ee7d97f9d9a0/2/49.662235119449/48.01065726313?0)

Còn nếu muốn duyệt, bấm nút **"Duyệt / 承認"**:

![Nút Duyệt trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/545c1f02-3310-4ae3-9eb9-95eb2ab47629/2.5/80.936192468619/93.987341772152?0)

Bấm "Duyệt / 承認" rồi xác nhận lại 1 lần nữa:

![Xác nhận Duyệt đơn trên trang công khai](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/0253f312-5167-4700-bf40-9032163e4c66/2.1115702479339/50/50?0)

Nhập mật khẩu cấp 2 (bắt buộc, giống hệt khi duyệt trong phần mềm):

![Nhập mật khẩu cấp 2](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/20127bc5-02f9-4f80-9d52-4acf3f7d3f66/2.5/50/46.360759493671?0)

Bấm **"Xác nhận duyệt / 承認を確定"**:

![Bấm Xác nhận duyệt](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/3dd8b6ef-5276-4f90-8607-e3400b111d50/2/51.021783051019/51.21844745985?0)

Phần mềm sẽ báo thành công — đơn đã được duyệt, y hệt như khi bạn duyệt trong phần mềm:

![Duyệt thành công](https://d3q7ie80jbiqey.cloudfront.net/media/image/zoom/0a083e9a-dc23-4764-8360-95034c49b256/1.0320512820513/49.607740585774/96.62447257384?0)

> **Lưu ý**: mỗi link trong email chỉ dùng được **1 lần duy nhất**. Nếu đơn đã được xử lý rồi (dù do
> bạn hay do ai khác), bấm lại link cũ sẽ báo lỗi — lúc đó vào lại phần mềm để xem tiếp.

---

<a id="phu-luc-a"></a>

## Phụ lục A — Các trạng thái của 1 đơn tăng ca

| Trạng thái | Ý nghĩa |
|---|---|
| **Đang chờ duyệt** | Đơn vừa được gửi, hoặc đang chờ 1 người nào đó duyệt tiếp |
| **Hoàn tất** | Đơn đã được duyệt xong đủ các bước cần thiết, có thể In đơn |
| **Từ chối** | Đơn đã bị 1 người nào đó từ chối, dừng lại hẳn tại đó |

Vài điều nên nhớ:

- Đơn **không có bước "lưu tạm"** — gửi xong là đi thẳng vào hàng chờ duyệt luôn.
- Đơn luôn được duyệt hết ở cấp **Nhóm** trước, rồi mới tới cấp **Bộ phận**.
- Nút **"Sửa"** chỉ còn khi đơn chưa duyệt xong (chỉ sửa được giờ kết thúc của từng người).
- Nút **"In đơn"** luôn hiện, dùng được ở mọi trạng thái.

---

<a id="phu-luc-b"></a>

## Phụ lục B — Giải thích các từ hay gặp

| Từ | Giải thích |
|---|---|
| **Bộ phận** | Đơn vị tổ chức lớn — bên trong có nhiều Nhóm nhỏ |
| **Nhóm** | Đơn vị tổ chức nhỏ — mỗi nhân viên thuộc về 1 Nhóm |
| **Chức vụ** | 6 vị trí có sẵn: Staff, Tổ trưởng, Trưởng nhóm (duyệt bước đầu) và Quản lý, Trưởng xưởng, Giám đốc (duyệt bước cuối) |
| **Cây duyệt** | Nơi sắp xếp đơn phải qua tay những ai trước khi xong, gồm phần "theo Nhóm" và phần "theo Bộ phận" |
| **Trường hợp OT** | Lựa chọn khi lập đơn, quyết định đơn cần duyệt tới đâu và có cần chữ ký hay không |
| **Bắt buộc ký** | Đánh dấu 1 bước duyệt cần có chữ ký thật, tối đa 2 bước cho mỗi Nhóm |
| **Người chịu trách nhiệm** | Đánh dấu 1 người là đầu mối chính của Nhóm trong Cây duyệt |
| **Mật khẩu cấp 2** | Mật khẩu riêng để xác nhận mỗi lần ký/duyệt, khác mật khẩu đăng nhập |
| **Người phụ trách** | Người được giao riêng quyền chỉnh sửa Cây duyệt cho 1 Bộ phận/Nhóm, không cần là Quản trị viên |
| **Đơn tổng** | Gom nhiều đơn đang chờ cùng 1 người duyệt lại thành 1 lần duyệt, thay vì mở từng đơn |
| **Loại khỏi đơn** | Bớt 1 người ra khỏi đơn đang lập, không tính giờ/lũy kế cho họ nữa, nhưng vẫn giữ tên trong lịch sử đơn |

---

<a id="phu-luc-c"></a>

## Phụ lục C — Ai được làm gì

| Chức vụ | Lập đơn | Ký/Duyệt | Phạm vi |
|---|---|---|---|
| Staff / Tổ trưởng / Trưởng nhóm | Tuỳ Quản trị viên cho phép hay không | Tuỳ Quản trị viên cho phép hay không | Trong Nhóm của mình |
| Quản lý (Manager) | Thường không | Duyệt bước cuối (TH1) | Trong Bộ phận của mình |
| Trưởng xưởng (Factory Manager) | Thường không | Duyệt bước cuối (TH2) | Toàn công ty |
| Giám đốc (Director) | Thường không | Duyệt bước cuối (TH3) | Toàn công ty |
| Quản trị viên | Có, mọi Nhóm | Có, mọi bước | Toàn công ty, được thiết lập mọi thứ |

> Bảng trên chỉ là ví dụ thường gặp — quyền thật của mỗi Chức vụ do Quản trị viên tự quyết định ở mục
> [Phần II, mục 6 — Quyền theo Chức vụ](#ii-6-quyen-theo-chuc-vu), có thể khác tuỳ theo công ty.

---

<a id="phu-luc-d"></a>

## Phụ lục D — Câu hỏi thường gặp

**Lập đơn xong mà không thấy ai duyệt, đơn cứ nằm mãi ở "Đang chờ duyệt"?**
Nhờ Quản trị viên kiểm tra lại [Cây duyệt](#iii-cay-duyet) của đúng Nhóm/Bộ phận đó — có thể bước
duyệt đó chưa được sắp xếp, hoặc chưa có ai giữ đúng Chức vụ cần thiết.

**Bấm Duyệt/Ký nhưng phần mềm không cho làm?**
Kiểm tra lại xem đã đăng ký **Chữ ký** và **Mật khẩu cấp 2** chưa ([Phần V, mục 1](#v-1-chuan-bi)) — thiếu 1
trong 2 thì không ký/duyệt được. Nếu vừa mới đổi, nhớ vào email xác nhận trước — chưa xác nhận thì
chưa có hiệu lực.

**Muốn sửa lại đơn nhưng không thấy nút "Sửa"?**
Có 2 khả năng: (1) đơn đã được duyệt xong hết — lúc này không ai sửa lại được nữa, kể cả Quản trị
viên, chỉ còn cách chờ đơn bị Từ chối (nếu còn đang chờ duyệt) rồi lập đơn mới; hoặc (2) bạn không
phải người đã tạo ra đơn đó — chỉ đúng người tạo mới thấy nút Sửa, kể cả người duyệt cũng không sửa
hộ được.

**Vì sao không chọn được nhân viên ở Nhóm khác khi lập đơn?**
Mỗi đơn tăng ca chỉ dành cho nhân viên trong cùng 1 Nhóm với đơn. Nếu cần cho người ở Nhóm khác cùng
tăng ca 1 đợt, hãy lập 2 đơn riêng, mỗi đơn 1 Nhóm.

**Bấm vào link duyệt trong email nhưng báo lỗi?**
Mỗi link chỉ dùng được đúng 1 lần. Nếu đơn đã được xử lý rồi (bởi bạn hoặc người khác), link cũ sẽ
không dùng lại được nữa — vào phần mềm để xem tiếp.

**Nhân viên mới không lập được đơn / không thấy đủ menu?**
Nhờ Quản trị viên kiểm tra lại 3 điều ở [mục Nhân viên](#ii-7-nhan-vien): đã gán đúng **Nhóm** chưa,
đã gán **Chức vụ** chưa, và đã điền đúng **tài khoản đăng nhập** chưa.
