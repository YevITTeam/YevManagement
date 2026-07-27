using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateIpAddressStatusRemoveServerIp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill Status according to the new 3-state IpAddressStatus enum (2026-07-11):
            //   0=Available, 1=AssignedExternal (assigned, no DeviceId), 2=Assigned (has DeviceId).
            // Ensures the invariant Status=2 <=> DeviceId != null:
            //   - Has DeviceId  -> 2 (Assigned).
            //   - No DeviceId but old Status is not 0 (old 1=Assigned-mismatch / 2=Reserved /
            //     3=Disabled) -> 1 (AssignedExternal — treated as in use by an external device,
            //     kept out of the free pool).
            //   - Remaining (old Status 0, no DeviceId) -> 0 (Available).
            migrationBuilder.Sql(@"
UPDATE IpAddresses
SET Status = CASE
    WHEN DeviceId IS NOT NULL THEN 2
    WHEN Status <> 0 THEN 1
    ELSE 0
END;");

            migrationBuilder.DropColumn(
                name: "ServerIP",
                table: "IpAddresses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ServerIP",
                table: "IpAddresses",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            // Note: the exact old Status values cannot be restored (2=Reserved/3=Disabled were
            // merged into 1). Down only brings back the ServerIP column (empty), Status keeps its new value.
        }
    }
}
