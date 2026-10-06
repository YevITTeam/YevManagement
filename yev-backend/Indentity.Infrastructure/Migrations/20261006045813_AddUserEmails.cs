using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    // UserEmails + UserEmailModules (identity-module.md §5.9), backfilled from Users.Email, and the
    // Identity.UserEmail.Manage permission granted to Admin.
    public partial class AddUserEmails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserEmails",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Source = table.Column<int>(type: "int", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEmails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserEmails_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserEmailModules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ModuleCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    UserEmailId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEmailModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserEmailModules_UserEmails_UserEmailId",
                        column: x => x.UserEmailId,
                        principalTable: "UserEmails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserEmailModules_UserEmailId",
                table: "UserEmailModules",
                column: "UserEmailId");

            migrationBuilder.CreateIndex(
                name: "IX_UserEmailModules_UserId_ModuleCode",
                table: "UserEmailModules",
                columns: new[] { "UserId", "ModuleCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserEmails_UserId_Email",
                table: "UserEmails",
                columns: new[] { "UserId", "Email" },
                unique: true);

            // Every existing User.Email becomes the primary UserEmail (source AD, where it came from).
            migrationBuilder.Sql(@"
INSERT INTO UserEmails (UserId, Email, Source, IsPrimary, Note, CreatedAt)
SELECT Id, LTRIM(RTRIM(Email)), 0, 1, NULL, SYSUTCDATETIME()
FROM Users
WHERE Email IS NOT NULL AND LTRIM(RTRIM(Email)) <> N'';

UPDATE Users SET Email = LTRIM(RTRIM(Email)) WHERE Email IS NOT NULL AND Email <> LTRIM(RTRIM(Email));
UPDATE Users SET Email = NULL WHERE Email IS NOT NULL AND LTRIM(RTRIM(Email)) = N'';
");

            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Identity.UserEmail.Manage', N'Identity', N'Quản lý email của người dùng và email nhận theo từng module'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Identity.UserEmail.Manage');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.UserEmail.Manage'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Identity.UserEmail.Manage');
DELETE FROM Permissions WHERE Code = N'Identity.UserEmail.Manage';
");

            migrationBuilder.DropTable(
                name: "UserEmailModules");

            migrationBuilder.DropTable(
                name: "UserEmails");
        }
    }
}
