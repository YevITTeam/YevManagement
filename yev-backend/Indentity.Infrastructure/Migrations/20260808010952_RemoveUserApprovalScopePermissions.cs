using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUserApprovalScopePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Màn "Phân quyền duyệt" (UserApprovalScope) đã xoá hẳn (2026-08-08, Giai đoạn 3.2 — orphaned
            // từ khi Cây chức vụ thay thế hoàn toàn ở Giai đoạn 3.1, xem docs/attendance-module.md).
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.UserApprovalScope.View', N'Attendance.UserApprovalScope.Create', N'Attendance.UserApprovalScope.Delete'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.UserApprovalScope.View', N'Attendance.UserApprovalScope.Create', N'Attendance.UserApprovalScope.Delete');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.UserApprovalScope.View', N'Attendance', N'Xem phân quyền duyệt theo phạm vi'),
(N'Attendance.UserApprovalScope.Create', N'Attendance', N'Gán phân quyền duyệt theo phạm vi'),
(N'Attendance.UserApprovalScope.Delete', N'Attendance', N'Xóa phân quyền duyệt theo phạm vi');
");
        }
    }
}
