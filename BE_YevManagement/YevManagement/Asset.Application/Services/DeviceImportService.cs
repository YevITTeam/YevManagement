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
        // File Excel mẫu (xem docs/asset-module.md) không có DeviceName/Manager/Email/
        // DepreciationMonths dù các trường này [Required] ở CreateDeviceDto — theo quyết
        // định của người dùng (2026-07-10): DeviceName lấy theo MQL, Manager/Email để
        // trống, DepreciationMonths mặc định 60 tháng, sửa lại sau qua màn hình Device
        // nếu cần.
        private const int DefaultDepreciationMonths = 60;

        private readonly IDeviceService _deviceService;

        public DeviceImportService(
            IAssetUnitOfWork unitOfWork,
            IDeviceService deviceService) : base(unitOfWork)
        {
            _deviceService = deviceService;
        }

        public async Task<DeviceImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null)
        {
            var rawRows = CsvFileHelper.HasCsvExtension(fileName) ? ParseCsv(excelFileStream) : ParseXlsx(excelFileStream);
            var validatedRows = await ValidateAndResolveRowsAsync(rawRows);
            return BuildPreviewResult(validatedRows);
        }

        public async Task<DeviceImportConfirmResultDto> ConfirmAsync(ConfirmDeviceImportDto request)
        {
            // Validate lại theo dữ liệu DB hiện tại (không tin Id do client gửi lên) —
            // phòng trường hợp dữ liệu đã đổi kể từ lúc người dùng xem bản Preview.
            var validatedRows = await ValidateAndResolveRowsAsync(request.Rows);
            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            if (invalidRows.Count > 0)
            {
                var errors = invalidRows
                    .SelectMany(r => r.Errors.Select(e => $"Dòng {r.RowNumber}: {e}"))
                    .ToList();
                throw new DomainException("Dữ liệu import không hợp lệ, vui lòng xem lại bản xem trước.", errors);
            }

            var result = new DeviceImportConfirmResultDto();

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                foreach (var row in validatedRows)
                {
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
                        Note = row.Note,
                        SerialNumber = row.SerialNumber
                    };

                    var created = await _deviceService.CreateAsync(createDto);
                    result.CreatedDeviceIds.Add(created.Id);
                    result.CreatedCount++;

                    // Không tự chuyển máy ở đây nữa (2026-07-11) — chỉ gợi ý, người dùng
                    // tự bấm "Chuyển" trên màn hình riêng (gọi POST /api/TransferHistory)
                    // vì lúc import chỉ là dự tính, có thể đổi ý máy cũ nào sẽ được thay khi
                    // thật sự lắp đặt.
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

        private async Task<List<DeviceImportRowDto>> ValidateAndResolveRowsAsync(List<DeviceImportRowDto> rawRows)
        {
            var branches = await _unitOfWork.Branches.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.BranchName });
            var deviceTypes = await _unitOfWork.DeviceTypes.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.TypeName });
            var suppliers = await _unitOfWork.Suppliers.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.SupplierName });

            var duplicatedCodesInFile = FindDuplicates(rawRows, r => r.DeviceCode);
            var duplicatedOldCodesInFile = FindDuplicates(rawRows, r => r.OldDeviceCode);
            var duplicatedSerialsInFile = FindDuplicates(rawRows, r => r.SerialNumber);

            var result = new List<DeviceImportRowDto>();

            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var deviceCode = row.DeviceCode?.Trim();

                if (string.IsNullOrWhiteSpace(deviceCode))
                {
                    errors.Add("Thiếu MQL (mã thiết bị).");
                }
                else
                {
                    if (duplicatedCodesInFile.Contains(deviceCode))
                        errors.Add($"MQL '{deviceCode}' bị lặp lại nhiều dòng trong file.");

                    var existingDevice = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == deviceCode);
                    if (existingDevice != null)
                        errors.Add($"Mã thiết bị '{deviceCode}' đã tồn tại trong hệ thống.");
                }

                int? branchId = null;
                var branchName = row.BranchName?.Trim();
                if (string.IsNullOrWhiteSpace(branchName))
                {
                    errors.Add("Thiếu Xưởng.");
                }
                else
                {
                    var branch = branches.FirstOrDefault(b => string.Equals(b.BranchName, branchName, StringComparison.OrdinalIgnoreCase));
                    if (branch == null) errors.Add($"Không tìm thấy Xưởng '{branchName}'.");
                    else branchId = branch.Id;
                }

                int? deviceTypeId = null;
                var deviceTypeName = row.DeviceTypeName?.Trim();
                if (string.IsNullOrWhiteSpace(deviceTypeName))
                {
                    errors.Add("Thiếu Loại Thiết Bị.");
                }
                else
                {
                    var deviceType = deviceTypes.FirstOrDefault(d => string.Equals(d.TypeName, deviceTypeName, StringComparison.OrdinalIgnoreCase));
                    if (deviceType == null) errors.Add($"Không tìm thấy Loại Thiết Bị '{deviceTypeName}'.");
                    else deviceTypeId = deviceType.Id;
                }

                int? supplierId = null;
                var supplierName = row.SupplierName?.Trim();
                if (string.IsNullOrWhiteSpace(supplierName))
                {
                    errors.Add("Thiếu Nhà Cung Cấp.");
                }
                else
                {
                    var supplier = suppliers.FirstOrDefault(s => string.Equals(s.SupplierName, supplierName, StringComparison.OrdinalIgnoreCase));
                    if (supplier == null) errors.Add($"Không tìm thấy Nhà Cung Cấp '{supplierName}'.");
                    else supplierId = supplier.Id;
                }

                if (!row.PurchaseDate.HasValue)
                    errors.Add("Thiếu hoặc sai định dạng Ngày Mua.");

                var serialNumber = string.IsNullOrWhiteSpace(row.SerialNumber) ? null : row.SerialNumber.Trim();
                if (serialNumber != null)
                {
                    if (duplicatedSerialsInFile.Contains(serialNumber))
                        errors.Add($"Số Serial '{serialNumber}' bị lặp lại nhiều dòng trong file.");

                    var existingSerial = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == serialNumber);
                    if (existingSerial != null)
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
                    BranchName = branchName,
                    DeviceTypeName = deviceTypeName,
                    SupplierName = supplierName,
                    PurchaseDate = row.PurchaseDate,
                    Note = row.Note,
                    SerialNumber = serialNumber,
                    OldDeviceCode = oldDeviceCode,
                    ResolvedBranchId = branchId,
                    ResolvedDeviceTypeId = deviceTypeId,
                    ResolvedSupplierId = supplierId,
                    ResolvedOldDeviceId = oldDeviceId,
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

        // Cột cố định theo đúng thứ tự template Excel hiện có (xem ảnh mẫu): A=MQL,
        // B=Xưởng, C=Loại Thiết Bị, D=Nhà Cung Cấp, E=Ngày Mua, F=Ghi Chú,
        // G=Số SerialNumber, H=MQL Cũ. Dòng 1 là header.
        private static List<DeviceImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                // ClosedXML ném nhiều loại exception khác nhau (FileFormatException,
                // InvalidOperationException...) khi file không phải .xlsx hợp lệ hoặc bị
                // hỏng — quy về 1 DomainException (400, thông báo rõ ràng) thay vì để lọt
                // ra ngoài thành lỗi 500 chung chung qua HandleExceptionMiddleware.
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
                var branchName = xlRow.Cell(2).GetString().Trim();
                var deviceTypeName = xlRow.Cell(3).GetString().Trim();
                var supplierName = xlRow.Cell(4).GetString().Trim();
                var dateCell = xlRow.Cell(5);
                var note = xlRow.Cell(6).GetString().Trim();
                var serialNumber = xlRow.Cell(7).GetString().Trim();
                var oldDeviceCode = xlRow.Cell(8).GetString().Trim();

                var isRowEmpty = string.IsNullOrWhiteSpace(deviceCode) && string.IsNullOrWhiteSpace(branchName) &&
                    string.IsNullOrWhiteSpace(deviceTypeName) && string.IsNullOrWhiteSpace(supplierName) &&
                    string.IsNullOrWhiteSpace(note) && string.IsNullOrWhiteSpace(serialNumber) &&
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
                    BranchName = string.IsNullOrWhiteSpace(branchName) ? null : branchName,
                    DeviceTypeName = string.IsNullOrWhiteSpace(deviceTypeName) ? null : deviceTypeName,
                    SupplierName = string.IsNullOrWhiteSpace(supplierName) ? null : supplierName,
                    PurchaseDate = purchaseDate,
                    Note = string.IsNullOrWhiteSpace(note) ? null : note,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
                    OldDeviceCode = string.IsNullOrWhiteSpace(oldDeviceCode) ? null : oldDeviceCode
                });
            }

            return rows;
        }

        // Cùng 8 cột/thứ tự như ParseXlsx nhưng đọc từ file .csv (2026-07-11, thêm sau —
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
                var branchName = GetCsvCell(cells, 1);
                var deviceTypeName = GetCsvCell(cells, 2);
                var supplierName = GetCsvCell(cells, 3);
                var dateText = GetCsvCell(cells, 4);
                var note = GetCsvCell(cells, 5);
                var serialNumber = GetCsvCell(cells, 6);
                var oldDeviceCode = GetCsvCell(cells, 7);

                var isRowEmpty = string.IsNullOrWhiteSpace(deviceCode) && string.IsNullOrWhiteSpace(branchName) &&
                    string.IsNullOrWhiteSpace(deviceTypeName) && string.IsNullOrWhiteSpace(supplierName) &&
                    string.IsNullOrWhiteSpace(note) && string.IsNullOrWhiteSpace(serialNumber) &&
                    string.IsNullOrWhiteSpace(oldDeviceCode) && string.IsNullOrWhiteSpace(dateText);
                if (isRowEmpty) continue;

                DateTime? purchaseDate = null;
                if (!string.IsNullOrWhiteSpace(dateText) && TryParsePurchaseDate(dateText, out var parsedDate))
                    purchaseDate = parsedDate;

                rows.Add(new DeviceImportRowDto
                {
                    RowNumber = i + 1,
                    DeviceCode = string.IsNullOrWhiteSpace(deviceCode) ? null : deviceCode,
                    BranchName = string.IsNullOrWhiteSpace(branchName) ? null : branchName,
                    DeviceTypeName = string.IsNullOrWhiteSpace(deviceTypeName) ? null : deviceTypeName,
                    SupplierName = string.IsNullOrWhiteSpace(supplierName) ? null : supplierName,
                    PurchaseDate = purchaseDate,
                    Note = string.IsNullOrWhiteSpace(note) ? null : note,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
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
