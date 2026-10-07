namespace Attendance.Application.Dtos.Reports
{
    // Báo cáo "Xuất số lượng phiếu đã sử dụng" theo ngày (chỉ đơn dưới chuyền, IsProductionForm=true,
    // Status=Completed — tức đã qua đủ mọi cấp duyệt bao gồm Trưởng phòng) — xem
    // docs/docs-be/attendance-module.md §Báo cáo & export dưới chuyền theo ngày. FE tự dựng PDF từ DTO này
    // (jsPDF, cùng pattern DeviceListReportPrintDialog.tsx) — BE chỉ trả JSON, không sinh PDF.
    public class ProductionTicketReportDto
    {
        public DateOnly Date { get; set; }

        public int TotalSecondaryTicketCount { get; set; }

        public int TotalMainTicketCount { get; set; }

        public int TotalMilkCount { get; set; }

        public List<ProductionTicketReportRowDto> Rows { get; set; } = new();
    }

    // 1 dòng = 1 tổ hợp (Công đoạn, Team, Line-Nhóm màu, khung giờ) — cộng dồn Phiếu Chính/Phụ/Sữa của
    // mọi đơn Completed cùng ngày rơi vào đúng tổ hợp đó (thường chỉ 1 đơn/tổ hợp, cộng dồn phòng khi
    // trùng). Phiếu Chính/Phụ/Sữa đọc THẲNG từ ProcessPart của từng đơn — KHÔNG suy luận lại từ
    // MealTicketType từng nhân viên (đã chốt lại với người dùng 2026-08-28: ProcessPart đã là số liệu
    // thật của đơn, tính lại sẽ sai vì có thể lệch do sửa tay sau khi tự tính).
    public class ProductionTicketReportRowDto
    {
        // BOPHAN — Attendance.Domain.Entities.OtFormEmployee.CongDoanSnapshot.
        public string CongDoan { get; set; } = null!;

        // CA (A/B/C/H) — suy từ StartTime/EndTime của đơn theo khung giờ cấu hình cứng (2026-08-28,
        // theo người dùng): H=6-8h, B=10-14h, A=14-18h, C=18-22h. "Khac" khi không khớp khung nào.
        public string Ca { get; set; } = null!;

        // DÃY — OtFormEmployee.TeamCodeSnapshot.
        public string Team { get; set; } = null!;

        // Line_ca — BlockCodeSnapshot + "-" + ShiftTeamCodeSnapshot (hậu tố Nhóm màu Green/Orange/HC,
        // KHÔNG phải giờ ca — xem ProductionShiftTeam).
        public string LineCa { get; set; } = null!;

        public int SecondaryTicketCount { get; set; }

        public int MainTicketCount { get; set; }

        public int MilkCount { get; set; }

        public decimal TotalHour { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }
    }
}
