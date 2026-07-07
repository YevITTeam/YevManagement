# YEV Management — Design System (Unified)

> Tài liệu thiết kế **hợp nhất** cho dự án `yev-frontend`.
> Nó gộp **bảng màu + các pattern CRUD** của [`DESIGN_GUIDE.md`](./DESIGN_GUIDE.md) với **cấu trúc layout, thang typography/spacing, hệ component** của [`dashboard-ui-guidelines.md`](./dashboard-ui-guidelines.md).
> Khi hai tài liệu nguồn mâu thuẫn, **file này là chuẩn thắng cuộc** — hãy đọc file này trước khi làm UI mới.
>
> **Stack:** Next.js (App Router) · React · Tailwind CSS · `lucide-react` · font **Inter** · `react-toastify`.

---

## 0. Nguyên tắc hoà trộn (đọc trước)

| Chủ đề | Lấy từ | Kết luận |
|---|---|---|
| **Màu sắc / thương hiệu** | DESIGN_GUIDE | Đỏ YEV `#e3000f` là màu chính; nền/chữ trung tính ấm. **Bỏ indigo** của dashboard. |
| **Layout tổng (sidebar + main)** | dashboard (đã có sẵn trong dự án) | Sidebar cố định bên trái + `<main>` cuộn, `max-w` căn giữa. |
| **Thang typography & spacing** | dashboard | Dùng type-scale & spacing-scale ở mục 2. |
| **Bo góc & đổ bóng** | hoà trộn | **Bo góc vừa phải** (không vuông cứng như DESIGN_GUIDE, không tròn mềm `rounded-2xl` như dashboard) + `shadow-sm` nhẹ. Xem mục 2.4. |
| **Card / Stat (KPI) card** | dashboard | Giữ cấu trúc, **đổi màu accent** sang đỏ nhạt `#fff4f2`. |
| **Bảng, filter bar, modal, confirm, toast, pagination** | DESIGN_GUIDE | Giữ nguyên pattern (dashboard không mô tả các phần này). |
| **Success / giá trị dương** | dashboard | Vì đỏ đã dành cho brand + danger, **giữ `emerald` chỉ cho ý nghĩa "tích cực/online"** (chấm trạng thái, delta dương). |

**Thay đổi cấu hình cần thực hiện khi migrate** (xem mục 8): khôi phục thang `borderRadius` trong `tailwind.config.ts` (hiện đang bị ép về `0px`), và thống nhất font `sans` = Inter.

---

## 1. Bảng màu (Color Palette)

Đỏ YEV cho hành động chính, trung tính ấm cho nền/chữ, đỏ đậm/error cho nguy hiểm, emerald cho tín hiệu tích cực. **Ưu tiên dùng token đã khai báo trong `tailwind.config.ts`; nếu chưa có token thì dùng arbitrary hex** (`bg-[#fff4f2]`).

### 1.1. Màu nền tảng & thương hiệu

| Vai trò | Hex | Token / class |
|---|---|---|
| **Primary / hành động chính** | `#e3000f` | `bg-brand-red` · `bg-[#e3000f]` |
| Primary hover | `#b40009` | `hover:bg-brand-red-hover` · `hover:bg-[#b40009]` |
| **App background** (vùng `<main>`) | `#f8fafc` | `bg-background` · `bg-[#f8fafc]` |
| **Sidebar / surface phụ** | `#f7f9fb` | `bg-surface` · `bg-[#f7f9fb]` |
| **Card / surface chính** | `#ffffff` | `bg-white` |
| Nền phụ (thead, toolbar, hover nhẹ) | `#f8fafc` / `#eceef0` | `bg-[#f8fafc]` / `bg-surface-container` |
| Nền hover cho nút/hàng | `#f2f4f6` | `hover:bg-[#f2f4f6]` |
| **Viền mặc định** | `#e0e3e5` | `border-outline-variant` · `border-[#e0e3e5]` |
| Viền hàng bảng (nhạt hơn) | `#f1f5f9` | `border-[#f1f5f9]` |

### 1.2. Chữ (Text)

| Vai trò | Hex | Token / class |
|---|---|---|
| Heading / số liệu / chữ chính | `#191c1e` | `text-brand-black` · `text-[#191c1e]` |
| Body / nhãn / mô tả | `#5e3f3a` | `text-on-surface-variant` · `text-[#5e3f3a]` |
| Muted / placeholder / caption phụ | `#8a8f94` | `text-[#8a8f94]` *(mới — điền khoảng trống "muted" mà DESIGN_GUIDE thiếu)* |

### 1.3. Ngữ nghĩa (Semantic)

