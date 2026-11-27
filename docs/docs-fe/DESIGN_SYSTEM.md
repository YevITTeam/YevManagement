# YEV Management — Design System

> Chuẩn UI duy nhất của `yev-frontend` — đọc trước khi làm màn hình mới. Quy ước code (phân tầng, API, i18n,
> React Compiler) ở [frontend-conventions.md](frontend-conventions.md). Stack UI: Tailwind **v4** · `lucide-react` · font Inter · `react-toastify`.
> Mẫu code luôn lấy từ file thật được trỏ tới ở từng mục, không chép JSX vào doc.

## 0. Nguyên tắc
- Đỏ YEV `#e3000f` là màu chính; nền/chữ trung tính ấm; **không indigo**. Bo góc vừa phải (`rounded-xl` card, `rounded-lg` nút/ô nhập) + `shadow-sm`.
- Emerald chỉ cho nghĩa "tích cực/online" (chấm trạng thái, delta dương) vì đỏ đã dành cho brand + danger.
- Giữ bố cục/khoảng cách theo thang ở §2; không thêm token, font, thang spacing mới.
- **Tối giản trước:** mỗi phần tử phải có việc; bỏ mô tả, tiêu đề phụ, khung, icon trang trí không giúp người dùng thao tác. Dành diện tích cho dữ liệu/ô nhập (bảng dày, form nhiều cột, bỏ khoảng trống thừa), không cho chữ giải thích.

## 1. Bảng màu

> ⚠️ **Dùng hex trực tiếp** (`bg-[#e3000f]`), KHÔNG dùng class token (`bg-brand-red`, `text-muted`…): Tailwind v4 không có `@config`
> nên `tailwind.config.ts` không được nạp, các class đó không sinh CSS.

| Vai trò | Hex |
|---|---|
| Primary / hover | `#e3000f` / `#b40009` |
| Nền app (`<main>`) · sidebar | `#f8fafc` · `#f7f9fb` |
| Card | `#ffffff` |
| Nền phụ (thead, toolbar) · hover nhẹ | `#f8fafc` / `#eceef0` · `#f2f4f6` |
| Viền mặc định · viền hàng bảng | `#e0e3e5` · `#f1f5f9` |
| Chữ chính · body/nhãn · muted/placeholder | `#191c1e` · `#5e3f3a` · `#8a8f94` |
| Danger solid (hover) · danger chữ | `#930006` (`#7a0005`) · `#930006` hover `#e3000f` |
| Error/cảnh báo (nền · viền · chữ) | `#fff4f2` · `#e9bcb6` · `#930006` |
| Accent nhạt (avatar, icon KPI) | nền `#fff4f2` · viền `#e9bcb6` · chữ `#e3000f` |
| Success | `bg-emerald-50` · `border-emerald-200` · `text-emerald-600` (dot `bg-emerald-500`) |
| Warning | `#fff4e5` · `#f5d0a9` · `#9a5b00` |
| Focus ô nhập | border `#e3000f` + ring `#ffe0e3` |

## 2. Typography · Spacing · Radius

- Font **Inter** (`inter.className` trên `<body>` ở `src/app/[locale]/layout.tsx`).
- Type scale: tiêu đề trang danh sách/báo cáo `text-lg font-semibold` (trang chi tiết một bản ghi `text-2xl`, màn quét `text-xl`) · tiêu đề card `text-base font-semibold` · body/input `text-sm` · caption `text-xs text-[#5e3f3a]` · overline/thead `text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]`.
- ⚠️ CSS viết tay nhắm vào thẻ (`button`, `input`…) trong `globals.css` phải nằm trong `@layer base`; ngoài layer nó thắng mọi utility Tailwind v4 (từng làm chữ nút/ô nhập luôn 16px).
- Spacing: padding `<main>` `px-3 pb-4 pt-3 md:px-4 lg:px-5` · card `p-6` (KPI `p-5`) · toolbar `p-4` · ô bảng `px-4 py-3` (gọn) hoặc `px-6 py-4` (thưa) · khoảng cách khối `space-y-6`.
- Radius: `rounded-xl` card/section/modal · `rounded-lg` nút/ô nhập/nav item · `rounded-md` icon button/badge nhỏ · `rounded-full` pill/avatar/dot. Bóng: `shadow-sm` card, `shadow-xl` modal.

