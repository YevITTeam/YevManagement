export interface DeviceListReportItemDto {
    stt: number;
    deviceCode: string;
    deviceName: string;
    ipAddress: string | null;
    purchaseDate: string | null;
    expirationDate: string | null;
    isExpired: boolean;
    financialPeriod: number | null;
    note: string | null;
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
