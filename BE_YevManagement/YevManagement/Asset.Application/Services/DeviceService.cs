using Asset.Application.Interfaces.Service;
using Shared.Application.Services;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class DeviceService : BaseService<IAssetUnitOfWork>, IDeviceService
    {
        public DeviceService(IAssetUnitOfWork unitOfWork) : base(unitOfWork)
        {
        }
    }
}
