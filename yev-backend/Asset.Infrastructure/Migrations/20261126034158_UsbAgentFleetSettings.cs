using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UsbAgentFleetSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DeviceId",
                table: "UsbAgents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsbAgentPurgeUninstalledDays",
                table: "AssetSettings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsbAgentSyncSeconds",
                table: "AssetSettings",
                type: "int",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.CreateIndex(
                name: "IX_UsbAgents_DeviceId",
                table: "UsbAgents",
                column: "DeviceId");

            migrationBuilder.AddForeignKey(
                name: "FK_UsbAgents_ThietBis_DeviceId",
                table: "UsbAgents",
                column: "DeviceId",
                principalTable: "Devices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UsbAgents_ThietBis_DeviceId",
                table: "UsbAgents");

            migrationBuilder.DropIndex(
                name: "IX_UsbAgents_DeviceId",
                table: "UsbAgents");

            migrationBuilder.DropColumn(
                name: "DeviceId",
                table: "UsbAgents");

            migrationBuilder.DropColumn(
                name: "UsbAgentPurgeUninstalledDays",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsbAgentSyncSeconds",
                table: "AssetSettings");
        }
    }
}
