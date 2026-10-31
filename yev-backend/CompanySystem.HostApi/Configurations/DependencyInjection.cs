using Asset.Infrastructure.Context;
using Attendance.Infrastructure.Context;
using Identity.Application.Authentication;
using Identity.Infrastructure.Authentication;
using Identity.Infrastructure.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Shared.Application.Interfaces;
using Shared.Application.Interfaces.External;
using Shared.Infrastructure.External;
using Shared.Infrastructure.Services;
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

            // Split queries by default: a query with 2+ collection Includes otherwise becomes one JOIN that
            // multiplies rows (cartesian explosion) and triggers EF warning 20504. Single-collection queries
            // are unaffected; a hot path that needs one round-trip can opt back in with AsSingleQuery().
            services.AddDbContext<IdentityDbContext>(options =>
                options.UseSqlServer(identityConnectionString,
                    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
            services.AddDbContext<AssetDbContext>(options =>
                options.UseSqlServer(pcManagementConnectionString,
                    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
            services.AddDbContext<AttendanceDbContext>(options =>
                options.UseSqlServer(otManagementConnectionString,
                    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
            services.AddDbContext<WorkflowDbContext>(options =>
                options.UseSqlServer(workflowManagementConnectionString,
                    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));


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


            // Registered manually (name doesn't match the Scrutor scan); singleton so producers and QueuedHostedService share one channel.
            services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();

            services.AddHttpContextAccessor();
            // MyClaimsTransformation caches its per-request reverse-DNS lookup here (see the class for why).
            services.AddMemoryCache();
            services.AddSingleton<IAuthSnapshotCache, AuthSnapshotCache>();
            services.AddScoped<IClaimsTransformation, MyClaimsTransformation>();

            // Registered explicitly: the Scrutor scan skips "*Client" names and this needs BaseAddress/Timeout.
            // One registration serves every module's tool-calling chat.
            services.AddHttpClient<ILlmChatClient, LmStudioChatClient>((_, client) =>
            {
                var baseUrl = configuration["AiChatSettings:LmStudioBaseUrl"] ?? "http://localhost:1234/v1";
                // Trailing slash keeps the "/v1" segment; without it relative URIs replace the last segment.
                if (!baseUrl.EndsWith('/')) baseUrl += "/";
                client.BaseAddress = new Uri(baseUrl);
                // Timeout covers reading the whole response and each tool round gets it anew; long local-model answers
                // exceeded 120s, so it is higher and configurable.
                var timeoutSeconds = configuration.GetValue<int?>("AiChatSettings:TimeoutSeconds") ?? 300;
                client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
            });

            return services;
        }
    }
}