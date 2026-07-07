using Asset.Application.Interfaces.Service;
using Asset.Infrastructure.Context;
using Asset.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Asset.Infrastructure.Configuration
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddAssetModule(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("PCManagementConnection");
            services.AddDbContext<AssetDbContext>(options =>
                options.UseSqlServer(connectionString));

            return services;
        }
    }
}
