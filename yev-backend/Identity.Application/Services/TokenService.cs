using Identity.Application.Authentication;
using Identity.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Shared.Application.Services;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Identity.Application.Services
{
    public class TokenService : BaseService<IIdentityUnitOfWork>, ITokenService
    {
        // Claims that a JWT produces itself and that must NOT be copied into a new token:
        // SecurityTokenDescriptor already sets Issuer/Audience/Expires, so copying the old values back
        // would emit duplicate `iss`/`aud`/`exp` entries and the resulting token would fail validation.
        // This only matters when GenerateJwtToken runs on a principal authenticated with Bearer, i.e.
        // the session-renewal endpoint GET /Auth/me.
        private static readonly HashSet<string> IgnoredClaimTypes = new(StringComparer.Ordinal)
        {
            IdentityClaimTypes.RolesLoaded,
            JwtRegisteredClaimNames.Exp,
            JwtRegisteredClaimNames.Nbf,
            JwtRegisteredClaimNames.Iat,
            JwtRegisteredClaimNames.Iss,
            JwtRegisteredClaimNames.Aud,
            JwtRegisteredClaimNames.Jti,
        };

        // Role/Permission are always re-read from the "DbRoles" identity that MyClaimsTransformation
        // just built from the DB. Merging in the copies carried by the incoming JWT would make every
        // renewal accumulate the previous snapshot: a revoked permission would never disappear and the
        // token would grow on each renewal.
        private static readonly HashSet<string> DbSourcedClaimTypes = new(StringComparer.Ordinal)
        {
            ClaimTypes.Role,
            IdentityClaimTypes.Permission,
        };

        private readonly IConfiguration _configuration;
        public TokenService(
            IIdentityUnitOfWork unitOfWork, 
            IConfiguration configuration) : base(unitOfWork)
        {
            _configuration = configuration;
        }

        public string GenerateJwtToken(ClaimsPrincipal user)
        {
            var secretKey = _configuration["JwtSettings:Secret"];
            var issuer = _configuration["JwtSettings:Issuer"];
            var audience = _configuration["JwtSettings:Audience"];
            var expiryMinutes = int.Parse(_configuration["JwtSettings:ExpiryMinutes"] ?? "120");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var dbIdentity = user.Identities
                .FirstOrDefault(i => i.AuthenticationType == IdentityClaimTypes.DbRolesAuthenticationType);

            IEnumerable<Claim> source = user.Claims;
            if (dbIdentity is not null)
            {
                source = user.Claims.Where(c => !DbSourcedClaimTypes.Contains(c.Type))
                    .Concat(dbIdentity.Claims.Where(c => DbSourcedClaimTypes.Contains(c.Type)));
            }

            var claims = source
                .Where(c => !IgnoredClaimTypes.Contains(c.Type))
                .DistinctBy(c => (c.Type, c.Value))
                .Select(c => new Claim(c.Type, c.Value))
                .ToList();

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes),
                Issuer = issuer,
                Audience = audience,
                SigningCredentials = creds
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(token);
        }
    }
}
