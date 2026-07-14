using Identity.Domain.Entities;
using Shared.Application.Abstractions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Repository
{
    public interface IUserReposiory : IGenericRepository<User>
    {
        Task<User?> GetUserWithRolesAsync(string userName);
    }
}
