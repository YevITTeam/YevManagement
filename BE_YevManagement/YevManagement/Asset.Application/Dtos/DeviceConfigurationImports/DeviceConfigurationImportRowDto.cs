namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    // Represents 1 row parsed from file inventory Tanium (Computer Name/Tanium Client IP
    // Address/Manufacturer/Model/CPU/RAM/Size — the "Last Logged In User" column is ignored
    // per request). Used both for the Preview response (server fills in
    // ResolvedXxx/IsValid/Errors) and the Confirm request (client resends the raw fields
    // as-is, server re-resolves them itself, it never trusts the Id sent by the client).
    public class DeviceConfigurationImportRowDto
    {
        public int RowNumber { get; set; }

        public string? ComputerName { get; set; }
        public string? TaniumIpAddress { get; set; }
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? Size { get; set; }

        // Code/Name extracted from ComputerName (see the algorithm in DeviceConfigurationImportService).
        public string? ParsedDeviceCode { get; set; }
        public string? ParsedDeviceName { get; set; }

        public int? ResolvedDeviceId { get; set; }
        public int? ResolvedIpAddressId { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();

        // Warnings that don't block the row (e.g. Tanium IP doesn't exist in the system so
        // the IP update is skipped, but the device configuration is still created/updated normally).
        public List<string> Warnings { get; set; } = new();
    }
}
