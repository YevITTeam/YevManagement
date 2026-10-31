// date: DateOnly "yyyy-MM-dd"; startTime/endTime: TimeOnly "HH:mm:ss".

export interface CheckOtFormOverlapEmployeeDto {
    employeeId: number;
    startTime: string | null;
    endTime: string;
}

export interface CheckOtFormOverlapDto {
    date: string;
    startTime: string;
    employees: CheckOtFormOverlapEmployeeDto[];
    excludeFormId?: number | null;
}

// Entered manually for the whole form; only meaningful when isEat=true.
export interface ProcessPartDto {
    isEat: boolean;
    mainTicketCount: number;
    secondaryTicketCount: number;
    milkCount: number;
    isTransportation: boolean;
    isUseCopyRoom: boolean;
    anotherSuggestionVn: string | null;
    anotherSuggestionJp: string | null;
}

// startTime: per-employee start within the form's range; null = form's startTime.
// didEat: only matters at or above setting.mainMealTicketMinHours, BE ignores it below.
export interface OtFormEmployeeInputDto {
    employeeId: number;
    startTime: string | null;
    endTime: string;
    didEat: boolean;
    noteVn: string | null;
    noteJp: string | null;
}

// Removed employees stay in the array so history (who/when/why) can be shown; FE hides them from print and totals.
// numberOfEmployee counts only non-removed employees.
export interface OtFormEmployeeDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    startTime: string;
    endTime: string;
    noteVn: string | null;
    noteJp: string | null;
    monthToDate: number;
    yearToDate: number;
    // Read live (not snapshotted like monthToDate/yearToDate); null = global default.
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
    // 0=no ticket, 1=secondary, 2=main (see lib/mealTicket.ts).
    mealTicketType: number;
    // BE already deducted the meal break when applicable; always use this for display/totals, never recompute from start/end.
    actualHours: number;
    // Drives whether actualHours gets the meal-break deduction (BE-computed), except for exact early-window shifts.
    didEat: boolean;
    isRemoved: boolean;
    removedByUserName: string | null;
    removedByFullName: string | null;
    // StepOrder of the step pending at removal time (field name kept for compatibility).
    removedAtLevel: number | null;
    removedAt: string | null;
    removeReason: string | null;
    // Snapshot at the time of adding; only set for production-line forms (isProductionForm = true).
    congDoanSnapshot: string | null;
    taskNameSnapshot: string | null;
    blockCodeSnapshot: string | null;
    teamCodeSnapshot: string | null;
    shiftTeamCodeSnapshot: string | null;
}

// Derived from the caller's Employee.GroupId; at most one item. Empty = Admin (unrestricted) or account not linked
// to an Employee, FE distinguishes the two.
export interface MyCreateScopeItemDto {
    groupId: number;
    groupNameVn: string;
    departmentId: number;
    departmentNameVn: string;
}

// Team/Line/shift combos where the caller is Line Leader, used to prefill and lock the dropdowns.
// Empty = Admin (unrestricted) or not a Line Leader, dropdowns stay free.
export interface MyProductionCreateScopeItemDto {
    // Caller's own department, identical across items.
    departmentId: number;
    departmentNameVn: string;
    productionLineId: number;
    lineCode: string;
    lineNameVn: string | null;
    teamId: number;
    teamCode: string;
    teamNameVn: string | null;
    shiftTeamId: number;
    shiftTeamCode: string;
    shiftTeamNameVn: string | null;
}

// Signature is taken by BE from UserSignature/me. Group forms need groupId (isProductionForm=false); production-line
// forms send groupId=null, isProductionForm=true. secondaryPassword is re-verified by BE.
export interface CreateOtFormDto {
    groupId: number | null;
    isProductionForm: boolean;
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
    secondaryPassword: string;
}

// noteVn/noteJp let leaders comment per employee on production-line forms instead of on paper.
export interface UpdateOtFormEmployeeTimeDto {
    employeeId: number;
    // null = keep the current start time.
    startTime: string | null;
    endTime: string;
    didEat: boolean;
    noteVn: string | null;
    noteJp: string | null;
}

export interface UpdateOtFormRemovedEmployeeDto {
    employeeId: number;
    reason: string;
}

// Office forms only: general info editable after creation (everything but Department/Group). The OT case
// is re-derived by the server from date + hours.
export interface UpdateOtFormHeaderDto {
    date: string;
    startTime: string;
    endTime: string;
    reasonId: number;
    subReason: string | null;
    processPart: ProcessPartDto | null;
}

// Each employees item is existing (edit) or new (BE diffs against active ones); new production-line employees must share
// the form's Line/shift. Anyone in neither employees nor removedEmployees is a BE error. One secondaryPassword per save.
export interface UpdateOtFormDto {
    header: UpdateOtFormHeaderDto | null;
    employees: UpdateOtFormEmployeeTimeDto[];
    removedEmployees: UpdateOtFormRemovedEmployeeDto[];
    secondaryPassword: string;
    // Required when the save re-submits a rejected or Manager-signed form (resubmitKind set).
    resubmitReason?: string | null;
}

// Trimmed OtFormApprovalHistoryDto shared by all list endpoints (no comment/signature fields).
export interface OtFormApprovalSummaryItemDto {
    stepOrder: number;
    jobTitleNameSnapshot: string;
    approverUserName: string;
    approverFullName: string | null;
    action: number;
    actionAt: string;
}

