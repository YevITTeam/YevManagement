using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMealTicketCountsToProcessPart : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MainTicketCount",
                table: "ProcessParts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MilkCount",
                table: "ProcessParts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SecondaryTicketCount",
                table: "ProcessParts",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MainTicketCount",
                table: "ProcessParts");

            migrationBuilder.DropColumn(
                name: "MilkCount",
                table: "ProcessParts");

            migrationBuilder.DropColumn(
                name: "SecondaryTicketCount",
                table: "ProcessParts");
        }
    }
}
