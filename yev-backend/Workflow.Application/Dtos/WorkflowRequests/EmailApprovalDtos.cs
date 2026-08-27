using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // Duyệt/từ chối qua email (Pha 4C) — KHÔNG có OnBehalfOfEmployeeId (không có khái niệm ủy quyền qua
    // kênh email ở phase này) và KHÔNG có SignatureImageBase64 (chữ ký tự lấy từ EmployeeSignatures nếu
    // bước yêu cầu, mirror Attendance.ApproveByEmailTokenAsync — trang public không có UI chọn ảnh).
    public class EmailApproveRequestDto
    {
        public string? Comment { get; set; }
    }

    public class EmailRejectRequestDto
    {
        [Required(ErrorMessage = "Lý do từ chối là bắt buộc.")]
        public string Comment { get; set; } = null!;
    }
}
