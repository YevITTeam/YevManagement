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
            // Phải resolve deviceName TRƯỚC khi tra User — vì từ 2026-07-10, định danh
            // đăng nhập là cặp (UserName, DeviceName) chứ không chỉ UserName suông (xem
            // ghi chú dưới).
            string? deviceName = GetClientDeviceName(ipAddress);

            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

                // Quyết định người dùng (2026-07-10): so khớp theo ĐÚNG cặp (UserName,
                // DeviceName), không chỉ UserName — cho phép Admin "pre-provision" trước 1
                // User ứng với 1 máy cụ thể + gán sẵn Role (xem UserService.CreateUserAsync).
                // Nếu cùng UserName Windows nhưng đăng nhập từ 1 máy KHÁC (DeviceName khác,
                // hoặc chưa từng đăng nhập từ máy này) → coi là chưa tồn tại, tự tạo 1 User
                // MỚI với Role mặc định "Basic", KHÔNG đụng tới các User khác cùng UserName
                // (1 tài khoản Windows có thể ứng với nhiều dòng User, mỗi dòng 1 máy + Role
                // riêng theo máy đó).
                var user = await dbContext.Users
                    .Include(x => x.Roles).ThenInclude(r => r.Permissions)
                    .Include(x => x.LoginUserIPs)
                    .Include(x => x.UserPermissions).ThenInclude(up => up.Permission)
                    .FirstOrDefaultAsync(a => a.UserName == windowsUsername && a.DeviceName == deviceName);

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
                        LoginUserIPs = new List<LoginUserIP>() // Khởi tạo list IP cho user mới
                    };

                    var basicRole = await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleName == "Basic");
                    if (basicRole != null)
                    {
                        user.Roles.Add(basicRole);
                    }

                    dbContext.Users.Add(user);
                }

                bool isUpdated = false;

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

                if (user.Roles != null)
                {
                    // Permission hiệu lực = permission theo Role, cộng permission được cấp
                    // riêng (UserPermission.IsGranted=true), trừ permission bị thu hồi riêng
                    // (IsGranted=false) — deny override luôn thắng grant từ Role.
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
                catch { /* Bỏ qua nếu lỗi kết nối AD */ }
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