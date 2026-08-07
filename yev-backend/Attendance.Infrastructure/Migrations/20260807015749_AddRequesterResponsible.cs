using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRequesterResponsible : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RequesterEmployeeId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequesterFullName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequesterUserName",
                table: "OtForms",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResponsibleEmployeeId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponsibleFullName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponsibleUserName",
                table: "OtForms",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequesterEmployeeId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResponsibleEmployeeId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_RequesterEmployeeId",
                table: "Groups",
                column: "RequesterEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_ResponsibleEmployeeId",
                table: "Groups",
                column: "ResponsibleEmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Employees_Requester",
                table: "Groups",
                column: "RequesterEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Employees_Responsible",
                table: "Groups",
                column: "ResponsibleEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Employees_Requester",
                table: "Groups");

            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Employees_Responsible",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_RequesterEmployeeId",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_ResponsibleEmployeeId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "RequesterEmployeeId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterUserName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleEmployeeId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleUserName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterEmployeeId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "ResponsibleEmployeeId",
                table: "Groups");
        }
    }
}
