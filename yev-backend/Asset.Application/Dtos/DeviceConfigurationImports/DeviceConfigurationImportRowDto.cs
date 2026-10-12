namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    // Represents 1 row parsed from file inventory Tanium (Computer Name/Tanium Client IP
    // Address/Last Logged In User/Custom Registry UserEmail/Manufacturer/Model/Serial/CPU/RAM/Size). Used both for the Preview response (server fills in
    // ResolvedXxx/IsValid/Errors) and the Confirm request (client resends the raw fields
    // as-is, server re-resolves them itself, it never trusts the Id sent by the client).
    public class DeviceConfigurationImportRowDto
    {
        public int RowNumber { get; set; }

        public string? ComputerName { get; set; }
        public string? TaniumIpAddress { get; set; }
        // "Last Logged In User" column (DOMAIN\user or Local\user).
        public string? LastLoggedInUser { get; set; }
        // "Custom Registry UserEmail" column: raw cell, may hold several addresses or [NOT_FOUND].
        public string? UserEmail { get; set; }
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        // "Computer Serial Number" column, added in the 2026-07-23 Tanium export format. Written back
        // to Device.SerialNumber (not to the configuration) — that is where the serial lives.
        public string? SerialNumber { get; set; }
        public string? Cpu { get; set; }
        // "Total Memory" column in the new format (was "RAM") — same target field.
        public string? Ram { get; set; }
        public string? Size { get; set; }

        // Code extracted from ComputerName (see the algorithm in DeviceConfigurationImportService).
        public string? ParsedDeviceCode { get; set; }

        // Computer Name as-is, written to Device.DeviceName on Confirm.
        public string? ResolvedDeviceName { get; set; }

        public int? ResolvedDeviceId { get; set; }
        public int? ResolvedIpAddressId { get; set; }

        // Serial that will actually be written on Confirm — null when there is nothing to write or
        // when another device already owns it (that case is a Warning, not a blocking error).
        public string? ResolvedSerialNumber { get; set; }

        // LastLoggedInUser when it is a domain account; written to Device.ManagerDomainAccount when the device has none (or on overwrite).
        public string? ResolvedManagerDomainAccount { get; set; }

        // DomainAccountState of ResolvedManagerDomainAccount, filled by Preview only (null when there is no account).
        public int? AccountState { get; set; }

        // Valid addresses parsed from UserEmail; the ones the device does not have yet are added on Confirm.
        public List<string> ResolvedEmails { get; set; } = new();

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();

        // Warnings that don't block the row (e.g. Tanium IP doesn't exist in the system so
        // the IP update is skipped, but the device configuration is still created/updated normally).
        public List<string> Warnings { get; set; } = new();
    }
}