| Vai trò | Nền | Viền | Chữ / icon |
|---|---|---|---|
| **Danger / xoá** (solid) | `bg-[#930006]` hover `#7a0005` | — | `text-white` |
| **Danger** (text-only, trong bảng) | — | — | `text-[#930006]` hover `text-[#e3000f]` |
| **Error / cảnh báo** (dải thông báo) | `bg-[#fff4f2]` | `border-[#e9bcb6]` | `text-[#930006]` |
| **Accent nhạt** (ô icon KPI, badge, avatar) | `bg-[#fff4f2]` | `border-[#e9bcb6]` | `text-[#e3000f]` |
| **Success / online / delta dương** | `bg-emerald-50` | `border-emerald-200` | `text-emerald-600` · dot `bg-emerald-500` |
| Focus ring (input) | ring `#ffe0e3` | focus border `#e3000f` | — |

> **Không dùng indigo** ở bất kỳ đâu — mọi điểm nhấn tương tác (avatar, active, focus, icon KPI) dùng họ đỏ nhạt `#fff4f2` / `#e3000f`.

Badge trạng thái nhiều mức (vd `statusClasses` trong `pc/page.tsx`): giữ pattern "mỗi trạng thái = 1 bộ `border/bg/text`", pill bo `rounded-full`.

---

## 2. Typography · Spacing · Radius · Shadow

### 2.1. Font
**Inter** (nạp qua `next/font/google` trong `src/app/layout.tsx`). Khi migrate, đặt `fontFamily.sans = ["Inter", ...]` trong `tailwind.config.ts` cho khớp.

### 2.2. Type scale

| Vai trò | Class |
|---|---|
| Tiêu đề trang (hero, đầu trang danh sách) | `text-2xl font-semibold text-[#191c1e]` *(≈24px; thay `text-[32px]` cũ để đồng bộ với dashboard)* |
| Số liệu KPI | `text-2xl font-semibold text-[#191c1e]` |
| Tiêu đề card / section | `text-base font-semibold text-[#191c1e]` |
| Body / nav item / input | `text-sm` |
| Caption / phụ đề | `text-xs text-[#5e3f3a]` |
| Overline (nhãn nhóm, thead) | `text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]` |

### 2.3. Spacing chuẩn

| Ngữ cảnh | Class |
|---|---|
| Padding `<main>` | `p-6 md:p-8 lg:p-10` |
| Padding card (nội dung) | `p-6` |
| Padding card (KPI) | `p-5` |
| Padding toolbar / filter bar | `p-4` |
| Ô bảng (cell) | `px-4 py-3` (danh sách gọn) hoặc `px-6 py-4` (danh sách thưa) |
| Button mặc định | `px-4 py-2` · nút header nhỏ `px-3 py-1.5 text-xs` |
| Khoảng cách khối trong trang | `space-y-6` |
| Khoảng cách nhóm KPI | `gap-4` / `gap-6` |

### 2.4. Bo góc (Radius) — thang **hoà trộn**

Không vuông cứng, không tròn mềm. Thang thống nhất:

| Cấp | Dùng cho |
|---|---|
| `rounded-xl` (12px) | **Card**, `<section>` bọc bảng, modal |
| `rounded-lg` (8px) | Button, input, ô search, nav item, ô nút pagination |
| `rounded-md` (6px) | Icon button, badge/tag nhỏ, ô icon KPI |
| `rounded-full` | Pill trạng thái, avatar, status dot, filter chip |

> ⚠️ `tailwind.config.ts` hiện ép `borderRadius` `lg/xl/full` = `0px`. **Phải bỏ override này** (mục 8) để thang trên có hiệu lực.

### 2.5. Đổ bóng
`shadow-sm` cho card & section. Modal dùng `shadow-xl`. Không dùng bóng nặng khác.

---

## 3. Layout Structure

Giữ nguyên khung thật của dự án (`(pc-manager)/layout.tsx` + `PcManagerSidebar.tsx`), diễn giải theo chuẩn dashboard.

```tsx
<div className="min-h-screen bg-[#f8fafc] text-[#191c1e]">
  <Sidebar />                                   {/* fixed, trái */}
  <div className="ml-[13.75rem] flex min-h-screen flex-col">
    <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-[1280px]">{children}</div>
    </main>
  </div>
</div>
```

- **Sidebar:** `fixed left-0 top-0 z-40 h-screen w-[13.75rem] (220px) flex flex-col border-r border-[#e0e3e5] bg-[#f7f9fb]`. Logo YEV = ô vuông `bg-[#e3000f] text-white`. Khối user đẩy xuống đáy bằng `mt-auto`.
- **Main:** vùng cuộn duy nhất, nội dung giới hạn `max-w-[1280px]` căn giữa.
- **Header (tuỳ chọn):** nếu trang cần thanh trên (breadcrumb + search + avatar) thì dùng `border-b border-[#e0e3e5] bg-white px-6 py-4`, đặt tĩnh trên đầu cột nội dung (không `fixed`).
- **Responsive:** nhóm KPI dùng `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`; bảng luôn bọc `overflow-x-auto`.

