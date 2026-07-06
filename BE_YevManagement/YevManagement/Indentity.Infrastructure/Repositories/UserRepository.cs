using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Shared.Application.Abstractions;
using Shared.Infrastructure.Repositories;
using System;
using System.Collections.Generic;
using System.Formats.Asn1;
using System.Text;

namespace Identity.Infrastructure.Repositories
{
    public class UserRepository : GenericRepository<User, IdentityDbContext>, IUserReposiory
    {
        public UserRepository(IdentityDbContext dbContext) : base(dbContext)
        {
            
        }

        public async Task<User?> GetUserWithRolesAsync(string userName)
        {
            return await _dbContext.Users
                .Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.UserName == userName);
        }

    }
}
