using Identity.Application.Dtos.UserEmailDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Identity.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Identity.Application.Services
{
    // Invariant kept by every write: a user with at least one UserEmail has exactly one primary, and
    // User.Email equals that primary address (null when the user has no email).
    public class UserEmailService : BaseService<IIdentityUnitOfWork>, IUserEmailService
    {
        private readonly IActiveDirectoryAuthService _activeDirectoryService;
        private readonly IDeviceContactDirectoryService _deviceContactDirectoryService;
        private readonly IUserDirectoryService _userDirectoryService;

        public UserEmailService(
            IIdentityUnitOfWork unitOfWork,
            IActiveDirectoryAuthService activeDirectoryService,
            IDeviceContactDirectoryService deviceContactDirectoryService,
            IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _activeDirectoryService = activeDirectoryService;
            _deviceContactDirectoryService = deviceContactDirectoryService;
            _userDirectoryService = userDirectoryService;
        }

        public async Task<UserEmailOverviewDto> GetOverviewAsync(int userId)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            var emails = await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId);
            var assignments = await _unitOfWork.UserEmailModules.FindAsync(x => x.UserId == userId);

            return new UserEmailOverviewDto
            {
                UserId = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                Emails = emails
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenBy(x => x.Email)
                    .Select(x => new UserEmailDto
                    {
                        Id = x.Id,
                        Email = x.Email,
                        Source = x.Source,
                        IsPrimary = x.IsPrimary,
                        Note = x.Note,
                        CreatedAt = x.CreatedAt
                    })
                    .ToList(),
                Modules = EmailModules.All
                    .Select(m => new UserEmailModuleAssignmentDto
                    {
                        ModuleCode = m.Code,
                        ModuleName = m.Name,
                        IsApplied = m.IsApplied,
                        UserEmailId = assignments.FirstOrDefault(a => a.ModuleCode == m.Code)?.UserEmailId
                    })
                    .ToList()
            };
        }

        public async Task<UserEmailOverviewDto> AddAsync(int userId, CreateUserEmailDto request)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            if (!Enum.IsDefined(typeof(UserEmailSource), request.Source))
                throw new DomainException("Nguồn email không hợp lệ.");

            var email = request.Email.Trim().ToLowerInvariant();
            var duplicate = await _unitOfWork.UserEmails.FirstOrDefaultAsync(x => x.UserId == userId && x.Email == email);
            if (duplicate != null)
                throw new DomainException($"Người dùng đã có email '{email}'.");

            var existing = (await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId)).ToList();
            await AddEmailAsync(user, existing, email, request.Source, request.Note, request.IsPrimary);

            await _unitOfWork.SaveChangesAsync();
            return await GetOverviewAsync(userId);
        }

        public async Task<DomainAccountEmailStatusDto> GetByDomainAccountAsync(string domainAccount)
        {
            var account = domainAccount.Trim();
            var user = await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == account);
            if (user == null)
                return new DomainAccountEmailStatusDto { DomainAccount = account };

            var emails = await _unitOfWork.UserEmails.FindAsync(x => x.UserId == user.Id);
            return new DomainAccountEmailStatusDto
            {
                DomainAccount = account,
                UserExists = true,
                UserId = user.Id,
                FullName = user.FullName,
                Emails = emails.OrderByDescending(x => x.IsPrimary).ThenBy(x => x.Email).Select(x => x.Email).ToList()
            };
        }

        public async Task<LinkDomainAccountEmailsResultDto> LinkDomainAccountEmailsAsync(LinkDomainAccountEmailsDto request)
        {
            var account = request.DomainAccount.Trim();
            var fullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
            var userCreated = await _userDirectoryService.EnsureUserExistsAsync(account, fullName, null);

            var user = (await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == account)).OrThrowNotFound("Người dùng", account);
            var existing = (await _unitOfWork.UserEmails.FindAsync(x => x.UserId == user.Id)).ToList();

            var result = new LinkDomainAccountEmailsResultDto { UserId = user.Id, UserName = user.UserName, UserCreated = userCreated };
            foreach (var item in request.Emails)
            {
                var email = item.Email.Trim().ToLowerInvariant();
                if (result.AddedEmails.Concat(result.SkippedEmails).Contains(email, StringComparer.OrdinalIgnoreCase))
                    continue;

                if (await AddEmailAsync(user, existing, email, (int)UserEmailSource.Manual, item.Note, isPrimary: false))
                    result.AddedEmails.Add(email);
                else
                    result.SkippedEmails.Add(email);
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        public async Task<UserEmailOverviewDto> DeleteAsync(int userId, int userEmailId)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            var emails = await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId);
            var target = emails.FirstOrDefault(x => x.Id == userEmailId).OrThrowNotFound("Email", userEmailId);

            if (target.IsPrimary && emails.Count > 1)
                throw new DomainException("Đây là email chính — hãy chọn email chính khác trước khi xoá.");

            var routedModules = await _unitOfWork.UserEmailModules.FindAsync(x => x.UserEmailId == userEmailId);
            _unitOfWork.UserEmailModules.RemoveRange(routedModules);
            _unitOfWork.UserEmails.Delete(target);

            if (target.IsPrimary)
            {
                user.Email = null;
                _unitOfWork.Users.Update(user);
            }

            await _unitOfWork.SaveChangesAsync();
            return await GetOverviewAsync(userId);
        }

        public async Task<UserEmailOverviewDto> SetPrimaryAsync(int userId, int userEmailId)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            var emails = await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId);
            var target = emails.FirstOrDefault(x => x.Id == userEmailId).OrThrowNotFound("Email", userEmailId);

            SetPrimary(user, emails, target);
            await _unitOfWork.SaveChangesAsync();
            return await GetOverviewAsync(userId);
        }

        public async Task<UserEmailOverviewDto> UpdateModulesAsync(int userId, UpdateUserEmailModulesDto request)
        {
            (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);

            var unknownCode = request.Items.FirstOrDefault(x => !EmailModules.IsKnown(x.ModuleCode))?.ModuleCode;
            if (unknownCode != null)
                throw new DomainException($"Module '{unknownCode}' không hỗ trợ cấu hình email.");

            var duplicatedCode = request.Items.GroupBy(x => x.ModuleCode).FirstOrDefault(g => g.Count() > 1)?.Key;
            if (duplicatedCode != null)
                throw new DomainException($"Module '{duplicatedCode}' bị khai báo nhiều lần.");

            var emailIds = (await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId)).Select(x => x.Id).ToHashSet();
            if (request.Items.Any(x => x.UserEmailId.HasValue && !emailIds.Contains(x.UserEmailId.Value)))
                throw new DomainException("Email được chọn không thuộc người dùng này.");

            var current = await _unitOfWork.UserEmailModules.FindAsync(x => x.UserId == userId);
            _unitOfWork.UserEmailModules.RemoveRange(current);

            foreach (var item in request.Items.Where(x => x.UserEmailId.HasValue))
            {
                await _unitOfWork.UserEmailModules.AddAsync(new UserEmailModule
                {
                    UserId = userId,
                    ModuleCode = item.ModuleCode,
                    UserEmailId = item.UserEmailId!.Value
                });
            }

            await _unitOfWork.SaveChangesAsync();
            return await GetOverviewAsync(userId);
        }

        public async Task<List<UserEmailSuggestionDto>> GetSuggestionsAsync(int userId)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            var known = (await _unitOfWork.UserEmails.FindAsync(x => x.UserId == userId))
                .Select(x => x.Email)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var adAddresses = _activeDirectoryService.GetEmailAddresses(user.UserName);
            var suggestions = new List<UserEmailSuggestionDto>();

            if (adAddresses.Mail != null)
                suggestions.Add(BuildSuggestion(adAddresses.Mail, UserEmailSource.Ad, "Thuộc tính mail trên AD", known));

            foreach (var alias in adAddresses.Aliases)
            {
                if (suggestions.Any(x => x.Email.Equals(alias, StringComparison.OrdinalIgnoreCase))) continue;
                suggestions.Add(BuildSuggestion(alias, UserEmailSource.AdAlias, "Alias (proxyAddresses) trên AD", known));
            }

            // Emails of the devices Tanium last saw this account on (Asset). A device may be shared, so these are
            // only candidates for the admin to pick from.
            var deviceEmails = await _deviceContactDirectoryService.GetEmailsByDomainAccountAsync(user.UserName);
            foreach (var deviceEmail in deviceEmails)
            {
                if (suggestions.Any(x => x.Email.Equals(deviceEmail.Email, StringComparison.OrdinalIgnoreCase))) continue;
                suggestions.Add(BuildSuggestion(deviceEmail.Email, UserEmailSource.Tanium,
                    $"Email của máy {string.Join(", ", deviceEmail.DeviceCodes)} (đồng bộ từ Tanium)", known));
            }

            return suggestions;
        }

        private static UserEmailSuggestionDto BuildSuggestion(string email, UserEmailSource source, string note, HashSet<string> known) => new()
        {
            Email = email,
            Source = (int)source,
            Note = note,
            AlreadyAdded = known.Contains(email)
        };

        // Tracks a new UserEmail (no save); returns false when the user already holds the address.
        // `existing` is the user's current list and is extended with the new row.
        private async Task<bool> AddEmailAsync(User user, List<UserEmail> existing, string email, int source, string? note, bool isPrimary)
        {
            if (existing.Any(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase)))
                return false;

            var entity = new UserEmail
            {
                UserId = user.Id,
                Email = email,
                Source = source,
                Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                CreatedAt = TimeHelper.GetCurrentUtcTime()
            };
            await _unitOfWork.UserEmails.AddAsync(entity);

            var isFirst = existing.Count == 0;
            existing.Add(entity);
            if (isPrimary || isFirst)
                SetPrimary(user, existing, entity);
            return true;
        }

        private void SetPrimary(User user, IEnumerable<UserEmail> emails, UserEmail primary)
        {
            foreach (var email in emails.Where(x => x.IsPrimary && x != primary))
            {
                email.IsPrimary = false;
                _unitOfWork.UserEmails.Update(email);
            }

            if (!primary.IsPrimary)
            {
                primary.IsPrimary = true;
                if (primary.Id != 0) _unitOfWork.UserEmails.Update(primary);
            }

            user.Email = primary.Email;
            _unitOfWork.Users.Update(user);
        }
    }
}
