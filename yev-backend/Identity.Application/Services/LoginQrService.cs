using Identity.Application.Dtos.LoginQrDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using System.Security.Cryptography;
using System.Text;

namespace Identity.Application.Services
{
    public class LoginQrService : BaseService<IIdentityUnitOfWork>, ILoginQrService
    {
        private const string PayloadPrefix = "YEVQR1:";
        private const int CodeBytes = 32;

        private const string ActionCreated = "Created";
        private const string ActionRevoked = "Revoked";
        private const string ActionLoginSuccess = "LoginSuccess";
        private const string ActionLoginFailed = "LoginFailed";

        public LoginQrService(IIdentityUnitOfWork unitOfWork) : base(unitOfWork)
        {
        }

        public async Task<LoginQrGeneratedDto> GenerateAsync(int userId, int? actorUserId, string? ipAddress)
        {
            var user = (await _unitOfWork.Users.GetByIdAsync(userId)).OrThrowNotFound("Người dùng", userId);
            var now = TimeHelper.GetCurrentUtcTime();

            var revokedCount = await RevokeActiveCodesAsync(userId, actorUserId, now);

            var rawCode = Base64UrlEncode(RandomNumberGenerator.GetBytes(CodeBytes));
            var qrCode = new LoginQrCode
            {
                UserId = userId,
                CodeHash = HashCode(rawCode),
                CreatedByUserId = actorUserId,
                CreatedAt = now,
            };
            await _unitOfWork.LoginQrCodes.AddAsync(qrCode);
            await _unitOfWork.SaveChangesAsync();

            await AddLogAsync(userId, qrCode.Id, ActionCreated, actorUserId, ipAddress, null,
                revokedCount > 0 ? "Đã thu hồi mã cũ" : null, now);
            await _unitOfWork.SaveChangesAsync();

            return new LoginQrGeneratedDto
            {
                UserId = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                QrPayload = PayloadPrefix + rawCode,
                CreatedAt = now,
            };
        }

        public async Task<List<LoginQrGeneratedDto>> GenerateBatchAsync(IReadOnlyCollection<int> userIds, int? actorUserId, string? ipAddress)
        {
            var ids = userIds.Distinct().ToList();
            var found = (await _unitOfWork.Users.FindAsync(u => ids.Contains(u.Id))).Select(u => u.Id).ToHashSet();
            var missing = ids.Where(id => !found.Contains(id)).ToList();
            if (missing.Count > 0)
                throw new DomainException($"Không tìm thấy người dùng: {string.Join(", ", missing)}.");

            var result = new List<LoginQrGeneratedDto>(ids.Count);
            foreach (var id in ids)
                result.Add(await GenerateAsync(id, actorUserId, ipAddress));
            return result;
        }

        public async Task RevokeAsync(int userId, int? actorUserId, string? ipAddress)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var active = (await _unitOfWork.LoginQrCodes.FindAsync(x => x.UserId == userId && x.RevokedAt == null)).ToList();
            if (active.Count == 0)
                throw new DomainException("Người dùng này chưa có mã QR đăng nhập đang hoạt động.");

            foreach (var code in active)
            {
                code.RevokedAt = now;
                code.RevokedByUserId = actorUserId;
                _unitOfWork.LoginQrCodes.Update(code);
                await AddLogAsync(userId, code.Id, ActionRevoked, actorUserId, ipAddress, null, null, now);
            }
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<LoginQrStatusDto>> GetActiveAsync()
        {
            var query = _unitOfWork.LoginQrCodes.GetQueryable().Where(x => x.RevokedAt == null);
            return await _unitOfWork.LoginQrCodes.ToListAsync(query, x => new LoginQrStatusDto
            {
                UserId = x.UserId,
                CreatedAt = x.CreatedAt,
                LastUsedAt = x.LastUsedAt,
                UseCount = x.UseCount,
            });
        }

