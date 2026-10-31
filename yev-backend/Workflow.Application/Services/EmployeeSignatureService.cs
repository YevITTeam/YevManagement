using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.EmployeeSignatures;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    // Anchored on EmployeeId rather than Windows username, unlike Attendance.UserSignatureService.
    public class EmployeeSignatureService : BaseService<IWorkflowUnitOfWork>, IEmployeeSignatureService
    {
        private const int ConfirmationExpiryMinutes = 30;

        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public EmployeeSignatureService(
            IWorkflowUnitOfWork unitOfWork,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
        }

        public async Task<EmployeeSignatureDto> GetMineAsync(int? currentUserId)
        {
            var employeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var signature = await _unitOfWork.EmployeeSignatures.FirstOrDefaultAsync(x => x.EmployeeId == employeeId);
            signature.OrThrowNotFound("Chữ ký", employeeId);

            return ToDto(signature!);
        }

        public async Task RequestUpdateAsync(int? currentUserId, UpsertEmployeeSignatureDto request)
        {
            var employeeId = await ResolveCurrentEmployeeIdAsync(currentUserId);
            var employee = (await _unitOfWork.Employees.GetByIdAsync(employeeId)).OrThrowNotFound("Nhân sự", employeeId);

            var now = TimeHelper.GetCurrentUtcTime();
            var pending = new PendingEmployeeSignatureConfirmation
            {
                EmployeeId = employeeId,
                SignatureImage = request.SignatureImage,
                Token = TokenHelper.GenerateSecureToken(),
                ExpiresAt = now.AddMinutes(ConfirmationExpiryMinutes),
                CreatedAt = now
            };

            await _unitOfWork.PendingEmployeeSignatureConfirmations.AddAsync(pending);
            await _unitOfWork.SaveChangesAsync();

            if (string.IsNullOrWhiteSpace(employee!.Email)) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var link = $"{baseUrl}/xac-nhan-chu-ky-quy-trinh?token={pending.Token}";

            // Template render failures must not break the signature request, same as EmailService swallowing SMTP errors.
            try
            {
                var html = _emailTemplateRenderer.Render("EmployeeSignature/RequestUpdateConfirmation.html", new Dictionary<string, string>
                {
                    ["EmployeeFullName"] = employee.FullName,
                    ["RequestedAt"] = now.ToString("HH:mm dd/MM/yyyy"),
                    ["ConfirmLink"] = link,
                    ["ExpiryMinutes"] = ConfirmationExpiryMinutes.ToString()
                });

                await _emailService.SendAsync(employee.Email, "Xác nhận cập nhật chữ ký - YevManagement", html);
            }
            catch (FileNotFoundException)
            {
                // Missing template is a deployment error (EmailTemplates/ not copied); skip the mail, keep the flow.
            }
        }

        public async Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);
            var employee = (await _unitOfWork.Employees.GetByIdAsync(pending.EmployeeId)).OrThrowNotFound("Nhân sự", pending.EmployeeId);

            return new SignatureConfirmationPreviewDto
            {
                EmployeeFullName = employee!.FullName,
                SignatureImage = pending.SignatureImage,
                ExpiresAt = pending.ExpiresAt
            };
        }

        public async Task<EmployeeSignatureDto> ConfirmAsync(string token)
        {
            var pending = await ResolvePendingConfirmationAsync(token);

            var result = await UpsertAsync(pending.EmployeeId, pending.SignatureImage);

            pending.ConfirmedAt = TimeHelper.GetCurrentUtcTime();
            _unitOfWork.PendingEmployeeSignatureConfirmations.Update(pending);
            await _unitOfWork.SaveChangesAsync();

            return result;
        }

        private async Task<PendingEmployeeSignatureConfirmation> ResolvePendingConfirmationAsync(string token)
        {
            var pending = await _unitOfWork.PendingEmployeeSignatureConfirmations.FirstOrDefaultAsync(x => x.Token == token);
            pending.OrThrowNotFound("Yêu cầu xác nhận chữ ký", token);

            if (pending!.ConfirmedAt != null)
                throw new DomainException("Link xác nhận này đã được sử dụng.");

            if (pending.ExpiresAt < TimeHelper.GetCurrentUtcTime())
                throw new DomainException("Link xác nhận đã hết hạn, vui lòng yêu cầu cập nhật chữ ký lại.");

            return pending;
        }

        // Not on the interface: Controllers must always go through request + confirm.
        private async Task<EmployeeSignatureDto> UpsertAsync(int employeeId, byte[] signatureImage)
        {
            var signature = await _unitOfWork.EmployeeSignatures.FirstOrDefaultAsync(x => x.EmployeeId == employeeId);

            if (signature == null)
            {
                signature = new EmployeeSignature
                {
                    EmployeeId = employeeId,
                    SignatureImage = signatureImage,
                    UpdatedAt = TimeHelper.GetCurrentUtcTime()
                };
                await _unitOfWork.EmployeeSignatures.AddAsync(signature);
            }
            else
            {
                signature.SignatureImage = signatureImage;
                signature.UpdatedAt = TimeHelper.GetCurrentUtcTime();
                _unitOfWork.EmployeeSignatures.Update(signature);
            }

            await _unitOfWork.SaveChangesAsync();

            return ToDto(signature);
        }

        private static EmployeeSignatureDto ToDto(EmployeeSignature signature) => new()
        {
            EmployeeId = signature.EmployeeId,
            SignatureImage = signature.SignatureImage,
            UpdatedAt = signature.UpdatedAt
        };

        // Duplicated per Service on purpose: the module doesn't share private helpers across Services.
        private async Task<int> ResolveCurrentEmployeeIdAsync(int? currentUserId)
        {
            if (currentUserId is null)
                throw new DomainException("Không xác định được người dùng hiện tại. Vui lòng đăng nhập lại.");

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserId == currentUserId && !x.IsDeleted);
            if (employee is null)
                throw new DomainException("Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự nào trong Workflow, không thể thực hiện thao tác này.");

            return employee.Id;
        }
    }
}
