using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentityUserCreatePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed permission mới cho tính năng Admin tạo thủ công 1 User (UserName +
            // DeviceName + chọn Role) — pre-provision trước khi người dùng đăng nhập lần đầu.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Identity.User.Create', N'Identity', N'Tạo thủ công 1 người dùng (UserName + DeviceName + gán Role) trước khi người dùng đăng nhập Windows lần đầu');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.User.Create';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Identity.User.Create');
DELETE FROM Permissions WHERE Code = N'Identity.User.Create';
");
        }
    }
}
