# Dashboard UI Guidelines

> Tiêu chuẩn thiết kế giao diện (UI) cho khu vực **Dashboard / Admin / Tenant** của dự án `sep-web-business-customer`.
> Tài liệu này chỉ mô tả **cấu trúc HTML, class CSS (Tailwind) và bố cục UI** — không đề cập tới logic xử lý dữ liệu, API hay state.
>
> **Stack:** Next.js 16 (App Router) · React 19 · **Tailwind CSS v4** · `lucide-react` (icon) · font **Inter**.

---

## 1. Color Palette

Hệ màu được chia làm 2 tầng: **Brand tokens** (dùng CSS variables, chủ yếu cho trang public/marketing) và **Dashboard palette** (dùng trực tiếp utility class của Tailwind — đây là hệ màu chính của khu vực dashboard).

### 1.1. Brand Tokens (`src/app/globals.css`)

Khai báo dưới dạng **kênh RGB cách nhau bởi khoảng trắng** để hỗ trợ alpha (`/0.4`).

```css
:root {
  --color-primary:      6 95 70;      /* #065F46 – Xanh emerald đậm (brand chính) */
  --color-secondary:    246 243 236;  /* #F6F3EC – Kem / be (nền nhạt) */
  --color-accent:       16 185 129;   /* #10B981 – Emerald 500 (nhấn) */
  --color-accent-dark:  4 120 87;     /* #047857 – Emerald 700 (hover) */
  --color-accent-light: 236 253 245;  /* #ECFDF5 – Emerald 50 (nền nhấn) */
}
```

**Cách dùng trong JSX:**

```tsx
className="text-[rgb(var(--color-primary))]"          // chữ màu brand
className="bg-[rgb(var(--color-accent))]"             // nền nhấn
className="bg-[rgb(var(--color-primary)/0.4)]"        // brand + alpha 40%
className="border-[rgb(var(--color-primary)/0.15)]"   // viền brand mờ
```

### 1.2. Dashboard Palette (Slate + Emerald + Indigo)

Khu vực dashboard **không** dùng brand token mà dùng thang màu Tailwind theo vai trò:

| Vai trò | Class chính | Mã màu | Ghi chú |
|---|---|---|---|
| **App background** | `bg-slate-50` | `#F8FAFC` | Nền tổng của layout |
| **Surface / Card** | `bg-white` | `#FFFFFF` | Nền card, header, sidebar |
| **Border** | `border-slate-200` · `border` | `#E2E8F0` | Viền card, đường phân cách |
| **Text – Heading** | `text-slate-900` | `#0F172A` | Tiêu đề, số liệu |
| **Text – Body** | `text-slate-600` / `text-slate-700` | `#475569` / `#334155` | Nội dung, nhãn |
| **Text – Muted** | `text-slate-400` / `text-slate-500` / `text-gray-500` | `#94A3B8` / `#64748B` | Phụ đề, placeholder |
| **Primary / Success (action)** | `bg-emerald-600` → hover `bg-emerald-700` | `#059669` / `#047857` | Nút chính, giá trị dương |
| **Positive value** | `text-emerald-600` | `#059669` | Doanh thu, trạng thái tốt |
| **Status dot (online)** | `bg-emerald-500` | `#10B981` | Chấm "Đang hoạt động" |
| **Accent (avatar / link / focus / active page)** | `indigo-50` `indigo-100` `indigo-600` | `#EEF2FF` `#E0E7FF` `#4F46E5` | Avatar chữ cái, link "Xem chi tiết", focus ring, ô input active |
| **Active nav item** | `bg-slate-100 text-slate-900` | | Mục đang chọn ở sidebar |
| **Active pagination** | `bg-slate-900 text-white` | | Trang hiện tại |
| **Danger** | `bg-red-600` → hover `bg-red-700` · `bg-red-50 text-red-700` | `#DC2626` | Xoá, đăng xuất |

**Quy tắc màu:**
- Nền trung tính (`slate`), hành động chính & giá trị tích cực dùng **emerald**, điểm nhấn tương tác (avatar, link, focus) dùng **indigo**, cảnh báo/xoá dùng **red**.
- Ưu tiên chuyển màu có `transition-colors` khi hover.

---

## 2. Typography & Spacing

### 2.1. Font

