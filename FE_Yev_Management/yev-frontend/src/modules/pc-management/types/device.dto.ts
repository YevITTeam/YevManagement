import type { DeviceSoftwareDeviceDto } from "@/modules/pc-management/types/device-software.dto";
import type { DeviceConfigurationDto } from "@/modules/pc-management/types/device-configuration.dto";

// 2026-07-11: Device hỗ trợ nhiều IP + nhiều email — xem docs/asset-api-fe.md §5.3/5.5.
export interface DeviceIpAddressDto {
    id: number;
    ipAddress: string;
}

// Item email gắn với Device khi lấy chi tiết (GET /{id}, /{id}/detail) — có id + note riêng.
export interface DeviceEmailDto {
    id: number;
    email: string;
    note: string | null;
}

// Item email gửi lên khi Create/Update Device — không có id (server tự khớp theo giá trị email).
export interface DeviceEmailInputDto {
    email: string;
    note: string | null;
}

export interface DeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    branchName: string;
    supplierName: string;
    deviceTypeName: string;
    // Grid-list trả thẳng mảng string (giống emails), khác với DeviceGetDto.ipAddresses ở mục 5.3 (mảng object {id, ipAddress}).
    ipAddresses: string[];
    purchaseDate: string | null;
    manager: string;
    expirationDate: string | null;
    note: string | null;
    emails: string[];
    status: number;
    statusText: string;
    isOutsourced: boolean;
    serialNumber: string | null;
    isUseUsb: boolean;
}

export interface CreateUpdateDeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    manager: string;
    emails: DeviceEmailInputDto[];
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string | null;
    serialNumber: string | null;
    isUseUsb: boolean;
    ipAddressIds: number[];
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
    emails: DeviceEmailDto[];
    purchaseDate: string;
    depreciationMonths: number;
    expirationDate: string | null;
    isOutsourced: boolean;
    status: number;
    statusText: string;
    note: string | null;
    serialNumber: string | null;
    isUseUsb: boolean;
    ipAddresses: DeviceIpAddressDto[];
}

// API tổng hợp GET /Device/{id}/detail — configuration null nếu chưa nhập cấu hình.
// DeviceConfigurationDto định nghĩa tại device-configuration.dto.ts (dùng chung).
export interface DeviceDetailDto {
    device: DeviceGetDto;
    configuration: DeviceConfigurationDto | null;
    softwares: DeviceSoftwareDeviceDto[];
}
