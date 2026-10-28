using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkshops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Workshops",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    WorkshopNameVn = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    WorkshopNameJp = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workshops", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workshops_WorkshopCode",
                table: "Workshops",
                column: "WorkshopCode",
                unique: true);

            // Every existing group belongs to the Dĩ An workshop; add the column nullable, backfill, then tighten.
            migrationBuilder.Sql("INSERT INTO Workshops (WorkshopCode, WorkshopNameVn, IsDeleted) VALUES (N'DA', N'Dĩ An', 0);");

            migrationBuilder.AddColumn<int>(
                name: "WorkshopId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.Sql("UPDATE Groups SET WorkshopId = (SELECT Id FROM Workshops WHERE WorkshopCode = N'DA');");

            migrationBuilder.AlterColumn<int>(
                name: "WorkshopId",
                table: "Groups",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_WorkshopId",
                table: "Groups",
                column: "WorkshopId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Workshops_WorkshopId",
                table: "Groups",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Workshops_WorkshopId",
                table: "Groups");

            migrationBuilder.DropTable(
                name: "Workshops");

            migrationBuilder.DropIndex(
                name: "IX_Groups_WorkshopId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "Groups");
        }
    }
}
