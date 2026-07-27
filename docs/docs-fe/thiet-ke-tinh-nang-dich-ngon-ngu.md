# Cấu hình Context cho AI (Next.js Static UI Translation với next-intl)

## 1. Role & Context
Bạn là một chuyên gia Frontend (Next.js App Router, React, TypeScript). 
Dự án hiện tại là một Web App với giao diện và dữ liệu (từ Database) hoàn toàn bằng tiếng Việt.
Chiến lược đa ngôn ngữ (Việt ⇄ Nhật) của dự án được chia làm 2 giai đoạn. 
- **Giai đoạn hiện tại:** Chỉ dịch các text tĩnh (Static UI) trên giao diện (menu, button, form label, thông báo tĩnh...) sang tiếng Nhật. 
- **Giai đoạn sau:** Dữ liệu động từ Database cũ sẽ được giữ nguyên tiếng Việt. Việc dịch dữ liệu động sẽ được thực hiện ở một dự án khác khi thiết kế lại DB theo kiến trúc modular.

## 2. Core Task
Triển khai thư viện `next-intl` để hỗ trợ đa ngôn ngữ (i18n) cho các thành phần tĩnh của Next.js App Router.
Tuyệt đối giữ nguyên cơ chế SPA navigation (không hard-reload) để bảo toàn global/local state của người dùng khi chuyển trang hoặc đổi ngôn ngữ. KHÔNG can thiệp vào logic fetch dữ liệu động từ API/Database.

## 3. Strict Rules & Implementation Steps

### Bước 1: Khởi tạo cấu trúc từ điển & Cấu hình Core
- Cài đặt thư viện `next-intl`.
- Tạo thư mục `messages/` ở gốc dự án chứa `vi.json` và `ja.json` (tạo một vài key mẫu như Common.save, Navigation.dashboard).
- Cấu hình `next.config.mjs` (hoặc `.js`) để bọc `withNextIntl`.
- Tạo file `src/i18n.ts` sử dụng `getRequestConfig` để load file JSON động dựa trên locale.

### Bước 2: Middleware & Cấu trúc App Router `[locale]`
- Viết file `src/middleware.ts` để tự động route URL (chỉ hỗ trợ `vi` và `ja`, default là `vi`). Bỏ qua các file tĩnh và API routes.
- Hướng dẫn tôi di chuyển toàn bộ cấu trúc trong thư mục `app/` hiện tại vào Dynamic Segment `app/[locale]/`.
- Cập nhật `app/[locale]/layout.tsx` để bọc `<NextIntlClientProvider>` và truyền tham số `locale` vào thẻ `<html>`.

### Bước 3: Đảm bảo SPA Navigation an toàn
- Tạo file `src/navigation.ts` sử dụng `createSharedPathnamesNavigation` từ `next-intl/navigation` để xuất ra các hook/component an toàn (`Link`, `useRouter`, `usePathname`, `redirect`).
- **Ràng buộc:** Từ nay về sau, mọi component cần chuyển trang phải dùng `Link` và `useRouter` từ `@/navigation` thay vì `next/link` hay `next/navigation`.

### Bước 4: Tạo Language Switcher Component
- Tạo component `src/components/LanguageSwitcher.tsx` (Client Component).
- Component này dùng `useRouter` và `usePathname` (từ `@/navigation`), kết hợp `useTransition` để gọi hàm `router.replace(pathname, {locale: nextLocale})`.
- Việc này giúp đổi ngôn ngữ mượt mà, giữ nguyên path hiện tại và KHÔNG làm mất state của form hay app.

## 4. Output Expected từ AI
Hãy generate cho tôi các đoạn code hoàn chỉnh và chính xác cho:
1. `next.config.mjs` và file `src/i18n.ts`.
2. File `src/middleware.ts`.
3. File `src/navigation.ts`.
4. Code cho `app/[locale]/layout.tsx`.
5. Code chi tiết cho component `src/components/LanguageSwitcher.tsx`.
6. Một đoạn code ví dụ minh họa cách thay thế `next/link` thành `Link` mới và dùng hook `useTranslations` để hiển thị text tĩnh trong một page bất kỳ.