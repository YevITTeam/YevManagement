using System.Text;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    // Đọc file .html tĩnh từ thư mục "EmailTemplates" nằm cạnh DLL sau build (mỗi module tự copy file
    // của mình vào đây qua <Content CopyToOutputDirectory>, xem Attendance.Infrastructure/EmailTemplates/)
    // — tách nội dung/định dạng email khỏi code C#, sửa chữ không cần đụng Service. Thay placeholder
    // dạng "{{Key}}" bằng giá trị thật, không dùng engine template ngoài vì nhu cầu hiện tại chỉ là
    // ghép chuỗi đơn giản.
    public class EmailTemplateService : IEmailTemplateRenderer
    {
        private static readonly string TemplatesRoot = Path.Combine(AppContext.BaseDirectory, "EmailTemplates");

        public string Render(string relativeTemplatePath, IDictionary<string, string> placeholders)
        {
            var fullPath = Path.Combine(TemplatesRoot, relativeTemplatePath);
            if (!File.Exists(fullPath))
                throw new FileNotFoundException($"Không tìm thấy file template email: {fullPath}");

            var content = File.ReadAllText(fullPath, Encoding.UTF8);

            foreach (var (key, value) in placeholders)
                content = content.Replace($"{{{{{key}}}}}", value);

            return content;
        }
    }
}
