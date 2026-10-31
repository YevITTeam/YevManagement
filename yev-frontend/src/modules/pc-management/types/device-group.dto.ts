// Every group belongs to exactly one department; departmentName is joined by the server.
export interface DeviceGroupDto {
    id: number,
    groupCode: string,
    groupName: string,
    departmentId: number,
    departmentName: string
}

export interface DeviceGroupCreateUpdateDto {
    departmentId: number,
    groupCode: string,
    groupName: string
}
