using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Dtos.DeviceImports;
using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceImportService : BaseService<IAssetUnitOfWork>, IDeviceImportService
    {
        // The template has no DeviceName/Manager/Email/DepreciationMonths: DeviceName = MQL, Manager/Email blank,
        // depreciation defaults to 60 months.
        private const int DefaultDepreciationMonths = 60;

        private readonly IDeviceService _deviceService;
        private readonly IDeviceConfigurationService _deviceConfigurationService;

        public DeviceImportService(
            IAssetUnitOfWork unitOfWork,
            IDeviceService deviceService,
            IDeviceConfigurationService deviceConfigurationService) : base(unitOfWork)
        {
            _deviceService = deviceService;
            _deviceConfigurationService = deviceConfigurationService;
        }

        public async Task<DeviceImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null)
        {
            var rawRows = CsvFileHelper.HasCsvExtension(fileName) ? ParseCsv(excelFileStream) : ParseXlsx(excelFileStream);
            var validatedRows = await ValidateAndResolveRowsAsync(rawRows);
            return BuildPreviewResult(validatedRows);
        }

        public async Task<DeviceImportConfirmResultDto> ConfirmAsync(ConfirmDeviceImportDto request)
        {
            // Re-validate against current DB data (don't trust the Id sent by the client) —
            // in case data has changed since the user viewed the Preview.
            var validatedRows = await ValidateAndResolveRowsAsync(request.Rows);

            // Invalid rows are skipped instead of blocking the whole batch; only valid rows create a Device.
            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            var validRows = validatedRows.Where(x => x.IsValid).ToList();

            var result = new DeviceImportConfirmResultDto
            {
                SkippedCount = invalidRows.Count,
                SkippedRows = invalidRows
                    .Select(r => new DeviceImportSkippedRowDto { RowNumber = r.RowNumber, DeviceCode = r.DeviceCode, Errors = r.Errors })
                    .ToList()
            };

            if (validRows.Count == 0) return result;

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                foreach (var row in validRows)
                {
                    // Existing MQL still PendingUse -> update instead of duplicating; not via DeviceService.UpdateAsync because
                    // it would wipe Emails/IpAddresses that the Excel file doesn't carry.
                    if (row.ResolvedExistingDeviceId.HasValue)
                    {
                        await UpdateExistingDeviceFromRowAsync(row, result);
                        continue;
                    }

                    var createDto = new CreateDeviceDto
                    {
                        DeviceCode = row.DeviceCode!,
                        DeviceName = row.DeviceCode!,
                        DeviceTypeId = row.ResolvedDeviceTypeId!.Value,
                        SupplierId = row.ResolvedSupplierId!.Value,
                        BranchId = row.ResolvedBranchId!.Value,
                        Manager = string.Empty,
                        Emails = new(),
                        PurchaseDate = row.PurchaseDate!.Value,
                        DepreciationMonths = DefaultDepreciationMonths,
                        IsOutsourced = false,
                        Status = (int)DeviceStatus.PendingUse,
                        Note = row.Note ?? string.Empty,
                        SerialNumber = row.SerialNumber
                    };

                    var created = await _deviceService.CreateAsync(createDto);
                    result.CreatedDeviceIds.Add(created.Id);
                    result.CreatedCount++;

                    // Persist the "Old MQL" suggestion on the OLD device so the Transfer screen can show it later
                    // (GET /api/Device/{oldId}/replacement-suggestion).
                    if (row.ResolvedOldDeviceId.HasValue)
                    {
                        await _deviceService.SetSuggestedNewDeviceAsync(row.ResolvedOldDeviceId.Value, created.Id);
                    }

                    // The new Device has no config yet, so create one whenever any of the 5 config columns is filled.
                    if (HasAnyConfigurationValue(row))
                    {
                        await _deviceConfigurationService.CreateAsync(new CreateDeviceConfigurationDto
                        {
                            DeviceId = created.Id,
                            Maker = row.Maker,
                            Model = row.Model,
                            Cpu = row.Cpu,
                            Ram = row.Ram,
                            HardDrive = row.HardDrive
                        });
                        result.CreatedConfigCount++;
                    }

                    // Transfer stays a manual step (POST /api/TransferHistory): which old device gets replaced may change at installation.
                    if (row.ResolvedOldDeviceId.HasValue)
                    {
                        result.PendingTransfers.Add(new DeviceImportPendingTransferDto
                        {
                            NewDeviceId = created.Id,
                            NewDeviceCode = row.DeviceCode!,
                            OldDeviceId = row.ResolvedOldDeviceId.Value,
                            OldDeviceCode = row.OldDeviceCode!
                        });
                    }
                }

                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            return result;
        }

        // Only template columns are touched: Branch/DeviceType/Supplier/PurchaseDate always; Note/SerialNumber when not empty.
        // An empty cell must not erase data entered by hand on the Device screen.
        private async Task UpdateExistingDeviceFromRowAsync(DeviceImportRowDto row, DeviceImportConfirmResultDto result)
        {
            var deviceId = row.ResolvedExistingDeviceId!.Value;

            var device = (await _unitOfWork.Devices.GetByIdAsync(deviceId)).OrThrowNotFound("Thiết bị", deviceId);

            device!.BranchId = row.ResolvedBranchId!.Value;
            device.DeviceTypeId = row.ResolvedDeviceTypeId!.Value;
            device.SupplierId = row.ResolvedSupplierId!.Value;
            device.PurchaseDate = row.PurchaseDate!.Value;
            // DepreciationMonths is kept as-is (not in the file), so the expiry date follows the new
            // purchase date using the device's own depreciation period.
            device.ExpirationDate = row.PurchaseDate!.Value.AddMonths(device.DepreciationMonths);

            if (!string.IsNullOrWhiteSpace(row.Note)) device.Note = row.Note;
            if (!string.IsNullOrWhiteSpace(row.SerialNumber)) device.SerialNumber = row.SerialNumber;

            _unitOfWork.Devices.Update(device);
            await _unitOfWork.SaveChangesAsync();

            result.UpdatedCount++;
            result.UpdatedDeviceIds.Add(deviceId);

            await UpsertConfigurationFromRowAsync(deviceId, row, result);

            if (row.ResolvedOldDeviceId.HasValue)
            {
                await _deviceService.SetSuggestedNewDeviceAsync(row.ResolvedOldDeviceId.Value, deviceId);

                result.PendingTransfers.Add(new DeviceImportPendingTransferDto
                {
                    NewDeviceId = deviceId,
                    NewDeviceCode = row.DeviceCode!,
                    OldDeviceId = row.ResolvedOldDeviceId.Value,
                    OldDeviceCode = row.OldDeviceCode!
                });
            }
        }

        // Only the 5 template config columns are overwritten (when not empty); same rule as the Tanium import.
        private async Task UpsertConfigurationFromRowAsync(int deviceId, DeviceImportRowDto row, DeviceImportConfirmResultDto result)
        {
            if (!HasAnyConfigurationValue(row)) return;

            var existingConfig = await _deviceConfigurationService.GetByDeviceIdAsync(deviceId);
            if (existingConfig == null)
            {
                await _deviceConfigurationService.CreateAsync(new CreateDeviceConfigurationDto
                {
                    DeviceId = deviceId,
                    Maker = row.Maker,
                    Model = row.Model,
                    Cpu = row.Cpu,
                    Ram = row.Ram,
                    HardDrive = row.HardDrive
                });
                result.CreatedConfigCount++;
                return;
            }

            await _deviceConfigurationService.UpdateAsync(new UpdateDeviceConfigurationDto
            {
                Id = existingConfig.Id,
                DeviceId = deviceId,
                Maker = string.IsNullOrWhiteSpace(row.Maker) ? existingConfig.Maker : row.Maker,
                Model = string.IsNullOrWhiteSpace(row.Model) ? existingConfig.Model : row.Model,
                Cpu = string.IsNullOrWhiteSpace(row.Cpu) ? existingConfig.Cpu : row.Cpu,
                Ram = string.IsNullOrWhiteSpace(row.Ram) ? existingConfig.Ram : row.Ram,
                HardDrive = string.IsNullOrWhiteSpace(row.HardDrive) ? existingConfig.HardDrive : row.HardDrive,
                Mainboard = existingConfig.Mainboard,
                Monitor = existingConfig.Monitor,
                Mouse = existingConfig.Mouse,
                Keyboard = existingConfig.Keyboard,
                Headphone = existingConfig.Headphone,
                Speaker = existingConfig.Speaker,
                Ups = existingConfig.Ups,
                Psu = existingConfig.Psu,
                Os = existingConfig.Os,
                Vga = existingConfig.Vga,
                PowerAdapter = existingConfig.PowerAdapter,
                WirelessCard = existingConfig.WirelessCard,
                Nic = existingConfig.Nic,
                Other = existingConfig.Other,
                Note = existingConfig.Note
            });
            result.UpdatedConfigCount++;
        }

        private static bool HasAnyConfigurationValue(DeviceImportRowDto row) =>
            !string.IsNullOrWhiteSpace(row.Maker) || !string.IsNullOrWhiteSpace(row.Model) ||
            !string.IsNullOrWhiteSpace(row.Cpu) || !string.IsNullOrWhiteSpace(row.Ram) ||
            !string.IsNullOrWhiteSpace(row.HardDrive);

        private async Task<List<DeviceImportRowDto>> ValidateAndResolveRowsAsync(List<DeviceImportRowDto> rawRows)
        {
            var branches = await _unitOfWork.Branches.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.BranchCode });
            var deviceTypes = await _unitOfWork.DeviceTypes.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.TypeCode });
            var suppliers = await _unitOfWork.Suppliers.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.SupplierCode });

            var duplicatedCodesInFile = FindDuplicates(rawRows, r => r.DeviceCode);
            var duplicatedOldCodesInFile = FindDuplicates(rawRows, r => r.OldDeviceCode);
            var duplicatedSerialsInFile = FindDuplicates(rawRows, r => r.SerialNumber);

            // No !IsDeleted filter: the DeviceCode unique index is global, so soft-deleted rows still hold the code.
            var candidateCodes = rawRows
                .Select(r => r.DeviceCode?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var devicesByCode = (await _unitOfWork.Devices.FindAsync(x => candidateCodes.Contains(x.DeviceCode)))
                .GroupBy(x => x.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var candidateSerials = rawRows
                .Select(r => string.IsNullOrWhiteSpace(r.SerialNumber) ? null : r.SerialNumber.Trim())
                .Where(s => s != null)
                .Select(s => s!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var deviceIdsBySerial = (await _unitOfWork.Devices.SelectAsync(
                    x => candidateSerials.Contains(x.SerialNumber!),
                    x => new { x.Id, x.SerialNumber }))
                .GroupBy(x => x.SerialNumber!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList(), StringComparer.OrdinalIgnoreCase);

            var candidateOldCodes = rawRows
                .Select(r => r.OldDeviceCode?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var oldDeviceIdsByCode = (await _unitOfWork.Devices.SelectAsync(
                    x => !x.IsDeleted && candidateOldCodes.Contains(x.DeviceCode),
                    x => new { x.Id, x.DeviceCode }))
                .GroupBy(x => x.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            var result = new List<DeviceImportRowDto>();

            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var deviceCode = row.DeviceCode?.Trim();

                // Id of the device this row will UPDATE (null = create a new one). See the upsert
                // rule on DeviceImportRowDto.ResolvedExistingDeviceId.
                int? existingDeviceId = null;

                if (string.IsNullOrWhiteSpace(deviceCode))
                {
                    errors.Add("Thiếu MQL (mã thiết bị).");
                }
                else
                {
                    if (duplicatedCodesInFile.Contains(deviceCode))
                        errors.Add($"MQL '{deviceCode}' bị lặp lại nhiều dòng trong file.");

                    // Not filtered by IsDeleted on purpose: the unique index on DeviceCode is global,
                    // so a soft-deleted device still owns the code and blocks the row.
                    var existingDevice = devicesByCode.GetValueOrDefault(deviceCode);
                    if (existingDevice != null)
                    {
                        if (existingDevice.IsDeleted)
                        {
                            errors.Add($"Mã thiết bị '{deviceCode}' đã tồn tại nhưng đã bị xóa, không thể import lại.");
                        }
                        else if (existingDevice.Status != (int)DeviceStatus.PendingUse)
                        {
                            errors.Add($"Thiết bị '{deviceCode}' đang ở trạng thái '{existingDevice.Status.GetDeviceStatusText()}', chỉ cập nhật được thiết bị đang '{DeviceStatus.PendingUse.GetDisplayText()}'.");
                        }
                        else
                        {
                            existingDeviceId = existingDevice.Id;
                        }
                    }
                }

                int? branchId = null;
                var branchCode = row.BranchCode?.Trim();
                if (string.IsNullOrWhiteSpace(branchCode))
                {
                    errors.Add("Thiếu Mã Xưởng.");
                }
                else
                {
                    var branch = branches.FirstOrDefault(b => string.Equals(b.BranchCode, branchCode, StringComparison.OrdinalIgnoreCase));
                    if (branch == null) errors.Add($"Không tìm thấy Xưởng có mã '{branchCode}'.");
                    else branchId = branch.Id;
                }

                int? deviceTypeId = null;
                var deviceTypeCode = row.DeviceTypeCode?.Trim();
                if (string.IsNullOrWhiteSpace(deviceTypeCode))
                {
                    errors.Add("Thiếu Mã Loại Thiết Bị.");
                }
                else
                {
                    var deviceType = deviceTypes.FirstOrDefault(d => string.Equals(d.TypeCode, deviceTypeCode, StringComparison.OrdinalIgnoreCase));
                    if (deviceType == null) errors.Add($"Không tìm thấy Loại Thiết Bị có mã '{deviceTypeCode}'.");
                    else deviceTypeId = deviceType.Id;
                }

                int? supplierId = null;
                var supplierCode = row.SupplierCode?.Trim();
                if (string.IsNullOrWhiteSpace(supplierCode))
                {
                    errors.Add("Thiếu Mã Nhà Cung Cấp.");
                }
                else
                {
                    var supplier = suppliers.FirstOrDefault(s => string.Equals(s.SupplierCode, supplierCode, StringComparison.OrdinalIgnoreCase));
                    if (supplier == null) errors.Add($"Không tìm thấy Nhà Cung Cấp có mã '{supplierCode}'.");
                    else supplierId = supplier.Id;
                }

                if (!row.PurchaseDate.HasValue)
                    errors.Add("Thiếu hoặc sai định dạng Ngày Mua.");

                var serialNumber = string.IsNullOrWhiteSpace(row.SerialNumber) ? null : row.SerialNumber.Trim();
                if (serialNumber != null)
                {
                    if (duplicatedSerialsInFile.Contains(serialNumber))
                        errors.Add($"Số Serial '{serialNumber}' bị lặp lại nhiều dòng trong file.");

                    // On an update row the device may already own this serial — only a DIFFERENT
                    // device holding it is a conflict.
                    if (deviceIdsBySerial.TryGetValue(serialNumber, out var serialOwnerIds)
                        && serialOwnerIds.Any(id => id != existingDeviceId))
                        errors.Add($"Số Serial '{serialNumber}' đã tồn tại trong hệ thống.");
                }

                int? oldDeviceId = null;
                var oldDeviceCode = row.OldDeviceCode?.Trim();
                if (!string.IsNullOrWhiteSpace(oldDeviceCode))
                {
                    if (!string.IsNullOrWhiteSpace(deviceCode) && string.Equals(oldDeviceCode, deviceCode, StringComparison.OrdinalIgnoreCase))
                    {
                        errors.Add("MQL Cũ không được trùng với MQL mới.");
                    }
                    else if (duplicatedOldCodesInFile.Contains(oldDeviceCode))
                    {
                        errors.Add($"MQL Cũ '{oldDeviceCode}' được dùng để thay thế ở nhiều dòng trong file.");
                    }
                    else
                    {
                        if (oldDeviceIdsByCode.TryGetValue(oldDeviceCode, out var foundOldDeviceId)) oldDeviceId = foundOldDeviceId;
                        else errors.Add($"Không tìm thấy thiết bị cũ có mã '{oldDeviceCode}'.");
                    }
                }

                result.Add(new DeviceImportRowDto
                {
                    RowNumber = row.RowNumber,
                    DeviceCode = deviceCode,
                    BranchCode = branchCode,
                    DeviceTypeCode = deviceTypeCode,
                    SupplierCode = supplierCode,
                    PurchaseDate = row.PurchaseDate,
                    Note = row.Note,
                    SerialNumber = serialNumber,
                    Maker = row.Maker,
                    Model = row.Model,
                    Cpu = row.Cpu,
                    Ram = row.Ram,
                    HardDrive = row.HardDrive,
                    OldDeviceCode = oldDeviceCode,
                    ResolvedBranchId = branchId,
                    ResolvedDeviceTypeId = deviceTypeId,
                    ResolvedSupplierId = supplierId,
                    ResolvedOldDeviceId = oldDeviceId,
                    ResolvedExistingDeviceId = existingDeviceId,
                    IsValid = errors.Count == 0,
                    Errors = errors
                });
            }

            return result;
        }

        private static HashSet<string> FindDuplicates(List<DeviceImportRowDto> rows, Func<DeviceImportRowDto, string?> selector)
        {
            return rows
                .Select(selector)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v!.Trim())
                .GroupBy(v => v, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private static DeviceImportPreviewResultDto BuildPreviewResult(List<DeviceImportRowDto> rows) => new()
        {
            Rows = rows,
            TotalRows = rows.Count,
            ValidRows = rows.Count(r => r.IsValid),
            InvalidRows = rows.Count(r => !r.IsValid)
        };

        // Columns: A=MQL, B=BranchCode, C=TypeCode, D=SupplierCode, E=Purchase Date, F=Note, G=Serial Number,
        // H=Maker, I=Model, J=CPU, K=RAM, L=Hard Drive, M=Old MQL. Row 1 is the header.
        private static List<DeviceImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                // ClosedXML throws various exceptions on invalid/corrupt files; map to a clear 400 instead of a generic 500.
                throw new DomainException("File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx hoặc .csv).");
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<DeviceImportRowDto>();
            if (usedRange == null) return rows;

            foreach (var xlRow in usedRange.RowsUsed().Skip(1))
            {
                var deviceCode = xlRow.Cell(1).GetString().Trim();
                var branchCode = xlRow.Cell(2).GetString().Trim();
                var deviceTypeCode = xlRow.Cell(3).GetString().Trim();
                var supplierCode = xlRow.Cell(4).GetString().Trim();
                var dateCell = xlRow.Cell(5);
                var note = xlRow.Cell(6).GetString().Trim();
                var serialNumber = xlRow.Cell(7).GetString().Trim();
                var maker = xlRow.Cell(8).GetString().Trim();
                var model = xlRow.Cell(9).GetString().Trim();
                var cpu = xlRow.Cell(10).GetString().Trim();
                var ram = xlRow.Cell(11).GetString().Trim();
                var hardDrive = xlRow.Cell(12).GetString().Trim();
                var oldDeviceCode = xlRow.Cell(13).GetString().Trim();

                var isRowEmpty = string.IsNullOrWhiteSpace(deviceCode) && string.IsNullOrWhiteSpace(branchCode) &&
                    string.IsNullOrWhiteSpace(deviceTypeCode) && string.IsNullOrWhiteSpace(supplierCode) &&
                    string.IsNullOrWhiteSpace(note) && string.IsNullOrWhiteSpace(serialNumber) &&
                    string.IsNullOrWhiteSpace(maker) && string.IsNullOrWhiteSpace(model) &&
                    string.IsNullOrWhiteSpace(cpu) && string.IsNullOrWhiteSpace(ram) &&
                    string.IsNullOrWhiteSpace(hardDrive) &&
                    string.IsNullOrWhiteSpace(oldDeviceCode) && dateCell.IsEmpty();
                if (isRowEmpty) continue;

                DateTime? purchaseDate = null;
                if (!dateCell.IsEmpty())
                {
                    if (dateCell.DataType == XLDataType.DateTime)
                    {
                        purchaseDate = dateCell.GetDateTime();
                    }
                    else if (TryParsePurchaseDate(dateCell.GetString(), out var parsedDate))
                    {
                        purchaseDate = parsedDate;
                    }
                }

                rows.Add(new DeviceImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    DeviceCode = string.IsNullOrWhiteSpace(deviceCode) ? null : deviceCode,
                    BranchCode = string.IsNullOrWhiteSpace(branchCode) ? null : branchCode,
                    DeviceTypeCode = string.IsNullOrWhiteSpace(deviceTypeCode) ? null : deviceTypeCode,
                    SupplierCode = string.IsNullOrWhiteSpace(supplierCode) ? null : supplierCode,
                    PurchaseDate = purchaseDate,
                    Note = string.IsNullOrWhiteSpace(note) ? null : note,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
                    Maker = string.IsNullOrWhiteSpace(maker) ? null : maker,
                    Model = string.IsNullOrWhiteSpace(model) ? null : model,
                    Cpu = string.IsNullOrWhiteSpace(cpu) ? null : cpu,
                    Ram = string.IsNullOrWhiteSpace(ram) ? null : ram,
                    HardDrive = string.IsNullOrWhiteSpace(hardDrive) ? null : hardDrive,
                    OldDeviceCode = string.IsNullOrWhiteSpace(oldDeviceCode) ? null : oldDeviceCode
                });
            }

            return rows;
        }

        // Same columns as ParseXlsx; CSV has no real dates, so Purchase Date always goes through TryParsePurchaseDate.
        private static List<DeviceImportRowDto> ParseCsv(Stream stream)
        {
            var csvRows = CsvFileHelper.ReadRows(stream);
            var rows = new List<DeviceImportRowDto>();

            for (int i = 1; i < csvRows.Count; i++)
            {
                var cells = csvRows[i];
                var deviceCode = GetCsvCell(cells, 0);
                var branchCode = GetCsvCell(cells, 1);
                var deviceTypeCode = GetCsvCell(cells, 2);
                var supplierCode = GetCsvCell(cells, 3);
                var dateText = GetCsvCell(cells, 4);
                var note = GetCsvCell(cells, 5);
                var serialNumber = GetCsvCell(cells, 6);
                var maker = GetCsvCell(cells, 7);
                var model = GetCsvCell(cells, 8);
                var cpu = GetCsvCell(cells, 9);
                var ram = GetCsvCell(cells, 10);
                var hardDrive = GetCsvCell(cells, 11);
                var oldDeviceCode = GetCsvCell(cells, 12);

                var isRowEmpty = string.IsNullOrWhiteSpace(deviceCode) && string.IsNullOrWhiteSpace(branchCode) &&
                    string.IsNullOrWhiteSpace(deviceTypeCode) && string.IsNullOrWhiteSpace(supplierCode) &&
                    string.IsNullOrWhiteSpace(note) && string.IsNullOrWhiteSpace(serialNumber) &&
                    string.IsNullOrWhiteSpace(maker) && string.IsNullOrWhiteSpace(model) &&
                    string.IsNullOrWhiteSpace(cpu) && string.IsNullOrWhiteSpace(ram) &&
                    string.IsNullOrWhiteSpace(hardDrive) &&
                    string.IsNullOrWhiteSpace(oldDeviceCode) && string.IsNullOrWhiteSpace(dateText);
                if (isRowEmpty) continue;

                DateTime? purchaseDate = null;
                if (!string.IsNullOrWhiteSpace(dateText) && TryParsePurchaseDate(dateText, out var parsedDate))
                    purchaseDate = parsedDate;

                rows.Add(new DeviceImportRowDto
                {
                    RowNumber = i + 1,
                    DeviceCode = string.IsNullOrWhiteSpace(deviceCode) ? null : deviceCode,
                    BranchCode = string.IsNullOrWhiteSpace(branchCode) ? null : branchCode,
                    DeviceTypeCode = string.IsNullOrWhiteSpace(deviceTypeCode) ? null : deviceTypeCode,
                    SupplierCode = string.IsNullOrWhiteSpace(supplierCode) ? null : supplierCode,
                    PurchaseDate = purchaseDate,
                    Note = string.IsNullOrWhiteSpace(note) ? null : note,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
                    Maker = string.IsNullOrWhiteSpace(maker) ? null : maker,
                    Model = string.IsNullOrWhiteSpace(model) ? null : model,
                    Cpu = string.IsNullOrWhiteSpace(cpu) ? null : cpu,
                    Ram = string.IsNullOrWhiteSpace(ram) ? null : ram,
                    HardDrive = string.IsNullOrWhiteSpace(hardDrive) ? null : hardDrive,
                    OldDeviceCode = string.IsNullOrWhiteSpace(oldDeviceCode) ? null : oldDeviceCode
                });
            }

            return rows;
        }

        private static string GetCsvCell(string[] cells, int index) => index < cells.Length ? cells[index] : string.Empty;

        // Fixed format rather than server CurrentCulture, which could swap day/month.
        private const string PurchaseDateFormat = "dd/MM/yyyy";

        private static bool TryParsePurchaseDate(string value, out DateTime result)
        {
            return DateTime.TryParseExact(
                value.Trim(),
                PurchaseDateFormat,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out result);
        }
    }
}
