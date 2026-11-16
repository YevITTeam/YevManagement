using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductionTaskCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductionTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopId = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StaffKind = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionTasks_Workshops_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionTasks_WorkshopId_Code",
                table: "ProductionTasks",
                columns: new[] { "WorkshopId", "Code" },
                unique: true,
                filter: "[IsDeleted] = 0");

            // Seed from current employees: majority TT/GT per task and workshop (ties and Office go to GT).
            migrationBuilder.Sql(@"
INSERT INTO ProductionTasks (WorkshopId, Code, StaffKind, IsDeleted)
SELECT g.WorkshopId, MIN(LEFT(LTRIM(RTRIM(e.TaskName)), 50)),
       CASE WHEN UPPER(LEFT(LTRIM(RTRIM(e.TaskName)), 50)) = 'OFFICE'
                 OR SUM(CASE WHEN e.StaffKind = 'GT' THEN 1 ELSE 0 END) >= SUM(CASE WHEN e.StaffKind = 'TT' THEN 1 ELSE 0 END)
            THEN 'GT' ELSE 'TT' END,
       0
FROM Employees e
JOIN Groups g ON g.Id = e.GroupId
WHERE e.IsDeleted = 0 AND e.TaskName IS NOT NULL AND LTRIM(RTRIM(e.TaskName)) <> ''
GROUP BY g.WorkshopId, UPPER(LEFT(LTRIM(RTRIM(e.TaskName)), 50));

INSERT INTO ProductionTasks (WorkshopId, Code, StaffKind, IsDeleted)
SELECT w.Id, 'Office', 'GT', 0
FROM Workshops w
WHERE w.IsDeleted = 0
  AND NOT EXISTS (SELECT 1 FROM ProductionTasks t WHERE t.WorkshopId = w.Id AND t.Code = 'Office' AND t.IsDeleted = 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionTasks");
        }
    }
}
