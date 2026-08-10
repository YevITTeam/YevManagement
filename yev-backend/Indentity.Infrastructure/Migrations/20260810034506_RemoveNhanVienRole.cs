using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveNhanVienRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Role "Nhân viên" (seed ở AddNhanVienRoleForOtFormCreate, 2026-07-17) hết cần thiết từ
            // sau refactor "1 Role duy nhất cho OT" (Quản lý tăng ca, 2026-08-05) — khác biệt lập đơn
            // vs ký duyệt giờ do permission cấp riêng từng người quyết định, không còn phụ thuộc tên
            // Role nào (đã gỡ hết hardcode check tên Role). Xác nhận qua DB thật trước khi xoá
            // (2026-08-10): 0 UserRoles đang giữ Role này — an toàn, không ai bị ảnh hưởng. Xem
            // docs/docs-be/attendance-module.md §Giai đoạn 6.
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName = N'Nhân viên');
DELETE FROM UserRoles WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName = N'Nhân viên');
DELETE FROM Roles WHERE RoleName = N'Nhân viên';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Nhân viên', N'Tạo đơn tăng ca cho nhóm mình phụ trách — không ký/duyệt', 0);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Nhân viên' AND r.IsDeleted = 0
  AND p.Code IN (
      N'Attendance.OTForm.Create', N'Attendance.OTForm.View', N'Attendance.Employee.View',
      N'Attendance.Department.View', N'Attendance.Group.View', N'Attendance.Reason.View', N'Attendance.OtCase.View');
");
        }
    }
}