- **Font family:** `Inter` — nạp qua `next/font/google` trong `src/app/layout.tsx`, gán vào `<body>` qua biến `--font-inter`.

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// <body className={inter.variable}>
```

### 2.2. Thang chữ (Type scale)

| Vai trò | Class | Ví dụ |
|---|---|---|
| Số liệu lớn (stat) | `text-2xl font-semibold` / `text-2xl font-bold` | Giá trị KPI |
| Tiêu đề trang (header) | `text-lg font-semibold text-slate-900` | "Tổng quan" |
| Tiêu đề card | `text-base font-semibold text-slate-900` | "Top 10 tenant" |
| Nhãn / body | `text-sm` | Nav item, ô nhập |
| Phụ đề / caption | `text-xs text-slate-500` | Mô tả dưới tiêu đề |
| Overline (nhãn nhóm) | `text-xs font-semibold uppercase tracking-wide text-slate-400` | Nhóm sidebar, breadcrumb |

### 2.3. Spacing chuẩn

| Ngữ cảnh | Class | Giá trị |
|---|---|---|
| Padding vùng nội dung `<main>` | `p-8` | 32px |
| Padding header | `px-6 py-4` | 24 / 16px |
| Padding sidebar | `px-4 py-5` | 16 / 20px |
| Padding card (stat) | `p-5` | 20px |
| Padding card (nội dung) | `p-6` | 24px |
| Ô của bảng (cell) | `py-4` | 16px |
| Nút (button) | `px-4 py-2` (mặc định) | 16 / 8px |
| Khoảng cách nhóm KPI | `gap-6` | 24px |
| Khoảng cách nhóm sidebar | `space-y-6` (nhóm) / `space-y-1` (item) | 24 / 4px |

**Bo góc (Radius) — thang thống nhất:**
- `rounded-2xl` (16px) → **Card** (stat card, content card)
- `rounded-xl` (12px) → nav item, icon button, badge input, ô search
- `rounded-lg` (8px) → button, ô nút pagination, input nhỏ
- `rounded-full` → badge pill, avatar, status dot

**Đổ bóng:** dùng nhẹ, thống nhất `shadow-sm` cho card. Chỉ dùng `shadow-lg shadow-emerald-200` cho điểm nhấn nổi bật (nút CTA đặc biệt).

---

## 3. Layout Structure

Bố cục dashboard theo mẫu **Sidebar cố định + Cột nội dung cuộn** (nguồn: `AdminLayoutClientProps.tsx`).

```tsx
<div className="flex min-h-screen bg-slate-50">
  <Sidebar />                                {/* cột trái, sticky */}
  <div className="flex-1 flex flex-col">     {/* cột phải */}
    <Header />                               {/* thanh trên, tĩnh */}
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">{children}</div>
    </main>
  </div>
</div>
```

### 3.1. Sidebar

- Thẻ `<aside>`: `sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-all`.
- **Chiều rộng:** `w-72` (**288px**) khi mở, `w-20` (**80px**) khi thu gọn — toggle bằng state, có `transition-all`.
- **Sticky** `top-0`, cao `h-screen`, `shrink-0` (không co).
- Cấu trúc: **Logo/tiêu đề** → `<nav className="flex-1 space-y-6">` (các nhóm) → khối **Đăng xuất** đẩy xuống đáy bằng `mt-auto`.
- Nhóm nav có overline `text-xs uppercase tracking-wide text-slate-400`; mỗi item là `<Link>` dạng `flex items-center gap-3 rounded-xl px-3 py-2 text-sm`.
- **Trạng thái active:** `bg-slate-100 text-slate-900`; mặc định `text-slate-600 hover:bg-slate-100`.

### 3.2. Header

- Thẻ `<header>`: `border-b border-slate-200 bg-white px-6 py-4` — **tĩnh** (không `fixed`/`sticky`), nằm trên cùng cột nội dung.
- Hàng ngang `flex flex-wrap items-center gap-4`: cụm **breadcrumb/tiêu đề** (min-w-[200px]) · **ô tìm kiếm** (`flex-1`, `max-w-md`) · cụm **hành động** (trạng thái, chuông, avatar).
- *(Lưu ý: một số header khác trong app dùng `sticky top-0 z-50` — với dashboard, header đứng yên và `<main>` là vùng cuộn.)*

### 3.3. Vùng nội dung & Responsive

- `<main className="flex-1 p-8 overflow-y-auto">` là **vùng cuộn** (scroll container); nội dung giới hạn `max-w-7xl` (**1280px**) và căn giữa `mx-auto`.
- **Responsive:** dùng grid có breakpoint cho nhóm thẻ:
  ```tsx
  grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4
  ```
  Bảng luôn bọc trong `overflow-x-auto` để cuộn ngang trên màn hình nhỏ. Sidebar có thể thu gọn (`w-20`) để nhường không gian.

---

## 4. UI Components

### 4.1. Card

**Quy tắc:** nền `bg-white`, bo `rounded-2xl`, viền `border` + `shadow-sm`. Card KPI dùng `p-5`, card nội dung dùng `p-6`. Icon KPI đặt trong ô `p-3 bg-indigo-50 rounded-xl text-indigo-600`.

```tsx
{/* Stat Card */}
<div className="bg-white p-5 rounded-2xl shadow-sm border">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm text-gray-500">Tổng tenant</p>
      <h2 className="text-2xl font-semibold mt-1 text-slate-900">1,248</h2>
    </div>
    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Icon size={20} /></div>
  </div>
