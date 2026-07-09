# CLAUDE.md

Hướng dẫn cho AI agent (Claude Code) khi làm việc trong repo này. Đọc file này
trước khi bắt tay vào bất kỳ task nào. Ngôn ngữ giao tiếp & nội dung UI: **tiếng Việt**.

## Dự án là gì

`yev-frontend` — FE cho hệ thống quản lý nội bộ **YEV Management**. Trọng tâm hiện tại
là module **Quản lý PC/Thiết bị** (`pc-management`) gọi sang BE (.NET, module Asset).

**Tech stack:** Next.js 16 (App Router) · React 19 (React Compiler bật sẵn) · TypeScript
strict · Tailwind CSS v4 · react-toastify · lucide-react. **Không** dùng thư viện
data-fetching/state (React Query, Redux…) — chỉ `fetch` wrapper thủ công + `useState`/`useEffect`.

## Lệnh thường dùng

```bash
npm run dev      # chạy dev (Next dev server)
npm run build    # build production
npm run lint     # eslint
npx tsc --noEmit # typecheck — CHẠY SAU MỖI THAY ĐỔI .ts/.tsx trước khi báo xong
```

> Sau khi sửa code TypeScript, luôn chạy `npx tsc --noEmit` để xác nhận không vỡ kiểu.
> Repo dùng `strict: true`, path alias `@/*` → `src/*`.

## Kiến trúc & tổ chức thư mục

```
src/
├─ app/                      # Next App Router. Route groups: (admin), (pc-manager)
│  ├─ layout.tsx             # root: Header + ToastContainer (đã mount sẵn toàn cục)
│  └─ (pc-manager)/pc/<x>/page.tsx   # mỗi page CHỈ là wrapper mỏng render 1 component List
├─ components/               # UI dùng chung (ui/Button, Card, Input, Table; common/ConfirmDialog)
├─ lib/
│  ├─ client.ts              # fetch wrapper `api.get/post/put/delete` + auth token + auto re-login 401
│  └─ apiError.ts            # getApiErrorMessage(err, fallback) — bóc message tiếng Việt từ BE
├─ types/api.ts              # ApiResponse<T> & ApiResponseWithPageNation<T> (envelope dùng chung)
└─ modules/<module>/         # tách theo domain: auth, pc-management, common
   ├─ api/<entity>.api.ts    # 1 file / entity — CHỈ khai báo endpoint + hàm gọi HTTP
   ├─ types/<entity>.dto.ts  # 1 file / entity — TypeScript interface khớp schema BE
   └─ components/            # UI tiêu thụ API (List + Form + dialog…)
```

**Nguyên tắc phân tầng (bắt buộc giữ):**
- Component **không bao giờ** tự `fetch` — luôn gọi qua object `XxxApi`.
- File `*.api.ts` **không** chứa logic UI/state.
- Mỗi entity BE ↔ đúng 1 file `*.api.ts` + 1 file `*.dto.ts`.
- Page trong `app/` chỉ import & render component List tương ứng, không đặt logic.

## Viết API & DTO — nguồn chân lý

Khi thêm/sửa API gọi BE, **đọc trước 2 tài liệu này** (đừng đoán):
- [docs/huong-dan-viet-api-fe.md](docs/huong-dan-viet-api-fe.md) — khuôn mẫu + quy ước
  bắt buộc để viết `*.api.ts` / `*.dto.ts` mới (có bộ khung copy & đổi tên, checklist review).
- [docs/asset-api-fe.md](docs/asset-api-fe.md) — hợp đồng API BE (route, request/response,
  enum, luật nghiệp vụ). Đây là **nguồn chân lý** cho tên field & shape; đối chiếu thêm
  Scalar UI tại `http://localhost:5000/scalar/v1` (chỉ Development).

**Các bẫy hay gặp (nhớ kỹ):**
- Envelope: dữ liệu thật ở `response.data`. Grid-list lồng thêm 1 tầng → mảng ở
  `response.data.data` (không phải `.items`). Dùng `ApiResponseWithPageNation<T>` cho grid-list.
