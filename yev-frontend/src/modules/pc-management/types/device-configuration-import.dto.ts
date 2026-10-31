// Tanium hardware import only updates existing Devices, never creates them.

// Shared by preview and confirm. Expects the 10-column Tanium export (Computer Name, Tanium IP, Last Logged In User,
// Custom Registry UserEmail, Manufacturer, Model, Computer Serial Number, CPU, Total Memory, Size); older formats misalign.
export interface DeviceConfigurationImportRowDto {
    computerName: string;
    taniumIpAddress: string | null;
    // DOMAIN\user or Local\user.
    lastLoggedInUser: string | null;
    // Raw cell: may hold several newline-separated emails or [NOT_FOUND].
    userEmail: string | null;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    cpu: string | null;
    ram: string | null;
    size: string | null;
}

// Mirrors BE DomainAccountState.
export const DomainAccountState = {
    ExistsInIdentity: 0,
    WillCreate: 1,
    Created: 2,
    Disabled: 3,
    NotInDirectory: 4,
    DirectoryUnavailable: 5,
    Failed: 6,
} as const;

export interface DeviceConfigurationImportPreviewRowDto extends DeviceConfigurationImportRowDto {
    rowNumber: number;
    parsedDeviceCode: string;
    // Raw Computer Name written as the device name; null = unchanged.
    resolvedDeviceName: string | null;
    resolvedDeviceId: number | null;
    resolvedIpAddressId: number | null;
    // null = serial not written (empty, owned by another Device, or repeated in the file).
    resolvedSerialNumber: string | null;
    // null = not written (empty or a Local account).
    resolvedManagerDomainAccount: string | null;
    // null = row has no domain account.
    accountState: number | null;
    // Valid emails parsed from the cell; ones the device lacks are added on confirm.
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
    // Rows outside the 5 code families (YDC/YLC/YDF/AC/TYC), silently dropped before "rows".
    outOfScopeSkippedCount: number;
}

// Unlike Device Import, BE returns no skippedRows and rejects the whole batch on any invalid row,
// so FE drops isValid=false rows before sending.
export interface DeviceConfigurationImportConfirmResultDto {
    createdConfigCount: number;
    updatedConfigCount: number;
    ipReassignedCount: number;
    serialUpdatedCount: number;
    deviceNameUpdatedCount: number;
    managerAccountUpdatedCount: number;
    emailAddedCount: number;
    // Only set when createMissingUsers = true.
    usersCreatedCount: number;
    usersSkippedCount: number;
    usersUnavailableCount: number;
    usersFailedCount: number;
    updatedDeviceIds: number[];
}

// In-use devices missing from the Tanium file; same columns as the downloadable Excel.
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

// BE returns .xlsx, not JSON; missingCount comes from the X-Missing-Device-Count header for the toast.
export interface MissingDevicesReportResultDto {
    blob: Blob;
    fileName: string;
    missingCount: number;
}
