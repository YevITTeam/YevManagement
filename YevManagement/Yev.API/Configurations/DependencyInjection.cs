using Yev.Services.Implementations;
using Yev.Repositories.Implementations;
using Microsoft.Extensions.DependencyInjection;
namespace Yev.API.Configurations
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureAndServices(this IServiceCollection services)
        {
            services.Scan(scan => scan
                // 1. Quét toàn bộ Project Yev.Repositories
                // Dùng AuthRepository như một "điểm neo" để Scrutor biết cần quét project nào
                .FromAssemblyOf<AuthRepository>()
                    .AddClasses(classes => classes.Where(type => type.Name.EndsWith("Repository")))
                    .AsImplementedInterfaces()
                    .WithScopedLifetime()

                // 2. Quét toàn bộ Project Yev.Services
                // Dùng AuthService như một "điểm neo" để Scrutor biết cần quét project nào
                .FromAssemblyOf<AuthService>()
                    .AddClasses(classes => classes.Where(type => type.Name.EndsWith("Service")))
                    .AsImplementedInterfaces()
                    .WithScopedLifetime()
            );

            return services;
        }
    }
}
