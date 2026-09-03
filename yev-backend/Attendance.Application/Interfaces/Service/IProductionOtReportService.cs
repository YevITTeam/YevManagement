using Attendance.Application.Dtos.Reports;

namespace Attendance.Application.Interfaces.Service
{
    // 2 báo cáo theo ngày cho đơn "dưới chuyền" đã Hoàn tất — xem docs/Note_OT.txt mục 1 dòng 10 và
    // mục 2, chốt thiết kế với người dùng 2026-08-28.
    public interface IProductionOtReportService
    {
        // departmentId null = mọi Phòng ban (không lọc) — 2026-08-29, theo yêu cầu người dùng "có thể
        // chọn chuyền ở phòng ban nào" (đơn IsProductionForm=true có thể tạo dưới BẤT KỲ Phòng ban nào,
        // không chỉ riêng "Chế tạo", xem OtFormService.CreateProductionFormAsync — request.DepartmentId
        // chọn tự do khi tạo đơn).

        // Báo cáo "Xuất số lượng phiếu đã sử dụng" (mục 2) — trả JSON, FE tự dựng PDF (jsPDF).
        Task<ProductionTicketReportDto> GetTicketReportAsync(DateOnly date, int? departmentId);

        // Báo cáo "Tổng số giờ tăng ca 1 người trong 1 ngày" (mục 1) — trả .xlsx dạng bytes, Controller
        // tự bọc File(...), không qua ApiResponse<T> (cùng pattern ProductionEmployeeExportService).
        Task<(byte[] Content, string FileName)> ExportHoursReportAsync(DateOnly date, int? departmentId);

        // Báo cáo "Số LƯỢT tăng ca 1 người trong 1 ngày" (Note_OT.txt mục 1 dòng 9) — KHÁC báo cáo
        // tổng giờ ở trên: KHÔNG gộp 1 dòng/người/ngày, mỗi dòng = 1 lượt (1 OtForm) riêng biệt, có
        // thêm 2 cột tổng hợp cả ngày lặp lại trên mọi dòng của người đó (số lượt, tổng giờ).
        Task<(byte[] Content, string FileName)> ExportTimesReportAsync(DateOnly date, int? departmentId);
    }
}
