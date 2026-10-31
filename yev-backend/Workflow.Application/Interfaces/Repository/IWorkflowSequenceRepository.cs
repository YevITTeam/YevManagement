namespace Workflow.Application.Interfaces.Repository
{
    // Not an IGenericRepository<T>: composite PK (SequenceKey, Year) with no surrogate Id; only an atomic allocate is needed.
    public interface IWorkflowSequenceRepository
    {
        Task<int> GetNextSequenceAsync(string sequenceKey, int year);
    }
}
