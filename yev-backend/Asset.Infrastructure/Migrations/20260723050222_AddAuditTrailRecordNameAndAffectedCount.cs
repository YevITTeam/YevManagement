using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditTrailRecordNameAndAffectedCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Wipe the existing history (user decision 2026-07-23): the old rows have no RecordName and
            // are polluted by bulk operations logged one row per record (e.g. 255 rows per IP prefix),
            // so they are not worth migrating. Fresh start with the new format.
            migrationBuilder.Sql("DELETE FROM [AuditTrails];");
            migrationBuilder.Sql("DBCC CHECKIDENT ('[AuditTrails]', RESEED, 0);");

            migrationBuilder.AddColumn<int>(
                name: "AffectedCount",
                table: "AuditTrails",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "RecordName",
                table: "AuditTrails",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditTrails_ChangedAt",
                table: "AuditTrails",
                column: "ChangedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditTrails_TableName_RecordId",
                table: "AuditTrails",
                columns: new[] { "TableName", "RecordId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AuditTrails_ChangedAt",
                table: "AuditTrails");

            migrationBuilder.DropIndex(
                name: "IX_AuditTrails_TableName_RecordId",
                table: "AuditTrails");

            migrationBuilder.DropColumn(
                name: "AffectedCount",
                table: "AuditTrails");

            migrationBuilder.DropColumn(
                name: "RecordName",
                table: "AuditTrails");
        }
    }
}
