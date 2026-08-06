using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtFormBatches
{
    // Quyết định của Trưởng phòng cho 1 đơn nhỏ cụ thể trong "Đơn tổng" — xem docs/attendance-module.md — §Đơn tổng.
    public class ProcessOtFormBatchFormDto
    {
        [Required(ErrorMessage = "Mã đơn không được để trống")]
        public int OtFormId { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchFormDecision (0=Approve, 1=Reject).
        public int Decision { get; set; }

        // Bắt buộc khi Decision=Reject (validate ở Service, không phải DataAnnotations, vì phụ thuộc
        // giá trị Decision — cùng nguyên tắc RejectOtFormDto.Comment).
        public string? RejectReason { get; set; }

        // Chỉ áp dụng khi Decision=Approve — những nhân viên bị Trưởng phòng bỏ chọn (không muốn cho
        // OT), xử lý qua đúng cơ chế "Loại nhân viên khỏi đơn" (RemoveEmployeeCoreAsync) đã có.
        public List<int>? ExcludedEmployeeIds { get; set; }
    }
}
