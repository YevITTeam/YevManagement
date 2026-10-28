using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Edit an existing form — mỗi nhân viên trong Employees có thể là NGƯỜI CŨ (sửa "thực tích" — giờ
    // kết thúc/DidEat/Note, chốt 2026-07-31) hoặc NGƯỜI MỚI (thêm vào đơn) — OtFormService.UpdateAsync
    // tự suy diff so với danh sách active hiện có. Loại người ra khỏi đơn đi qua RemovedEmployees (bắt
    // buộc khai lý do), không còn qua 2 action riêng AddOtFormEmployeeDto/RemoveOtFormEmployeeDto như
    // trước 2026-09-04 (đã gộp hết vào PUT này — xem docs/attendance-module.md §Cây chức vụ & Cây duyệt
    // (mục Sửa đơn). Department/Group luôn cố định; Header (chỉ đơn văn phòng) sửa phần còn lại như lúc tạo.
    public class UpdateOtFormDto
    {
        // Office forms only: general info as on creation, minus Department/Group. OtCase is re-derived server-side.
        public UpdateOtFormHeaderDto? Header { get; set; }

        [Required(ErrorMessage = "Danh sách nhân viên không được để trống")]
        [MinLength(1, ErrorMessage = "Phải có ít nhất 1 nhân viên")]
        public List<UpdateOtFormEmployeeTimeDto> Employees { get; set; } = new();

        // Nhân viên bị loại khỏi đơn trong lượt sửa này (2026-09-04, theo yêu cầu người dùng — gộp
        // thêm/xóa nhân viên vào Sửa đơn thay vì thao tác riêng ở OtFormDetail). Nhân viên KHÔNG có mặt
        // trong Employees NHƯNG cũng KHÔNG có mặt ở đây bị coi là dữ liệu không hợp lệ (OtFormService
        // bắt lỗi) — mọi nhân viên bị bớt đi đều phải khai lý do. Nhân viên MỚI (chưa từng có trong đơn)
        // chỉ cần xuất hiện trong Employees, không cần khai báo gì thêm ở đây.
        public List<UpdateOtFormRemovedEmployeeDto> RemovedEmployees { get; set; } = new();

        // Second-factor password — bắt buộc từ 2026-08-28 (theo yêu cầu người dùng, lưu thay đổi
        // chỉnh sửa cũng phải nhập mật khẩu cấp 2), cùng cơ chế với ApproveOtFormDto.SecondaryPassword.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }

    public class UpdateOtFormHeaderDto
    {
        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        [Required(ErrorMessage = "Lý do không được để trống")]
        public int ReasonId { get; set; }

        public string? SubReason { get; set; }

        public ProcessPartDto? ProcessPart { get; set; }
    }
}
