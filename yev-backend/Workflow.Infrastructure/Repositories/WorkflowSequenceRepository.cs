using Microsoft.EntityFrameworkCore;
using Workflow.Application.Interfaces.Repository;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    // MERGE WITH (HOLDLOCK) locks the (SequenceKey, Year) row; Database.SqlQuery joins the caller's open transaction.
    public class WorkflowSequenceRepository : IWorkflowSequenceRepository
    {
        private readonly WorkflowDbContext _dbContext;

        public WorkflowSequenceRepository(WorkflowDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<int> GetNextSequenceAsync(string sequenceKey, int year)
        {
            var results = await _dbContext.Database.SqlQuery<int>($@"
MERGE [WorkflowSequences] WITH (HOLDLOCK) AS target
USING (SELECT {sequenceKey} AS SequenceKey, {year} AS Year) AS source
ON target.SequenceKey = source.SequenceKey AND target.Year = source.Year
WHEN MATCHED THEN UPDATE SET LastSequence = target.LastSequence + 1
WHEN NOT MATCHED THEN INSERT (SequenceKey, Year, LastSequence) VALUES (source.SequenceKey, source.Year, 1)
OUTPUT INSERTED.LastSequence;")
                .ToListAsync();

            return results.Single();
        }
    }
}
