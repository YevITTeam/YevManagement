namespace Asset.Application.Dtos.DeviceImports
{
    // Represents 1 row parsed from the import Excel template (MQL/Branch/Device Type/
    // Supplier/Purchase Date/Note/Serial Number/Maker/Model/CPU/RAM/Hard Drive/Old MQL,
    // 2026-07-11: added 5 hardware config columns Maker/Model/CPU/RAM/Hard Drive per the
    // new Excel template; 2026-07-13: the Branch/Supplier columns changed to match by
    // Code instead of Name, since Name can be duplicated/reworded while Code is unique
    // — see DeviceImportService).
    // Used both as the preview response (server fills ResolvedXxxId/IsValid/Errors) and
    // as the confirm request input (client resends the raw fields as-is; server
    // re-resolves Ids itself, it never trusts client-supplied Ids).
    public class DeviceImportRowDto
    {
        public int RowNumber { get; set; }

        public string? DeviceCode { get; set; }
        public string? BranchCode { get; set; }
        public string? DeviceTypeName { get; set; }
        public string? SupplierCode { get; set; }
        public DateTime? PurchaseDate { get; set; }
        public string? Note { get; set; }
        public string? SerialNumber { get; set; }

        // 5 optional hardware config columns (new Excel template, 2026-07-11) — not [Required],
        // used to create a DeviceConfiguration alongside the new Device if at least 1 value is present.
        public string? Maker { get; set; }
        public string? Model { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? HardDrive { get; set; }

        public string? OldDeviceCode { get; set; }

        public int? ResolvedBranchId { get; set; }
        public int? ResolvedDeviceTypeId { get; set; }
        public int? ResolvedSupplierId { get; set; }
        public int? ResolvedOldDeviceId { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
