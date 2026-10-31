// Same as DepartmentApprovalStepCoordinatorDto but scoped to a group.
export interface GroupApprovalStepCoordinatorDto {
    id: number;
    groupId: number;
    employeeId: number;
    employeeCode: string;
    fullName: string;
    // null = no linked login yet; see DepartmentApprovalStepCoordinatorDto.userName.
    userName: string | null;
}

export interface ReplaceGroupApprovalStepCoordinatorsDto {
    employeeIds: number[];
}
