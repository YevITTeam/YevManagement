# YEV Management

Monorepo nội bộ YEV: `yev-backend/` (.NET 10), `yev-frontend/` (Next.js 16), `docs/`. Tổng quan hệ thống: [docs/overview.md](docs/overview.md). Luật dự án và lệnh build: [AGENTS.md](AGENTS.md).

## Chạy local

Cần .NET 10 SDK, Node + pnpm, máy trong domain YEV, quyền đọc SQL Server dùng chung.

```powershell
cd yev-backend;  dotnet run --project CompanySystem.HostApi --launch-profile http   # http://10.45.1.155:8081
cd yev-frontend; pnpm install; pnpm dev                                           # http://localhost:3000
```

`yev-frontend/.env.local` (tự tạo): `NEXT_PUBLIC_API_URL=http://10.45.1.155:8081/api`. DB là dữ liệu thật — chỉ đọc khi thử nghiệm.

## Làm việc với Claude Code

Mỗi việc một session, mỗi session một worktree/nhánh riêng. `AGENTS.md` tự nạp, không cần nhắc lại luật trong prompt.

| Bước | Lệnh |
|---|---|
| 1. Bắt đầu | `/yev-task <module>: <việc cần làm>` |
| 2. Chốt nghiệp vụ / plan | Trả lời khi Claude hỏi (nghiệp vụ mới, hoặc việc đụng nhiều module) |
| 3. Kết thúc | `/yev-done` — checklist build, cập nhật doc, commit đúng file. Thêm `push` để đẩy luôn |

Mẫu cho bước 1:

```
/yev-task Attendance: thêm cột ca đêm vào OT Form, chỉ hiện với line sản xuất
/yev-task Lỗi: màn Duyệt OT, bấm Duyệt hàng loạt thì phiếu thứ 2 không đổi trạng thái (đúng: tất cả đổi)
/yev-ui Workflow: làm gọn tab Cấu hình quy trình
```

Mẹo: luôn nêu module; việc mơ hồ thì nêu tiêu chí xong; lỗi thì kèm bước tái hiện + ảnh/log. Chỉ cập nhật doc: `/yev-docs-sync`.
