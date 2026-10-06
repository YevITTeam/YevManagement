namespace Shared.Application.Interfaces
{
    // Lets Identity read the emails of the devices a domain account was last seen on (data synced from Tanium
    // into Asset) without referencing Asset.Application. The result is only a suggestion source: Identity
    // stays the source of truth for a user's emails.
    public interface IDeviceContactDirectoryService
    {
        // Emails of every non-deleted device whose ManagerDomainAccount equals domainAccount
        // (case-insensitive), one entry per distinct address.
        Task<List<DeviceContactEmail>> GetEmailsByDomainAccountAsync(string domainAccount);
    }

    // DeviceCodes: codes of the devices that carry this address.
    public record DeviceContactEmail(string Email, IReadOnlyList<string> DeviceCodes);
}