## 3. Layout
Mẫu: `src/app/[locale]/layout.tsx` (root), `(pc-manager)/layout.tsx` + `PcManagerSidebar.tsx`; các layout pc/ot/workflow/admin dùng chung khung.
- Sidebar `fixed left-0 top-0 z-40 h-screen w-[13.75rem]`, viền phải `#e0e3e5`, nền `#f7f9fb`; logo ô vuông đỏ; nội dung cột chính **rộng hết** phần còn lại (không `max-w` ở layout: màn ≥1800px dư chỗ thì bảng hiện thêm cột thay vì để trắng hai bên). Giới hạn bề rộng đặt ở từng khối cần độ dài dòng dễ đọc (form, văn bản như trang Hướng dẫn), không đặt ở khung.
- **Khung chiều cao + vùng cuộn chỉ khai ở root layout** (`body flex h-screen flex-col overflow-hidden` + `<main min-h-0 flex-1 overflow-y-auto>`). Layout con CHỈ `min-h-full`: cấm `h-screen`/`min-h-screen`/`calc(100vh-…)`, cấm `overflow-y-auto` bọc toàn trang, cấm lồng `<main>`. Vi phạm → 2 thanh cuộn chồng nhau cắt nội dung (Header `h-16` nằm trong luồng nên `100vh` + header tràn viewport).
- Mọi flex item làm vùng cuộn (`flex-1 overflow-y-auto`) phải có `min-h-0`. Bảng luôn bọc `overflow-x-auto`.
- Trang chi tiết có luồng duyệt: từ `xl` hai cột, cột phải `22rem` giữ bước duyệt + thao tác + lịch sử để người duyệt thấy nút ngay; dưới `xl` một cột. Màn thiết kế kiểu bảng công cụ + canvas: từ `lg` bảng công cụ là cột `w-56` dính khi cuộn, dưới `lg` nằm trên canvas dạng lưới 2–3 cột. Nội dung rộng cố định (văn bản .docx, canvas) cuộn ngang trong khung riêng, không kéo cả trang.
- **Dưới `md` sidebar là ngăn kéo**: ẩn sẵn, mở bằng nút ☰ trên `Header`, đóng khi chuyển trang hoặc bấm lớp phủ; `--sidebar-w` về 0 (`globals.css`). Sidebar mới phải gắn `sidebarDrawerClass(mobileOpen)` từ `useSidebarCollapse`. Logo trên `Header` luôn là link về trang chủ (logo trong sidebar chỉ là nút mở rộng); trang có sidebar thì dưới `lg` chỉ hiện logo, không kèm chữ.
- Nav item sidebar: `border-l-4`, active = `border-[#e3000f] bg-[#eceef0] text-[#191c1e]` + icon đỏ; thường = `border-transparent text-[#5e3f3a] hover:bg-[#eceef0]`. Mẫu `WorkflowManagerSidebar.tsx` (nhóm có overline, `aria-current`).

## 4. Component

### 4.1. Card & KPI
Card `rounded-xl border border-[#e0e3e5] bg-white shadow-sm` (nội dung `p-6`, KPI `p-5`). KPI: nhãn `text-sm text-[#5e3f3a]`, số `text-2xl font-semibold`, ô icon `rounded-md bg-[#fff4f2] p-3 text-[#e3000f]`.

### 4.2. Button — 4 biến thể
Chung: `inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed`.

