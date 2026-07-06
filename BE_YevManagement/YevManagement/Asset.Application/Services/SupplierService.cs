using Asset.Application.Dtos.Suplliers;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class SupplierService : BaseService<IAssetUnitOfWork>, ISupplierService
    {
        public SupplierService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<SupplierDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Suppliers.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.SupplierCode.Contains(keyword) || x.SupplierName.Contains(keyword));
            }

            return await _unitOfWork.Suppliers.ToPagedResponseAsync(
                query.OrderBy(x => x.SupplierCode),
                pageIndex,
                pageSize,
                x => new SupplierDto { Id = x.Id, SupplierCode = x.SupplierCode, SupplierName = x.SupplierName }
            );
        }

        public async Task<List<SupplierDto>> GetAllActiveAsync()
        {
            var suppliers = await _unitOfWork.Suppliers.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new SupplierDto { Id = x.Id, SupplierCode = x.SupplierCode, SupplierName = x.SupplierName }
            );
            return suppliers.OrderBy(x => x.SupplierName).ToList();
        }

        public async Task<SupplierDto> GetByIdAsync(int id)
        {
            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(id);
            supplier.OrThrowNotFound("Nhà cung cấp", id);

            return new SupplierDto { Id = supplier.Id, SupplierCode = supplier.SupplierCode, SupplierName = supplier.SupplierName };
        }

        public async Task<SupplierDto> CreateAsync(CreateSupplierDto request)
        {
            var exists = await _unitOfWork.Suppliers.FirstOrDefaultAsync(x => x.SupplierCode == request.SupplierCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhà cung cấp '{request.SupplierCode}' đã tồn tại.");

            var newSupplier = new Supplier
            {
                SupplierCode = request.SupplierCode,
                SupplierName = request.SupplierName,
                IsDeleted = false
            };

            await _unitOfWork.Suppliers.AddAsync(newSupplier);
            await _unitOfWork.SaveChangesAsync();

            return new SupplierDto { Id = newSupplier.Id, SupplierCode = newSupplier.SupplierCode, SupplierName = newSupplier.SupplierName };
        }

        public async Task UpdateAsync(UpdateSupplierDto request)
        {
            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(request.Id);
            supplier.OrThrowNotFound("Nhà cung cấp", request.Id);

            if (supplier.SupplierCode != request.SupplierCode)
            {
                var exists = await _unitOfWork.Suppliers.FirstOrDefaultAsync(x => x.SupplierCode == request.SupplierCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhà cung cấp '{request.SupplierCode}' đã tồn tại.");
            }

            supplier.SupplierCode = request.SupplierCode;
            supplier.SupplierName = request.SupplierName;

            _unitOfWork.Suppliers.Update(supplier);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(id);
            supplier.OrThrowNotFound("Nhà cung cấp", id);

            supplier.IsDeleted = true;

            _unitOfWork.Suppliers.Update(supplier);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}