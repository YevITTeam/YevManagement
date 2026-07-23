// Trạng thái địa chỉ IP (docs/asset-api-fe.md §4.2). statusText luôn được ưu tiên
// hiển thị từ server (đã thống nhất "Chưa sử dụng"/"Đã sử dụng (khác)"/"Đã sử dụng"
// ở mọi endpoint); bảng nhãn/màu dưới đây dùng cho dropdown trong form và tô màu
// badge theo status, giữ đồng bộ chữ với statusText.
export const ipStatusLabels: Record<number, string> = {
    0: "Chưa sử dụng",
    1: "Đã sử dụng (khác)",
    2: "Đã sử dụng",
};

// Đồng bộ tông màu badge trạng thái với bảng Thiết bị (statusClasses ở
// src/app/[locale]/(pc-manager)/pc/page.tsx) để cùng ngôn ngữ UI trong toàn hệ thống.
export const ipStatusClasses: Record<number, string> = {
    0: "border border-[#cbd5e1] bg-[#eef2f6] text-[#475569]",
    1: "border border-[#6366f1] bg-[#eef2ff] text-[#4338ca]",
    2: "border border-[#16a34a] bg-[#16a34a] text-white",
};

export const ipStatusOptions = [0, 1, 2] as const;
