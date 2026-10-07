using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Domain.Enums;

namespace Attendance.Application.Services
{
    // Nguồn chân lý DUY NHẤT cho "giờ OT thực tính" và loại phiếu ăn 1 người nhận cho 1 lần OT — tách
    // ra khỏi OtFormService (2026-08-28) để ProductionOtReportService (báo cáo phiếu/giờ theo ngày)
    // dùng lại đúng công thức, tránh 2 nơi tính lệch nhau. OtFormService giữ nguyên hành vi qua
    // "using static" ở đầu file, không đổi bất kỳ call site nào.
    public static class MealTicketCalculator
    {
        // Redesign 3 bậc phiếu ăn (2026-08-26, chốt với người dùng qua nhiều vòng — xem
        // AttendanceSetting.cs và docs/attendance-module.md §Phiếu ăn). Ca OT khớp ĐÚNG khung sớm
        // (StartTime/EndTime bằng đúng EarlyMealWindowStartTime/EndTime, không phải chỉ overlap) là
        // ngoại lệ: không trừ giờ dù DidEat thế nào, và luôn nhận phiếu Phụ bất kể độ dài ca.
        public static bool IsEarlyMealWindowOt(TimeOnly startTime, TimeOnly endTime, AttendanceSettingDto settings) =>
            startTime == settings.EarlyMealWindowStartTime && endTime == settings.EarlyMealWindowEndTime;

        // Giờ OT thực tính — DUY NHẤT nên hiển thị/cộng làm "giờ OT của người này" (hiển thị lẫn lũy
        // kế). Ngoài khung sớm: có ăn thì trừ MealBreakDeductionHours, không ăn giữ nguyên giờ thô.
        public static decimal CalculateOtHours(TimeOnly startTime, TimeOnly endTime, bool didEat, AttendanceSettingDto settings)
        {
            var hours = Math.Round((decimal)(endTime - startTime).TotalHours, 2);

            if (IsEarlyMealWindowOt(startTime, endTime, settings)) return hours;

            if (didEat) hours -= settings.MealBreakDeductionHours;

            return hours;
        }

        // Loại phiếu ăn 1 người nhận cho 1 lần OT. Tính trên giờ đã trừ nghỉ ăn VÔ ĐIỀU KIỆN (theo
        // attendance-module.md §Phiếu ăn, không phụ thuộc DidEat) để cùng 1 ca luôn ra cùng loại phiếu dù nút "Ăn uống" bật/tắt;
        // riêng lũy kế/giờ hiển thị vẫn chỉ trừ người có ăn (CalculateOtHours).
        public static MealTicketType CalculateMealTicketType(TimeOnly startTime, TimeOnly endTime, bool didEat, AttendanceSettingDto settings)
        {
            if (IsEarlyMealWindowOt(startTime, endTime, settings)) return MealTicketType.Secondary;

            var actualHours = CalculateOtHours(startTime, endTime, true, settings);
            if (actualHours < settings.NoMealTicketMaxHours) return MealTicketType.None;
            if (actualHours < settings.MainMealTicketMinHours) return MealTicketType.Secondary;
            return MealTicketType.Main;
        }
    }
}
