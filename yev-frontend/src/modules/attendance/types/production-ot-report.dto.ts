// Khớp Attendance.Application.Dtos.Reports.ProductionTicketReportDto/RowDto (BE).
export interface ProductionTicketReportRowDto {
    congDoan: string;
    ca: string;
    team: string;
    lineCa: string;
    secondaryTicketCount: number;
    mainTicketCount: number;
    milkCount: number;
    totalHour: number;
    startTime: string;
    endTime: string;
}

export interface ProductionTicketReportDto {
    date: string;
    totalSecondaryTicketCount: number;
    totalMainTicketCount: number;
    totalMilkCount: number;
    rows: ProductionTicketReportRowDto[];
}

// Khớp ProductionTicketBatchGroupDto/EmployeeDto (BE, mới 2026-09-03c) — dữ liệu nền cho phiếu
// YEV-22-024 xuất hàng loạt theo Line/Nhóm/ngày. FE lấy phần chữ ký/lý do/ProcessPart qua
// OtFormApi.getOtFormById(primaryOtFormId), chỉ override employees/numberOfEmployee bằng dữ liệu ở đây.
export interface ProductionTicketBatchEmployeeDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    startTime: string;
    endTime: string;
    monthToDate: number;
    yearToDate: number;
    noteVn: string | null;
    // Snapshot Team/Line(Block)/Nhóm ca — cần để dựng đúng ô "Tên công đoạn" giống bản in đơn lẻ, xem
    // getProductionCongDoanLabel() ở OtFormPrintView.tsx.
    congDoanSnapshot: string | null;
    taskNameSnapshot: string | null;
    blockCodeSnapshot: string | null;
    teamCodeSnapshot: string | null;
    shiftTeamCodeSnapshot: string | null;
}

export interface ProductionTicketBatchGroupDto {
    primaryOtFormId: number;
    block: string;
    shiftTeam: string;
    employeeCount: number;
    employees: ProductionTicketBatchEmployeeDto[];
}
