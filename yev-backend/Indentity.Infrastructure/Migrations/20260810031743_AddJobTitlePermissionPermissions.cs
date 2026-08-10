using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitlePermissionPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.JobTitlePermission.*: cấu hình tay danh sách permission "tham gia quy
            // trình" mà 1 Chức vụ tự động cấp cho người giữ nó (2026-08-10) — xem
            // docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ". Gán cho đúng
            // các Role đang giữ Attendance.Department.Create (nhóm CRUD Danh mục, thực tế chỉ Admin),
            // cùng cách làm với AddGroupApprovalStepPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.JobTitlePermission.View', N'Attendance', N'Xem quyền tự động cấp theo Chức vụ'),
(N'Attendance.JobTitlePermission.Update', N'Attendance', N'Cấu hình quyền tự động cấp theo Chức vụ');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.JobTitlePermission.View', N'Attendance.JobTitlePermission.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.JobTitlePermission.View', N'Attendance.JobTitlePermission.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.JobTitlePermission.View', N'Attendance.JobTitlePermission.Update');
");
        }
    }
}
