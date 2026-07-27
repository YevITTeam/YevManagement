using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceConfigurationHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeviceConfigurationHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeviceConfigurationId = table.Column<int>(type: "int", nullable: false),
                    Mainboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CPU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    RAM = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    HardDrive = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Monitor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Mouse = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Keyboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Headphone = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Speaker = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    UPS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PSU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    VGA = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Maker = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Model = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PowerAdapter = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    WirelessCard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NIC = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Other = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    EditedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SuaChuaThayThes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SuaChuaThayThes_CauHinhThietBis_CauHinhThietBiId",
                        column: x => x.DeviceConfigurationId,
                        principalTable: "DeviceConfigurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DeviceConfigurationInitials",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeviceConfigurationId = table.Column<int>(type: "int", nullable: false),
                    Mainboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CPU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    RAM = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    HardDrive = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Monitor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Mouse = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Keyboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Headphone = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Speaker = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    UPS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PSU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    VGA = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Maker = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Model = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PowerAdapter = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    WirelessCard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NIC = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Other = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CauHinhBanDaus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CauHinhBanDaus_CauHinhThietBis_CauHinhThietBiId",
                        column: x => x.DeviceConfigurationId,
                        principalTable: "DeviceConfigurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SuaChuaThayThes_CauHinhThietBiId",
                table: "DeviceConfigurationHistories",
                column: "DeviceConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_CauHinhBanDaus_CauHinhThietBiId",
                table: "DeviceConfigurationInitials",
                column: "DeviceConfigurationId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeviceConfigurationHistories");

            migrationBuilder.DropTable(
                name: "DeviceConfigurationInitials");
        }
    }
}
