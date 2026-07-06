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
        public IdentityUnitOfWork(IdentityDbContext dbContext, IUserReposiory users, IRoleRepository roles) : base(dbContext)
        {
            Users = users;
            Roles = roles;
        }

        public IUserReposiory Users { get; }
        public IRoleRepository Roles { get; }   
    }
}
