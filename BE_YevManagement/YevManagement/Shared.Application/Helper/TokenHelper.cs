using System.Security.Cryptography;

namespace Shared.Application.Helper
{
    // Generates a strong random token used for email confirmation links (signature-update confirmation,
    // OT form approve/reject via email) — this is the system's first public [AllowAnonymous] surface,
    // and the token itself is the sole piece of verification, so it must be long enough to resist
    // guessing/brute-force.
    public static class TokenHelper
    {
        public static string GenerateSecureToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }
    }
}
