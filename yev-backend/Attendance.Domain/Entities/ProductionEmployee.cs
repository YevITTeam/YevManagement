using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// "Trạng thái hiện tại" của 1 người dưới khối chuyền Chế tạo — CongDoan/BlockCode/TeamCode/ShiftTeamCode
// đổi hàng ngày (mỗi lần tăng ca có thể khác), nên bảng này được UPSERT theo EmployeeCode mỗi lần nạp
// file mới, KHÔNG BAO GIỜ ghi ngược các giá trị đã resolve về Employee.GroupId/DepartmentId — Employee
// vẫn là nguồn chân lý ổn định (theo nhịp cập nhật hàng tháng của Tổng vụ). Khi 1 người ở đây được thêm
// vào OtForm (chế độ chọn "dưới chuyền"), CongDoan/TaskName/BlockCode/TeamCode/ShiftTeamCode tại thời
// điểm đó được copy thành snapshot trên OtFormEmployee — bảng này chỉ phản ánh trạng thái MỚI NHẤT.
//
// Quy tắc nạp (2026-08-24): 1 dòng chỉ được đưa vào bảng này nếu EmployeeId (khớp Employee.Code),
// ProductionLineId (khớp BlockCode), TeamId (khớp TeamCode) và ShiftTeamId (khớp ShiftTeamCode) đều
// resolve được — dòng nào lệch (mã cũ/hết hạn so với ProductionLine/ProductionTeam/ProductionShiftTeam
// hiện hành, hoặc EmployeeCode chưa có trong Employee) thì bỏ qua, không nạp vào, thay vì lưu với FK
// NULL. Vì vậy các cột FK về mặt kỹ thuật vẫn nullable (đúng shape gốc, phòng khi chính sách đổi) nhưng
// theo policy nạp hiện tại sẽ luôn có giá trị.
public partial class ProductionEmployee
{
    public int Id { get; set; }

    public string EmployeeCode { get; set; } = null!;

    // Chỉ có ý nghĩa khi EmployeeId == null (người chưa có Employee tương ứng trong hệ thống).
    public string? LastNameSnapshot { get; set; }

    public string? FirstNameSnapshot { get; set; }

    // BOPHAN trong file — độc lập, chưa có FK (ý nghĩa/quan hệ với CongDoan trên ProductionLine
    // chưa được xác nhận, xem ProductionLine).
    public string? CongDoan { get; set; }

    public string? TaskName { get; set; }

    // BLOCK trong file — resolve sang ProductionLineId khi khớp LineCode (~42/56 mã); 14 mã còn lại
    // là trạm hành chính/hỗ trợ (HL, TQM, SHIDO, KZ-A/M, CNM...), không phải Line vật lý nên giữ NULL.
    public string? BlockCode { get; set; }

    public int? ProductionLineId { get; set; }

    // GROUP trong file — resolve sang TeamId qua bảng dịch A->1, B->2, HC->HC, còn lại tra khớp trực
    // tiếp Code (không phân biệt hoa/thường theo collation DB) — mã "S" hiện chưa khớp được, để NULL.
    public string? TeamCode { get; set; }

    public int? TeamId { get; set; }

    // NHOM trong file (G/O/HC) — khớp trực tiếp ProductionShiftTeam.Code.
    public string? ShiftTeamCode { get; set; }

    public int? ShiftTeamId { get; set; }

    public bool IsLeader { get; set; }

    // NULL = chưa khớp được Employee nào theo mã (người chưa có trong Employee) — không thể đưa vào
    // bất kỳ OtForm nào (OtFormEmployee.EmployeeId là FK not-null) cho tới khi được tạo Employee thật.
    public int? EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ProductionLine? ProductionLine { get; set; }

    public virtual ProductionTeam? Team { get; set; }

    public virtual ProductionShiftTeam? ShiftTeam { get; set; }

    public virtual Employee? Employee { get; set; }
}
