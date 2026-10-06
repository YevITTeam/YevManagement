using Identity.Application.Dtos.UserEmailDto;

namespace Identity.Application.Interfaces.Service
{
    // Admin management of a user's email addresses and per-module routing.
    public interface IUserEmailService
    {
        Task<UserEmailOverviewDto> GetOverviewAsync(int userId);

        Task<UserEmailOverviewDto> AddAsync(int userId, CreateUserEmailDto request);

        Task<UserEmailOverviewDto> DeleteAsync(int userId, int userEmailId);

        Task<UserEmailOverviewDto> SetPrimaryAsync(int userId, int userEmailId);

        Task<UserEmailOverviewDto> UpdateModulesAsync(int userId, UpdateUserEmailModulesDto request);

        // Addresses found for the account outside UserEmails (AD mail and aliases).
        Task<List<UserEmailSuggestionDto>> GetSuggestionsAsync(int userId);
    }
}
