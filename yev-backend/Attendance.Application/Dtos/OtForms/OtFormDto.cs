namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormDto
    {
        public int Id { get; set; }

        // Null khi IsProductionForm = true (đơn "theo chuyền") — xem OtForm.GroupId.
        public int? GroupId { get; set; }
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }

        public bool IsProductionForm { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
        public int ReasonId { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
        public int OtCaseId { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string? OtCaseDescription { get; set; }
        public string? OtCaseDescriptionJp { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public DateOnly Date { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Snapshot of the creator's full name — FE always prefers displaying this field, falling back to CreatedByUserName if null.
        public string? CreatedByFullName { get; set; }

        // Thời điểm tạo đơn (UTC) — FE dùng làm "thời gian ký" cho trường hợp tự ký (creatorSignatureImage
        // không có OtFormApprovalHistory riêng để lấy actionAt). Xem OtForm.CreatedAt.
        public DateTime CreatedAt { get; set; }

        // Ảnh chữ ký của chính người tạo đơn — chỉ có giá trị khi người tạo đã ở cấp cao hơn/bằng mọi
        // Chức vụ trung gian "Bắt buộc ký" của Phòng ban (tự ký ô "Người đề nghị" thay vì chờ ai khác).
        // Serialize tự động thành base64 string (System.Text.Json mặc định cho byte[]) — xem OtForm.
        // CreatorSignatureImage, OtFormPrintView.tsx.
        public byte[]? CreatorSignatureImage { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // true when Status == InApproval and no step has been approved yet (2026-08-07, Giai đoạn 3.1)
        // — only then can PUT /api/OtForm/{id} be called.
        public bool IsEditable { get; set; }

        // Cảnh báo suy luận chuỗi lúc tạo đơn (null nếu chuỗi đầy đủ) — xem OtForm.ApprovalChainWarning.
        public string? ApprovalChainWarning { get; set; }

        public List<OtFormEmployeeDto> Employees { get; set; } = new();
        public ProcessPartDto? ProcessPart { get; set; }
        public List<OtFormApprovalHistoryDto> ApprovalHistories { get; set; } = new();

        // Lịch sử chỉnh sửa (sửa giờ/ghi chú, thêm/loại nhân viên) — mới nhất trước, xem OtFormEditLog.
        public List<OtFormEditLogDto> EditLogs { get; set; } = new();

        // Chuỗi bước duyệt đã snapshot lúc tạo đơn, sắp theo StepOrder — xem OtFormApprovalStepDto.
        public List<OtFormApprovalStepDto> ApprovalSteps { get; set; } = new();
    }
}
