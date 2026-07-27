using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceConfigurationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Maker",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NIC",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Other",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PowerAdapter",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WirelessCard",
                table: "DeviceConfigurations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Maker",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "NIC",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "Other",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "PowerAdapter",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "WirelessCard",
                table: "DeviceConfigurations");
        }
    }
}
