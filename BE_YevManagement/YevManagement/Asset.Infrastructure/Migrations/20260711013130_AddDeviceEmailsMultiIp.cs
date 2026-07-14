using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceEmailsMultiIp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeviceEmails",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeviceId = table.Column<int>(type: "int", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThietBi_Emails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThietBi_Emails_ThietBis_ThietBiId",
                        column: x => x.DeviceId,
                        principalTable: "Devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ThietBi_Emails_ThietBiId",
                table: "DeviceEmails",
                column: "DeviceId");

            // Backfill: copy the existing single Email per Device into DeviceEmails before
            // dropping the old column, so the 5218/5225 devices that already have an email
            // (verified against the real DB) don't lose data.
            migrationBuilder.Sql(@"
                INSERT INTO DeviceEmails (DeviceId, Email, IsDeleted)
                SELECT Id, LTRIM(RTRIM(Email)), 0
                FROM Devices
                WHERE Email IS NOT NULL AND LTRIM(RTRIM(Email)) <> '';
            ");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Devices");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Devices",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            // Best-effort restore: take one (any) active email per device back into the
            // single-column shape. If a device ended up with several emails, the rest are lost.
            migrationBuilder.Sql(@"
                UPDATE d
                SET d.Email = e.Email
                FROM Devices d
                CROSS APPLY (
                    SELECT TOP 1 Email
                    FROM DeviceEmails de
                    WHERE de.DeviceId = d.Id AND de.IsDeleted = 0
                    ORDER BY de.Id
                ) e;
            ");

            migrationBuilder.DropTable(
                name: "DeviceEmails");
        }
    }
}
