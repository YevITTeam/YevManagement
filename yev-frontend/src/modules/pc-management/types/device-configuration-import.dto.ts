// Xem docs/asset-api-fe.md §6.3 — import cấu hình phần cứng hàng loạt từ file kiểm kê Tanium.
// Khác device-import: CHỈ cập nhật Device đã có sẵn, không tự tạo Device mới.

// Dữ liệu thô đọc được từ 1 dòng file Tanium — dùng chung cho response preview và request confirm.
// Format file 10 cột: Computer Name, Tanium IP, Last Logged In User, Custom Registry UserEmail, Manufacturer,
// Model, Computer Serial Number, CPU, Total Memory, Size. File theo format cũ sẽ đọc lệch cột.
export interface DeviceConfigurationImportRowDto {
    computerName: string;
    taniumIpAddress: string | null;
    // Cột "Last Logged In User" (DOMAIN\user hoặc Local\user).
    lastLoggedInUser: string | null;
    // Ô "Custom Registry UserEmail" nguyên văn: có thể nhiều email (xuống dòng) hoặc [NOT_FOUND].
    userEmail: string | null;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    cpu: string | null;
    ram: string | null;
    size: string | null;
}

// Item trả về từ bước preview — thêm mã/tên tách được, các Id đã tra sẵn + kết quả validate.
export interface DeviceConfigurationImportPreviewRowDto extends DeviceConfigurationImportRowDto {
    rowNumber: number;
    parsedDeviceCode: string;
    parsedDeviceName: string;
    resolvedDeviceId: number | null;
    resolvedIpAddressId: number | null;
    // null = serial sẽ KHÔNG được ghi (trống, đang thuộc Device khác, hoặc lặp nhiều dòng trong file).
    resolvedSerialNumber: string | null;
    // null = không ghi (trống hoặc là tài khoản Local).
    resolvedManagerDomainAccount: string | null;
    // Email hợp lệ tách được từ ô email; email máy chưa có sẽ được thêm khi xác nhận.
    resolvedEmails: string[];
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface DeviceConfigurationImportPreviewResultDto {
    rows: DeviceConfigurationImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    // Số dòng Computer Name không thuộc 5 họ mã (YDC/YLC/YDF/AC/TYC), bị loại thầm lặng trước khi vào "rows".
    outOfScopeSkippedCount: number;
}

// Response của BE KHÔNG có skippedRows/skippedCount (khác Device Import) — endpoint
// này vẫn re-validate + atomic theo request gửi lên (xem docs/asset-api-fe.md §6.3).
// Để cho phép Confirm dù còn dòng lỗi mà không rủi ro bị BE từ chối cả batch, FE tự
// lọc bỏ các dòng isValid=false trước khi gửi (xem ImportDeviceConfigurationDialog).
export interface DeviceConfigurationImportConfirmResultDto {
    createdConfigCount: number;
    updatedConfigCount: number;
    ipReassignedCount: number;
    serialUpdatedCount: number;
    managerAccountUpdatedCount: number;
    emailAddedCount: number;
    updatedDeviceIds: number[];
}

// 1 dòng của báo cáo đối chiếu hiện trên màn hình (POST /DeviceConfigurationImport/missing-devices) — thiết bị đang
// "Đang sử dụng" trong hệ thống nhưng không có trong file Tanium. Cùng cột với file Excel tải về.
export interface DeviceMissingInTaniumDto {
    deviceCode: string;
    deviceName: string;
    serialNumber: string | null;
    branchName: string;
    deviceTypeName: string;
    groupName: string | null;
    departmentName: string | null;
    manager: string;
    ipAddress: string | null;
    note: string | null;
}

// Kết quả tải "Báo cáo đối chiếu Tanium" (POST /DeviceConfigurationImport/missing-devices-report) —
// BE trả về file .xlsx (không phải JSON), missingCount đọc từ header X-Missing-Device-Count để FE
// hiện toast tóm tắt mà không cần mở file ra đếm.
export interface MissingDevicesReportResultDto {
    blob: Blob;
    fileName: string;
    missingCount: number;
}
