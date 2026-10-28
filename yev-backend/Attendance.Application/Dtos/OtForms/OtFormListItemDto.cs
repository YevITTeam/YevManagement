namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormListItemDto
    {
        public int Id { get; set; }

        // Null khi đơn "theo chuyền" (IsProductionForm = true, không có GroupId cố định).
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
        public bool IsProductionForm { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public string WorkshopNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string? OtCaseDescription { get; set; }
        public string? OtCaseDescriptionJp { get; set; }
        public DateOnly Date { get; set; }
        public decimal TotalHour { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Snapshot Họ tên người tạo — FE luôn ưu tiên hiển thị field này, fallback CreatedByUserName nếu null.
        public string? CreatedByFullName { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // true khi Status == InApproval và chưa bước nào được duyệt (2026-08-07, Giai đoạn 3.1) — dùng
        // để hiện/ẩn nút "Sửa" ngay trên danh sách.
        public bool IsEditable { get; set; }

        // Tóm tắt lịch sử ký/duyệt (2026-07-17) — để FE hiện ngay "đã được ai duyệt, đang chờ ai" trên
        // danh sách mà không cần bấm vào từng đơn xem chi tiết. Sắp theo ActionAt tăng dần.
        public List<ApprovalSummaryItemDto> ApprovalSummary { get; set; } = new();

        // Số người đủ điều kiện xử lý bước đang chờ HIỆN TẠI (0 nếu đơn không còn InApproval hoặc chuỗi
        // rỗng) — cho FE hiện "đang chờ 1 trong N người" khi bước có nhiều candidate cùng giữ 1 Chức vụ
        // (2026-08-08, Giai đoạn 3.2 — polish UX "Chờ tôi duyệt", xem docs §Cây chức vụ).
        public int CurrentStepCandidateCount { get; set; }

        // Line/Nhóm ca của đơn theo chuyền (2026-09-04) — distinct BlockCodeSnapshot/ShiftTeamCodeSnapshot
        // trong các OtFormEmployee còn active, nối bằng ", " (đơn có thể gồm nhiều Line — xem
        // CreateProductionFormAsync). Null với đơn theo Nhóm.
        public string? ProductionLineNames { get; set; }
        public string? ProductionShiftTeamNames { get; set; }
    }
}
