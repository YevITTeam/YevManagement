using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UsbFileEventSensitive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSensitive",
                table: "UsbFileEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_UsbFileEvents_OccurredAt_IsSensitive",
                table: "UsbFileEvents",
                columns: new[] { "OccurredAt", "IsSensitive" });

            // Backfill with the rule as it stood when this migration was written (Deleted = 3, CopiedIn = 5).
            static string Like(params string[] exts) => string.Join(" OR ", exts.Select(e => $"FilePath LIKE '%{e}'"));
            var sensitive = Like(".xlsx", ".xls", ".xlsm", ".csv", ".docx", ".doc", ".pdf", ".pptx", ".ppt",
                ".dwg", ".dxf", ".cad", ".sql", ".bak", ".mdb", ".accdb", ".sqlite", ".db",
                ".zip", ".rar", ".7z", ".tar", ".gz", ".pst", ".ost", ".kdbx", ".key", ".pem", ".pfx", ".env");
            var risky = Like(".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".pif", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".hta",
                ".jar", ".dll", ".lnk", ".reg", ".iso", ".img", ".docm", ".xlsm", ".pptm");
            migrationBuilder.Sql($@"UPDATE UsbFileEvents SET IsSensitive = 1
WHERE FilePath NOT LIKE '%\~$%' AND FilePath NOT LIKE '~$%'
  AND ((Action = 5 AND ({risky}))
    OR (Action NOT IN (3, 5) AND ({sensitive} OR SizeBytes >= 10485760)))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UsbFileEvents_OccurredAt_IsSensitive",
                table: "UsbFileEvents");

            migrationBuilder.DropColumn(
                name: "IsSensitive",
                table: "UsbFileEvents");
        }
    }
}
