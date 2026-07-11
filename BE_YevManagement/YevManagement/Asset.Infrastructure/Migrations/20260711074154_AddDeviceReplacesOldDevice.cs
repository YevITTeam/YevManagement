using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceReplacesOldDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReplacesOldDeviceId",
                table: "Devices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_ThayTheChoId",
                table: "Devices",
                column: "ReplacesOldDeviceId");

            migrationBuilder.AddForeignKey(
                name: "FK_ThietBis_ThietBis_ThayTheChoId",
                table: "Devices",
                column: "ReplacesOldDeviceId",
                principalTable: "Devices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThietBis_ThietBis_ThayTheChoId",
                table: "Devices");

            migrationBuilder.DropIndex(
                name: "IX_ThietBis_ThayTheChoId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "ReplacesOldDeviceId",
                table: "Devices");
        }
    }
}
