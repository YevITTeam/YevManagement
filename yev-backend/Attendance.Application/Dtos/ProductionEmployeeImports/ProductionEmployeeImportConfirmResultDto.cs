namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeImportConfirmResultDto
    {
        // 0 or 1: the "Unclassified" group under Manufacturing is created once and reused.
        public int CreatedGroupCount { get; set; }
        public int CreatedEmployeeCount { get; set; }
        public int CreatedProductionEmployeeCount { get; set; }
        public int UpdatedProductionEmployeeCount { get; set; }
        public int RemovedProductionEmployeeCount { get; set; }

        public int SkippedCount { get; set; }
        public List<ProductionEmployeeImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