| Biến thể | Class |
|---|---|
| Primary | `bg-[#e3000f] text-white px-4 py-2 hover:bg-[#b40009]` |
| Secondary | `border border-[#e0e3e5] bg-white text-[#191c1e] px-3 py-2 hover:bg-[#f2f4f6]` |
| Danger | `bg-[#930006] text-white px-4 py-2 hover:bg-[#7a0005]` |
| Icon | `rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] hover:bg-[#f2f4f6]` |

Nút header trang cỡ nhỏ `px-3 py-1.5 text-xs`. Tự viết class (không có component Button chung).
**Nút rộng vừa chữ, KHÔNG `w-full`/ô grid chia đều**; nhóm nút `flex flex-wrap gap-2`, `whitespace-nowrap`, không `truncate`. Ngoại lệ: submit full-width trong form hẹp (login).
Nút chỉ hiện khi hover (`opacity-0 group-hover:opacity-100`) phải kèm `[@media(hover:none)]:opacity-100`, không thì màn cảm ứng không bấm được. Nút có chữ dài trên header/toolbar: dưới `sm` chỉ còn icon (giữ `title` + `aria-label`).

### 4.3. Ô nhập & filter
Ô chuẩn `h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]`; cỡ gọn `h-9 rounded-md px-2.5` (màn cấu hình/hàng nhiều ô, mẫu `AttendanceSettingPanel.tsx`). Một màn dùng 1 cỡ, không trộn trong cùng hàng.
- **Bề rộng bám theo dữ liệu, không theo ô lưới.** `w-full` chỉ cho tên/email/ghi chú/ô tìm.

  | Dữ liệu | Rộng |
  |---|---|
  | Số (giờ, số lượng) | `w-20`–`w-24` |
  | Giờ/phút | `TimePicker24h` |
  | `type="date"` | `w-40` |
  | Mã/số hiệu ngắn | `w-32` |

  Hàng nhiều field: `flex flex-wrap items-end gap-x-4 gap-y-2.5`, không `grid-cols-N` đều nhau.
- **Giờ: dùng `ui/TimePicker24h.tsx`** (24h, 2 ô gõ), KHÔNG `<input type="time">` (hiện AM/PM theo OS). BE `TimeOnly` trả `"HH:mm:ss"` — cắt/ghép `:00` ở biên UI.
- Đơn vị đặt cạnh ô (`<span class="text-xs text-[#8a8f94]">giờ</span>`), không nhét vào nhãn. Khoảng từ–đến: **1 nhãn chung**, 2 ô cách `–`, mỗi ô có `aria-label`.
- Filter đơn giản: toolbar `border-b bg-[#f8fafc] p-4`, ô tìm `w-64`. Filter nâng cao: mẫu `DeviceFilterBar.tsx` — hàng chính và panel "Lọc thêm" dùng **chung một lưới cột** để mọi ô thẳng hàng (`grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6`, số cột theo chỗ trống cạnh sidebar để ô ≥ ~200px; nhóm nút Lọc thêm/Xoá lọc luôn ở cột cuối hàng bằng `col-start-*`; dưới `sm` chỉ ô tìm + nút ở trên, phần còn lại mở bằng Lọc thêm). Mọi ô có icon trái (`pl-8`) và chữ gợi ý xám là **tên trường** ("Chi nhánh", "Trạng thái"); `StyledSelect` dùng `emptyLabel` để ô đóng hiện tên trường còn danh sách vẫn ghi "Tất cả …"; ô đã chọn trạng thái có chấm màu thì bỏ icon. Ô `type="date"` trống che `mm/dd/yyyy` bằng chữ gợi ý cho tới khi focus (`IconDate`). Ô **đã có giá trị** đổi sang tông nhấn như chip bật (viền `#e9bcb6`, nền `#fff4f2`, icon `#e3000f`) để nhìn ra ngay filter nào đang áp; panel Lọc thêm là khối trắng `rounded-lg border shadow-sm` nổi trên toolbar xám (`-mx-2 px-2` để cột vẫn thẳng hàng chính). Nút Lọc thêm có badge đếm, khi mở cũng dùng tông nhấn, `whitespace-nowrap`; filter bật hiện chip kèm `X`.
- Bộ lọc ở đầu card danh sách, không hàng nhãn: ô chọn để mục rỗng là "Tất cả <trường>" (+ `aria-label`), lọc bật/tắt là chip icon (`aria-pressed`, bật = nền `#fff4f2` chữ đỏ), Tìm/Xoá lọc/Làm mới và Excel là nút icon; hàng lọc phải vừa 1 dòng ở 1366px (chip chỉ còn icon trong khoảng `sm`–`2xl` nếu cần). Dùng `components/ui/ListToolbar.tsx` (`ListToolbar`, `SearchField`, `DateRange`, `ToggleChip`, `FilterActions`, `TableStatusRows`); `SearchableSelect`/`MultiSelect` nhận `ariaLabel`, `ActionMenu` có `iconOnly` cho nút Excel.
- Nhiều bộ lọc phụ (vd. Team/Line/Nhóm ca/Công đoạn ở màn Nhân viên) gom sau **một nút popover** có số bộ lọc đang bật (tông chip bật), để hàng lọc vẫn 1 dòng. Tab mà mọi dòng cùng một trạng thái (vd. "Chờ duyệt") thì ẩn ô lọc + pill trạng thái đó.
- Dữ liệu dropdown gọi API (cờ `isCancelled`), không hard-code. Dropdown có thể dài → `SearchableSelect` (có ô tìm); enum/ít mục → `StyledSelect`; `<select>` HTML chỉ cho vài mục cố định.

