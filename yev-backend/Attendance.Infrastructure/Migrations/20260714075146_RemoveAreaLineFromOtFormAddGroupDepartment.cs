using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAreaLineFromOtFormAddGroupDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_Areas_AreaId",
                table: "OtForms");

            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_Lines_LineId",
                table: "OtForms");

            migrationBuilder.DropTable(
                name: "Areas");

            migrationBuilder.DropTable(
                name: "Lines");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_AreaId",
                table: "OtForms");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_LineId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "LineId",
                table: "OtForms");

            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "Groups",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_DepartmentId",
                table: "Groups",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Departments_DepartmentId",
                table: "Groups",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Departments_DepartmentId",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_DepartmentId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Groups");

            migrationBuilder.AddColumn<int>(
                name: "AreaId",
                table: "OtForms",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LineId",
                table: "OtForms",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Areas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AreaCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AreaDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AreaName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Areas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Lines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    LineCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LineNameJp = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    LineNameVn = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lines", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_AreaId",
                table: "OtForms",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_LineId",
                table: "OtForms",
                column: "LineId");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_AreaCode",
                table: "Areas",
                column: "AreaCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Lines_LineCode",
                table: "Lines",
                column: "LineCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_Areas_AreaId",
                table: "OtForms",
                column: "AreaId",
                principalTable: "Areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_Lines_LineId",
                table: "OtForms",
                column: "LineId",
                principalTable: "Lines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
