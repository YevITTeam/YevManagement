// Also the item shape returned by PUT /DeviceSoftware/sync.
export interface DeviceSoftwareDeviceDto {
    deviceId: number;
    softwareId: number;
    softwareName: string;
    installDate: string;
    licenseKey: string | null;
}

// installDate/licenseKey are optional; the server fills defaults.
export interface CreateUpdateDeviceSoftwareDto {
    deviceId: number;
    softwareId: number;
    installDate?: string | null;
    licenseKey?: string | null;
}

export interface DeviceSoftwarePickerDto {
    softwareId: number;
    softwareCode: string;
    softwareName: string;
    isSelected: boolean;
}

// licenseKey/installDate are only needed for newly ticked software.
export interface DeviceSoftwareSyncItemDto {
    softwareId: number;
    installDate?: string | null;
    licenseKey?: string | null;
}

export interface DeviceSoftwareSyncDto {
    deviceId: number;
    items: DeviceSoftwareSyncItemDto[];
}
