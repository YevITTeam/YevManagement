using ClosedXML.Excel;

namespace Attendance.Application.Services
{
    public record ImportTemplateOption(string Value, string? Label = null);

    // Options become an in-cell dropdown sourced from the "Danh muc" sheet; AllowOtherValues only warns on a new value.
    public record ImportTemplateColumn(string Header, double Width, bool Required, string? NumberFormat = null,
        IReadOnlyList<ImportTemplateOption>? Options = null, bool AllowOtherValues = false);

    // Shared look of the downloadable import templates. The data sheet must stay first (parsers read
    // Worksheets.First()) and keep column A empty; instructions go to a second sheet.
    internal static class ImportTemplateBuilder
    {
        private static readonly XLColor Brand = XLColor.FromHtml("#E3000F");
        private static readonly XLColor OptionalFill = XLColor.FromHtml("#E0E3E5");
        private static readonly XLColor TextMuted = XLColor.FromHtml("#5E3F3A");
        private static readonly XLColor Grid = XLColor.FromHtml("#C8CCD0");
        private const string ListSheetName = "Danh muc";
        private const int ExtraValidatedRows = 1000;

        public static (byte[] Content, string FileName) Build(
            string sheetName,
            string title,
            IReadOnlyList<string> notes,
            IReadOnlyList<ImportTemplateColumn> columns,
            IReadOnlyList<object?[]> sampleRows,
            string fileName,
            double? dataRowHeight = null,
            bool rowsAreSamples = true)
        {
            using var workbook = new XLWorkbook();
            workbook.Style.Font.FontName = "Arial";
            workbook.Style.Font.FontSize = 10;

            var sheet = workbook.Worksheets.Add(sheetName);
            var lastCol = columns.Count + 1;
            sheet.Column(1).Width = 2.5;

            const int headerRow = 1;
            for (var i = 0; i < columns.Count; i++)
            {
                var column = columns[i];
                var col = i + 2;
                sheet.Column(col).Width = column.Width;
                if (column.NumberFormat != null)
                    sheet.Column(col).Style.NumberFormat.Format = column.NumberFormat;

                var cell = sheet.Cell(headerRow, col);
                cell.Value = column.Header;
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor = column.Required ? XLColor.White : XLColor.Black;
                cell.Style.Fill.BackgroundColor = column.Required ? Brand : OptionalFill;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Alignment.WrapText = true;
            }
            sheet.Row(headerRow).Height = 30;

            for (var r = 0; r < sampleRows.Count; r++)
            {
                for (var i = 0; i < columns.Count && i < sampleRows[r].Length; i++)
                {
                    var cell = sheet.Cell(headerRow + 1 + r, i + 2);
                    cell.Value = XLCellValue.FromObject(sampleRows[r][i]);
                    if (!rowsAreSamples) continue;
                    cell.Style.Font.Italic = true;
                    cell.Style.Font.FontColor = TextMuted;
                }
                if (dataRowHeight.HasValue) sheet.Row(headerRow + 1 + r).Height = dataRowHeight.Value;
            }

            var table = sheet.Range(headerRow, 2, headerRow + Math.Max(sampleRows.Count, 1), lastCol);
            table.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            table.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            table.Style.Border.OutsideBorderColor = Grid;
            table.Style.Border.InsideBorderColor = Grid;
            sheet.SheetView.FreezeRows(headerRow);

            var guide = workbook.Worksheets.Add("Huong dan");
            guide.Column(1).Width = 2.5;
            guide.Column(2).Width = 110;
            guide.Cell(1, 2).Value = title;
            guide.Cell(1, 2).Style.Font.Bold = true;
            guide.Cell(1, 2).Style.Font.FontSize = 14;
            guide.Cell(1, 2).Style.Font.FontColor = Brand;
            guide.Row(1).Height = 24;

            var listed = columns.Select((c, i) => (Column: c, Col: i + 2)).Where(x => x.Column.Options is { Count: > 0 }).ToList();
            var legend = $"Nhập dữ liệu ở sheet \"{sheetName}\" (phải là sheet đầu tiên). Cột tiêu đề nền đỏ: bắt buộc · nền xám: tuỳ chọn. "
                + "Không đổi thứ tự cột, không xoá cột A."
                + (listed.Count > 0 ? $" Cột {string.Join(", ", listed.Select(x => x.Column.Header))}: bấm vào ô để chọn, danh sách đầy đủ ở sheet \"{ListSheetName}\"." : "")
                + (rowsAreSamples && sampleRows.Count > 0 ? " Dòng in nghiêng là dòng mẫu — xoá trước khi import." : "");
            var row = 2;
            foreach (var note in notes.Append(legend))
            {
                var cell = guide.Cell(++row, 2);
                cell.Value = "• " + note;
                cell.Style.Font.FontColor = TextMuted;
                cell.Style.Alignment.WrapText = true;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
            }

            if (listed.Count > 0)
            {
                var lists = workbook.Worksheets.Add(ListSheetName);
                var listCol = 1;
                var lastValidatedRow = headerRow + sampleRows.Count + ExtraValidatedRows;
                foreach (var (column, col) in listed)
                {
                    var options = column.Options!;
                    lists.Cell(1, listCol).Value = column.Header;
                    lists.Cell(1, listCol + 1).Value = "Tên";
                    var header = lists.Range(1, listCol, 1, listCol + 1);
                    header.Style.Font.Bold = true;
                    header.Style.Fill.BackgroundColor = OptionalFill;
                    lists.Column(listCol).Width = Math.Max(column.Width, 12);
                    lists.Column(listCol + 1).Width = 32;
                    for (var i = 0; i < options.Count; i++)
                    {
                        lists.Cell(i + 2, listCol).Value = options[i].Value;
                        lists.Cell(i + 2, listCol + 1).Value = options[i].Label;
                    }

                    var validation = sheet.Range(headerRow + 1, col, lastValidatedRow, col).CreateDataValidation();
                    validation.List(lists.Range(2, listCol, options.Count + 1, listCol), true);
                    validation.IgnoreBlanks = true;
                    validation.ErrorStyle = column.AllowOtherValues ? XLErrorStyle.Information : XLErrorStyle.Stop;
                    validation.ErrorTitle = column.Header;
                    validation.ErrorMessage = column.AllowOtherValues
                        ? "Mã chưa có trong danh mục, sẽ được tạo mới (chỉ Admin)."
                        : $"Chọn giá trị trong danh sách (sheet \"{ListSheetName}\").";
                    listCol += 3;
                }
                lists.SheetView.FreezeRows(1);
            }

            sheet.SetTabActive();
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), fileName);
        }
    }
}
