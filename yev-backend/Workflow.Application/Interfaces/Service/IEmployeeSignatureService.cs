using Workflow.Application.Dtos.EmployeeSignatures;

namespace Workflow.Application.Interfaces.Service
{
    public interface IEmployeeSignatureService
    {
        Task<EmployeeSignatureDto> GetMineAsync(int? currentUserId);

        // Không upsert ngay — tạo 1 PendingEmployeeSignatureConfirmation rồi gửi email xác nhận cho
        // chính người gọi (mirror Attendance.UserSignatureService — chống chiếm phiên đăng nhập).
        Task RequestUpdateAsync(int? currentUserId, UpsertEmployeeSignatureDto request);

        // 2 hàm dưới phục vụ trang xác nhận công khai (Controller [AllowAnonymous]) mà FE mở khi người
        // dùng bấm link trong email — token tự nó là thông tin xác thực duy nhất.
        Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token);
        Task<EmployeeSignatureDto> ConfirmAsync(string token);
    }
}
