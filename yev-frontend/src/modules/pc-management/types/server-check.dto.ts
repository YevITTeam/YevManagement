// Khớp asset-api-fe.md §7d. Category: 0=Server, 1=Network, 2=Ups, 3=AirConditioner.
// ItemStatus: 0=Pending (chưa quét), 1=Ok, 2=Ng. SessionStatus: 0=InProgress, 1=Completed.
export interface ServerCheckItemDto {
    id: number;
    deviceId: number;
    deviceCode: string;
    deviceName: string;
    category: number;
    categoryText: string;
    scannedAt: string | null;
    scannedBy: string | null;
    status: number;
    statusText: string;
    note: string | null;
}

export interface ServerCheckManualResultDto {
    manualItemId: number;
    manualItemName: string;
    usesNetworkPing: boolean;
    status: number;
    statusText: string;
    note: string | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
}

export interface ServerCheckSessionDto {
    id: number;
    checkDate: string;
    branchId: number | null;
    branchName: string | null;
    startedAt: string;
    startedBy: string;
    endedAt: string | null;
    endedBy: string | null;
    status: number;
    statusText: string;
    totalCount: number;
    scannedCount: number;
    items: ServerCheckItemDto[];
    manualResults: ServerCheckManualResultDto[];
}

export interface ServerCheckManualItemDto {
    id: number;
    name: string;
    displayOrder: number;
    usesNetworkPing: boolean;
}

// GET /api/ServerCheck/network-ping — pings the IP of every Server/Network/UPS device in scope
// (asset-module.md §1.20) so the "Network - Factory"/"Network - Server" items can be verified
// on the spot instead of by hand. Scope (branch) is configured via AssetSetting.
export interface NetworkPingItemDto {
    ipAddress: string;
    deviceId: number;
    deviceCode: string;
    deviceName: string;
    category: number;
    categoryText: string;
    reachable: boolean;
    roundtripMs: number | null;
}

export interface NetworkPingResultDto {
    totalCount: number;
    reachableCount: number;
    allReachable: boolean;
    items: NetworkPingItemDto[];
}

export interface EndServerCheckItemNoteDto {
    serverCheckItemId: number;
    note?: string | null;
}

export interface EndServerCheckManualResultDto {
    manualItemId: number;
    status: number;
    note?: string | null;
}

export interface EndServerCheckSessionDto {
    items: EndServerCheckItemNoteDto[];
    manualResults: EndServerCheckManualResultDto[];
}

export interface ServerCheckReportRowDto {
    checkDate: string;
    sessionId: number;
    branchId: number | null;
    branchName: string | null;
    sessionStatus: number;
    sessionStatusText: string;
    serverStatus: boolean | null;
    serverNote: string | null;
    networkStatus: boolean | null;
    networkNote: string | null;
    upsStatus: boolean | null;
    upsNote: string | null;
    airConditionerStatus: boolean | null;
    airConditionerNote: string | null;
    manualResults: ServerCheckManualResultDto[];
    checkedBy: string | null;
}

// GET /api/ServerCheckAssignment — mỗi user đúng 1 xưởng (asset-module.md §1.21).
export interface ServerCheckAssignmentDto {
    id: number;
    userId: number;
    userName: string;
    fullName: string | null;
    branchId: number;
    branchName: string;
}

export interface SaveServerCheckAssignmentDto {
    userId: number;
    userName: string;
    fullName?: string | null;
    branchId: number;
}
