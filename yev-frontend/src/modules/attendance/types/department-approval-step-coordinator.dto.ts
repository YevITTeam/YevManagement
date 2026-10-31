// Hand-picked by Admin (not inferred from job title), limited to employees of the department; replace-whole-list API.
export interface DepartmentApprovalStepCoordinatorDto {
    id: number;
    departmentId: number;
    employeeId: number;
    employeeCode: string;
    fullName: string;
    // null = employee has no linked login yet; still assignable, rights take effect once Admin links the account.
    userName: string | null;
}

export interface ReplaceDepartmentApprovalStepCoordinatorsDto {
    employeeIds: number[];
}
