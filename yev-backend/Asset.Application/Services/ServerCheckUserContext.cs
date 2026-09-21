using Microsoft.AspNetCore.Http;

namespace Asset.Application.Services
{
    // Reads the numeric Identity.Users.Id ("UserId" claim) and the "Permission" claims from the JWT.
    // Asset cannot reference Identity.Application, so the claim names are repeated here — they are
    // part of the JWT contract, not an Identity implementation detail.
    internal static class ServerCheckUserContext
    {
        public static int? GetUserId(IHttpContextAccessor accessor)
        {
            var raw = accessor.HttpContext?.User?.FindFirst("UserId")?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }

        public static bool HasPermission(IHttpContextAccessor accessor, string permission)
            => accessor.HttpContext?.User?.HasClaim("Permission", permission) == true;
    }
}
