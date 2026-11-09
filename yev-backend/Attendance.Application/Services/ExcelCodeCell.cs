using System.Globalization;
using ClosedXML.Excel;

namespace Attendance.Application.Services
{
    internal static class ExcelCodeCell
    {
        // VLOOKUP never matches a text cell against numeric codes. Leading zeros, N-xxxxx and "a; b" lists stay text.
        public static XLCellValue From(string? code) =>
            code != null && !code.StartsWith('0') && long.TryParse(code, NumberStyles.None, CultureInfo.InvariantCulture, out var number)
                ? number
                : code;
    }
}
