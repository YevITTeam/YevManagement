using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // The table always holds exactly one row, seeded by migration.
    public class AttendanceSettingService : BaseService<IAttendanceUnitOfWork>, IAttendanceSettingService
    {
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;

        // Must match the migration seed; used as fallback if the row is deleted. Compared against actual (post-deduction) hours.
        public const decimal DefaultMainMealTicketMinHours = 3.5m;
        public const decimal DefaultNoMealTicketMaxHours = 2m;
        public const decimal DefaultMealBreakDeductionHours = 0.5m;
        public static readonly TimeOnly DefaultEarlyMealWindowStartTime = new(6, 0);
        public static readonly TimeOnly DefaultEarlyMealWindowEndTime = new(8, 0);
        public const decimal DefaultDailyOtHourLimit = 4m;
        public const decimal DefaultMonthlyOtHourLimit = 25m;
        public const decimal DefaultYearlyOtHourLimit = 300m;
        public const decimal DefaultDailyOtHourLimitHoliday = 12m;
        public static readonly TimeOnly DefaultBatchAutoSendTime = new(15, 0);
        public const int DefaultResubmitWindowDays = 3;
        public const int DefaultBackdateDays = 7;
        public static readonly TimeOnly DefaultGeneralAffairsSendTime = new(17, 0);

        public AttendanceSettingService(
            IAttendanceUnitOfWork unitOfWork,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer) : base(unitOfWork)
        {
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
        }

        public async Task<AttendanceSettingDto> GetAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return ToDto(setting, await GetRecipientsAsync());
        }

        public async Task<AttendanceSettingDto> UpdateAsync(UpdateAttendanceSettingDto request)
        {
            var setting = await GetOrCreateSettingEntityAsync();
            setting.MainMealTicketMinHours = request.MainMealTicketMinHours;
            setting.NoMealTicketMaxHours = request.NoMealTicketMaxHours;
            setting.MealBreakDeductionHours = request.MealBreakDeductionHours;
            setting.EarlyMealWindowStartTime = request.EarlyMealWindowStartTime;
            setting.EarlyMealWindowEndTime = request.EarlyMealWindowEndTime;
            setting.DailyOtHourLimit = request.DailyOtHourLimit;
            setting.MonthlyOtHourLimit = request.MonthlyOtHourLimit;
            setting.YearlyOtHourLimit = request.YearlyOtHourLimit;
            setting.DailyOtHourLimitHoliday = request.DailyOtHourLimitHoliday;
            setting.BatchAutoSendTime = request.BatchAutoSendTime;
            setting.ResubmitWindowDays = request.ResubmitWindowDays;
            setting.BackdateDays = request.BackdateDays;
            setting.GeneralAffairsSendTime = request.GeneralAffairsSendTime;

            var existing = (await _unitOfWork.GeneralAffairsRecipients.GetAllAsync()).ToDictionary(x => (x.WorkshopId, x.DepartmentId));
            var validPairs = (await GetRecipientsAsync()).Select(x => (x.WorkshopId, x.DepartmentId)).ToHashSet();
            foreach (var recipient in request.GeneralAffairsRecipients.Where(x => validPairs.Contains((x.WorkshopId, x.DepartmentId))))
            {
                var emails = NormalizeEmails(recipient.Emails);
                existing.TryGetValue((recipient.WorkshopId, recipient.DepartmentId), out var row);
                if (emails == null)
                {
                    if (row != null) _unitOfWork.GeneralAffairsRecipients.Delete(row);
                }
                else if (row != null) row.Emails = emails;
                else await _unitOfWork.GeneralAffairsRecipients.AddAsync(new GeneralAffairsRecipient
                {
                    WorkshopId = recipient.WorkshopId,
                    DepartmentId = recipient.DepartmentId,
                    Emails = emails
                });
            }

            _unitOfWork.AttendanceSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(setting, await GetRecipientsAsync());
        }

        public async Task<(TimeOnly RunAt, DateOnly? LastRunDate)> GetBatchScheduleAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return (setting.BatchAutoSendTime, setting.LastBatchSweepDate);
        }

        public async Task<(TimeOnly RunAt, DateOnly? LastRunDate)> GetGeneralAffairsScheduleAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return (setting.GeneralAffairsSendTime, setting.LastGeneralAffairsSendDate);
        }

        // Accepts any mix of ';', ',', spaces and new lines; stores "a@x; b@y" or null.
        private static string? NormalizeEmails(string? value)
        {
            var emails = (value ?? "").Split((char[])[';', ',', ' ', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var invalid = emails.FirstOrDefault(x => !System.Net.Mail.MailAddress.TryCreate(x, out _));
            if (invalid != null)
                throw new DomainException($"Email không hợp lệ: {invalid}");
            var joined = string.Join("; ", emails);
            if (joined.Length > 1000)
                throw new DomainException("Danh sách email nhận quá dài (tối đa 1000 ký tự).");
            return joined.Length == 0 ? null : joined;
        }

        public async Task<bool> SendTestEmailAsync(SendTestEmailDto request, string senderDisplayName)
        {
            var html = _emailTemplateRenderer.Render("Test/TestEmail.html", new Dictionary<string, string>
            {
                ["SenderDisplayName"] = senderDisplayName,
                ["SentAtText"] = TimeHelper.GetCurrentUtcTime().ToString("dd/MM/yyyy HH:mm:ss"),
            });

            return await _emailService.SendNowAsync(request.Email, "Email kiểm tra - YevManagement", html);
        }

        // Every active workshop x department pair, configured or not, so the settings screen can fill any of them.
        private async Task<List<GeneralAffairsRecipientDto>> GetRecipientsAsync()
        {
            var workshops = (await _unitOfWork.Workshops.FindAsync(x => !x.IsDeleted)).OrderBy(x => x.Id).ToList();
            var departments = (await _unitOfWork.Departments.FindAsync(x => !x.IsDeleted)).OrderBy(x => x.DepartmentNameVn).ToList();
            var emails = (await _unitOfWork.GeneralAffairsRecipients.GetAllAsync()).ToDictionary(x => (x.WorkshopId, x.DepartmentId), x => x.Emails);
            return workshops.SelectMany(w => departments.Select(d => new GeneralAffairsRecipientDto
            {
                WorkshopId = w.Id,
                WorkshopName = w.WorkshopNameVn,
                DepartmentId = d.Id,
                DepartmentName = d.DepartmentNameVn,
                Emails = emails.GetValueOrDefault((w.Id, d.Id))
            })).ToList();
        }

        private static AttendanceSettingDto ToDto(AttendanceSetting setting, List<GeneralAffairsRecipientDto> recipients) => new()
        {
            MainMealTicketMinHours = setting.MainMealTicketMinHours,
            NoMealTicketMaxHours = setting.NoMealTicketMaxHours,
            MealBreakDeductionHours = setting.MealBreakDeductionHours,
            EarlyMealWindowStartTime = setting.EarlyMealWindowStartTime,
            EarlyMealWindowEndTime = setting.EarlyMealWindowEndTime,
            DailyOtHourLimit = setting.DailyOtHourLimit,
            MonthlyOtHourLimit = setting.MonthlyOtHourLimit,
            YearlyOtHourLimit = setting.YearlyOtHourLimit,
            DailyOtHourLimitHoliday = setting.DailyOtHourLimitHoliday,
            BatchAutoSendTime = setting.BatchAutoSendTime,
            ResubmitWindowDays = setting.ResubmitWindowDays,
            BackdateDays = setting.BackdateDays,
            GeneralAffairsSendTime = setting.GeneralAffairsSendTime,
            GeneralAffairsRecipients = recipients,
        };

        // Recreates the default row if it was deleted by hand, so missing config can't break the API.
        private async Task<AttendanceSetting> GetOrCreateSettingEntityAsync()
        {
            var settings = await _unitOfWork.AttendanceSettings.GetAllAsync();
            var setting = settings.FirstOrDefault();
            if (setting != null) return setting;

            setting = new AttendanceSetting
            {
                MainMealTicketMinHours = DefaultMainMealTicketMinHours,
                NoMealTicketMaxHours = DefaultNoMealTicketMaxHours,
                MealBreakDeductionHours = DefaultMealBreakDeductionHours,
                EarlyMealWindowStartTime = DefaultEarlyMealWindowStartTime,
                EarlyMealWindowEndTime = DefaultEarlyMealWindowEndTime,
                DailyOtHourLimit = DefaultDailyOtHourLimit,
                MonthlyOtHourLimit = DefaultMonthlyOtHourLimit,
                YearlyOtHourLimit = DefaultYearlyOtHourLimit,
                DailyOtHourLimitHoliday = DefaultDailyOtHourLimitHoliday,
                BatchAutoSendTime = DefaultBatchAutoSendTime,
                ResubmitWindowDays = DefaultResubmitWindowDays,
                BackdateDays = DefaultBackdateDays,
                GeneralAffairsSendTime = DefaultGeneralAffairsSendTime,
            };
            await _unitOfWork.AttendanceSettings.AddAsync(setting);
            await _unitOfWork.SaveChangesAsync();
            return setting;
        }
    }
}
