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

// delegatorEmployeeId KHÔNG có trong DTO gửi lên — luôn resolve = người dùng hiện tại ở BE
// (workflow-module.md §7, mirror CreatedByEmployeeId).
export interface CreateUpdateApprovalDelegationDto {
    delegateEmployeeId: number;
    formDefinitionId: number | null;
    fromDate: string;
    toDate: string;
    reason: string | null;
}
