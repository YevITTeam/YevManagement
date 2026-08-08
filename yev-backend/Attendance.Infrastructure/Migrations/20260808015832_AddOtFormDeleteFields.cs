using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormDeleteFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeleteReason",
                table: "OtForms",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "OtForms",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByFullName",
                table: "OtForms",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByUserName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeleteReason",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "DeletedByFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "DeletedByUserName",
                table: "OtForms");
        }
    }
}
