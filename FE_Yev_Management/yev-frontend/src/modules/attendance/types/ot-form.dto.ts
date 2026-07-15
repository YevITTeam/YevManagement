// Schema theo docs/attendance-api-fe.md §4. date: DateOnly "yyyy-MM-dd" — startTime/endTime: TimeOnly "HH:mm:ss".

export interface ProcessPartDto {
    isEat: boolean;
    isTransportation: boolean;
    isUseCopyRoom: boolean;
    anotherSuggestionVn: string | null;
    anotherSuggestionJp: string | null;
}

export interface OtFormEmployeeInputDto {
    employeeId: number;
    startTime: string;
    endTime: string;
    noteVn: string | null;
    noteJp: string | null;
}

export interface OtFormEmployeeDto extends OtFormEmployeeInputDto {
    employeeCode: string;
    fullName: string;
}

// Body POST /api/OtForm — §4.1.
export interface CreateOtFormDto {
    groupId: number;
    departmentId: number;
    reasonId: number;
    otCaseId: number;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    date: string;
    employees: OtFormEmployeeInputDto[];
    processPart: ProcessPartDto | null;
    submitterSignatureImage: string;
}

// Item bảng my-forms / pending-approvals — §4.2.
export interface OtFormListItemDto {
    id: number;
    groupNameVn: string;
    departmentNameVn: string;
    otCaseCode: string;
    date: string;
    totalHour: number;
    numberOfEmployee: number;
    createdByUserName: string;
    status: number;
}

// ApprovalAction (docs §2): 0=Submitted, 1=Approved, 2=Rejected.
export interface OtFormApprovalHistoryDto {
    approverUserName: string;
    approvalLevel: number;
    action: number;
    comment: string | null;
    hasSignature: boolean;
    signatureImage: string | null;
    actionAt: string;
}

// Chi tiết GET /api/OtForm/{id} — §4.3.
export interface OtFormDto {
    id: number;
    groupId: number;
    groupNameVn: string;
    departmentId: number;
    departmentNameVn: string;
    reasonId: number;
    reasonNameVn: string;
    otCaseId: number;
    otCaseCode: string;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    date: string;
    numberOfEmployee: number;
    createdByUserName: string;
    status: number;
    employees: OtFormEmployeeDto[];
    processPart: ProcessPartDto | null;
    approvalHistories: OtFormApprovalHistoryDto[];
}

// Body POST /api/OtForm/{id}/approve — §4.4.
export interface ApproveOtFormDto {
    comment: string | null;
    signatureImage: string | null;
}

// Body POST /api/OtForm/{id}/reject — §4.5.
export interface RejectOtFormDto {
    comment: string;
}
