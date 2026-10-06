using Identity.Application.Authentication;
using Identity.Domain.Entities;
using Identity.Domain.Enums;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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
        private readonly IMemoryCache _memoryCache;

        public MyClaimsTransformation(
            IServiceProvider serviceProvider, IHttpContextAccessor httpContextAccessor, IMemoryCache memoryCache)
        {
            _serviceProvider = serviceProvider;
            _httpContextAccessor = httpContextAccessor;
            _memoryCache = memoryCache;
        }

        public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
        {
            var windowsUsername = principal.Identity?.Name;
            if (string.IsNullOrEmpty(windowsUsername) || principal.HasClaim(x => x.Type == IdentityClaimTypes.RolesLoaded))
            {
                return principal;
            }

            var clone = principal.Clone();
            var dbIdentity = new ClaimsIdentity(IdentityClaimTypes.DbRolesAuthenticationType, ClaimTypes.Name, ClaimTypes.Role);

            string? ipAddress = GetClientIp();
            // DeviceName is now only for reference/display purposes (2026-07-11, changed back —
            // see the note below), no longer used to match a User, so it could be resolved later,
            // but it's still resolved here to set/refresh it on the User found below.
            string? deviceName = await GetClientDeviceNameAsync(ipAddress);

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
                // AsSplitQuery(): 3 collection Include riêng biệt (Roles.Permissions, LoginUserIPs,
                // UserPermissions.Permission) trên CÙNG 1 query mặc định sinh ra 1 câu SQL JOIN nhân chéo
                // (cartesian explosion) — số dòng trả về = tích số phần tử của cả 3 collection, càng
                // phình to theo thời gian vì LoginUserIPs tích luỹ vĩnh viễn mỗi IP mới user từng đăng
                // nhập. Vì hàm này chạy trên MỌI request có Bearer token (xem RolesLoaded ở trên), phần
                // này từng là nguồn chậm chính còn sót lại sau khi đã cache reverse-DNS (2026-08-08, quan
                // sát GET /Auth/me mất 1.5s dù DNS đã cache). AsSplitQuery tách thành 3 câu SQL riêng,
                // đúng khuyến nghị chính thức của EF Core khi Include nhiều collection cùng lúc.
                var user = await dbContext.Users
                    .AsSplitQuery()
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

                // A user without any email gets the AD "mail" as primary UserEmail (and its User.Email mirror).
                // Once an address exists, admins own the list (UserEmailService) and login never changes it.
                if (string.IsNullOrEmpty(user.Email)
                    && (user.Id == 0 || !await dbContext.UserEmails.AnyAsync(x => x.UserId == user.Id)))
                {
                    var resolvedEmail = GetActualEmail(windowsUsername);
                    if (!string.IsNullOrEmpty(resolvedEmail))
                    {
                        user.Email = resolvedEmail;
                        user.UserEmails.Add(new UserEmail
                        {
                            Email = resolvedEmail,
                            Source = (int)UserEmailSource.Ad,
                            IsPrimary = true,
                            CreatedAt = TimeHelper.GetCurrentUtcTime()
                        });
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

                dbIdentity.AddClaim(new Claim(IdentityClaimTypes.UserId, user.Id.ToString()));

                if (!string.IsNullOrEmpty(user.FullName))
                {
                    dbIdentity.AddClaim(new Claim(IdentityClaimTypes.FullName, user.FullName));
                }

                if (!string.IsNullOrEmpty(user.Email))
                {
                    dbIdentity.AddClaim(new Claim(IdentityClaimTypes.Email, user.Email));
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
                        dbIdentity.AddClaim(new Claim(IdentityClaimTypes.Permission, code));
                    }
                }
            }

            dbIdentity.AddClaim(new Claim(IdentityClaimTypes.RolesLoaded, "true"));

            if (!string.IsNullOrEmpty(ipAddress))
                dbIdentity.AddClaim(new Claim(IdentityClaimTypes.IpAddress, ipAddress));

            if (!string.IsNullOrEmpty(deviceName))
                dbIdentity.AddClaim(new Claim(IdentityClaimTypes.DeviceName, deviceName));

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

        // Reverse DNS cache key prefix + durations. This lookup used to run synchronously and unbounded
        // on EVERY authenticated request (TransformAsync re-runs on every Bearer call, see the
        // RolesLoaded check above — the JWT deliberately excludes that claim so permissions stay fresh).
        // On a client IP with no PTR record (common on an internal network), Dns.GetHostEntry can hang
        // for several seconds waiting on the OS resolver timeout, single-handedly making EVERY API call
        // slow (2026-08-08, observed ~4s stall on GET /Auth/me in DevTools Network). Cache the result per
        // IP so only the first request per cache window pays the DNS round trip, and bound the lookup
        // itself so a slow/unreachable DNS server can't stall the request past DnsLookupTimeout.
        private const string DeviceNameCacheKeyPrefix = "ClaimsTransform:DeviceName:";
        private static readonly TimeSpan DnsLookupTimeout = TimeSpan.FromMilliseconds(500);
        private static readonly TimeSpan ResolvedNameCacheDuration = TimeSpan.FromHours(6);
        private static readonly TimeSpan UnresolvedNameCacheDuration = TimeSpan.FromMinutes(15);

        private async Task<string?> GetClientDeviceNameAsync(string? ipAddress)
        {
            if (string.IsNullOrEmpty(ipAddress)) return null;
            if (ipAddress == "::1" || ipAddress == "127.0.0.1")
            {
                try { return Environment.MachineName; } catch { return null; }
            }

            var cacheKey = DeviceNameCacheKeyPrefix + ipAddress;
            if (_memoryCache.TryGetValue(cacheKey, out string? cachedDeviceName))
            {
                return cachedDeviceName;
            }

            string? deviceName = null;
            try
            {
                using var cts = new CancellationTokenSource(DnsLookupTimeout);
                var entry = await Dns.GetHostEntryAsync(ipAddress, cts.Token);
                if (entry != null && !string.IsNullOrEmpty(entry.HostName)) deviceName = entry.HostName;
            }
            catch { /* Reverse DNS error/timeout — cache the miss below so we don't retry every request */ }

            // Shorter TTL for a miss so a since-fixed DNS entry (or a newly-assigned IP) self-heals
            // reasonably fast instead of staying blank for the full 6h success window.
            _memoryCache.Set(cacheKey, deviceName, deviceName != null ? ResolvedNameCacheDuration : UnresolvedNameCacheDuration);
            return deviceName;
        }

        #endregion
    }
}