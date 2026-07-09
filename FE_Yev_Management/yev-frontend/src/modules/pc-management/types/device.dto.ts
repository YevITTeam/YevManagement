import type { DeviceSoftwareDeviceDto } from "@/modules/pc-management/types/device-software.dto";
import type { DeviceConfigurationDto } from "@/modules/pc-management/types/device-configuration.dto";

export interface DeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    branchName: string;
    supplierName: string;
    deviceTypeName: string;
    ipAddress: string | null;
    purchaseDate: string | null;
    manager: string;
    expirationDate: string | null;
    note: string | null;
    email: string | null;
    status: number;
    statusText: string;
    isOutsourced: boolean;
}

export interface CreateUpdateDeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    manager: string;
    email: string;
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string | null;
    ipAddressId: number | null;
}

export interface DeviceGetDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    deviceTypeName: string;
    supplierId: number;
    supplierName: string;
    branchId: number;
    branchName: string;
    manager: string;
    email: string;
    purchaseDate: string;
    depreciationMonths: number;
    expirationDate: string | null;
    isOutsourced: boolean;
    status: number;
    statusText: string;
    note: string | null;
    ipAddressId: number | null;
    ipAddress: string | null;
}

// API tổng hợp GET /Device/{id}/detail — configuration null nếu chưa nhập cấu hình.
// DeviceConfigurationDto định nghĩa tại device-configuration.dto.ts (dùng chung).
export interface DeviceDetailDto {
    device: DeviceGetDto;
    configuration: DeviceConfigurationDto | null;
    softwares: DeviceSoftwareDeviceDto[];
}
