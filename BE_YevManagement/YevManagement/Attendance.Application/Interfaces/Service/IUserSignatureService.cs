using Attendance.Application.Dtos.UserSignatures;

namespace Attendance.Application.Interfaces.Service
{
    public interface IUserSignatureService
    {
        Task<UserSignatureDto> GetByUserNameAsync(string userName);
        Task<UserSignatureDto> UpsertAsync(string userName, UpsertUserSignatureDto request);
    }
}
