using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIpPrefix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Create the IpPrefixes table BEFORE touching the old columns on IpAddresses,
            // so the existing data from SubnetMask/Gateway/PreferredDNS/AlternateDNS
            // (not yet deleted) can be backfilled into the new table before DROP COLUMN.
            migrationBuilder.CreateTable(
                name: "IpPrefixes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Prefix = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    SubnetMask = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Gateway = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    PreferredDNS = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    AlternateDNS = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TienToIPs", x => x.Id);
                });

            // 2) Add the IpPrefixId column as NULLABLE first, so the existing 6885 rows aren't broken.
            migrationBuilder.AddColumn<int>(
                name: "IpPrefixId",
                table: "IpAddresses",
                type: "int",
                nullable: true);

            // 3) Backfill: 1 IpPrefixes row for each prefix (first 3 octets) existing
            // in IpAddresses, then assign the corresponding IpPrefixId to each IpAddresses row.
            // Verified read-only before writing this migration: 27 groups, each group has
            // exactly 1 value for SubnetMask/Gateway/PreferredDNS/AlternateDNS, no NULLs,
            // no conflicts -> this backfill is safe, no data loss.
            migrationBuilder.Sql(@"
INSERT INTO IpPrefixes (Prefix, SubnetMask, Gateway, PreferredDNS, AlternateDNS, Description, IsDeleted)
SELECT DISTINCT
    LEFT(IpAddress, LEN(IpAddress) - CHARINDEX('.', REVERSE(IpAddress))) AS Prefix,
    SubnetMask, Gateway, PreferredDNS, AlternateDNS, NULL, 0
FROM IpAddresses;

UPDATE ia
SET ia.IpPrefixId = ip.Id
FROM IpAddresses ia
INNER JOIN IpPrefixes ip
    ON ip.Prefix = LEFT(ia.IpAddress, LEN(ia.IpAddress) - CHARINDEX('.', REVERSE(ia.IpAddress)));
");

            // 4) Now every row has IpPrefixId -> tighten to NOT NULL.
            migrationBuilder.AlterColumn<int>(
                name: "IpPrefixId",
                table: "IpAddresses",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiaChiIPs_TienToId",
                table: "IpAddresses",
                column: "IpPrefixId");

            migrationBuilder.CreateIndex(
                name: "IX_TienToIPs_TienTo",
                table: "IpPrefixes",
                column: "Prefix",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_DiaChiIPs_TienToIPs_TienToId",
                table: "IpAddresses",
                column: "IpPrefixId",
                principalTable: "IpPrefixes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // 5) Data is now safely in IpPrefixes -> drop the 4 old duplicate columns.
            migrationBuilder.DropColumn(
                name: "AlternateDNS",
                table: "IpAddresses");

            migrationBuilder.DropColumn(
                name: "Gateway",
                table: "IpAddresses");

            migrationBuilder.DropColumn(
                name: "PreferredDNS",
                table: "IpAddresses");

            migrationBuilder.DropColumn(
                name: "SubnetMask",
                table: "IpAddresses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AlternateDNS",
                table: "IpAddresses",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gateway",
                table: "IpAddresses",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredDNS",
                table: "IpAddresses",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubnetMask",
                table: "IpAddresses",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            // Reverse backfill from IpPrefixes before dropping the related table/column.
            migrationBuilder.Sql(@"
UPDATE ia
SET ia.SubnetMask = ip.SubnetMask,
    ia.Gateway = ip.Gateway,
    ia.PreferredDNS = ip.PreferredDNS,
    ia.AlternateDNS = ip.AlternateDNS
FROM IpAddresses ia
INNER JOIN IpPrefixes ip ON ia.IpPrefixId = ip.Id;
");

            migrationBuilder.DropForeignKey(
                name: "FK_DiaChiIPs_TienToIPs_TienToId",
                table: "IpAddresses");

            migrationBuilder.DropIndex(
                name: "IX_DiaChiIPs_TienToId",
                table: "IpAddresses");

            migrationBuilder.DropColumn(
                name: "IpPrefixId",
                table: "IpAddresses");

            migrationBuilder.DropTable(
                name: "IpPrefixes");
        }
    }
}
