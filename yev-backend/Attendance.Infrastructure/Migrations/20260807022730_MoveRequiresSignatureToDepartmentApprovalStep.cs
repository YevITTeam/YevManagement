using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MoveRequiresSignatureToDepartmentApprovalStep : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresSignature",
                table: "JobTitles");

            migrationBuilder.AddColumn<bool>(
                name: "RequiresSignature",
                table: "DepartmentApprovalSteps",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresSignature",
                table: "DepartmentApprovalSteps");

            migrationBuilder.AddColumn<bool>(
                name: "RequiresSignature",
                table: "JobTitles",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}
