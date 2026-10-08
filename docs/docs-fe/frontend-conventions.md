# frontend-conventions.md — Quy ước code `yev-frontend`

> Stack: Next.js 16 (App Router, static export, `trailingSlash: true`) · React 19 + **React Compiler** · TS `strict` ·
> Tailwind v4 · next-intl · react-toastify · lucide-react · pnpm. Không dùng React Query/Redux — chỉ `fetch` wrapper + `useState`.
> UI/màu/component xem [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 1. Phân tầng
- `app/[locale]/**/page.tsx` chỉ render 1 component, không logic. Mỗi module `modules/<m>/{api,types,lib,components}`.
- Component **không** `fetch` trực tiếp — gọi `XxxApi` (1 file `api/<entity>.api.ts` + 1 file `types/<entity>.dto.ts` mỗi entity BE).
- Điều hướng: `Link`/`useRouter`/`usePathname` từ `@/navigation` (không `next/link`, không `next/navigation`; ngoại lệ `useSearchParams`).
- Static export: không middleware/SSR ở production. `next.config.ts` chỉ bật `output: "export"` ở phase build; `localePrefix: "always"` bắt buộc.
- `NEXT_PUBLIC_API_URL` (`.env.local`, tự tạo) = base URL BE **kèm `/api`**; endpoint trong `*.api.ts` bắt đầu bằng `/`, không kèm `/api`.

## 2. Viết API / DTO
Mẫu: `modules/pc-management/api/branch.api.ts` + `types/branch.dto.ts`; endpoint đặc thù (upload, blob): `device-import.api.ts`.
- `ENDPOINTS` là `as const`; object tên `<Entity>Api`; mỗi hàm `return response.data` (envelope `ApiResponse<T>`; grid-list `ApiResponseWithPageNation<T>`, mảng ở `res.data.data`).
- Query key **PascalCase** (`PageIndex`, `Keyword`) dựng bằng `URLSearchParams`; field cho phép `0`/`false` check `!== undefined`.
- DTO camelCase; nullable `T | null`; enum `number`; Create/Update không chứa field server tự tính; `PUT` gửi `{ id, ...data }`; `byte[]` ⇄ base64.
- `lib/client.ts` (`api.get/post/put/patch/delete`): gắn Bearer, tự re-login Windows khi 401 rồi retry (dồn nhiều 401 về 1 handshake — **không phá**), ném `Error(chuỗi JSON BE)`. Không dùng `api.*` cho file/stream: dùng `getForBlob`, `postFormForBlob`, `postStream`. `setOnUnauthorized` chỉ đăng ký ở `AuthContext`.
- Lỗi hiển thị: `try/catch` + `getApiErrorMessage(err, fallback)` (`lib/apiError.ts`) + `toast.error`; thành công `toast.success`.
- Tên field luôn đối chiếu hợp đồng API trong doc module hoặc Scalar UI (`/scalar/v1`).

## 3. Pattern component (React Compiler cấm setState đồng bộ trong `useEffect`)
Khuôn CRUD: Page → `XxxList.tsx` (state phân trang/search/form/delete) → `XxxForm.tsx` (modal, `mode: "create"|"edit"`, `initial`, `loading`, `onClose`, `onSubmit`). Mẫu: `modules/pc-management/components/branches/`.
1. **Fetch:** `useFetchEffect(fetcher, deps, onSuccess, errorFallback, onError?, cacheKey?)` → `{ isLoading, error, refetch }` (`modules/common/hooks/`). Chỉ `onSuccess` được set state; `refetch` thay hàm `fetchXxx`.
2. **Reset form dialog:** `useDialogReset(isOpen, initial, apply)`. Form bị cha mount/gỡ có điều kiện (không có `isOpen`) cần thêm lazy initializer `useState(() => …)`.
3. **Reset state khi giá trị đổi** (vd `setPageIndex(1)`): so snapshot ngay trong render, không dùng effect:
   `if (prev !== key) { setPrev(key); setPageIndex(1); }`
- Quyền UI: `modules/auth/lib/permissions.ts` (`hasPermission`/`hasAnyPermission`/`hasModuleAccess`) — chỉ ẩn/hiện, BE vẫn enforce.

## 4. Đa ngôn ngữ (next-intl, `vi` mặc định + `ja`)
- Text mới: `useTranslations("<Namespace>")`, thêm key vào **cả** `messages/vi.json` và `ja.json` cùng cấu trúc.
- Ngôn ngữ mặc định theo thứ tự: lựa chọn VI/JA thủ công trong phiên tab hiện tại (`sessionStorage` `yev-locale`) → ngôn ngữ trình duyệt/Windows bắt đầu bằng `ja` (`navigator.language` hoặc locale mặc định của `Intl`, vốn theo ngôn ngữ giao diện trình duyệt) hoặc múi giờ máy `Asia/Tokyo` → `vi`. Logic ở `components/LanguageSwitcher.tsx` (mount trong Header, chạy cả ở trang `xac-nhan-*`); không phụ thuộc tài khoản.
- Chỉ dịch text tĩnh; dữ liệu DB và nội dung biểu mẫu PDF giữ tiếng Việt. Màn cũ còn hardcode thì chỉ chuyển khi đang sửa chính màn đó.

## 5. Icon & PDF
- Icon luôn `lucide-react`, không emoji/ký tự Unicode (ngoại lệ: ô tick giả trên biểu mẫu PDF `OtFormPrintView.tsx`).
- Xuất PDF mới: vẽ thẳng bằng `jspdf` (+ `jspdf-autotable`), **không** `html2canvas` (code cũ dùng nó thì giữ nguyên).

## 6. Checklist trước khi báo xong
`npx tsc --noEmit` sạch · `pnpm lint` không thêm cảnh báo · key i18n đủ 2 file · comment tiếng Anh ngắn mô tả hành vi hiện tại · UI theo DESIGN_SYSTEM §9 · doc module đã cập nhật.
