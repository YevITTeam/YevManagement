// 18 field linh kiện dùng chung cho cấu hình hiện tại / snapshot ban đầu / lịch sử.
// Tất cả đều optional string ở BE → luôn có thể null trong response.
export interface DeviceComponentFields {
    mainboard: string | null;
    cpu: string | null;
    ram: string | null;
    hardDrive: string | null;
    monitor: string | null;
    mouse: string | null;
    keyboard: string | null;
    headphone: string | null;
    speaker: string | null;
    ups: string | null;
    psu: string | null;
    os: string | null;
    vga: string | null;
    maker: string | null;
    model: string | null;
    powerAdapter: string | null;
    wirelessCard: string | null;
    nic: string | null;
}

// Cấu hình phần cứng hiện tại — GET /DeviceConfiguration/by-device/{deviceId}.
// (response có thể là null nếu thiết bị chưa nhập cấu hình — xử lý ở tầng gọi.)
export interface DeviceConfigurationDto extends DeviceComponentFields {
    id: number;
    deviceId: number;
    deviceCode: string;
    other: string | null;
    note: string | null;
}

// Body cho POST & PUT /DeviceConfiguration.
// deviceId [Required]; 18 field linh kiện + other/note đều optional.
// KHÔNG đổi được deviceId khi update (gửi khác đi → 400).
export interface CreateUpdateDeviceConfigurationDto extends Partial<DeviceComponentFields> {
    id?: number;              // dùng cho PUT, phải khớp {id} trên URL
    deviceId: number;
    other?: string | null;
    note?: string | null;
}

// "Cấu hình ban đầu" — snapshot bất biến lúc tạo.
// GET /DeviceConfiguration/{configId}/initial (null nếu chưa có).
export interface DeviceConfigurationInitialDto extends DeviceComponentFields {
    id: number;
    deviceConfigurationId: number;
    other: string | null;
    note: string | null;
}

// 1 dòng "Lịch sử sửa chữa / thay thế" — GET /DeviceConfiguration/{configId}/history.
// Mỗi dòng = 18 field linh kiện tại thời điểm sửa + thông tin ai sửa / khi nào.
export interface DeviceConfigurationHistoryDto extends DeviceComponentFields {
    id: number;
    editedAt: string;
    editedBy: string | null;
    other: string | null;
    note: string | null;
}
