export interface ApprovalDelegationDto {
    id: number;
    delegatorEmployeeId: number;
    delegatorName: string;
    delegateEmployeeId: number;
    delegateName: string;
    fromDate: string;
    toDate: string;
    reason: string | null;
    isActive: boolean;
    isMine: boolean;
}

export interface DelegateOptionDto {
    employeeId: number;
    code: string;
    fullName: string;
    userName: string;
    jobTitleName: string;
}

// The delegator is always the caller on the BE, never sent from here.
export interface CreateUpdateApprovalDelegationDto {
    delegateEmployeeId: number;
    fromDate: string;
    toDate: string;
    reason: string | null;
}
