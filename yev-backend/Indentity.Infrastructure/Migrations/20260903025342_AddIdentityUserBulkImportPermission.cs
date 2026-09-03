using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentityUserBulkImportPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Permission cho import Excel hàng loạt liên kết Employee (Attendance) ↔ User (Identity):
            // tự tạo tài khoản Identity nếu chưa có + gán chữ ký thẳng không qua email-confirm — hành
            // động nhạy cảm nhất trong hệ thống nên KHÔNG auto-grant qua JobTitle/Coordinator, chỉ Admin
            // (2026-09-03, xem docs/docs-be/attendance-module.md).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Identity.User.BulkImport', N'Identity', N'Import Excel hàng loạt liên kết nhân viên với tài khoản đăng nhập, tự tạo tài khoản nếu chưa có, kèm chữ ký');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.User.BulkImport';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Identity.User.BulkImport');
DELETE FROM Permissions WHERE Code = N'Identity.User.BulkImport';
");
        }
    }
}
