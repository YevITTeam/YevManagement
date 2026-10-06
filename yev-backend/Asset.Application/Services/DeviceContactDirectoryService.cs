using Asset.Application.Interfaces.Service;
using Shared.Application.Interfaces;
using Shared.Application.Services;

namespace Asset.Application.Services
{
    // Implements IDeviceContactDirectoryService (Shared.Application); Scrutor wires it at host startup.
    public class DeviceContactDirectoryService : BaseService<IAssetUnitOfWork>, IDeviceContactDirectoryService
    {
        public DeviceContactDirectoryService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<DeviceContactEmail>> GetEmailsByDomainAccountAsync(string domainAccount)
        {
            var account = domainAccount.Trim();
            if (account.Length == 0) return new List<DeviceContactEmail>();

            var devices = await _unitOfWork.Devices.FindAsync(x => !x.IsDeleted && x.ManagerDomainAccount == account);
            if (devices.Count == 0) return new List<DeviceContactEmail>();

            var deviceCodes = devices.ToDictionary(x => x.Id, x => x.DeviceCode);
            var deviceIds = deviceCodes.Keys.ToList();
            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => !x.IsDeleted && deviceIds.Contains(x.DeviceId));

            return emails
                .GroupBy(x => x.Email, StringComparer.OrdinalIgnoreCase)
                .Select(g => new DeviceContactEmail(
                    g.First().Email,
                    g.Select(x => deviceCodes[x.DeviceId]).Distinct().OrderBy(x => x).ToList()))
                .OrderBy(x => x.Email)
                .ToList();
        }
    }
}
