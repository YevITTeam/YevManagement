namespace Workflow.Domain.Entities;

// Files live on disk, not as byte[] in DB. The owner may add/remove until the request is finished, not only in Draft.
public partial class WorkflowAttachment
{
    public int Id { get; set; }

    public int WorkflowRequestId { get; set; }

    public string OriginalFileName { get; set; } = null!;

    public string StoredFileName { get; set; } = null!;

    public string RelativePath { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public long FileSizeBytes { get; set; }

    public int UploadedByEmployeeId { get; set; }

    public DateTime UploadedAt { get; set; }

    public bool IsDeleted { get; set; }

    public virtual WorkflowRequest WorkflowRequest { get; set; } = null!;

    public virtual Employee UploadedByEmployee { get; set; } = null!;
}
