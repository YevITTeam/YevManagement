using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionEmployeeViewPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.ProductionEmployee.View: quyền xem màn "Nhân viên dưới chuyền" — tách khỏi
            // Attendance.Employee.View (2026-09-26). Gán cho các Role đang giữ ProductionEmployee.Import/Update.
            // Đồng thời gỡ các dòng quyền TỰ ĐỘNG CẤP (IsAutoGranted) của Import nhân sự dưới chuyền / import
            // lũy kế Excel — Người phụ trách Cây duyệt không còn tự có 2 quyền này, Admin phải chỉ định rõ.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.ProductionEmployee.View', N'Attendance', N'Xem danh sách nhân sự dưới chuyền');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT DISTINCT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId
    AND dp.Code IN (N'Attendance.ProductionEmployee.Import', N'Attendance.ProductionEmployee.Update')
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.ProductionEmployee.View';

DELETE up FROM UserPermissions up
INNER JOIN Permissions p ON p.Id = up.PermissionId
WHERE up.IsAutoGranted = 1
  AND p.Code IN (N'Attendance.ProductionEmployee.Import', N'Attendance.EmployeeAccumulation.Import');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionEmployee.View');
DELETE FROM UserPermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionEmployee.View');
DELETE FROM Permissions WHERE Code = N'Attendance.ProductionEmployee.View';
");
        }
    }
}