### 4.4. Bảng
Mẫu `BranchList.tsx`: `ui/TableScroll` > `table.min-w-full.text-left.text-sm`; thead `bg-[#f8fafc]` overline; hàng `border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]` (zebra + hover của `BranchList`); cột chính `font-semibold text-[#191c1e]`, cột phụ `text-[#5e3f3a]`; thao tác dạng text/icon (`Sửa` xám, `Xoá` `#930006`).
- Bảng nhiều cột (mẫu `DeviceList`, attendance `EmployeeList`): thao tác gộp vào `ui/RowActionsMenu.tsx` trong cột `sticky right-0 w-10 bg-inherit`, tiêu đề cột `sr-only`; kéo chuột cuộn ngang bằng `useDragScroll` + `cursor-grab`; ô `px-2 py-1.5`, thead `tracking-[0.06em]`. Toolbar nhiều bộ lọc: placeholder chỉ là tên trường (`Team`), bề rộng theo giá trị.
- **Bảng danh sách cuộn trong màn hình** (từ `md`): bọc `<table>` bằng `ui/TableScroll` (thay cho `div.overflow-x-auto`) — tự đo chỗ còn lại của viewport (trừ phần trên và phần dưới bảng trong cùng `<section>`, tức thanh phân trang) đặt `maxHeight`, cuộn cả 2 chiều, `thead` dính trên cùng (hàng tiêu đề phải có nền). Trang không còn cuộn, bộ lọc và phân trang luôn trong màn; tối thiểu 320px, dưới `md` cuộn cả trang như thường. Bảng tự quản `ref` (kéo-cuộn `useDragScroll`, mẫu `DeviceList`, attendance `EmployeeList`) dùng `useFitViewport(ref)` + `style={{ maxHeight }}`. Bảng phải nằm trong `<section>` chứa `Pagination`; bảng phụ trong dashboard/trang chi tiết không bọc.
- Rỗng: `EmptyState` trong `<td colSpan>`; đang tải: `TableSkeletonRows rows columns` (khối lẻ: `Skeleton`).
- Trạng thái/thao tác chỉ có icon trong ô bảng (chấm trạng thái, huy hiệu icon, nút icon): nghĩa đặt ở `title` + `aria-label` (`role="img"` cho thứ không bấm được), **không** dùng `<span class="sr-only">` trong bảng cuộn ngang — `sr-only` là `absolute`, thoát khỏi khung `overflow-x-auto` và làm cả trang cuộn ngang ở điện thoại; khung cuộn của bảng đặt `relative`. Dùng `components/ui/ListToolbar.tsx` (`IconFlag`, `StatusDot`, `IconButton`).
- **Cột lặp lại**: ẩn theo bộ lọc/tab/bản ghi (cột đã bị lọc ghim một giá trị, cột Người tạo ở tab "Của tôi", cột cùng giá trị trên cả đơn → đưa lên phụ đề), **không** theo dữ liệu trang hiện tại (số cột không được nhảy khi chuyển trang). Mã + tên gộp 1 ô; giờ BĐ–KT gộp 1 cột "17:00–20:00"; số/mã không bọc pill viền. Dòng tổng nằm ở `tfoot` dưới đúng cột.
- Ô vượt ngưỡng (lũy kế…) = chữ đỏ + `AlertTriangle` + `title` nêu ngưỡng (ngưỡng riêng của người đó nếu có), không đỏ trơn.
- Bảng chọn nhiều dòng (vd. chọn nhân viên tạo đơn): bấm **cả dòng** để tick (`cursor-pointer`, bỏ qua click từ `input/button/select/textarea/a/label`); checkbox phụ trong ô và ô "chọn tất cả" ở tiêu đề thì bọc `<label>` phủ cả ô (`td/th h-px p-0` > `label h-full px-3 py-2`); dòng tiêu đề nhóm (chọn nhiều Nhóm) bấm cả dòng để chọn/bỏ cả nhóm. Danh sách dài thêm ô tìm (`normalizeText` từ `@/lib/normalizeText`, không phân biệt dấu); tìm chỉ lọc hiển thị, không bỏ chọn dòng bị ẩn, chọn tất cả chỉ áp cho dòng đang hiện. Bảng kéo-cuộn bằng `useDragScroll` đã tự nuốt click sau khi kéo.

