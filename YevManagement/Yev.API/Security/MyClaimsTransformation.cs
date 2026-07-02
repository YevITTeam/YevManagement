using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using System.DirectoryServices.AccountManagement;
using System.Net;
using System.Net.Sockets;
using System.Security.Claims;
using Yev.Entities.Users;
using Yev.Repositories;

namespace Yev.API.Security
{
    public class MyClaimsTransformation : IClaimsTransformation
    {
        private readonly IServiceProvider _serviceProvider;

        public MyClaimsTransformation(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
        {
            var windowsUsername = principal.Identity?.Name;
            if (string.IsNullOrEmpty(windowsUsername)) 
            {
                return principal;
            }
            if(principal.HasClaim(x => x.Type == "RolesLoaded"))
            {
                return principal;
            }
            var clone = principal.Clone();

            // Tạo một Identity phụ tên là "DbRoles", CHỈ ĐỊNH RÕ kiểu Role là ClaimTypes.Role để hàm IsInRole() đọc được
            var dbIdentity = new ClaimsIdentity("DbRoles", ClaimTypes.Name, ClaimTypes.Role);

            string ipAddress = null;
            string deviceName = null;
            using (var scope = _serviceProvider.CreateScope()) 
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var user = await dbContext.Users
                                                .Include(x => x.UserRoles)
                                                .ThenInclude(u => u.Role)
                                                .FirstOrDefaultAsync(a => a.UserName == windowsUsername);

                if (user == null)
                {
                    string actualFullName = windowsUsername;
                    try
                    {
                        var displayClaim = principal.Claims.FirstOrDefault(c =>
                            c.Type == ClaimTypes.GivenName ||
                            c.Type == ClaimTypes.Name ||
                            c.Type == "name" ||
                            (c.Type == ClaimTypes.NameIdentifier && !c.Value.Contains("\\")));

                        if (displayClaim != null && !string.IsNullOrEmpty(displayClaim.Value) && displayClaim.Value != windowsUsername)
                        {
                            actualFullName = displayClaim.Value;
                        }
                        else
                        {
                            var parts = windowsUsername.Split('\\');
                            if (parts.Length == 2)
                            {
                                string domainOrMachineName = parts[0];
                                string userNameOnly = parts[1];

                                if (!domainOrMachineName.Equals("AzureAD", StringComparison.OrdinalIgnoreCase))
                                {
#pragma warning disable CA1416
                                    ContextType type = domainOrMachineName.Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase)
                                        ? ContextType.Machine
                                        : ContextType.Domain;

                                    using (var pc = new PrincipalContext(type, domainOrMachineName))
                                    {
                                        var up = UserPrincipal.FindByIdentity(pc, IdentityType.SamAccountName, userNameOnly);
                                        if (up != null && !string.IsNullOrEmpty(up.DisplayName))
                                        {
                                            actualFullName = up.DisplayName;
                                        }
                                    }
#pragma warning restore CA1416
                                }
                            }
                        }
                    }
                    catch
                    {

                    }

                    user = new User
                    {
                        UserName = windowsUsername,
                        FullName = actualFullName,
                        CreatedAt = DateTime.Now
                    };

                    var basicRole = await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleName == "Basic");
                    if (basicRole != null)
                    {
                        user.UserRoles.Add(new UserRole { RoleId = basicRole.Id });
                    }

                    dbContext.Users.Add(user);
                    // Try to capture remote IP and save it with the new user
                    try
                    {
                        ipAddress = GetClientIp(scope.ServiceProvider);
                        if (!string.IsNullOrEmpty(ipAddress))
                        {
                            user.LastLoginIp = ipAddress;
                        }
                    }
                    catch
                    {
                    }

                    // Try to capture device name (reverse DNS or fallback) and save it with the new user
                    try
                    {
                        deviceName = GetClientDeviceName(scope.ServiceProvider, ipAddress);
                        if (!string.IsNullOrEmpty(deviceName))
                        {
                            user.DeviceName = deviceName;
                        }
                    }
                    catch
                    {
                    }

                    await dbContext.SaveChangesAsync();

                    // Đổi newIdentity thành dbIdentity
                    dbIdentity.AddClaim(new Claim(ClaimTypes.Role, "Basic"));
                    dbIdentity.AddClaim(new Claim("FullName", actualFullName));
                }
                else
                {
                    foreach (var userRole in user.UserRoles)
                    {
                        if (userRole.Role != null)
                        {
                            // Đổi newIdentity thành dbIdentity
                            dbIdentity.AddClaim(new Claim(ClaimTypes.Role, userRole.Role.RoleName));
                        }
                    }

                    if (!user.UserRoles.Any())
                    {
                        dbIdentity.AddClaim(new Claim(ClaimTypes.Role, "Basic"));
                    }

                    if (!string.IsNullOrEmpty(user.FullName))
                    {
                        dbIdentity.AddClaim(new Claim("FullName", user.FullName));
                    }

                    // Update user's LastLoginIp from current request (best-effort)
                    try
                    {
                        ipAddress = GetClientIp(scope.ServiceProvider);
                        if (!string.IsNullOrEmpty(ipAddress) && user.LastLoginIp != ipAddress)
                        {
                            user.LastLoginIp = ipAddress;
                            await dbContext.SaveChangesAsync();
                        }
                    }
                    catch
                    {
                    }

                    // Update user's DeviceName from current request (best-effort)
                    try
                    {
                        deviceName = GetClientDeviceName(scope.ServiceProvider, ipAddress);
                        if (!string.IsNullOrEmpty(deviceName) && user.DeviceName != deviceName)
                        {
                            user.DeviceName = deviceName;
                            await dbContext.SaveChangesAsync();
                        }
                    }
                    catch
                    {
                    }
                }

            }
            dbIdentity.AddClaim(new Claim("RolesLoaded", "true"));

