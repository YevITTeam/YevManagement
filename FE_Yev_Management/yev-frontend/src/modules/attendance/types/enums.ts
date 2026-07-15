// Enum dùng chung module Attendance (docs/attendance-api-fe.md §2) — gửi/nhận là số, FE tự map label.

export const approvalLevelLabels: Record<number, string> = {
    0: "Người đề nghị",
    1: "Trưởng phòng",
    2: "Trưởng xưởng",
    3: "Tổng Giám Đốc",
};

export const otFormStatusLabels: Record<number, string> = {
    0: "Chờ Trưởng phòng duyệt",
    1: "Chờ Trưởng xưởng duyệt",
    2: "Chờ Tổng Giám Đốc duyệt",
    3: "Hoàn tất",
    4: "Từ chối",
};

export const otFormStatusClasses: Record<number, string> = {
    0: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    1: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    2: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    3: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    4: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
};

export const approvalActionLabels: Record<number, string> = {
    0: "Đã đề nghị (ký)",
    1: "Đã duyệt",
    2: "Đã từ chối",
};

export const scopeTypeLabels: Record<number, string> = {
    0: "Nhóm",
    1: "Bộ phận",
};

// Cấp đang chờ duyệt kế tiếp suy ra từ status (docs/attendance-api-fe.md §4.3) — null khi đã xong (Completed/Rejected).
export function nextApprovalLevelFromStatus(status: number): number | null {
    if (status === 0) return 1; // Chờ Trưởng phòng
    if (status === 1) return 2; // Chờ Trưởng xưởng
    if (status === 2) return 3; // Chờ Tổng Giám Đốc
    return null; // Completed(3) / Rejected(4)
}
