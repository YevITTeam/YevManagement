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
        // The sample Excel file (see docs/asset-module.md) has no DeviceName/Manager/Email/
        // DepreciationMonths — per user decision (2026-07-10): DeviceName is taken from the MQL
        // (device code), Manager/Email are left blank (optional since 2026-08-01, see
        // CreateDeviceDto), DepreciationMonths defaults to 60 months, edit later via the Device
        // screen if needed.
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

            // Rows that still have errors are SKIPPED, no longer blocking the whole batch (2026-07-11,
            // changed per user request — previously any error row would throw a DomainException and
            // nothing would be saved). Only valid rows get a Device created.
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
                    // The MQL already exists and is still PendingUse -> update it instead of creating
                    // a duplicate (2026-07-23). Handled in a dedicated method because DeviceService.
                    // UpdateAsync would sync Emails/IpAddresses from the request and the Excel file
                    // carries neither — going through it would wipe them.
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

                    // Persist the "Old MQL" suggestion to the DB (2026-07-11, added afterward —
                    // previously it was only returned once in the Confirm response as PendingTransfers,
                    // not saved; 2026-07-13, reversed direction — writes the new device's Id directly
                    // into SuggestedNewDeviceId of the OLD device instead of setting ReplacesOldDeviceId
                    // on the new device) so the "Transfer Device" screen opened on the old device later
                    // can still automatically show this suggestion via
                    // GET /api/Device/{oldId}/replacement-suggestion, even though it isn't handled at import time.
                    if (row.ResolvedOldDeviceId.HasValue)
                    {
                        await _deviceService.SetSuggestedNewDeviceAsync(row.ResolvedOldDeviceId.Value, created.Id);
                    }

                    // Create an accompanying DeviceConfiguration if the Excel row has at least 1 of the
                    // 5 configuration columns (Maker/Model/CPU/RAM/HardDrive, new Excel template
                    // 2026-07-11) — the just-created Device definitely has no config yet, so always
                    // CreateAsync, no need to check existence like DeviceConfigurationImportService
                    // (which imports updates).
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

                    // No longer transfers the device automatically here (2026-07-11) — it's only a
                    // suggestion, the user manually clicks "Transfer" on a separate screen (calls
                    // POST /api/TransferHistory) because at import time it's only tentative — which
                    // old device gets replaced may still change once installation actually happens.
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

        // Updates a device that already exists with this MQL (validated as still PendingUse and not
        // deleted). Only the columns the Excel template actually carries are touched:
        //   overwritten always : Branch / DeviceType / Supplier / PurchaseDate (+ recomputed ExpirationDate)
        //   overwritten if the cell is not empty : Note / SerialNumber
        //   never touched : DeviceName, Manager, Emails, IpAddresses, DepreciationMonths, Status,
        //                   GroupId, DepartmentId, IsOutsourced, IsUseUsb
        // An empty cell must not erase data that was entered by hand on the Device screen.
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

        // Config for an update row: the device may already have a DeviceConfiguration, so only the 5
        // columns of the template are overwritten (and only when not empty), every other field of the
        // existing configuration is carried over untouched — same rule as the Tanium import.
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

            // Batch-fetch device-exists-by-code thay vì query từng dòng (file import có thể lên tới hàng
            // trăm dòng) — KHÔNG lọc !IsDeleted, giữ đúng hành vi cũ (unique index của DeviceCode là
            // global, bản ghi xoá mềm vẫn giữ chỗ mã đó — xem CLAUDE.md §3.4 mục 7).
            var candidateCodes = rawRows
                .Select(r => r.DeviceCode?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var devicesByCode = (await _unitOfWork.Devices.FindAsync(x => candidateCodes.Contains(x.DeviceCode)))
                .GroupBy(x => x.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

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
                    var existingSerial = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == serialNumber);
                    if (existingSerial != null && existingSerial.Id != existingDeviceId)
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
                        var oldDevice = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == oldDeviceCode && !x.IsDeleted);
                        if (oldDevice == null) errors.Add($"Không tìm thấy thiết bị cũ có mã '{oldDeviceCode}'.");
                        else oldDeviceId = oldDevice.Id;
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

        // Fixed columns matching the order of the current Excel template (2026-07-11, changed —
        // added 5 configuration columns): A=MQL, B=Branch, C=Device Type, D=Supplier, E=Purchase Date,
        // F=Note, G=Serial Number, H=Maker, I=Model, J=CPU, K=RAM, L=Hard Drive, M=Old MQL
        // (previously Old MQL was in column H — the old template had no configuration columns). Row 1 is the header.
        // 2026-07-13: column B (Branch)/D (Supplier) changed to enter the CODE (BranchCode/
        // SupplierCode) instead of the Name. 2026-07-23: column C (Device Type) followed suit —
        // it is now the TypeCode, so all 3 lookup columns are code-based.
        private static List<DeviceImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                // ClosedXML throws various exception types (FileFormatException,
                // InvalidOperationException...) when the file is not a valid .xlsx or is
                // corrupted — normalize to a single DomainException (400, with a clear message)
                // instead of letting it escape as a generic 500 error via HandleExceptionMiddleware.
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

        // Cùng 13 cột/thứ tự như ParseXlsx nhưng đọc từ file .csv (2026-07-11, thêm sau —
        // dùng CsvFileHelper chung, tự nhận diện dấu phẩy/chấm phẩy). CSV không có kiểu
        // Date thật như Excel nên Ngày Mua luôn parse qua TryParsePurchaseDate (dd/MM/yyyy),
        // giống hệt nhánh "cell text" của ParseXlsx.
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

        // Định dạng ngày mặc định duy nhất khi ô Excel là text: dd/MM/yyyy (không dùng
        // CurrentCulture của server — dễ hiểu nhầm ngày/tháng tuỳ môi trường chạy).
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
