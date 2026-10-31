namespace Workflow.Domain.Entities;

// Always exactly one row (Id = 1, seeded by migration); no IsDeleted.
public partial class WorkflowSetting
{
    public int Id { get; set; }

    public int MaxAttachmentSizeMb { get; set; } = 10;

    public string AllowedFileExtensions { get; set; } = null!;

    public int MaxAttachmentPerRequest { get; set; } = 5;

    public int EmailTokenExpiryDays { get; set; } = 7;
}
