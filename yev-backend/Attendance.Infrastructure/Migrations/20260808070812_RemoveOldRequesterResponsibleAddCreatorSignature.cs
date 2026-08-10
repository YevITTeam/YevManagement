using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveOldRequesterResponsibleAddCreatorSignature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Employees_Requester",
                table: "Groups");

            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Employees_Responsible",
                table: "Groups");

            // KHÔNG DropIndex IX_Groups_RequesterEmployeeId/ResponsibleEmployeeId — DB thật không có 2
            // index này (schema Requester/Responsible được áp tay ngoài EF từ trước, migration
            // AddRequesterResponsible chỉ stamp vào __EFMigrationsHistory chứ không chạy lại DDL, xem
            // ghi chú ở AddRequesterResponsible/§Cây chức vụ Giai đoạn 2b trong attendance-module.md) —
            // DropIndex 1 index không tồn tại làm cả migration fail (đã xác nhận thật khi chạy lần đầu
            // 2026-08-08, EF tự rollback transaction, không mất dữ liệu).

            // 2 FK này cũng thuộc schema áp tay ngoài EF — model C# của OtForm chưa từng khai báo
            // navigation RequesterEmployee/ResponsibleEmployee nên `dotnet ef migrations add` không tự
            // sinh DropForeignKey cho chúng, nhưng DB thật vẫn có (xác nhận qua sys.foreign_keys) — phải
            // drop tay trước khi drop cột, nếu không ALTER TABLE DROP COLUMN sẽ báo lỗi 5074.
            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_Employees_Requester",
                table: "OtForms");

            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_Employees_Responsible",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterEmployeeId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterUserName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleEmployeeId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "ResponsibleUserName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "RequesterEmployeeId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "ResponsibleEmployeeId",
                table: "Groups");

            migrationBuilder.AddColumn<byte[]>(
                name: "CreatorSignatureImage",
                table: "OtForms",
                type: "varbinary(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatorSignatureImage",
                table: "OtForms");

            migrationBuilder.AddColumn<int>(
                name: "RequesterEmployeeId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequesterFullName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequesterUserName",
                table: "OtForms",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResponsibleEmployeeId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponsibleFullName",
                table: "OtForms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponsibleUserName",
                table: "OtForms",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequesterEmployeeId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResponsibleEmployeeId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Employees_Requester",
                table: "Groups",
                column: "RequesterEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Employees_Responsible",
                table: "Groups",
                column: "ResponsibleEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_Employees_Requester",
                table: "OtForms",
                column: "RequesterEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_Employees_Responsible",
                table: "OtForms",
                column: "ResponsibleEmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
