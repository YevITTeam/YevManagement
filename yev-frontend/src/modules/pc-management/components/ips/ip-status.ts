// Server statusText is preferred for display; these labels/colors serve the form dropdown and badge tint.
export const ipStatusLabels: Record<number, string> = {
    0: "Chưa sử dụng",
    1: "Đã sử dụng (khác)",
    2: "Đã sử dụng",
};

// Same badge palette as the device table statusClasses for UI consistency.
export const ipStatusClasses: Record<number, string> = {
    0: "border border-[#cbd5e1] bg-[#eef2f6] text-[#475569]",
    1: "border border-[#6366f1] bg-[#eef2ff] text-[#4338ca]",
    2: "border border-[#16a34a] bg-[#16a34a] text-white",
};

export const ipStatusDotClasses: Record<number, string> = {
    0: "bg-[#94a3b8]",
    1: "bg-[#6366f1]",
    2: "bg-[#16a34a]",
};

export const ipStatusOptions = [0, 1, 2] as const;
