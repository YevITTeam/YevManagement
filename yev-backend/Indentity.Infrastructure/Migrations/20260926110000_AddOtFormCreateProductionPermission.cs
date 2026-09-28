using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormCreateProductionPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.CreateProduction: quyền tạo đơn tăng ca THEO CHUYỀN (2026-09-26). Trước đây
            // hardcode "phải là Line Leader" trong OtFormService; nay Admin cấu hình theo Chức vụ (Line Leader
            // tick sẵn) hoặc từng user. Gán cho các Role đang giữ Attendance.Employee.Update (Admin).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.OTForm.CreateProduction', N'Attendance', N'Tạo đơn tăng ca theo chuyền');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT DISTINCT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Employee.Update'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.OTForm.CreateProduction';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.CreateProduction');
DELETE FROM UserPermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.CreateProduction');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.CreateProduction';
");
        }
    }
}
