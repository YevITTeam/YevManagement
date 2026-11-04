using System.Globalization;
using System.Text.Json;
using MailKit.Net.Smtp;
using MimeKit;
using Shared.Application.Interfaces;
using Shared.Infrastructure.Services;

namespace CompanySystem.HostApi.BackgroundServices
{
    // Sends queued mail one at a time, spaced by EmailSettings:MinIntervalSeconds so VNMAIL04's per-account
    // submission limit (4.4.2) is not hit. Transient failures retry with backoff; permanent ones land in failed/.
    public class EmailOutboxBackgroundService : BackgroundService
    {
        private static readonly TimeSpan[] RetryDelays =
            [TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(60)];
        private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
        // A claim this old belongs to a process that died mid-send (IIS recycle), so the mail goes back to the queue.
        private static readonly TimeSpan StaleClaimAge = TimeSpan.FromMinutes(10);
        private const string ClaimSuffix = ".sending";

        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailOutboxBackgroundService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public EmailOutboxBackgroundService(IConfiguration configuration, ILogger<EmailOutboxBackgroundService> logger, IServiceScopeFactory scopeFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var outbox = EmailService.GetOutboxPath(_configuration);
            var minInterval = TimeSpan.FromSeconds(_configuration.GetValue<int?>("EmailSettings:MinIntervalSeconds") ?? 15);

            while (!stoppingToken.IsCancellationRequested)
            {
                var attempted = false;
                try
                {
                    Directory.CreateDirectory(outbox);
                    ReleaseStaleClaims(outbox);
                    attempted = await SendNextDueAsync(outbox, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "EmailOutbox: lỗi khi xử lý hàng đợi email.");
                }

                try
                {
                    await Task.Delay(attempted ? minInterval : PollInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task<bool> SendNextDueAsync(string outbox, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            foreach (var file in Directory.GetFiles(outbox, "*.json").OrderBy(f => Path.GetFileName(f), StringComparer.Ordinal))
            {
                var name = Path.GetFileName(file);
                if (name.Length > EmailService.DueTimeFormat.Length && DateTime.TryParseExact(name[..EmailService.DueTimeFormat.Length],EmailService.DueTimeFormat, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var due) && due > now)
                    return false;

                // Rename is atomic, so with two worker processes during an IIS overlapped recycle only one wins the file.
                var claimed = file + ClaimSuffix;
                try
                {
                    File.Move(file, claimed);
                    File.SetLastWriteTimeUtc(claimed, now);
                }
                catch (IOException)
                {
                    continue;
                }

                OutboxMail? mail = null;
                try
                {
                    mail = JsonSerializer.Deserialize<OutboxMail>(await File.ReadAllTextAsync(claimed, ct));
                    if (mail == null) throw new JsonException("Empty outbox file.");
                    await EmailService.SmtpSendAsync(_configuration, _logger, mail.To, mail.Subject, mail.HtmlBody, ct);
                    File.Delete(claimed);
                    await TrackAsync(mail.TrackingId, sent: true, permanent: true, mail.Attempts + 1, null);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    File.Move(claimed, file);
                    throw;
                }
                catch (Exception ex)
                {
                    mail ??= new OutboxMail();
                    mail.Attempts++;
                    mail.LastError = ex.Message;

                    var permanent = IsPermanent(ex) || mail.Attempts > RetryDelays.Length;
                    if (permanent)
                    {
                        _logger.LogError(ex, "Gửi email thất bại, chuyển vào failed sau {Attempts} lần. To={ToEmail}", mail.Attempts, mail.To);
                        await EmailService.WriteOutboxFileAsync(Path.Combine(outbox, "failed"), now, mail);
                    }
                    else
                    {
                        var retryIn = RetryDelays[mail.Attempts - 1];
                        _logger.LogWarning("Gửi email thất bại lần {Attempts}, thử lại sau {RetryIn}. To={ToEmail}: {Error}", mail.Attempts, retryIn, mail.To, ex.Message);
                        await EmailService.WriteOutboxFileAsync(outbox, now + retryIn, mail);
                    }
                    File.Delete(claimed);
                    await TrackAsync(mail.TrackingId, sent: false, permanent, mail.Attempts, ex.Message);
                }
                return true;
            }
            return false;
        }

        // Tracking is bookkeeping only; its failure must never resend or drop the mail itself.
        private async Task TrackAsync(string? trackingId, bool sent, bool permanent, int attempts, string? error)
        {
            if (trackingId == null) return;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                foreach (var tracker in scope.ServiceProvider.GetServices<IMailDeliveryTracker>())
                    await tracker.TrackAsync(trackingId, sent, permanent, attempts, error);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "EmailOutbox: không cập nhật được trạng thái gửi {TrackingId}.", trackingId);
            }
        }

        // 5xx replies (e.g. 5.7.60 send-as denied), bad addresses and unreadable files will fail the same way on every retry.
        private static bool IsPermanent(Exception ex) =>
            ex is SmtpCommandException { StatusCode: >= (SmtpStatusCode)500 } or ParseException or JsonException;

        private void ReleaseStaleClaims(string outbox)
        {
            foreach (var claimed in Directory.GetFiles(outbox, "*" + ClaimSuffix))
            {
                if (File.GetLastWriteTimeUtc(claimed) > DateTime.UtcNow - StaleClaimAge) continue;
                try
                {
                    File.Move(claimed, claimed[..^ClaimSuffix.Length]);
                    _logger.LogWarning("EmailOutbox: trả lại hàng đợi email bị kẹt {File}.", Path.GetFileName(claimed));
                }
                catch (IOException)
                {
                    // Another process released it first.
                }
            }
        }
    }
}
