using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    public partial class AddLoginUserIPTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CHỈ GIỮ LẠI ĐOẠN TẠO BẢNG LoginUserIPs
            migrationBuilder.CreateTable(
                name: "LoginUserIPs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    IPAddress = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FirstLoginAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginUserIPs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoginUserIPs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users", // Bảng Users đã có sẵn trong DB
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginUserIPs_UserId",
                table: "LoginUserIPs",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginUserIPs");
        }
    }
}