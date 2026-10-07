using Attendance.Application.Dtos.Reports;

namespace Attendance.Application.Interfaces.Service
{
    // 2 báo cáo theo ngày cho đơn "dưới chuyền" đã Hoàn tất — xem docs/docs-be/attendance-module.md §Báo cáo & export dưới chuyền theo ngày.
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

        // Báo cáo "Số LƯỢT tăng ca 1 người trong 1 ngày" (docs/docs-be/attendance-module.md §Báo cáo & export dưới chuyền theo ngày) — KHÁC báo cáo
        // tổng giờ ở trên: KHÔNG gộp 1 dòng/người/ngày, mỗi dòng = 1 lượt (1 OtForm) riêng biệt, có
        // thêm 2 cột tổng hợp cả ngày lặp lại trên mọi dòng của người đó (số lượt, tổng giờ).
        Task<(byte[] Content, string FileName)> ExportTimesReportAsync(DateOnly date, int? departmentId);

        // 3 báo cáo mới (2026-09-03c, theo file thật người dùng gửi từ docs/Data/Reports/) — độc lập
        // hoàn toàn với 2 báo cáo trên (không thay thế, không đổi cột 2 báo cáo cũ), tên file theo ĐÚNG
        // quy tắc thật: "{TenQuery}_{yyyy-MM-d}_{MaPhongBan}.xlsx" (ngày KHÔNG có số 0 đầu ở phần ngày,
        // MaPhongBan = Department.DepartmentCode của departmentId dùng lọc báo cáo).

        // "Qry_EXPORT_EXCEL" — 17 cột, gộp 1 dòng/người/ngày (cùng quy tắc gộp với ExportHoursReportAsync
        // nhưng bộ cột KHÁC — xem ProductionOtReportService để biết đúng 17 cột).
        Task<(byte[] Content, string FileName)> ExportQryExportExcelAsync(DateOnly date, int? departmentId);

        // "SUM_EXPORT_DATA" — 7 cột, bản tóm tắt đơn giản (gộp 1 dòng/người/ngày, chỉ MNV/BOPHAN/HO/
        // TEN/Ngay_TC/Gio_thuc_te/BP) — mục đích RIÊNG với Qry_EXPORT_EXCEL (người dùng xác nhận
        // 2026-09-03c), không phải bản rút gọn thay thế.
        Task<(byte[] Content, string FileName)> ExportSumExportDataAsync(DateOnly date, int? departmentId);

        // Dữ liệu nền cho phiếu YEV-22-024 xuất hàng loạt (2026-09-03c) — 1 phần tử/tổ hợp Block-Nhóm
        // có OT trong ngày. FE tự dựng PDF (html2canvas/jsPDF, tái dùng layout OtFormPrintView.tsx) +
        // đóng gói zip (jszip) — BE không sinh PDF, đúng quy ước hiện có.
        Task<List<ProductionTicketBatchGroupDto>> GetTicketBatchAsync(DateOnly date, int? departmentId);
    }
}
