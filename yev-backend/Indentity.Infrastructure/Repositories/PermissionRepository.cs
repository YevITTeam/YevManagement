using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Infrastructure.Repositories
{
    public class PermissionRepository : GenericRepository<Permission, IdentityDbContext>, IPermissionRepository
    {
        public PermissionRepository(IdentityDbContext dbContext) : base(dbContext)
        {

        }
    }
}