### 3.1. Nav item (sidebar)

Active = viền trái đỏ + nền xám nhạt; icon đổi sang đỏ khi active.

```tsx
<Link className={`flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-medium transition ${
  isActive
    ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
    : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
}`}>
  <Icon size={18} className={isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"} />
  <span>{label}</span>
</Link>
```

---

## 4. UI Components

### 4.1. Card & Stat (KPI) Card

```tsx
{/* Stat / KPI card */}
<div className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-[#5e3f3a]">Tổng thiết bị</p>
      <h2 className="mt-1 text-2xl font-semibold text-[#191c1e]">1,248</h2>
    </div>
    <div className="rounded-md bg-[#fff4f2] p-3 text-[#e3000f]"><Icon size={20} /></div>
  </div>
</div>

{/* Card nội dung */}
<div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <h3 className="mb-1 text-base font-semibold text-[#191c1e]">Tiêu đề card</h3>
      <p className="text-xs text-[#5e3f3a]">Mô tả phụ.</p>
    </div>
    <span className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">Badge</span>
  </div>
  {/* ...nội dung... */}
</div>
```

### 4.2. Button — 4 biến thể

Chung: `inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed`.

| Biến thể | Class nền/chữ |
|---|---|
| **Primary** | `bg-[#e3000f] text-white px-4 py-2 hover:bg-[#b40009]` |
| **Secondary / Outline** | `border border-[#e0e3e5] bg-white text-[#191c1e] px-3 py-2 hover:bg-[#f2f4f6]` |
| **Danger** | `bg-[#930006] text-white px-4 py-2 hover:bg-[#7a0005]` |
| **Icon** | `rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] hover:bg-[#f2f4f6]` |

Nút ở header trang dùng cỡ nhỏ: `px-3 py-1.5 text-xs`.

### 4.3. Input & Filter bar

Field chung:
```
h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e]
outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]
```

- **Filter đơn giản** (1 ô + nút tìm): toolbar `border-b border-[#e0e3e5] bg-[#f8fafc] p-4`, input `w-64`, nút "Tìm kiếm" = secondary.
- **Filter nâng cao** (`DeviceFilterBar`): mỗi field bọc `<label>` + overline; input/select có icon `lucide-react` tuyệt đối trái (`absolute left-3 top-1/2 -translate-y-1/2`, input thêm `pl-9`); nút "Bộ lọc nâng cao" có badge đếm `rounded-full bg-[#e3000f] text-white`; filter đang bật hiện dạng **chip** `rounded-full border bg-[#f8fafc]` kèm nút `X`.
- **Dữ liệu dropdown** (chi nhánh, loại thiết bị, NCC…) phải gọi API tương ứng trong `useEffect` (có cờ `isCancelled`), **không hard-code**.

### 4.4. Table

Kết hợp: thead in hoa của DESIGN_GUIDE + hàng mềm `hover` của dashboard.

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full border-collapse text-left text-sm">
    <thead>
      <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
        <th className="whitespace-nowrap px-4 py-3">Cột</th>
        <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
        <td className="px-4 py-3 align-top font-semibold text-[#191c1e]">...</td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex items-center gap-3">
            <button className="cursor-pointer font-semibold text-[#5e3f3a] hover:text-[#191c1e]">Sửa</button>
            <button className="cursor-pointer font-semibold text-[#930006] hover:text-[#e3000f]">Xoá</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

- Cột chính `font-semibold text-[#191c1e]`; cột phụ `text-[#5e3f3a]`; giá trị "tích cực" `text-emerald-600 font-semibold`.
- **Empty:** `<td colSpan={N} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có dữ liệu.</td>`
- **Loading skeleton:** `bg-[#f1f5f9] rounded animate-pulse`.

### 4.5. Pagination

```tsx
<div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
  <button className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50" disabled={!hasPreviousPage}>Trang trước</button>
  <div className="flex h-8 items-center rounded-lg px-3 text-sm font-semibold text-[#191c1e]">Trang {pageIndex} / {totalPages}</div>
  <button className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50" disabled={!hasNextPage}>Trang sau</button>
</div>
```

Nếu dùng nút số trang: trang hiện tại `bg-[#191c1e] text-white rounded-lg h-8 min-w-[32px]`, trang khác `text-[#5e3f3a] hover:bg-[#f2f4f6]`. Luôn dùng dữ liệu phân trang server-side.

