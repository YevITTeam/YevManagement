using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormFields
{
    // Thay NGUYÊN danh sách ô nhập của 1 FormDefinition (workflow-module.md §6
    // PUT /FormDefinition/{id}/fields) — NHƯNG merge theo Id/FieldKey chứ KHÔNG xoá-tất-tạo-lại như
    // các pattern "replace" khác trong module, vì FormFieldConditions trỏ Id thẳng vào đây (xem
    // FormDefinitionService.ReplaceFieldsAsync). Item.Id = null nghĩa là dòng mới.
    public class ReplaceFormFieldsDto
    {
        [Required]
        public List<ReplaceFormFieldItemDto> Items { get; set; } = new();
    }

    public class ReplaceFormFieldItemDto
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "FieldKey không được để trống")]
        public string FieldKey { get; set; } = null!;

        [Required(ErrorMessage = "Nhãn ô nhập không được để trống")]
        public string LabelVn { get; set; } = null!;

        public string? LabelJp { get; set; }

        [Required(ErrorMessage = "Kiểu dữ liệu không được để trống")]
        public FieldDataType DataType { get; set; }

        public bool IsRequired { get; set; }

        [Range(1, 3, ErrorMessage = "ColumnSpan phải trong khoảng 1-3")]
        public int ColumnSpan { get; set; } = 1;

        public string? Placeholder { get; set; }

        public string? DefaultValue { get; set; }

        public string? OptionsJson { get; set; }

        public decimal? MinValue { get; set; }

        public decimal? MaxValue { get; set; }

        public int? MaxLength { get; set; }

        public string? HelpTextVn { get; set; }

        public int? FormDataSourceId { get; set; }

        public string? AutoNumberPattern { get; set; }

        public bool DefaultVisible { get; set; } = true;

        public bool IsReadOnly { get; set; }
    }
}
