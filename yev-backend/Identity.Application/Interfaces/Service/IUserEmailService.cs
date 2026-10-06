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

        // Whether a User exists for the domain account and which addresses it already holds.
        Task<DomainAccountEmailStatusDto> GetByDomainAccountAsync(string domainAccount);

        // Adds the addresses to the User of the domain account, creating the User (Basic role) when missing.
        // Never changes an existing primary address; the first address of a new/empty User becomes primary.
        Task<LinkDomainAccountEmailsResultDto> LinkDomainAccountEmailsAsync(LinkDomainAccountEmailsDto request);
    }
}