export interface OtFormListItemDto {
    id: number;
    // Null for production-line forms (isProductionForm = true).
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
    departmentNameVn: string;
    departmentNameJp: string | null;
    workshopNameVn: string;
    otCaseCode: string;
    otCaseDescription: string | null;
    otCaseDescriptionJp: string | null;
    date: string;
    totalHour: number;
    numberOfEmployee: number;
    createdByUserName: string;
    createdByFullName: string | null;
    status: number;
    isEditable: boolean;
    approvalSummary: OtFormApprovalSummaryItemDto[];
    // Eligible handlers of the current pending step (0 if not InApproval); >1 means "one of N", not only you.
    currentStepCandidateCount: number;
    // Distinct production Line/shift values joined by ", " (a form may span lines); null for group forms.
    productionLineNames: string | null;
    productionShiftTeamNames: string | null;
}

// date: DateOnly "yyyy-MM-dd".
export interface PendingApprovalDateCountDto {
    date: string;
    count: number;
}

// ApprovalAction: 0=Submitted, 1=Approved, 2=Rejected.
export interface OtFormApprovalHistoryDto {
    approverUserName: string;
    approverFullName: string | null;
    // Set when the approver acted by delegation: the delegator they covered.
    onBehalfOfUserName: string | null;
    onBehalfOfFullName: string | null;
    stepOrder: number;
    jobTitleNameSnapshot: string;
    action: number;
    comment: string | null;
    hasSignature: boolean;
    signatureImage: string | null;
    actionAt: string;
}

// A holder of this step's job title in the department at snapshot time (a step may have several).
export interface OtFormApprovalStepCandidateDto {
    employeeId: number;
    userName: string;
    fullName: string;
}

// Approval chain snapshotted at creation. status: 0=Pending, 1=Approved, 2=Rejected, 3=Skipped.
// terminalLevelSnapshot: 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
export interface OtFormApprovalStepDto {
    id: number;
    stepOrder: number;
    jobTitleCodeSnapshot: string;
    jobTitleNameSnapshot: string;
    requiresSignatureSnapshot: boolean;
    isResponsibleSnapshot: boolean;
    terminalLevelSnapshot: number;
    status: number;
    candidates: OtFormApprovalStepCandidateDto[];
    // Pending steps only: who currently covers a candidate by delegation.
    delegates: OtFormApprovalStepDelegateDto[];
}

export interface OtFormApprovalStepDelegateDto {
    delegatorUserName: string;
    delegateFullName: string;
}

// actionType: 0=TimeChanged, 1=NoteChanged, 2=EmployeeAdded, 3=EmployeeRemoved, 4=FormInfoChanged (employeeId null).
// fieldName is null for EmployeeAdded/EmployeeRemoved.
export interface OtFormEditLogDto {
    actionByUserName: string;
    actionByFullName: string | null;
    actionAt: string;
    actionType: number;
    employeeId: number | null;
    employeeCodeSnapshot: string | null;
    fieldName: string | null;
    oldValue: string | null;
    newValue: string | null;
}

export interface OtFormDto {
    id: number;
    // Null for production-line forms (isProductionForm = true).
    groupId: number | null;
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
    departmentId: number;
    departmentNameVn: string;
    departmentNameJp: string | null;
    reasonId: number;
    reasonNameVn: string;
    reasonNameJp: string | null;
    otCaseId: number;
    otCaseCode: string;
    otCaseDescription: string | null;
    otCaseDescriptionJp: string | null;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    date: string;
    numberOfEmployee: number;
    createdByUserName: string;
    createdByFullName: string | null;
    // UTC ISO; used as the signing time when printing a self-signed form (no history row to read actionAt from).
    createdAt: string;
    // base64 creator signature; only set when the creator ranks at or above every mandatory intermediate step (self-signs).
    creatorSignatureImage: string | null;
    status: number;
    isEditable: boolean;
    // OtFormResubmitKind: 1 = rejected, creator fixes and restarts the chain; 2 = Manager-signed, re-sign up to the Manager.
    resubmitKind: number | null;
    // Accounts allowed to re-submit; Admin may also re-sign (kind 2).
    resubmitUserNames: string[];
    resubmitDeadline: string | null;
    // Chain inference warning (null when complete), shown as a banner.
    approvalChainWarning: string | null;
    employees: OtFormEmployeeDto[];
    processPart: ProcessPartDto | null;
    approvalHistories: OtFormApprovalHistoryDto[];
    // Sorted by stepOrder.
    approvalSteps: OtFormApprovalStepDto[];
    // Newest first.
    editLogs: OtFormEditLogDto[];
}

// Signature is taken by BE from UserSignature/me; secondaryPassword is re-verified before writing.
export interface ApproveOtFormDto {
    comment: string | null;
    secondaryPassword: string;
}

export interface RejectOtFormDto {
    comment: string;
    secondaryPassword: string;
}

// Comment/SecondaryPassword shared by the batch; BE processes each form independently (one failure doesn't cancel others).
export interface BulkApproveOtFormDto {
    otFormIds: number[];
    comment: string | null;
    secondaryPassword: string;
}

export interface BulkRejectOtFormDto {
    otFormIds: number[];
    comment: string;
    secondaryPassword: string;
}

export interface BulkOtFormActionResultItemDto {
    otFormId: number;
    success: boolean;
    error: string | null;
}

// Admin only; permanently deletes a stuck form. BE returns 400 if Completed (accumulation already counted).
export interface DeleteOtFormDto {
    reason: string;
}

// The email channel re-verifies the secondary password.
export interface RemoveOtFormEmployeeByEmailTokenDto {
    employeeId: number;
    reason: string;
    secondaryPassword: string;
}

// In-app (JWT) channel, separate from UpdateOtFormDto: uses the "current pending step candidate" rule so non-creator
// approvers can remove too. No secondaryPassword, the JWT session is enough.
export interface RemoveOtFormEmployeeDto {
    employeeId: number;
    reason: string;
}
