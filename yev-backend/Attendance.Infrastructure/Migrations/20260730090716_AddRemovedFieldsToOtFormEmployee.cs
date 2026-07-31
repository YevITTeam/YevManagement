using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRemovedFieldsToOtFormEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRemoved",
                table: "OtFormEmployees",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RemoveReason",
                table: "OtFormEmployees",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RemovedAt",
                table: "OtFormEmployees",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RemovedAtLevel",
                table: "OtFormEmployees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RemovedByFullName",
                table: "OtFormEmployees",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RemovedByUserName",
                table: "OtFormEmployees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRemoved",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "RemoveReason",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "RemovedAt",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "RemovedAtLevel",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "RemovedByFullName",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "RemovedByUserName",
                table: "OtFormEmployees");
        }
    }
}
