using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Domain.Entities;
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

        // Hours after midnight belong to the next day. The meal break comes off the longer part (the start day on a tie) so a
        // short part can't go negative; a row starting before the form's start lies wholly on the next day.
        public static List<(DateOnly Date, decimal Hours)> SplitHoursByDay(
            DateOnly formDate, TimeOnly formStart, TimeOnly startTime, TimeOnly endTime, bool didEat, AttendanceSettingDto settings)
        {
            var actual = CalculateOtHours(startTime, endTime, didEat, settings);
            var firstDate = startTime < formStart ? formDate.AddDays(1) : formDate;
            if (endTime >= startTime) return new() { (firstDate, actual) };

            var raw = Math.Round((decimal)(endTime - startTime).TotalHours, 2);
            var after = Math.Round((decimal)endTime.ToTimeSpan().TotalHours, 2);
            var before = raw - after;
            if (before >= after) before -= raw - actual; else after -= raw - actual;
            return new() { (firstDate, before), (firstDate.AddDays(1), after) };
        }

        // Real interval of a row, so forms on neighbouring dates can be compared.
        public static (DateTime From, DateTime To) GetWindow(DateOnly formDate, TimeOnly formStart, TimeOnly startTime, TimeOnly endTime)
        {
            var from = (startTime < formStart ? formDate.AddDays(1) : formDate).ToDateTime(startTime);
            return (from, from + (endTime - startTime));
        }

        // Max by clock time would rank 02:00 of an overnight row before 23:00.
        public static TimeOnly LatestEnd(IEnumerable<(TimeOnly Start, TimeOnly End)> rows) =>
            rows.MaxBy(x => x.End.ToTimeSpan() + (x.End < x.Start ? TimeSpan.FromDays(1) : TimeSpan.Zero)).End;

        // Form rows (OtForm loaded) against a target date. Day counts every row given; Month/Year only forms not yet in the ledger.
        public static (decimal Day, decimal PendingMonth, decimal PendingYear) SumFormRows(
            DateOnly target, IEnumerable<OtFormEmployee> rows, AttendanceSettingDto settings)
        {
            var parts = rows.SelectMany(x => SplitHoursByDay(x.OtForm.Date, x.OtForm.StartTime, x.StartTime, x.EndTime, x.DidEat, settings)
                .Select(p => (p.Date, p.Hours, Pending: x.OtForm.Status != (int)OtFormStatus.Completed))).ToList();
            var pendingInYear = parts.Where(p => p.Pending && p.Date.Year == target.Year).ToList();
            return (parts.Where(p => p.Date == target).Sum(p => p.Hours),
                pendingInYear.Where(p => p.Date.Month == target.Month).Sum(p => p.Hours),
                pendingInYear.Sum(p => p.Hours));
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
