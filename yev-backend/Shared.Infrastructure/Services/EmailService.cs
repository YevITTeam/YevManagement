using System.Globalization;
using System.Text.Json;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    public class OutboxMail
    {
        public string To { get; set; } = "";
        public string Subject { get; set; } = "";
        public string HtmlBody { get; set; } = "";
        public int Attempts { get; set; }
        public string? LastError { get; set; }
        public string? TrackingId { get; set; }
    }

    // Mail is queued as one JSON file per message (not a DB table) because every module sends mail and each has its own DB.
    public class EmailService : IEmailService
    {
        public const string DueTimeFormat = "yyyyMMddHHmmssfff";

        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody, string? trackingId = null)
        {
            if (string.IsNullOrWhiteSpace(_configuration["EmailSettings:SmtpHost"]) || string.IsNullOrWhiteSpace(toEmail))
                return false;

            try
            {
                await WriteOutboxFileAsync(GetOutboxPath(_configuration), DateTime.UtcNow,
                    new OutboxMail { To = toEmail, Subject = subject, HtmlBody = htmlBody, TrackingId = trackingId });
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không ghi được email vào hàng đợi. To={ToEmail}", toEmail);
                return false;
            }
        }

        public async Task<bool> SendNowAsync(string toEmail, string subject, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(_configuration["EmailSettings:SmtpHost"]) || string.IsNullOrWhiteSpace(toEmail))
                return false;

            try
            {
                await SmtpSendAsync(_configuration, _logger, toEmail, subject, htmlBody, CancellationToken.None);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gửi email thất bại. Host={Host}, To={ToEmail}", _configuration["EmailSettings:SmtpHost"], toEmail);
                return false;
            }
        }

        public static string GetOutboxPath(IConfiguration configuration)
        {
            var configured = configuration["EmailSettings:OutboxPath"];
            var path = string.IsNullOrWhiteSpace(configured) ? "App_Data/EmailOutbox" : configured;
            return Path.IsPathRooted(path) ? path : Path.Combine(AppContext.BaseDirectory, path);
        }

        // The file name starts with the due time, so name order is send order and nothing has to be read to know it is not due yet.
        public static async Task WriteOutboxFileAsync(string directory, DateTime dueUtc, OutboxMail mail)
        {
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, $"{dueUtc.ToString(DueTimeFormat, CultureInfo.InvariantCulture)}_{Guid.NewGuid():N}.json");
            // Written under a temp name first so the sender never picks up a half-written file.
            await File.WriteAllTextAsync(path + ".tmp", JsonSerializer.Serialize(mail));
            File.Move(path + ".tmp", path);
        }

        public static async Task SmtpSendAsync(IConfiguration configuration, ILogger logger, string toEmail, string subject, string htmlBody, CancellationToken ct)
        {
            var host = configuration["EmailSettings:SmtpHost"];
            var port = int.Parse(configuration["EmailSettings:SmtpPort"] ?? "587");
            var enableSsl = bool.Parse(configuration["EmailSettings:EnableSsl"] ?? "true");
            var username = configuration["EmailSettings:Username"];
            var password = configuration["EmailSettings:Password"];
            var fromAddress = configuration["EmailSettings:FromAddress"] ?? username;
            var fromDisplayName = configuration["EmailSettings:FromDisplayName"] ?? "YevManagement";

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromDisplayName, fromAddress));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new TextPart("html") { Text = htmlBody };

            using var client = new SmtpClient();
            await client.ConnectAsync(host, port, enableSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None, ct);
            if (!string.IsNullOrWhiteSpace(username))
                await client.AuthenticateAsync(username, password, ct);
            var response = await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            // Exchange queue response + Message-Id let admins trace the mail in Message Tracking.
            logger.LogInformation("Đã gửi email. To={ToEmail}, Subject={Subject}, MessageId={MessageId}, Response={Response}",
                toEmail, subject, message.MessageId, response);
        }
    }
}
