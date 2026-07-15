namespace Attendance.Domain.Enums;

// Cấp duyệt theo thứ tự tuần tự thấp -> cao: Submitter (người tạo đơn) -> DepartmentManager (Trưởng
// phòng) -> WorkshopManager (Trưởng xưởng) -> GeneralDirector (Tổng Giám Đốc). OtCase.RequiredApprovalLevel
// quyết định đơn phải đi tới cấp nào thì dừng (xem docs/attendance-module.md — phiếu YEV-22-024 TH1/TH2/TH3).
public enum ApprovalLevel
{
    Submitter = 0,
    DepartmentManager = 1,
    WorkshopManager = 2,
    GeneralDirector = 3
}
