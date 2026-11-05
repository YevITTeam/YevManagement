using Attendance.Application.Dtos.AuditTrails;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;

namespace Attendance.Application.Services
{
    public class AttendanceMailLogService : BaseService<IAttendanceUnitOfWork>, IAttendanceMailLogService, IMailDeliveryTracker
    {
        private const string TrackingPrefix = "attendance-mail:";

        private readonly IEmailService _emailService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<AttendanceMailLogService> _logger;

        public AttendanceMailLogService(
            IAttendanceUnitOfWork unitOfWork,
            IEmailService emailService,
            IServiceScopeFactory scopeFactory,
            IHttpContextAccessor httpContextAccessor,
            ILogger<AttendanceMailLogService> logger) : base(unitOfWork)
        {
            _emailService = emailService;
            _scopeFactory = scopeFactory;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        public async Task<long?> SendAsync(string? recipientUserName, string toEmail, string subject, string htmlBody, IReadOnlyList<MailAttachment>? attachments = null)
        {
            var logId = await InsertLogAsync(recipientUserName, toEmail, subject, MailLogStatus.Queued, null);
            var queued = await _emailService.SendAsync(toEmail, subject, htmlBody, logId is null ? null : TrackingPrefix + logId, attachments);
            if (queued) return logId;
            if (logId is not null)
                await UpdateAsync(logId.Value, MailLogStatus.Failed, 0, "Không đưa được vào hàng đợi gửi (SMTP chưa cấu hình hoặc lỗi ghi file).", null);
            return null;
        }

        public static long? ParseTrackingId(string trackingId) =>
            trackingId.StartsWith(TrackingPrefix) && long.TryParse(trackingId[TrackingPrefix.Length..], out var id) ? id : null;

        public async Task LogSkippedAsync(string recipientUserName, string subject)
            => await InsertLogAsync(recipientUserName, null, subject, MailLogStatus.Skipped, "Người nhận chưa có email.");

        public async Task TrackAsync(string trackingId, bool sent, bool permanent, int attempts, string? error)
        {
            if (ParseTrackingId(trackingId) is not { } id) return;
            var status = sent ? MailLogStatus.Sent : permanent ? MailLogStatus.Failed : MailLogStatus.Queued;
            await UpdateAsync(id, status, attempts, error, sent ? TimeHelper.GetCurrentUtcTime() : null);
        }

        public async Task<PagedResponse<AttendanceMailLogDto>> GetPagedAsync(AttendanceMailLogFilterRequest request)
        {
            var query = _unitOfWork.AttendanceMailLogs.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(request.Keyword))
                query = query.Where(x => x.Subject.Contains(request.Keyword)
                    || (x.ToEmail != null && x.ToEmail.Contains(request.Keyword))
                    || (x.RecipientUserName != null && x.RecipientUserName.Contains(request.Keyword)));
            if (request.Status.HasValue)
                query = query.Where(x => x.Status == request.Status.Value);
            if (request.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= request.FromDate.Value);
            if (request.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt < request.ToDate.Value.Date.AddDays(1));

            return await _unitOfWork.AttendanceMailLogs.ToPagedResponseAsync(
                query.OrderByDescending(x => x.Id),
                request.PageIndex,
                request.PageSize,
                x => new AttendanceMailLogDto
                {
                    Id = x.Id,
                    RecipientUserName = x.RecipientUserName,
                    ToEmail = x.ToEmail,
                    Subject = x.Subject,
                    Status = x.Status,
                    Attempts = x.Attempts,
                    LastError = x.LastError,
                    RequestedBy = x.RequestedBy,
                    CreatedAt = x.CreatedAt,
                    SentAt = x.SentAt
                });
        }

        // Own scope: saving on the caller's context would flush its half-done business changes early.
        private async Task<long?> InsertLogAsync(string? recipientUserName, string? toEmail, string subject, MailLogStatus status, string? error)
        {
            var context = _httpContextAccessor.HttpContext;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IAttendanceUnitOfWork>();
                var log = new AttendanceMailLog
                {
                    RecipientUserName = recipientUserName,
                    ToEmail = toEmail?.Length > 255 ? toEmail[..255] : toEmail,
                    Subject = subject.Length > 500 ? subject[..500] : subject,
                    Status = (int)status,
                    LastError = error,
                    RequestedBy = context?.User?.Identity?.Name ?? (context is null ? "System" : "EmailLink"),
                    CreatedAt = TimeHelper.GetCurrentUtcTime()
                };
                await unitOfWork.AttendanceMailLogs.AddAsync(log);
                await unitOfWork.SaveChangesAsync();
                return log.Id;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không ghi được AttendanceMailLog. To={ToEmail}", toEmail);
                return null;
            }
        }

        private async Task UpdateAsync(long id, MailLogStatus status, int attempts, string? error, DateTime? sentAt)
        {
            try
            {
                await _unitOfWork.AttendanceMailLogs.UpdateDeliveryAsync(id, (int)status, attempts, error?.Length > 1000 ? error[..1000] : error, sentAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không cập nhật được AttendanceMailLog #{Id}.", id);
            }
        }
    }
}
