using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameUserIdToUserName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserSignatures_UserId",
                table: "UserSignatures");

            migrationBuilder.DropIndex(
                name: "IX_UserApprovalScopes_UserId",
                table: "UserApprovalScopes");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_CreatedByUserId",
                table: "OtForms");

            migrationBuilder.DropIndex(
                name: "IX_OtFormApprovalHistories_ApproverUserId",
                table: "OtFormApprovalHistories");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "UserSignatures");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "UserApprovalScopes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ApproverUserId",
                table: "OtFormApprovalHistories");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "UserSignatures",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "UserApprovalScopes",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ApproverUserName",
                table: "OtFormApprovalHistories",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_UserSignatures_UserName",
                table: "UserSignatures",
                column: "UserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserApprovalScopes_UserName",
                table: "UserApprovalScopes",
                column: "UserName");

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_CreatedByUserName",
                table: "OtForms",
                column: "CreatedByUserName");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalHistories_ApproverUserName",
                table: "OtFormApprovalHistories",
                column: "ApproverUserName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserSignatures_UserName",
                table: "UserSignatures");

            migrationBuilder.DropIndex(
                name: "IX_UserApprovalScopes_UserName",
                table: "UserApprovalScopes");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_CreatedByUserName",
                table: "OtForms");

            migrationBuilder.DropIndex(
                name: "IX_OtFormApprovalHistories_ApproverUserName",
                table: "OtFormApprovalHistories");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "UserSignatures");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "UserApprovalScopes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ApproverUserName",
                table: "OtFormApprovalHistories");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "UserSignatures",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "UserApprovalScopes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "OtForms",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ApproverUserId",
                table: "OtFormApprovalHistories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_UserSignatures_UserId",
                table: "UserSignatures",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserApprovalScopes_UserId",
                table: "UserApprovalScopes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_CreatedByUserId",
                table: "OtForms",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalHistories_ApproverUserId",
                table: "OtFormApprovalHistories",
                column: "ApproverUserId");
        }
    }
}
