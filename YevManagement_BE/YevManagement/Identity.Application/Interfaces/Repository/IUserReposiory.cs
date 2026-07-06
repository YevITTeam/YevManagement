using Identity.Domain.Entities;
using Shared.Application.Abstractions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Repository
{
    public interface IUserReposiory : IGenericRepository<User>
    {
        //Task<User> GetUserWithRolesAsync(string username);
        //Task<User> CreateUserAsync(string username, string fullName, int basicRoleId);
        //Task<int> GetRoleIdByNameAsync(string roleName);
        //Task<List<User>> GetAllUsersAsync();

        //Task UpdateUserRolesAsync(int userId, List<int> roleIds);
    }
}
