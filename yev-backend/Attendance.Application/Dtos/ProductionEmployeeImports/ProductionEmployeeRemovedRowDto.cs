namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    // 1 người đang có trong ProductionEmployees nhưng KHÔNG còn xuất hiện trong file mới — sẽ bị
    // soft-delete ở Confirm (không còn hiện trong danh sách chọn "Theo chuyền" khi tạo đơn OT).
    public class ProductionEmployeeRemovedRowDto
    {
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}
