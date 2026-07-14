using System.Text;

namespace Shared.Application.Helper
{
    // Đọc file CSV thô thành các dòng/cột dạng string, dùng chung cho các chức năng
    // import (Asset.DeviceImport/DeviceConfigurationImport) — CSV thường là định dạng
    // xuất mặc định của các công cụ kiểm kê (VD Tanium), thay vì bắt người dùng phải tự
    // convert sang .xlsx trước khi import.
    public static class CsvFileHelper
    {
        public static bool HasCsvExtension(string? fileName) =>
            !string.IsNullOrWhiteSpace(fileName) && fileName.Trim().EndsWith(".csv", StringComparison.OrdinalIgnoreCase);

        // Trả về từng dòng là 1 mảng cell đã trim (dòng đầu tiên là header, gọi tự chịu
        // trách nhiệm Skip(1) giống ClosedXML). Tự nhận diện dấu phân cách (',' hoặc ';')
        // dựa trên dòng header — Excel locale Việt Nam thường xuất CSV bằng ';' (vì ','
        // là dấu thập phân), trong khi công cụ US/Tanium thường dùng ','. Hỗ trợ field có
        // dấu ngoặc kép bao quanh (chứa dấu phân cách/xuống dòng bên trong, escape "" → ").
        public static List<string[]> ReadRows(Stream stream)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var content = reader.ReadToEnd();
            if (string.IsNullOrEmpty(content)) return new List<string[]>();

            return Tokenize(content, DetectDelimiter(content));
        }

        private static char DetectDelimiter(string content)
        {
            var firstLineEnd = content.IndexOfAny(new[] { '\r', '\n' });
            var headerLine = firstLineEnd >= 0 ? content[..firstLineEnd] : content;
            var commaCount = headerLine.Count(c => c == ',');
            var semicolonCount = headerLine.Count(c => c == ';');
            return semicolonCount > commaCount ? ';' : ',';
        }

        private static List<string[]> Tokenize(string content, char delimiter)
        {
            var rows = new List<string[]>();
            var fields = new List<string>();
            var field = new StringBuilder();
            var inQuotes = false;
            var length = content.Length;
            var i = 0;

            void EndField()
            {
                fields.Add(field.ToString().Trim());
                field.Clear();
            }

            void EndRow()
            {
                EndField();
                // Bỏ qua dòng hoàn toàn rỗng (VD dòng trắng cuối file).
                if (!(fields.Count == 1 && fields[0].Length == 0))
                    rows.Add(fields.ToArray());
                fields = new List<string>();
            }

            while (i < length)
            {
                var c = content[i];

                if (inQuotes)
                {
                    if (c == '"')
                    {
                        if (i + 1 < length && content[i + 1] == '"')
                        {
                            field.Append('"');
                            i += 2;
                            continue;
                        }
                        inQuotes = false;
                        i++;
                        continue;
                    }
                    field.Append(c);
                    i++;
                    continue;
                }

                switch (c)
                {
                    case '"':
                        inQuotes = true;
                        i++;
                        continue;
                    case '\r':
                        if (i + 1 < length && content[i + 1] == '\n') i++;
                        EndRow();
                        i++;
                        continue;
                    case '\n':
                        EndRow();
                        i++;
                        continue;
                    default:
                        if (c == delimiter)
                        {
                            EndField();
                            i++;
                            continue;
                        }
                        field.Append(c);
                        i++;
                        continue;
                }
            }

            if (field.Length > 0 || fields.Count > 0)
                EndRow();

            return rows;
        }
    }
}
