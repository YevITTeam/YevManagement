using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.FormDataSources;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;
using Workflow.Domain.Enums;

namespace Workflow.Application.Services
{
    public class FormDataSourceService : BaseService<IWorkflowUnitOfWork>, IFormDataSourceService
    {
        public FormDataSourceService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<FormDataSourceDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.FormDataSources.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.NameVn.Contains(keyword));
            }

            return await _unitOfWork.FormDataSources.ToPagedResponseAsync(
                query.OrderBy(x => x.Code),
                pageIndex,
                pageSize,
                x => new FormDataSourceDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    SourceKind = x.SourceKind,
                    ConnectionName = x.ConnectionName,
                    SqlText = x.SqlText,
                    ValueColumn = x.ValueColumn,
                    DisplayColumn = x.DisplayColumn,
                    FilterJson = x.FilterJson
                }
            );
        }

        public async Task<List<FormDataSourceDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.FormDataSources.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new FormDataSourceDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    SourceKind = x.SourceKind,
                    ConnectionName = x.ConnectionName,
                    SqlText = x.SqlText,
                    ValueColumn = x.ValueColumn,
                    DisplayColumn = x.DisplayColumn,
                    FilterJson = x.FilterJson
                });
            return items.OrderBy(x => x.Code).ToList();
        }

        public async Task<FormDataSourceDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.FormDataSources.GetByIdAsync(id)).OrThrowNotFound("Nguồn dữ liệu", id);
            return ToDto(entity);
        }

        public async Task<FormDataSourceDto> CreateAsync(CreateFormDataSourceDto request)
        {
            GuardSourceKindSupported(request.SourceKind);

            var exists = await _unitOfWork.FormDataSources.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã nguồn dữ liệu", request.Code, x => x.IsDeleted);

            var entity = new FormDataSource
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                SourceKind = request.SourceKind,
                ConnectionName = request.ConnectionName,
                SqlText = request.SqlText,
                ValueColumn = request.ValueColumn,
                DisplayColumn = request.DisplayColumn,
                FilterJson = request.FilterJson,
                IsDeleted = false
            };

            await _unitOfWork.FormDataSources.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(entity);
        }

        public async Task UpdateAsync(UpdateFormDataSourceDto request)
        {
            GuardSourceKindSupported(request.SourceKind);

            var entity = (await _unitOfWork.FormDataSources.GetByIdAsync(request.Id)).OrThrowNotFound("Nguồn dữ liệu", request.Id);

            var exists = await _unitOfWork.FormDataSources.FirstOrDefaultAsync(
                x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã nguồn dữ liệu", request.Code, x => x.IsDeleted);

            entity.Code = request.Code;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;
            entity.SourceKind = request.SourceKind;
            entity.ConnectionName = request.ConnectionName;
            entity.SqlText = request.SqlText;
            entity.ValueColumn = request.ValueColumn;
            entity.DisplayColumn = request.DisplayColumn;
            entity.FilterJson = request.FilterJson;

            _unitOfWork.FormDataSources.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.FormDataSources.GetByIdAsync(id)).OrThrowNotFound("Nguồn dữ liệu", id);

            // FormFields chưa scaffold ở Pha 2A (workflow-module.md §8 Pha 2C) — chưa có gì để check
            // "còn ô nhập nào đang dùng nguồn này" ở đây. Bổ sung guard này khi FormFields có.
            entity.IsDeleted = true;

            _unitOfWork.FormDataSources.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        // workflow-module.md §3.2 FormDataSources: SqlText chạy bằng tài khoản DB chỉ đọc, chặn từ
        // khoá ghi, có timeout — cơ chế này chưa được chốt/triển khai, nên SqlQuery bị chặn tạo/sửa
        // cho tới Pha sau. Chỉ 3 loại built-in được dùng ở Pha 2A.
        private static void GuardSourceKindSupported(DataSourceKind sourceKind)
        {
            if (sourceKind == DataSourceKind.SqlQuery)
                throw new DomainException("Loại nguồn dữ liệu \"Truy vấn SQL tuỳ chỉnh\" chưa được hỗ trợ ở giai đoạn này.");
        }

        private static FormDataSourceDto ToDto(FormDataSource x) => new()
        {
            Id = x.Id,
            Code = x.Code,
            NameVn = x.NameVn,
            NameJp = x.NameJp,
            SourceKind = x.SourceKind,
            ConnectionName = x.ConnectionName,
            SqlText = x.SqlText,
            ValueColumn = x.ValueColumn,
            DisplayColumn = x.DisplayColumn,
            FilterJson = x.FilterJson
        };
    }
}
