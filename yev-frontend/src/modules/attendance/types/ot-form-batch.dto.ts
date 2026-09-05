// "Đơn tổng" — gom nhiều OtForm mà bước đang chờ HIỆN TẠI đúng là 1 trong 3 cấp quản lý
// (TerminalLevelSnapshot=DepartmentManager/WorkshopManager/GeneralDirector, xem OtFormApprovalStepDto),
// duyệt 1 lần (2026-08-07, Giai đoạn 3.2 — redesign theo Cây chức vụ; mở rộng sang cả 3 cấp 2026-09-05).
// Cấp DepartmentManager gom theo từng Phòng ban; WorkshopManager/GeneralDirector gom company-wide (1
// batch/cấp/ngày). Đơn còn kẹt ở bước trung gian trước đó (SUP/CHIEF...) KHÔNG được gom, vẫn duyệt lẻ
// tới khi tự nó tới lượt 1 trong 3 cấp trên. Schema theo docs/attendance-api-fe.md §Đơn tổng.

import type { OtFormEmployeeDto, ProcessPartDto } from "@/modules/attendance/types/ot-form.dto";

// OtFormBatchStatus: 0=Pending (còn đơn chờ xử lý), 1=Processed (đã xử lý xong hoặc tự đóng vì hết đơn hiệu lực).
// TerminalLevel: enum Attendance.Domain.Enums.JobTitleTerminalLevel (1=DepartmentManager,
// 2=WorkshopManager, 3=GeneralDirector). departmentId chỉ có giá trị khi TerminalLevel=DepartmentManager
// — null nghĩa là batch company-wide, khi đó scopeNameVn là tên Chức vụ ứng với cấp đó thay vì Phòng ban.
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

// 1 đơn nhỏ trong đơn tổng — chỉ gồm nhân viên ĐANG active (chưa bị loại).
export interface OtFormBatchItemDto {
    otFormId: number;
    // Null khi đơn "theo chuyền" (isProductionForm = true) — 2026-08-24.
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
    reasonNameVn: string;
    reasonNameJp: string | null;
    otCaseCode: string;
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

// Chi tiết GET /api/OtFormBatch/{id} (và GET /email-confirm/{token}) — otForms chỉ còn các đơn mà
// bước đang chờ hiện tại VẪN CÒN đúng là Trưởng phòng (còn hiệu lực xử lý qua Đơn tổng).
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

// Body POST /api/OtFormBatch/{id}/approve (và /email-confirm/{token}/approve) — forms phải khớp
// CHÍNH XÁC tập otFormId còn hiệu lực của batch.
export interface ProcessOtFormBatchDto {
    secondaryPassword: string;
    forms: ProcessOtFormBatchFormDto[];
}
