using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Reference data for khối chuyền (Chế tạo): Team = giá trị cột "Khu/Team" trong
// Thong_Tin_Line_Team.xlsx (1/2 cho khối sản xuất trực tiếp; HC/GT A/ab/C cho khối
// hành chính/hỗ trợ — ý nghĩa 4 giá trị này chưa được xác nhận, xem ProductionLine).
public partial class ProductionTeam
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? NameVn { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ProductionLine> ProductionLines { get; set; } = new List<ProductionLine>();

    public virtual ICollection<ProductionEmployee> ProductionEmployees { get; set; } = new List<ProductionEmployee>();
}
