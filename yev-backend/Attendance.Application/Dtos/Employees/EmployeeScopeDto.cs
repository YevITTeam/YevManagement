using Attendance.Application.Dtos.Departments;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Dtos.Workshops;

namespace Attendance.Application.Dtos.Employees
{
    // Phạm vi xem nhân viên của NGƯỜI GỌI hiện tại — cho FE tự thu hẹp dropdown lọc Phòng ban/Nhóm
    // ở màn "Nhân viên" (EmployeeList.tsx) khớp đúng những gì GetPagedAsync/GetAllActiveAsync thật sự
    // trả về, thay vì hiện toàn bộ Phòng ban/Nhóm công ty rồi lọc ra bảng rỗng không rõ lý do
    // (2026-09-03, xem EmployeeService.ResolveCallerScopeAsync — cùng 1 nguồn logic).
    //
    // Đổi từ 1 cặp DepartmentId?/GroupId? sang 2 DANH SÁCH (2026-09-28) — phạm vi thật từ
    // ResolveCallerScopeAsync có thể gồm NHIỀU Bộ phận/Nhóm cùng lúc (vị trí thật trong Cây chức vụ +
    // mọi nơi đang là Coordinator, xem §Chốt mô hình Coordinator trong attendance-module.md). Bản cũ
    // chỉ chứa được ĐÚNG 1 giá trị nên rơi vào tình huống có cả 1 Phòng ban (Coordinator) LẪN 1 Nhóm
    // (vị trí thật) thì không biết trả cái nào, đành trả rỗng cả 2 — khiến dropdown Nhóm ở FE hiện
    // "Không tìm thấy kết quả" dù bảng chính vẫn có dữ liệu đúng (lỗi thật ghi nhận 2026-09-28).
    public class EmployeeScopeDto
    {
        // true = Admin hoặc Trưởng Xưởng/Giám đốc — không giới hạn, FE giữ nguyên hành vi cũ (hiện hết).
        public bool CompanyWide { get; set; }

        // Mọi Phòng ban đang thuộc phạm vi (vị trí thật là Trưởng phòng, và/hoặc đang là Coordinator).
        public List<DepartmentDto> Departments { get; set; } = new();

        // Mọi Nhóm đang thuộc phạm vi — gồm CẢ Nhóm con của mọi Phòng ban ở trên (để dropdown Nhóm luôn
        // đủ lựa chọn khi lọc theo 1 Phòng ban cụ thể) LẪN Nhóm đang là Coordinator trực tiếp (có thể
        // thuộc Phòng ban KHÁC những Phòng ban ở trên, dù hiếm).
        public List<GroupDto> Groups { get; set; } = new();

        // Workshops of the groups/pairs above, for the workshop filter.
        public List<WorkshopDto> Workshops { get; set; } = new();
    }
}
