# Ngôn ngữ thiết kế – Module PC Management

Tài liệu này mô tả style hiện đang dùng ở trang `src/app/(pc-manager)/pc/page.tsx` (trang Quản lý Thiết bị) và các component liên quan (`DeviceFilterBar`, `BranchList`, `BranchForm`). Khi làm giao diện mới trong module `pc-management` (hoặc bất kỳ trang admin nào muốn đồng bộ), hãy bám theo các quy tắc dưới đây thay vì tự sáng tạo màu/spacing mới.

Đặc điểm cốt lõi: **không dùng bộ `src/components/ui/*` (Card/Button/Input/Table)** cho các trang này — style dùng class Tailwind thuần với mã màu hex cố định, giữ giao diện vuông vức (không bo góc), phẳng, nhiều đường viền mảnh.

## 1. Bảng màu

Định nghĩa ở `tailwind.config.ts`, nhưng trong code thường viết trực tiếp bằng arbitrary value (`text-[#191c1e]`) thay vì tên class (`text-brand-black`) — **giữ nguyên cách viết hex trực tiếp** để nhất quán với code hiện có.

| Vai trò | Hex | Class ví dụ |
|---|---|---|
| Chữ tiêu đề / chữ chính | `#191c1e` | `text-[#191c1e]` |
| Chữ phụ / mô tả / label | `#5e3f3a` | `text-[#5e3f3a]` |
| Viền mặc định | `#e0e3e5` | `border-[#e0e3e5]` |
| Viền hàng trong bảng (nhạt hơn) | `#f1f5f9` | `border-[#f1f5f9]` |
| Nền phụ (header bảng, filter bar, thead) | `#f8fafc` | `bg-[#f8fafc]` |
| Nền hover cho hàng/nút | `#f2f4f6` | `hover:bg-[#f2f4f6]` |
| Primary / hành động chính (nút đỏ) | `#e3000f` | `bg-[#e3000f]` |
| Primary hover | `#b40009` | `hover:bg-[#b40009]` |
| Trạng thái lỗi – nền | `#fff4f2` | `bg-[#fff4f2]` |
| Trạng thái lỗi – viền | `#e9bcb6` | `border-[#e9bcb6]` |
| Trạng thái lỗi – chữ | `#930006` | `text-[#930006]` |
| Focus ring (input) | `#ffe0e3` | `ring-[#ffe0e3]` |

Các cặp màu badge trạng thái thiết bị (`statusClasses` trong `pc/page.tsx`) là ví dụ cho pattern "nhiều trạng thái, mỗi trạng thái 1 cặp border/bg/text" — copy pattern này khi cần badge trạng thái ở trang khác, không cần sáng tạo bảng màu mới.

## 2. Bo góc & shadow

- **Không bo góc**: `tailwind.config.ts` đã override `borderRadius` về `0px` cho `DEFAULT/lg/xl/full`. Do đó mọi khối UI (section, button, input, badge, modal) đều vuông góc. Không thêm `rounded-*` thủ công trừ khi cố ý phá cách.
- Không dùng shadow nặng. `section` bọc bảng chỉ dùng border, không có `shadow`.

## 3. Bố cục trang danh sách (list page)

Cấu trúc chuẩn của một trang danh sách (xem `pc/page.tsx`, `BranchList.tsx`):

```tsx
<div className="space-y-8">
  {/* Header: tiêu đề + mô tả + action buttons */}
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-[32px] font-semibold text-[#191c1e]">Tiêu đề trang</h1>
      <p className="mt-1 text-[15px] text-[#5e3f3a]">Mô tả ngắn gọn chức năng trang.</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {/* nút phụ (secondary) */}
      <button className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
        ↻ Làm mới
      </button>
      {/* nút chính (primary) */}
      <button className="cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]">
        + Thêm mới
      </button>
    </div>
  </div>

  {/* Khối nội dung chính: filter bar + bảng + pagination, cùng 1 section border-only */}
  <section className="overflow-hidden border border-[#e0e3e5] bg-white">
    ...
  </section>
</div>
```

