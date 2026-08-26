using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.WorkflowSettings
{
    public class WorkflowSettingDto
    {
        public int MaxAttachmentSizeMb { get; set; }
        public string AllowedFileExtensions { get; set; } = null!;
        public int MaxAttachmentPerRequest { get; set; }
        public int EmailTokenExpiryDays { get; set; }
    }

    public class UpdateWorkflowSettingDto
    {
        [Range(1, 1000, ErrorMessage = "Dung lượng tối đa phải từ 1 tới 1000 MB.")]
        public int MaxAttachmentSizeMb { get; set; }

        [Required(ErrorMessage = "Danh sách phần mở rộng cho phép là bắt buộc.")]
        [MaxLength(500, ErrorMessage = "Danh sách phần mở rộng tối đa 500 ký tự.")]
        public string AllowedFileExtensions { get; set; } = null!;

        [Range(1, 100, ErrorMessage = "Số lượng file tối đa phải từ 1 tới 100.")]
        public int MaxAttachmentPerRequest { get; set; }

        [Range(1, 90, ErrorMessage = "Số ngày hết hạn token email phải từ 1 tới 90.")]
        public int EmailTokenExpiryDays { get; set; }
    }
}
