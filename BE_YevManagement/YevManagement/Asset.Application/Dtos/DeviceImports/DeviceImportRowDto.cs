namespace Asset.Application.Dtos.DeviceImports
{
    // Represents 1 row parsed from the import Excel template (MQL/Xưởng/Loại Thiết Bị/
    // Nhà Cung Cấp/Ngày Mua/Ghi Chú/Số SerialNumber/MQL Cũ). Used both as the preview
    // response (server fills ResolvedXxxId/IsValid/Errors) and as the confirm request
    // input (client resends the raw fields as-is; server re-resolves Ids itself, it
    // never trusts client-supplied Ids).
    public class DeviceImportRowDto
    {
        public int RowNumber { get; set; }

        public string? DeviceCode { get; set; }
        public string? BranchName { get; set; }
        public string? DeviceTypeName { get; set; }
        public string? SupplierName { get; set; }
        public DateTime? PurchaseDate { get; set; }
        public string? Note { get; set; }
        public string? SerialNumber { get; set; }
        public string? OldDeviceCode { get; set; }

        public int? ResolvedBranchId { get; set; }
        public int? ResolvedDeviceTypeId { get; set; }
        public int? ResolvedSupplierId { get; set; }
        public int? ResolvedOldDeviceId { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
