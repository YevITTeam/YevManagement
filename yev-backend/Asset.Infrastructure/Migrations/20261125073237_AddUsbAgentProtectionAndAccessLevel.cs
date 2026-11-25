using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbAgentProtectionAndAccessLevel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccessLevel",
                table: "UsbDevices",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<bool>(
                name: "IsSharedSerial",
                table: "UsbDevices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UsbAgentTargetVersion",
                table: "AssetSettings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UsbAgentUpdateMachines",
                table: "AssetSettings",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UsbTrackCopyIn",
                table: "AssetSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UsbUninstallPasswordHash",
                table: "AssetSettings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UsbAgentEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Actor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Detail = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbAgentEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UsbAgentReleases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Signature = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    UploadedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbAgentReleases", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsbAgentEvents_EventId",
                table: "UsbAgentEvents",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsbAgentEvents_Machine_OccurredAt",
                table: "UsbAgentEvents",
                columns: new[] { "MachineName", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UsbAgentReleases_Version",
                table: "UsbAgentReleases",
                column: "Version",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsbAgentEvents");

            migrationBuilder.DropTable(
                name: "UsbAgentReleases");

            migrationBuilder.DropColumn(
                name: "AccessLevel",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "IsSharedSerial",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "UsbAgentTargetVersion",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsbAgentUpdateMachines",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsbTrackCopyIn",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsbUninstallPasswordHash",
                table: "AssetSettings");
        }
    }
}
