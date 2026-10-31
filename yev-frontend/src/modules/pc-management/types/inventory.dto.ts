// ItemStatus: 0=Pending, 1=Found, 2=Missing. SessionStatus: 0=InProgress, 1=Completed.
export interface InventorySessionItemDto {
    id: number;
    deviceId: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeName: string | null;
    manager: string | null;
    groupName: string | null;
    departmentName: string | null;
    serialNumber: string | null;
    scannedAt: string | null;
    scannedBy: string | null;
    status: number;
    statusText: string;
    note: string | null;
}

export interface InventorySessionDto {
    id: number;
    branchId: number;
    branchName: string | null;
    startedAt: string;
    startedBy: string;
    endedAt: string | null;
    endedBy: string | null;
    status: number;
    statusText: string;
    totalCount: number;
    foundCount: number;
    missingCount: number;
    items: InventorySessionItemDto[];
}

export interface EndInventoryItemInputDto {
    inventorySessionItemId: number;
    note?: string | null;
}

export interface EndInventorySessionDto {
    items: EndInventoryItemInputDto[];
}

// One branch per user, but several users may share a branch (unlike ServerCheckAssignment).
export interface InventoryAssignmentDto {
    id: number;
    userId: number;
    userName: string;
    fullName: string | null;
    branchId: number;
    branchName: string;
}

export interface SaveInventoryAssignmentDto {
    userId: number;
    userName: string;
    fullName?: string | null;
    branchId: number;
}
