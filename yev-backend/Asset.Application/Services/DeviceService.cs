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
                // 2026-07-11: changed from StartsWith to Contains — matching just requires the
                // keyword to appear anywhere in the device code, not necessarily typed from the
                // start (consistent with Note/SerialNumber/IpAddress/Email which already use Contains).
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

            // Name-based filters (2026-07-30, see DeviceFilterRequest for why they exist). Group and
            // Department are optional on Device, hence the null-guard on the navigation property; Branch
            // is required so it needs none.
            if (!string.IsNullOrWhiteSpace(request.BranchName))
            {
                query = query.Where(d => d.Branch.BranchName.Contains(request.BranchName));
            }

            if (!string.IsNullOrWhiteSpace(request.GroupName))
            {
                query = query.Where(d => d.DeviceGroup != null && d.DeviceGroup.GroupName.Contains(request.GroupName));
            }

            if (!string.IsNullOrWhiteSpace(request.DepartmentName))
            {
                query = query.Where(d => d.DeviceDepartment != null && d.DeviceDepartment.DepartmentName.Contains(request.DepartmentName));
            }

            // FE only sends a full ISO date (input type="date"), so this is really an exact-day match —
            // parse it and compare on Date instead of PurchaseDate.ToString().Contains(...), which forced
            // SQL Server to CONVERT every row to string (non-sargable, no index use) for a full table scan.
            if (!string.IsNullOrWhiteSpace(request.PurchaseDate) && DateTime.TryParse(request.PurchaseDate, out var purchaseDate))
            {
                query = query.Where(d => d.PurchaseDate.Date == purchaseDate.Date);
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

            // Lọc máy đã tick "Cần kiểm tra hằng ngày (QR)" — dùng để gom nhanh danh sách in QR hàng
            // loạt cho phòng server (asset-module.md §1.19/§1.21), không liên quan phiên quét đang chạy.
            if (request.RequiresDailyCheck.HasValue)
            {
                query = query.Where(d => d.RequiresDailyCheck == request.RequiresDailyCheck.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.IpAddress))
            {
                query = query.Where(d => d.IpAddresses.Any(ip => !ip.IsDeleted && ip.IpAddress1.Contains(request.IpAddress)));
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                query = query.Where(d => d.DeviceEmails.Any(e => !e.IsDeleted && e.Email.Contains(request.Email)));
            }

            if (request.BranchId.HasValue)
            {
                query = query.Where(d => d.BranchId == request.BranchId.Value);
            }

            if (request.DeviceTypeId.HasValue)
            {
                query = query.Where(d => d.DeviceTypeId == request.DeviceTypeId.Value);
            }

            if (request.Status.HasValue)
            {
                query = query.Where(d => d.Status == request.Status.Value);
            }

            if (request.ExpiryDate.HasValue)
            {
                query = query.Where(d => d.ExpirationDate != null && d.ExpirationDate <= request.ExpiryDate.Value);
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
                    RequiresDailyCheck = d.RequiresDailyCheck,
                    Status = d.Status,
                    // Duplicate the logic of GetStatusText here (instead of calling the method) because
                    // this is an Expression<Func<>> translated by EF into SQL, which doesn't support calling arbitrary C# methods.
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
                    RequiresDailyCheck = d.RequiresDailyCheck,
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
                .Where(d => !d.IsDeleted
                    && (d.Status == (int)DeviceStatus.PendingUse || d.Status == (int)DeviceStatus.InUse));

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
                // Yazaki financial period: fiscal year runs 7/1 - 6/30, numbered consecutively from
                // the year Yazaki Corporation was founded (1941) -> period = FY start year - 1940.
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

        // Số ngày cảnh báo trước khi hết hạn cho màn "Báo cáo thiết bị" (yev-frontend DeviceReport.tsx
        // EXPIRY_WINDOW_DAYS) — 2 nơi phải khớp nhau vì FE không tự lọc lại danh sách ExpiringDevices.
        private const int ReportExpiryWindowDays = 90;

        // Thống kê cho màn "Báo cáo thiết bị" — tính bằng COUNT/GROUP BY ở SQL thay vì trả nguyên bảng
        // Device (5000+ dòng) để FE tự cộng dồn trong bộ nhớ (2026-07-30, xem docs/docs-be/asset-module.md).
        public async Task<DeviceReportSummaryDto> GetReportSummaryAsync()
        {
            var query = _unitOfWork.Devices.GetQueryable(false, d => d.Branch, d => d.DeviceType)
                .Where(d => !d.IsDeleted
                    && (d.Status == (int)DeviceStatus.PendingUse || d.Status == (int)DeviceStatus.InUse));

            var totalCount = await _unitOfWork.Devices.CountAsync(query);
            var inUseCount = await _unitOfWork.Devices.CountAsync(query, d => d.Status == (int)DeviceStatus.InUse);

            // OrderByDescending/Take chạy trong bộ nhớ sau khi group — tập kết quả chỉ vài chục dòng
            // (số Chi nhánh/Loại thiết bị thực tế), không đáng để làm phức tạp thêm interface repository.
            var branchGroups = await _unitOfWork.Devices.GroupCountAsync(
                query, d => d.Branch.BranchName,
                g => new DeviceReportDistributionItemDto { Label = g.Key, Count = g.Count() });
            var branchDistribution = branchGroups.OrderByDescending(x => x.Count).Take(6).ToList();

            var typeGroups = await _unitOfWork.Devices.GroupCountAsync(
                query, d => d.DeviceType.TypeName,
                g => new DeviceReportDistributionItemDto { Label = g.Key, Count = g.Count() });
            var typeDistribution = typeGroups.OrderByDescending(x => x.Count).Take(6).ToList();

            var today = TimeHelper.GetCurrentUtcTime().Date;
            var expiryWindowDate = today.AddDays(ReportExpiryWindowDays);

            var expiringQuery = query
                .Where(d => d.ExpirationDate != null && d.ExpirationDate <= expiryWindowDate)
                .OrderBy(d => d.ExpirationDate);

            var expiringDevices = await _unitOfWork.Devices.ToListAsync(
                expiringQuery,
                d => new DeviceReportExpiringItemDto
                {
                    Id = d.Id,
                    DeviceCode = d.DeviceCode,
                    DeviceName = d.DeviceName,
                    BranchName = d.Branch.BranchName,
                    Manager = d.Manager,
                    ExpirationDate = d.ExpirationDate
                });

            // DaysRemaining là phép trừ ngày đơn giản — tính trong bộ nhớ vì EF không dịch được
            // (ExpirationDate.Value - today).Days sang SQL cho mọi provider một cách nhất quán.
            foreach (var item in expiringDevices)
            {
                item.DaysRemaining = (int)Math.Ceiling((item.ExpirationDate!.Value - today).TotalDays);
            }

            return new DeviceReportSummaryDto
            {
                TotalCount = totalCount,
                InUseCount = inUseCount,
                PendingUseCount = totalCount - inUseCount,
                ExpiringSoonCount = expiringDevices.Count(d => d.DaysRemaining >= 0),
                BranchDistribution = branchDistribution,
                DeviceTypeDistribution = typeDistribution,
                ExpiringDevices = expiringDevices
            };
        }

        public async Task<DeviceDto> GetByIdAsync(int id)
        {
            var device = (await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == id, x => x.Branch, x => x.DeviceType, x => x.Supplier, x => x.SuggestedNewDevice!, x => x.DeviceGroup!, x => x.DeviceDepartment!)).OrThrowNotFound("Thiết bị", id);

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

        // Builds QR-label data for the devices ticked on the grid (2026-07-23). The BE only returns
        // the fields + a ready QrPayload; the FE draws the QR and lays out the print sheet. Preserves
        // the order of the requested Ids so the printed sheet matches the user's selection order; Ids
        // not found (or soft-deleted) are silently skipped (nothing to print for them).
        public async Task<List<DeviceQrLabelDto>> GetQrLabelsAsync(DeviceQrLabelRequestDto request)
        {
            var ids = request.Ids.Distinct().ToList();

            var query = _unitOfWork.Devices
                .GetQueryable(false, d => d.Branch, d => d.Supplier, d => d.DeviceType)
                .Where(d => ids.Contains(d.Id) && !d.IsDeleted);

            var rows = await _unitOfWork.Devices.ToListAsync(query, d => new
            {
                d.Id,
                d.DeviceCode,
                d.DeviceName,
                DeviceTypeName = d.DeviceType.TypeName,
                BranchName = d.Branch.BranchName,
                SupplierName = d.Supplier.SupplierName,
                d.Manager,
                d.SerialNumber,
                d.Status,
                d.PurchaseDate
            });

            var byId = rows.ToDictionary(r => r.Id);

            // Reorder to match the request (SQL IN does not preserve order).
            return ids
                .Where(byId.ContainsKey)
                .Select(id => byId[id])
                .Select(r => new DeviceQrLabelDto
                {
                    DeviceId = r.Id,
                    DeviceCode = r.DeviceCode,
                    DeviceName = r.DeviceName,
                    DeviceTypeName = r.DeviceTypeName,
                    BranchName = r.BranchName,
                    SupplierName = r.SupplierName,
                    Manager = r.Manager,
                    SerialNumber = r.SerialNumber,
                    StatusText = r.Status.GetDeviceStatusText(),
                    PurchaseDate = r.PurchaseDate,
                    QrPayload = BuildQrPayload(r.DeviceCode, r.DeviceName, r.SerialNumber, r.BranchName)
                })
                .ToList();
        }

        // Default QR content: line 1 is the bare DeviceCode (the stable key an internal scanner app
        // splits off to look the device up); the remaining, labelled lines make a phone camera scan
        // human-readable offline. Empty fields are dropped so the QR stays compact.
        private static string BuildQrPayload(string deviceCode, string deviceName, string? serialNumber, string? branchName)
        {
            var lines = new List<string> { deviceCode };

            if (!string.IsNullOrWhiteSpace(deviceName)) lines.Add(deviceName);
            if (!string.IsNullOrWhiteSpace(serialNumber)) lines.Add($"SN: {serialNumber}");
            if (!string.IsNullOrWhiteSpace(branchName)) lines.Add($"Xưởng: {branchName}");

            return string.Join("\n", lines);
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

            var deviceType = (await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId)).OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = (await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId)).OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = (await _unitOfWork.Branches.GetByIdAsync(request.BranchId)).OrThrowNotFound("Chi nhánh", request.BranchId);

            var (group, department) = await ValidateGroupAndDepartmentAsync(request.GroupId, request.DepartmentId);

            var suggestedNewDevice = await ValidateSuggestedNewDeviceIdAsync(request.SuggestedNewDeviceId, currentDeviceId: null);

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
                RequiresDailyCheck = request.RequiresDailyCheck,
                SuggestedNewDeviceId = request.SuggestedNewDeviceId,
                IsDeleted = false
            };

            await _unitOfWork.Devices.AddAsync(newDevice);
            await _unitOfWork.SaveChangesAsync();

            // Máy tạo thẳng ở trạng thái Chờ thanh lý/Đã thanh lý coi như không dùng -> không gán IP
            // dù request có gửi kèm, để IP đó vẫn Available cho máy khác (2026-08-22).
            if (newDevice.Status.IsLiquidationStatus())
            {
                ipAddresses = new List<IpAddress>();
            }
            else
            {
                foreach (var ip in ipAddresses)
                {
                    ip.DeviceId = newDevice.Id;
                    ip.Status = (int)IpAddressStatus.Assigned;
                    _unitOfWork.IpAddresses.Update(ip);
                }
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
            newDevice.SuggestedNewDevice = suggestedNewDevice;
            newDevice.DeviceGroup = group;
            newDevice.DeviceDepartment = department;
            return MapToDto(newDevice, ipAddresses, emails);
        }

        public async Task UpdateAsync(UpdateDeviceDto request)
        {
            var device = (await _unitOfWork.Devices.GetByIdAsync(request.Id)).OrThrowNotFound("Thiết bị", request.Id);

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

            var deviceType = (await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId)).OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = (await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId)).OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = (await _unitOfWork.Branches.GetByIdAsync(request.BranchId)).OrThrowNotFound("Chi nhánh", request.BranchId);

            await ValidateGroupAndDepartmentAsync(request.GroupId, request.DepartmentId);

            await ValidateSuggestedNewDeviceIdAsync(request.SuggestedNewDeviceId, currentDeviceId: device!.Id);

            var previousStatus = device.Status;

            // 2026-08-25 (user decision): a Device only holds a live Ip/installed Software while it is
            // actually InUse. Moving into PendingLiquidation/Liquidated releases both the Ip and the
            // installed Software; moving InUse -> PendingUse (taken out of service, not yet re-assigned)
            // releases just the Ip — the Software list still makes sense to keep for whenever it comes
            // back InUse.
            if (request.Status.IsLiquidationStatus())
            {
                await ReleaseAllIpsAsync(device.Id);
                await ReleaseAllSoftwareAsync(device.Id);
            }
            else if (previousStatus == (int)DeviceStatus.InUse && request.Status == (int)DeviceStatus.PendingUse)
                await ReleaseAllIpsAsync(device.Id);
            else
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
            device.RequiresDailyCheck = request.RequiresDailyCheck;
            device.SuggestedNewDeviceId = request.SuggestedNewDeviceId;

            _unitOfWork.Devices.Update(device);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<DeviceReplacementSuggestionDto?> GetReplacementSuggestionAsync(int oldDeviceId)
        {
            var oldDevice = (await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == oldDeviceId, x => x.SuggestedNewDevice!)).OrThrowNotFound("Thiết bị", oldDeviceId);

            // The suggestion is read directly from the SuggestedNewDeviceId column stored on the old
            // device itself (2026-07-13, reversed the self-reference direction — previously had to search
            // backward through every new device declaring "Old MQL" = this device, then pick the most
            // recently imported one). A later import always overwrites the suggestion from an earlier
            // import, so "most recent" no longer needs to be chosen — there is now only 1 suggestion per
            // old device. It is only valid if the new device still exists, is not deleted, and is still
            // "Pending Use" (has not been used for any other transfer since being suggested).
            var suggestion = oldDevice!.SuggestedNewDevice;
            if (suggestion == null || suggestion.IsDeleted || suggestion.Status != (int)DeviceStatus.PendingUse)
                return null;

            return new DeviceReplacementSuggestionDto
            {
                Id = suggestion.Id,
                DeviceCode = suggestion.DeviceCode,
                DeviceName = suggestion.DeviceName
            };
        }

        // Used by DeviceImportService: after creating the NEW device from the "Old MQL" column,
        // writes the new device's Id directly into SuggestedNewDeviceId of the corresponding OLD
        // device — without going through the full UpdateAsync (no need to re-validate the entire
        // Device, both Ids were already confirmed to exist in the Import's resolve step). Overwrites
        // the old suggestion if this old device was already suggested before by a different import —
        // always keeps the most recent suggestion.
        public async Task SetSuggestedNewDeviceAsync(int oldDeviceId, int newDeviceId)
        {
            var oldDevice = (await _unitOfWork.Devices.GetByIdAsync(oldDeviceId)).OrThrowNotFound("Thiết bị", oldDeviceId);

            oldDevice!.SuggestedNewDeviceId = newDeviceId;

            _unitOfWork.Devices.Update(oldDevice);
            await _unitOfWork.SaveChangesAsync();
        }

        // Group/Department are both optional — only validate existence (!IsDeleted) when the client
        // sends an Id. Since DeviceGroup belongs to exactly 1 DeviceDepartment (1 Department - N Groups),
        // sending GroupId must be accompanied by the correct parent DepartmentId of that Group — to
        // avoid saving Device data with mismatched Group/Department (e.g. FE sends the GroupId of Group
        // "OF" belonging to Quality Management but DepartmentId is General Affairs).
        private async Task<(DeviceGroup? Group, DeviceDepartment? Department)> ValidateGroupAndDepartmentAsync(int? groupId, int? departmentId)
        {
            DeviceDepartment? department = null;
            if (departmentId.HasValue)
            {
                department = (await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(x => x.Id == departmentId.Value && !x.IsDeleted))
                    .OrThrowNotFound("Bộ phận", departmentId.Value);
            }

            DeviceGroup? group = null;
            if (groupId.HasValue)
            {
                group = (await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(x => x.Id == groupId.Value && !x.IsDeleted, x => x.Department))
                    .OrThrowNotFound("Nhóm", groupId.Value);

                if (!departmentId.HasValue)
                    throw new DomainException("Phải chọn Bộ phận trước khi chọn Nhóm.");

                if (group.DepartmentId != departmentId.Value)
                    throw new DomainException($"Nhóm '{group.GroupName}' không thuộc bộ phận đã chọn.");
            }

            return (group, department);
        }

        // Shared by Create/Update: if SuggestedNewDeviceId is provided, the new (suggested) device must
        // exist (!IsDeleted) and must not point to itself (only applies during Update,
        // currentDeviceId != null). Returns the new device entity (or null if not set) so the
        // caller can attach the navigation property right away.
        private async Task<Device?> ValidateSuggestedNewDeviceIdAsync(int? suggestedNewDeviceId, int? currentDeviceId)
        {
            if (!suggestedNewDeviceId.HasValue) return null;

            if (currentDeviceId.HasValue && suggestedNewDeviceId.Value == currentDeviceId.Value)
                throw new DomainException("Thiết bị không thể tự gợi ý chính mình làm máy thay thế.");

            var newDevice = (await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == suggestedNewDeviceId.Value && !x.IsDeleted)).OrThrowNotFound("Thiết bị mới (gợi ý thay thế)", suggestedNewDeviceId.Value);
            return newDevice;
        }

        public async Task DeleteAsync(int id)
        {
            var device = (await _unitOfWork.Devices.GetByIdAsync(id)).OrThrowNotFound("Thiết bị", id);

            if (device.Status != (int)DeviceStatus.Liquidated)
                throw new DomainException("Chỉ có thể xóa thiết bị đã thanh lý.");

            device.IsDeleted = true;
            _unitOfWork.Devices.Update(device);

            await ReleaseAllIpsAsync(id);
            // Safety net for devices that reached Liquidated before this cleanup existed (2026-08-25) —
            // normally already empty by the time Status became PendingLiquidation/Liquidated.
            await ReleaseAllSoftwareAsync(id);

            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            foreach (var email in emails)
            {
                email.IsDeleted = true;
                _unitOfWork.DeviceEmails.Update(email);
            }

            await _unitOfWork.SaveChangesAsync();
        }

        // Bulk SOFT delete of Devices (2026-07-13: changed from hard delete to soft delete — same
        // mechanism as DeleteAsync above, only difference is accepting multiple Ids at once; avoids
        // hitting TransferHistory's foreign key constraint since soft delete only sets IsDeleted=true,
        // without touching the primary key). Only allows deleting devices currently in the
        // Liquidated state (2026-08-22: was PendingLiquidation — a device still pending liquidation
        // may still be in real use or reverted, only a fully liquidated device is safe to delete). An
        // Id not found or not in the liquidated state is skipped (SkippedDevices), without blocking
        // the whole batch.
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

            // Safety net, same reasoning as DeleteAsync above — batched across the whole deletable set.
            var installedSoftwares = await _unitOfWork.DeviceSoftwares.FindAsync(x => deletableIds.Contains(x.DeviceId));
            if (installedSoftwares.Count > 0)
                _unitOfWork.DeviceSoftwares.RemoveRange(installedSoftwares);

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

            // Batch-fetch thay vì query từng IP trong vòng lặp (2026-08-11).
            var idsSet = ipAddressIds.ToHashSet();
            var ipsById = (await _unitOfWork.IpAddresses.FindAsync(x => idsSet.Contains(x.Id))).ToDictionary(x => x.Id);

            foreach (var ipId in ipAddressIds)
            {
                var ip = ipsById.GetValueOrDefault(ipId).OrThrowNotFound("Địa chỉ IP", ipId);
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

            var newIpIds = requestedIpAddressIds.Where(id => !currentIds.Contains(id)).ToList();
            if (newIpIds.Count > 0)
            {
                // Batch-fetch thay vì query từng IP trong vòng lặp (2026-08-11).
                var newIdsSet = newIpIds.ToHashSet();
                var newIpsById = (await _unitOfWork.IpAddresses.FindAsync(x => newIdsSet.Contains(x.Id))).ToDictionary(x => x.Id);

                foreach (var ipId in newIpIds)
                {
                    var ip = newIpsById.GetValueOrDefault(ipId).OrThrowNotFound("Địa chỉ IP", ipId);
                    if (ip!.Status != (int)IpAddressStatus.Available)
                        throw new DomainException($"Địa chỉ IP '{ip.IpAddress1}' đã được sử dụng, vui lòng chọn IP khác.");

                    ip.DeviceId = deviceId;
                    ip.Status = (int)IpAddressStatus.Assigned;
                    _unitOfWork.IpAddresses.Update(ip);
                }
            }
        }

        // Releases every IpAddress currently assigned to a Device back to Available (DeviceId=null).
        // Used whenever a Device moves into PendingLiquidation/Liquidated: these statuses mean the
        // device is no longer in active use, so its Ips must be freed for other devices regardless of
        // what the caller submitted (2026-08-22).
        private async Task ReleaseAllIpsAsync(int deviceId)
        {
            var assignedIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);
            foreach (var ip in assignedIps)
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }
        }

        // Hard-deletes every DeviceSoftware row for a Device (uninstalls all software), same "xóa cứng"
        // treatment DeviceSoftwareService already uses for this keyless join table. Used whenever a
        // Device moves into PendingLiquidation/Liquidated (2026-08-25).
        private async Task ReleaseAllSoftwareAsync(int deviceId)
        {
            var installed = await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == deviceId);
            if (installed.Count > 0)
                _unitOfWork.DeviceSoftwares.RemoveRange(installed);
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
            RequiresDailyCheck = device.RequiresDailyCheck,
            SuggestedNewDeviceId = device.SuggestedNewDeviceId,
            SuggestedNewDeviceCode = device.SuggestedNewDevice?.DeviceCode,
            IpAddresses = ipAddresses.Select(ip => new DeviceIpAddressDto { Id = ip.Id, IpAddress = ip.IpAddress1 }).ToList(),
            Emails = emails.Select(e => new DeviceEmailDto { Id = e.Id, Email = e.Email, Note = e.Note }).ToList()
        };

        // Delegates to the shared helper so the wording lives in exactly one place (2026-07-23).
        // The two grid projections above still repeat the ternary inline because EF translates them
        // to SQL and cannot call a C# method.
        private static string GetStatusText(int status) => status.GetDeviceStatusText();
    }
}
