namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    // 1 row of the "missing from Tanium" reconciliation report — a Device the system has marked
    // InUse but that did not appear (by resolved DeviceCode) in the Tanium file just uploaded.
    // Not returned as JSON; only used internally to build the downloadable .xlsx (see
    // DeviceConfigurationImportService.BuildMissingDevicesReportAsync).
    public class DeviceMissingInTaniumDto
    {
        public string DeviceCode { get; set; } = string.Empty;
        public string DeviceName { get; set; } = string.Empty;
        public string? SerialNumber { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public string DeviceTypeName { get; set; } = string.Empty;
        public string? GroupName { get; set; }
        public string? DepartmentName { get; set; }
        public string Manager { get; set; } = string.Empty;
        public string? IpAddress { get; set; }
        public string? Note { get; set; }
    }

    // Result of building the reconciliation report — the raw .xlsx bytes plus enough metadata for
    // the controller to set the download filename and a summary count header.
    public class DeviceMissingInTaniumReportDto
    {
        public byte[] FileContent { get; set; } = Array.Empty<byte>();
        public string FileName { get; set; } = string.Empty;
        public int MissingCount { get; set; }
    }
}
