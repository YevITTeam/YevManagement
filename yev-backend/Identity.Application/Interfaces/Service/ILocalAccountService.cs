using Identity.Application.Dtos.LocalAccountDto;
using Identity.Application.Dtos.UserDto;

namespace Identity.Application.Interfaces.Service
{
    public interface ILocalAccountService
    {
        Task<List<LocalAccountPrefixDto>> GetPrefixesAsync();
        Task<LocalAccountPrefixDto> CreatePrefixAsync(CreateLocalAccountPrefixDto request, string? actorUserName);
        Task DeletePrefixAsync(int id);
        Task<UserDto> CreateAccountAsync(CreateLocalAccountDto request, string? actorUserName);
        Task ResetPasswordAsync(int userId, string newPassword);
        Task ChangeOwnPasswordAsync(string userName, string currentPassword, string newPassword);

        // Returns the stored UserName (exact casing, the key every module matches on), or null on wrong credentials.
        Task<string?> ValidateLoginAsync(string userName, string password);
    }
}
