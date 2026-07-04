using Identity.Application.Interfaces.Service;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Data;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Infrastructure.Repositories
{
    public class IdentityUnitOfWork : BaseUnitOfWork<IdentityDbContext>, IIdentityUnitOfWork
    {
        public IdentityUnitOfWork(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}
