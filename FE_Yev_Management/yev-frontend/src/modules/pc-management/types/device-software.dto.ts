// Phần mềm đã cài trên 1 thiết bị — item của GET /DeviceSoftware/device/{deviceId}
// và cũng là shape item trả về sau khi PUT /DeviceSoftware/sync.
export interface DeviceSoftwareDeviceDto {
    deviceId: number;
    softwareId: number;
    softwareName: string;
    installDate: string;
    licenseKey: string | null;
}

// Body cho thao tác đơn lẻ: POST & PUT /DeviceSoftware.
// installDate/licenseKey optional — bỏ trống thì server tự set.
export interface CreateUpdateDeviceSoftwareDto {
    deviceId: number;
    softwareId: number;
    installDate?: string | null;
    licenseKey?: string | null;
}

// Item của GET /DeviceSoftware/picker/{deviceId} — dựng checkbox-list.
export interface DeviceSoftwarePickerDto {
    softwareId: number;
    softwareCode: string;
    softwareName: string;
    isSelected: boolean;
}

// 1 phần mềm đang tick trong danh sách gửi lên sync.
// licenseKey/installDate chỉ cần điền cho phần mềm MỚI tick.
export interface DeviceSoftwareSyncItemDto {
    softwareId: number;
    installDate?: string | null;
    licenseKey?: string | null;
}

// Body cho PUT /DeviceSoftware/sync.
export interface DeviceSoftwareSyncDto {
    deviceId: number;
    items: DeviceSoftwareSyncItemDto[];
}
