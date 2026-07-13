using Asset.Application.Dtos.DeviceDepartments;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceDepartmentService : BaseService<IAssetUnitOfWork>, IDeviceDepartmentService
    {
        public DeviceDepartmentService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<DeviceDepartmentDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.DeviceDepartments.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.DepartmentCode.Contains(keyword) || x.DepartmentName.Contains(keyword));
            }

            return await _unitOfWork.DeviceDepartments.ToPagedResponseAsync(
                query.OrderBy(x => x.DepartmentCode),
                pageIndex,
                pageSize,
                x => new DeviceDepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentName = x.DepartmentName }
            );
        }

        public async Task<List<DeviceDepartmentDto>> GetAllActiveAsync()
        {
            var departments = await _unitOfWork.DeviceDepartments.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new DeviceDepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentName = x.DepartmentName }
            );
            return departments.OrderBy(x => x.DepartmentName).ToList();
        }

        public async Task<DeviceDepartmentDto> GetByIdAsync(int id)
        {
            var department = await _unitOfWork.DeviceDepartments.GetByIdAsync(id);
            department.OrThrowNotFound("Bộ phận", id);

            return new DeviceDepartmentDto { Id = department.Id, DepartmentCode = department.DepartmentCode, DepartmentName = department.DepartmentName };
        }

        public async Task<DeviceDepartmentDto> CreateAsync(CreateDeviceDepartmentDto request)
        {
            var exists = await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(x => x.DepartmentCode == request.DepartmentCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã bộ phận '{request.DepartmentCode}' đã tồn tại.");

            var newDepartment = new DeviceDepartment
            {
                DepartmentCode = request.DepartmentCode,
                DepartmentName = request.DepartmentName,
                IsDeleted = false
            };

            await _unitOfWork.DeviceDepartments.AddAsync(newDepartment);
            await _unitOfWork.SaveChangesAsync();

            return new DeviceDepartmentDto { Id = newDepartment.Id, DepartmentCode = newDepartment.DepartmentCode, DepartmentName = newDepartment.DepartmentName };
        }

        public async Task UpdateAsync(UpdateDeviceDepartmentDto request)
        {
            var department = await _unitOfWork.DeviceDepartments.GetByIdAsync(request.Id);
            department.OrThrowNotFound("Bộ phận", request.Id);

            if (department.DepartmentCode != request.DepartmentCode)
            {
                var exists = await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(x => x.DepartmentCode == request.DepartmentCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã bộ phận '{request.DepartmentCode}' đã tồn tại.");
            }

            department.DepartmentCode = request.DepartmentCode;
            department.DepartmentName = request.DepartmentName;

            _unitOfWork.DeviceDepartments.Update(department);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var department = await _unitOfWork.DeviceDepartments.GetByIdAsync(id);
            department.OrThrowNotFound("Bộ phận", id);

            department.IsDeleted = true;

            _unitOfWork.DeviceDepartments.Update(department);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
