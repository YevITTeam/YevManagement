using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    // Đổi DepartmentApprovalStepCoordinator/GroupApprovalStepCoordinator từ khoá theo UserName (chuỗi
    // tự do, chọn được BẤT KỲ tài khoản Identity nào) sang khoá theo EmployeeId (FK, chỉ chọn được
    // Employee đang thuộc đúng Bộ phận/Nhóm — validate ở *CoordinatorService.ReplaceAsync). Trước khi
    // xoá cột UserName, MAP lại dữ liệu đang có sang EmployeeId qua Employees.UserName trùng khớp —
    // KHÔNG xoá trắng, tránh mất cấu hình test đã có sẵn (2026-08-11: 1 dòng ở
    // GroupApprovalStepCoordinators, GroupId=6, UserName='YEV\m.cuong.da.pcd.it', khớp đúng Employee
    // Id=3370 cùng GroupId=6 — map thành công). Dòng nào KHÔNG map được (UserName không khớp Employee
    // nào) bị xoá hẳn — chấp nhận được vì bảng này chỉ mới tạo, chưa ai dựa vào ngoài dữ liệu test.
    public partial class ChangeApprovalStepCoordinatorsToEmployeeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "GroupApprovalStepCoordinators",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "DepartmentApprovalStepCoordinators",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE g
                SET g.EmployeeId = e.Id
                FROM GroupApprovalStepCoordinators g
                INNER JOIN Employees e ON e.UserName = g.UserName");

            migrationBuilder.Sql(@"
                UPDATE d
                SET d.EmployeeId = e.Id
                FROM DepartmentApprovalStepCoordinators d
                INNER JOIN Employees e ON e.UserName = d.UserName");

            migrationBuilder.Sql("DELETE FROM GroupApprovalStepCoordinators WHERE EmployeeId IS NULL");
            migrationBuilder.Sql("DELETE FROM DepartmentApprovalStepCoordinators WHERE EmployeeId IS NULL");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "GroupApprovalStepCoordinators");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "DepartmentApprovalStepCoordinators");

            migrationBuilder.AlterColumn<int>(
                name: "EmployeeId",
                table: "GroupApprovalStepCoordinators",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "EmployeeId",
                table: "DepartmentApprovalStepCoordinators",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupApprovalStepCoordinators_EmployeeId",
                table: "GroupApprovalStepCoordinators",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentApprovalStepCoordinators_EmployeeId",
                table: "DepartmentApprovalStepCoordinators",
                column: "EmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentApprovalStepCoordinators_Employees_EmployeeId",
                table: "DepartmentApprovalStepCoordinators",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GroupApprovalStepCoordinators_Employees_EmployeeId",
                table: "GroupApprovalStepCoordinators",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentApprovalStepCoordinators_Employees_EmployeeId",
                table: "DepartmentApprovalStepCoordinators");

            migrationBuilder.DropForeignKey(
                name: "FK_GroupApprovalStepCoordinators_Employees_EmployeeId",
                table: "GroupApprovalStepCoordinators");

            migrationBuilder.DropIndex(
                name: "IX_GroupApprovalStepCoordinators_EmployeeId",
                table: "GroupApprovalStepCoordinators");

            migrationBuilder.DropIndex(
                name: "IX_DepartmentApprovalStepCoordinators_EmployeeId",
                table: "DepartmentApprovalStepCoordinators");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "GroupApprovalStepCoordinators");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "DepartmentApprovalStepCoordinators");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "GroupApprovalStepCoordinators",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "DepartmentApprovalStepCoordinators",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }
    }
}
