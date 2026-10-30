using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    // Sends email via the company's internal SMTP (Exchange/O365) using MailKit — reads configuration
    // directly via IConfiguration (same way TokenService reads JwtSettings), not IOptions<T> since the
    // codebase has no precedent for that pattern. Catches all SMTP errors internally, never throws out
    // (see IEmailService) — if SmtpHost is not configured, it's treated as not ready to send and
    // returns false right away.
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody)
        {
            var host = _configuration["EmailSettings:SmtpHost"];
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(toEmail))
                return false;

            var port = int.Parse(_configuration["EmailSettings:SmtpPort"] ?? "587");

            try
            {
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

                var response = await client.SendAsync(message);
                await client.DisconnectAsync(true);

                // Exchange queue response + Message-Id let admins trace the mail in Message Tracking.
                _logger.LogInformation("Đã gửi email. To={ToEmail}, Subject={Subject}, MessageId={MessageId}, Response={Response}",
                    toEmail, subject, message.MessageId, response);
                return true;
            }
            catch (Exception ex)
            {
                // SMTP errors (misconfiguration, network loss, server rejection...) must not break the
                // main business logic calling SendAsync — just return false, and let the caller decide
                // whether to treat it as an error. Still log the real exception, otherwise a failure in
                // a deployed environment (e.g. IIS blocked from reaching the SMTP host) is undiagnosable.
                _logger.LogError(ex, "Gửi email thất bại. Host={Host}, Port={Port}, To={ToEmail}", host, port, toEmail);
                return false;
            }
        }
    }
}
