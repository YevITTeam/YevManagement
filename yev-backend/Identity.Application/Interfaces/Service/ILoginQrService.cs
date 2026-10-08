using Identity.Application.Dtos.LoginQrDto;

namespace Identity.Application.Interfaces.Service
{
    public interface ILoginQrService
    {
        // Revokes the user's active code (if any) and issues a new one.
        Task<LoginQrGeneratedDto> GenerateAsync(int userId, int? actorUserId, string? ipAddress);

        // Same as GenerateAsync for each distinct user; fails before issuing anything if a user does not exist.
        Task<List<LoginQrGeneratedDto>> GenerateBatchAsync(IReadOnlyCollection<int> userIds, int? actorUserId, string? ipAddress);

        Task RevokeAsync(int userId, int? actorUserId, string? ipAddress);

        Task<List<LoginQrStatusDto>> GetActiveAsync();

        Task<List<LoginQrLogDto>> GetLogsAsync(int userId, int take);

        // Resolves a scanned code to the UserName it logs in as, or null when invalid/revoked.
        // Records the attempt either way.
        Task<string?> ConsumeAsync(string scannedCode, string? ipAddress, string? userAgent);
    }
}
