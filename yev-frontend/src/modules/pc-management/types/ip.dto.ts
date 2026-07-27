export interface IpAddressDto {
    id: number,
    ipAddress: string,
    deviceId: number | null,
    deviceCode: string | null,
    ipPrefixId: number,
    prefix: string,
    prefixSubnetMask: string | null,
    prefixGateway: string | null,
    prefixPreferredDns: string | null,
    prefixAlternateDns: string | null,
    status: number,
    statusText: string,
    note: string | null
}

// docs/asset-api-fe.md §4.2 (2026-07-11) — PUT /api/IpAddress/{id} chỉ còn nhận
// status + note; không còn tạo/xoá IpAddress thủ công (chỉ sinh hàng loạt qua IpPrefix).
export interface IpAddressUpdateDto {
  status: number,
  note: string | null
}

// docs/asset-api-fe.md §4.2 — PUT /api/IpAddress/bulk-status. status chỉ nhận 0/1
// (2 chỉ đến từ assign/unassign). updateNote=false giữ nguyên note riêng từng IP.
export interface IpAddressBulkStatusDto {
  ids: number[],
  status: number,
  updateNote: boolean,
  note: string | null
}

export interface IpAddressSkippedDto {
  id: number,
  ipAddress: string,
  reason: string
}

export interface IpAddressBulkStatusResultDto {
  updatedCount: number,
  status: number,
  statusText: string,
  skippedIpAddresses: IpAddressSkippedDto[]
}

export interface IpPrefixDto {
    id: number,
    prefix: string,
    // null nếu dải cũ tạo trước 2026-07-13 chưa gán Chi nhánh (docs/asset-api-fe.md §4.1).
    branchId: number | null,
    branchName: string | null,
    subnetMask: string | null,
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null,
    usedIpCount: number,
    availableIpCount: number
}

export interface IpPrefixCreateDto {
    prefix: string,
    branchId: number,
    subnetMask: string | null,
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null
}

// docs/asset-api-fe.md §4.1 (2026-07-13) — PUT không có prefix (bất biến), chỉ sửa
// Chi nhánh + cấu hình mạng.
export interface IpPrefixUpdateDto {
    branchId: number,
    subnetMask: string | null,
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null
}
