---
description: Cập nhật doc module theo thay đổi code vừa làm (trạng thái hiện tại, không nhật ký)
argument-hint: <tuỳ chọn: module hoặc commit range, mặc định là diff chưa commit + commit mới nhất>
---

Phạm vi: $ARGUMENTS

0. `git pull --rebase --autostash` trước (đang có thay đổi chưa commit) để doc là bản mới nhất. Doc bị xung đột merge thì lấy code đã merge làm chuẩn, giải quyết rồi đối chiếu lại.
1. Lấy thay đổi: `git status --short` + `git diff` (chưa có diff thì `git show --stat HEAD`).
2. Map file đổi → doc theo bảng định tuyến ở `AGENTS.md §1b`. Chỉ đọc doc của module bị đụng, theo lát cắt (luật 7).
3. Với mỗi doc: sửa **thẳng mục đang mô tả phần đó** cho khớp code hiện tại (entity/DTO/endpoint/quyền, mục `§API`, phần "đã xong / cần làm tiếp"). Thiếu mục thì mới thêm mục mới.
4. Quyết định cũ bị thay → xoá/gộp; chỉ giữ 1 dòng "trước làm X, bỏ vì Y" nếu lý do còn giá trị. Không ngày tháng, không nhật ký (luật 4).
5. Đổi route/DTO BE → đối chiếu `*.api.ts`/`*.dto.ts` ở FE; lệch thì báo, không tự sửa code.
6. Báo cuối: doc nào đã sửa, mục nào; code chưa khớp doc (nếu thấy).
