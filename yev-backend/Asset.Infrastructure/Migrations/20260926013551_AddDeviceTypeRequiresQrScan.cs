using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceTypeRequiresQrScan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiresQrScan",
                table: "DeviceTypes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Only iDRAC/SAN hardware physically sits in the server room and is scanned by QR; every other
            // ticked type (SVR/SWT/UPS/NAS/air conditioner) is verified by ping / auto-OK (asset-module.md §1.19).
            migrationBuilder.Sql("UPDATE DeviceTypes SET RequiresQrScan = 1 WHERE TypeCode = 'IDR';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresQrScan",
                table: "DeviceTypes");
        }
    }
}
