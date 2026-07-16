namespace Attendance.Application.Dtos.EmployeeImports
{
    public class EmployeeImportConfirmResultDto
    {
        public int CreatedDepartmentCount { get; set; }
        public int CreatedGroupCount { get; set; }
        public int CreatedEmployeeCount { get; set; }

        // Nhân viên đã tồn tại (khớp Code) được cập nhật lại FirstName/LastName/GroupId thay vì
        // báo lỗi trùng mã — Code là unique nên dùng làm khóa xác định tạo mới hay cập nhật.
        public int UpdatedEmployeeCount { get; set; }

        // Dòng còn lỗi validate ở thời điểm Confirm bị bỏ qua, KHÔNG chặn cả batch — dòng hợp lệ
        // vẫn được tạo bình thường, dòng lỗi liệt kê ở đây kèm lý do để FE báo lại.
        public int SkippedCount { get; set; }
        public List<EmployeeImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
