using System.Linq.Expressions;
using ClosedXML.Excel;
using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceService : BaseService<IAssetUnitOfWork>, IDeviceService
    {
        private readonly IDeviceConfigurationService _deviceConfigurationService;
        private readonly IDeviceSoftwareService _deviceSoftwareService;
        private readonly IUserDirectoryService _userDirectoryService;

        public DeviceService(
            IAssetUnitOfWork unitOfWork,
            IDeviceConfigurationService deviceConfigurationService,
            IDeviceSoftwareService deviceSoftwareService,
            IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _deviceConfigurationService = deviceConfigurationService;
            _deviceSoftwareService = deviceSoftwareService;
            _userDirectoryService = userDirectoryService;
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
                // Contains, not StartsWith: the keyword may appear anywhere in the code, like the other text filters.
                query = query.Where(d => d.DeviceCode.Contains(request.DeviceCode));
            }

            if (!string.IsNullOrWhiteSpace(request.Manager))
            {
                query = query.Where(d => d.Manager.Contains(request.Manager));
            }

            if (!string.IsNullOrWhiteSpace(request.ManagerDomainAccount))
            {
                query = query.Where(d => d.ManagerDomainAccount != null && d.ManagerDomainAccount.Contains(request.ManagerDomainAccount));
            }

            if (!string.IsNullOrWhiteSpace(request.SupplierName))
            {
                query = query.Where(d => d.Supplier.SupplierName.Contains(request.SupplierName));
            }

            // Group/Department are optional on Device, hence the null-guard; Branch is required.
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

            // FE sends a full ISO date; compare on Date instead of ToString().Contains, which forces a non-sargable scan.
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

            // Gathers devices for bulk QR printing; unrelated to any running scan session.
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

            Expression<Func<Device, DeviceGridDto>> selector = d => new DeviceGridDto
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
            ManagerDomainAccount = d.ManagerDomainAccount,
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
                : d.Status == (int)DeviceStatus.UnderRepair ? "Đang sửa chữa"
                : "Không xác định"
        };

            if (request.SortIpAddressAscending.HasValue)
            {
                return await GetPagedSortedByIpAsync(query, request, selector);
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
                selector);
        }

        // IPv4 strings don't sort numerically in SQL, so (Id, IPs) pairs are sorted in memory and only the page is loaded;
        // ascending uses the lowest IP, descending the highest, devices without IP always last.
        private async Task<PagedResponse<DeviceGridDto>> GetPagedSortedByIpAsync(
            IQueryable<Device> query,
            DeviceFilterRequest request,
            Expression<Func<Device, DeviceGridDto>> selector)
        {
            var ascending = request.SortIpAddressAscending!.Value;

            var keys = await _unitOfWork.Devices.ToListAsync(
                query,
                d => new
                {
                    d.Id,
                    d.DeviceCode,
                    Ips = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList()
                });

            var sortedIds = keys
                .Select(k =>
                {
                    var values = k.Ips.Select(ToIpSortValue).ToList();
                    long? key = values.Count == 0 ? null : (ascending ? values.Min() : values.Max());
                    return (k.Id, k.DeviceCode, Key: key);
                })
                .OrderBy(k => k.Key == null)
                .ThenBy(k => ascending ? k.Key : -k.Key)
                .ThenBy(k => k.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .Select(k => k.Id)
                .ToList();

            var pageIds = sortedIds
                .Skip((request.PageIndex - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            var items = await _unitOfWork.Devices.ToListAsync(query.Where(d => pageIds.Contains(d.Id)), selector);
            var position = pageIds.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
            items = items.OrderBy(i => position[i.Id]).ToList();

            return new PagedResponse<DeviceGridDto>(items, sortedIds.Count, request.PageIndex, request.PageSize);
        }

        // Non-IPv4 text maps to long.MaxValue so it sorts after real addresses.
        private static long ToIpSortValue(string? ip)
        {
            var parts = (ip ?? string.Empty).Trim().Split('.');
            if (parts.Length != 4) return long.MaxValue;

            long value = 0;
            foreach (var part in parts)
            {
                if (!byte.TryParse(part, out var octet)) return long.MaxValue;
                value = (value << 8) | octet;
            }
            return value;
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
                    ManagerDomainAccount = d.ManagerDomainAccount,
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
                        : d.Status == (int)DeviceStatus.UnderRepair ? "Đang sửa chữa"
                : d.Status == (int)DeviceStatus.UnderRepair ? "Đang sửa chữa"
                        : "Không xác định"
                });
        }

        public async Task<List<DeviceReportItemDto>> GetReportListAsync(DeviceReportFilterRequest request)
        {
            var query = _unitOfWork.Devices.GetQueryable(false, d => d.IpAddresses)
                .Where(d => !d.IsDeleted
                    && (d.Status == (int)DeviceStatus.PendingUse || d.Status == (int)DeviceStatus.InUse));

            if (request.Status.HasValue)
                query = query.Where(d => d.Status == request.Status.Value);

            if (request.DeviceTypeIds is { Count: > 0 })
            {
                var deviceTypeIds = request.DeviceTypeIds;
                query = query.Where(d => deviceTypeIds.Contains(d.DeviceTypeId));
            }

            if (request.BranchId.HasValue)
                query = query.Where(d => d.BranchId == request.BranchId.Value);

            if (request.DepartmentId.HasValue)
                query = query.Where(d => d.DepartmentId == request.DepartmentId.Value);

            if (request.GroupId.HasValue)
                query = query.Where(d => d.GroupId == request.GroupId.Value);

            if (!string.IsNullOrWhiteSpace(request.Keyword))
                query = query.Where(d => d.DeviceCode.Contains(request.Keyword) || d.DeviceName.Contains(request.Keyword));

            var today = TimeHelper.GetCurrentUtcTime().Date;

            // string.Join over a subquery isn't reliably translatable, so join in memory.
            var rawItems = await _unitOfWork.Devices.ToListAsync(
                query.OrderBy(d => d.DeviceCode),
                d => new
                {
                    d.DeviceCode,
                    d.DeviceName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    d.SerialNumber,
                    IpAddresses = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList(),
                    Emails = d.DeviceEmails.Where(e => !e.IsDeleted).Select(e => e.Email).ToList(),
                    d.Manager,
                    BranchName = d.Branch.BranchName,
                    DepartmentName = d.DeviceDepartment != null ? d.DeviceDepartment.DepartmentName : null,
                    GroupName = d.DeviceGroup != null ? d.DeviceGroup.GroupName : null,
                    SupplierName = d.Supplier.SupplierName,
                    d.PurchaseDate,
                    d.ExpirationDate
                });

            var items = rawItems.Select(d => new DeviceReportItemDto
            {
                DeviceCode = d.DeviceCode,
                DeviceName = d.DeviceName,
                DeviceTypeName = d.DeviceTypeName,
                SerialNumber = d.SerialNumber,
                IpAddress = d.IpAddresses.Count > 0 ? string.Join(", ", d.IpAddresses) : null,
                Email = d.Emails.Count > 0 ? string.Join(", ", d.Emails) : null,
                Manager = d.Manager,
                BranchName = d.BranchName,
                DepartmentName = d.DepartmentName,
                GroupName = d.GroupName,
                SupplierName = d.SupplierName,
                PurchaseDate = d.PurchaseDate,
                ExpirationDate = d.ExpirationDate,
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

        public async Task<(byte[] Content, string FileName)> ExportReportListAsync(DeviceReportFilterRequest request, string? title)
        {
            var items = await GetReportListAsync(request);
            var heading = string.IsNullOrWhiteSpace(title) ? "DANH SÁCH THIẾT BỊ" : title.Trim();
            string[] headers =
            {
                "STT", "Mã thiết bị", "Tên thiết bị", "Loại thiết bị", "Số serial", "Địa chỉ IP", "Email", "Người quản lý",
                "Chi nhánh", "Bộ phận", "Nhóm", "Nhà cung cấp", "Ngày mua", "Hạn sử dụng", "Hết hạn", "Kỳ T/C"
            };
            const int purchaseDateCol = 13, expirationDateCol = 14, expiredCol = 15, periodCol = 16;

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Danh sách thiết bị");

            sheet.Cell(1, 1).Value = heading;
            sheet.Range(1, 1, 1, headers.Length).Merge().Style
                .Font.SetBold().Font.SetFontSize(14)
                .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            sheet.Cell(2, 1).Value = $"Ngày xuất: {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy} — Tổng số: {items.Count} thiết bị";
            sheet.Range(2, 1, 2, headers.Length).Merge().Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

            const int headerRow = 4;
            for (var c = 0; c < headers.Length; c++)
                sheet.Cell(headerRow, c + 1).Value = headers[c];
            var headerRange = sheet.Range(headerRow, 1, headerRow, headers.Length);
            headerRange.Style.Font.SetBold();
            headerRange.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#E2E8F0"));
            headerRange.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                var row = headerRow + 1 + i;
                sheet.Cell(row, 1).Value = item.Stt;
                sheet.Cell(row, 2).Value = item.DeviceCode;
                sheet.Cell(row, 3).Value = item.DeviceName;
                sheet.Cell(row, 4).Value = item.DeviceTypeName;
                sheet.Cell(row, 5).Value = item.SerialNumber ?? "-";
                sheet.Cell(row, 6).Value = item.IpAddress ?? "-";
                sheet.Cell(row, 7).Value = item.Email ?? "-";
                sheet.Cell(row, 8).Value = item.Manager;
                sheet.Cell(row, 9).Value = item.BranchName;
                sheet.Cell(row, 10).Value = item.DepartmentName ?? "-";
                sheet.Cell(row, 11).Value = item.GroupName ?? "-";
                sheet.Cell(row, 12).Value = item.SupplierName;
                sheet.Cell(row, purchaseDateCol).Value = item.PurchaseDate;
                if (item.ExpirationDate.HasValue) sheet.Cell(row, expirationDateCol).Value = item.ExpirationDate.Value;
                else sheet.Cell(row, expirationDateCol).Value = "-";
                sheet.Cell(row, expiredCol).Value = item.IsExpired ? "X" : "O";
                if (item.FinancialPeriod.HasValue) sheet.Cell(row, periodCol).Value = item.FinancialPeriod.Value;
                else sheet.Cell(row, periodCol).Value = "-";
            }

            if (items.Count > 0)
            {
                var lastRow = headerRow + items.Count;
                sheet.Range(headerRow + 1, purchaseDateCol, lastRow, expirationDateCol).Style.DateFormat.SetFormat("dd/MM/yyyy");
                sheet.Range(headerRow + 1, 1, lastRow, 1).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                sheet.Range(headerRow + 1, purchaseDateCol, lastRow, periodCol).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            }

            var table = sheet.Range(headerRow, 1, headerRow + items.Count, headers.Length);
            table.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin).Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            sheet.SheetView.FreezeRows(headerRow);
            sheet.Columns().AdjustToContents();
            sheet.Column(1).Width = 6;

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), $"DanhSachThietBi_{TimeHelper.GetCurrentUtcTime():yyyyMMdd}.xlsx");
        }

        // Must match EXPIRY_WINDOW_DAYS in the FE DeviceReport.tsx, which doesn't re-filter ExpiringDevices.
        private const int ReportExpiryWindowDays = 90;

        // Aggregated in SQL instead of returning 5000+ rows for the FE to sum.
        public async Task<DeviceReportSummaryDto> GetReportSummaryAsync()
        {
            var query = _unitOfWork.Devices.GetQueryable(false, d => d.Branch, d => d.DeviceType)
                .Where(d => !d.IsDeleted
                    && (d.Status == (int)DeviceStatus.PendingUse || d.Status == (int)DeviceStatus.InUse));

            var totalCount = await _unitOfWork.Devices.CountAsync(query);
            var inUseCount = await _unitOfWork.Devices.CountAsync(query, d => d.Status == (int)DeviceStatus.InUse);

            // Sorting/taking in memory is fine: only a few dozen groups.
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

            // Computed in memory: EF can't translate the date subtraction consistently across providers.
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

        // BE returns fields + QrPayload, FE draws the QR. Keeps the requested Id order; missing/soft-deleted Ids are skipped.
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

        // Line 1 is the bare DeviceCode (scanner lookup key); labelled lines keep phone scans readable. Empty fields are dropped.
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
                ManagerDomainAccount = NormalizeDomainAccount(request.ManagerDomainAccount),
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

            // Devices created as liquidation status are out of use, so no IPs are assigned and they stay Available.
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
                    Email = emailInput.Email.Trim().ToLowerInvariant(),
                    Note = emailInput.Note,
                    IsDeleted = false
                };
                emails.Add(email);
                await _unitOfWork.DeviceEmails.AddAsync(email);
            }

            await _unitOfWork.SaveChangesAsync();
            await EnsureIdentityUserAsync(newDevice.ManagerDomainAccount);

            newDevice.Branch = branch;
            newDevice.DeviceType = deviceType;
            newDevice.Supplier = supplier;
            newDevice.SuggestedNewDevice = suggestedNewDevice;
            newDevice.DeviceGroup = group;
            newDevice.DeviceDepartment = department;
            return MapToDto(newDevice, ipAddresses, emails);
        }

        private static string? NormalizeDomainAccount(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        // Best effort after the device is saved: an account active in the directory but unknown to Identity
        // gets a role-Basic user. Ineligible or unreachable accounts are left alone and never fail the save.
        private async Task EnsureIdentityUserAsync(string? domainAccount)
        {
            if (domainAccount == null) return;
            try
            {
                await _userDirectoryService.EnsureDomainUsersAsync(new[] { domainAccount });
            }
            catch
            {
                // The device is already saved; the user can still be created later from the device form.
            }
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

            // Only an InUse device holds IPs/software: liquidation releases both; InUse -> PendingUse releases only the IPs,
            // keeping software for when it comes back.
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
            var previousAccount = device.ManagerDomainAccount;
            device.ManagerDomainAccount = NormalizeDomainAccount(request.ManagerDomainAccount);
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
            if (!string.Equals(previousAccount, device.ManagerDomainAccount, StringComparison.OrdinalIgnoreCase))
                await EnsureIdentityUserAsync(device.ManagerDomainAccount);
        }

        public async Task<DeviceReplacementSuggestionDto?> GetReplacementSuggestionAsync(int oldDeviceId)
        {
            var oldDevice = (await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == oldDeviceId, x => x.SuggestedNewDevice!)).OrThrowNotFound("Thiết bị", oldDeviceId);

            // Valid only if the suggested device still exists, isn't deleted and is still PendingUse (not used by another transfer).
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

        // Skips full UpdateAsync: both Ids were already validated by the import. Overwrites any earlier suggestion.
        public async Task SetSuggestedNewDeviceAsync(int oldDeviceId, int newDeviceId)
        {
            var oldDevice = (await _unitOfWork.Devices.GetByIdAsync(oldDeviceId)).OrThrowNotFound("Thiết bị", oldDeviceId);

            oldDevice!.SuggestedNewDeviceId = newDeviceId;

            _unitOfWork.Devices.Update(oldDevice);
            await _unitOfWork.SaveChangesAsync();
        }

        // Group/Department are optional; when GroupId is sent, DepartmentId must be that Group's parent to avoid mismatches.
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

        // The suggested device must exist and, on Update, must not be the device itself.
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
            // Safety net: software is normally already released by the time the device reached liquidation.
            await ReleaseAllSoftwareAsync(id);

            var emails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            foreach (var email in emails)
            {
                email.IsDeleted = true;
                _unitOfWork.DeviceEmails.Update(email);
            }

            await _unitOfWork.SaveChangesAsync();
        }

        // Soft delete so TransferHistory FKs stay valid. Only Liquidated devices qualify (a PendingLiquidation one may
        // still be in use); others are reported in SkippedDevices without blocking the batch.
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

            // Batch-fetch instead of one query per IP.
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

        // Newly added IPs must be Available; already-assigned ones are left untouched.
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
                // Batch-fetch instead of one query per IP.
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

        // Used on entering PendingLiquidation/Liquidated: the device is out of use, so its IPs are freed regardless of the request.
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

        // Hard delete, like DeviceSoftwareService does for this keyless join table.
        private async Task ReleaseAllSoftwareAsync(int deviceId)
        {
            var installed = await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == deviceId);
            if (installed.Count > 0)
                _unitOfWork.DeviceSoftwares.RemoveRange(installed);
        }

        // Matched by trimmed case-insensitive Email (inputs have no Id); missing entries are soft-deleted.
        private async Task SyncEmailsAsync(int deviceId, List<DeviceEmailInputDto> requestedEmails)
        {
            var currentEmails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);

            var normalizedRequest = requestedEmails
                .Select(e => new { Email = e.Email.Trim().ToLowerInvariant(), e.Note })
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
                    if (existing.Note != item.Note || existing.Email != item.Email)
                    {
                        existing.Note = item.Note;
                        existing.Email = item.Email;
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
            ManagerDomainAccount = device.ManagerDomainAccount,
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

        // The grid projections above still inline the ternary because EF can't call a C# method in SQL.
        private static string GetStatusText(int status) => status.GetDeviceStatusText();
    }
}
