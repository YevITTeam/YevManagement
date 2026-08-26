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
    // Chữ ký đăng ký sẵn — Pha 4 (workflow-module.md §3.4, §10). Mirror
    // Attendance.Application.Services.UserSignatureService gần như nguyên vẹn, chỉ đổi điểm neo từ
    // UserName (chuỗi) sang EmployeeId (khớp §1.4 — Workflow không neo theo Windows username).
    public class EmployeeSignatureService : BaseService<IWorkflowUnitOfWork>, IEmployeeSignatureService
    {
        // Bằng đúng hạn của Attendance.UserSignatureService — không có lý do nghiệp vụ nào để khác.
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

            // Lỗi render template (thiếu file, sai định dạng...) không được làm hỏng nghiệp vụ chính —
            // đăng ký chữ ký vẫn phải thành công, cùng nguyên tắc EmailService.SendAsync nuốt lỗi SMTP.
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
                // Thiếu file template là lỗi triển khai (deploy quên copy EmailTemplates/), bỏ qua gửi
                // mail chứ không chặn luồng chính.
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

        // Logic upsert thật — chỉ ConfirmAsync gọi, không expose ra interface (Controller luôn phải
        // qua request+confirm, mirror UserSignatureService).
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

        // Mirror WorkflowRequestService/FormDefinitionService.ResolveCurrentEmployeeIdAsync — không
        // share helper riêng tư giữa các Service khác nhau (đúng quy ước module này).
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
