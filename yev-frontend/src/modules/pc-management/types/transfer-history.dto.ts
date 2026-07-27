export interface CreateTransferHistoryDto {
    oldDeviceId: number;
    newDeviceId: number;
    note: string | null;
}

export interface TransferHistoryDto {
    id: number;
    oldDeviceId: number;
    oldDeviceCode: string;
    oldDeviceName: string;
    newDeviceId: number;
    newDeviceCode: string;
    newDeviceName: string;
    transferDate: string;
    note: string | null;
}
