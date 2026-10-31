// Batch of forms currently waiting at a terminal level, approved in one go. DepartmentManager batches per department;
// WorkshopManager/GeneralDirector are company-wide. Forms still at intermediate steps are not batched.

import type { OtFormEmployeeDto, ProcessPartDto } from "@/modules/attendance/types/ot-form.dto";

// OtFormBatchStatus: 0=Pending, 1=Processed (done or auto-closed when no valid forms remain).
// departmentId is null for company-wide batches; scopeNameVn is then the job title name.
export interface OtFormBatchListItemDto {
    id: number;
    terminalLevel: number;
    departmentId: number | null;
    scopeNameVn: string;
    scopeNameJp: string | null;
    batchDate: string;
    status: number;
    formCount: number;
    employeeCount: number;
    totalHour: number;
    createdAt: string;
    processedAt: string | null;
    processedByFullName: string | null;
}

// Only active (not removed) employees.
export interface OtFormBatchItemDto {
    otFormId: number;
    // Null for production-line forms (isProductionForm = true).
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
    reasonNameVn: string;
    reasonNameJp: string | null;
    otCaseCode: string;
    otCaseDescription: string | null;
    otCaseDescriptionJp: string | null;
    date: string;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    createdByUserName: string;
    createdByFullName: string | null;
    numberOfEmployee: number;
    processPart: ProcessPartDto | null;
    employees: OtFormEmployeeDto[];
}

// otForms only lists forms whose current pending step is still this batch's level.
export interface OtFormBatchDto {
    id: number;
    terminalLevel: number;
    departmentId: number | null;
    scopeNameVn: string;
    scopeNameJp: string | null;
    batchDate: string;
    status: number;
    createdAt: string;
    processedAt: string | null;
    processedByUserName: string | null;
    processedByFullName: string | null;
    otForms: OtFormBatchItemDto[];
}

// OtFormBatchFormDecision: 0=Approve, 1=Reject.
export interface ProcessOtFormBatchFormDto {
    otFormId: number;
    decision: number;
    rejectReason: string | null;
    excludedEmployeeIds: number[] | null;
}

// forms must match the batch's valid otFormId set exactly.
export interface ProcessOtFormBatchDto {
    secondaryPassword: string;
    forms: ProcessOtFormBatchFormDto[];
}
