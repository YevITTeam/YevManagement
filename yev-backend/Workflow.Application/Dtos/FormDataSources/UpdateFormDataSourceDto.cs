using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormDataSources
{
    public class UpdateFormDataSourceDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã nguồn dữ liệu không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên nguồn dữ liệu không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        [Required(ErrorMessage = "Loại nguồn dữ liệu không được để trống")]
        public DataSourceKind SourceKind { get; set; }

        public string? ConnectionName { get; set; }

        public string? SqlText { get; set; }

        [Required(ErrorMessage = "Cột giá trị không được để trống")]
        public string ValueColumn { get; set; } = null!;

        [Required(ErrorMessage = "Cột hiển thị không được để trống")]
        public string DisplayColumn { get; set; } = null!;

        public string? FilterJson { get; set; }
    }
}
