using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkCalendarAndOtCaseRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DailyOtHourLimitHoliday",
                table: "AttendanceSettings",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 12m);

            migrationBuilder.AddColumn<decimal>(
                name: "Th3MonthlyOtHourLimit",
                table: "AttendanceSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 25m);

            migrationBuilder.AddColumn<decimal>(
                name: "Th3YearlyOtHourLimit",
                table: "AttendanceSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 300m);

            migrationBuilder.CreateTable(
                name: "WorkCalendarDays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    DayType = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkCalendarDays", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkCalendarDays_Date",
                table: "WorkCalendarDays",
                column: "Date",
                unique: true);

            // Seed the 2026 company calendar (Yazaki calendar card): every Sunday, 11 public holidays and
            // 32 special holidays. A holiday that falls on a Sunday keeps the holiday type.
            var publicHolidays = new[]
            {
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 2, 16), new DateOnly(2026, 2, 17), new DateOnly(2026, 2, 18),
                new DateOnly(2026, 2, 19), new DateOnly(2026, 2, 20),
                new DateOnly(2026, 4, 27), new DateOnly(2026, 4, 30),
                new DateOnly(2026, 5, 1),
                new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 2),
            };
            var specialHolidays = new[]
            {
                new DateOnly(2026, 1, 17), new DateOnly(2026, 1, 24),
                new DateOnly(2026, 2, 13), new DateOnly(2026, 2, 14), new DateOnly(2026, 2, 21), new DateOnly(2026, 2, 23),
                new DateOnly(2026, 3, 14), new DateOnly(2026, 3, 21), new DateOnly(2026, 3, 31),
                new DateOnly(2026, 4, 18), new DateOnly(2026, 4, 28), new DateOnly(2026, 4, 29),
                new DateOnly(2026, 5, 2), new DateOnly(2026, 5, 23),
                new DateOnly(2026, 6, 13), new DateOnly(2026, 6, 20),
                new DateOnly(2026, 7, 18), new DateOnly(2026, 7, 25),
                new DateOnly(2026, 8, 12), new DateOnly(2026, 8, 13), new DateOnly(2026, 8, 14), new DateOnly(2026, 8, 15), new DateOnly(2026, 8, 31),
                new DateOnly(2026, 9, 12), new DateOnly(2026, 9, 19), new DateOnly(2026, 9, 30),
                new DateOnly(2026, 10, 10), new DateOnly(2026, 10, 17),
                new DateOnly(2026, 11, 14), new DateOnly(2026, 11, 21),
                new DateOnly(2026, 12, 12), new DateOnly(2026, 12, 19),
            };

            var seeded = new SortedDictionary<DateOnly, int>();
            for (var d = new DateOnly(2026, 1, 1); d.Year == 2026; d = d.AddDays(1))
                if (d.DayOfWeek == DayOfWeek.Sunday) seeded[d] = 1;
            foreach (var d in publicHolidays) seeded[d] = 2;
            foreach (var d in specialHolidays) seeded[d] = 3;

            foreach (var (date, dayType) in seeded)
            {
                migrationBuilder.InsertData(
                    table: "WorkCalendarDays",
                    columns: new[] { "Date", "DayType" },
                    values: new object[] { date, dayType });
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkCalendarDays");

            migrationBuilder.DropColumn(
                name: "DailyOtHourLimitHoliday",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "Th3MonthlyOtHourLimit",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "Th3YearlyOtHourLimit",
                table: "AttendanceSettings");
        }
    }
}
