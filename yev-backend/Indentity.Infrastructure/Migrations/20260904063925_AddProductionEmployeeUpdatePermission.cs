using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionEmployeeUpdatePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.ProductionEmployee.Update: sửa tay Line/Team/Nhóm ca/Trưởng nhóm của 1 dòng
            // "Nhân viên dưới chuyền" ngay trên UI, không cần nạp lại cả file Excel (2026-09-04, theo
            // yêu cầu người dùng — xem docs/docs-be/attendance-module.md). Permission RIÊNG với
            // Attendance.ProductionEmployee.Import (Update = sửa nhanh 1 người, Import = nạp cả file) —
            // gán theo đúng các Role đang giữ Attendance.ProductionEmployee.Import, cùng cách làm với
            // AddProductionEmployeeImportPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.ProductionEmployee.Update', N'Attendance', N'Sửa Line/Team/Nhóm ca/Trưởng nhóm của nhân viên dưới chuyền');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.ProductionEmployee.Import'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.ProductionEmployee.Update';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionEmployee.Update');
DELETE FROM Permissions WHERE Code = N'Attendance.ProductionEmployee.Update';
");
        }
    }
}
