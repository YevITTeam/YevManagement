using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionCatalogs
{
    public enum ProductionCatalogKind
    {
        Line,
        Team,
        ShiftTeam
    }

    public class ProductionCatalogItemDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? NameVn { get; set; }
        public int? TeamId { get; set; }
        public string? TeamCode { get; set; }
        public string? CongDoan { get; set; }
        public int EmployeeCount { get; set; }
    }

    public class SaveProductionCatalogItemDto
    {
        [Required(ErrorMessage = "Mã không được để trống")]
        [MaxLength(50, ErrorMessage = "Mã tối đa 50 ký tự")]
        public string Code { get; set; } = null!;

        [MaxLength(100, ErrorMessage = "Tên tối đa 100 ký tự")]
        public string? NameVn { get; set; }

        public int? TeamId { get; set; }

        [MaxLength(50, ErrorMessage = "Công đoạn tối đa 50 ký tự")]
        public string? CongDoan { get; set; }
    }
}
