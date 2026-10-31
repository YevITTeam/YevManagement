import type { DeviceSoftwareDeviceDto } from "@/modules/pc-management/types/device-software.dto";
import type { DeviceConfigurationDto } from "@/modules/pc-management/types/device-configuration.dto";

export interface DeviceIpAddressDto {
    id: number;
    ipAddress: string;
}

export interface DeviceEmailDto {
    id: number;
    email: string;
    note: string | null;
}

// No id: the server matches by email value.
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
    groupName: string | null;
    departmentName: string | null;
    // Plain strings here, unlike DeviceGetDto.ipAddresses (objects {id, ipAddress}).
    ipAddresses: string[];
    purchaseDate: string | null;
    manager: string;
    // DOMAIN\user of the machine user (Tanium sync or manual).
    managerDomainAccount: string | null;
    expirationDate: string | null;
    note: string | null;
    emails: string[];
    status: number;
    statusText: string;
    isOutsourced: boolean;
    serialNumber: string | null;
    isUseUsb: boolean;
    requiresDailyCheck: boolean;
}

export interface CreateUpdateDeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    groupId: number | null;
    departmentId: number | null;
    // Optional because an unused device has no user yet; the note is the required field instead.
    manager: string;
    // DOMAIN\user (e.g. YEV\nam.nguyen); links the emails to Identity.
    managerDomainAccount: string | null;
    emails: DeviceEmailInputDto[];
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string;
    serialNumber: string | null;
    isUseUsb: boolean;
    // Physically present in the server room with a QR label, so it must be scanned daily; virtual servers or
    // switches spread around the factory stay false and are only pinged.
    requiresDailyCheck: boolean;
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
    groupId: number | null;
    groupName: string | null;
    departmentId: number | null;
    departmentName: string | null;
    manager: string;
    // DOMAIN\user of the machine user (Tanium sync or manual).
    managerDomainAccount: string | null;
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
    requiresDailyCheck: boolean;
    ipAddresses: DeviceIpAddressDto[];
    // New device suggested to replace this (old) one, from the Excel import's old-device-code column; display only.
    suggestedNewDeviceId: number | null;
    suggestedNewDeviceCode: string | null;
}

export interface DeviceReplacementSuggestionDto {
    id: number;
    deviceCode: string;
    deviceName: string;
}

// configuration is null when none has been entered.
export interface DeviceDetailDto {
    device: DeviceGetDto;
    configuration: DeviceConfigurationDto | null;
    softwares: DeviceSoftwareDeviceDto[];
}

// Skipped during bulk delete (e.g. still referenced elsewhere), with the BE reason.
export interface SkippedDeviceDto {
    id: number;
    deviceCode: string;
    reason: string;
}

export interface BulkDeleteResultDto {
    deletedCount: number;
    skippedDevices: SkippedDeviceDto[];
}
