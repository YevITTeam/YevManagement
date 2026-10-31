using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Domain.Enums;

namespace Attendance.Application.Services
{
    // Single source of truth for actual OT hours and meal tickets, shared with ProductionOtReportService so they can't diverge.
    public static class MealTicketCalculator
    {
        // Exact match of the early meal window (not mere overlap) never deducts and always gets the secondary ticket.
        public static bool IsEarlyMealWindowOt(TimeOnly startTime, TimeOnly endTime, AttendanceSettingDto settings) =>
            startTime == settings.EarlyMealWindowStartTime && endTime == settings.EarlyMealWindowEndTime;

        // The only value to display or accumulate as a person's OT hours; deducts the meal break only when DidEat.
        public static decimal CalculateOtHours(TimeOnly startTime, TimeOnly endTime, bool didEat, AttendanceSettingDto settings)
        {
            var hours = Math.Round((decimal)(endTime - startTime).TotalHours, 2);

            if (IsEarlyMealWindowOt(startTime, endTime, settings)) return hours;

            if (didEat) hours -= settings.MealBreakDeductionHours;

            return hours;
        }

        // Graded on the same actual hours as the ledger: office "eat after" (DidEat=false) keeps the meal break as OT time.
        public static MealTicketType CalculateMealTicketType(TimeOnly startTime, TimeOnly endTime, bool didEat, AttendanceSettingDto settings)
        {
            if (IsEarlyMealWindowOt(startTime, endTime, settings)) return MealTicketType.Secondary;

            var actualHours = CalculateOtHours(startTime, endTime, didEat, settings);
            if (actualHours < settings.NoMealTicketMaxHours) return MealTicketType.None;
            if (actualHours < settings.MainMealTicketMinHours) return MealTicketType.Secondary;
            return MealTicketType.Main;
        }
    }
}
