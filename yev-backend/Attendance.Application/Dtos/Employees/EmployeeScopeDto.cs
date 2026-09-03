namespace Attendance.Application.Dtos.Employees
{
    // Phạm vi xem nhân viên của NGƯỜI GỌI hiện tại — cho FE tự thu hẹp dropdown lọc Phòng ban/Nhóm
    // ở màn "Nhân viên" (EmployeeList.tsx) khớp đúng những gì GetPagedAsync/GetAllActiveAsync thật sự
    // trả về, thay vì hiện toàn bộ Phòng ban/Nhóm công ty rồi lọc ra bảng rỗng không rõ lý do
    // (2026-09-03, xem EmployeeService.ResolveCallerScopeAsync — cùng 1 nguồn logic).
    public class EmployeeScopeDto
    {
        // true = Admin hoặc Trưởng Xưởng/Giám đốc — không giới hạn, FE giữ nguyên hành vi cũ (hiện hết).
        public bool CompanyWide { get; set; }

        public int? DepartmentId { get; set; }
        public string? DepartmentNameVn { get; set; }

        public int? GroupId { get; set; }
        public string? GroupNameVn { get; set; }
    }
}
