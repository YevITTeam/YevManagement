namespace Attendance.Application.Dtos.OtForms
{
    // 1 tổ hợp Team/Line/Nhóm ca mà người gọi đang là Line Leader (ProductionEmployee.IsLeader=true) —
    // dùng để FE tự điền sẵn (hoặc giới hạn dropdown) thay vì bắt Line Leader tự chọn lại đúng Team/Line/
    // Nhóm ca của chính mình mỗi lần tạo đơn "Theo chuyền" (2026-09-28, theo yêu cầu người dùng — mirror
    // MyCreateScopeItemDto của chế độ "Theo Nhóm"). Chỉ trả về tổ hợp có ĐỦ cả 3 FK resolve được — xem
    // OtFormService.GetMyProductionCreateScopesAsync.
    public class MyProductionCreateScopeItemDto
    {
        // Bộ phận của CHÍNH người gọi (2026-09-28, theo yêu cầu người dùng — "các chỗ thuộc Nhóm/thông
        // tin đi kèm người tạo đơn thì cố định hết") — GIỐNG NHAU ở mọi phần tử (Bộ phận gắn với người
        // gọi, không phải với từng tổ hợp Line/Team/Nhóm ca), suy từ `Employee.DepartmentId ?? Employee.
        // Group.DepartmentId` — Line Leader thường được gán qua Group (vd "SHIDO" thuộc Bộ phận "Chế
        // tạo"), không set thẳng DepartmentId trên Employee. FE tự điền sẵn + khoá cứng ô "Bộ phận"
        // luôn ở chế độ "Theo chuyền" thay vì để tự do như trước.
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;

        public int ProductionLineId { get; set; }
        public string LineCode { get; set; } = null!;
        public string? LineNameVn { get; set; }

        public int TeamId { get; set; }
        public string TeamCode { get; set; } = null!;
        public string? TeamNameVn { get; set; }

        public int ShiftTeamId { get; set; }
        public string ShiftTeamCode { get; set; } = null!;
        public string? ShiftTeamNameVn { get; set; }
    }
}
