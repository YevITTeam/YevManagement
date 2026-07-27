using Asset.Application.Interfaces.External;
using Asset.Infrastructure.Context;
using Asset.Infrastructure.External;
using Attendance.Infrastructure.Context;
using Identity.Infrastructure.Authentication;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.HostApi.Configurations
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddDIConfig(this IServiceCollection services, IConfiguration configuration)
        {
            var identityConnectionString = configuration.GetConnectionString("IdentityManagementConnection");
            var pcManagementConnectionString = configuration.GetConnectionString("PCManagementConnection");
            var otManagementConnectionString = configuration.GetConnectionString("OTManagementConnection");

            services.AddDbContext<IdentityDbContext>(options =>
                options.UseSqlServer(identityConnectionString));
            services.AddDbContext<AssetDbContext>(options =>
                options.UseSqlServer(pcManagementConnectionString));
            services.AddDbContext<AttendanceDbContext>(options =>
                options.UseSqlServer(otManagementConnectionString));


            services.Scan(scan => scan
            .FromApplicationDependencies(assembly =>
                assembly.FullName.StartsWith("Identity") ||
                assembly.FullName.StartsWith("Attendance") ||
                assembly.FullName.StartsWith("Asset") ||
                assembly.FullName.StartsWith("Shared"))

            .AddClasses(classes => classes.Where(type =>
                type.Name.EndsWith("Repository") ||
                type.Name.EndsWith("UnitOfWork") ||
                type.Name.EndsWith("Service")))
            .AsImplementedInterfaces()
            .WithScopedLifetime()
            );


            // Register IHttpContextAccessor
            services.AddHttpContextAccessor();
            services.AddScoped<IClaimsTransformation, MyClaimsTransformation>();

            // AI Chat -> Ollama typed HttpClient (docs/ai-chat-be-huong-dan.md). Not picked up by the
            // Scrutor scan above (class name ends in "Client", not Repository/UnitOfWork/Service) —
            // needs BaseAddress/Timeout, so it's registered explicitly instead.
            services.AddHttpClient<IOllamaChatClient, OllamaChatClient>((_, client) =>
            {
                var baseUrl = configuration["AiChatSettings:OllamaBaseUrl"] ?? "http://localhost:11434";
                client.BaseAddress = new Uri(baseUrl);
                // HttpClient.Timeout áp dụng cho TOÀN BỘ thời gian đọc xong response, không chỉ tới lúc
                // nhận header đầu — dù OllamaChatClient dùng HttpCompletionOption.ResponseHeadersRead,
                // 1 câu hỏi cần tới 3 vòng gọi tool (mỗi vòng lại 1 SendAsync riêng, được cấp lại đủ
                // ngần này giây) vẫn có thể vượt mốc cũ 120s ở 1 vòng nếu model cục bộ trả lời dài hoặc
                // máy chạy Ollama đang tải nặng — khi đó HttpClient tự hủy nửa chừng, FE nhận lỗi kết nối
                // dù model vẫn đang chạy bình thường, đúng kiểu "lúc được lúc không" (2026-07-27, nâng +
                // cho cấu hình qua AiChatSettings:TimeoutSeconds để tinh chỉnh không cần build lại).
                var timeoutSeconds = configuration.GetValue<int?>("AiChatSettings:TimeoutSeconds") ?? 300;
                client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
            });

            return services;
        }
    }
}