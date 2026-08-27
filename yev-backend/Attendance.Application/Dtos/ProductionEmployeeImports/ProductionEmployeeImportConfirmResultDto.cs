namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeImportConfirmResultDto
    {
        // 0 hoặc 1 — Group "Chưa phân loại" dưới Phòng ban Chế Tạo, tạo đúng 1 lần rồi tái dùng.
        public int CreatedGroupCount { get; set; }
        public int CreatedEmployeeCount { get; set; }
        public int CreatedProductionEmployeeCount { get; set; }
        public int UpdatedProductionEmployeeCount { get; set; }
        public int RemovedProductionEmployeeCount { get; set; }

        public int SkippedCount { get; set; }
        public List<ProductionEmployeeImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