Ghi chú:
- `space-y-8` giữa header và section chính.
- Nút hành động ở header dùng `px-3 py-1.5 text-xs` (nhỏ hơn nút trong modal, vốn dùng `px-4 py-2 text-sm`).
- Icon trong nút header là ký tự Unicode đơn giản (`↻`, `+`, `📊`, `⤴`) hoặc icon `lucide-react` (dùng ở `DeviceFilterBar`) — chọn 1 kiểu nhất quán cho từng trang, không trộn lẫn tuỳ tiện.

## 4. Thanh lọc / tìm kiếm (filter bar)

Có 2 mức độ:

**Đơn giản** (1 ô input + nút tìm kiếm), dùng khi chỉ cần lọc theo từ khoá — xem `BranchList.tsx`:

```tsx
<div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
  <div className="flex gap-2">
    <input
      className="h-10 w-64 border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
      placeholder="Tìm theo ..."
    />
    <button className="cursor-pointer h-10 border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
      Tìm kiếm
    </button>
  </div>
  <div className="text-sm text-[#5e3f3a]">Hiển thị {n} / {total} bản ghi</div>
</div>
```

**Nâng cao** (nhiều field + advanced toggle + filter chips), dùng khi có nhiều tiêu chí lọc — xem `DeviceFilterBar.tsx`. Các quy tắc:
- Mỗi field bọc trong `<label>`, có `span` label uppercase nhỏ ở trên:
  `mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]`
- Input/select có icon `lucide-react` đặt tuyệt đối bên trái (`absolute left-3 top-1/2 -translate-y-1/2`), input thêm `pl-9`.
- Class field dùng chung: `h-10 w-full border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]`.
- Nút "Bộ lọc nâng cao" có badge đếm số filter đang bật: `bg-[#e3000f] text-white` hình tròn nhỏ.
- Danh sách filter đang áp dụng hiển thị dạng "chip" bo tròn nhẹ (đây là ngoại lệ được phép bo góc `rounded-full` vì là chip, không phải khối UI chính) kèm nút X để xoá riêng từng filter.
- Dữ liệu cho các dropdown (vd. danh sách chi nhánh) phải lấy từ API tương ứng (`BranchApi.getAllBranches()`), **không hard-code** danh sách tĩnh.

Lấy dữ liệu cho dropdown trong `useEffect` khi mount, có cờ `isCancelled` để tránh set-state sau khi unmount — xem ví dụ trong `DeviceFilterBar.tsx`.

