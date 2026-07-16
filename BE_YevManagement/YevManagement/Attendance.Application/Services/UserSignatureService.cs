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
        private readonly IConfiguration _configuration;

        public UserSignatureService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmailService emailService,
            IConfiguration configuration) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _emailService = emailService;
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
            var now = DateTime.UtcNow;
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

            var (email, _) = await _userDirectoryService.GetContactInfoAsync(userName);
            if (string.IsNullOrWhiteSpace(email)) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-chu-ky?token={pending.Token}";
            var html = $"<p>Bạn vừa yêu cầu cập nhật chữ ký lúc {now:HH:mm dd/MM/yyyy} (UTC).</p>" +
                       $"<p><a href=\"{link}\">Nhấn vào đây để xác nhận cập nhật chữ ký</a> " +
                       $"(link hết hạn sau {ConfirmationExpiryMinutes} phút).</p>" +
                       "<p>Nếu không phải bạn thực hiện yêu cầu này, vui lòng bỏ qua email.</p>";

            await _emailService.SendAsync(email, "Xác nhận cập nhật chữ ký - YevManagement", html);
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

            pending.ConfirmedAt = DateTime.UtcNow;
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

            if (pending.ExpiresAt < DateTime.UtcNow)
                throw new DomainException("Link xác nhận đã hết hạn, vui lòng yêu cầu cập nhật chữ ký lại.");

            return pending;
        }

        // Logic upsert thật — tái dùng nội bộ bởi ConfirmAsync, không expose ra ngoài interface nữa
        // vì Controller không còn gọi thẳng (luôn phải qua request+confirm).
        private async Task<UserSignatureDto> UpsertAsync(string userName, byte[] signatureImage)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);

            if (signature == null)
            {
                signature = new UserSignature
                {
                    UserName = userName,
                    SignatureImage = signatureImage,
                    UpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.UserSignatures.AddAsync(signature);
            }
            else
            {
                signature.SignatureImage = signatureImage;
                signature.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.UserSignatures.Update(signature);
            }

            await _unitOfWork.SaveChangesAsync();

            return new UserSignatureDto { UserName = signature.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }
    }
}
