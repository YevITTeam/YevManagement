namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeImportPreviewResultDto
    {
        public List<ProductionEmployeeImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }

        public int NewEmployeeCount { get; set; }
        public int NewProductionEmployeeCount { get; set; }
        public int UpdatedProductionEmployeeCount { get; set; }
        public int UnchangedProductionEmployeeCount { get; set; }

        // Người đang có trong ProductionEmployees nhưng file mới không còn nhắc tới — sẽ bị gỡ (soft-delete)
        // nếu Confirm ngay bây giờ.
        public int RemovedProductionEmployeeCount { get; set; }
        public List<ProductionEmployeeRemovedRowDto> RemovedRows { get; set; } = new();
    }
}
