namespace Attendance.Domain.Entities;

// Singleton row (Id=1) edited via API so Admin can change it without redeploying; never soft-deleted.
public partial class AttendanceSetting
{
    public int Id { get; set; }

    // Meal tiers use actual hours (raw minus MealBreakDeductionHours when DidEat): below NoMealTicketMaxHours none,
    // below this a secondary ticket, otherwise main. An OT exactly matching the early window always gets secondary, no deduction.
    public decimal MainMealTicketMinHours { get; set; }

    // Below this many actual hours there is no meal ticket (early-window OT excepted).
    public decimal NoMealTicketMaxHours { get; set; }

    // Not applied to OT that exactly matches the early window.
    public decimal MealBreakDeductionHours { get; set; }

    // OT whose Start/End exactly equal this window (not just overlap) always gets a secondary ticket with no deduction.
    public TimeOnly EarlyMealWindowStartTime { get; set; }

    public TimeOnly EarlyMealWindowEndTime { get; set; }

    // Daily OT limit of one employee on a working day; exceeding it blocks create/update (see
    // OtFormService.ValidateOtHourLimitsAsync). Default 4.
    public decimal DailyOtHourLimit { get; set; }

    // Passing this (or the employee's own custom limit) forces the form to TH3 instead of blocking it. Default 25.
    public decimal MonthlyOtHourLimit { get; set; }

    public decimal YearlyOtHourLimit { get; set; }

    // Daily limit used on non-working days (Sunday/holiday/special holiday, see WorkCalendarDay). Default 12.
    public decimal DailyOtHourLimitHoliday { get; set; }

    // Vietnam local time of day when OtFormBatchBackgroundService builds batches.
    public TimeOnly BatchAutoSendTime { get; set; }

    // Days after completion during which an office form signed by a Manager can still be edited and re-signed. Default 3.
    public int ResubmitWindowDays { get; set; }

    // How many days back a new form's date may be. Default 7.
    public int BackdateDays { get; set; }
}
