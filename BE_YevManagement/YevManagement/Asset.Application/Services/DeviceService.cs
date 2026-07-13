using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceService : BaseService<IAssetUnitOfWork>, IDeviceService
    {
        private readonly IDeviceConfigurationService _deviceConfigurationService;
        private readonly IDeviceSoftwareService _deviceSoftwareService;

        public DeviceService(
            IAssetUnitOfWork unitOfWork,
            IDeviceConfigurationService deviceConfigurationService,
            IDeviceSoftwareService deviceSoftwareService) : base(unitOfWork)
        {
            _deviceConfigurationService = deviceConfigurationService;
            _deviceSoftwareService = deviceSoftwareService;
        }

        public async Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request)
        {
            var query = _unitOfWork.Devices.GetQueryable(
                false,
                d => d.Branch,
                d => d.Supplier,
                d => d.DeviceType,
                d => d.DeviceGroup!,
                d => d.DeviceDepartment!);

            query = query.Where(d => !d.IsDeleted);

            if (request.GroupId.HasValue)
            {
                query = query.Where(d => d.GroupId == request.GroupId.Value);
            }

            if (request.DepartmentId.HasValue)
            {
                query = query.Where(d => d.DepartmentId == request.DepartmentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.DeviceCode))
            {
                // 2026-07-11: đổi từ StartsWith sang Contains — chỉ cần chứa từ khoá ở bất
                // kỳ vị trí nào trong mã thiết bị là ra kết quả, không bắt buộc gõ đúng từ
                // đầu (đồng nhất với Note/SerialNumber/IpAddress/Email đã Contains sẵn).
                query = query.Where(d => d.DeviceCode.Contains(request.DeviceCode));
            }

            if (!string.IsNullOrWhiteSpace(request.Manager))
            {
                query = query.Where(d => d.Manager.Contains(request.Manager));
            }

            if (!string.IsNullOrWhiteSpace(request.SupplierName))
            {
                query = query.Where(d => d.Supplier.SupplierName.Contains(request.SupplierName));
            }

            if (!string.IsNullOrWhiteSpace(request.PurchaseDate))
            {
                query = query.Where(d => d.PurchaseDate.ToString().Contains(request.PurchaseDate));
            }

            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                query = query.Where(d => d.Note != null && d.Note.Contains(request.Note));
            }

            if (request.IsOutsourced.HasValue)
            {
                query = query.Where(d => d.IsOutsourced == request.IsOutsourced.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                query = query.Where(d => d.SerialNumber != null && d.SerialNumber.Contains(request.SerialNumber));
            }

            if (request.IsUseUsb.HasValue)
            {
                query = query.Where(d => d.IsUseUsb == request.IsUseUsb.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.IpAddress))
            {
                query = query.Where(d => d.IpAddresses.Any(ip => !ip.IsDeleted && ip.IpAddress1.Contains(request.IpAddress)));
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                query = query.Where(d => d.DeviceEmails.Any(e => !e.IsDeleted && e.Email.Contains(request.Email)));
            }

            var orderedQuery = request.SortDeviceCodeAscending.HasValue
                ? (request.SortDeviceCodeAscending.Value
                    ? query.OrderBy(d => d.DeviceCode)
                    : query.OrderByDescending(d => d.DeviceCode))
                : query.OrderByDescending(d => d.PurchaseDate);

            return await _unitOfWork.Devices.ToPagedResponseAsync(
                orderedQuery,
                request.PageIndex,
                request.PageSize,
                d => new DeviceGridDto
                {
                    Id = d.Id,
                    DeviceCode = d.DeviceCode,
                    DeviceName = d.DeviceName,
                    BranchName = d.Branch.BranchName,
                    SupplierName = d.Supplier.SupplierName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    GroupName = d.DeviceGroup != null ? d.DeviceGroup.GroupName : null,
                    DepartmentName = d.DeviceDepartment != null ? d.DeviceDepartment.DepartmentName : null,
                    IpAddresses = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList(),
                    PurchaseDate = d.PurchaseDate,
                    ExpirationDate = d.ExpirationDate,
                    Manager = d.Manager,
                    Note = d.Note,
                    Emails = d.DeviceEmails.Where(e => !e.IsDeleted).Select(e => e.Email).ToList(),
                    IsOutsourced = d.IsOutsourced,
                    SerialNumber = d.SerialNumber,
                    IsUseUsb = d.IsUseUsb,
                    Status = d.Status,
                    // Lặp lại logic của GetStatusText tại đây (không gọi method) vì đây là
                    // Expression<Func<>> được EF dịch sang SQL, không hỗ trợ gọi method C# tuỳ ý.
                    StatusText = d.Status == (int)DeviceStatus.PendingUse ? "Chờ sử dụng"
                        : d.Status == (int)DeviceStatus.InUse ? "Đang sử dụng"
                        : d.Status == (int)DeviceStatus.PendingLiquidation ? "Chờ thanh lý"
                        : d.Status == (int)DeviceStatus.Liquidated ? "Đã thanh lý"
                        : "Không xác định"
                }
            );
        }

        public async Task<List<DeviceGridDto>> GetAvailableForTransferAsync(string? keyword)
        {
            var query = _unitOfWork.Devices.GetQueryable(
                false,
                d => d.Branch,
                d => d.Supplier,
                d => d.DeviceType,
                d => d.DeviceGroup!,
                d => d.DeviceDepartment!);

            query = query.Where(d => !d.IsDeleted && d.Status == (int)DeviceStatus.PendingUse);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(d => d.DeviceCode.Contains(keyword));
            }

            return await _unitOfWork.Devices.ToListAsync(
                query.OrderBy(d => d.DeviceCode),
                d => new DeviceGridDto
                {
                    Id = d.Id,
                    DeviceCode = d.DeviceCode,
                    DeviceName = d.DeviceName,
                    BranchName = d.Branch.BranchName,
                    SupplierName = d.Supplier.SupplierName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    GroupName = d.DeviceGroup != null ? d.DeviceGroup.GroupName : null,
                    DepartmentName = d.DeviceDepartment != null ? d.DeviceDepartment.DepartmentName : null,
                    IpAddresses = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList(),
                    PurchaseDate = d.PurchaseDate,
                    ExpirationDate = d.ExpirationDate,
                    Manager = d.Manager,
                    Note = d.Note,
                    Emails = d.DeviceEmails.Where(e => !e.IsDeleted).Select(e => e.Email).ToList(),
                    IsOutsourced = d.IsOutsourced,
                    SerialNumber = d.SerialNumber,
                    IsUseUsb = d.IsUseUsb,
                    Status = d.Status,
                    StatusText = d.Status == (int)DeviceStatus.PendingUse ? "Chờ sử dụng"
                        : d.Status == (int)DeviceStatus.InUse ? "Đang sử dụng"
                        : d.Status == (int)DeviceStatus.PendingLiquidation ? "Chờ thanh lý"
                        : d.Status == (int)DeviceStatus.Liquidated ? "Đã thanh lý"
                        : "Không xác định"
                });
        }

        public async Task<List<DeviceReportItemDto>> GetReportListAsync(DeviceReportFilterRequest request)
        {
            var query = _unitOfWork.Devices.GetQueryable(false, d => d.IpAddresses)
                .Where(d => !d.IsDeleted);

            if (request.DeviceTypeId.HasValue)
                query = query.Where(d => d.DeviceTypeId == request.DeviceTypeId.Value);

            if (request.BranchId.HasValue)
                query = query.Where(d => d.BranchId == request.BranchId.Value);

            if (!string.IsNullOrWhiteSpace(request.Keyword))
                query = query.Where(d => d.DeviceCode.Contains(request.Keyword) || d.DeviceName.Contains(request.Keyword));

            var today = TimeHelper.GetCurrentUtcTime().Date;

            // Select the raw list of Ip strings first (translatable collection projection),
            // then join into a display string in-memory below — string.Join over a subquery
            // is not reliably translatable across providers.
            var rawItems = await _unitOfWork.Devices.ToListAsync(
                query.OrderBy(d => d.DeviceCode),
                d => new
                {
                    d.DeviceCode,
                    d.DeviceName,
                    IpAddresses = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList(),
                    d.PurchaseDate,
                    d.ExpirationDate,
                    d.Note
                });

            var items = rawItems.Select(d => new DeviceReportItemDto
            {
                DeviceCode = d.DeviceCode,
                DeviceName = d.DeviceName,
                IpAddress = d.IpAddresses.Count > 0 ? string.Join(", ", d.IpAddresses) : null,
                PurchaseDate = d.PurchaseDate,
                ExpirationDate = d.ExpirationDate,
                Note = d.Note,
                IsExpired = d.ExpirationDate.HasValue && d.ExpirationDate.Value < today,
                // Kỳ tài chính Yazaki: năm tài chính chạy 1/7 - 30/6, đánh số liên tục từ
                // năm thành lập Yazaki Corporation (1941) -> kỳ = năm bắt đầu FY - 1940.
                FinancialPeriod = d.ExpirationDate.HasValue
                    ? (d.ExpirationDate.Value.Month >= 7 ? d.ExpirationDate.Value.Year : d.ExpirationDate.Value.Year - 1) - 1940
                    : (int?)null
            }).ToList();

            for (int i = 0; i < items.Count; i++)
            {
                items[i].Stt = i + 1;
            }

            return items;
        }

        public async Task<DeviceDto> GetByIdAsync(int id)
        {
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == id, x => x.Branch, x => x.DeviceType, x => x.Supplier, x => x.ReplacesOldDevice!, x => x.DeviceGroup!, x => x.DeviceDepartment!);
            device.OrThrowNotFound("Thiết bị", id);

            var ipAddresses = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == id && !x.IsDeleted);

            return MapToDto(device, ipAddresses, emails);
        }

        public async Task<DeviceDetailDto> GetDetailAsync(int id)
        {
            var device = await GetByIdAsync(id);
            var configuration = await _deviceConfigurationService.GetByDeviceIdAsync(id);
            var softwares = await _deviceSoftwareService.GetByDeviceIdAsync(id);

            return new DeviceDetailDto
            {
                Device = device,
                Configuration = configuration,
                Softwares = softwares
            };
        }

        public async Task<DeviceDto> CreateAsync(CreateDeviceDto request)
        {
            var codeExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == request.DeviceCode);
            if (codeExists != null) throw new DomainException($"Mã thiết bị '{request.DeviceCode}' đã tồn tại.");

            if (!string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                var serialExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == request.SerialNumber);
                if (serialExists != null) throw new DomainException($"Số Serial '{request.SerialNumber}' đã tồn tại.");
            }

            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId);
            deviceType.OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId);
            supplier.OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = await _unitOfWork.Branches.GetByIdAsync(request.BranchId);
            branch.OrThrowNotFound("Chi nhánh", request.BranchId);

            var group = await ValidateGroupIdAsync(request.GroupId);
            var department = await ValidateDepartmentIdAsync(request.DepartmentId);

            var replacesOldDevice = await ValidateReplacesOldDeviceIdAsync(request.ReplacesOldDeviceId, currentDeviceId: null);

            var ipAddresses = await ResolveAndValidateIpAddressesAsync(request.IpAddressIds);

            var newDevice = new Device
            {
                DeviceCode = request.DeviceCode,
                DeviceName = request.DeviceName,
                DeviceTypeId = request.DeviceTypeId,
                SupplierId = request.SupplierId,
                BranchId = request.BranchId,
                GroupId = request.GroupId,
                DepartmentId = request.DepartmentId,
                Manager = request.Manager,
                PurchaseDate = request.PurchaseDate,
                DepreciationMonths = request.DepreciationMonths,
                ExpirationDate = request.PurchaseDate.AddMonths(request.DepreciationMonths),
                IsOutsourced = request.IsOutsourced,
                Status = request.Status,
                Note = request.Note,
                SerialNumber = request.SerialNumber,
                IsUseUsb = request.IsUseUsb,
                ReplacesOldDeviceId = request.ReplacesOldDeviceId,
                IsDeleted = false
            };

            await _unitOfWork.Devices.AddAsync(newDevice);
            await _unitOfWork.SaveChangesAsync();

            foreach (var ip in ipAddresses)
            {
                ip.DeviceId = newDevice.Id;
                ip.Status = (int)IpAddressStatus.Assigned;
                _unitOfWork.IpAddresses.Update(ip);
            }

            var emails = new List<DeviceEmail>();
            foreach (var emailInput in request.Emails)
            {
                var email = new DeviceEmail
                {
                    DeviceId = newDevice.Id,
                    Email = emailInput.Email.Trim(),
                    Note = emailInput.Note,
                    IsDeleted = false
                };
                emails.Add(email);
                await _unitOfWork.DeviceEmails.AddAsync(email);
            }

            await _unitOfWork.SaveChangesAsync();

            newDevice.Branch = branch;
            newDevice.DeviceType = deviceType;
            newDevice.Supplier = supplier;
            newDevice.ReplacesOldDevice = replacesOldDevice;
            newDevice.DeviceGroup = group;
            newDevice.DeviceDepartment = department;
            return MapToDto(newDevice, ipAddresses, emails);
        }

        public async Task UpdateAsync(UpdateDeviceDto request)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(request.Id);
            device.OrThrowNotFound("Thiết bị", request.Id);

            if (device.DeviceCode != request.DeviceCode)
            {
                var codeExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == request.DeviceCode);
                if (codeExists != null) throw new DomainException($"Mã thiết bị '{request.DeviceCode}' đã tồn tại.");
            }

            if (!string.IsNullOrWhiteSpace(request.SerialNumber) && device.SerialNumber != request.SerialNumber)
            {
                var serialExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == request.SerialNumber);
                if (serialExists != null) throw new DomainException($"Số Serial '{request.SerialNumber}' đã tồn tại.");
            }

            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId);
            deviceType.OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId);
            supplier.OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = await _unitOfWork.Branches.GetByIdAsync(request.BranchId);
            branch.OrThrowNotFound("Chi nhánh", request.BranchId);

            await ValidateGroupIdAsync(request.GroupId);
            await ValidateDepartmentIdAsync(request.DepartmentId);

            await ValidateReplacesOldDeviceIdAsync(request.ReplacesOldDeviceId, currentDeviceId: device!.Id);

            await SyncIpAddressesAsync(device.Id, request.IpAddressIds);
            await SyncEmailsAsync(device.Id, request.Emails);

            device.DeviceCode = request.DeviceCode;
            device.DeviceName = request.DeviceName;
            device.DeviceTypeId = request.DeviceTypeId;
            device.SupplierId = request.SupplierId;
            device.BranchId = request.BranchId;
            device.GroupId = request.GroupId;
            device.DepartmentId = request.DepartmentId;
            device.Manager = request.Manager;
            device.PurchaseDate = request.PurchaseDate;
            device.DepreciationMonths = request.DepreciationMonths;
            device.ExpirationDate = request.PurchaseDate.AddMonths(request.DepreciationMonths);
            device.IsOutsourced = request.IsOutsourced;
            device.Status = request.Status;
            device.Note = request.Note;
            device.SerialNumber = request.SerialNumber;
            device.IsUseUsb = request.IsUseUsb;
            device.ReplacesOldDeviceId = request.ReplacesOldDeviceId;

            _unitOfWork.Devices.Update(device);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<DeviceReplacementSuggestionDto?> GetReplacementSuggestionAsync(int oldDeviceId)
        {
            var oldDevice = await _unitOfWork.Devices.GetByIdAsync(oldDeviceId);
            oldDevice.OrThrowNotFound("Thiết bị", oldDeviceId);

            // Có thể có nhiều máy cùng khai "MQL Cũ" = máy này qua nhiều lần import khác
            // nhau (theo quyết định người dùng) — chỉ lấy máy import gần nhất (Id lớn nhất)
            // còn Status=PendingUse (chưa được dùng để chuyển máy khác) làm gợi ý duy nhất.
            var candidates = await _unitOfWork.Devices.FindAsync(x =>
                x.ReplacesOldDeviceId == oldDeviceId &&
                x.Status == (int)DeviceStatus.PendingUse &&
                !x.IsDeleted);

            var suggestion = candidates.OrderByDescending(x => x.Id).FirstOrDefault();
            if (suggestion == null) return null;

            return new DeviceReplacementSuggestionDto
            {
                Id = suggestion.Id,
                DeviceCode = suggestion.DeviceCode,
                DeviceName = suggestion.DeviceName
            };
        }

        // Nhóm/Bộ phận đều optional — chỉ validate tồn tại (!IsDeleted) khi client có gửi Id.
        private async Task<DeviceGroup?> ValidateGroupIdAsync(int? groupId)
        {
            if (!groupId.HasValue) return null;

            var group = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(x => x.Id == groupId.Value && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", groupId.Value);
            return group;
        }

        private async Task<DeviceDepartment?> ValidateDepartmentIdAsync(int? departmentId)
        {
            if (!departmentId.HasValue) return null;

            var department = await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(x => x.Id == departmentId.Value && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", departmentId.Value);
            return department;
        }

        // Dùng chung cho Create/Update: nếu có ReplacesOldDeviceId, máy cũ phải tồn tại
        // (!IsDeleted) và không được trỏ vào chính nó (chỉ áp dụng khi Update, currentDeviceId != null).
        // Trả về entity máy cũ (hoặc null nếu không set) để gọi nơi cần gắn navigation ngay.
        private async Task<Device?> ValidateReplacesOldDeviceIdAsync(int? replacesOldDeviceId, int? currentDeviceId)
        {
            if (!replacesOldDeviceId.HasValue) return null;

            if (currentDeviceId.HasValue && replacesOldDeviceId.Value == currentDeviceId.Value)
                throw new DomainException("Thiết bị không thể tự thay thế cho chính nó.");

            var oldDevice = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == replacesOldDeviceId.Value && !x.IsDeleted);
            oldDevice.OrThrowNotFound("Thiết bị cũ (thay thế)", replacesOldDeviceId.Value);
            return oldDevice;
        }

        public async Task DeleteAsync(int id)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(id);
            device.OrThrowNotFound("Thiết bị", id);

            device.IsDeleted = true;
            _unitOfWork.Devices.Update(device);

            var assignedIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            foreach (var ip in assignedIps)
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }

            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            foreach (var email in emails)
            {
                email.IsDeleted = true;
                _unitOfWork.DeviceEmails.Update(email);
            }

            await _unitOfWork.SaveChangesAsync();
        }

        // Xóa MỀM hàng loạt Device (2026-07-13: đổi từ xóa cứng sang xóa mềm — cùng cơ chế
        // với DeleteAsync ở trên, chỉ khác là nhận nhiều Id 1 lần; tránh vướng ràng buộc khóa
        // ngoại của TransferHistory vì xóa mềm chỉ set IsDeleted=true, không đụng khóa chính).
        // Chỉ cho xóa thiết bị đang ở trạng thái Liquidated (Đã thanh lý) — thiết bị chưa
        // thanh lý xóa nhầm sẽ mất dữ liệu đang dùng thật. Không tìm thấy Id hoặc Id chưa
        // thanh lý đều bị bỏ qua (SkippedDevices), không chặn cả batch.
        public async Task<BulkDeleteDeviceResultDto> BulkDeleteAsync(List<int> ids)
        {
            var requestedIds = ids.Distinct().ToList();
            if (requestedIds.Count == 0)
                throw new DomainException("Danh sách thiết bị cần xóa đang trống.");

            var devices = await _unitOfWork.Devices.FindAsync(x => requestedIds.Contains(x.Id) && !x.IsDeleted);
            var foundById = devices.ToDictionary(x => x.Id);

            var result = new BulkDeleteDeviceResultDto();

            foreach (var id in requestedIds.Where(id => !foundById.ContainsKey(id)))
            {
                result.SkippedDevices.Add(new BulkDeleteSkippedDeviceDto { Id = id, DeviceCode = "?", Reason = "Không tìm thấy thiết bị." });
            }

            var notLiquidated = devices.Where(x => x.Status != (int)DeviceStatus.Liquidated).ToList();
            foreach (var device in notLiquidated)
            {
                result.SkippedDevices.Add(new BulkDeleteSkippedDeviceDto
                {
                    Id = device.Id,
                    DeviceCode = device.DeviceCode,
                    Reason = "Chỉ có thể xóa thiết bị đã thanh lý."
                });
            }

            var deletableDevices = devices.Where(x => x.Status == (int)DeviceStatus.Liquidated).ToList();
            if (deletableDevices.Count == 0)
                return result;

            var deletableIds = deletableDevices.Select(x => x.Id).ToHashSet();

            foreach (var device in deletableDevices)
            {
                device.IsDeleted = true;
                _unitOfWork.Devices.Update(device);
            }

            var assignedIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId.HasValue && deletableIds.Contains(x.DeviceId.Value));
            foreach (var ip in assignedIps)
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }

            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => deletableIds.Contains(x.DeviceId) && !x.IsDeleted);
            foreach (var email in emails)
            {
                email.IsDeleted = true;
                _unitOfWork.DeviceEmails.Update(email);
            }

            await _unitOfWork.SaveChangesAsync();

            result.DeletedCount = deletableDevices.Count;
            return result;
        }

        // Validates a set of IpAddressIds for a brand-new Device: every Id must exist and be
        // currently Available. Duplicated Ids in the same request are rejected upfront.
        private async Task<List<IpAddress>> ResolveAndValidateIpAddressesAsync(List<int> ipAddressIds)
        {
            var result = new List<IpAddress>();
            if (ipAddressIds.Count == 0) return result;

            if (ipAddressIds.Distinct().Count() != ipAddressIds.Count)
                throw new DomainException("Danh sách địa chỉ IP có ID bị trùng lặp.");

            foreach (var ipId in ipAddressIds)
            {
                var ip = await _unitOfWork.IpAddresses.GetByIdAsync(ipId);
                ip.OrThrowNotFound("Địa chỉ IP", ipId);
                if (ip!.Status != (int)IpAddressStatus.Available)
                    throw new DomainException($"Địa chỉ IP '{ip.IpAddress1}' đã được sử dụng, vui lòng chọn IP khác.");
                result.Add(ip);
            }

            return result;
        }

        // Reconciles a Device's assigned IpAddresses with the requested Id list: unassigns
        // Ips no longer present, assigns newly-added ones (must be Available), leaves
        // already-assigned Ips untouched.
        private async Task SyncIpAddressesAsync(int deviceId, List<int> requestedIpAddressIds)
        {
            if (requestedIpAddressIds.Distinct().Count() != requestedIpAddressIds.Count)
                throw new DomainException("Danh sách địa chỉ IP có ID bị trùng lặp.");

            var currentIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);
            var currentIds = currentIps.Select(x => x.Id).ToHashSet();

            foreach (var ip in currentIps.Where(x => !requestedIpAddressIds.Contains(x.Id)))
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }

            foreach (var ipId in requestedIpAddressIds.Where(id => !currentIds.Contains(id)))
            {
                var ip = await _unitOfWork.IpAddresses.GetByIdAsync(ipId);
                ip.OrThrowNotFound("Địa chỉ IP", ipId);
                if (ip!.Status != (int)IpAddressStatus.Available)
                    throw new DomainException($"Địa chỉ IP '{ip.IpAddress1}' đã được sử dụng, vui lòng chọn IP khác.");

                ip.DeviceId = deviceId;
                ip.Status = (int)IpAddressStatus.Assigned;
                _unitOfWork.IpAddresses.Update(ip);
            }
        }

        // Reconciles a Device's emails with the requested list, matched by trimmed/case-insensitive
        // Email text (input items have no Id): entries missing from the request are soft-deleted,
        // matching entries keep their Id and only refresh Note if it changed, unmatched entries are added.
        private async Task SyncEmailsAsync(int deviceId, List<DeviceEmailInputDto> requestedEmails)
        {
            var currentEmails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);

            var normalizedRequest = requestedEmails
                .Select(e => new { Email = e.Email.Trim(), e.Note })
                .ToList();
            var requestedKeys = normalizedRequest.Select(e => e.Email.ToLowerInvariant()).ToHashSet();

            foreach (var email in currentEmails.Where(e => !requestedKeys.Contains(e.Email.ToLowerInvariant())))
            {
                email.IsDeleted = true;
                _unitOfWork.DeviceEmails.Update(email);
            }

            var currentByKey = currentEmails
                .Where(e => requestedKeys.Contains(e.Email.ToLowerInvariant()))
                .ToDictionary(e => e.Email.ToLowerInvariant(), e => e);

            foreach (var item in normalizedRequest)
            {
                var key = item.Email.ToLowerInvariant();
                if (currentByKey.TryGetValue(key, out var existing))
                {
                    if (existing.Note != item.Note)
                    {
                        existing.Note = item.Note;
                        _unitOfWork.DeviceEmails.Update(existing);
                    }
                }
                else
                {
                    await _unitOfWork.DeviceEmails.AddAsync(new DeviceEmail
                    {
                        DeviceId = deviceId,
                        Email = item.Email,
                        Note = item.Note,
                        IsDeleted = false
                    });
                }
            }
        }

        private static DeviceDto MapToDto(Device device, IReadOnlyList<IpAddress> ipAddresses, IReadOnlyList<DeviceEmail> emails) => new DeviceDto
        {
            Id = device.Id,
            DeviceCode = device.DeviceCode,
            DeviceName = device.DeviceName,
            DeviceTypeId = device.DeviceTypeId,
            DeviceTypeName = device.DeviceType?.TypeName!,
            SupplierId = device.SupplierId,
            SupplierName = device.Supplier?.SupplierName!,
            BranchId = device.BranchId,
            BranchName = device.Branch?.BranchName!,
            GroupId = device.GroupId,
            GroupName = device.DeviceGroup?.GroupName,
            DepartmentId = device.DepartmentId,
            DepartmentName = device.DeviceDepartment?.DepartmentName,
            Manager = device.Manager,
            PurchaseDate = device.PurchaseDate,
            DepreciationMonths = device.DepreciationMonths,
            ExpirationDate = device.ExpirationDate,
            IsOutsourced = device.IsOutsourced,
            Status = device.Status,
            StatusText = GetStatusText(device.Status),
            Note = device.Note,
            SerialNumber = device.SerialNumber,
            IsUseUsb = device.IsUseUsb,
            ReplacesOldDeviceId = device.ReplacesOldDeviceId,
            ReplacesOldDeviceCode = device.ReplacesOldDevice?.DeviceCode,
            IpAddresses = ipAddresses.Select(ip => new DeviceIpAddressDto { Id = ip.Id, IpAddress = ip.IpAddress1 }).ToList(),
            Emails = emails.Select(e => new DeviceEmailDto { Id = e.Id, Email = e.Email, Note = e.Note }).ToList()
        };

        private static string GetStatusText(int status) => status switch
        {
            (int)DeviceStatus.PendingUse => "Chờ sử dụng",
            (int)DeviceStatus.InUse => "Đang sử dụng",
            (int)DeviceStatus.PendingLiquidation => "Chờ thanh lý",
            (int)DeviceStatus.Liquidated => "Đã thanh lý",
            _ => "Không xác định"
        };
    }
}
