using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    // Gửi email qua SMTP nội bộ công ty (Exchange/O365) bằng MailKit — đọc cấu hình trực tiếp qua
    // IConfiguration (cùng cách TokenService đọc JwtSettings), không dùng IOptions<T> vì codebase
    // chưa có tiền lệ nào dùng pattern đó. Bắt mọi lỗi SMTP bên trong, không throw ra ngoài (xem
    // IEmailService) — thiếu cấu hình SmtpHost thì coi như chưa sẵn sàng gửi, trả false luôn.
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody)
        {
            var host = _configuration["EmailSettings:SmtpHost"];
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(toEmail))
                return false;

            try
            {
                var port = int.Parse(_configuration["EmailSettings:SmtpPort"] ?? "587");
                var enableSsl = bool.Parse(_configuration["EmailSettings:EnableSsl"] ?? "true");
                var username = _configuration["EmailSettings:Username"];
                var password = _configuration["EmailSettings:Password"];
                var fromAddress = _configuration["EmailSettings:FromAddress"] ?? username;
                var fromDisplayName = _configuration["EmailSettings:FromDisplayName"] ?? "YevManagement";

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(fromDisplayName, fromAddress));
                message.To.Add(MailboxAddress.Parse(toEmail));
                message.Subject = subject;
                message.Body = new TextPart("html") { Text = htmlBody };

                using var client = new SmtpClient();
                var socketOptions = enableSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
                await client.ConnectAsync(host, port, socketOptions);

                if (!string.IsNullOrWhiteSpace(username))
                    await client.AuthenticateAsync(username, password);

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                return true;
            }
            catch
            {
                // Lỗi SMTP (sai cấu hình, mất mạng, server từ chối...) không được làm hỏng nghiệp vụ
                // chính đang gọi SendAsync — chỉ trả false, caller tự quyết định có coi là lỗi hay không.
                return false;
            }
        }
    }
}
