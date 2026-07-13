using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class AssetSettingRepository : GenericRepository<AssetSetting, AssetDbContext>, IAssetSettingRepository
    {
        public AssetSettingRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
