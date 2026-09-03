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
