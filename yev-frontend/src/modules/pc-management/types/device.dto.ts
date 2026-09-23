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
    // Tên Nhóm/Bộ phận nếu đã gán (docs/asset-api-fe.md §2/§5.2), null nếu chưa gán.
    groupName: string | null;
    departmentName: string | null;
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
    requiresDailyCheck: boolean;
}

export interface CreateUpdateDeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    // Id Nhóm/Bộ phận nếu có gán (docs/asset-api-fe.md §5.5), null nếu bỏ trống — không bắt buộc.
    groupId: number | null;
    departmentId: number | null;
    // Máy chưa đưa vào dùng thì chưa biết ai sẽ dùng — không bắt buộc (2026-08-01), Ghi chú mới
    // là field bắt buộc để giải thích tình trạng máy.
    manager: string;
    emails: DeviceEmailInputDto[];
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string;
    serialNumber: string | null;
    isUseUsb: boolean;
    // Thiết bị nằm trong phòng server, có dán QR → phải quét trong phiên kiểm tra hằng ngày
    // (asset-api-fe.md §7d.2). Máy cùng loại nhưng không có mặt vật lý (server ảo, switch rải
    // khắp nhà máy) để false — không quét, chỉ nằm trong phạm vi ping (§7d.8).
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
    // 2026-07-13: máy MỚI nào được gợi ý để thay thế CHÍNH máy đang xem này — chỉ có ý nghĩa khi
    // đang xem 1 máy CŨ, gợi ý từ cột "MQL Cũ" lúc import Excel (docs/asset-api-fe.md §5.3/5.10),
    // null nếu không có. Chỉ để hiển thị/tham khảo (đổi tên từ replacesOldDeviceId/Code).
    suggestedNewDeviceId: number | null;
    suggestedNewDeviceCode: string | null;
}

// GET /api/Device/{oldDeviceId}/replacement-suggestion — gợi ý điền sẵn máy mới cho màn "Chuyển máy"
// (docs/asset-api-fe.md §5.9), null nếu không có gợi ý nào.
export interface DeviceReplacementSuggestionDto {
    id: number;
    deviceCode: string;
    deviceName: string;
}

// API tổng hợp GET /Device/{id}/detail — configuration null nếu chưa nhập cấu hình.
// DeviceConfigurationDto định nghĩa tại device-configuration.dto.ts (dùng chung).
export interface DeviceDetailDto {
    device: DeviceGetDto;
    configuration: DeviceConfigurationDto | null;
    softwares: DeviceSoftwareDeviceDto[];
}

// Thiết bị bị bỏ qua khi xoá hàng loạt (vd đang được dùng ở nghiệp vụ khác) kèm lý do từ BE.
export interface SkippedDeviceDto {
    id: number;
    deviceCode: string;
    reason: string;
}

// POST /Device/bulk-delete trả về số lượng xoá thành công + danh sách máy bị bỏ qua (nếu có).
export interface BulkDeleteResultDto {
    deletedCount: number;
    skippedDevices: SkippedDeviceDto[];
}
