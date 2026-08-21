using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentityUserUpdateFullNamePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed permission for the Admin feature to edit an existing User's display name (FullName)
            // only — UserName (login identity) and DeviceName stay non-editable via this endpoint.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Identity.User.UpdateFullName', N'Identity', N'Sửa họ tên hiển thị của người dùng (không sửa được tên đăng nhập Windows)');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.User.UpdateFullName';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Identity.User.UpdateFullName');
DELETE FROM Permissions WHERE Code = N'Identity.User.UpdateFullName';
");
        }
    }
}
