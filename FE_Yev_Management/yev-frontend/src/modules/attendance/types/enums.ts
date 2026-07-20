// Enum dùng chung module Attendance (docs/attendance-api-fe.md §2) — gửi/nhận là số, FE tự map label.

// Tên Role Identity chính xác (case-sensitive) của cấp Submitter — dùng ở màn "Phân quyền duyệt"
// (kiểm tra trước khi cho Admin gán approvalLevel=0) và màn "Đơn tăng ca" (ẩn tab "Chờ tôi ký duyệt"
// cho Role "Nhân viên" — có OTForm.Create nhưng không phải Trưởng Nhóm nên tab luôn rỗng, docs §1.1).
export const SUBMITTER_ROLE_NAME = "Trưởng Nhóm";

// Role Identity bắt buộc theo từng approvalLevel khi Admin gán UserApprovalScope — ràng buộc mở rộng
// cho cả 4 cấp (trước 2026-07-17 chỉ áp dụng cho Submitter), xem docs §5 "Ràng buộc theo đúng Role".
// BE luôn là nguồn chặn thật (400 nếu sai) — map này chỉ để FE cảnh báo sớm trước khi submit.
export const APPROVAL_LEVEL_ROLE_NAME: Record<number, string> = {
    0: SUBMITTER_ROLE_NAME,
    4: "Trưởng Bộ phận",
    1: "Trưởng phòng",
    2: "Trưởng xưởng",
};

// scopeType bắt buộc theo từng approvalLevel (docs §5 "Ràng buộc ScopeType theo đúng thứ bậc", mới
// 2026-07-17): Submitter/GroupHead luôn theo Bộ phận (Group), DepartmentManager/WorkshopManager luôn
// theo Phòng ban (Department). FE ép sẵn PHẠM VI theo approvalLevel đã chọn để tránh lỗi 400.
export const APPROVAL_LEVEL_SCOPE_TYPE: Record<number, number> = {
    0: 0, // Submitter → Group
    4: 0, // GroupHead → Group
    1: 1, // DepartmentManager → Department
    2: 1, // WorkshopManager → Department
};

export const approvalLevelLabels: Record<number, string> = {
    0: "Người đề nghị",
    1: "Trưởng phòng",
    2: "Trưởng xưởng",
    3: "Tổng Giám Đốc",
    // GroupHead (mới 2026-07-17) — ký SAU Submitter, TRƯỚC DepartmentManager theo luồng thật, nhưng
    // giá trị enum nằm cuối (không renumber giá trị đã lưu DB) — xem docs §2/§Đợt 6.
    4: "Trưởng Bộ phận",
};

export const otFormStatusLabels: Record<number, string> = {
    0: "Chờ Trưởng phòng duyệt",
    1: "Chờ Trưởng xưởng duyệt",
    2: "Chờ Tổng Giám Đốc duyệt",
    3: "Hoàn tất",
    4: "Từ chối",
    5: "Nháp — chờ Trưởng nhóm ký",
    6: "Chờ Trưởng Bộ phận duyệt",
};

export const otFormStatusClasses: Record<number, string> = {
    0: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    1: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    2: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    3: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    4: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
    5: "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]",
    6: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
};

export const approvalActionLabels: Record<number, string> = {
    0: "Đã đề nghị (ký)",
    1: "Đã duyệt",
    2: "Đã từ chối",
};

// Sửa label 2026-07-17: Group thực ra là "Bộ phận" (không phải "Nhóm"), Department thực ra là
// "Phòng ban" (không phải "Bộ phận") — xem docs/attendance-api-fe.md đầu file.
export const scopeTypeLabels: Record<number, string> = {
    0: "Bộ phận",
    1: "Phòng ban",
};

// Cấp đang chờ duyệt kế tiếp suy ra từ status (docs/attendance-api-fe.md §4.3) — null khi đã xong (Completed/Rejected).
export function nextApprovalLevelFromStatus(status: number): number | null {
    if (status === 6) return 4; // Chờ Trưởng Bộ phận (GroupHead, mới 2026-07-17)
    if (status === 0) return 1; // Chờ Trưởng phòng
    if (status === 1) return 2; // Chờ Trưởng xưởng
    if (status === 2) return 3; // Chờ Tổng Giám Đốc
    return null; // Completed(3) / Rejected(4)
}