### 4.5. Phân trang
Dùng `ui/Pagination.tsx` (`pageIndex totalPages onPageChange summary compactSummary pageSize onPageSizeChange`): đếm bên trái, ô **Số dòng** + `‹ 1 2 3 … ›` bên phải (7 ô, dưới `sm` còn `‹ 2 / 9 ›`), nút trang ẩn khi 1 trang. Mọi bảng phân trang đều truyền `pageSize`/`onPageSizeChange`: người dùng nhập 1–1000 (trần `MaxPageSize` của BE), áp khi Enter/rời ô, tự về trang 1; số mặc định là hằng `PAGE_SIZE` của từng list, số đã nhập nhớ theo tab trình duyệt bằng `usePersistedState("page-size:<đường dẫn list>", PAGE_SIZE)` (`modules/common/hooks/usePersistedState.ts`, sessionStorage). Bảng phân trang phía client chỉ ẩn footer khi số dòng ≤ min(mặc định, số đã nhập), để còn ô hạ số dòng xuống lại. Mẫu `WorkflowRequestList`, `AppReleaseList`. Luôn phân trang server-side; list CRUD cũng dùng `Pagination` (đếm bản ghi truyền vào `summary`/`compactSummary`, không đặt thêm dòng đếm ở toolbar).

**List mở trang chi tiết phải giữ bộ lọc khi quay lại** (bộ lọc nháp + đã áp, trang, sắp xếp; lưu sessionStorage theo tab trình duyệt, còn cả sau F5, nút Xoá lọc đưa về mặc định): list không reset state trong lúc render thì dùng thẳng `usePersistedState("list:<route>:<tên>", mặc định)` (mẫu `DeviceList` — về trang 1 đặt trong handler, không so snapshot trong render); list có reset/cascade trong render thì giữ `useState`, khôi phục một lần bằng `useState(() => readPersisted<Snapshot>(key))` và lưu bằng `usePersistOnChange(key, {...})` (mẫu `OtFormListPage` — key theo tab, `WorkflowRequestList`, `FormDefinitionList`, `UsbMachineList`, `UsbFileSearch`). Đang áp cho: Thiết bị, Đơn OT, Mẫu đơn, Yêu cầu Workflow, USB Máy tính, USB Tra cứu file. Trang chi tiết mở từ một tab cụ thể thì nút quay lại trả về đúng tab đó (vd chi tiết máy USB nhận `?tab=files`).
**Danh sách đọc nhiều:** tab + bộ lọc ở đầu card (`px-4 py-2.5`; tab và bộ lọc không vừa một hàng ở 1366px thì tab nằm hàng riêng ngay trên bộ lọc, cùng card), ô bảng `px-4 py-2.5` một dòng, ẩn cột chỉ lặp một giá trị, dưới `md` đổi thành danh sách thẻ (mẫu `OtFormListPage`; bảng rất nhiều cột cạnh sidebar: dưới `lg`, mẫu `DeviceList`). Bảng ít cột giữ dạng bảng, ẩn cột phụ dưới `lg` bằng `hidden lg:table-cell` (mẫu `IpAddressList`) để cột quyết định (trạng thái) không bị đẩy ra ngoài. Bộ lọc nhiều ô: 2 cột trên điện thoại, không xếp 1 cột.
Hàng tab không `flex-wrap`: `overflow-x-auto` + nút `shrink-0` để cuộn ngang trên điện thoại.

