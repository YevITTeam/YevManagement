# AGENTS.md — YEV Management (monorepo FE + BE)

Quản lý nội bộ YEV: Identity (user/role/permission, AD + mật khẩu), Asset (PC/thiết bị), Attendance (OT Form), Workflow (form builder + duyệt nhiều cấp).
Backend `.NET 10` modular monolith trong `yev-backend/`; frontend Next.js 16 static export trong `yev-frontend/`; docs trong `docs/`. Deploy thật là **IIS**, không Docker.

**Ngôn ngữ:** trả lời người dùng và text UI bằng **tiếng Việt**.

**Comment trong code — bắt buộc:** viết **tiếng Anh** (không tiếng Việt), **1 dòng, tối đa 2**, chỉ nói *vì sao / ràng buộc ẩn* — không kể lại code làm gì, không dẫn chiếu dài, không nhật ký, không ngày tháng, không "trước đây X nay Y" (lịch sử thuộc `docs/` và `git log`). Không cần giải thích thì không viết comment. Sửa tới đoạn nào đang có comment tiếng Việt hoặc dài dòng thì viết lại luôn đoạn đó, không đi quét hàng loạt.

**UI — ưu tiên tối giản:** bỏ mô tả/nhãn thừa, mỗi màn tối ưu diện tích cho nội dung chính (chi tiết ở `docs/docs-fe/DESIGN_SYSTEM.md` §0, §4.10). Không thêm chữ giải thích nếu bỏ đi người dùng vẫn hiểu.

## 1. Lệnh thiết yếu
```powershell
# Backend (tại yev-backend/) — base URL dev: http://10.45.1.155:8081 (launchSettings.json là chuẩn)
dotnet build YevManagement.slnx
dotnet run --project CompanySystem.HostApi --launch-profile http
dotnet ef migrations add <Ten> --project Asset.Infrastructure --startup-project CompanySystem.HostApi   # đổi Asset → module cần
dotnet ef database update --project Asset.Infrastructure --startup-project CompanySystem.HostApi
# Chưa có project test nào. API docs: Scalar UI /scalar/v1 (chỉ Development)

# Frontend (tại yev-frontend/, pnpm — không dùng npm)
pnpm dev            # :3000, cần .env.local với NEXT_PUBLIC_API_URL = base BE kèm /api
pnpm build          # static export ra out/
pnpm lint
npx tsc --noEmit    # chạy sau mỗi thay đổi .ts/.tsx, trước khi báo xong
```
**Scripts triển khai (gốc repo):** `Deploy.bat` build BE (`yev-backend/Publish.bat` → `publish_backend/`) + FE (`yev-frontend/Publish.bat` → `out/`), thay `web.config` bằng bản trong `docs/deploy-config/`. `PrepareRelease.bat` = Deploy + gom ra `_Release/` (có sẵn `deploy.ready`) để copy tay lên `D:\Deploy\` trên server. `Release.bat` = Deploy + đẩy lên share `\\10.45.1.49\Deploy` + tạo trigger; `docs/deploy-config/AutoDeploy.ps1` trên server tự áp vào IIS.

## 1b. Định tuyến — CHỈ đọc doc khi task cần, đọc theo lát cắt
| Task | Đọc |
|---|---|
| Bất kỳ việc gì đụng BE | `docs/docs-be/architecture-core.md` |
| Auth / User / Role / Permission / email người dùng | `docs/docs-be/identity-module.md` |
| Chấm công / OT Form / phiếu ăn / lũy kế | `docs/docs-be/attendance-module.md` |
| In PDF phiếu tăng ca | `docs/docs-be/attendance-otform-pdf-mapping.md` |
| Quản lý tài sản / ServerCheck / Inventory / AppRelease / AI Chat Asset | `docs/docs-be/asset-module.md` |
| Workflow: form builder, quy trình duyệt, tổ chức/nhân sự | `docs/docs-be/workflow-module.md` |
| Gọi API từ FE, viết `*.api.ts`/`*.dto.ts`, pattern component, i18n | `docs/docs-fe/frontend-conventions.md` |
| Giao diện / UI | `docs/docs-fe/DESIGN_SYSTEM.md`, làm UI bằng command `/yev-ui` |

Hợp đồng API (route, quyền, luật đặc biệt) nằm ở mục `§API` cuối mỗi module doc — nguồn chân lý FE↔BE; tên field/DTO đọc thẳng Controller/DTO trong `yev-backend` hoặc `*.dto.ts`, đừng đoán.

## 2. Giao thức làm việc (số luật được code/doc khác trích dẫn — giữ nguyên số)
1. Tự đọc doc theo bảng định tuyến trước khi code, không hỏi xin mã nguồn.
2. **Nghiệp vụ chưa được define → HỎI TRƯỚC, code SAU**: thực thể/luồng mới chưa có trong doc thì chốt (a) danh sách Entity (tên, thuộc tính, kiểu, quan hệ, `IsDeleted`?) và (b) business logic (use-case/API, luật validate) rồi mới viết code. Không tự bịa nghiệp vụ.
3. Không tự tạo pattern mới — kế thừa lớp lõi (`architecture-core.md`) và khuôn FE (`frontend-conventions.md`).
4. **Cập nhật doc sau khi code**: sửa thẳng mục mô tả phần đó theo trạng thái hiện tại, không viết nhật ký, không nối mục `§… (ngày)`; quyết định cũ bị thay thì xoá/gộp.
5. DB là SQL Server dùng chung, **dữ liệu thật**: kiểm thử chỉ read-only, không tạo/sửa/xoá bản ghi rác.
6. Không "sửa" typo có sẵn trong tên thư mục/class/route (`Indentity.Infrastructure/`, `IUserReposiory`, `Suplliers/`) — vỡ reference.
7. Doc rất nặng (`attendance-module`, `workflow-module`, `asset-module`): đọc "MỤC LỤC ĐỌC NHANH" ở đầu → `Grep "^#{2,3} "` lấy số dòng → `Read` có `offset/limit`. Cần 1 tên field/endpoint thì `Grep` thẳng chuỗi đó.

## 3. Rào chắn
- **Cấm** tự load toàn bộ `docs/`; chỉ đọc đúng doc theo bảng định tuyến.
- **Cấm** sửa migration đã tồn tại (tạo migration mới); mã permission mới phải vào migration seed + gán role `Admin`.
- **Cấm** đổi route/DTO BE mà không cập nhật FE (`*.api.ts`/`*.dto.ts`) và mục `§API` của doc module.
- **Cấm** đổi connection string DB (Asset production thật là `YevPCManagement_Production`; local trỏ `YevPCManagement` là cố ý).
- **Cấm** "dọn" nhánh phase trong `next.config.ts` (chỉ bật `output: "export"` khi build, bật ở dev sẽ lỗi middleware).
- **Cấm** phá cơ chế auto re-login 401 trong `src/lib/client.ts`; không gọi lại `windows-login` khi còn token (dùng `GET /api/Auth/me`).
- Xuất PDF mới vẽ thẳng bằng `jspdf`, không `html2canvas`. Không viết lại hướng dẫn người dùng cuối vào `docs/` nếu không được yêu cầu.

## 4. Checklist trước khi báo "xong"
BE: `dotnet build YevManagement.slnx` sạch · migration + seed permission nếu thêm endpoint. FE: `npx tsc --noEmit` sạch · key i18n đủ `vi.json` + `ja.json` · UI theo `DESIGN_SYSTEM.md` §9. Cả hai: **doc module đã cập nhật**.
