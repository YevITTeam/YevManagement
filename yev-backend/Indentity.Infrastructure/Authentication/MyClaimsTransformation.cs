using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shared.Application.Helper;
using System.DirectoryServices.AccountManagement;
using System.Net;
using System.Net.Sockets;
using System.Security.Claims;

namespace Identity.Infrastructure.Authentication
{
    public class MyClaimsTransformation : IClaimsTransformation
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public MyClaimsTransformation(IServiceProvider serviceProvider, IHttpContextAccessor httpContextAccessor)
        {
            _serviceProvider = serviceProvider;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
        {
            var windowsUsername = principal.Identity?.Name;
            if (string.IsNullOrEmpty(windowsUsername) || principal.HasClaim(x => x.Type == "RolesLoaded"))
            {
                return principal;
            }

            var clone = principal.Clone();
            var dbIdentity = new ClaimsIdentity("DbRoles", ClaimTypes.Name, ClaimTypes.Role);

            string? ipAddress = GetClientIp();
            // DeviceName is now only for reference/display purposes (2026-07-11, changed back —
            // see the note below), no longer used to match a User, so it could be resolved later,
            // but it's still resolved here to set/refresh it on the User found below.
            string? deviceName = GetClientDeviceName(ipAddress);

            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

                // Matches User by plain UserName (2026-07-11, changed back from the (UserName,
                // DeviceName) pair applied on 2026-07-10). Reason for the change: DeviceName resolved
                // via reverse-DNS on the client IP is unstable (NAT, multiple PTR records...) —
                // the same person could get resolved to 2 different hostnames within a few seconds,
                // making the system think it's an "unknown machine" and auto-create a duplicate User
                // on every login. Trade-off: lost the "per-machine Role" feature of
                // UserService.CreateUserAsync — now one UserName maps to exactly one User row.
                var user = await dbContext.Users
                    .Include(x => x.Roles).ThenInclude(r => r.Permissions)
                    .Include(x => x.LoginUserIPs)
                    .Include(x => x.UserPermissions).ThenInclude(up => up.Permission)
                    .FirstOrDefaultAsync(a => a.UserName == windowsUsername);

                if (user == null)
                {
                    string actualFullName = GetActualFullName(principal, windowsUsername);

                    user = new User
                    {
                        UserName = windowsUsername,
                        FullName = actualFullName,
                        DeviceName = deviceName,
                        CreatedAt = TimeHelper.GetCurrentUtcTime(),
                        Roles = new List<Role>(),
                        LoginUserIPs = new List<LoginUserIP>() // Initialize the IP list for the new user
                    };

                    var basicRole = await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleName == "Basic");
                    if (basicRole != null)
                    {
                        user.Roles.Add(basicRole);
                    }

                    dbContext.Users.Add(user);
                }

                bool isUpdated = false;

                // Refresh the displayed DeviceName based on the most recent login (don't touch it
                // if resolution failed/null — avoid wiping out a value pre-provisioned by an Admin).
                if (!string.IsNullOrEmpty(deviceName) && user.DeviceName != deviceName)
                {
                    user.DeviceName = deviceName;
                    isUpdated = true;
                }

                // Email: only auto-resolved when it's CURRENTLY EMPTY (unlike DeviceName, which refreshes
                // on every change) — Email is used to send signature/form-approval confirmation emails
                // (Attendance module), so it shouldn't silently change if already set; but it still
                // "self-heals" for old users without an Email (created before this feature existed) on
                // their next login, without needing an Admin to set it manually.
                if (string.IsNullOrEmpty(user.Email))
                {
                    var resolvedEmail = GetActualEmail(windowsUsername);
                    if (!string.IsNullOrEmpty(resolvedEmail))
                    {
                        user.Email = resolvedEmail;
                        isUpdated = true;
                    }
                }

                if (!string.IsNullOrEmpty(ipAddress))
                {
                    if (user.LoginUserIPs == null) user.LoginUserIPs = new List<LoginUserIP>();

                    var existingIpRecord = user.LoginUserIPs.FirstOrDefault(x => x.IPAddress == ipAddress);

                    if (existingIpRecord != null)
                    {
                        existingIpRecord.LastLoginAt = TimeHelper.GetCurrentUtcTime();
                        isUpdated = true;
                    }
                    else
                    {
                        user.LoginUserIPs.Add(new LoginUserIP
                        {
                            IPAddress = ipAddress,
                            FirstLoginAt = TimeHelper.GetCurrentUtcTime(),
                            LastLoginAt = TimeHelper.GetCurrentUtcTime()
                        });
                        isUpdated = true;
                    }
                }

                if (user.Id == 0 || isUpdated)
                {
                    await dbContext.SaveChangesAsync();
                }

                if (user.Roles == null || !user.Roles.Any())
                {
                    dbIdentity.AddClaim(new Claim(ClaimTypes.Role, "Basic"));
                }
                else
                {
                    foreach (var role in user.Roles)
                    {
                        if (!string.IsNullOrEmpty(role.RoleName))
                        {
                            dbIdentity.AddClaim(new Claim(ClaimTypes.Role, role.RoleName));
                        }
                    }
                }

                if (!string.IsNullOrEmpty(user.FullName))
                {
                    dbIdentity.AddClaim(new Claim("FullName", user.FullName));
                }

                if (!string.IsNullOrEmpty(user.Email))
                {
                    dbIdentity.AddClaim(new Claim("Email", user.Email));
                }

                if (user.Roles != null)
                {
                    // Effective permission = Role-based permissions, plus individually granted
                    // permissions (UserPermission.IsGranted=true), minus individually revoked
                    // permissions (IsGranted=false) — a deny override always wins over a Role grant.
                    var basePermissionCodes = user.Roles.SelectMany(r => r.Permissions).Select(p => p.Code);

                    var userPermissions = user.UserPermissions ?? new List<UserPermission>();
                    var grantedCodes = userPermissions.Where(up => up.IsGranted).Select(up => up.Permission.Code);
                    var deniedCodes = userPermissions.Where(up => !up.IsGranted).Select(up => up.Permission.Code).ToHashSet();

                    var effectiveCodes = basePermissionCodes.Union(grantedCodes).Except(deniedCodes).Distinct();

                    foreach (var code in effectiveCodes)
                    {
                        dbIdentity.AddClaim(new Claim("Permission", code));
                    }
                }
            }

