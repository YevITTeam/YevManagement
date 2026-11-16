using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveProductionApprovalTree : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Each department's production chain becomes the intermediate levels of every group of it that has no tree yet,
-- with the same people the chain resolved to: the line's Line Leaders, and Group/Team Leaders of the same department and workshop.
DECLARE @lvl TABLE (GroupId int, JobTitleId int, StepOrder int, RequiresSignature bit, IsResponsible bit, IsLineScoped bit, DepartmentId int, WorkshopId int);
INSERT @lvl
SELECT g.Id, p.JobTitleId, p.StepOrder, p.RequiresSignature, p.IsResponsible, j.IsLineScoped, g.DepartmentId, g.WorkshopId
FROM ProductionApprovalSteps p
JOIN JobTitles j ON j.Id = p.JobTitleId
JOIN Groups g ON g.DepartmentId = p.DepartmentId AND g.IsDeleted = 0
WHERE p.IsDeleted = 0 AND j.TerminalLevel = 0
    AND NOT EXISTS (SELECT 1 FROM GroupApprovalSteps s WHERE s.GroupId = g.Id AND s.IsDeleted = 0);

DECLARE @mem TABLE (GroupId int, JobTitleId int, EmployeeId int);
INSERT @mem
SELECT DISTINCT l.GroupId, l.JobTitleId, e.Id
FROM @lvl l
JOIN Employees e ON e.IsDeleted = 0 AND e.UserName IS NOT NULL AND e.JobTitleId = l.JobTitleId
JOIN Groups eg ON eg.Id = e.GroupId AND eg.DepartmentId = l.DepartmentId
WHERE (l.IsLineScoped = 1 AND EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = l.GroupId AND gl.ProductionLineId = e.ProductionLineId))
    OR (l.IsLineScoped = 0 AND eg.WorkshopId = l.WorkshopId);

INSERT GroupApprovalSteps (GroupId, StepOrder, JobTitleId, RequiresSignature, IsResponsible, CanResubmit, ResubmitSkipsIntermediate, IsDeleted)
SELECT l.GroupId, ROW_NUMBER() OVER (PARTITION BY l.GroupId ORDER BY l.StepOrder), l.JobTitleId, l.RequiresSignature, l.IsResponsible, 0, 0, 0
FROM @lvl l
WHERE EXISTS (SELECT 1 FROM @mem m WHERE m.GroupId = l.GroupId AND m.JobTitleId = l.JobTitleId);

INSERT GroupApprovalStepMembers (GroupApprovalStepId, EmployeeId, ReceivesMail)
SELECT s.Id, m.EmployeeId, 1
FROM @mem m JOIN GroupApprovalSteps s ON s.GroupId = m.GroupId AND s.JobTitleId = m.JobTitleId AND s.IsDeleted = 0;

-- One way to create forms: whoever could create production forms by job title now creates group forms.
UPDATE c SET IsDeleted = 0
FROM JobTitlePermissions c
WHERE c.PermissionCode = N'Attendance.OTForm.Create' AND c.IsDeleted = 1
    AND EXISTS (SELECT 1 FROM JobTitlePermissions p WHERE p.JobTitleId = c.JobTitleId AND p.PermissionCode = N'Attendance.OTForm.CreateProduction' AND p.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM JobTitlePermissions x WHERE x.JobTitleId = c.JobTitleId AND x.PermissionCode = N'Attendance.OTForm.Create' AND x.IsDeleted = 0);
INSERT JobTitlePermissions (JobTitleId, PermissionCode, IsDeleted)
SELECT DISTINCT p.JobTitleId, N'Attendance.OTForm.Create', 0
FROM JobTitlePermissions p
WHERE p.PermissionCode = N'Attendance.OTForm.CreateProduction' AND p.IsDeleted = 0
    AND NOT EXISTS (SELECT 1 FROM JobTitlePermissions x WHERE x.JobTitleId = p.JobTitleId AND x.PermissionCode = N'Attendance.OTForm.Create');
UPDATE JobTitlePermissions SET IsDeleted = 1 WHERE PermissionCode = N'Attendance.OTForm.CreateProduction' AND IsDeleted = 0;
");

            migrationBuilder.DropTable(
                name: "ProductionApprovalSteps");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductionApprovalSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    JobTitleId = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    IsResponsible = table.Column<bool>(type: "bit", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "bit", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionApprovalSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionApprovalSteps_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionApprovalSteps_JobTitles_JobTitleId",
                        column: x => x.JobTitleId,
                        principalTable: "JobTitles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionApprovalSteps_DepartmentId",
                table: "ProductionApprovalSteps",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionApprovalSteps_JobTitleId",
                table: "ProductionApprovalSteps",
                column: "JobTitleId");
        }
    }
}