### 4.6. Badge
`ui/Badge.tsx` (`variant` + `withDot`): `neutral` (draft/huỷ) · `info` (đã nộp/đang xử lý) · `success` (duyệt/hoạt động) · `warning` (trả về/cảnh báo) · `danger` (từ chối/lỗi). Ca đặc thù tự viết `rounded-full` với 1 bộ border/bg/text.

### 4.7. Modal & form
Mẫu `BranchForm.tsx`: `fixed inset-0 z-50` + lớp phủ `bg-black/40` + hộp `z-60 mx-4 max-w-md rounded-xl border bg-white p-6 shadow-xl`; header `border-b pb-4` có nút đóng `X` `h-5 w-5`; nhãn overline; nút Huỷ (secondary) + Lưu (primary) căn phải. Một form dùng chung create/edit.
**Form dài (≥ 10 trường)** — mẫu `DeviceForm.tsx`: modal `flex flex-col max-h-full`, header/footer cố định, chỉ thân cuộn; chia nhóm (`FormSection`: tiêu đề `8rem` bên trái, lưới 4 cột bên phải, `divide-y divide-[#f1f5f9]`); nhãn chữ thường `text-xs font-medium`, ô `h-9`; placeholder chỉ gợi ý định dạng. Danh sách con sửa tại chỗ (email…): khung `rounded-lg border divide-y`, ô "ghost" (viền khi hover/focus), hành động là icon, giải thích dài ở `title`. Chọn nhiều giá trị ngắn (IP): ô gắn thẻ, dropdown bám dưới ô.
**Màn cấu hình** — mẫu `AttendanceSettingPanel.tsx`: một card, mỗi mục một hàng chia kẻ (`divide-y`; tiêu đề `9rem` bên trái, mô tả ở `title`; field bên phải `flex-wrap`), không mỗi mục một card. Một nút Lưu chung dính chân card (`sticky bottom-0`), khoá khi chưa đổi gì, có đổi thì hiện "Có thay đổi chưa lưu" + Hoàn tác. Thao tác chạy ngay (Gửi ngay, sửa lịch) là nút riêng trong hàng, không đi qua nút Lưu.

### 4.8. Xác nhận & toast
Xoá/nguy hiểm **luôn** `common/ConfirmDialog.tsx`. Hộp có ô nhập (lý do, mật khẩu cấp 2) dùng `common/FormDialog.tsx`, thao tác phá huỷ/không phê duyệt đặt `danger` (nút đỏ đậm `#930006`); nút xác nhận ghi đúng hành động ("Phê duyệt", "Không phê duyệt", "Xoá"), không ghi chung "Xác nhận". Giá trị hệ thống tự tính, người dùng không chọn được (vd. Trường hợp OT) là chip chỉ đọc kèm luật ở `title`, không phải select bị khoá. Chọn file: không để lộ `<input type="file">` gốc (chữ "Choose file" theo ngôn ngữ trình duyệt) — dùng khung/nút bọc input ẩn, mẫu `signature/SignatureUpload.tsx`. Thông báo **luôn** `react-toastify`; mọi create/update/delete có toast thành công + lỗi (kèm `console.error`).

