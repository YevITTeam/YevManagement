export interface ApprovalDelegationDto {
    id: number;
    delegatorEmployeeId: number;
    delegatorEmployeeName: string;
    delegateEmployeeId: number;
    delegateEmployeeName: string;
    formDefinitionId: number | null;
    formDefinitionNameVn: string | null;
    fromDate: string;
    toDate: string;
    reason: string | null;
}

// No delegatorEmployeeId: BE always resolves it to the current user.
export interface CreateUpdateApprovalDelegationDto {
    delegateEmployeeId: number;
    formDefinitionId: number | null;
    fromDate: string;
    toDate: string;
    reason: string | null;
}
