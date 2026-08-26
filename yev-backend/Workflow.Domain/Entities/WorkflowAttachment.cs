namespace Workflow.Domain.Entities;

// Metadata file đính kèm — file vật lý nằm trên đĩa (workflow-module.md §3.3), KHÔNG lưu byte[] trong
// DB. Chủ đơn được thêm/xoá xuyên suốt tới khi đơn kết thúc (Approved/Rejected/Cancelled), không giới
// hạn ở Draft (Pha 4B quyết định 2026-08-26 §10).
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
