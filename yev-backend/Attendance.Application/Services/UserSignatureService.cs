using Attendance.Application.Dtos.UserSignatures;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class UserSignatureService : BaseService<IAttendanceUnitOfWork>, IUserSignatureService
    {
        // Short expiry: self-confirmation happens right after the request, unlike form approvals.
        private const int ConfirmationExpiryMinutes = 30;

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IAttendanceMailLogService _mailLogService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public UserSignatureService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IAttendanceMailLogService mailLogService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _mailLogService = mailLogService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
        }

        public async Task<UserSignatureDto> GetByUserNameAsync(string userName)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);
            signature.OrThrowNotFound("Chữ ký", userName);

            return new UserSignatureDto { UserName = signature!.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }

        // Takes effect only after the emailed confirmation, so a hijacked session cannot change it.
        public async Task RequestUpdateAsync(string userName, UpsertUserSignatureDto request)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var pending = new PendingSignatureConfirmation
            {
                UserName = userName,
                SignatureImage = request.SignatureImage,
                Token = TokenHelper.GenerateSecureToken(),
                ExpiresAt = now.AddMinutes(ConfirmationExpiryMinutes),
                CreatedAt = now
            };

            await _unitOfWork.PendingSignatureConfirmations.AddAsync(pending);
            await _unitOfWork.SaveChangesAsync();

            var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(userName, EmailModules.Attendance);
            if (string.IsNullOrWhiteSpace(email))
            {
                await _mailLogService.LogSkippedAsync(userName, "Yêu cầu cập nhật chữ ký - YevManagement");
                return;
            }

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-chu-ky?token={pending.Token}";

            // Template rendering failures must not fail the update, same as EmailService swallowing SMTP errors.
            try
            {
                var html = _emailTemplateRenderer.Render("UserSignature/RequestUpdateConfirmation.html", new Dictionary<string, string>
                {
                    ["UserName"] = fullName ?? userName,
                    ["RequestedAt"] = now.ToString("HH:mm dd/MM/yyyy"),
                    ["ConfirmLink"] = link,
                    ["ExpiryMinutes"] = ConfirmationExpiryMinutes.ToString()
                });

                await _mailLogService.SendAsync(userName, email, "Yêu cầu cập nhật chữ ký - YevManagement", html);
            }
            catch (FileNotFoundException)
            {
                // Missing template is a deploy issue; skip the mail without blocking the main flow.
            }
        }

        public async Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);

            return new SignatureConfirmationPreviewDto
            {
                UserName = pending.UserName,
                SignatureImage = pending.SignatureImage,
                ExpiresAt = pending.ExpiresAt
            };
        }

        public async Task<UserSignatureDto> ConfirmAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);

            var result = await UpsertAsync(pending.UserName, pending.SignatureImage);

            pending.ConfirmedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.PendingSignatureConfirmations.Update(pending);
            await _unitOfWork.SaveChangesAsync();

            return result;
        }

        private async Task<PendingSignatureConfirmation> ResolvePendingConfirmationAsync(string token)
        {
            var pending = await _unitOfWork.PendingSignatureConfirmations.FirstOrDefaultAsync(x => x.Token == token);
            pending.OrThrowNotFound("Yêu cầu xác nhận chữ ký", token);

            if (pending!.ConfirmedAt != null)
                throw new DomainException("Link xác nhận này đã được sử dụng.");

            if (pending.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link xác nhận đã hết hạn, vui lòng yêu cầu cập nhật chữ ký lại.");

            return pending;
        }

        public async Task<UserSignatureDto> AdminSetSignatureAsync(string userName, byte[] signatureImage)
        {
            return await UpsertAsync(userName, signatureImage);
        }

        private async Task<UserSignatureDto> UpsertAsync(string userName, byte[] signatureImage)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);

            if (signature == null)
            {
                signature = new UserSignature
                {
                    UserName = userName,
                    SignatureImage = signatureImage,
                    UpdatedAt = TimeHelper.GetCurrentUtcTime()
                };
                await _unitOfWork.UserSignatures.AddAsync(signature);
            }
            else
            {
                signature.SignatureImage = signatureImage;
                signature.UpdatedAt = TimeHelper.GetCurrentUtcTime();
                _unitOfWork.UserSignatures.Update(signature);
            }

            await _unitOfWork.SaveChangesAsync();

            return new UserSignatureDto { UserName = signature.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }
    }
}
