namespace Workflow.Domain.Entities;

// Cấu hình module, LUÔN đúng 1 dòng (Id = 1, seed sẵn trong migration — workflow-module.md §3.4). Không
// IsDeleted, không CRUD nhiều dòng, chỉ đọc/ghi đè giá trị của dòng duy nhất này.
// EmailTokenExpiryDays chưa được đọc ở đâu tới khi Pha 4C (duyệt qua email) scaffold
// WorkflowRequestEmailTokens — cột được tạo sẵn cùng bảng vì đã có trong thiết kế gốc, tránh phải thêm
// migration riêng chỉ để bổ sung 1 cột.
public partial class WorkflowSetting
{
    public int Id { get; set; }

    public int MaxAttachmentSizeMb { get; set; } = 10;

    public string AllowedFileExtensions { get; set; } = null!;

    public int MaxAttachmentPerRequest { get; set; } = 5;

    public int EmailTokenExpiryDays { get; set; } = 7;
}
