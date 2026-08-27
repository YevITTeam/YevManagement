namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    // 1 row parsed from Import_Nhan_Su_Che_Tao.xlsx (sheet OT(N+1)). Shared by Preview response (server
    // fills Resolved*/Is*/IsValid/Errors), Confirm request (client sends back the exact same rows from
    // Preview, server re-resolves from scratch), and ApplyAccumulation request (only EmployeeCode +
    // OtMonthHours are used there — see ProductionEmployeeImportService).
    public class ProductionEmployeeImportRowDto
    {
        public int RowNumber { get; set; }

        public string? EmployeeCode { get; set; }
        public string? LastName { get; set; }
        public string? FirstName { get; set; }
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public bool IsLeader { get; set; }

        // Tham khảo (hiển thị Preview) — KHÔNG được ghi vào đâu ở bước Confirm cấu trúc. Chỉ dùng ở bước
        // "Áp dụng lũy kế" tách riêng (ProductionEmployeeImportService.ApplyAccumulationAsync).
        public decimal? OtMonthHours { get; set; }
        public decimal? OtYearHours { get; set; }

        public int? ResolvedProductionLineId { get; set; }
        public int? ResolvedTeamId { get; set; }
        public int? ResolvedShiftTeamId { get; set; }

        public bool IsNewEmployee { get; set; }
        public bool IsNewProductionEmployee { get; set; }
        public bool IsUpdatedProductionEmployee { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
