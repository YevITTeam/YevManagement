export function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// UsbPolicyResult → badge. Shown on sessions; null (mode Off, phones) shows nothing.
export const POLICY_META: Record<number, { label: string; variant: "success" | "danger" | "warning"; title: string }> = {
    1: { label: "Đã cấp phép", variant: "success", title: "USB đã được cấp phép, ghi bình thường" },
    2: { label: "Bị chặn", variant: "danger", title: "USB chưa cấp phép: agent 1.3 trở lên chặn hẳn, agent cũ chỉ chặn ghi" },
    3: { label: "Chưa cấp phép", variant: "warning", title: "Chế độ Thử: USB này sẽ bị chặn nếu bật Chặn" },
    4: { label: "Chặn thất bại", variant: "danger", title: "Agent không khoá được USB, xem Event Viewer trên máy" },
    5: { label: "Chỉ đọc", variant: "warning", title: "USB được cấp phép chỉ đọc" },
};

export const USB_ACCESS_LEVEL = { ReadOnly: 1, ReadWrite: 2 } as const;

export const ACCESS_LEVEL_OPTIONS = [
    { value: USB_ACCESS_LEVEL.ReadWrite, label: "Đọc và ghi" },
    { value: USB_ACCESS_LEVEL.ReadOnly, label: "Chỉ đọc" },
];

// UsbAgentEventType → badge on the Agent tab.
export const AGENT_EVENT_META: Record<number, { label: string; variant: "success" | "danger" | "warning" | "neutral" | "info" }> = {
    1: { label: "Cài đặt", variant: "info" },
    2: { label: "Khởi động", variant: "success" },
    3: { label: "Dừng", variant: "neutral" },
    4: { label: "Dừng đột ngột", variant: "warning" },
    5: { label: "Đã gỡ", variant: "danger" },
    6: { label: "Gỡ sai mật khẩu", variant: "danger" },
    7: { label: "Cập nhật lỗi", variant: "warning" },
};

export function saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

// The admin-given alias wins over the hardware model name, which repeats across identical sticks.
export function usbLabel(usb: { alias?: string | null; friendlyName: string | null; vendorId: string; productId: string }) {
    return usb.alias || usb.friendlyName || `${usb.vendorId}:${usb.productId}`;
}

export const DEVICE_CLASS_LABELS: Record<string, string> = {
    DiskDrive: "Ổ lưu trữ",
    WPD: "Điện thoại",
    Image: "Máy ảnh / scan",
};

export function formatBytes(value: number | null) {
    if (value === null || value === undefined) return "-";
    if (value < 1024) return `${value} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
}
