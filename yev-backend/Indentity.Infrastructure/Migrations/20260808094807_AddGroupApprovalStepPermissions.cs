using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupApprovalStepPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.GroupApprovalStep.*: cấu hình tay cây duyệt cấp trung gian (Staff/Group
            // Leader/Team Leader) theo từng Nhóm — xem docs/docs-be/attendance-module.md §Cây chức vụ.
            // Gán cho đúng các Role đang giữ Attendance.Department.Create (nhóm CRUD Danh mục, thực tế
            // chỉ Admin), cùng cách làm với AddDepartmentApprovalStepPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.GroupApprovalStep.View', N'Attendance', N'Xem cây duyệt của Nhóm'),
(N'Attendance.GroupApprovalStep.Update', N'Attendance', N'Cấu hình cây duyệt của Nhóm');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.GroupApprovalStep.View', N'Attendance.GroupApprovalStep.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.GroupApprovalStep.View', N'Attendance.GroupApprovalStep.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.GroupApprovalStep.View', N'Attendance.GroupApprovalStep.Update');
");
        }
    }
}
