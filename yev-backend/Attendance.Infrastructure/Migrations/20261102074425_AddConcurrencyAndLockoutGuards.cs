using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddConcurrencyAndLockoutGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedAttempts",
                table: "SecondaryPasswords",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockedUntil",
                table: "SecondaryPasswords",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "OtForms",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<decimal>(
                name: "LedgerHours",
                table: "OtFormEmployees",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastBatchSweepDate",
                table: "AttendanceSettings",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailedAttempts",
                table: "SecondaryPasswords");

            migrationBuilder.DropColumn(
                name: "LockedUntil",
                table: "SecondaryPasswords");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "LedgerHours",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "LastBatchSweepDate",
                table: "AttendanceSettings");
        }
    }
}
