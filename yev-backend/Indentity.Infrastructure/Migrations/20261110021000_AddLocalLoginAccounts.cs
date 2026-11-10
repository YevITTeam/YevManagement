using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLocalLoginAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LocalAccountPrefixes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Prefix = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocalAccountPrefixes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LocalLoginAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    PrefixId = table.Column<int>(type: "int", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    MustChangePassword = table.Column<bool>(type: "bit", nullable: false),
                    FailedLoginCount = table.Column<int>(type: "int", nullable: false),
                    LockedUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PasswordChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocalLoginAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LocalLoginAccounts_LocalAccountPrefixes_PrefixId",
                        column: x => x.PrefixId,
                        principalTable: "LocalAccountPrefixes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LocalLoginAccounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LocalAccountPrefixes_Prefix",
                table: "LocalAccountPrefixes",
                column: "Prefix",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LocalLoginAccounts_PrefixId",
                table: "LocalLoginAccounts",
                column: "PrefixId");

            migrationBuilder.CreateIndex(
                name: "IX_LocalLoginAccounts_UserId",
                table: "LocalLoginAccounts",
                column: "UserId",
                unique: true);

            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Identity.LocalAccount.Manage', N'Identity', N'Quản lý tiền tố và tài khoản nội bộ'
WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.Code = N'Identity.LocalAccount.Manage');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.LocalAccount.Manage'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = r.Id AND x.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Identity.LocalAccount.Manage');
DELETE FROM UserPermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Identity.LocalAccount.Manage');
DELETE FROM Permissions WHERE Code = N'Identity.LocalAccount.Manage';
");

            migrationBuilder.DropTable(
                name: "LocalLoginAccounts");

            migrationBuilder.DropTable(
                name: "LocalAccountPrefixes");
        }
    }
}