            // Try to obtain the remote IP address from the current HttpContext and attach as a claim
            try
            {
                ipAddress ??= GetClientIp(_serviceProvider);
                if (!string.IsNullOrEmpty(ipAddress))
                {
                    dbIdentity.AddClaim(new Claim("IpAddress", ipAddress));
                }

                try
                {
                    deviceName ??= GetClientDeviceName(_serviceProvider, ipAddress);
                    if (!string.IsNullOrEmpty(deviceName))
                    {
                        dbIdentity.AddClaim(new Claim("DeviceName", deviceName));
                    }
                }
                catch
                {
                    // best-effort only
                }
            }
            catch
            {
                // Swallow any exception - adding IP claim is best-effort only
            }

            // Gắn "Thẻ phụ" này vào chung với bộ hồ sơ của người dùng
            clone.AddIdentity(dbIdentity);

            return clone;
        }

        // Helper: try to obtain client IP, prefer X-Forwarded-For, normalize IPv6 mapped addresses and loopback
        private string? GetClientIp(IServiceProvider sp)
        {
            try
            {
                var httpContextAccessor = sp.GetService(typeof(Microsoft.AspNetCore.Http.IHttpContextAccessor)) as Microsoft.AspNetCore.Http.IHttpContextAccessor;
                var ctx = httpContextAccessor?.HttpContext;
                if (ctx == null) return null;

                // Prefer X-Forwarded-For if present (may contain a comma-separated list)
                var forwarded = ctx.Request?.Headers?["X-Forwarded-For"].FirstOrDefault();
                string rawIp = null;
                if (!string.IsNullOrEmpty(forwarded))
                {
                    rawIp = forwarded.Split(',')[0].Trim();
                }

                if (string.IsNullOrEmpty(rawIp))
                {
                    rawIp = ctx.Connection?.RemoteIpAddress?.ToString();
                }

                if (string.IsNullOrEmpty(rawIp)) return null;

                // Normalize IPv6 mapped IPv4 and loopback
                if (IPAddress.TryParse(rawIp, out var ipAddr))
                {
                    // If IPv4 mapped to IPv6, map back to IPv4
                    if (ipAddr.AddressFamily == AddressFamily.InterNetworkV6)
                    {
                        if (IPAddress.IsLoopback(ipAddr))
                        {
                            // If loopback (::1 or 127.0.0.1), attempt to get a non-loopback local IPv4 address
                            try
                            {
                                var host = Dns.GetHostEntry(Dns.GetHostName());
                                var ipv4 = host.AddressList.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork);
                                if (ipv4 != null)
                                {
                                    return ipv4.ToString();
                                }
                            }
                            catch
                            {
                                // ignore
                            }
                        }

                        // If IPv6 contains IPv4 mapped (::ffff:192.168.x.x), map to IPv4
                        try
                        {
                            var mapped = ipAddr.MapToIPv4();
                            return mapped.ToString();
                        }
                        catch
                        {
                            return ipAddr.ToString();
                        }
                    }

                    return ipAddr.ToString();
                }

                return rawIp;
            }
            catch
            {
                return null;
            }
        }

        // Helper: try to resolve device name from client IP (reverse DNS). Falls back to Environment.MachineName for loopback.
        private string? GetClientDeviceName(IServiceProvider sp, string? ipAddress = null)
        {
            try
            {
                if (string.IsNullOrEmpty(ipAddress))
                {
                    ipAddress = GetClientIp(sp);
                }

                if (string.IsNullOrEmpty(ipAddress)) return null;

                // If loopback, return the local machine name as a best-effort
                if (ipAddress == "::1" || ipAddress == "127.0.0.1")
                {
                    try
                    {
                        return Environment.MachineName;
                    }
                    catch
                    {
                        // ignore
                    }
                }

                try
                {
                    var entry = Dns.GetHostEntry(ipAddress);
                    if (entry != null && !string.IsNullOrEmpty(entry.HostName))
                    {
                        return entry.HostName;
                    }
                }
                catch
                {
                    // reverse DNS failed; ignore
                }

                return null;
            }
            catch
            {
                return null;
            }
        }
    }
}
