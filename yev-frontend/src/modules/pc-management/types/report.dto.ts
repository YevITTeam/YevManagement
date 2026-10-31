export interface DeviceListReportItemDto {
    stt: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeName: string;
    serialNumber: string | null;
    ipAddress: string | null;
    email: string | null;
    manager: string;
    branchName: string;
    departmentName: string | null;
    groupName: string | null;
    supplierName: string;
    purchaseDate: string | null;
    expirationDate: string | null;
    isExpired: boolean;
    financialPeriod: number | null;
}

export interface DeviceReportDistributionItemDto {
    label: string;
    count: number;
}

export interface DeviceReportExpiringItemDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    branchName: string;
    manager: string;
    expirationDate: string | null;
    daysRemaining: number;
}

// Aggregated by BE (COUNT/GROUP BY) instead of FE loading the whole Device table.
export interface DeviceReportSummaryDto {
    totalCount: number;
    inUseCount: number;
    pendingUseCount: number;
    expiringSoonCount: number;
    branchDistribution: DeviceReportDistributionItemDto[];
    deviceTypeDistribution: DeviceReportDistributionItemDto[];
    expiringDevices: DeviceReportExpiringItemDto[];
}
