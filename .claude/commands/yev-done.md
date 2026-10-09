---
description: Kết thúc một việc — chạy checklist §4, cập nhật doc, commit đúng file của mình
argument-hint: <tuỳ chọn: gợi ý commit message; thêm "push" nếu muốn đẩy lên luôn>
---

Ghi chú: $ARGUMENTS

1. **Xác định file của việc này**: `git status --short` + `git diff`, đối chiếu với những gì session này đã sửa. File đổi sẵn từ trước / của session khác → liệt kê riêng, không stage, không sửa.
2. **Checklist `AGENTS.md §4`** — chỉ chạy phần bị đụng:
   - BE: `dotnet build YevManagement.slnx` (tại `yev-backend/`) sạch; thêm endpoint → có migration seed permission + gán `Admin`.
   - FE: `npx tsc --noEmit` sạch, `pnpm lint` không thêm cảnh báo mới (tại `yev-frontend/`); sửa `messages/` → `vi.json` và `ja.json` cùng bộ key.
   - Lỗi → sửa rồi chạy lại. Không qua được thì **dừng**, báo lỗi, không commit.
3. **Doc**: làm theo `.claude/commands/yev-docs-sync.md` (đã gồm `git pull --rebase --autostash`).
4. **Commit**: `git add <đúng từng đường dẫn>` (code + doc), không `git add -A`/`.`. Message tiếng Anh dạng `feat|fix|chore|docs: …` như `git log`, kèm dòng attribution. Một việc một commit; code và doc chung commit.
5. Chỉ `git push` khi phần Ghi chú có "push".
6. Báo: hash commit, file đã commit, file bỏ lại (bước 1), doc đã sửa mục nào.
