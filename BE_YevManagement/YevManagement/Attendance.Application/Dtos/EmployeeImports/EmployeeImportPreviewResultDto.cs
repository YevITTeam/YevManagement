namespace Attendance.Application.Dtos.EmployeeImports
{
    public class EmployeeImportPreviewResultDto
    {
        public List<EmployeeImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }

        // Số Department/Group mới sẽ được tạo nếu Confirm ngay bây giờ (thông tin tham khảo cho FE).
        public int NewDepartmentCount { get; set; }
        public int NewGroupCount { get; set; }
    }
}
