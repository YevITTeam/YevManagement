using Asset.Application.Dtos.Softwares;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class SoftwareService : BaseService<IAssetUnitOfWork>, ISoftwareService
    {
        public SoftwareService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<SoftwareDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Softwares.GetQueryable(false, x => x.SoftwareGroup).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.SoftwareCode.Contains(keyword) || x.SoftwareName.Contains(keyword));
            }

            return await _unitOfWork.Softwares.ToPagedResponseAsync(
                query.OrderBy(x => x.SoftwareCode),
                pageIndex,
                pageSize,
                x => new SoftwareDto
                {
                    Id = x.Id,
                    SoftwareCode = x.SoftwareCode,
                    SoftwareName = x.SoftwareName,
                    SoftwareType = x.SoftwareType,
                    Publisher = x.Publisher,
                    SoftwareQuantity = x.SoftwareQuantity,
                    SoftwarePriority = x.SoftwarePriority,
                    SoftwareGroupId = x.SoftwareGroupId,
                    SoftwareGroupName = x.SoftwareGroup.GroupName
                }
            );
        }

        public async Task<List<SoftwareDto>> GetAllActiveAsync()
        {
            var softwares = await _unitOfWork.Softwares.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new SoftwareDto
                {
                    Id = x.Id,
                    SoftwareCode = x.SoftwareCode,
                    SoftwareName = x.SoftwareName,
                    SoftwareType = x.SoftwareType,
                    Publisher = x.Publisher,
                    SoftwareQuantity = x.SoftwareQuantity,
                    SoftwarePriority = x.SoftwarePriority,
                    SoftwareGroupId = x.SoftwareGroupId,
                    SoftwareGroupName = x.SoftwareGroup.GroupName
                }
            );
            return softwares.OrderBy(x => x.SoftwareName).ToList();
        }

        public async Task<SoftwareDto> GetByIdAsync(int id)
        {
            var software = await _unitOfWork.Softwares.FirstOrDefaultAsync(x => x.Id == id, x => x.SoftwareGroup);
            software.OrThrowNotFound("Phần mềm", id);

            return new SoftwareDto
            {
                Id = software.Id,
                SoftwareCode = software.SoftwareCode,
                SoftwareName = software.SoftwareName,
                SoftwareType = software.SoftwareType,
                Publisher = software.Publisher,
                SoftwareQuantity = software.SoftwareQuantity,
                SoftwarePriority = software.SoftwarePriority,
                SoftwareGroupId = software.SoftwareGroupId,
                SoftwareGroupName = software.SoftwareGroup.GroupName
            };
        }

        public async Task<SoftwareDto> CreateAsync(CreateSoftwareDto request)
        {
            var codeExists = await _unitOfWork.Softwares.FirstOrDefaultAsync(x => x.SoftwareCode == request.SoftwareCode && !x.IsDeleted);
            if (codeExists != null) throw new DomainException($"Mã phần mềm '{request.SoftwareCode}' đã tồn tại.");

            var softwareGroup = await _unitOfWork.SoftwareGroups.GetByIdAsync(request.SoftwareGroupId);
            softwareGroup.OrThrowNotFound("Nhóm phần mềm", request.SoftwareGroupId);

            var newSoftware = new Software
            {
                SoftwareCode = request.SoftwareCode,
                SoftwareName = request.SoftwareName,
                SoftwareType = request.SoftwareType,
                Publisher = request.Publisher,
                SoftwareQuantity = request.SoftwareQuantity,
                SoftwarePriority = request.SoftwarePriority,
                SoftwareGroupId = request.SoftwareGroupId,
                IsDeleted = false
            };

            await _unitOfWork.Softwares.AddAsync(newSoftware);
            await _unitOfWork.SaveChangesAsync();

            return new SoftwareDto
            {
                Id = newSoftware.Id,
                SoftwareCode = newSoftware.SoftwareCode,
                SoftwareName = newSoftware.SoftwareName,
                SoftwareType = newSoftware.SoftwareType,
                Publisher = newSoftware.Publisher,
                SoftwareQuantity = newSoftware.SoftwareQuantity,
                SoftwarePriority = newSoftware.SoftwarePriority,
                SoftwareGroupId = newSoftware.SoftwareGroupId,
                SoftwareGroupName = softwareGroup.GroupName
            };
        }

        public async Task UpdateAsync(UpdateSoftwareDto request)
        {
            var software = await _unitOfWork.Softwares.GetByIdAsync(request.Id);
            software.OrThrowNotFound("Phần mềm", request.Id);

            if (software.SoftwareCode != request.SoftwareCode)
            {
                var codeExists = await _unitOfWork.Softwares.FirstOrDefaultAsync(x => x.SoftwareCode == request.SoftwareCode && !x.IsDeleted);
                if (codeExists != null) throw new DomainException($"Mã phần mềm '{request.SoftwareCode}' đã tồn tại.");
            }

            if (software.SoftwareGroupId != request.SoftwareGroupId)
            {
                var softwareGroup = await _unitOfWork.SoftwareGroups.GetByIdAsync(request.SoftwareGroupId);
                softwareGroup.OrThrowNotFound("Nhóm phần mềm", request.SoftwareGroupId);
            }

            software.SoftwareCode = request.SoftwareCode;
            software.SoftwareName = request.SoftwareName;
            software.SoftwareType = request.SoftwareType;
            software.Publisher = request.Publisher;
            software.SoftwareQuantity = request.SoftwareQuantity;
            software.SoftwarePriority = request.SoftwarePriority;
            software.SoftwareGroupId = request.SoftwareGroupId;

            _unitOfWork.Softwares.Update(software);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var software = await _unitOfWork.Softwares.GetByIdAsync(id);
            software.OrThrowNotFound("Phần mềm", id);

            software.IsDeleted = true;

            _unitOfWork.Softwares.Update(software);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
