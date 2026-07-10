using System.Text.RegularExpressions;
using Asset.Application.Dtos.DeviceConfigurationImports;
using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    // Import cấu hình phần cứng hàng loạt từ file kiểm kê Tanium (Computer Name/Tanium
    // Client IP Address/Last Logged In User/Manufacturer/Model/CPU/RAM/Size). Khác với
    // DeviceImportService (tạo Device mới) — service này CHỈ cập nhật Device đã có sẵn,
    // không tự tạo Device mới (2026-07-10, theo quyết định người dùng: file Tanium không
    // có Xưởng/Loại thiết bị/Nhà cung cấp/Ngày mua nên không đủ dữ liệu để tạo Device hợp lệ).
    public class DeviceConfigurationImportService : BaseService<IAssetUnitOfWork>, IDeviceConfigurationImportService
    {
        // Chỉ 5 tiền tố này được import (2026-07-10, theo yêu cầu người dùng sau khi rà
        // dữ liệu Tanium thật; DA bị loại bỏ hoàn toàn theo quyết định mới nhất) — mọi
        // Computer Name không khớp 1 trong 5 "họ" dưới đây bị loại thầm lặng khỏi kết quả
        // (không phải lỗi, chỉ ngoài phạm vi), xem ParseComputerName.
        // "Họ" chuẩn: YDC/YLC/YDF/TYC + số (VD YDC1877, TYC08). "Họ" AC: AC + số + tối đa
        // 1 chữ cuối (VD AC81, AC90B) — KHÔNG khớp ACLF/ACELF/ALF (khác họ, chữ ngay sau "AC").
        private static readonly string[] StandardFamilyPrefixes = { "YDC", "YLC", "YDF", "TYC" };
        private static readonly Regex AcFamilyPattern = new(@"^AC\d+[A-Za-z]?$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly IDeviceConfigurationService _deviceConfigurationService;

        public DeviceConfigurationImportService(
            IAssetUnitOfWork unitOfWork,
            IDeviceConfigurationService deviceConfigurationService) : base(unitOfWork)
        {
            _deviceConfigurationService = deviceConfigurationService;
        }

        public async Task<DeviceConfigurationImportPreviewResultDto> PreviewAsync(Stream excelFileStream)
        {
            var rawRows = ParseExcel(excelFileStream);
            var (validatedRows, outOfScopeSkippedCount) = await ValidateAndResolveRowsAsync(rawRows);
            return BuildPreviewResult(validatedRows, outOfScopeSkippedCount);
        }

        public async Task<DeviceConfigurationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceConfigurationImportDto request)
        {
            // Validate lại theo dữ liệu DB hiện tại (không tin Id do client gửi lên) —
            // phòng trường hợp dữ liệu đã đổi kể từ lúc người dùng xem bản Preview.
            var (validatedRows, _) = await ValidateAndResolveRowsAsync(request.Rows);
            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            if (invalidRows.Count > 0)
            {
                var errors = invalidRows
                    .SelectMany(r => r.Errors.Select(e => $"Dòng {r.RowNumber}: {e}"))
                    .ToList();
                throw new DomainException("Dữ liệu import không hợp lệ, vui lòng xem lại bản xem trước.", errors);
            }

            var result = new DeviceConfigurationImportConfirmResultDto();

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                foreach (var row in validatedRows)
                {
                    var deviceId = row.ResolvedDeviceId!.Value;

                    if (row.ResolvedIpAddressId.HasValue)
                    {
                        var reassigned = await ReassignDeviceIpAsync(deviceId, row.ResolvedIpAddressId.Value);
                        if (reassigned) result.IpReassignedCount++;
                    }

                    var existingConfig = await _deviceConfigurationService.GetByDeviceIdAsync(deviceId);
                    if (existingConfig == null)
                    {
                        await _deviceConfigurationService.CreateAsync(new CreateDeviceConfigurationDto
                        {
                            DeviceId = deviceId,
                            Cpu = row.Cpu,
                            Ram = row.Ram,
                            HardDrive = row.Size,
                            Maker = row.Manufacturer,
                            Model = row.Model
                        });
                        result.CreatedConfigCount++;
                    }
                    else
                    {
                        await _deviceConfigurationService.UpdateAsync(new UpdateDeviceConfigurationDto
                        {
                            Id = existingConfig.Id,
                            DeviceId = deviceId,
                            // Chỉ ghi đè 5 field Tanium báo cáo được, giữ nguyên toàn bộ field
                            // còn lại của cấu hình đã có (Mainboard/Monitor/Mouse/...).
                            Cpu = string.IsNullOrWhiteSpace(row.Cpu) ? existingConfig.Cpu : row.Cpu,
                            Ram = string.IsNullOrWhiteSpace(row.Ram) ? existingConfig.Ram : row.Ram,
                            HardDrive = string.IsNullOrWhiteSpace(row.Size) ? existingConfig.HardDrive : row.Size,
                            Maker = string.IsNullOrWhiteSpace(row.Manufacturer) ? existingConfig.Maker : row.Manufacturer,
                            Model = string.IsNullOrWhiteSpace(row.Model) ? existingConfig.Model : row.Model,
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

                    result.UpdatedDeviceIds.Add(deviceId);
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

        // Gán IP (đã xác định Available hoặc đã thuộc đúng device này) làm IP chính của
        // device — gỡ IP cũ (nếu khác) về Available trước, giống pattern DeviceService.UpdateAsync.
        // Trả về true nếu có thay đổi thực sự (để đếm IpReassignedCount).
        private async Task<bool> ReassignDeviceIpAsync(int deviceId, int newIpAddressId)
        {
            var currentIp = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.DeviceId == deviceId && !x.IsDeleted);
            if (currentIp?.Id == newIpAddressId) return false;

            if (currentIp != null)
            {
                currentIp.DeviceId = null;
                currentIp.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(currentIp);
            }

            var newIp = await _unitOfWork.IpAddresses.GetByIdAsync(newIpAddressId);
            newIp!.DeviceId = deviceId;
            newIp.Status = (int)IpAddressStatus.Assigned;
            _unitOfWork.IpAddresses.Update(newIp);

            return true;
        }

        private async Task<(List<DeviceConfigurationImportRowDto> Rows, int OutOfScopeSkippedCount)> ValidateAndResolveRowsAsync(List<DeviceConfigurationImportRowDto> rawRows)
        {
            var duplicatedCodesInFile = rawRows
                .Select(r => ParseComputerName(r.ComputerName ?? string.Empty).Code)
                .Where(c => c != null)
                .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var result = new List<DeviceConfigurationImportRowDto>();
            var outOfScopeSkippedCount = 0;

            foreach (var row in rawRows)
            {
                var (parsedCode, parsedName) = ParseComputerName(row.ComputerName ?? string.Empty);
                if (parsedCode == null)
                {
                    // Không khớp 5 họ mã cần import (YDC/YLC/YDF/AC/TYC) — loại thầm
                    // lặng, không phải lỗi, không đưa vào kết quả trả về.
                    outOfScopeSkippedCount++;
                    continue;
                }

                var errors = new List<string>();

                if (IsTaniumErrorRow(row))
                {
                    errors.Add("Dòng bị lỗi Tanium (agent không thu thập được dữ liệu cho máy này).");
                }

                int? resolvedDeviceId = null;
                if (duplicatedCodesInFile.Contains(parsedCode))
                    errors.Add($"Mã thiết bị '{parsedCode}' bị lặp lại nhiều dòng trong file.");

                var device = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == parsedCode && !x.IsDeleted);
                if (device == null) errors.Add($"Không tìm thấy thiết bị có mã '{parsedCode}'.");
                else resolvedDeviceId = device.Id;

                // Quy tắc IP (2026-07-10, quyết định người dùng): IP Tanium báo cáo LUÔN
                // được cập nhật vào Device này, kể cả khi IP đó hiện đang gán cho 1 device
                // khác trong DB (tự động "chiếm lại" — ReassignDeviceIpAsync sẽ gỡ IP khỏi
                // device cũ và gán cho device này, không cần phân biệt Available/Reserved/
                // Disabled). Trường hợp DUY NHẤT không cập nhật IP: IP đó không tồn tại
                // trong DB — khi đó chỉ bỏ qua việc cập nhật IP và báo Warning (không chặn
                // dòng, các field cấu hình khác vẫn được tạo/cập nhật bình thường).
                int? resolvedIpAddressId = null;
                var warnings = new List<string>();
                var taniumIp = row.TaniumIpAddress?.Trim();
                if (!string.IsNullOrWhiteSpace(taniumIp) && !errors.Any(e => e.StartsWith("Dòng bị lỗi Tanium")))
                {
                    var ipAddress = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.IpAddress1 == taniumIp && !x.IsDeleted);
                    if (ipAddress == null)
                    {
                        warnings.Add($"Không tìm thấy địa chỉ IP '{taniumIp}' trong hệ thống — sẽ không cập nhật IP cho thiết bị này.");
                    }
                    else
                    {
                        resolvedIpAddressId = ipAddress.Id;
                    }
                }

                result.Add(new DeviceConfigurationImportRowDto
                {
                    RowNumber = row.RowNumber,
                    ComputerName = row.ComputerName,
                    TaniumIpAddress = taniumIp,
                    Manufacturer = row.Manufacturer,
                    Model = row.Model,
                    Cpu = row.Cpu,
                    Ram = row.Ram,
                    Size = row.Size,
                    ParsedDeviceCode = parsedCode,
                    ParsedDeviceName = parsedName,
                    ResolvedDeviceId = resolvedDeviceId,
                    ResolvedIpAddressId = resolvedIpAddressId,
                    IsValid = errors.Count == 0,
                    Errors = errors,
                    Warnings = warnings
                });
            }

            return (result, outOfScopeSkippedCount);
        }

        private static bool IsTaniumErrorRow(DeviceConfigurationImportRowDto row)
        {
            return HasTaniumErrorPrefix(row.TaniumIpAddress) || HasTaniumErrorPrefix(row.Manufacturer) ||
                HasTaniumErrorPrefix(row.Model) || HasTaniumErrorPrefix(row.Cpu) ||
                HasTaniumErrorPrefix(row.Ram) || HasTaniumErrorPrefix(row.Size);
        }

        private static bool HasTaniumErrorPrefix(string? value) =>
            !string.IsNullOrWhiteSpace(value) && value.TrimStart().StartsWith("TSE-Error", StringComparison.OrdinalIgnoreCase);

        private static DeviceConfigurationImportPreviewResultDto BuildPreviewResult(List<DeviceConfigurationImportRowDto> rows, int outOfScopeSkippedCount) => new()
        {
            Rows = rows,
            TotalRows = rows.Count,
            ValidRows = rows.Count(r => r.IsValid),
            InvalidRows = rows.Count(r => !r.IsValid),
            OutOfScopeSkippedCount = outOfScopeSkippedCount
        };

        // Tách "Computer Name" thành (Mã, Tên) — chỉ nhận đúng 5 "họ" mã theo yêu cầu
        // người dùng (2026-07-10, sau khi rà toàn bộ dữ liệu Tanium thật), mọi Computer
        // Name khác trả về (null, null) — bị loại thầm lặng ở ValidateAndResolveRowsAsync
        // (không phải lỗi, chỉ ngoài phạm vi import lần này):
        // 1. Bỏ hậu tố domain (phần sau dấu "." đầu tiên, VD ".yev.vn").
        // 2. Tách theo dấu "-".
        // 3. Đoạn đầu khớp YDC/YLC/YDF/TYC + số (số có thể rỗng, VD "YDC-TVSOC" không có
        //    số) → Mã = chèn dấu "-" giữa chữ và số (YDC1877 -> YDC-1877), Tên = phần còn
        //    lại nối bằng "-".
        // 4. Đoạn đầu khớp "AC" + số + tối đa 1 chữ cuối (AC81, AC90, AC90B...) → mã gốc
        //    đã có dấu "-" sẵn bên trong: Mã = nối 2 đoạn đầu (AC90B-2446), Tên = giống Mã,
        //    đoạn còn lại (VD "J19") bị bỏ. Áp dụng thống nhất theo tiền tố "AC" (không theo
        //    cấu trúc chữ/số của từng đoạn) — tránh bug AC81/AC90/AC95 vô tình khớp "họ
        //    chuẩn" khác kiểu AC90B/AC90D dẫn tới tách không nhất quán trong cùng 1 họ.
        // 5. Còn lại (Mayhethong, VNDASOLARWINDS, BTTB-ATO-xx, DESKTOP-xxxx, ACLF/ACELF/
        //    ALF-xx, yazaki-xx, DA-xxx, DA-ENG-xxx...) → (null, null), ngoài phạm vi 5 họ
        //    cần import lần này (họ "DA" bị loại bỏ hoàn toàn theo quyết định người dùng
        //    2026-07-10 — ban đầu chỉ định loại "DA-ENG-<serial>" 3 đoạn, sau đó chốt lại
        //    là loại bỏ CẢ họ DA, kể cả dạng 2 đoạn "DA-<serial>").
        private static (string? Code, string? Name) ParseComputerName(string rawComputerName)
        {
            var name = rawComputerName.Trim();
            var dotIndex = name.IndexOf('.');
            if (dotIndex >= 0) name = name[..dotIndex];

            var segments = name.Split('-', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) return (null, null);

            var firstSegment = segments[0];

            var standardPrefix = StandardFamilyPrefixes.FirstOrDefault(p =>
                firstSegment.StartsWith(p, StringComparison.OrdinalIgnoreCase) &&
                firstSegment[p.Length..].All(char.IsDigit));
            if (standardPrefix != null)
            {
                var digits = firstSegment[standardPrefix.Length..];
                var code = digits.Length > 0 ? $"{standardPrefix}-{digits}" : standardPrefix;
                var deviceName = segments.Length > 1 ? string.Join("-", segments.Skip(1)) : code;
                return (code, deviceName);
            }

            if (AcFamilyPattern.IsMatch(firstSegment))
            {
                var code = segments.Length > 1 ? $"{segments[0]}-{segments[1]}" : segments[0];
                return (code, code);
            }

            return (null, null);
        }

        // Cột cố định theo đúng thứ tự file kiểm kê Tanium: A=Computer Name, B=Tanium
        // Client IP Address, C=Last Logged In User (bỏ qua), D=Manufacturer, E=Model,
        // F=CPU, G=RAM, H=Size. Dòng 1 là header.
        private static List<DeviceConfigurationImportRowDto> ParseExcel(Stream stream)
        {
            using var workbook = new XLWorkbook(stream);
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<DeviceConfigurationImportRowDto>();
            if (usedRange == null) return rows;

            foreach (var xlRow in usedRange.RowsUsed().Skip(1))
            {
                var computerName = xlRow.Cell(1).GetString().Trim();
                var taniumIp = xlRow.Cell(2).GetString().Trim();
                var manufacturer = xlRow.Cell(4).GetString().Trim();
                var model = xlRow.Cell(5).GetString().Trim();
                var cpu = xlRow.Cell(6).GetString().Trim();
                var ram = xlRow.Cell(7).GetString().Trim();
                var size = xlRow.Cell(8).GetString().Trim();

                var isRowEmpty = string.IsNullOrWhiteSpace(computerName) && string.IsNullOrWhiteSpace(taniumIp) &&
                    string.IsNullOrWhiteSpace(manufacturer) && string.IsNullOrWhiteSpace(model) &&
                    string.IsNullOrWhiteSpace(cpu) && string.IsNullOrWhiteSpace(ram) && string.IsNullOrWhiteSpace(size);
                if (isRowEmpty) continue;

                rows.Add(new DeviceConfigurationImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    ComputerName = string.IsNullOrWhiteSpace(computerName) ? null : computerName,
                    TaniumIpAddress = string.IsNullOrWhiteSpace(taniumIp) ? null : taniumIp,
                    Manufacturer = string.IsNullOrWhiteSpace(manufacturer) ? null : manufacturer,
                    Model = string.IsNullOrWhiteSpace(model) ? null : model,
                    Cpu = string.IsNullOrWhiteSpace(cpu) ? null : cpu,
                    Ram = string.IsNullOrWhiteSpace(ram) ? null : ram,
                    Size = string.IsNullOrWhiteSpace(size) ? null : size
                });
            }

            return rows;
        }
    }
}
