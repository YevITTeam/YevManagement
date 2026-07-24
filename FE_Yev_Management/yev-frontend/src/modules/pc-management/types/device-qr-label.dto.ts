// docs/asset-api-fe.md §5.4b — POST /api/Device/qr-labels: in tem QR hàng loạt.
// BE chỉ trả dữ liệu (đủ field + qrPayload dựng sẵn), FE tự vẽ QR và tự dàn layout in.
export interface DeviceQrLabelDto {
    deviceId: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeName: string;
    branchName: string;
    supplierName: string;
    manager: string;
    serialNumber: string | null;
    statusText: string;
    purchaseDate: string;
    // Dòng 1 luôn là deviceCode (app nội bộ tách dòng 1 để tra cứu) — giữ nguyên quy tắc
    // này nếu FE tự dựng lại payload theo field user chọn.
    qrPayload: string;
}