            dbIdentity.AddClaim(new Claim("RolesLoaded", "true"));

            if (!string.IsNullOrEmpty(ipAddress))
                dbIdentity.AddClaim(new Claim("IpAddress", ipAddress));

            if (!string.IsNullOrEmpty(deviceName))
                dbIdentity.AddClaim(new Claim("DeviceName", deviceName));

            clone.AddIdentity(dbIdentity);
            return clone;
        }

        #region Helpers

        private string GetActualFullName(ClaimsPrincipal principal, string windowsUsername)
        {
            var displayClaim = principal.Claims.FirstOrDefault(c =>
                c.Type == ClaimTypes.GivenName || c.Type == ClaimTypes.Name ||
                c.Type == "name" || (c.Type == ClaimTypes.NameIdentifier && !c.Value.Contains("\\")));

            if (displayClaim != null && !string.IsNullOrEmpty(displayClaim.Value) && displayClaim.Value != windowsUsername)
            {
                return displayClaim.Value;
            }

            var parts = windowsUsername.Split('\\');
            if (parts.Length == 2 && !parts[0].Equals("AzureAD", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    ContextType type = parts[0].Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase)
                        ? ContextType.Machine
                        : ContextType.Domain;

                    using var pc = new PrincipalContext(type, parts[0]);
                    var up = UserPrincipal.FindByIdentity(pc, IdentityType.SamAccountName, parts[1]);

                    if (up != null && !string.IsNullOrEmpty(up.DisplayName))
                    {
                        return up.DisplayName;
                    }
                }
                catch { /* Ignore if AD connection fails */ }
            }
            return windowsUsername;
        }

        // Resolves email from the AD "mail" attribute via UserPrincipal.EmailAddress — the same
        // System.DirectoryServices.AccountManagement mechanism as GetActualFullName above (PrincipalContext
        // + UserPrincipal.FindByIdentity by SamAccountName), kept as a separate function instead of
        // merging them, to avoid touching the already-stable GetActualFullName logic.
        private string? GetActualEmail(string windowsUsername)
        {
            var parts = windowsUsername.Split('\\');
            if (parts.Length != 2 || parts[0].Equals("AzureAD", StringComparison.OrdinalIgnoreCase))
                return null;

            try
            {
                ContextType type = parts[0].Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase)
                    ? ContextType.Machine
                    : ContextType.Domain;

                using var pc = new PrincipalContext(type, parts[0]);
                var up = UserPrincipal.FindByIdentity(pc, IdentityType.SamAccountName, parts[1]);

                return string.IsNullOrEmpty(up?.EmailAddress) ? null : up.EmailAddress;
            }
            catch { return null; }
        }

        private string? GetClientIp()
        {
            try
            {
                var ctx = _httpContextAccessor.HttpContext;
                if (ctx == null) return null;

                var forwarded = ctx.Request?.Headers?["X-Forwarded-For"].FirstOrDefault();
                string? rawIp = !string.IsNullOrEmpty(forwarded) ? forwarded.Split(',')[0].Trim() : ctx.Connection?.RemoteIpAddress?.ToString();

                if (string.IsNullOrEmpty(rawIp) || !IPAddress.TryParse(rawIp, out var ipAddr))
                    return rawIp;

                if (ipAddr.AddressFamily == AddressFamily.InterNetworkV6)
                {
                    if (IPAddress.IsLoopback(ipAddr))
                    {
                        var host = Dns.GetHostEntry(Dns.GetHostName());
                        var ipv4 = host.AddressList.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork);
                        if (ipv4 != null) return ipv4.ToString();
                    }
                    try { return ipAddr.MapToIPv4().ToString(); }
                    catch { return ipAddr.ToString(); }
                }
                return ipAddr.ToString();
            }
            catch { return null; }
        }

        private string? GetClientDeviceName(string? ipAddress)
        {
            if (string.IsNullOrEmpty(ipAddress)) return null;
            if (ipAddress == "::1" || ipAddress == "127.0.0.1")
            {
                try { return Environment.MachineName; } catch { }
            }
            try
            {
                var entry = Dns.GetHostEntry(ipAddress);
                if (entry != null && !string.IsNullOrEmpty(entry.HostName)) return entry.HostName;
            }
            catch { /* Reverse DNS error */ }
            return null;
        }

        #endregion
    }
}