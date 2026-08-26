namespace Workflow.Application.Interfaces.Repository
{
    // KHÔNG kế thừa IGenericRepository<T> — WorkflowSequences có PK composite (SequenceKey, Year),
    // không có Id surrogate nên các thao tác CRUD chuẩn của GenericRepository không áp dụng được.
    // Chỉ cần đúng 1 thao tác cấp số atomic (workflow-module.md §5.4).
    public interface IWorkflowSequenceRepository
    {
        Task<int> GetNextSequenceAsync(string sequenceKey, int year);
    }
}
