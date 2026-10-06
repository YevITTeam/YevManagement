using Identity.Application.Authentication;
using Identity.Application.Interfaces.Repository;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Shared.Infrastructure.Data;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Infrastructure.Repositories
{
    public class IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>, IIdentityUnitOfWork
    {
        // Entities whose writes never change roles/permissions/profile claims, so they keep the auth cache.
        private static readonly HashSet<Type> AuthNeutralEntityTypes = new()
        {
            typeof(LoginUserIP),
            typeof(LoginQrCode),
            typeof(LoginQrLog),
        };

        private readonly IAuthSnapshotCache _authSnapshotCache;

        public IdentityUnitOfWork(
            IdentityDbContext dbContext,
            IAuthSnapshotCache authSnapshotCache,
            IUserReposiory users,
            IRoleRepository roles,
            ILoginUserIPRepository loginUserIPs,
            IPermissionRepository permissions,
            IUserPermissionRepository userPermissions,
            ITestLoginAccountRepository testLoginAccounts,
            ILoginQrCodeRepository loginQrCodes,
            ILoginQrLogRepository loginQrLogs,
            IUserEmailRepository userEmails,
            IUserEmailModuleRepository userEmailModules) : base(dbContext)
        {
            _authSnapshotCache = authSnapshotCache;
            Users = users;
            Roles = roles;
            LoginUserIPs = loginUserIPs;
            Permissions = permissions;
            UserPermissions = userPermissions;
            TestLoginAccounts = testLoginAccounts;
            LoginQrCodes = loginQrCodes;
            LoginQrLogs = loginQrLogs;
            UserEmails = userEmails;
            UserEmailModules = userEmailModules;
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var affectsAuth = _dbContext.ChangeTracker.Entries().Any(e =>
                e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && !AuthNeutralEntityTypes.Contains(e.Entity.GetType()));

            var saved = await base.SaveChangesAsync(cancellationToken);
            if (affectsAuth) _authSnapshotCache.InvalidateAll();
            return saved;
        }

        public IUserReposiory Users { get; }
        public IRoleRepository Roles { get; }
        public ILoginUserIPRepository LoginUserIPs { get; }
        public IPermissionRepository Permissions { get; }
        public IUserPermissionRepository UserPermissions { get; }
        public ITestLoginAccountRepository TestLoginAccounts { get; }
        public ILoginQrCodeRepository LoginQrCodes { get; }
        public ILoginQrLogRepository LoginQrLogs { get; }
        public IUserEmailRepository UserEmails { get; }
        public IUserEmailModuleRepository UserEmailModules { get; }
    }
}
