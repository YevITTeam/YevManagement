using Identity.Application.Interfaces.Repository;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Data;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Infrastructure.Repositories
{
    public class IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>, IIdentityUnitOfWork
    {
        public IdentityUnitOfWork(
            IdentityDbContext dbContext,
            IUserReposiory users,
            IRoleRepository roles,
            ILoginUserIPRepository loginUserIPs,
            IPermissionRepository permissions,
            IUserPermissionRepository userPermissions,
            ITestLoginAccountRepository testLoginAccounts) : base(dbContext)
        {
            Users = users;
            Roles = roles;
            LoginUserIPs = loginUserIPs;
            Permissions = permissions;
            UserPermissions = userPermissions;
            TestLoginAccounts = testLoginAccounts;
        }

        public IUserReposiory Users { get; }
        public IRoleRepository Roles { get; }
        public ILoginUserIPRepository LoginUserIPs { get; }
        public IPermissionRepository Permissions { get; }
        public IUserPermissionRepository UserPermissions { get; }
        public ITestLoginAccountRepository TestLoginAccounts { get; }
    }
}
