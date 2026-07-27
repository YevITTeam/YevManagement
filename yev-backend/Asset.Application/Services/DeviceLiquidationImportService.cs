using Asset.Application.Dtos.DeviceLiquidationImports;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    // Import an Excel/CSV of device codes to mark them as liquidated (Status -> Liquidated) in bulk
    // (2026-07-23). Two steps like the other imports (preview -> confirm). Business rules (user decision):
    //   - a device can only be liquidated FROM the "Chờ thanh lý" (PendingLiquidation) state; any other
    //     state is rejected on that row (skip-and-report, does not block the batch);
    //   - liquidating a device also frees its IPs (back to Available) and soft-deletes its emails —
    //     it is treated as no longer in use, exactly like DeviceService.DeleteAsync.
    public class DeviceLiquidationImportService : BaseService<IAssetUnitOfWork>, IDeviceLiquidationImportService
    {
        public DeviceLiquidationImportService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<DeviceLiquidationImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null)
        {
            var rawRows = CsvFileHelper.HasCsvExtension(fileName) ? ParseCsv(excelFileStream) : ParseXlsx(excelFileStream);
            var validatedRows = await ValidateAndResolveRowsAsync(rawRows);
            return BuildPreviewResult(validatedRows);
        }

        public async Task<DeviceLiquidationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceLiquidationImportDto request)
        {
            // Re-validate against current DB data (don't trust the Id sent by the client) — the device
            // state may have changed since the user viewed the Preview.
            var validatedRows = await ValidateAndResolveRowsAsync(request.Rows);

            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            var validRows = validatedRows.Where(x => x.IsValid).ToList();

            var result = new DeviceLiquidationImportConfirmResultDto
            {
                SkippedCount = invalidRows.Count,
                SkippedRows = invalidRows
                    .Select(r => new DeviceLiquidationImportSkippedRowDto { RowNumber = r.RowNumber, DeviceCode = r.DeviceCode, Errors = r.Errors })
                    .ToList()
            };

            if (validRows.Count == 0) return result;

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                foreach (var row in validRows)
                {
                    var deviceId = row.ResolvedDeviceId!.Value;

                    var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
                    // A concurrent change could have moved it out of PendingLiquidation between the
                    // re-validation query and here — re-check to keep the invariant, skip if so.
                    if (device == null || device.Status != (int)DeviceStatus.PendingLiquidation)
                    {
                        result.SkippedCount++;
                        result.SkippedRows.Add(new DeviceLiquidationImportSkippedRowDto
                        {
                            RowNumber = row.RowNumber,
                            DeviceCode = row.DeviceCode,
                            Errors = new List<string> { "Trạng thái thiết bị đã thay đổi, không còn ở 'Chờ thanh lý'." }
                        });
                        continue;
                    }

                    device.Status = (int)DeviceStatus.Liquidated;
                    _unitOfWork.Devices.Update(device);

                    // Same cleanup as DeviceService.DeleteAsync: a liquidated device no longer holds
                    // any IP, and its emails are hidden.
                    var assignedIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);
                    foreach (var ip in assignedIps)
                    {
                        ip.DeviceId = null;
                        ip.Status = (int)IpAddressStatus.Available;
                        _unitOfWork.IpAddresses.Update(ip);
                        result.ReleasedIpCount++;
                    }

                    var emails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted);
                    foreach (var email in emails)
                    {
                        email.IsDeleted = true;
                        _unitOfWork.DeviceEmails.Update(email);
                    }

                    result.LiquidatedCount++;
                    result.LiquidatedDeviceIds.Add(deviceId);
                }

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            return result;
        }

        private async Task<List<DeviceLiquidationImportRowDto>> ValidateAndResolveRowsAsync(List<DeviceLiquidationImportRowDto> rawRows)
        {
            var duplicatedCodesInFile = rawRows
                .Select(r => r.DeviceCode?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var result = new List<DeviceLiquidationImportRowDto>();

            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var deviceCode = row.DeviceCode?.Trim();

                int? resolvedDeviceId = null;
                int? currentStatus = null;
                string? currentStatusText = null;

                if (string.IsNullOrWhiteSpace(deviceCode))
                {
                    errors.Add("Thiếu Mã máy (MQL).");
                }
                else
                {
                    if (duplicatedCodesInFile.Contains(deviceCode))
                        errors.Add($"Mã máy '{deviceCode}' bị lặp lại nhiều dòng trong file.");

                    var device = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == deviceCode && !x.IsDeleted);
                    if (device == null)
                    {
                        errors.Add($"Không tìm thấy thiết bị có mã '{deviceCode}'.");
                    }
                    else
                    {
                        resolvedDeviceId = device.Id;
                        currentStatus = device.Status;
                        currentStatusText = device.Status.GetDeviceStatusText();

                        if (device.Status == (int)DeviceStatus.Liquidated)
                            errors.Add($"Thiết bị '{deviceCode}' đã được thanh lý trước đó.");
                        else if (device.Status != (int)DeviceStatus.PendingLiquidation)
                            errors.Add($"Thiết bị '{deviceCode}' đang ở trạng thái '{currentStatusText}', chỉ thanh lý được thiết bị đang '{DeviceStatus.PendingLiquidation.GetDisplayText()}'.");
                    }
                }

                result.Add(new DeviceLiquidationImportRowDto
                {
                    RowNumber = row.RowNumber,
                    DeviceCode = deviceCode,
                    ResolvedDeviceId = resolvedDeviceId,
                    CurrentStatus = currentStatus,
                    CurrentStatusText = currentStatusText,
                    IsValid = errors.Count == 0,
                    Errors = errors
                });
            }

            return result;
        }

        private static DeviceLiquidationImportPreviewResultDto BuildPreviewResult(List<DeviceLiquidationImportRowDto> rows) => new()
        {
            Rows = rows,
            TotalRows = rows.Count,
            ValidRows = rows.Count(r => r.IsValid),
            InvalidRows = rows.Count(r => !r.IsValid)
        };

        // Single column A = Mã máy (MQL). Row 1 is the header.
        private static List<DeviceLiquidationImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                // ClosedXML throws various exception types for a corrupted/non-.xlsx file — normalize
                // to a single DomainException (400) instead of a generic 500, same as the other imports.
                throw new DomainException("File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx hoặc .csv).");
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<DeviceLiquidationImportRowDto>();
            if (usedRange == null) return rows;

            foreach (var xlRow in usedRange.RowsUsed().Skip(1))
            {
                var deviceCode = xlRow.Cell(1).GetString().Trim();
                if (string.IsNullOrWhiteSpace(deviceCode)) continue;

                rows.Add(new DeviceLiquidationImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    DeviceCode = deviceCode
                });
            }

            return rows;
        }

        // Same single column as ParseXlsx, read from .csv via the shared CsvFileHelper.
        private static List<DeviceLiquidationImportRowDto> ParseCsv(Stream stream)
        {
            var csvRows = CsvFileHelper.ReadRows(stream);
            var rows = new List<DeviceLiquidationImportRowDto>();

            for (int i = 1; i < csvRows.Count; i++)
            {
                var deviceCode = csvRows[i].Length > 0 ? csvRows[i][0].Trim() : string.Empty;
                if (string.IsNullOrWhiteSpace(deviceCode)) continue;

                rows.Add(new DeviceLiquidationImportRowDto
                {
                    RowNumber = i + 1,
                    DeviceCode = deviceCode
                });
            }

            return rows;
        }
    }
}
