using Identity.Application.Dtos.LocalAccountDto;
using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Identity.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Identity.Application.Services
{
    public class LocalAccountService : BaseService<IIdentityUnitOfWork>, ILocalAccountService
    {
        // The login endpoint is public and these accounts have no AD lockout behind them.
        private const int MaxFailedAttempts = 5;
        private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(15);

        private static readonly PasswordHasher<object> PasswordHasher = new();

        private readonly IConfiguration _configuration;

        public LocalAccountService(IIdentityUnitOfWork unitOfWork, IConfiguration configuration) : base(unitOfWork)
        {
            _configuration = configuration;
        }

        public async Task<List<LocalAccountPrefixDto>> GetPrefixesAsync()
        {
            var prefixes = await _unitOfWork.LocalAccountPrefixes.SelectAsync(_ => true, x => new LocalAccountPrefixDto
            {
                Id = x.Id,
                Prefix = x.Prefix,
                AccountCount = x.Accounts.Count,
                CreatedAt = x.CreatedAt
            });

            return prefixes.OrderBy(x => x.Prefix).ToList();
        }

        public async Task<LocalAccountPrefixDto> CreatePrefixAsync(CreateLocalAccountPrefixDto request, string? actorUserName)
        {
            var prefix = request.Prefix.Trim().ToUpperInvariant();

            // A prefix shared with real logins would let a local password stand in for that identity.
            var domain = _configuration["ActiveDirectory:Domain"] ?? "YEV";
            if (prefix.Equals(domain, StringComparison.OrdinalIgnoreCase) || prefix is "TEST" or "AZUREAD")
                throw new DomainException($"Không thể dùng tiền tố '{prefix}'.");

            if (await _unitOfWork.LocalAccountPrefixes.FirstOrDefaultAsync(x => x.Prefix == prefix) != null)
                throw new DomainException($"Tiền tố '{prefix}' đã tồn tại.");

            var userNameStart = prefix + "\\";
            if (await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName.StartsWith(userNameStart)) != null)
                throw new DomainException($"Đã có người dùng mang tiền tố '{prefix}'.");

            var entity = new LocalAccountPrefix
            {
                Prefix = prefix,
                CreatedAt = TimeHelper.GetCurrentUtcTime(),
                CreatedByUserName = actorUserName
            };

            await _unitOfWork.LocalAccountPrefixes.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return new LocalAccountPrefixDto { Id = entity.Id, Prefix = entity.Prefix, CreatedAt = entity.CreatedAt };
        }

        public async Task DeletePrefixAsync(int id)
        {
            var entity = (await _unitOfWork.LocalAccountPrefixes.FirstOrDefaultAsync(x => x.Id == id, x => x.Accounts))
                .OrThrowNotFound("Tiền tố", id);

            if (entity.Accounts.Count > 0)
                throw new DomainException($"Tiền tố '{entity.Prefix}' đang có tài khoản, không thể xoá.");

            _unitOfWork.LocalAccountPrefixes.Delete(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<UserDto> CreateAccountAsync(CreateLocalAccountDto request, string? actorUserName)
        {
            var prefix = (await _unitOfWork.LocalAccountPrefixes.GetByIdAsync(request.PrefixId))
                .OrThrowNotFound("Tiền tố", request.PrefixId);

            var userName = $"{prefix.Prefix}\\{request.LoginName.Trim()}";
            if (await _unitOfWork.Users.FirstOrDefaultAsync(x => x.UserName == userName) != null)
                throw new DomainException($"Người dùng '{userName}' đã tồn tại.");

            var roleIds = request.RoleIds.Distinct().ToList();
            var roles = roleIds.Count > 0
                ? await _unitOfWork.Roles.FindAsync(r => roleIds.Contains(r.Id) && !r.IsDeleted)
                : await _unitOfWork.Roles.FindAsync(r => r.RoleName == "Basic" && !r.IsDeleted);
            if (roleIds.Count > 0 && roles.Count != roleIds.Count)
                throw new DomainException("Một số quyền (Role) được chọn không tồn tại.");

            var now = TimeHelper.GetCurrentUtcTime();
            var user = new User
            {
                UserName = userName,
                FullName = request.FullName.Trim(),
                CreatedAt = now,
                Roles = roles.ToList(),
                LocalLoginAccount = new LocalLoginAccount
                {
                    PrefixId = prefix.Id,
                    PasswordHash = PasswordHasher.HashPassword(null!, request.Password),
                    MustChangePassword = true,
                    PasswordChangedAt = now,
                    CreatedAt = now,
                    CreatedByUserName = actorUserName
                }
            };

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                user.Email = request.Email.Trim().ToLowerInvariant();
                user.UserEmails.Add(new UserEmail
                {
                    Email = user.Email,
                    Source = (int)UserEmailSource.Manual,
                    IsPrimary = true,
                    CreatedAt = now
                });
            }

            await _unitOfWork.Users.AddAsync(user);
            await _unitOfWork.SaveChangesAsync();

            return new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                Email = user.Email,
                Roles = roles.Select(r => r.RoleName).ToList(),
                IsLocalAccount = true,
                MustChangePassword = true
            };
        }

        public async Task ResetPasswordAsync(int userId, string newPassword)
        {
            var account = await _unitOfWork.LocalLoginAccounts.FirstOrDefaultAsync(x => x.UserId == userId)
                ?? throw new DomainException("Người dùng này không phải tài khoản nội bộ.");

            SetPassword(account, newPassword, mustChange: true);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task ChangeOwnPasswordAsync(string userName, string currentPassword, string newPassword)
        {
            var account = await _unitOfWork.LocalLoginAccounts.FirstOrDefaultAsync(x => x.User.UserName == userName)
                ?? throw new DomainException("Chỉ tài khoản nội bộ mới đổi được mật khẩu tại đây.");

            if (!await VerifyAsync(account, currentPassword))
                throw new DomainException("Mật khẩu hiện tại không đúng.");

            if (currentPassword == newPassword)
                throw new DomainException("Mật khẩu mới phải khác mật khẩu hiện tại.");

            SetPassword(account, newPassword, mustChange: false);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<string?> ValidateLoginAsync(string userName, string password)
        {
            var account = await _unitOfWork.LocalLoginAccounts.FirstOrDefaultAsync(x => x.User.UserName == userName, x => x.User);
            if (account == null) return null;

            return await VerifyAsync(account, password) ? account.User.UserName : null;
        }

        private async Task<bool> VerifyAsync(LocalLoginAccount account, string password)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            if (account.LockedUntil > now)
            {
                var minutes = (int)Math.Ceiling((account.LockedUntil.Value - now).TotalMinutes);
                throw new DomainException($"Tài khoản đang tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau {minutes} phút hoặc liên hệ Admin.");
            }

            var result = PasswordHasher.VerifyHashedPassword(null!, account.PasswordHash, password);
            if (result == PasswordVerificationResult.Failed)
            {
                account.FailedLoginCount++;
                if (account.FailedLoginCount >= MaxFailedAttempts)
                {
                    account.LockedUntil = now.Add(LockDuration);
                    account.FailedLoginCount = 0;
                }

                _unitOfWork.LocalLoginAccounts.Update(account);
                await _unitOfWork.SaveChangesAsync();
                return false;
            }

            if (account.FailedLoginCount != 0 || account.LockedUntil != null)
            {
                account.FailedLoginCount = 0;
                account.LockedUntil = null;
                _unitOfWork.LocalLoginAccounts.Update(account);
                await _unitOfWork.SaveChangesAsync();
            }

            return true;
        }

        private void SetPassword(LocalLoginAccount account, string password, bool mustChange)
        {
            account.PasswordHash = PasswordHasher.HashPassword(null!, password);
            account.MustChangePassword = mustChange;
            account.PasswordChangedAt = TimeHelper.GetCurrentUtcTime();
            account.FailedLoginCount = 0;
            account.LockedUntil = null;
            _unitOfWork.LocalLoginAccounts.Update(account);
        }
    }
}
