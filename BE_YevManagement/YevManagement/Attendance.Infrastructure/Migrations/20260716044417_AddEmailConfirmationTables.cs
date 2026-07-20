using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfirmationTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OtFormApprovalEmailTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtFormId = table.Column<int>(type: "int", nullable: false),
                    ApproverUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ApproverFullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ApprovalLevel = table.Column<int>(type: "int", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormApprovalEmailTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormApprovalEmailTokens_OtForms_OtFormId",
                        column: x => x.OtFormId,
                        principalTable: "OtForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PendingSignatureConfirmations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SignatureImage = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingSignatureConfirmations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalEmailTokens_OtFormId",
                table: "OtFormApprovalEmailTokens",
                column: "OtFormId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalEmailTokens_Token",
                table: "OtFormApprovalEmailTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingSignatureConfirmations_Token",
                table: "PendingSignatureConfirmations",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingSignatureConfirmations_UserName",
                table: "PendingSignatureConfirmations",
                column: "UserName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OtFormApprovalEmailTokens");

            migrationBuilder.DropTable(
                name: "PendingSignatureConfirmations");
        }
    }
}
