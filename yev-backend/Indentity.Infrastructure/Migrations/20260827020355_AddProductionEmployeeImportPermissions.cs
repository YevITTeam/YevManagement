using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionEmployeeImportPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.ProductionEmployee.Import/.Export: import/xuất "Nhân sự dưới chuyền" theo file
            // mẫu Chế Tạo (2026-08-27) — xem docs/docs-be/attendance-module.md. Attendance.EmployeeAccumulation.Import
            // TÁCH RIÊNG khỏi Import thường vì đụng lũy kế OT ảnh hưởng lương (theo yêu cầu người dùng).
            // Gán cho đúng các Role đang giữ Attendance.Employee.Create, cùng cách làm với
            // AddProductionApprovalStepPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.ProductionEmployee.Import', N'Attendance', N'Import nhân sự dưới chuyền từ file Excel'),
(N'Attendance.ProductionEmployee.Export', N'Attendance', N'Xuất nhân sự dưới chuyền ra file Excel'),
(N'Attendance.EmployeeAccumulation.Import', N'Attendance', N'Áp dụng lũy kế OT từ file import nhân sự dưới chuyền (ảnh hưởng lương)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Employee.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (
    N'Attendance.ProductionEmployee.Import', N'Attendance.ProductionEmployee.Export',
    N'Attendance.EmployeeAccumulation.Import');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.ProductionEmployee.Import', N'Attendance.ProductionEmployee.Export',
        N'Attendance.EmployeeAccumulation.Import'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.ProductionEmployee.Import', N'Attendance.ProductionEmployee.Export',
    N'Attendance.EmployeeAccumulation.Import');
");
        }
    }
}
