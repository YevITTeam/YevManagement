// Enum dùng chung module Attendance (docs/attendance-api-fe.md §2) — gửi/nhận là số, FE tự map label.

// Nhãn hiển thị requiredApprovalLevel/JobTitleTerminalLevel (chỉ dùng giá trị 1/2/3, xem
// ot-case.dto.ts) — index 0/4 giữ lại vì cùng bảng số với ApprovalLevel cũ (Submitter/GroupHead, đã
// xoá hẳn 2026-08-08 Giai đoạn 3.2) nhưng KHÔNG còn xuất hiện trong dữ liệu mới.
export const approvalLevelLabels: Record<number, string> = {
    0: "Trưởng nhóm",
    1: "Trưởng phòng",
    2: "Trưởng xưởng",
    3: "Tổng Giám Đốc",
    // GroupHead (mới 2026-07-17) — ký SAU Submitter, TRƯỚC DepartmentManager theo luồng thật, nhưng
    // giá trị enum nằm cuối (không renumber giá trị đã lưu DB) — xem docs §2/§Đợt 6.
    4: "Trưởng Bộ phận",
};

// OtFormStatus (docs/attendance-api-fe.md §2, redesign 2026-08-07 Giai đoạn 3.1) — rút gọn còn 3 giá
// trị, chi tiết "đang chờ ai" nằm ở OtFormDto.approvalSteps (bước Pending có StepOrder nhỏ nhất),
// không còn suy được trực tiếp từ status như enum cũ.
export const otFormStatusLabels: Record<number, string> = {
    0: "Đang chờ phê duyệt",
    1: "Hoàn tất",
    2: "Không phê duyệt",
};

export const otFormStatusClasses: Record<number, string> = {
    0: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    1: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    2: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
};

export const approvalActionLabels: Record<number, string> = {
    0: "Đã đề nghị (ký)",
    1: "Đã phê duyệt",
    2: "Không phê duyệt",
};

// JobTitleTerminalLevel (docs/attendance-api-fe.md §Cây chức vụ) — None nếu chỉ là cấp trung gian,
// 3 giá trị còn lại tương ứng đúng 3 cấp duyệt cuối cố định (Trưởng phòng/Trưởng Xưởng/TGĐ).
export const jobTitleTerminalLevelLabels: Record<number, string> = {
    0: "Không (cấp trung gian)",
    1: "Trưởng phòng",
    2: "Trưởng xưởng",
    3: "Tổng Giám Đốc",
};

// OtFormApprovalStepStatus (docs §Cây chức vụ) — dùng cho OtFormDto.approvalSteps[].status.
export const otFormApprovalStepStatusLabels: Record<number, string> = {
    0: "Đang chờ",
    1: "Đã phê duyệt",
    2: "Không phê duyệt",
    3: "Bỏ qua",
};
