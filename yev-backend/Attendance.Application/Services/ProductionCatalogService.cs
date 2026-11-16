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
                case ProductionCatalogKind.Task:
                    var tasks = _unitOfWork.ProductionTasks.GetQueryable(false).Where(x => !x.IsDeleted
                        && (workshopId == null || x.WorkshopId == workshopId)
                        && (search == null || x.Code.Contains(search)));
                    return _unitOfWork.ProductionTasks.ToPagedResponseAsync(tasks.OrderBy(x => x.Workshop.WorkshopCode).ThenBy(x => x.Code), pageIndex, pageSize, x => new ProductionCatalogItemDto
                    {
                        Id = x.Id,
                        Code = x.Code,
                        WorkshopId = x.WorkshopId,
                        WorkshopCode = x.Workshop.WorkshopCode,
                        StaffKind = x.StaffKind,
                        EmployeeCount = x.Workshop.Groups.SelectMany(g => g.Employees).Count(e => !e.IsDeleted && e.TaskName == x.Code)
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
                case ProductionCatalogKind.Task:
                    await _unitOfWork.ProductionTasks.AddAsync(new ProductionTask { Code = code, WorkshopId = request.WorkshopId!.Value, StaffKind = request.StaffKind! });
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
                    var lineRenamed = line.LineCode != code;
                    line.LineCode = code;
                    ApplyLine(line, request);
                    _unitOfWork.ProductionLines.Update(line);
                    if (lineRenamed)
                    {
                        await _unitOfWork.SaveChangesAsync();
                        await GroupLineDefaults.RefreshCodesAsync(_unitOfWork, x => !x.IsDeleted && x.GroupLines.Any(l => l.ProductionLineId == id));
                    }
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
                case ProductionCatalogKind.Task:
                    var task = await FindTaskAsync(id);
                    var holders = await TaskHoldersAsync(task);
                    if (holders.Count > 0 && (task.WorkshopId != request.WorkshopId || task.StaffKind != request.StaffKind))
                        throw new DomainException("Công việc còn nhân viên đang làm, không thể đổi Xưởng hoặc TT/GT — chuyển họ sang Công việc khác trước.");
                    // Employees store the code, so a rename carries over to them.
                    foreach (var holder in holders) holder.TaskName = code;
                    task.Code = code;
                    task.WorkshopId = request.WorkshopId!.Value;
                    task.StaffKind = request.StaffKind!;
                    _unitOfWork.ProductionTasks.Update(task);
                    break;
                default:
                    var shiftTeam = await FindShiftTeamAsync(id);
                    var shiftRenamed = shiftTeam.Code != code;
                    shiftTeam.Code = code;
                    shiftTeam.NameVn = Clean(request.NameVn);
                    _unitOfWork.ProductionShiftTeams.Update(shiftTeam);
                    if (shiftRenamed)
                    {
                        await _unitOfWork.SaveChangesAsync();
                        await GroupLineDefaults.RefreshCodesAsync(_unitOfWork, x => !x.IsDeleted && x.GroupLines.Any(l => l.ShiftTeamId == id));
                    }
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
                case ProductionCatalogKind.Task:
                    var task = await FindTaskAsync(id);
                    if ((await TaskHoldersAsync(task)).Count > 0)
                        throw new DomainException("Công việc còn nhân viên đang làm, không thể xóa.");
                    task.IsDeleted = true;
                    _unitOfWork.ProductionTasks.Update(task);
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

        private async Task<ProductionTask> FindTaskAsync(int id)
        {
            var task = await _unitOfWork.ProductionTasks.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            task.OrThrowNotFound("Công việc", id);
            return task!;
        }

        private async Task<List<Employee>> TaskHoldersAsync(ProductionTask task) =>
            (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && x.TaskName == task.Code && x.Group != null && x.Group.WorkshopId == task.WorkshopId)).ToList();

        private async Task<ProductionShiftTeam> FindShiftTeamAsync(int id)
        {
            var shiftTeam = await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            shiftTeam.OrThrowNotFound("Nhóm ca", id);
            return shiftTeam!;
        }

        private async Task<string> ValidateAsync(ProductionCatalogKind kind, SaveProductionCatalogItemDto request, int? id)
        {
            var code = Clean(request.Code) ?? throw new DomainException("Mã không được để trống.");
            var isLongCode = kind is ProductionCatalogKind.Line or ProductionCatalogKind.Task;
            if (!isLongCode && code.Length > ShortCodeMaxLength)
                throw new DomainException($"Mã tối đa {ShortCodeMaxLength} ký tự.");
            if (isLongCode && code.Length > 50)
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
                ProductionCatalogKind.Task => await _unitOfWork.ProductionTasks.FirstOrDefaultAsync(x => x.Code == code && x.WorkshopId == request.WorkshopId && !x.IsDeleted && x.Id != id) != null,
                _ => await _unitOfWork.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Code == code && !x.IsDeleted && x.Id != id) != null
            };
            if (isDuplicate) throw new DomainException($"Mã '{code}' đã tồn tại{(kind == ProductionCatalogKind.ShiftTeam ? "" : " trong xưởng này")}.");

            if (kind == ProductionCatalogKind.Task)
            {
                request.StaffKind = StaffKinds.Normalize(request.StaffKind);
                if (request.StaffKind != StaffKinds.Direct && request.StaffKind != StaffKinds.Indirect)
                    throw new DomainException("Chưa chọn TT/GT.");
            }

            if (kind == ProductionCatalogKind.Line)
            {
                // No team chosen: the workshop's GT A placeholder, until the line owners fill the real one.
                request.TeamId ??= (await _unitOfWork.ProductionTeams.FirstOrDefaultAsync(x => x.WorkshopId == request.WorkshopId && x.Code == GroupLineDefaults.FallbackCode && !x.IsDeleted))?.Id;
                if (request.TeamId.HasValue && (await FindTeamAsync(request.TeamId.Value)).WorkshopId != request.WorkshopId)
                    throw new DomainException("Team phải cùng Xưởng với Line.");
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
        }
    }
}
