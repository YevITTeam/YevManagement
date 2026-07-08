// Trạng thái địa chỉ IP. statusText luôn được ưu tiên hiển thị từ server;
// bảng nhãn/màu dưới đây dùng cho dropdown trong form và tô màu badge theo status.
export const ipStatusLabels: Record<number, string> = {
    0: "Trống",
    1: "Đã sử dụng",
    2: "Đặt trước",
};

export const ipStatusClasses: Record<number, string> = {
    0: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    1: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
    2: "border border-[#d8e2ff] bg-[#f4f5ff] text-[#004494]",
};

export const ipStatusOptions = [0, 1, 2] as const;
