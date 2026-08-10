using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBatchAutoSendTimeToAttendanceSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "BatchAutoSendTime",
                table: "AttendanceSettings",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(15, 0, 0));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BatchAutoSendTime",
                table: "AttendanceSettings");
        }
    }
}
