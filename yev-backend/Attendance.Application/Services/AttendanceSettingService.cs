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
        // Giá trị mặc định phải KHỚP với seed trong migration AddAttendanceSetting — dùng lại ở đây làm
        // fallback khi dòng cấu hình bị xoá tay trực tiếp dưới DB.
        public const decimal DefaultMainMealTicketMinHours = 2.5m;
        public const decimal DefaultMonthlyOtHourLimit = 25m;
        public const decimal DefaultYearlyOtHourLimit = 300m;

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
            setting.MonthlyOtHourLimit = request.MonthlyOtHourLimit;
            setting.YearlyOtHourLimit = request.YearlyOtHourLimit;

            _unitOfWork.AttendanceSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(setting);
        }

        public async Task<decimal> GetMainMealTicketMinHoursAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return setting.MainMealTicketMinHours;
        }

        private static AttendanceSettingDto ToDto(AttendanceSetting setting) => new()
        {
            MainMealTicketMinHours = setting.MainMealTicketMinHours,
            MonthlyOtHourLimit = setting.MonthlyOtHourLimit,
            YearlyOtHourLimit = setting.YearlyOtHourLimit,
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
                MonthlyOtHourLimit = DefaultMonthlyOtHourLimit,
                YearlyOtHourLimit = DefaultYearlyOtHourLimit,
            };
            await _unitOfWork.AttendanceSettings.AddAsync(setting);
            await _unitOfWork.SaveChangesAsync();
            return setting;
        }
    }
}
