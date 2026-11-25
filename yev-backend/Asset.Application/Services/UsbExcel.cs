using Asset.Domain.Enums;
using ClosedXML.Excel;

namespace Asset.Application.Services
{
    // One flat sheet per USB export: title row, header row, data. Rows past MaxRows are cut and the title says so.
    internal static class UsbExcel
    {
        public const int MaxRows = 50_000;

        public static byte[] Build(string title, string[] headers, IEnumerable<object?[]> rows, int totalCount)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add(title);

            sheet.Cell(1, 1).Value = $"{title} — xuất lúc {DateTime.UtcNow.AddHours(7):dd/MM/yyyy HH:mm}"
                + (totalCount > MaxRows ? $" — chỉ {MaxRows:N0}/{totalCount:N0} dòng đầu, lọc hẹp hơn để xuất hết" : "");
            sheet.Cell(1, 1).Style.Font.SetBold();

            const int headerRow = 2;
            for (var c = 0; c < headers.Length; c++) sheet.Cell(headerRow, c + 1).Value = headers[c];
            var header = sheet.Range(headerRow, 1, headerRow, headers.Length);
            header.Style.Font.SetBold();
            header.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#E2E8F0"));

            var row = headerRow;
            foreach (var values in rows)
            {
                row++;
                for (var c = 0; c < values.Length; c++)
                {
                    var cell = sheet.Cell(row, c + 1);
                    switch (values[c])
                    {
                        case null: break;
                        case DateTime d:
                            cell.Value = d;
                            cell.Style.DateFormat.Format = "dd/MM/yyyy HH:mm:ss";
                            break;
                        case int i: cell.Value = i; break;
                        case long l: cell.Value = l; break;
                        case double n: cell.Value = n; break;
                        default: cell.Value = values[c]!.ToString(); break;
                    }
                }
            }

            sheet.SheetView.FreezeRows(headerRow);
            sheet.Columns(1, headers.Length).AdjustToContents(headerRow, Math.Min(row, headerRow + 500), 8, 60);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        public static string AccessLevelText(int level) => level == (int)UsbAccessLevel.ReadOnly ? "Chỉ đọc" : "Đọc-ghi";

        public static string? PolicyResultText(int? result) => result switch
        {
            (int)UsbPolicyResult.Approved => "Đã cấp phép",
            (int)UsbPolicyResult.Blocked => "Bị chặn",
            (int)UsbPolicyResult.NotApproved => "Chưa cấp phép",
            (int)UsbPolicyResult.BlockFailed => "Chặn thất bại",
            (int)UsbPolicyResult.ReadOnly => "Chỉ đọc",
            _ => null
        };
    }
}