        public async Task<List<LoginQrLogDto>> GetLogsAsync(int userId, int take)
        {
            var logs = _unitOfWork.LoginQrLogs.GetQueryable()
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
                .Take(take);
            var rows = await _unitOfWork.LoginQrLogs.ToListAsync(logs, x => new LoginQrLogDto
            {
                Id = x.Id,
                UserId = x.UserId,
                Action = x.Action,
                ActorUserId = x.ActorUserId,
                IpAddress = x.IpAddress,
                UserAgent = x.UserAgent,
                Note = x.Note,
                CreatedAt = x.CreatedAt,
            });

            var actorIds = rows.Where(r => r.ActorUserId.HasValue).Select(r => r.ActorUserId!.Value).Distinct().ToList();
            if (actorIds.Count > 0)
            {
                var actors = await _unitOfWork.Users.FindAsync(u => actorIds.Contains(u.Id));
                var names = actors.ToDictionary(u => u.Id, u => string.IsNullOrWhiteSpace(u.FullName) ? u.UserName : u.FullName);
                foreach (var row in rows)
                    if (row.ActorUserId.HasValue && names.TryGetValue(row.ActorUserId.Value, out var name))
                        row.ActorName = name;
            }
            return rows;
        }

        public async Task<string?> ConsumeAsync(string scannedCode, string? ipAddress, string? userAgent)
        {
            var now = TimeHelper.GetCurrentUtcTime();
            var rawCode = NormalizeScannedCode(scannedCode);

            LoginQrCode? qrCode = null;
            if (rawCode != null)
            {
                var codeHash = HashCode(rawCode);
                qrCode = await _unitOfWork.LoginQrCodes.FirstOrDefaultAsync(x => x.CodeHash == codeHash, x => x.User);
            }

            if (qrCode == null)
            {
                await AddLogAsync(null, null, ActionLoginFailed, null, ipAddress, userAgent, "Mã không tồn tại", now);
                await _unitOfWork.SaveChangesAsync();
                return null;
            }

            if (qrCode.RevokedAt != null)
            {
                await AddLogAsync(qrCode.UserId, qrCode.Id, ActionLoginFailed, null, ipAddress, userAgent, "Mã đã bị thu hồi", now);
                await _unitOfWork.SaveChangesAsync();
                return null;
            }

            qrCode.LastUsedAt = now;
            qrCode.UseCount++;
            _unitOfWork.LoginQrCodes.Update(qrCode);
            await AddLogAsync(qrCode.UserId, qrCode.Id, ActionLoginSuccess, null, ipAddress, userAgent, null, now);
            await _unitOfWork.SaveChangesAsync();

            return qrCode.User.UserName;
        }

        private async Task<int> RevokeActiveCodesAsync(int userId, int? actorUserId, DateTime now)
        {
            var active = (await _unitOfWork.LoginQrCodes.FindAsync(x => x.UserId == userId && x.RevokedAt == null)).ToList();
            foreach (var code in active)
            {
                code.RevokedAt = now;
                code.RevokedByUserId = actorUserId;
                _unitOfWork.LoginQrCodes.Update(code);
            }
            return active.Count;
        }

        private Task AddLogAsync(int? userId, int? qrCodeId, string action, int? actorUserId,
            string? ipAddress, string? userAgent, string? note, DateTime now)
        {
            return _unitOfWork.LoginQrLogs.AddAsync(new LoginQrLog
            {
                UserId = userId,
                QrCodeId = qrCodeId,
                Action = action,
                ActorUserId = actorUserId,
                IpAddress = Truncate(ipAddress, 64),
                UserAgent = Truncate(userAgent, 300),
                Note = note,
                CreatedAt = now,
            });
        }

        // Accepts the scanned text with or without the "YEVQR1:" prefix; returns null for anything that
        // cannot be a code this service issued.
        private static string? NormalizeScannedCode(string scannedCode)
        {
            var text = scannedCode.Trim();
            if (text.StartsWith(PayloadPrefix, StringComparison.OrdinalIgnoreCase))
                text = text[PayloadPrefix.Length..];
            return text.Length is > 0 and <= 100 ? text : null;
        }

        private static string HashCode(string rawCode) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawCode))).ToLowerInvariant();

        private static string Base64UrlEncode(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static string? Truncate(string? value, int max) =>
            value is { Length: > 0 } && value.Length > max ? value[..max] : value;
    }
}
