using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    // Identity.LoginQr.Manage: generate / revoke the printable login QR of a user and read its log
    // (identity-module.md §5.8). One permission for all admin actions, granted to Admin only.
    public partial class AddLoginQr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LoginQrCodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CodeHash = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedByUserId = table.Column<int>(type: "int", nullable: true),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UseCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginQrCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoginQrCodes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LoginQrLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    QrCodeId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginQrLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginQrCodes_CodeHash",
                table: "LoginQrCodes",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoginQrCodes_UserId",
                table: "LoginQrCodes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_LoginQrLogs_UserId_CreatedAt",
                table: "LoginQrLogs",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Identity.LoginQr.Manage', N'Identity', N'Quản lý mã QR đăng nhập của người dùng'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Identity.LoginQr.Manage');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Identity.LoginQr.Manage'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Identity.LoginQr.Manage');
DELETE FROM Permissions WHERE Code = N'Identity.LoginQr.Manage';
");

            migrationBuilder.DropTable(
                name: "LoginQrCodes");

            migrationBuilder.DropTable(
                name: "LoginQrLogs");
        }
    }
}
