using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbDeviceBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "UsbDevices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsbDevices_BranchId",
                table: "UsbDevices",
                column: "BranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_UsbDevices_ChiNhanhs_BranchId",
                table: "UsbDevices",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UsbDevices_ChiNhanhs_BranchId",
                table: "UsbDevices");

            migrationBuilder.DropIndex(
                name: "IX_UsbDevices_BranchId",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "UsbDevices");
        }
    }
}
