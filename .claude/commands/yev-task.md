---
description: Bắt đầu một việc (tính năng / sửa lỗi / UI) theo đúng quy trình dự án
argument-hint: <module + việc cần làm, vd "Attendance: thêm cột ca đêm vào OT Form" hoặc "Lỗi: ...">
---

Việc cần làm: $ARGUMENTS

Nếu phần trên trống thì hỏi đúng 1 câu: module nào, làm gì — rồi dừng.

0. `git status --short` + nhánh hiện tại. Đang có thay đổi không thuộc việc này → báo 1 dòng, đề nghị tách worktree (`EnterWorktree`, nhánh `feat/…` hoặc `fix/…`); không tự đụng vào các file đó.
1. Phân loại rồi đi đúng nhánh:
   - **Chỉ giao diện** → làm theo `.claude/commands/yev-ui.md`.
   - **Sửa lỗi** → tái hiện/trace luồng thật, grep mọi caller, sửa ở gốc chứ không vá triệu chứng.
   - **Nghiệp vụ chưa có trong doc** → luật 2: chốt Entity + business logic với người dùng, **dừng chờ duyệt** rồi mới code.
   - **Đụng từ 2 module trở lên hoặc đổi schema/route** → đưa plan ngắn (file sẽ sửa, migration, API đổi) và chờ duyệt.
   - Còn lại → làm luôn.
2. Đọc doc theo bảng định tuyến `AGENTS.md §1b`, theo lát cắt (luật 7).
3. Tiêu chí "xong" chưa rõ → tự chọn mặc định hợp lý, báo 1 dòng lúc giao, không dừng hỏi.
4. Làm xong thì báo ngắn: đã đổi gì, bỏ qua gì; nhắc người dùng chạy `/yev-done`.
