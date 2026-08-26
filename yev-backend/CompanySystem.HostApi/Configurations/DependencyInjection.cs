using Asset.Infrastructure.Context;
using Attendance.Infrastructure.Context;
using Identity.Infrastructure.Authentication;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Shared.Application.Interfaces.External;
using Shared.Infrastructure.External;
using Workflow.Infrastructure.Context;

namespace CompanySystem.HostApi.Configurations
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddDIConfig(this IServiceCollection services, IConfiguration configuration)
        {
            var identityConnectionString = configuration.GetConnectionString("IdentityManagementConnection");
            var pcManagementConnectionString = configuration.GetConnectionString("PCManagementConnection");
            var otManagementConnectionString = configuration.GetConnectionString("OTManagementConnection");
            var workflowManagementConnectionString = configuration.GetConnectionString("WorkflowManagementConnection");

            services.AddDbContext<IdentityDbContext>(options =>
                options.UseSqlServer(identityConnectionString));
            services.AddDbContext<AssetDbContext>(options =>
                options.UseSqlServer(pcManagementConnectionString));
            services.AddDbContext<AttendanceDbContext>(options =>
                options.UseSqlServer(otManagementConnectionString));
            services.AddDbContext<WorkflowDbContext>(options =>
                options.UseSqlServer(workflowManagementConnectionString));


            services.Scan(scan => scan
            .FromApplicationDependencies(assembly =>
                assembly.FullName.StartsWith("Identity") ||
                assembly.FullName.StartsWith("Attendance") ||
                assembly.FullName.StartsWith("Asset") ||
                assembly.FullName.StartsWith("Workflow") ||
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
            // MyClaimsTransformation caches its per-request reverse-DNS lookup here (see the class for why).
            services.AddMemoryCache();
            services.AddScoped<IClaimsTransformation, MyClaimsTransformation>();

            // AI Chat -> LM Studio typed HttpClient (docs/ai-chat-be-huong-dan.md). Not picked up by the
            // Scrutor scan above (class name ends in "Client", not Repository/UnitOfWork/Service) —
            // needs BaseAddress/Timeout, so it's registered explicitly instead.
            // ONE registration serves every module that runs a tool-calling chat (Asset AI Chat +
            // Attendance AI Chat) — the client lives in Shared.* and takes each module's tool
            // catalogue as a parameter, so there is nothing module-specific to register twice.
            // Was IOllamaChatClient/OllamaChatClient/AiChatSettings:OllamaBaseUrl before the internal
            // AI server moved from Ollama to LM Studio (2026-08-24).
            services.AddHttpClient<ILlmChatClient, LmStudioChatClient>((_, client) =>
            {
                var baseUrl = configuration["AiChatSettings:LmStudioBaseUrl"] ?? "http://localhost:1234/v1";
                // LM Studio's OpenAI-compatible base URL carries a real path segment ("/v1") that must
                // be PRESERVED, not replaced — HttpClient.BaseAddress + a relative request URI only
                // appends correctly when BaseAddress ends with "/"; without the trailing slash, .NET's
                // URI combining rules replace the last segment instead (the request in
                // LmStudioChatClient relies on this by using a relative, no-leading-slash URI).
                if (!baseUrl.EndsWith('/')) baseUrl += "/";
                client.BaseAddress = new Uri(baseUrl);
                // HttpClient.Timeout áp dụng cho TOÀN BỘ thời gian đọc xong response, không chỉ tới lúc
                // nhận header đầu — dù LmStudioChatClient dùng HttpCompletionOption.ResponseHeadersRead,
                // 1 câu hỏi cần tới 3 vòng gọi tool (mỗi vòng lại 1 SendAsync riêng, được cấp lại đủ
                // ngần này giây) vẫn có thể vượt mốc cũ 120s ở 1 vòng nếu model cục bộ trả lời dài hoặc
                // máy chạy LM Studio đang tải nặng — khi đó HttpClient tự hủy nửa chừng, FE nhận lỗi kết
                // nối dù model vẫn đang chạy bình thường, đúng kiểu "lúc được lúc không" (2026-07-27,
                // nâng + cho cấu hình qua AiChatSettings:TimeoutSeconds để tinh chỉnh không cần build lại).
                var timeoutSeconds = configuration.GetValue<int?>("AiChatSettings:TimeoutSeconds") ?? 300;
                client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
            });

            return services;
        }
    }
}