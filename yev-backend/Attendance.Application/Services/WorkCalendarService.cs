using Attendance.Application.Dtos.WorkCalendars;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Non-working-day calendar (Sunday / public holiday / special holiday). Each year is imported from an
    // Excel file that is also the template served by BuildTemplateAsync.
    public class WorkCalendarService : BaseService<IAttendanceUnitOfWork>, IWorkCalendarService
    {
        private const string SheetName = "Lịch nghỉ";
        private const string LabelSunday = "Chủ nhật";
        private const string LabelPublicHoliday = "Ngày lễ";
        private const string LabelSpecialHoliday = "Nghỉ đặc biệt";
        private const int MaxReportedErrors = 10;

        public WorkCalendarService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork)
        {
        }

        public async Task<IReadOnlyList<WorkCalendarDayDto>> GetByYearAsync(int year)
        {
            var rows = await FindYearAsync(year);
            return rows
                .OrderBy(x => x.Date)
                .Select(x => new WorkCalendarDayDto { Date = x.Date, DayType = x.DayType, Note = x.Note })
                .ToList();
        }

        public async Task<byte[]> BuildTemplateAsync(int year)
        {
            var stored = (await FindYearAsync(year)).ToDictionary(x => x.Date);

            var days = new List<WorkCalendarDayDto>();
            for (var date = new DateOnly(year, 1, 1); date.Year == year; date = date.AddDays(1))
            {
                if (stored.TryGetValue(date, out var storedDay))
                {
                    days.Add(new WorkCalendarDayDto { Date = storedDay.Date, DayType = storedDay.DayType, Note = storedDay.Note });
                }
                else if (date.DayOfWeek == DayOfWeek.Sunday)
                {
                    days.Add(new WorkCalendarDayDto { Date = date, DayType = WorkCalendarDayType.Sunday });
                }
            }

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add(SheetName);
            sheet.Cell(1, 1).Value = "Ngày";
            sheet.Cell(1, 2).Value = "Loại";
            sheet.Cell(1, 3).Value = "Ghi chú";
            sheet.Row(1).Style.Font.Bold = true;

            var row = 2;
            foreach (var day in days)
            {
                sheet.Cell(row, 1).Value = day.Date.ToDateTime(TimeOnly.MinValue);
                sheet.Cell(row, 1).Style.DateFormat.Format = "dd/MM/yyyy";
                sheet.Cell(row, 2).Value = LabelOf(day.DayType);
                sheet.Cell(row, 3).Value = day.Note ?? string.Empty;
                row++;
            }

            // Restrict the type column to the three allowed labels so typos cannot reach the import.
            sheet.Range(2, 2, 1000, 2).CreateDataValidation()
                .List($"\"{LabelSunday},{LabelPublicHoliday},{LabelSpecialHoliday}\"");

            sheet.Columns().AdjustToContents();
            using var output = new MemoryStream();
            workbook.SaveAs(output);
            return output.ToArray();
        }

        public async Task<WorkCalendarImportResultDto> ImportAsync(int year, Stream stream)
        {
            var parsed = ParseFile(year, stream, out var errors);
            if (errors.Count > 0)
            {
                var shown = string.Join("; ", errors.Take(MaxReportedErrors));
                var more = errors.Count > MaxReportedErrors ? $"; và {errors.Count - MaxReportedErrors} lỗi khác" : string.Empty;
                throw new DomainException(shown + more + ". Chưa import dòng nào, vui lòng sửa file rồi thử lại.");
            }

            var existing = await FindYearAsync(year);
            _unitOfWork.WorkCalendarDays.RemoveRange(existing);
            await _unitOfWork.WorkCalendarDays.AddRangeAsync(parsed);
            await _unitOfWork.SaveChangesAsync();

            return new WorkCalendarImportResultDto { Year = year, ImportedCount = parsed.Count };
        }

        private async Task<IReadOnlyList<WorkCalendarDay>> FindYearAsync(int year)
        {
            var start = new DateOnly(year, 1, 1);
            var end = new DateOnly(year + 1, 1, 1);
            return await _unitOfWork.WorkCalendarDays.FindAsync(x => x.Date >= start && x.Date < end);
        }

        private static List<WorkCalendarDay> ParseFile(int year, Stream stream, out List<string> errors)
        {
            errors = new List<string>();
            var result = new List<WorkCalendarDay>();
            var seenDates = new HashSet<DateOnly>();

            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception)
            {
                errors.Add("File không phải Excel (.xlsx) hợp lệ");
                return result;
            }

            using (workbook)
            {
                var sheet = workbook.Worksheets.FirstOrDefault(x => x.Name == SheetName) ?? workbook.Worksheets.First();
                var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;

                for (var r = 2; r <= lastRow; r++)
                {
                    var dateCell = sheet.Cell(r, 1);
                    var typeCell = sheet.Cell(r, 2);
                    if (dateCell.IsEmpty() && typeCell.IsEmpty()) continue;

                    if (!TryReadDate(dateCell, out var date))
                    {
                        errors.Add($"Dòng {r}: ngày không hợp lệ (cần dd/MM/yyyy)");
                        continue;
                    }
                    if (date.Year != year)
                    {
                        errors.Add($"Dòng {r}: ngày {date:dd/MM/yyyy} không thuộc năm {year}");
                        continue;
                    }
                    if (!seenDates.Add(date))
                    {
                        errors.Add($"Dòng {r}: ngày {date:dd/MM/yyyy} bị trùng");
                        continue;
                    }

                    var typeLabel = typeCell.GetString().Trim();
                    if (!TryParseType(typeLabel, out var dayType))
                    {
                        errors.Add($"Dòng {r}: Loại '{typeLabel}' không hợp lệ ({LabelSunday} / {LabelPublicHoliday} / {LabelSpecialHoliday})");
                        continue;
                    }

                    var note = sheet.Cell(r, 3).GetString().Trim();
                    result.Add(new WorkCalendarDay
                    {
                        Date = date,
                        DayType = dayType,
                        Note = string.IsNullOrEmpty(note) ? null : note,
                    });
                }

                if (result.Count == 0 && errors.Count == 0)
                    errors.Add("File không có dòng ngày nghỉ nào");
            }

            return result;
        }

        private static bool TryReadDate(IXLCell cell, out DateOnly date)
        {
            if (cell.TryGetValue<DateTime>(out var dateTime))
            {
                date = DateOnly.FromDateTime(dateTime);
                return true;
            }
            return DateOnly.TryParseExact(cell.GetString().Trim(), "dd/MM/yyyy", out date);
        }

        private static bool TryParseType(string label, out WorkCalendarDayType dayType)
        {
            switch (label)
            {
                case LabelSunday:
                    dayType = WorkCalendarDayType.Sunday;
                    return true;
                case LabelPublicHoliday:
                    dayType = WorkCalendarDayType.PublicHoliday;
                    return true;
                case LabelSpecialHoliday:
                    dayType = WorkCalendarDayType.SpecialHoliday;
                    return true;
                default:
                    dayType = default;
                    return false;
            }
        }

        private static string LabelOf(WorkCalendarDayType dayType) => dayType switch
        {
            WorkCalendarDayType.Sunday => LabelSunday,
            WorkCalendarDayType.PublicHoliday => LabelPublicHoliday,
            WorkCalendarDayType.SpecialHoliday => LabelSpecialHoliday,
            _ => string.Empty,
        };
    }
}
