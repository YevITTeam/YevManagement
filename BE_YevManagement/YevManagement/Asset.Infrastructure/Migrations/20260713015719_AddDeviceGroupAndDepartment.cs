using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceGroupAndDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "Devices",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GroupId",
                table: "Devices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DeviceDepartments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DepartmentName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BoPhans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeviceGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GroupName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Nhoms", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_BoPhanId",
                table: "Devices",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_NhomId",
                table: "Devices",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_BoPhans_MaBoPhan",
                table: "DeviceDepartments",
                column: "DepartmentCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Nhoms_MaNhom",
                table: "DeviceGroups",
                column: "GroupCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ThietBis_BoPhans_BoPhanId",
                table: "Devices",
                column: "DepartmentId",
                principalTable: "DeviceDepartments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ThietBis_Nhoms_NhomId",
                table: "Devices",
                column: "GroupId",
                principalTable: "DeviceGroups",
                principalColumn: "Id");

            // Seed 1 default row per table so the FE has an option available right away — the
            // company's actual Group/Department list is not known yet, Admin can add/edit via the CRUD API later.
            migrationBuilder.Sql(@"
INSERT INTO DeviceGroups (GroupCode, GroupName, IsDeleted) VALUES (N'MD', N'Mặc định', 0);
INSERT INTO DeviceDepartments (DepartmentCode, DepartmentName, IsDeleted) VALUES (N'MD', N'Mặc định', 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThietBis_BoPhans_BoPhanId",
                table: "Devices");

            migrationBuilder.DropForeignKey(
                name: "FK_ThietBis_Nhoms_NhomId",
                table: "Devices");

            migrationBuilder.DropTable(
                name: "DeviceDepartments");

            migrationBuilder.DropTable(
                name: "DeviceGroups");

            migrationBuilder.DropIndex(
                name: "IX_ThietBis_BoPhanId",
                table: "Devices");

            migrationBuilder.DropIndex(
                name: "IX_ThietBis_NhomId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "Devices");
        }
    }
}
