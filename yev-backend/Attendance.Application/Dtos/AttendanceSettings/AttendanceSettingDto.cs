namespace Attendance.Application.Dtos.AttendanceSettings
{
    public class AttendanceSettingDto
    {
        // Min actual OT hours for a main meal ticket; between NoMealTicketMaxHours and this = secondary ticket.
        public decimal MainMealTicketMinHours { get; set; }

        // Below this, no meal ticket.
        public decimal NoMealTicketMaxHours { get; set; }

        // Deducted when the employee eats (not applied in the early window).
        public decimal MealBreakDeductionHours { get; set; }

        // Early OT window (default 6-8h): always a secondary ticket, no deduction.
        public TimeOnly EarlyMealWindowStartTime { get; set; }

        public TimeOnly EarlyMealWindowEndTime { get; set; }

        // Exceeding any limit blocks creating/editing the form.
        public decimal DailyOtHourLimit { get; set; }

        public decimal MonthlyOtHourLimit { get; set; }

        public decimal YearlyOtHourLimit { get; set; }

        // Used when the day is a holiday per WorkCalendarDay.
        public decimal DailyOtHourLimitHoliday { get; set; }

        // Daily batch send time (Vietnam time).
        public TimeOnly BatchAutoSendTime { get; set; }

        public int ResubmitWindowDays { get; set; }

        public int BackdateDays { get; set; }

        // Daily OT data mail to General Affairs (Vietnam time).
        public TimeOnly GeneralAffairsSendTime { get; set; }

        // One row per active workshop x department.
        public List<GeneralAffairsRecipientDto> GeneralAffairsRecipients { get; set; } = [];
    }

    public class GeneralAffairsRecipientDto
    {
        public int WorkshopId { get; set; }

        public string WorkshopName { get; set; } = "";

        public int DepartmentId { get; set; }

        public string DepartmentName { get; set; } = "";

        // "a@x; b@y"; null holds this pair's mail back.
        public string? Emails { get; set; }
    }
}
