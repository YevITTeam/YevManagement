namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportConfirmResultDto
    {
        public int CreatedConfigCount { get; set; }
        public int UpdatedConfigCount { get; set; }
        public int IpReassignedCount { get; set; }
        // Devices whose SerialNumber was written from the "Computer Serial Number" column (2026-07-23).
        public int SerialUpdatedCount { get; set; }
        // Devices whose DeviceName was replaced by the Computer Name column.
        public int DeviceNameUpdatedCount { get; set; }
        // Devices whose ManagerDomainAccount changed, and DeviceEmails rows added, from the Tanium file.
        public int ManagerAccountUpdatedCount { get; set; }
        public int EmailAddedCount { get; set; }
        // Identity users created for the accounts; skipped = disabled or unknown to the directory;
        // unavailable = directory could not be queried; failed = creation error. Only filled when CreateMissingUsers is set.
        public int UsersCreatedCount { get; set; }
        public int UsersSkippedCount { get; set; }
        public int UsersUnavailableCount { get; set; }
        public int UsersFailedCount { get; set; }
        public List<int> UpdatedDeviceIds { get; set; } = new();
    }
}
