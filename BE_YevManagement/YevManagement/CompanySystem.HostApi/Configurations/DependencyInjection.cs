using Asset.Infrastructure.Context;
using Identity.Infrastructure.Authentication;

//using CompanySystem.HostApi.Middlewares;
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

            services.AddDbContext<IdentityDbContext>(options =>
                options.UseSqlServer(identityConnectionString));
            services.AddDbContext<AssetDbContext>(options =>
                options.UseSqlServer(pcManagementConnectionString));


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

            return services;
        }
    }
}