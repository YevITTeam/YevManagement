using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsbDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VendorId = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    ProductId = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    SerialNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FriendlyName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    CapacityBytes = table.Column<long>(type: "bigint", nullable: true),
                    FirstSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UsbSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DeviceId = table.Column<int>(type: "int", nullable: true),
                    UsbDeviceId = table.Column<int>(type: "int", nullable: false),
                    WindowsUser = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DriveLetter = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    VolumeLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ConnectedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DisconnectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WasPermitted = table.Column<bool>(type: "bit", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsbSessions_ThietBis_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "Devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UsbSessions_UsbDevices_UsbDeviceId",
                        column: x => x.UsbDeviceId,
                        principalTable: "UsbDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UsbFileEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<int>(type: "int", nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    OldFilePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsbFileEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsbFileEvents_UsbSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "UsbSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsbDevices_Vid_Pid_Serial",
                table: "UsbDevices",
                columns: new[] { "VendorId", "ProductId", "SerialNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsbFileEvents_EventId",
                table: "UsbFileEvents",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsbFileEvents_SessionId",
                table: "UsbFileEvents",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_UsbSessions_ConnectedAt",
                table: "UsbSessions",
                column: "ConnectedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UsbSessions_DeviceId",
                table: "UsbSessions",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_UsbSessions_UsbDeviceId",
                table: "UsbSessions",
                column: "UsbDeviceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsbFileEvents");

            migrationBuilder.DropTable(
                name: "UsbSessions");

            migrationBuilder.DropTable(
                name: "UsbDevices");
        }
    }
}