</div>
```

Card nội dung (có tiêu đề + badge):

```tsx
<div className="bg-white p-6 rounded-2xl border shadow-sm">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">Top 10 tenant</h3>
      <p className="text-xs text-slate-500">Tổng doanh thu theo tenant</p>
    </div>
    <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium border border-slate-200">
      Xếp hạng
    </span>
  </div>
  {/* ...nội dung... */}
</div>
```

### 4.2. Table

**Quy tắc:** bọc `overflow-x-auto`; `table w-full text-sm`; `thead` in hoa nhỏ `text-xs font-medium uppercase tracking-wide text-slate-500`; hàng phân cách bằng `border-t`, hover `hover:bg-slate-50`; ô `py-4`; căn `text-left/center/right` theo kiểu dữ liệu; giá trị dương tô `text-emerald-600 font-semibold`.

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
      <tr>
        <th className="text-left pb-3">Tenant</th>
        <th className="text-right pb-3">Doanh thu</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-t hover:bg-slate-50 cursor-pointer transition-colors">
        <td className="py-4 font-medium text-slate-800">Nhà hàng A</td>
        <td className="py-4 text-right font-semibold text-emerald-600">12.000.000 ₫</td>
      </tr>
    </tbody>
  </table>
</div>
```

- **Empty state:** `<div className="py-8 text-center text-gray-400">Chưa có dữ liệu</div>`
- **Loading skeleton:** thanh xám `bg-gray-100 rounded animate-pulse`.
- **Phân trang:** dùng component `TablePagination` — nút trang bo `rounded-lg h-8 min-w-[32px]`, trang hiện tại `bg-slate-900 text-white shadow-sm`, trang khác `text-slate-600 hover:bg-slate-100`.

### 4.3. Button

**Quy tắc chung:** `inline-flex items-center gap-2`, `text-sm font-medium`, bo `rounded-lg` (hoặc `rounded-xl`), có `transition`, trạng thái disabled `disabled:opacity-50 disabled:cursor-not-allowed`.

```tsx
{/* Primary (hành động chính) */}
<button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-emerald-700 disabled:opacity-50">
  Lưu
</button>

{/* Secondary / Outline */}
<button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white
                   px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
  Quay lại
</button>

{/* Danger */}
<button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
  Xoá
</button>

{/* Icon button */}
<button className="flex items-center justify-center rounded-xl border border-slate-200 p-2
                   text-slate-600 hover:bg-slate-50" aria-label="Thông báo">
  <Bell className="h-4 w-4" />
</button>
```

| Biến thể | Nền | Chữ | Hover |
|---|---|---|---|
| Primary | `bg-emerald-600` | `text-white` | `bg-emerald-700` |
| Secondary | `bg-white border-slate-200` | `text-slate-700` | `bg-slate-50` |
| Danger | `bg-red-600` | `text-white` | `bg-red-700` |
| Ghost/Icon | trong suốt / `border-slate-200` | `text-slate-600` | `bg-slate-50` / `bg-slate-100` |

---

## 5. Checklist áp dụng cho dự án khác

- [ ] Copy 5 biến `--color-*` vào `globals.css`; import `tailwindcss`.
- [ ] Nạp font **Inter** qua `next/font`, gán biến vào `<body>`.
- [ ] Dùng khung layout `flex min-h-screen bg-slate-50` + sidebar `w-72/w-20` sticky + `<main>` `overflow-y-auto p-8` với `max-w-7xl mx-auto`.
- [ ] Card: `bg-white rounded-2xl border shadow-sm p-5/p-6`.
- [ ] Bảng: bọc `overflow-x-auto`, header `uppercase text-xs text-slate-500`, hàng `border-t hover:bg-slate-50`.
- [ ] Button theo 4 biến thể ở mục 4.3.
- [ ] Màu: nền `slate`, hành động chính `emerald-600`, điểm nhấn `indigo`, cảnh báo `red`.
- [ ] Bo góc & spacing bám thang ở mục 2.3.
