using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.DirectoryServices.AccountManagement;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Security.Claims;
using System.Threading.Tasks;

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
            string? deviceName = null;

            // IClaimsTransformation được gọi rất nhiều lần, luôn tạo Scope để an toàn với DbContext
            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

                var user = await dbContext.Users
                    .Include(x => x.Roles)
                    .FirstOrDefaultAsync(a => a.UserName == windowsUsername);

                if (user == null)
                {
                    string actualFullName = GetActualFullName(principal, windowsUsername);

                    user = new User
                    {
                        UserName = windowsUsername,
                        FullName = actualFullName,
                        CreatedAt = DateTime.UtcNow,
                        Roles = new List<Role>() // Khởi tạo List để tránh lỗi NullReferenceException
                    };

                    var basicRole = await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleName == "Basic");
                    if (basicRole != null)
                    {
                        // Truyền trực tiếp object Role đã query để Entity Framework tự động map
                        user.Roles.Add(basicRole);
                    }

                    dbContext.Users.Add(user);
                }

                // Cập nhật thông tin Network & Device
                deviceName = GetClientDeviceName(ipAddress);
                bool isUpdated = false;

                if (!string.IsNullOrEmpty(deviceName) && user.DeviceName != deviceName)
                {
                    user.DeviceName = deviceName;
                    isUpdated = true;
                }

                // Nếu bạn có thuộc tính LastLoginIp trong Entity User, có thể uncomment đoạn này
                // if (!string.IsNullOrEmpty(ipAddress) && user.LastLoginIp != ipAddress)
                // {
                //     user.LastLoginIp = ipAddress;
                //     isUpdated = true;
                // }

                // Chỉ gọi SaveChangesAsync nếu là user mới hoặc có cập nhật (để tăng hiệu suất)
                if (user.Id == 0 || isUpdated)
                {
                    await dbContext.SaveChangesAsync();
                }

                // --- Nạp Claims ---
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
#pragma warning disable CA1416
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
                catch { /* Bỏ qua nếu lỗi kết nối AD */ }
#pragma warning restore CA1416
            }
            return windowsUsername;
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
            catch { /* Lỗi Reverse DNS */ }
            return null;
        }

        #endregion
    }
}