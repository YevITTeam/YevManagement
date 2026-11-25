export function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// UsbPolicyResult → badge. Shown on sessions; null (mode Off, phones) shows nothing.
export const POLICY_META: Record<number, { label: string; variant: "success" | "danger" | "warning"; title: string }> = {
    1: { label: "Đã cấp phép", variant: "success", title: "USB đã được cấp phép, ghi bình thường" },
    2: { label: "Bị chặn ghi", variant: "danger", title: "Agent đã chuyển USB sang chỉ đọc" },
    3: { label: "Chưa cấp phép", variant: "warning", title: "Chế độ Thử: USB này sẽ bị chặn ghi nếu bật Chặn" },
    4: { label: "Chặn thất bại", variant: "danger", title: "Agent không đặt được chế độ chỉ đọc, xem Event Viewer trên máy" },
};

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
