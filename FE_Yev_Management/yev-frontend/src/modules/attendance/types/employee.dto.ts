export interface EmployeeDto {
    id: number;
    code: string;
    firstName: string;
    lastName: string;
    // Giờ OT lũy kế (docs/attendance-api-fe.md §3.5) — dùng cảnh báo TH3 vượt 25h/tháng hoặc 300h/năm.
    monthToDate: number;
    yearToDate: number;
    groupId: number;
    groupNameVn: string;
}
