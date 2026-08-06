// "Đơn tổng" — gom nhiều OtForm đang chờ đúng cấp Trưởng phòng (status=0 Pending) của cùng 1 Phòng
// ban, duyệt 1 lần. Schema theo docs/attendance-api-fe.md §Đơn tổng.

import type { OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";

// OtFormBatchStatus: 0=Pending (đang chờ Trưởng phòng), 1=Processed (đã xử lý).
export interface OtFormBatchListItemDto {
    id: number;
    departmentId: number;
    departmentNameVn: string;
    departmentNameJp: string | null;
    batchDate: string;
    status: number;
    formCount: number;
    employeeCount: number;
    totalHour: number;
    createdAt: string;
    processedAt: string | null;
    processedByFullName: string | null;
}

// 1 đơn nhỏ trong đơn tổng — chỉ gồm nhân viên ĐANG active (chưa bị loại).
export interface OtFormBatchItemDto {
    otFormId: number;
    groupNameVn: string;
    groupNameJp: string | null;
    reasonNameVn: string;
    reasonNameJp: string | null;
    otCaseCode: string;
    date: string;
    startTime: string;
    endTime: string;
    totalHour: number;
    createdByUserName: string;
    createdByFullName: string | null;
    numberOfEmployee: number;
    employees: OtFormEmployeeDto[];
}

// Chi tiết GET /api/OtFormBatch/{id} (và GET /email-confirm/{token}) — otForms chỉ còn các đơn VẪN
// CÒN Status==Pending (còn hiệu lực xử lý).
export interface OtFormBatchDto {
    id: number;
    departmentId: number;
    departmentNameVn: string;
    departmentNameJp: string | null;
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

// Body POST /api/OtFormBatch/{id}/approve (và /email-confirm/{token}/approve) — forms phải khớp
// CHÍNH XÁC tập otFormId còn hiệu lực của batch.
export interface ProcessOtFormBatchDto {
    secondaryPassword: string;
    forms: ProcessOtFormBatchFormDto[];
}
