using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Cấu hình dùng chung của module Attendance — bảng LUÔN chỉ có đúng 1 dòng (seed sẵn ở migration).
    // Mirror Asset.Application.Services.AssetSettingService.
    public class AttendanceSettingService : BaseService<IAttendanceUnitOfWork>, IAttendanceSettingService
    {
        // Giá trị mặc định phải KHỚP với seed trong migration AddAttendanceSetting/tương ứng — dùng lại
        // ở đây làm fallback khi dòng cấu hình bị xoá tay trực tiếp dưới DB.
        // Đổi 2 -> 3.5 (2026-08-26, redesign 3 bậc phiếu ăn theo yêu cầu người dùng) — giờ so trên
        // THỰC TÍCH (sau khi trừ MealBreakDeductionHours), không còn trên giờ thô như trước.
        public const decimal DefaultMainMealTicketMinHours = 3.5m;
        public const decimal DefaultNoMealTicketMaxHours = 2m;
        public const decimal DefaultMealBreakDeductionHours = 0.5m;
        public static readonly TimeOnly DefaultEarlyMealWindowStartTime = new(6, 0);
        public static readonly TimeOnly DefaultEarlyMealWindowEndTime = new(8, 0);
        public const decimal DefaultDailyOtHourLimit = 4m;
        public const decimal DefaultMonthlyOtHourLimit = 25m;
        public const decimal DefaultYearlyOtHourLimit = 300m;
        public static readonly TimeOnly DefaultBatchAutoSendTime = new(15, 0);

        public AttendanceSettingService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<AttendanceSettingDto> GetAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return ToDto(setting);
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
            setting.BatchAutoSendTime = request.BatchAutoSendTime;

            _unitOfWork.AttendanceSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(setting);
        }

        public async Task<TimeOnly> GetBatchAutoSendTimeAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return setting.BatchAutoSendTime;
        }

        private static AttendanceSettingDto ToDto(AttendanceSetting setting) => new()
        {
            MainMealTicketMinHours = setting.MainMealTicketMinHours,
            NoMealTicketMaxHours = setting.NoMealTicketMaxHours,
            MealBreakDeductionHours = setting.MealBreakDeductionHours,
            EarlyMealWindowStartTime = setting.EarlyMealWindowStartTime,
            EarlyMealWindowEndTime = setting.EarlyMealWindowEndTime,
            DailyOtHourLimit = setting.DailyOtHourLimit,
            MonthlyOtHourLimit = setting.MonthlyOtHourLimit,
            YearlyOtHourLimit = setting.YearlyOtHourLimit,
            BatchAutoSendTime = setting.BatchAutoSendTime,
        };

        // Bảng luôn chỉ có đúng 1 dòng (seed ở migration). Tự tạo lại dòng mặc định nếu vì lý do nào đó
        // nó biến mất (vd sửa tay dưới DB) — tránh làm chết cả API lẫn màn tạo đơn chỉ vì thiếu cấu hình.
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
                BatchAutoSendTime = DefaultBatchAutoSendTime,
            };
            await _unitOfWork.AttendanceSettings.AddAsync(setting);
            await _unitOfWork.SaveChangesAsync();
            return setting;
        }
    }
}
