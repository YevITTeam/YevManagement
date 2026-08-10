using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace CompanySystem.HostApi.Configurations
{
    public static class Authentication
    {
        public static IServiceCollection AddAuthConfig(this IServiceCollection services, IConfiguration configuration)
        {
            var jwtSettings = configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["Secret"];

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddNegotiate(options =>
            {
                // NTLM (khác Kerberos) gắn liền với 1 kết nối TCP cụ thể — mặc định
                // PersistNtlmCredentials=false nghĩa là mỗi request mới trên cùng kết nối vẫn có thể bị
                // yêu cầu bắt tay NTLM lại từ đầu nếu ASP.NET Core không chắc kết nối đó đã xác thực
                // (rất dễ xảy ra khi đứng sau IIS + nhiều tab/request đồng thời). Bật cờ này để 1 kết nối
                // đã bắt tay xong thì mọi request sau trên CÙNG kết nối dùng lại luôn, không hỏi lại —
                // giảm hẳn tần suất bật popup nhập mật khẩu domain (2026-08-08, xem thêm checklist IIS
                // ở docs/docs-be/identity-module.md — Anonymous Authentication phải BẬT và Windows
                // Authentication phải TẮT ở IIS site của BE, nếu không app + IIS sẽ tranh nhau challenge
                // Negotiate và gây đúng hiện tượng "hiện popup lặp lại dù đăng nhập đúng").
                options.PersistNtlmCredentials = true;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtSettings["Issuer"],
                    ValidAudience = jwtSettings["Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
                };
            });

            return services;
        }
    }
}
