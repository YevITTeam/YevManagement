using Attendance.Application.Dtos.OtCases;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class OtCaseService : BaseService<IAttendanceUnitOfWork>, IOtCaseService
    {
        public OtCaseService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<OtCaseDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.OtCases.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword));
            }

            return await _unitOfWork.OtCases.ToPagedResponseAsync(
                query.OrderBy(x => x.Code),
                pageIndex,
                pageSize,
                x => new OtCaseDto { Id = x.Id, Code = x.Code, Description = x.Description, RequireSignature = x.RequireSignature, RequiredApprovalLevel = x.RequiredApprovalLevel }
            );
        }

        public async Task<List<OtCaseDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.OtCases.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new OtCaseDto { Id = x.Id, Code = x.Code, Description = x.Description, RequireSignature = x.RequireSignature, RequiredApprovalLevel = x.RequiredApprovalLevel }
            );
            return items.OrderBy(x => x.Code).ToList();
        }

        public async Task<OtCaseDto> GetByIdAsync(int id)
        {
            var otCase = await _unitOfWork.OtCases.GetByIdAsync(id);
            otCase.OrThrowNotFound("Trường hợp OT", id);

            return new OtCaseDto { Id = otCase!.Id, Code = otCase.Code, Description = otCase.Description, RequireSignature = otCase.RequireSignature, RequiredApprovalLevel = otCase.RequiredApprovalLevel };
        }

        public async Task<OtCaseDto> CreateAsync(CreateOtCaseDto request)
        {
            var exists = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã trường hợp '{request.Code}' đã tồn tại.");

            var newOtCase = new OtCase
            {
                Code = request.Code,
                Description = request.Description,
                RequireSignature = request.RequireSignature,
                RequiredApprovalLevel = request.RequiredApprovalLevel,
                IsDeleted = false
            };

            await _unitOfWork.OtCases.AddAsync(newOtCase);
            await _unitOfWork.SaveChangesAsync();

            return new OtCaseDto { Id = newOtCase.Id, Code = newOtCase.Code, Description = newOtCase.Description, RequireSignature = newOtCase.RequireSignature, RequiredApprovalLevel = newOtCase.RequiredApprovalLevel };
        }

        public async Task UpdateAsync(UpdateOtCaseDto request)
        {
            var otCase = await _unitOfWork.OtCases.GetByIdAsync(request.Id);
            otCase.OrThrowNotFound("Trường hợp OT", request.Id);

            if (otCase!.Code != request.Code)
            {
                var exists = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã trường hợp '{request.Code}' đã tồn tại.");
            }

            otCase.Code = request.Code;
            otCase.Description = request.Description;
            otCase.RequireSignature = request.RequireSignature;
            otCase.RequiredApprovalLevel = request.RequiredApprovalLevel;

            _unitOfWork.OtCases.Update(otCase);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var otCase = await _unitOfWork.OtCases.GetByIdAsync(id);
            otCase.OrThrowNotFound("Trường hợp OT", id);

            otCase!.IsDeleted = true;

            _unitOfWork.OtCases.Update(otCase);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
