using Attendance.Application.Dtos.ProductionCatalogs;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class ProductionCatalogService : BaseService<IAttendanceUnitOfWork>, IProductionCatalogService
    {
        private const int ShortCodeMaxLength = 20;

        public ProductionCatalogService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        public Task<PagedResponse<ProductionCatalogItemDto>> GetPagedAsync(ProductionCatalogKind kind, int pageIndex, int pageSize, string? keyword, int? teamId)
        {
            var search = Clean(keyword);
            switch (kind)
            {
                case ProductionCatalogKind.Line:
                    var lines = _unitOfWork.ProductionLines.GetQueryable(false).Where(x => !x.IsDeleted
                        && (teamId == null || x.TeamId == teamId)
                        && (search == null || x.LineCode.Contains(search) || (x.CongDoan != null && x.CongDoan.Contains(search))));
                    return _unitOfWork.ProductionLines.ToPagedResponseAsync(lines.OrderBy(x => x.LineCode), pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.LineCode,
                        TeamId = x.TeamId,
                        TeamCode = x.Team.Code,
                        CongDoan = x.CongDoan,
                        EmployeeCount = x.Employees.Count(e => !e.IsDeleted)
                    });
                case ProductionCatalogKind.Team:
                    var teams = _unitOfWork.ProductionTeams.GetQueryable(false).Where(x => !x.IsDeleted
                        && (search == null || x.Code.Contains(search) || (x.NameVn != null && x.NameVn.Contains(search))));
                    return _unitOfWork.ProductionTeams.ToPagedResponseAsync(teams.OrderBy(x => x.Code), pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.Code,
                        NameVn = x.NameVn,
                        EmployeeCount = x.Employees.Count(e => !e.IsDeleted)
                    });
                default:
                    var shiftTeams = _unitOfWork.ProductionShiftTeams.GetQueryable(false).Where(x => !x.IsDeleted
                        && (search == null || x.Code.Contains(search) || (x.NameVn != null && x.NameVn.Contains(search))));
                    return _unitOfWork.ProductionShiftTeams.ToPagedResponseAsync(shiftTeams.OrderBy(x => x.Code), pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.Code,
                        NameVn = x.NameVn,
                        EmployeeCount = x.Employees.Count(e => !e.IsDeleted)
                    });
            }
        }

        public async Task CreateAsync(ProductionCatalogKind kind, SaveProductionCatalogItemDto request)
        {
            var code = await ValidateAsync(kind, request, null);
            switch (kind)
            {
                case ProductionCatalogKind.Line:
                    await _unitOfWork.ProductionLines.AddAsync(new ProductionLine { LineCode = code, TeamId = request.TeamId!.Value, CongDoan = Clean(request.CongDoan) });
                    break;
                case ProductionCatalogKind.Team:
                    await _unitOfWork.ProductionTeams.AddAsync(new ProductionTeam { Code = code, NameVn = Clean(request.NameVn) });
                    break;
                default:
                    await _unitOfWork.ProductionShiftTeams.AddAsync(new ProductionShiftTeam { Code = code, NameVn = Clean(request.NameVn) });
                    break;
            }
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task UpdateAsync(ProductionCatalogKind kind, int id, SaveProductionCatalogItemDto request)
        {
            var code = await ValidateAsync(kind, request, id);
            switch (kind)
            {
                case ProductionCatalogKind.Line:
                    var line = await FindLineAsync(id);
                    line.LineCode = code;
                    line.TeamId = request.TeamId!.Value;
                    line.CongDoan = Clean(request.CongDoan);
                    _unitOfWork.ProductionLines.Update(line);
                    break;
                case ProductionCatalogKind.Team:
                    var team = await FindTeamAsync(id);
                    team.Code = code;
                    team.NameVn = Clean(request.NameVn);
                    _unitOfWork.ProductionTeams.Update(team);
                    break;
                default:
                    var shiftTeam = await FindShiftTeamAsync(id);
                    shiftTeam.Code = code;
                    shiftTeam.NameVn = Clean(request.NameVn);
                    _unitOfWork.ProductionShiftTeams.Update(shiftTeam);
                    break;
            }
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(ProductionCatalogKind kind, int id)
        {
            switch (kind)
            {
                case ProductionCatalogKind.Line:
                    var line = await FindLineAsync(id);
                    if (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.ProductionLineId == id && !x.IsDeleted) != null)
                        throw new DomainException("Line còn nhân viên đang gán, không thể xóa.");
                    line.IsDeleted = true;
                    _unitOfWork.ProductionLines.Update(line);
                    break;
                case ProductionCatalogKind.Team:
                    var team = await FindTeamAsync(id);
                    if (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.TeamId == id && !x.IsDeleted) != null)
                        throw new DomainException("Team còn nhân viên đang gán, không thể xóa.");
                    if (await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.TeamId == id && !x.IsDeleted) != null)
                        throw new DomainException("Team còn Line đang hoạt động, không thể xóa.");
                    team.IsDeleted = true;
                    _unitOfWork.ProductionTeams.Update(team);
                    break;
                default:
                    var shiftTeam = await FindShiftTeamAsync(id);
                    if (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.ShiftTeamId == id && !x.IsDeleted) != null)
                        throw new DomainException("Nhóm ca còn nhân viên đang gán, không thể xóa.");
                    shiftTeam.IsDeleted = true;
                    _unitOfWork.ProductionShiftTeams.Update(shiftTeam);
                    break;
            }
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<ProductionLine> FindLineAsync(int id)
        {
            var line = await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            line.OrThrowNotFound("Line", id);
            return line!;
        }

        private async Task<ProductionTeam> FindTeamAsync(int id)
        {
            var team = await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            team.OrThrowNotFound("Team", id);
            return team!;
        }

        private async Task<ProductionShiftTeam> FindShiftTeamAsync(int id)
        {
            var shiftTeam = await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            shiftTeam.OrThrowNotFound("Nhóm ca", id);
            return shiftTeam!;
        }

        private async Task<string> ValidateAsync(ProductionCatalogKind kind, SaveProductionCatalogItemDto request, int? id)
        {
            var code = Clean(request.Code) ?? throw new DomainException("Mã không được để trống.");
            if (kind != ProductionCatalogKind.Line && code.Length > ShortCodeMaxLength)
                throw new DomainException($"Mã tối đa {ShortCodeMaxLength} ký tự.");
            if (kind == ProductionCatalogKind.Line && code.Length > 50)
                throw new DomainException("Mã tối đa 50 ký tự.");

            var isDuplicate = kind switch
            {
                ProductionCatalogKind.Line => await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.LineCode == code && !x.IsDeleted && x.Id != id) != null,
                ProductionCatalogKind.Team => await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.Code == code && !x.IsDeleted && x.Id != id) != null,
                _ => await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Code == code && !x.IsDeleted && x.Id != id) != null
            };
            if (isDuplicate) throw new DomainException($"Mã '{code}' đã tồn tại.");

            // The import always reads these file values as Team 1/2, so a team with such a code could never be assigned.
            if (kind == ProductionCatalogKind.Team && EmployeeImportService.TeamCodeTranslation.TryGetValue(code, out var mapped))
                throw new DomainException($"Mã '{code}' đang được file import hiểu là Team {mapped}, hãy dùng mã khác.");

            if (kind == ProductionCatalogKind.Line)
            {
                if (request.TeamId == null) throw new DomainException("Line phải thuộc một Team.");
                await FindTeamAsync(request.TeamId.Value);
            }
            return code;
        }
    }
}
