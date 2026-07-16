namespace Attendance.Application.Dtos.EmployeeImports
{
    // 1 dòng nhân sự parse từ Excel: Employee code, Full name, Department (mã+tên), Group (mã+tên).
    // Dùng chung cho response Preview (server điền Resolved*/IsNew*/IsValid/Errors) và request
    // Confirm (client gửi lại y hệt field gốc, server tự re-resolve từ đầu, không tin field
    // Resolved*/IsNew* do client gửi lên — cùng nguyên tắc với DeviceImportRowDto ở module Asset).
    public class EmployeeImportRowDto
    {
        public int RowNumber { get; set; }

        public string? EmployeeCode { get; set; }
        public string? FullName { get; set; }
        public string? DepartmentCode { get; set; }
        public string? DepartmentNameVn { get; set; }
        public string? GroupCode { get; set; }
        public string? GroupNameVn { get; set; }

        // Tách từ FullName — từ cuối cùng = FirstName (tên riêng), phần còn lại = LastName (họ +
        // tên đệm), khớp đúng convention hiển thị "{LastName} {FirstName}" đang dùng ở OtFormService.
        public string? ResolvedFirstName { get; set; }
        public string? ResolvedLastName { get; set; }

        // Cờ thông tin — phòng ban/nhóm/nhân viên này chưa tồn tại trong hệ thống, sẽ được tạo mới
        // lúc Confirm. Mã nhân viên là duy nhất (unique) — nếu đã tồn tại thì Confirm sẽ CẬP NHẬT
        // (FirstName/LastName/GroupId) thay vì báo lỗi trùng (2026-07-16, đổi từ chỉ-tạo-mới sang upsert).
        public bool IsNewDepartment { get; set; }
        public bool IsNewGroup { get; set; }
        public bool IsNewEmployee { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
