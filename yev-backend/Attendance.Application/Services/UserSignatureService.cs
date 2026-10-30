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
        // Ngắn hơn hẳn hạn của OtFormApprovalEmailToken — tự xác nhận nên làm ngay sau khi request,
        // không như duyệt đơn phải chờ cấp trên rảnh (xem docs/attendance-module.md).
        private const int ConfirmationExpiryMinutes = 30;

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public UserSignatureService(
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

        public async Task<UserSignatureDto> GetByUserNameAsync(string userName)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);
            signature.OrThrowNotFound("Chữ ký", userName);

            return new UserSignatureDto { UserName = signature!.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }

        // Cập nhật/đăng ký chữ ký KHÔNG còn áp dụng ngay (2026-07-16) — tạo 1 dòng chờ xác nhận rồi
        // gửi email cho chính người gọi kèm link xác nhận; chữ ký chỉ thật sự có hiệu lực sau khi
        // bấm xác nhận (ConfirmAsync), chống trường hợp ai đó chiếm phiên đăng nhập đổi chữ ký người khác.
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
            if (string.IsNullOrWhiteSpace(email)) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-chu-ky?token={pending.Token}";

            // Render template lỗi (thiếu file, sai định dạng...) không được làm hỏng nghiệp vụ chính
            // (đăng ký chữ ký vẫn phải thành công) — cùng nguyên tắc với EmailService.SendAsync nuốt lỗi SMTP.
            try
            {
                var html = _emailTemplateRenderer.Render("UserSignature/RequestUpdateConfirmation.html", new Dictionary<string, string>
                {
                    ["UserName"] = fullName ?? userName,
                    ["RequestedAt"] = now.ToString("HH:mm dd/MM/yyyy"),
                    ["ConfirmLink"] = link,
                    ["ExpiryMinutes"] = ConfirmationExpiryMinutes.ToString()
                });

                await _emailService.SendAsync(email, "Yêu cầu cập nhật chữ ký - YevManagement", html);
            }
            catch (FileNotFoundException)
            {
                // Thiếu file template là lỗi triển khai (deploy quên copy EmailTemplates/), bỏ qua gửi
                // mail chứ không chặn luồng chính.
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

        // Logic upsert thật — tái dùng nội bộ bởi ConfirmAsync/AdminSetSignatureAsync.
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
