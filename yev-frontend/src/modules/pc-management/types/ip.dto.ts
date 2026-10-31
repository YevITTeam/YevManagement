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

// Only status + note are editable; IpAddresses are generated via IpPrefix, never created/deleted manually.
export interface IpAddressUpdateDto {
  status: number,
  note: string | null
}

// status accepts only 0/1 (2 comes from device assign/unassign); updateNote=false keeps each IP's own note.
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
    // null for legacy prefixes created before branches were assigned.
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

// prefix is immutable; only branch and network config are editable.
export interface IpPrefixUpdateDto {
    branchId: number,
    subnetMask: string | null,
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null
}
