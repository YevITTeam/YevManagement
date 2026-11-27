const pad = (n: number) => String(n).padStart(2, "0");

// dd/MM/yyyy HH:mm in local time; seconds add width without helping anyone read the log.
export function formatDateTime(value: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// UsbPolicyResult → badge; key points at usbLog.policy.<key>.label/title. Null (mode Off, phones) shows nothing.
export const POLICY_META: Record<number, { key: string; variant: "success" | "danger" | "warning" }> = {
    1: { key: "approved", variant: "success" },
    2: { key: "blocked", variant: "danger" },
    3: { key: "audit", variant: "warning" },
    4: { key: "blockFailed", variant: "danger" },
    5: { key: "readOnly", variant: "warning" },
};

export const USB_ACCESS_LEVEL = { ReadOnly: 1, ReadWrite: 2 } as const;

// key points at usbLog.accessLevel.<key>.
export const ACCESS_LEVEL_OPTIONS = [
    { value: USB_ACCESS_LEVEL.ReadWrite, key: "readWrite" },
    { value: USB_ACCESS_LEVEL.ReadOnly, key: "readOnly" },
];

// UsbAgentEventType → badge on the Agent tab; key points at usbLog.agentEvent.<key>.
export const AGENT_EVENT_META: Record<number, { key: string; variant: "success" | "danger" | "warning" | "neutral" | "info" }> = {
    1: { key: "install", variant: "info" },
    2: { key: "start", variant: "success" },
    3: { key: "stop", variant: "neutral" },
    4: { key: "crash", variant: "warning" },
    5: { key: "uninstall", variant: "danger" },
    6: { key: "uninstallDenied", variant: "danger" },
    7: { key: "updateFailed", variant: "warning" },
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

// Classes with a label in usbLog.deviceClass; any other class shows its raw name.
export const DEVICE_CLASSES = ["DiskDrive", "WPD", "Image"];

export function deviceClassLabel(t: (key: string) => string, deviceClass: string) {
    return DEVICE_CLASSES.includes(deviceClass) ? t(`deviceClass.${deviceClass}`) : deviceClass;
}

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
