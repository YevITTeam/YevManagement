using Attendance.Application.Dtos.Overview;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Everything is aggregated in SQL against the caller's employee scope (a subquery, not an id list), so only
    // grouped rows come back — never one row per employee or per OT form row.
    public class OtOverviewService : BaseService<IAttendanceUnitOfWork>, IOtOverviewService
    {
        // An employee at or above this share of a limit (without exceeding it) counts as "near the limit".
        private const decimal NearLimitRatio = 0.8m;
        private const int RiskEmployeeCount = 10;

        private readonly IEmployeeService _employeeService;
        private readonly IAttendanceSettingService _attendanceSettingService;

        public OtOverviewService(IAttendanceUnitOfWork unitOfWork, IEmployeeService employeeService, IAttendanceSettingService attendanceSettingService)
            : base(unitOfWork)
        {
            _employeeService = employeeService;
            _attendanceSettingService = attendanceSettingService;
        }

        public async Task<OtOverviewDto?> GetAsync(string callerUserName, bool isAdmin, int year, int month, int? workshopId)
        {
            if (month < 1 || month > 12 || year < 2000 || year > 2100)
                throw new DomainException("Năm/tháng không hợp lệ.");
            if (!await _employeeService.CanViewOverviewAsync(callerUserName, isAdmin))
                return null;

            var settings = await _attendanceSettingService.GetAsync();
            var scoped = await _employeeService.GetOverviewEmployeeQueryAsync(callerUserName, isAdmin, workshopId);

            var monthStart = new DateOnly(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var result = new OtOverviewDto
            {
                Year = year,
                Month = month,
                EmployeeCount = await _unitOfWork.Employees.CountAsync(scoped),
                MonthlyLimit = settings.MonthlyOtHourLimit,
                YearlyLimit = settings.YearlyOtHourLimit
            };

            var overByDepartment = await FillLedgerStatsAsync(result, scoped, settings, year, month);
            await FillFormStatsAsync(result, scoped, settings, monthStart, monthEnd, workshopId, overByDepartment);
            return result;
        }

        // Ledger side: monthly totals and trend, then per-employee month/year totals against the limits.
        // Returns the over-limit employee count per department for the form step.
        private async Task<Dictionary<int, int>> FillLedgerStatsAsync(
            OtOverviewDto result, IQueryable<Attendance.Domain.Entities.Employee> scoped,
            Attendance.Application.Dtos.AttendanceSettings.AttendanceSettingDto settings, int year, int month)
        {
            var ledger = _unitOfWork.EmployeeAccumulationHistories.GetQueryable()
                .Where(h => h.Year >= year - 1 && h.Year <= year && scoped.Any(e => e.Id == h.EmployeeId));

            var monthTotals = await _unitOfWork.EmployeeAccumulationHistories.GroupCountAsync(
                ledger, h => new { h.Year, h.Month }, g => new { g.Key.Year, g.Key.Month, Hours = g.Sum(h => h.TotalHours) });
            var hoursByMonth = monthTotals.Where(x => x.Year == year).ToDictionary(x => x.Month, x => x.Hours);
            result.MonthlyTrend = Enumerable.Range(1, 12)
                .Select(m => new OtOverviewMonthDto { Month = m, Hours = hoursByMonth.GetValueOrDefault(m) })
                .ToList();
            result.MonthHours = hoursByMonth.GetValueOrDefault(month);
            var (prevYear, prevMonth) = month == 1 ? (year - 1, 12) : (year, month - 1);
            result.PreviousMonthHours = monthTotals.Where(x => x.Year == prevYear && x.Month == prevMonth).Sum(x => x.Hours);

            // Year total includes the Month = 0 opening balance, same as the accumulation history screen.
            var perEmployee = await _unitOfWork.EmployeeAccumulationHistories.GroupCountAsync(
                ledger.Where(h => h.Year == year),
                h => new
                {
                    h.EmployeeId,
                    DepartmentId = h.Employee.DepartmentId ?? (h.Employee.Group != null ? h.Employee.Group.DepartmentId : (int?)null),
                    h.Employee.CustomMonthlyOtHourLimit,
                    h.Employee.CustomYearlyOtHourLimit
                },
                g => new
                {
                    g.Key.EmployeeId,
                    g.Key.DepartmentId,
                    g.Key.CustomMonthlyOtHourLimit,
                    g.Key.CustomYearlyOtHourLimit,
                    MonthHours = g.Where(h => h.Month == month).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearHours = g.Sum(h => h.TotalHours)
                });

            var statuses = perEmployee.Select(e =>
            {
                var monthlyLimit = e.CustomMonthlyOtHourLimit ?? settings.MonthlyOtHourLimit;
                var yearlyLimit = e.CustomYearlyOtHourLimit ?? settings.YearlyOtHourLimit;
                var ratio = Math.Max(monthlyLimit > 0 ? e.MonthHours / monthlyLimit : 0, yearlyLimit > 0 ? e.YearHours / yearlyLimit : 0);
                return (e.EmployeeId, e.DepartmentId, e.MonthHours, e.YearHours, MonthlyLimit: monthlyLimit, YearlyLimit: yearlyLimit,
                        OverMonthly: e.MonthHours > monthlyLimit, OverYearly: e.YearHours > yearlyLimit, Ratio: ratio);
            }).ToList();

            result.OverMonthlyCount = statuses.Count(x => x.OverMonthly);
            result.OverYearlyCount = statuses.Count(x => x.OverYearly);
            result.OverAnyCount = statuses.Count(x => x.OverMonthly || x.OverYearly);
            result.NearLimitCount = statuses.Count(x => !x.OverMonthly && !x.OverYearly && x.Ratio >= NearLimitRatio);

            var risk = statuses.Where(x => x.Ratio > 0).OrderByDescending(x => x.Ratio).Take(RiskEmployeeCount).ToList();
            var riskIds = risk.Select(x => x.EmployeeId).ToList();
            var riskEmployees = (await _unitOfWork.Employees.SelectAsync(
                x => riskIds.Contains(x.Id),
                x => new
                {
                    x.Id,
                    x.Code,
                    FullName = x.LastName + " " + x.FirstName,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : (x.Group != null ? x.Group.Department.DepartmentNameVn : null),
                    DepartmentNameJp = x.Department != null ? x.Department.DepartmentNameJp : (x.Group != null ? x.Group.Department.DepartmentNameJp : null)
                })).ToDictionary(x => x.Id);
            result.RiskEmployees = risk
                .Where(x => riskEmployees.ContainsKey(x.EmployeeId))
                .Select(x =>
                {
                    var info = riskEmployees[x.EmployeeId];
                    return new OtOverviewEmployeeRowDto
                    {
                        EmployeeId = x.EmployeeId,
                        Code = info.Code,
                        FullName = info.FullName,
                        DepartmentNameVn = info.DepartmentNameVn,
                        DepartmentNameJp = info.DepartmentNameJp,
                        MonthHours = x.MonthHours,
                        MonthlyLimit = x.MonthlyLimit,
                        YearHours = x.YearHours,
                        YearlyLimit = x.YearlyLimit,
                        IsOverMonthly = x.OverMonthly,
                        IsOverYearly = x.OverYearly
                    };
                })
                .ToList();

            return statuses
                .Where(x => (x.OverMonthly || x.OverYearly) && x.DepartmentId.HasValue)
                .GroupBy(x => x.DepartmentId!.Value)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        // Form side: counts by status / OT case, plus hours of Completed rows by day / unit / OT case. Rows are
        // grouped by (day, unit, case, time range) in SQL, so hours are count x per-row hours.
        private async Task FillFormStatsAsync(
            OtOverviewDto result, IQueryable<Attendance.Domain.Entities.Employee> scoped,
            Attendance.Application.Dtos.AttendanceSettings.AttendanceSettingDto settings,
            DateOnly monthStart, DateOnly monthEnd, int? workshopId, Dictionary<int, int> overByDepartment)
        {
            var forms = _unitOfWork.OtForms.GetQueryable()
                .Where(f => !f.IsDeleted && f.Date >= monthStart && f.Date <= monthEnd && (workshopId == null || f.WorkshopId == workshopId)
                    && f.OtFormEmployees.Any(r => !r.IsRemoved && scoped.Any(e => e.Id == r.EmployeeId)));
            var formCounts = await _unitOfWork.OtForms.GroupCountAsync(
                forms, f => new { f.Status, OtCaseCode = f.OtCase.Code }, g => new { g.Key.Status, g.Key.OtCaseCode, Count = g.Count() });

            result.FormsInApproval = formCounts.Where(x => x.Status == (int)OtFormStatus.InApproval).Sum(x => x.Count);
            result.FormsCompleted = formCounts.Where(x => x.Status == (int)OtFormStatus.Completed).Sum(x => x.Count);
            result.FormsRejected = formCounts.Where(x => x.Status == (int)OtFormStatus.Rejected).Sum(x => x.Count);

            var completedRows = _unitOfWork.OtFormEmployees.GetQueryable()
                .Where(x => !x.IsRemoved && !x.OtForm.IsDeleted && x.OtForm.Status == (int)OtFormStatus.Completed
                    && x.OtForm.Date >= monthStart && x.OtForm.Date <= monthEnd && (workshopId == null || x.OtForm.WorkshopId == workshopId)
                    && scoped.Any(e => e.Id == x.EmployeeId));
            var groups = await _unitOfWork.OtFormEmployees.GroupCountAsync(
                completedRows,
                x => new
                {
                    x.OtForm.Date,
                    x.OtForm.DepartmentId,
                    DepartmentNameVn = x.OtForm.Department.DepartmentNameVn,
                    DepartmentNameJp = x.OtForm.Department.DepartmentNameJp,
                    x.OtForm.WorkshopId,
                    WorkshopNameVn = x.OtForm.Workshop.WorkshopNameVn,
                    WorkshopNameJp = x.OtForm.Workshop.WorkshopNameJp,
                    OtCaseCode = x.OtForm.OtCase.Code,
                    x.StartTime,
                    x.EndTime,
                    x.DidEat
                },
                g => new { g.Key.Date, g.Key.DepartmentId, g.Key.DepartmentNameVn, g.Key.DepartmentNameJp, g.Key.WorkshopId, g.Key.WorkshopNameVn, g.Key.WorkshopNameJp, g.Key.OtCaseCode, g.Key.StartTime, g.Key.EndTime, g.Key.DidEat, Count = g.Count() });

            var completed = groups
                .Select(x => (Row: x, Hours: x.Count * MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings)))
                .ToList();

            var hoursByDay = completed.GroupBy(x => x.Row.Date).ToDictionary(g => g.Key, g => g.Sum(x => x.Hours));
            result.DailyHours = Enumerable.Range(0, monthEnd.Day)
                .Select(i => monthStart.AddDays(i))
                .Select(d => new OtOverviewDayDto { Date = d, Hours = hoursByDay.GetValueOrDefault(d) })
                .ToList();

            var departmentUnits = completed
                .GroupBy(x => x.Row.DepartmentId)
                .ToDictionary(g => g.Key, g => new OtOverviewUnitDto
                {
                    Id = g.Key,
                    NameVn = g.First().Row.DepartmentNameVn,
                    NameJp = g.First().Row.DepartmentNameJp,
                    Hours = g.Sum(x => x.Hours)
                });
            var missingDepartmentIds = overByDepartment.Keys.Where(id => !departmentUnits.ContainsKey(id)).ToList();
            if (missingDepartmentIds.Count > 0)
            {
                var names = await _unitOfWork.Departments.SelectAsync(
                    x => missingDepartmentIds.Contains(x.Id), x => new { x.Id, x.DepartmentNameVn, x.DepartmentNameJp });
                foreach (var d in names)
                    departmentUnits[d.Id] = new OtOverviewUnitDto { Id = d.Id, NameVn = d.DepartmentNameVn, NameJp = d.DepartmentNameJp };
            }
            foreach (var (departmentId, count) in overByDepartment)
                if (departmentUnits.TryGetValue(departmentId, out var unit))
                    unit.OverLimitCount = count;
            result.ByDepartment = departmentUnits.Values.OrderByDescending(x => x.Hours).ThenByDescending(x => x.OverLimitCount).ToList();

            result.ByWorkshop = completed
                .GroupBy(x => x.Row.WorkshopId)
                .Select(g => new OtOverviewUnitDto
                {
                    Id = g.Key,
                    NameVn = g.First().Row.WorkshopNameVn,
                    NameJp = g.First().Row.WorkshopNameJp,
                    Hours = g.Sum(x => x.Hours)
                })
                .OrderByDescending(x => x.Hours)
                .ToList();

            var hoursByCase = completed.GroupBy(x => x.Row.OtCaseCode).ToDictionary(g => g.Key, g => g.Sum(x => x.Hours));
            result.ByOtCase = formCounts
                .GroupBy(x => x.OtCaseCode)
                .Select(g => new OtOverviewCaseDto { Code = g.Key, FormCount = g.Sum(x => x.Count), Hours = hoursByCase.GetValueOrDefault(g.Key) })
                .OrderBy(x => x.Code)
                .ToList();
        }
    }
}
