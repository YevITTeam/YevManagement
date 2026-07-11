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

export interface IpPrefixDto {
    id: number,
    prefix: string,
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
    subnetMask: string | null,
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null
}
