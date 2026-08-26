namespace Attendance.Domain.Entities;

// System configuration for the Attendance module — always exactly 1 row (Id=1), edited via API
// instead of appsettings.json so the Admin can change it immediately without redeploying.
// Mirrors Asset.Domain.Entities.AssetSetting (see docs/attendance-module.md — Cấu hình phiếu ăn &
// giới hạn lũy kế). No IsDeleted: a singleton config row is never soft-deleted.
public partial class AttendanceSetting
{
    public int Id { get; set; }

    // Redesign 2026-08-26 (chốt với người dùng qua nhiều vòng trao đổi, xem docs/attendance-module.md
    // §Phiếu ăn): 3 bậc phiếu tính trên GIỜ THỰC TÍCH (actualHours = raw − MealBreakDeductionHours nếu
    // DidEat=true), KHÔNG còn trên giờ thô như trước, VÀ không còn "luôn có ít nhất phiếu phụ" (quyết
    // định 2026-08-01 đã bị đảo ngược):
    //   actualHours < NoMealTicketMaxHours        -> KHÔNG có phiếu ăn nào
    //   NoMealTicketMaxHours <= actualHours < đây  -> phiếu PHỤ
    //   actualHours >= MainMealTicketMinHours      -> phiếu CHÍNH
    // Ngoại lệ: ca OT khớp ĐÚNG khung [EarlyMealWindowStartTime, EarlyMealWindowEndTime) (mặc định
    // 6h-8h) luôn được phiếu PHỤ, KHÔNG trừ MealBreakDeductionHours dù DidEat=true hay false — xem
    // OtFormService.IsEarlyMealWindowOt. Default 3.5.
    public decimal MainMealTicketMinHours { get; set; }

    // Sàn dưới — giờ thực tích dưới mốc này thì KHÔNG có phiếu ăn nào (không áp dụng cho ca khớp đúng
    // khung sớm, xem trên). Default 2.
    public decimal NoMealTicketMaxHours { get; set; }

    // Số giờ trừ khi 1 nhân viên tick "Có ăn" (trước đây hardcode 0.5, chuyển thành cấu hình được
    // 2026-08-26). Không áp dụng cho ca khớp đúng khung sớm. Default 0.5.
    public decimal MealBreakDeductionHours { get; set; }

    // Khung giờ OT sớm đặc cách (mặc định 6h-8h sáng) — ca OT có StartTime/EndTime khớp ĐÚNG 2 mốc này
    // (không phải chỉ overlap) thì luôn phiếu Phụ + không trừ MealBreakDeductionHours, bất kể DidEat.
    public TimeOnly EarlyMealWindowStartTime { get; set; }

    public TimeOnly EarlyMealWindowEndTime { get; set; }

    // Giới hạn giờ OT theo NGÀY/THÁNG/NĂM của 1 nhân viên (2026-08-26, redesign — trước đây Monthly/
    // Yearly chỉ hiển thị cảnh báo đỏ, KHÔNG chặn; nay CẢ 3 mốc đều CHẶN tạo/sửa đơn — xem
    // OtFormService.ValidateOtHourLimitsAsync). Vượt bất kỳ mốc nào thì BE từ chối tạo/sửa đơn, bắt
    // buộc loại nhân viên đó khỏi đơn hoặc giảm giờ trước khi tạo lại. Default 4.
    public decimal DailyOtHourLimit { get; set; }

    // Default 25.
    public decimal MonthlyOtHourLimit { get; set; }

    // Default 300 (khớp "Năm: 300h giới hạn" — docs/Note_OT.txt).
    public decimal YearlyOtHourLimit { get; set; }

    // Giờ trong ngày OtFormBatchBackgroundService chạy gom "Đơn tổng" (giờ Việt Nam, khớp
    // TimeHelper.GetCurrentUtcTime()). Default 15:00 — trước đây hardcode trong background service,
    // chuyển vào đây để Admin tự đổi không cần build lại (2026-08-08).
    public TimeOnly BatchAutoSendTime { get; set; }
}
