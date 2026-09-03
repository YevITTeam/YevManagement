using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeUpdateOtLimitPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.Employee.UpdateOtLimit: sửa RIÊNG giới hạn OT/tháng/năm của 1 nhân viên — tách
            // khỏi Attendance.Employee.Update (quyền đó còn cho sửa Code/Tên/Group/... của MỌI nhân
            // viên, quá rộng để cấp cho Người phụ trách Bộ phận). Người phụ trách Bộ phận (đã gán qua
            // DepartmentApprovalStepCoordinator) tự động có quyền này (xem
            // ApprovalStepCoordinatorPermissions.EmployeeUpdateOtLimitCode), scope theo ĐÚNG Phòng ban
            // họ phụ trách qua IDepartmentAccessGuard — 2026-08-29, theo yêu cầu người dùng. Gán thêm
            // cho các Role đang giữ Attendance.Employee.Update để không ai (kể cả Admin) bị tụt quyền
            // so với hiện tại.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.Employee.UpdateOtLimit', N'Attendance', N'Sửa giới hạn giờ OT/tháng/năm riêng của 1 nhân viên');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Employee.Update'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.Employee.UpdateOtLimit';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.Employee.UpdateOtLimit');
DELETE FROM Permissions WHERE Code = N'Attendance.Employee.UpdateOtLimit';
");
        }
    }
}