## 5. Bảng dữ liệu (table)

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full border-collapse text-left">
    <thead>
      <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
        <th className="whitespace-nowrap px-4 py-3">Cột</th>
        <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody>
      {/* dòng rỗng */}
      <tr>
        <td colSpan={N} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có dữ liệu.</td>
      </tr>
      {/* dòng dữ liệu */}
      <tr className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
        <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[#191c1e]">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

Quy tắc:
- Dùng bảng gộp `border-collapse`, không dùng `border-spacing`.
- `thead` luôn nền `#f8fafc`, chữ uppercase, tracking rộng (`tracking-[0.15em]` hoặc `[0.2em]`), màu `#5e3f3a`.
- Mỗi hàng dữ liệu: `border-b border-[#f1f5f9] hover:bg-[#f8fafc]`.
- Cột giá trị chính (mã, tên...) dùng `font-semibold text-[#191c1e]`; cột phụ dùng `text-[#5e3f3a]`.
- Nhiều dòng dữ liệu (2 dòng con trong 1 ô, vd mã + tên) thì `td` thêm `align-top`.
- Cột "Thao tác" luôn ở cuối, `text-right`. Nút hành động text-only (`Sửa` / `Xoá`) với màu tương ứng (`text-[#5e3f3a] hover:text-[#191c1e]` cho sửa, `text-[#930006] hover:text-[#e3000f]` cho xoá) — đơn giản hơn so với icon button.
- Ô rỗng khi `!isLoading && data.length === 0`.

## 6. Phân trang (pagination)

```tsx
<div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
  <button className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50" disabled={!hasPreviousPage}>
    Trang trước
  </button>
  <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
    Trang {pageIndex} / {totalPages}
  </div>
  <button className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50" disabled={!hasNextPage}>
    Trang sau
  </button>
</div>
```

Luôn dùng dữ liệu phân trang server-side trả về từ API (`pageIndex`, `totalPages`, `hasNextPage`, `hasPreviousPage`, `totalCount`) — không tự tính lại ở client.

## 7. Trạng thái tải / lỗi

- Loading: thay nội dung dòng đếm bằng `"Đang tải dữ liệu..."`, không dùng spinner riêng cho các trang danh sách đơn giản.
- Error: 1 dải ngang ngay dưới filter bar, phía trên bảng:
  ```tsx
  <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
  ```

## 8. Modal / Popup (tạo / sửa)

Dùng chung 1 cấu trúc overlay cho mọi popup form — xem `BranchForm.tsx`:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />
  <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md border border-[#e0e3e5] bg-white p-6 shadow-xl">
    <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
      <h3 className="text-lg font-semibold text-[#191c1e]">Tiêu đề</h3>
      <button onClick={onClose} className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]">✕</button>
    </div>
    <form className="space-y-4">
      {/* fields */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="cursor-pointer border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">Huỷ</button>
        <button type="submit" className="cursor-pointer bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]">Lưu</button>
      </div>
    </form>
  </div>
</div>
```

Label field trong form: `mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]`.
Input trong form: cùng class field như filter bar (`h-10 w-full border border-[#e0e3e5] ...`).

Modal luôn nhận `mode: "create" | "edit"` + `initial` để dùng chung 1 component cho cả tạo và sửa (không tách 2 component riêng).

## 9. Xác nhận hành động nguy hiểm (xoá...)

**Luôn dùng chung** `src/components/common/ConfirmDialog.tsx`, không viết dialog xác nhận riêng cho từng trang. Chỉ truyền props:

```tsx
<ConfirmDialog
  isOpen={deletingItem !== null}
  title="Xoá ..."
  message={<>Bạn có chắc muốn xoá <strong>{deletingItem?.name}</strong> không? Hành động này không thể hoàn tác.</>}
  approveLabel="Xoá"
  deniedLabel="Huỷ"
  loading={isDeleting}
  onApprove={handleDelete}
  onDenied={() => !isDeleting && setDeletingItem(null)}
/>
```

## 10. Thông báo (toast)

Dùng `react-toastify` (`ToastContainer` đã đặt sẵn ở `src/app/layout.tsx`). Gọi trực tiếp, không tự viết toast component khác:

```tsx
import { toast } from "react-toastify";

toast.success("Tạo ... thành công");
toast.error("... thất bại");
```

Quy tắc: mọi thao tác create/update/delete đều phải có toast success khi xong và toast error khi catch lỗi (kèm `console.error(err)` để debug).

## 11. Icon

- Trang có nhiều field lọc phức tạp (`DeviceFilterBar`) dùng icon từ `lucide-react` (`h-3.5 w-3.5` cho label, `h-4 w-4` cho icon trong input/button).
- Trang danh sách đơn giản có thể dùng ký tự Unicode cho nút header (`↻`, `+`, `⤴`, `📊`) thay vì import icon.
- Không trộn 2 kiểu icon trong cùng 1 khối UI.

## 12. Quy tắc chung khi thêm trang/màn hình mới

1. Không dùng `src/components/ui/{Card,Button,Input,Table}.tsx` cho các trang thuộc "phong cách vuông" này — viết class Tailwind trực tiếp theo mã màu ở mục 1.
2. Không thêm `rounded-*` cho khối chính (section/button/input/modal). Chip lọc là ngoại lệ duy nhất.
3. Dữ liệu dropdown/lọc liên quan đến entity khác (chi nhánh, loại thiết bị, nhà cung cấp...) phải gọi API tương ứng, không hard-code.
4. CRUD list page cần đủ: filter bar → info bar (đếm bản ghi) → error bar (nếu có) → table → pagination.
5. 1 modal form dùng chung cho create/edit; xoá dùng chung `ConfirmDialog`; thông báo dùng chung `toast`.
6. Toàn bộ text hiển thị dùng tiếng Việt, style câu ngắn gọn giống các trang hiện có (vd: "Hiển thị X / Y bản ghi", "Không có dữ liệu ...").
