using Attendance.Application.Dtos.ProductionCatalogs;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
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

        public Task<PagedResponse<ProductionCatalogItemDto>> GetPagedAsync(ProductionCatalogKind kind, int pageIndex, int pageSize, string? keyword, int? teamId, int? workshopId = null)
        {
            var search = Clean(keyword);
            switch (kind)
            {
                case ProductionCatalogKind.Line:
                    var lines = _unitOfWork.ProductionLines.GetQueryable(false).Where(x => !x.IsDeleted
                        && (teamId == null || x.TeamId == teamId)
                        && (workshopId == null || x.WorkshopId == workshopId)
                        && (search == null || x.LineCode.Contains(search) || (x.CongDoan != null && x.CongDoan.Contains(search))));
                    var orderedLines = lines.OrderBy(x => x.Workshop.WorkshopCode).ThenBy(x => x.SortCode ?? x.LineCode);
                    return _unitOfWork.ProductionLines.ToPagedResponseAsync(orderedLines, pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.LineCode,
                        WorkshopId = x.WorkshopId,
                        WorkshopCode = x.Workshop.WorkshopCode,
                        TeamId = x.TeamId,
                        TeamCode = x.Team != null ? x.Team.Code : null,
                        CongDoan = x.CongDoan,
                        CdMae = x.CdMae,
                        SortCode = x.SortCode,
                        HasDirectStaff = x.HasDirectStaff,
                        HasIndirectStaff = x.HasIndirectStaff,
                        EmployeeCount = x.Employees.Count(e => !e.IsDeleted)
                    });
                case ProductionCatalogKind.Team:
                    var teams = _unitOfWork.ProductionTeams.GetQueryable(false).Where(x => !x.IsDeleted
                        && (workshopId == null || x.WorkshopId == workshopId)
                        && (search == null || x.Code.Contains(search) || (x.NameVn != null && x.NameVn.Contains(search))));
                    return _unitOfWork.ProductionTeams.ToPagedResponseAsync(teams.OrderBy(x => x.Workshop.WorkshopCode).ThenBy(x => x.Code), pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.Code,
                        NameVn = x.NameVn,
                        WorkshopId = x.WorkshopId,
                        WorkshopCode = x.Workshop.WorkshopCode,
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
                    var newLine = new ProductionLine { LineCode = code };
                    ApplyLine(newLine, request);
                    await _unitOfWork.ProductionLines.AddAsync(newLine);
                    break;
                case ProductionCatalogKind.Team:
                    await _unitOfWork.ProductionTeams.AddAsync(new ProductionTeam { Code = code, NameVn = Clean(request.NameVn), WorkshopId = request.WorkshopId!.Value });
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
                    if (line.WorkshopId != request.WorkshopId && await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.ProductionLineId == id && !x.IsDeleted) != null)
                        throw new DomainException("Line còn nhân viên đang gán, không thể đổi Xưởng.");
                    line.LineCode = code;
                    ApplyLine(line, request);
                    _unitOfWork.ProductionLines.Update(line);
                    break;
                case ProductionCatalogKind.Team:
                    var team = await FindTeamAsync(id);
                    if (team.WorkshopId != request.WorkshopId && await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.TeamId == id && !x.IsDeleted) != null)
                        throw new DomainException("Team còn Line đang hoạt động, không thể đổi Xưởng.");
                    team.Code = code;
                    team.NameVn = Clean(request.NameVn);
                    team.WorkshopId = request.WorkshopId!.Value;
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
                    if (await _unitOfWork.Groups.FirstOrDefaultAsync(x => !x.IsDeleted && x.GroupLines.Any(l => l.ProductionLineId == id)) != null)
                        throw new DomainException("Line còn Nhóm đang gắn, không thể xóa.");
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

            if (kind != ProductionCatalogKind.ShiftTeam)
            {
                if (request.WorkshopId == null) throw new DomainException("Chưa chọn Xưởng.");
                (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == request.WorkshopId && !x.IsDeleted)).OrThrowNotFound("Xưởng", request.WorkshopId.Value);
            }

            var isDuplicate = kind switch
            {
                ProductionCatalogKind.Line => await _unitOfWork.ProductionLines.FirstOrDefaultAsync(x => x.LineCode == code && x.WorkshopId == request.WorkshopId && !x.IsDeleted && x.Id != id) != null,
                ProductionCatalogKind.Team => await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.Code == code && x.WorkshopId == request.WorkshopId && !x.IsDeleted && x.Id != id) != null,
                _ => await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Code == code && !x.IsDeleted && x.Id != id) != null
            };
            if (isDuplicate) throw new DomainException($"Mã '{code}' đã tồn tại{(kind == ProductionCatalogKind.ShiftTeam ? "" : " trong xưởng này")}.");

            if (kind == ProductionCatalogKind.Line)
            {
                // No team chosen: the workshop's GT A placeholder, until the line owners fill the real one.
                request.TeamId ??= (await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.WorkshopId == request.WorkshopId && x.Code == GroupLineDefaults.FallbackCode && !x.IsDeleted))?.Id;
                if (request.TeamId.HasValue && (await FindTeamAsync(request.TeamId.Value)).WorkshopId != request.WorkshopId)
                    throw new DomainException("Team phải cùng Xưởng với Line.");
                if (!request.HasDirectStaff && !request.HasIndirectStaff)
                    throw new DomainException("Line phải có nhân sự TT hoặc GT.");
                // Turning a kind off would strand people or groups of that kind on a line that no longer has it.
                if (id.HasValue)
                {
                    var removedKinds = new List<string>();
                    if (!request.HasDirectStaff) removedKinds.Add(StaffKinds.Direct);
                    if (!request.HasIndirectStaff) removedKinds.Add(StaffKinds.Indirect);
                    if (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.ProductionLineId == id && !x.IsDeleted && removedKinds.Contains(x.StaffKind!)) != null
                        || await _unitOfWork.Groups.FirstOrDefaultAsync(x => !x.IsDeleted && removedKinds.Contains(x.LineKind!) && x.GroupLines.Any(l => l.ProductionLineId == id)) != null)
                        throw new DomainException($"Line còn nhân viên hoặc Nhóm loại {string.Join("/", removedKinds)}, không thể bỏ loại đó.");
                }
            }
            return code;
        }

        private static void ApplyLine(ProductionLine line, SaveProductionCatalogItemDto request)
        {
            line.WorkshopId = request.WorkshopId!.Value;
            line.TeamId = request.TeamId;
            line.CongDoan = Clean(request.CongDoan);
            line.CdMae = Clean(request.CdMae);
            line.SortCode = Clean(request.SortCode);
            line.HasDirectStaff = request.HasDirectStaff;
            line.HasIndirectStaff = request.HasIndirectStaff;
        }
    }
}
