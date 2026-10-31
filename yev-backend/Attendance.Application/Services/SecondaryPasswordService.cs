using Attendance.Application.Dtos.SecondaryPasswords;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class SecondaryPasswordService : BaseService<IAttendanceUnitOfWork>, ISecondaryPasswordService
    {
        // Short expiry: self-confirmation happens right after the request.
        private const int ConfirmationExpiryMinutes = 30;

        private static readonly PasswordHasher<object> PasswordHasher = new();

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public SecondaryPasswordService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
        }

        public async Task<SecondaryPasswordStatusDto> GetStatusAsync(string userName)
        {
            var record = await _unitOfWork.SecondaryPasswords.FirstOrDefaultAsync(x => x.UserName == userName);

            return new SecondaryPasswordStatusDto
            {
                IsRegistered = record != null,
                UpdatedAt = record?.UpdatedAt
            };
        }

        // Takes effect only after the emailed confirmation, so a hijacked session cannot change it.
        public async Task RequestUpdateAsync(string userName, UpsertSecondaryPasswordDto request)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var pending = new PendingSecondaryPasswordConfirmation
            {
                UserName = userName,
                PasswordHash = PasswordHasher.HashPassword(null!, request.Password),
                Token = TokenHelper.GenerateSecureToken(),
                ExpiresAt = now.AddMinutes(ConfirmationExpiryMinutes),
                CreatedAt = now
            };

            await _unitOfWork.PendingSecondaryPasswordConfirmations.AddAsync(pending);
            await _unitOfWork.SaveChangesAsync();

            var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(userName, EmailModules.Attendance);
            if (string.IsNullOrWhiteSpace(email)) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-mat-khau-cap-2?token={pending.Token}";

            // Template rendering failures must not fail the update, same as EmailService swallowing SMTP errors.
            try
            {
                var html = _emailTemplateRenderer.Render("SecondaryPassword/RequestUpdateConfirmation.html", new Dictionary<string, string>
                {
                    ["UserName"] = fullName ?? userName,
                    ["RequestedAt"] = now.ToString("HH:mm dd/MM/yyyy"),
                    ["ConfirmLink"] = link,
                    ["ExpiryMinutes"] = ConfirmationExpiryMinutes.ToString()
                });

                await _emailService.SendAsync(email, "Yêu cầu cập nhật mã ký duyệt cấp 2 - YevManagement", html);
            }
            catch (FileNotFoundException)
            {
                // Missing template is a deploy issue; skip the mail without blocking the main flow.
            }
        }

        public async Task<SecondaryPasswordConfirmationPreviewDto> GetPendingConfirmationAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);

            return new SecondaryPasswordConfirmationPreviewDto
            {
                UserName = pending.UserName,
                ExpiresAt = pending.ExpiresAt
            };
        }

        public async Task ConfirmAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);

            await UpsertAsync(pending.UserName, pending.PasswordHash);

            pending.ConfirmedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.PendingSecondaryPasswordConfirmations.Update(pending);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task VerifyAsync(string userName, string plainPassword)
        {
            var record = await _unitOfWork.SecondaryPasswords.FirstOrDefaultAsync(x => x.UserName == userName);
            if (record == null)
                throw new DomainException("Bạn chưa thiết lập mật khẩu cấp 2. Vui lòng thiết lập trước khi ký duyệt đơn.");

            var result = PasswordHasher.VerifyHashedPassword(null!, record.PasswordHash, plainPassword);
            if (result == PasswordVerificationResult.Failed)
                throw new DomainException("Mật khẩu cấp 2 không đúng.");
        }

        private async Task<PendingSecondaryPasswordConfirmation> ResolvePendingConfirmationAsync(string token)
        {
            var pending = await _unitOfWork.PendingSecondaryPasswordConfirmations.FirstOrDefaultAsync(x => x.Token == token);
            pending.OrThrowNotFound("Yêu cầu xác nhận mật khẩu cấp 2", token);

            if (pending!.ConfirmedAt != null)
                throw new DomainException("Link xác nhận này đã được sử dụng.");

            if (pending.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link xác nhận đã hết hạn, vui lòng yêu cầu thiết lập lại.");

            return pending;
        }

        // Not on the interface: controllers must always go through request + confirm.
        private async Task UpsertAsync(string userName, string passwordHash)
        {
            var record = await _unitOfWork.SecondaryPasswords.FirstOrDefaultAsync(x => x.UserName == userName);

            if (record == null)
            {
                record = new SecondaryPassword
                {
                    UserName = userName,
                    PasswordHash = passwordHash,
                    UpdatedAt = TimeHelper.GetCurrentUtcTime()
                };
                await _unitOfWork.SecondaryPasswords.AddAsync(record);
            }
            else
            {
                record.PasswordHash = passwordHash;
                record.UpdatedAt = TimeHelper.GetCurrentUtcTime();
                _unitOfWork.SecondaryPasswords.Update(record);
            }

            await _unitOfWork.SaveChangesAsync();
        }
    }
}
