using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionCatalogs
{
    public enum ProductionCatalogKind
    {
        Line,
        Team,
        ShiftTeam,
        Task
    }

    public class ProductionCatalogItemDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? NameVn { get; set; }
        public int? WorkshopId { get; set; }
        public string? WorkshopCode { get; set; }
        public int? TeamId { get; set; }
        public string? TeamCode { get; set; }
        public string? CongDoan { get; set; }
        public string? CdMae { get; set; }
        public string? SortCode { get; set; }
        // Task only: TT/GT.
        public string? StaffKind { get; set; }
        public int EmployeeCount { get; set; }
    }

    public class SaveProductionCatalogItemDto
    {
        [Required(ErrorMessage = "Mã không được để trống")]
        [MaxLength(50, ErrorMessage = "Mã tối đa 50 ký tự")]
        public string Code { get; set; } = null!;

        [MaxLength(100, ErrorMessage = "Tên tối đa 100 ký tự")]
        public string? NameVn { get; set; }

        // Required for Line, Team and Task, ignored for ShiftTeam (shared by every workshop).
        public int? WorkshopId { get; set; }

        public int? TeamId { get; set; }

        [MaxLength(50, ErrorMessage = "Công đoạn tối đa 50 ký tự")]
        public string? CongDoan { get; set; }

        [MaxLength(50, ErrorMessage = "CD_MAE tối đa 50 ký tự")]
        public string? CdMae { get; set; }

        [MaxLength(50, ErrorMessage = "Co tối đa 50 ký tự")]
        public string? SortCode { get; set; }


        public string? StaffKind { get; set; }
    }
}
