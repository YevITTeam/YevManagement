using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbDeviceDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "UsbDevices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsbDevices_DepartmentId",
                table: "UsbDevices",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_UsbDevices_BoPhans_DepartmentId",
                table: "UsbDevices",
                column: "DepartmentId",
                principalTable: "DeviceDepartments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UsbDevices_BoPhans_DepartmentId",
                table: "UsbDevices");

            migrationBuilder.DropIndex(
                name: "IX_UsbDevices_DepartmentId",
                table: "UsbDevices");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "UsbDevices");
        }
    }
}
