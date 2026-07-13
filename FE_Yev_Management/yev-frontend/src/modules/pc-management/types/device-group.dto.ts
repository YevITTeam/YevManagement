// docs/asset-api-fe.md §2.1 (2026-07-13) — mỗi Nhóm bắt buộc thuộc về 1 DeviceDepartment
// (1 Bộ phận - N Nhóm). departmentName server tự gộp sẵn, FE không cần gọi thêm API.
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