### 4.9. Tabs
`ui/Tabs.tsx` (`tabs activeKey onChange`, controlled, dạng viên thuốc).
Chọn 1 trong 2–3 tuỳ chọn ngắn trên thanh công cụ (khổ giấy…): nhóm nút liền `rounded-lg border bg-[#f2f4f6] p-0.5`, nút chọn `rounded-md bg-white text-[#e3000f] shadow-sm`, `role="radiogroup"`; mẫu `OtFormPrintView.tsx`.

### 4.10. Chữ thừa
- Nhãn là TÊN (≤ 3–4 từ), không phải câu mô tả; không `truncate` trên nhãn (cắt = nhãn quá dài → rút ngắn).
- Ô ngưỡng: nhãn là mảnh câu, giá trị điền vào chỗ trống (`Không phiếu ăn nếu dưới [2] giờ`). Section đã nêu ngữ cảnh thì nhãn chỉ phần còn thiếu (`Mỗi ngày`/`Mỗi tháng`).
- Giải thích dài → `title`/tooltip, không chiếm 1 dòng cố định; chỉ giữ dòng thường trực khi thiếu nó người dùng làm sai. Mô tả chỉ diễn giải lại tiêu đề thì bỏ.
- **Bỏ mô tả là xoá key i18n ở cả `vi.json` lẫn `ja.json`.** Placeholder không lặp nhãn.

### 4.11. Cây phân cấp (đơn vị + nhân sự)
Mẫu `workflow/components/org-units/OrgUnitList.tsx`, `OrgUnitChart.tsx`.
- Cây phẳng, không lồng khung: chỉ đường dẫn mảnh (`ml-5 border-l pl-3`). Đơn vị = hàng chữ đậm + icon vuông theo cấp (cấp cao nhất đỏ nhạt, còn lại xám); người = hàng nhẹ hơn + avatar tròn xám, chức danh chữ phụ cùng dòng. Hàng đơn vị: chevron · icon · tên · mã · số nhân sự; thao tác neo mép phải, luôn chiếm chỗ (chỉ đổi `opacity`).
- Hai dạng xem bằng `Tabs`: "Sơ đồ khối" (mặc định) và "Cây danh sách". Ô tìm không dấu; đang tìm thì ép mở hết nhánh.
- Sơ đồ khối = sơ đồ **nhân sự**, chỉ xem: mỗi chức danh có người giữ là một dải ngang (xếp theo `RankOrder`, nền xen kẽ trắng/`#f8fafc`), cột trái dính khi cuộn ngang ghi chức danh + số người; thẻ cùng chức danh luôn thẳng hàng, dây nối nhảy qua dải trống thì kéo dài. Dây quản lý suy từ cây đơn vị: trong một đơn vị mỗi bậc chức danh báo cáo người đầu tiên của bậc cao hơn kế trên, người cao nhất đơn vị báo cáo người cao nhất của đơn vị cha gần nhất có người. Thẻ `w-48` cao cố định: avatar tròn chữ cái đè mép trên, tên + mã nhân viên, dải dưới ghi đơn vị đang thuộc, tô màu theo dải (`#e3000f` → `#191c1e` → `#9a5b00` → `#5e3f3a`, chữ trắng). Đường bus `#c9cdd1`, nút tròn đáy thẻ thu/mở cấp dưới. Thêm/sửa/xoá đơn vị và kéo-thả làm ở "Cây danh sách".

