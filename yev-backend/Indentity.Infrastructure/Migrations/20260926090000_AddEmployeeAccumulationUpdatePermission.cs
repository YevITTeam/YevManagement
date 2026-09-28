using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeAccumulationUpdatePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.EmployeeAccumulation.Update: sửa tay số giờ lũy kế (từng tháng + cả năm) của 1
            // nhân viên. Người phụ trách Bộ phận/Nhóm tự động có quyền này (xem
            // ApprovalStepCoordinatorPermissions.EmployeeAccumulationUpdateCode), scope theo đúng
            // Bộ phận/Nhóm họ phụ trách ở EmployeeService.EnsureCanManageAccumulationAsync. Gán thêm cho
            // các Role đang giữ Attendance.Employee.Update (Admin) — 2026-09-26.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.EmployeeAccumulation.Update', N'Attendance', N'Sửa tay số giờ lũy kế OT (từng tháng/cả năm) của 1 nhân viên');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Employee.Update'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.EmployeeAccumulation.Update';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.EmployeeAccumulation.Update');
DELETE FROM Permissions WHERE Code = N'Attendance.EmployeeAccumulation.Update';
");
        }
    }
}
