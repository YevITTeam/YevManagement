using Identity.Application.Interfaces.Repository;
using Shared.Application.Abstractions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface IIdentityUnitOfWork : IUnitOfWork
    {
        IUserReposiory Users { get; }

        IRoleRepository Roles { get; }

        ILoginUserIPRepository LoginUserIPs { get; }

        IPermissionRepository Permissions { get; }

        IUserPermissionRepository UserPermissions { get; }

        ITestLoginAccountRepository TestLoginAccounts { get; }

        ILoginQrCodeRepository LoginQrCodes { get; }

        ILoginQrLogRepository LoginQrLogs { get; }
    }
}