## 5. Blueprint trang danh sách (CRUD)
Header (tiêu đề + [Làm mới] [+ Thêm mới]) → `<section rounded-xl border shadow-sm>` gồm toolbar/filter → error bar → bảng (+ empty) → Pagination; kèm modal form dùng chung, `ConfirmDialog` xoá, toast cho mọi thao tác. Mẫu: `BranchList` + `BranchForm`, `DeviceTypeList` + `DeviceTypeForm`.

## 6. Icon
`lucide-react` (`h-3.5 w-3.5` nút nhỏ, `h-4 w-4` ô nhập/nút thường, `h-5 w-5` nút đóng modal, inline `size` 12–16). Không emoji/ký tự Unicode làm icon (ngoại lệ: ô tick giả trên biểu mẫu PDF `OtFormPrintView.tsx`). Không trộn 2 kiểu icon trong một khối.

## 7. Ngôn ngữ nội dung
Text UI tiếng Việt, câu ngắn nhất quán ("Hiển thị X / Y bản ghi", "Không có dữ liệu …", "… thành công/thất bại"); i18n vi/ja theo `frontend-conventions.md §4`.

## 8. Còn lại khi chuẩn hoá code cũ
Bỏ indigo còn sót → `#fff4f2`/`#e3000f`; thêm bo góc + `shadow-sm` cho section vuông ở vài trang `pc-management` cũ; primary `#e3000f` ≠ danger `#930006`.

## 9. Checklist màn hình mới
- [ ] Khung: sidebar `w-[13.75rem]` + `<main>` cuộn, nội dung rộng hết (không `max-w` ở layout); màu đúng §1, không indigo; card `rounded-xl border bg-white shadow-sm`.
- [ ] Button đúng 4 biến thể (§4.2), ô nhập chuẩn (§4.3); **không ô/nút nào rộng quá nội dung** (không `w-full` trong lưới chia đều).
- [ ] **Không chữ thừa** (§4.10): nhãn ngắn, không `truncate`, giải thích ở `title`, bỏ mô tả thì xoá key cả 2 file i18n.
- [ ] CRUD list đủ: header → filter → error bar → bảng → phân trang; 1 modal create/edit; xoá `ConfirmDialog`; `toast`; dropdown lấy từ API.
- [ ] Comment code tiếng Anh, ngắn, mô tả hành vi hiện tại; text người dùng tiếng Việt.

## 10. Component dùng chung (tìm trước khi tự dựng)

| Cần | Dùng |
|---|---|
| Dropdown nhiều mục có ô tìm (value `number`/`""`) | `ui/SearchableSelect.tsx` |
| Dropdown ít mục/enum (value string/number, chấm màu) | `ui/StyledSelect.tsx` |
| Chọn nhiều có ô tìm | `ui/MultiSelect.tsx` (danh sách hàng nghìn mục: `maxVisible`, gõ để lọc phần còn lại) |
| Nhập giờ 24h | `ui/TimePicker24h.tsx` |
| Dấu `*` bắt buộc | `ui/RequiredMark.tsx` |
| Chú thích dài (icon `i`, hover) | `ui/InfoTooltip.tsx` |
| Tab · Phân trang · Badge | `ui/Tabs.tsx` · `ui/Pagination.tsx` · `ui/Badge.tsx` |
| Skeleton | `ui/Skeleton.tsx`, `common/TableSkeletonRows.tsx` |
| Menu thao tác (toolbar) · menu ba chấm trên dòng bảng · chồng avatar | `ui/ActionMenu.tsx` · `ui/RowActionsMenu.tsx` · `ui/AvatarStack.tsx` |
| Trạng thái rỗng | `common/EmptyState.tsx` |
| Xác nhận xoá · modal nhỏ "chọn vài field rồi xác nhận" | `common/ConfirmDialog.tsx` · `common/FormDialog.tsx` |
| Tiêu đề cột bấm để sắp xếp (server-side; tăng → giảm → thứ tự mặc định) | `ui/SortableTh.tsx` (`SortState`, đổi sắp xếp thì về trang 1; mẫu `usb-log/`) |
