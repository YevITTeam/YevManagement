namespace Shared.Application.Interfaces
{
    // Đọc file .html tĩnh (mỗi module tự chứa template của mình dưới thư mục EmailTemplates/, copy ra
    // build output qua <Content CopyToOutputDirectory>) rồi thay các placeholder dạng {{Key}} bằng giá
    // trị thật — tách nội dung email ra khỏi code C#, không còn ghép chuỗi HTML thủ công trong Service.
    public interface IEmailTemplateRenderer
    {
        // relativeTemplatePath dạng "OtForm/ApprovalNotification.html" (tính từ thư mục EmailTemplates
        // trong build output) — mỗi module tự đặt file dưới thư mục con tên tính năng của mình.
        string Render(string relativeTemplatePath, IDictionary<string, string> placeholders);
    }
}
