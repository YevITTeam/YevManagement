using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionOtReportPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.ProductionOtReport.View: xem/xuất 2 báo cáo theo ngày cho đơn "dưới chuyền"
            // đã Hoàn tất — "Xuất số lượng phiếu đã sử dụng" (PDF) và "Tổng số giờ tăng ca 1 người/1
            // ngày" (Excel), xem docs/Note_OT.txt mục 1 dòng 10 và mục 2 (2026-08-28). Gán cho đúng
            // các Role đang giữ Attendance.Employee.Create, cùng cách làm với
            // AddProductionEmployeeImportPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.ProductionOtReport.View', N'Attendance', N'Xem/xuất báo cáo phiếu và tổng giờ tăng ca dưới chuyền theo ngày');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Employee.Create'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.ProductionOtReport.View';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionOtReport.View');
DELETE FROM Permissions WHERE Code = N'Attendance.ProductionOtReport.View';
");
        }
    }
}
