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
            // Backfill Status theo enum IpAddressStatus mới 3 trạng thái (2026-07-11):
            //   0=Available, 1=AssignedExternal (đã gán, không có DeviceId), 2=Assigned (có DeviceId).
            // Đảm bảo bất biến Status=2 ⟺ DeviceId != null:
            //   - Có DeviceId  -> 2 (Assigned).
            //   - Không DeviceId nhưng Status cũ khác 0 (cũ 1=Assigned-mismatch / 2=Reserved /
            //     3=Disabled) -> 1 (AssignedExternal — coi như đang dùng bởi thiết bị ngoài,
            //     giữ khỏi pool trống).
            //   - Còn lại (Status cũ 0, không DeviceId) -> 0 (Available).
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

            // Lưu ý: không thể khôi phục chính xác giá trị Status cũ (2=Reserved/3=Disabled đã
            // gộp về 1). Down chỉ trả lại cột ServerIP (rỗng), Status giữ nguyên giá trị mới.
        }
    }
}
