using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionApprovalStepPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.ProductionApprovalStep.*: cấu hình tay cây duyệt "theo chuyền" (Chế tạo,
            // 2026-08-24) — xem docs/docs-be/attendance-module.md. Gán cho đúng các Role đang giữ
            // Attendance.Department.Create, cùng cách làm với AddDepartmentApprovalStepPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.ProductionApprovalStep.View', N'Attendance', N'Xem cây duyệt theo chuyền của Phòng ban'),
(N'Attendance.ProductionApprovalStep.Update', N'Attendance', N'Cấu hình cây duyệt theo chuyền của Phòng ban');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.ProductionApprovalStep.View', N'Attendance.ProductionApprovalStep.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.ProductionApprovalStep.View', N'Attendance.ProductionApprovalStep.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.ProductionApprovalStep.View', N'Attendance.ProductionApprovalStep.Update');
");
        }
    }
}
