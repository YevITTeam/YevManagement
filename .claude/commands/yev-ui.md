---
description: Làm hoặc sửa UI trong yev-frontend theo DESIGN_SYSTEM.md của dự án (audit, làm, tự kiểm)
argument-hint: <việc cần làm, vd "sửa tab Cấu hình" hoặc "dựng màn danh sách X">
---

Việc cần làm: $ARGUMENTS

Nếu phần "Việc cần làm" ở trên trống thì hỏi đúng 1 câu: làm màn nào, sửa gì — rồi dừng.

Nguồn chân lý UI của dự án là **`docs/docs-fe/DESIGN_SYSTEM.md`**, không phải skill nào bên ngoài.
Lệnh này chỉ ép đi đúng thứ tự — **không chép lại luật** (một luật một chỗ), luật nằm trong doc.

## Trước khi viết dòng code nào

1. **Đọc `docs/docs-fe/DESIGN_SYSTEM.md` cả file** (~33 KB, đọc trọn được — AGENTS.md §2 luật 7).
2. **Màu = arbitrary hex theo `DESIGN_SYSTEM.md` §1** (`bg-[#e3000f]`, `text-[#191c1e]`…). `tailwind.config.ts` có khai token (`brand-red`, `surface`…) nhưng dự án chạy **Tailwind v4 không có `@config`**, nên
   các class token đó **không sinh CSS** — đừng dùng chúng, đừng "khôi phục" chúng. Không đổi bảng màu, không thêm token/font/thang spacing mới.
3. **Tìm component có sẵn trước khi dựng mới**: `yev-frontend/src/components/ui/`,
   `yev-frontend/src/components/common/`. Đã có thì dùng, chỉ tạo mới khi thật sự chưa có.
4. Màn danh sách CRUD → **theo blueprint `§5`**, đừng vẽ bố cục mới. Khuôn mẫu code:
   `yev-frontend/src/modules/pc-management/components/branches/` (AGENTS.md §4.5).

Báo một dòng kết quả audit trước khi đi tiếp, ví dụ:
> Audit: màu hex theo DESIGN_SYSTEM §1 (token tailwind.config không hoạt động ở Tailwind v4); đã có `SearchableSelect`, `TimePicker24h`; màn CRUD → blueprint §5.

Rồi làm tiếp mục **"Gọi `evon:ui-ux`"** bên dưới — kết quả audit này chính là thứ điền vào ràng buộc truyền cho skill.

## Luật hay bị phạm — tra đúng mục, không đoán

| Việc | Mục trong DESIGN_SYSTEM.md |
|---|---|
| Nút rộng vừa chữ, không `w-full`/ô grid chia đều | §4.2 |
| Bề rộng ô nhập theo dữ liệu; nhập giờ dùng `TimePicker24h`, không `<input type="time">` | §4.3 |
| Nhãn ngắn, không `truncate`, giải thích dài vào `title`, bỏ mô tả thì xoá key ở cả 2 file i18n | §4.10 |
| Icon `lucide-react`, không emoji/ký tự Unicode | §6 |
| Checklist trước khi báo xong | §9 |

## Gọi `evon:ui-ux` — làm ngay sau audit, trước khi code

Gọi skill `evon:ui-ux` bằng Skill tool, `args` = việc cần làm + khối ràng buộc dưới đây (điền phần trong `<>`).
Khối này phải đi kèm vì skill đó tự audit `globals.css` — file gần như trống, không khai token màu — và sẽ tự chọn token/màu riêng nếu không được báo.

```
<việc cần làm>

Ràng buộc của dự án — ưu tiên hơn mọi mặc định của skill:
- Design system là docs/docs-fe/DESIGN_SYSTEM.md (đã đọc). Lệch thì DESIGN_SYSTEM.md thắng.
- Audit đã chạy xong, đừng áp token của skill. Màu của dự án là hex trực tiếp trong class (bg-[#e3000f], text-[#191c1e],
  border-[#e0e3e5]… — bảng ở DESIGN_SYSTEM.md §1); KHÔNG dùng class token như bg-brand-red/text-muted vì Tailwind v4
  ở đây không nạp tailwind.config.ts. Font Inter. Không thêm token, font, thang spacing mới.
- Dùng component có sẵn ở yev-frontend/src/components/ui và common: <liệt kê cái liên quan đã tìm thấy>.
- Text hiển thị tiếng Việt; comment code tiếng Anh, ngắn, mô tả hành vi hiện tại.
- Chỉ lo giao diện, không viết logic gọi API (AGENTS.md §4.3).
<nếu là màn danh sách CRUD đã có blueprint §5: thêm dòng "dựng luôn, không cần wireframe">
```

- Đề kiểu "xem giúp / review" → để skill chạy nhánh soi UI: chỉ trả bảng trước/sau, **chưa sửa** tới khi người dùng chọn dòng.
- Skill không có trong danh sách (máy khác chưa cài plugin evon) → bỏ bước này, tự làm theo `DESIGN_SYSTEM.md`.
- Skill đề xuất hoặc dựng xong thì đối chiếu lại với `DESIGN_SYSTEM.md` §9; chỗ lệch **sửa theo doc**.
- Ý hay từ skill mà doc chưa có → thêm vào `DESIGN_SYSTEM.md` (AGENTS.md §2 luật 4), đừng chỉ áp dụng một lần rồi để mất.

## Khi xong

- Chạy tại `yev-frontend/`: `npx tsc --noEmit` sạch; `pnpm lint` không thêm cảnh báo mới.
- Text mới → thêm key vào **cả** `messages/vi.json` và `messages/ja.json`, cấu trúc giống hệt (AGENTS.md §4.6).
- Comment trong code: **tiếng Anh, ngắn, mô tả hành vi hiện tại** — không nhật ký, không ngày tháng.
- Đụng tới màn nào thì sửa luôn lỗi ô/nút rộng quá nội dung và chữ mô tả thừa ở màn đó; không đi quét sửa hàng loạt.
- Phần UI vừa làm có luật mới → cập nhật `DESIGN_SYSTEM.md`, đừng để luật chỉ nằm trong đầu phiên.
