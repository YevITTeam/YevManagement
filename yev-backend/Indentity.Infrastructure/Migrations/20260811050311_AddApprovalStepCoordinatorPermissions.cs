using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalStepCoordinatorPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.DepartmentApprovalStepCoordinator.*/GroupApprovalStepCoordinator.*: quản lý
            // danh sách người được CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Bộ phận/Nhóm
            // (2026-08-11) — xem docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách
            // Cây duyệt". CHỈ Admin được sửa danh sách này (không đưa vào JobTitlePermissionWhitelist —
            // nếu không sẽ tái tạo rủi ro tự leo thang quyền quản trị đã loại bỏ khi xoá
            // UserApprovalScope). Gán cho đúng các Role đang giữ Attendance.Department.Create (nhóm
            // CRUD Danh mục, thực tế chỉ Admin), cùng cách làm với AddJobTitlePermissionPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.DepartmentApprovalStepCoordinator.View', N'Attendance', N'Xem người phụ trách Cây duyệt Bộ phận'),
(N'Attendance.DepartmentApprovalStepCoordinator.Update', N'Attendance', N'Gán người phụ trách Cây duyệt Bộ phận'),
(N'Attendance.GroupApprovalStepCoordinator.View', N'Attendance', N'Xem người phụ trách Cây duyệt Nhóm'),
(N'Attendance.GroupApprovalStepCoordinator.Update', N'Attendance', N'Gán người phụ trách Cây duyệt Nhóm');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (
    N'Attendance.DepartmentApprovalStepCoordinator.View', N'Attendance.DepartmentApprovalStepCoordinator.Update',
    N'Attendance.GroupApprovalStepCoordinator.View', N'Attendance.GroupApprovalStepCoordinator.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.DepartmentApprovalStepCoordinator.View', N'Attendance.DepartmentApprovalStepCoordinator.Update',
        N'Attendance.GroupApprovalStepCoordinator.View', N'Attendance.GroupApprovalStepCoordinator.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.DepartmentApprovalStepCoordinator.View', N'Attendance.DepartmentApprovalStepCoordinator.Update',
    N'Attendance.GroupApprovalStepCoordinator.View', N'Attendance.GroupApprovalStepCoordinator.Update');
");
        }
    }
}
