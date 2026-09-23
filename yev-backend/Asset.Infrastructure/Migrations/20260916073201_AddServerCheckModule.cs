using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCheckModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ServerCheckCategory",
                table: "DeviceTypes",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServerCheckManualItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerCheckManualItems", x => x.Id);
                });

            // 4 mục kiểm tra thủ công (không gắn thiết bị, không quét QR được) khớp các cột còn lại của
            // Sheet1 trong file mẫu "YEV–22–CV–IT-QD-810-FR-Check Sheet KT" — xác nhận ở cuối mỗi phiên
            // quét (asset-module.md §2).
            migrationBuilder.Sql(@"
INSERT INTO ServerCheckManualItems (Name, DisplayOrder, IsDeleted) VALUES
(N'Tình trạng âm thanh, mùi, nhiệt độ', 1, 0),
(N'Network - Factory', 2, 0),
(N'Network - Server', 3, 0),
(N'Gởi nhận Mail', 4, 0);
");

            migrationBuilder.CreateTable(
                name: "ServerCheckSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CheckDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerCheckSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServerCheckItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SessionId = table.Column<int>(type: "int", nullable: false),
                    DeviceId = table.Column<int>(type: "int", nullable: false),
                    Category = table.Column<int>(type: "int", nullable: false),
                    ScannedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ScannedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerCheckItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServerCheckItems_ServerCheckSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "ServerCheckSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServerCheckItems_ThietBis_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "Devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServerCheckManualResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SessionId = table.Column<int>(type: "int", nullable: false),
                    ManualItemId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ConfirmedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerCheckManualResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServerCheckManualResults_ServerCheckManualItems_ManualItemId",
                        column: x => x.ManualItemId,
                        principalTable: "ServerCheckManualItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServerCheckManualResults_ServerCheckSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "ServerCheckSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckItems_DeviceId",
                table: "ServerCheckItems",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckItems_SessionId",
                table: "ServerCheckItems",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckManualResults_ManualItemId",
                table: "ServerCheckManualResults",
                column: "ManualItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckManualResults_SessionId",
                table: "ServerCheckManualResults",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckManualResults_SessionId_ManualItemId",
                table: "ServerCheckManualResults",
                columns: new[] { "SessionId", "ManualItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckSessions_CheckDate",
                table: "ServerCheckSessions",
                column: "CheckDate",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServerCheckItems");

            migrationBuilder.DropTable(
                name: "ServerCheckManualResults");

            migrationBuilder.DropTable(
                name: "ServerCheckManualItems");

            migrationBuilder.DropTable(
                name: "ServerCheckSessions");

            migrationBuilder.DropColumn(
                name: "ServerCheckCategory",
                table: "DeviceTypes");
        }
    }
}
