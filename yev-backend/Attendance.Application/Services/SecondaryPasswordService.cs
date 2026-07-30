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
        // Same rationale as UserSignatureService — self-confirm, done right after the request, not
        // waiting on someone else being available (see docs/attendance-module.md).
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

        // Cập nhật/đăng ký mật khẩu cấp 2 KHÔNG áp dụng ngay — tạo 1 dòng chờ xác nhận rồi gửi email
        // cho chính người gọi kèm link xác nhận; mật khẩu chỉ thật sự có hiệu lực sau khi bấm xác nhận
        // (ConfirmAsync), chống trường hợp ai đó chiếm phiên đăng nhập đổi mật khẩu cấp 2 hộ.
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

            var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(userName);
            if (string.IsNullOrWhiteSpace(email)) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-mat-khau-cap-2?token={pending.Token}";

            // Render template lỗi (thiếu file, sai định dạng...) không được làm hỏng nghiệp vụ chính
            // (đăng ký mật khẩu cấp 2 vẫn phải thành công) — cùng nguyên tắc với EmailService.SendAsync
            // nuốt lỗi SMTP.
            try
            {
                var html = _emailTemplateRenderer.Render("SecondaryPassword/RequestUpdateConfirmation.html", new Dictionary<string, string>
                {
                    ["UserName"] = fullName ?? userName,
                    ["RequestedAt"] = now.ToString("HH:mm dd/MM/yyyy"),
                    ["ConfirmLink"] = link,
                    ["ExpiryMinutes"] = ConfirmationExpiryMinutes.ToString()
                });

                await _emailService.SendAsync(email, "Xác nhận thiết lập mật khẩu cấp 2 - YevManagement", html);
            }
            catch (FileNotFoundException)
            {
                // Thiếu file template là lỗi triển khai (deploy quên copy EmailTemplates/), bỏ qua gửi
                // mail chứ không chặn luồng chính.
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

        // Logic upsert thật — tái dùng nội bộ bởi ConfirmAsync, không expose ra ngoài interface vì
        // Controller không được gọi thẳng (luôn phải qua request+confirm).
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
