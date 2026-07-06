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

        public async Task<User> GeUserWithRolesAsync(string userName)
        {
            var user = await _dbContext.Users
                .Select(u => new User
                {
                    UserName = u.UserName,
                    FullName = u.FullName,
                    Roles = u.Roles
                })
                .Include(ur => ur.Roles)
                .FirstOrDefaultAsync(u => u.UserName == userName);

            if (user == null) 
                return null;


            return user;
        }

    }
}
