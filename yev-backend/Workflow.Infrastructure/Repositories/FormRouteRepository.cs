using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormRouteRepository : GenericRepository<FormRoute, WorkflowDbContext>, IFormRouteRepository
    {
        public FormRouteRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}