### 4.6. Badge / Status pill

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Đang hoạt động
</span>
```
Chọn bộ `border/bg/text` theo ngữ nghĩa ở mục 1.3.

### 4.7. Modal / Popup form (tạo & sửa)

Một component dùng chung cho cả `create` và `edit` (props `mode` + `initial`).

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />
  <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
    <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
      <h3 className="text-lg font-semibold text-[#191c1e]">{mode === "create" ? "Thêm ..." : "Cập nhật ..."}</h3>
      <button onClick={onClose} className="cursor-pointer text-[#5e3f3a] hover:text-[#191c1e]">✕</button>
    </div>
    <form className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Nhãn</span>
        <input className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm ... focus:ring-2 focus:ring-[#ffe0e3]" />
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] hover:bg-[#f2f4f6]">Huỷ</button>
        <button type="submit" className="rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b40009]">Lưu</button>
      </div>
    </form>
  </div>
</div>
```

### 4.8. ConfirmDialog (dùng chung) & Toast

- Xoá / hành động nguy hiểm: **luôn** dùng `src/components/common/ConfirmDialog.tsx`, chỉ truyền `title/message/approveLabel/loading/onApprove/onDenied`. Không viết dialog riêng.
- Thông báo: **luôn** dùng `react-toastify` (`ToastContainer` đã đặt ở `layout.tsx`): `toast.success(...)` / `toast.error(...)`. Mọi create/update/delete phải có toast thành công + toast lỗi (kèm `console.error`).

---

## 5. Blueprint trang danh sách (CRUD)

Thứ tự khối cố định:

```
Header (title + mô tả + [Làm mới] [+ Thêm mới])
└─ <section rounded-xl border shadow-sm>
   ├─ Toolbar / Filter bar (search + info "Hiển thị X / Y bản ghi")
   ├─ Error bar (nếu có)
   ├─ Table (thead + rows + empty state)
   └─ Pagination
+ Modal form dùng chung (create/edit)
+ ConfirmDialog dùng chung (delete)
+ toast cho mọi thao tác
```

Ví dụ chuẩn: `BranchList` + `BranchForm`, `DeviceTypeList` + `DeviceTypeForm`.

---

## 6. Icon
- Trang phức tạp / có filter: dùng `lucide-react` (`h-3.5 w-3.5` cho label, `h-4 w-4` trong input/nút).
- Nút header đơn giản có thể dùng ký tự Unicode (`↻`, `+`, `⤴`, `📊`).
- Không trộn 2 kiểu icon trong cùng một khối.

---

## 7. Ngôn ngữ nội dung
Toàn bộ text tiếng Việt, câu ngắn gọn nhất quán: "Hiển thị X / Y bản ghi", "Không có dữ liệu …", "Đang tải dữ liệu…", "… thành công" / "… thất bại".

---

## 8. Migration notes (khi áp dụng hệ mới lên code cũ)

1. **`tailwind.config.ts`** — bỏ block ép `borderRadius` về `0px` (khôi phục thang mặc định của Tailwind) để `rounded-lg/xl/full` hoạt động; đổi `fontFamily.sans` sang `["Inter", "Arial", "sans-serif"]`.
2. **Bỏ indigo** ở mọi nơi (dashboard cũ) → thay bằng đỏ nhạt `#fff4f2` / `#e3000f`.
3. **Thêm bo góc + `shadow-sm`** cho `<section>`/card đang vuông (các trang `pc-management` hiện tại: Branch, DeviceType, Device… ) theo thang mục 2.4.
4. Chuẩn hoá **primary = `#e3000f`**, **danger = `#930006`** (đừng để cả hai trùng đỏ `#e3000f`).
5. Cân nhắc rút các mảnh lặp (button, input, card, table row) thành component dùng chung sau khi thống nhất style.

---

## 9. Checklist khi làm màn hình mới
- [ ] Khung: sidebar `w-[13.75rem]` + `<main>` cuộn `max-w-[1280px] mx-auto`.
- [ ] Màu: primary `#e3000f`, nền `#f8fafc`, chữ `#191c1e`/`#5e3f3a`, viền `#e0e3e5`, danger `#930006`. **Không indigo.**
- [ ] Card/section: `rounded-xl border border-[#e0e3e5] bg-white shadow-sm`.
- [ ] Button đúng 4 biến thể (mục 4.2); input field chuẩn (mục 4.3).
- [ ] CRUD list đủ: header → filter → error bar → table → pagination.
- [ ] 1 modal form dùng chung create/edit; xoá dùng `ConfirmDialog`; thông báo dùng `toast`.
- [ ] Dropdown lấy từ API, không hard-code.
- [ ] Text tiếng Việt, đúng thang typography & spacing.
