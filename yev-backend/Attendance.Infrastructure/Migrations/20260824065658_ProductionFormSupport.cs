using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductionFormSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "GroupId",
                table: "OtForms",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<bool>(
                name: "IsProductionForm",
                table: "OtForms",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "BlockCodeSnapshot",
                table: "OtFormEmployees",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CongDoanSnapshot",
                table: "OtFormEmployees",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShiftTeamCodeSnapshot",
                table: "OtFormEmployees",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaskNameSnapshot",
                table: "OtFormEmployees",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TeamCodeSnapshot",
                table: "OtFormEmployees",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsProductionForm",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "BlockCodeSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "CongDoanSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "ShiftTeamCodeSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "TaskNameSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "TeamCodeSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.AlterColumn<int>(
                name: "GroupId",
                table: "OtForms",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
