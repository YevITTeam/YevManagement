namespace Attendance.Application.Dtos.Reports
{
    // Dữ liệu nền cho "Phiếu đề nghị làm ngoài giờ" (mẫu YEV-22-024) xuất HÀNG LOẠT theo Line/Nhóm/ngày
    // (2026-09-03c, theo file thật docs/Data/Reports/*.pdf — mỗi Block-Nhóm có OT trong ngày ra đúng 1
    // phiếu). CHỈ trả phần "nền" (danh sách nhân viên gộp đúng theo tổ hợp, cùng cách gộp với
    // ProductionOtReportService.GetTicketReportAsync) — phần chữ ký/lý do/ProcessPart/... FE lấy lại từ
    // GET /api/OtForm/{PrimaryOtFormId} đã có sẵn (cùng dữ liệu OtFormPrintView.tsx đang dùng để in 1
    // đơn lẻ, tái dùng nguyên xi thay vì lặp lại ở đây) — xem docs/docs-be/attendance-module.md.
    public class ProductionTicketBatchGroupDto
    {
        // Form đại diện của tổ hợp này — thường CHỈ có đúng 1 OtForm/tổ hợp/ngày trong thực tế (đơn
        // "theo chuyền" tạo theo cả Line), nếu có nhiều đơn trùng tổ hợp thì lấy đơn có Id nhỏ nhất làm
        // đại diện cho phần chữ ký/lý do — danh sách nhân viên bên dưới vẫn gộp đủ từ MỌI đơn trùng.
        public int PrimaryOtFormId { get; set; }

        public string Block { get; set; } = null!;

        public string ShiftTeam { get; set; } = null!;

        public int EmployeeCount { get; set; }

        public List<ProductionTicketBatchEmployeeDto> Employees { get; set; } = new();
    }

    public class ProductionTicketBatchEmployeeDto
    {
        public int EmployeeId { get; set; }

        public string EmployeeCode { get; set; } = null!;

        public string FullName { get; set; } = null!;

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        public decimal MonthToDate { get; set; }

        public decimal YearToDate { get; set; }

        public string? NoteVn { get; set; }

        // Snapshot Team/Line(Block)/Nhóm ca — CẦN có để FE dựng đúng ô "Tên công đoạn" giống hệt cách
        // OtFormPrintView.tsx (bản in đơn lẻ) đang làm (getProductionCongDoanLabel đọc từ
        // OtFormEmployeeDto.teamCodeSnapshot/blockCodeSnapshot/shiftTeamCodeSnapshot) — thiếu các field
        // này khiến ô "Tên công đoạn" trống trơn khi xuất hàng loạt (lỗi người dùng báo 2026-09-03).
        public string? CongDoanSnapshot { get; set; }

        public string? TaskNameSnapshot { get; set; }

        public string? BlockCodeSnapshot { get; set; }

        public string? TeamCodeSnapshot { get; set; }

        public string? ShiftTeamCodeSnapshot { get; set; }
    }
}
