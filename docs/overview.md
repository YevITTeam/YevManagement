# overview.md — Tổng quan hệ thống YEV Management

> Bản đồ cho người mới: hệ thống gồm gì, chạy ra sao, đọc gì tiếp. Chi tiết và luật nằm ở doc từng module — file này chỉ trỏ tới, không chép lại.

## 1. Hệ thống làm gì

Web nội bộ YEV, đăng nhập bằng tài khoản domain (AD). Trang chủ hiện thẻ module theo quyền của người dùng.

| Module | Việc chính | Trạng thái | Doc |
|---|---|---|---|
| **Identity** | User / Role / Permission, đăng nhập SSO Windows · form AD · QR, kho email người dùng | Production | [identity-module.md](docs-be/identity-module.md) |
| **Attendance** | Giấy tăng ca (OT Form): duyệt nhiều cấp theo Cây chức vụ, đơn theo chuyền, Đơn tổng, phiếu ăn, lũy kế/giới hạn giờ OT, chữ ký + mật khẩu cấp 2, duyệt qua email, báo cáo Excel/PDF, AI Chat lập đơn | Production | [attendance-module.md](docs-be/attendance-module.md) |
| **Asset** | Quản lý PC/thiết bị: IP, phần mềm, chuyển máy, thanh lý, import Tanium, kiểm kê, ServerCheck, AppRelease, AI Chat | Đang phát triển | [asset-module.md](docs-be/asset-module.md) |
| **Workflow** | Form builder kéo-thả + luồng duyệt tự cấu hình (theo mô hình POWER EGG); phòng ban tự thêm loại đơn không cần lập trình | Pha 1–4 xong | [workflow-module.md](docs-be/workflow-module.md) |

## 2. Kiến trúc

```
Trình duyệt ──► IIS site FE (web tĩnh: yev-frontend/out)
     │
     └─ fetch + Bearer JWT ──► IIS site BE (CompanySystem.HostApi, .NET 10)
                                   ├─ Identity   ─► DB YevIdentityManagement
                                   ├─ Attendance ─► DB YevOTManagement
                                   ├─ Asset      ─► DB YevPCManagement(_Production)
                                   └─ Workflow   ─► DB YevWorkflowManagement
                                   ngoài: Active Directory (YEV) · SMTP · Tanium (import) · LLM cho AI Chat
```

- **Backend** — modular monolith, một tiến trình. Mỗi module 4 project `Domain → Application → Infrastructure → Api`, nền chung `Shared.*`, ráp ở `CompanySystem.HostApi`. Luật lõi: [architecture-core.md](docs-be/architecture-core.md).
- **Mỗi module một DB riêng** (SQL Server dùng chung máy chủ, **dữ liệu thật**). Không có FK chéo DB; module khác định danh người dùng bằng `UserName` (Attendance) hoặc `UserId` (Workflow). Asset/Attendance cũ scaffold từ hệ cũ nên tên bảng/cột tiếng Việt.
- **Frontend** — Next.js 16 static export, không SSR. Mỗi module ở `src/modules/<m>/`, mỗi khu quản trị là một route group có sidebar + guard quyền riêng: `(admin)` → `/admin`, `(ot-manager)` → `/ot`, `(pc-manager)` → `/pc`, `(workflow-manager)` → `/workflow`, `(pc-scan)` cho màn quét. Trang `xac-nhan-*` là trang mở từ link email (duyệt đơn, xác nhận chữ ký / mật khẩu cấp 2). Quy ước: [frontend-conventions.md](docs-fe/frontend-conventions.md), giao diện: [DESIGN_SYSTEM.md](docs-fe/DESIGN_SYSTEM.md).

## 3. Một request đi thế nào

1. **Đăng nhập** — `POST /api/Auth/windows-login` (SSO Windows, máy trong domain) hoặc `/login` (gõ tài khoản AD) hoặc `/qr-login` (app YEV Scan) → BE trả JWT (120 phút). Người lần đầu đăng nhập được tạo User role `Basic`. Chi tiết: `identity-module.md §3`.
2. **Gọi API** — FE gắn Bearer qua `src/lib/client.ts`; gặp 401 tự đăng nhập Windows lại rồi gọi lại.
3. **Phân quyền** — mọi endpoint cần đăng nhập; action gắn `[RequirePermission("Module.Entity.Action")]`. Quyền **không nằm trong JWT**, BE đọc từ DB (cache 60s) nên thu hồi có hiệu lực ngay. FE chỉ dùng quyền để ẩn/hiện.
4. **Trả về** — luôn `ApiResponse<T>`; lỗi nghiệp vụ là exception → middleware đổi thành message tiếng Việt, FE hiện thẳng bằng toast.

## 4. Môi trường & triển khai

| | Dev | Production |
|---|---|---|
| BE | `dotnet run` → `http://10.45.1.155:8081` | IIS, app pool `YevManagement-BE-Pool` |
| FE | `pnpm dev` → `:3000` | IIS site tĩnh (`out/`) |
| DB Asset | `YevPCManagement` (cố ý) | `YevPCManagement_Production` |

- `dotnet run` không bật Windows Authentication → SSO chỉ test được khi chạy dưới IIS; dev dùng `/login` hoặc tài khoản `TEST\…`.
- Phát hành: `Release.bat` (gốc repo) build cả hai, đẩy lên share server; `AutoDeploy.ps1` trên server tự dừng pool, chép, bật lại. Biến thể và lệnh cụ thể: `AGENTS.md §1`.
- Thay schema: tạo migration mới theo module (`dotnet ef … --project <M>.Infrastructure`); BE **không tự migrate** lúc khởi động, phải chạy `dotnet ef database update` lên DB đích. Permission mới seed trong migration.

## 5. Đọc gì tiếp

| Bạn sắp… | Đọc |
|---|---|
| Làm việc với Claude Code | [README.md](../README.md) (`/yev-task` → `/yev-done`) |
| Viết code BE bất kỳ | [architecture-core.md](docs-be/architecture-core.md) rồi doc module |
| Viết FE gọi API | [frontend-conventions.md](docs-fe/frontend-conventions.md) + mục `§API` của doc module |
| Làm giao diện | [DESIGN_SYSTEM.md](docs-fe/DESIGN_SYSTEM.md) |
| Biết luật/rào chắn của dự án | [AGENTS.md](../AGENTS.md) |
