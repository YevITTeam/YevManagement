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

// GET /Report/device-summary — thống kê cho màn "Báo cáo thiết bị", tính sẵn ở BE (COUNT/GROUP BY)
// thay vì FE tải nguyên bảng Device rồi tự cộng dồn.
export interface DeviceReportSummaryDto {
    totalCount: number;
    inUseCount: number;
    pendingUseCount: number;
    expiringSoonCount: number;
    branchDistribution: DeviceReportDistributionItemDto[];
    deviceTypeDistribution: DeviceReportDistributionItemDto[];
    expiringDevices: DeviceReportExpiringItemDto[];
}
