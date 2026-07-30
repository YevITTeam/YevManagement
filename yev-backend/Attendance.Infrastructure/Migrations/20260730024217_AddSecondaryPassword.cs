using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSecondaryPassword : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PendingSecondaryPasswordConfirmations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Token = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingSecondaryPasswordConfirmations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SecondaryPasswords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecondaryPasswords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PendingSecondaryPasswordConfirmations_Token",
                table: "PendingSecondaryPasswordConfirmations",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingSecondaryPasswordConfirmations_UserName",
                table: "PendingSecondaryPasswordConfirmations",
                column: "UserName");

            migrationBuilder.CreateIndex(
                name: "IX_SecondaryPasswords_UserName",
                table: "SecondaryPasswords",
                column: "UserName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PendingSecondaryPasswordConfirmations");

            migrationBuilder.DropTable(
                name: "SecondaryPasswords");
        }
    }
}
