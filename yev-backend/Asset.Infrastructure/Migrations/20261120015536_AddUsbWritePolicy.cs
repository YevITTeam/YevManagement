using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbWritePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PolicyResult",
                table: "UsbSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalNote",
                table: "UsbDevices",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "UsbDevices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "UsbDevices",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceClass",
                table: "UsbDevices",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "DiskDrive");

            migrationBuilder.AddColumn<bool>(
                name: "IsApproved",
                table: "UsbDevices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "UsbBlockMode",
                table: "AssetSettings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UsbEnforceMachines",
                table: "AssetSettings",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UsbAgents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MachineName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AgentVersion = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    WindowsUser = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    FirstSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbAgents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsbAgents_MachineName",
                table: "UsbAgents",
                column: "MachineName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsbAgents");

            migrationBuilder.DropColumn(
                name: "PolicyResult",
                table: "UsbSessions");

            migrationBuilder.DropColumn(
                name: "ApprovalNote",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "DeviceClass",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "IsApproved",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "UsbBlockMode",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsbEnforceMachines",
                table: "AssetSettings");
        }
    }
}