- Endpoint trong `*.api.ts` bắt đầu bằng `/` và **không** kèm `/api` — tiền tố `/api` đã
  nằm trong `NEXT_PUBLIC_API_URL` (`.env.local` = `http://localhost:5000/api`).
- Query key gửi BE viết **PascalCase** (`PageIndex`, `Keyword`, `Status`), build bằng `URLSearchParams`.
- Field cho phép giá trị `0`/`false` (enum `status`, `deviceId`, `isOutsourced`): điều kiện
  set query phải là `!== undefined`, **không** dùng truthy `if (params?.x)` (sẽ rớt giá trị 0/false).
- DTO Create/Update **không** chứa field server tự tính (vd `expirationDate`); enum để kiểu `number`;
  nullable là `T | null` (đừng đặt kiểu literal `null`); mảng là `T[]` (đừng dùng tuple `[{...}]`).
- PUT: gửi kèm `{ id, ...data }` để khớp `{id}` trên URL. Mỗi hàm API `return response.data`.

## Component UI — pattern chuẩn

Mọi màn hình CRUD theo cùng khuôn (xem mẫu: `modules/pc-management/components/branches/`):
- **Page** (`app/.../page.tsx`): wrapper mỏng `return <XxxList />`.
- **`XxxList.tsx`** (`"use client"`): giữ state phân trang + search + form/delete; hàm `fetchXxx`
  trong `useEffect` phụ thuộc `[pageIndex, appliedKeyword]`; mọi thao tác bọc `try/catch` →
  `toast` + `getApiErrorMessage`; sau create/update/delete gọi lại `fetchXxx()`.
- **`XxxForm.tsx`** (`"use client"`): modal controlled, export `interface XxxFormValues`, prop
  `mode: "create" | "edit"` + `initial` + `loading` + `onClose` + `onSubmit`.
- Xác nhận xoá: dùng `components/common/ConfirmDialog`. Thông báo: `react-toastify` (đã mount ở root).

## Style / thiết kế

Tailwind CSS v4. Trước khi dựng/hiệu chỉnh UI, đọc:
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/DESIGN_GUIDE.md](docs/DESIGN_GUIDE.md),
[docs/dashboard-ui-guidelines.md](docs/dashboard-ui-guidelines.md).

Bảng màu thương hiệu đang dùng nhất quán trong code (giữ nguyên khi thêm màn mới): đỏ nhấn
`#e3000f` / hover `#b40009`; chữ đậm `#191c1e`; chữ phụ `#5e3f3a`; viền `#e0e3e5`; nền phụ
`#f8fafc`; lỗi `#930006`. Text hiển thị cho người dùng viết tiếng Việt.

## Lưu ý môi trường

- Auth: BE module Asset đang `[AllowAnonymous]` nhưng `client.ts` đã có sẵn cơ chế Bearer token
  (localStorage) + tự re-login qua `/windows-login` khi gặp 401 rồi retry — **không phá cơ chế này**.
- Shell mặc định là PowerShell (Windows). Có Bash tool cho lệnh POSIX.

## Khi bắt đầu 1 task mới — checklist nhanh

1. Task đụng API BE? → đọc `docs/asset-api-fe.md` (hợp đồng) + `docs/huong-dan-viet-api-fe.md` (khuôn mẫu).
2. Thêm entity? → tạo cặp `types/<entity>.dto.ts` + `api/<entity>.api.ts` theo khuôn, rồi mới tới component.
3. Thêm màn hình? → copy pattern List/Form của 1 entity master-data sẵn có (branches là mẫu gọn nhất).
4. Đụng UI? → theo docs design + bảng màu ở trên.
5. Xong code → `npx tsc --noEmit` sạch mới báo hoàn thành; đối chiếu tên field với hợp đồng/Scalar UI.
