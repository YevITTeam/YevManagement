using Attendance.Application.Dtos.UserSignatures;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class UserSignatureService : BaseService<IAttendanceUnitOfWork>, IUserSignatureService
    {
        public UserSignatureService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<UserSignatureDto> GetByUserNameAsync(string userName)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);
            signature.OrThrowNotFound("Chữ ký", userName);

            return new UserSignatureDto { UserName = signature!.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }

        public async Task<UserSignatureDto> UpsertAsync(string userName, UpsertUserSignatureDto request)
        {
            var signature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == userName);

            if (signature == null)
            {
                signature = new UserSignature
                {
                    UserName = userName,
                    SignatureImage = request.SignatureImage,
                    UpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.UserSignatures.AddAsync(signature);
            }
            else
            {
                signature.SignatureImage = request.SignatureImage;
                signature.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.UserSignatures.Update(signature);
            }

            await _unitOfWork.SaveChangesAsync();

            return new UserSignatureDto { UserName = signature.UserName, SignatureImage = signature.SignatureImage, UpdatedAt = signature.UpdatedAt };
        }
    }
}
