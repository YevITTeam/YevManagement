export interface IpAddressDto {
    id: number,
    ipAddress: string,
    serverIp: string | null,
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

export interface IpAddressCreateDto{
  ipAddress: string,
  ipPrefixId: number,
  serverIp: string | null,
  deviceId: number | null,
  status: number | null,
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
    ipAddressCount: number
}

export interface IpPrefixCreateDto {
    prefix: string,
    subnetMask: string | null,  
    gateway: string | null,
    preferredDns: string | null,
    alternateDns: string | null,
    description: string | null
}