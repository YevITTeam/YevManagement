using System.Text.RegularExpressions;
using Asset.Application.Dtos.DeviceConfigurationImports;
using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    // Import cấu hình phần cứng hàng loạt từ file kiểm kê Tanium (Computer Name/Tanium
    // Client IP Address/Last Logged In User/Custom Registry UserEmail/Manufacturer/Model/
    // Computer Serial Number/CPU/Total Memory/Size — format 10 cột). Khác với
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

        private static readonly Regex EmailPattern = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled);
        private const string TaniumEmailNote = "Tanium";
        private const int MaxDomainAccountLength = 150;
        private const int MaxEmailLength = 255;
        private const int MaxDeviceNameLength = 255;
        private const string DomainSuffix = ".yev.vn";

        private readonly IDeviceConfigurationService _deviceConfigurationService;
        private readonly IUserDirectoryService _userDirectoryService;

        public DeviceConfigurationImportService(
            IAssetUnitOfWork unitOfWork,
            IDeviceConfigurationService deviceConfigurationService,
            IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _deviceConfigurationService = deviceConfigurationService;
            _userDirectoryService = userDirectoryService;
        }

        public async Task<DeviceConfigurationImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null)
        {
            var rawRows = CsvFileHelper.HasCsvExtension(fileName) ? ParseCsv(excelFileStream) : ParseXlsx(excelFileStream);
            var (validatedRows, outOfScopeSkippedCount) = await ValidateAndResolveRowsAsync(rawRows);
            await FillAccountStatesAsync(validatedRows);
            return BuildPreviewResult(validatedRows, outOfScopeSkippedCount);
        }

        // Marks each row with what Identity/the directory say about its domain account (read-only).
        // An Identity failure leaves every account as "directory unavailable" instead of failing the preview.
        private async Task FillAccountStatesAsync(List<DeviceConfigurationImportRowDto> rows)
        {
            var accounts = rows.Where(r => r.ResolvedManagerDomainAccount != null).Select(r => r.ResolvedManagerDomainAccount!);
            Dictionary<string, DomainAccountState> stateByAccount;
            try
            {
                stateByAccount = (await _userDirectoryService.ResolveDomainAccountsAsync(accounts))
                    .ToDictionary(x => x.Account, x => x.State, StringComparer.OrdinalIgnoreCase);
            }
            catch
            {
                stateByAccount = new Dictionary<string, DomainAccountState>(StringComparer.OrdinalIgnoreCase);
            }

            foreach (var row in rows.Where(r => r.ResolvedManagerDomainAccount != null))
                row.AccountState = (int)stateByAccount.GetValueOrDefault(row.ResolvedManagerDomainAccount!.Trim(), DomainAccountState.DirectoryUnavailable);
        }

        // Runs after the Asset transaction has committed (Identity is another database), so a failure here
        // never undoes the import; the call is idempotent and can simply be repeated.
        private async Task CreateMissingUsersAsync(List<DeviceConfigurationImportRowDto> rows, DeviceConfigurationImportConfirmResultDto result)
        {
            var accounts = rows.Where(r => r.ResolvedManagerDomainAccount != null).Select(r => r.ResolvedManagerDomainAccount!).ToList();
            IReadOnlyList<DomainAccountInfo> infos;
            try
            {
                infos = await _userDirectoryService.EnsureDomainUsersAsync(accounts);
            }
            catch
            {
                result.UsersFailedCount += accounts.Distinct(StringComparer.OrdinalIgnoreCase).Count();
                return;
            }

            foreach (var info in infos)
            {
                switch (info.State)
                {
                    case DomainAccountState.Created: result.UsersCreatedCount++; break;
                    case DomainAccountState.Disabled:
                    case DomainAccountState.NotInDirectory: result.UsersSkippedCount++; break;
                    case DomainAccountState.DirectoryUnavailable: result.UsersUnavailableCount++; break;
                    case DomainAccountState.Failed: result.UsersFailedCount++; break;
                }
            }
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
                        var assigned = await AssignAvailableIpAsync(deviceId, row.ResolvedIpAddressId.Value);
                        if (assigned) result.IpReassignedCount++;
                    }

                    if (!string.IsNullOrWhiteSpace(row.ResolvedSerialNumber) || !string.IsNullOrWhiteSpace(row.ResolvedManagerDomainAccount)
                        || !string.IsNullOrWhiteSpace(row.ResolvedDeviceName))
                    {
                        var (serialUpdated, accountUpdated, nameUpdated) = await UpdateDeviceFromTaniumAsync(
                            deviceId, row.ResolvedSerialNumber, row.ResolvedManagerDomainAccount, row.ResolvedDeviceName, request.OverwriteExistingAccount);
                        if (nameUpdated) result.DeviceNameUpdatedCount++;
                        if (serialUpdated) result.SerialUpdatedCount++;
                        if (accountUpdated) result.ManagerAccountUpdatedCount++;
                    }

                    if (row.ResolvedEmails.Count > 0)
                        result.EmailAddedCount += await AddMissingDeviceEmailsAsync(deviceId, row.ResolvedEmails);

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

            if (request.CreateMissingUsers)
                await CreateMissingUsersAsync(validatedRows, result);

            return result;
        }

        // Đối chiếu Tanium (2026-07-27, yêu cầu người dùng): so danh sách Device đang Status=InUse
        // trong hệ thống với danh sách máy Tanium vừa quét được trong file này — Tanium chỉ quét
        // được máy đang bật/đang dùng thật sự, nên PendingUse/PendingLiquidation/Liquidated không
        // xuất hiện trong file Tanium là chuyện bình thường, KHÔNG phải sai lệch cần báo cáo.
        // "Đã được Tanium quét thấy" = dòng trong file có Computer Name khớp được 1 Device có thật
        // (ResolvedDeviceId != null), bất kể dòng đó có lỗi ở field khác hay không (VD trùng mã
        // trong file, hoặc lỗi TSE-Error ở 1 cột) — máy vẫn rõ ràng có mặt trong lần quét, không
        // phải "thiếu". Đọc lại file độc lập với Preview/Confirm (không nhận Id/mã từ client) —
        // hành động chỉ đọc nên vẫn parse lại đúng file thay vì tin dữ liệu preview cũ.
        // deviceCodePrefixes (2026-07-27, yêu cầu người dùng): người dùng tự nhập tiền tố mã máy
        // cần đối chiếu (mặc định gợi ý ở FE là YDC/YDF/YLC) — Device ngoài các tiền tố này không
        // thuộc phạm vi Tanium quét nên không được tính là "thiếu", tránh báo sai.
        private async Task<List<DeviceMissingInTaniumDto>> FindMissingDevicesAsync(Stream excelFileStream, string? fileName, IEnumerable<string>? deviceCodePrefixes)
        {
            var rawRows = CsvFileHelper.HasCsvExtension(fileName) ? ParseCsv(excelFileStream) : ParseXlsx(excelFileStream);
            var (validatedRows, _) = await ValidateAndResolveRowsAsync(rawRows);

            var scannedDeviceIds = validatedRows
                .Where(r => r.ResolvedDeviceId.HasValue)
                .Select(r => r.ResolvedDeviceId!.Value)
                .ToHashSet();

            // Tiền tố người dùng nhập (VD "YDC","YDF","YLC") — trim, bỏ rỗng, không phân biệt hoa/thường.
            var prefixes = (deviceCodePrefixes ?? Enumerable.Empty<string>())
                .Select(p => p.Trim())
                .Where(p => p.Length > 0)
                .ToList();

            var query = _unitOfWork.Devices.GetQueryable(false, d => d.Branch, d => d.DeviceType, d => d.DeviceGroup!, d => d.DeviceDepartment!)
                .Where(d => !d.IsDeleted && d.Status == (int)DeviceStatus.InUse);

            if (scannedDeviceIds.Count > 0)
                query = query.Where(d => !scannedDeviceIds.Contains(d.Id));

            // Lấy list IP thô trước (projection dịch được sang SQL), rồi nối chuỗi hiển thị ở bộ nhớ
            // bên dưới — cùng khuôn 2 bước với DeviceService.GetReportListAsync
            // (string.Join trên 1 subquery không dịch được ổn định qua mọi provider).
            var rawDevices = await _unitOfWork.Devices.ToListAsync(
                query.OrderBy(d => d.DeviceCode),
                d => new
                {
                    d.DeviceCode,
                    d.DeviceName,
                    d.SerialNumber,
                    BranchName = d.Branch.BranchName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    GroupName = d.DeviceGroup != null ? d.DeviceGroup.GroupName : null,
                    DepartmentName = d.DeviceDepartment != null ? d.DeviceDepartment.DepartmentName : null,
                    d.Manager,
                    IpAddresses = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).ToList(),
                    d.Note
                });

            if (prefixes.Count > 0)
                rawDevices = rawDevices
                    .Where(d => prefixes.Any(p => d.DeviceCode.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
                    .ToList();

            var missingDevices = rawDevices.Select(d => new DeviceMissingInTaniumDto
            {
                DeviceCode = d.DeviceCode,
                DeviceName = d.DeviceName,
                SerialNumber = d.SerialNumber,
                BranchName = d.BranchName,
                DeviceTypeName = d.DeviceTypeName,
                GroupName = d.GroupName,
                DepartmentName = d.DepartmentName,
                Manager = d.Manager,
                IpAddress = d.IpAddresses.Count > 0 ? string.Join(", ", d.IpAddresses) : null,
                Note = d.Note
            }).ToList();

            return missingDevices;
        }

        public Task<List<DeviceMissingInTaniumDto>> GetMissingDevicesAsync(Stream excelFileStream, string? fileName = null, IEnumerable<string>? deviceCodePrefixes = null)
            => FindMissingDevicesAsync(excelFileStream, fileName, deviceCodePrefixes);

        public async Task<DeviceMissingInTaniumReportDto> BuildMissingDevicesReportAsync(Stream excelFileStream, string? fileName = null, IEnumerable<string>? deviceCodePrefixes = null)
        {
            var missingDevices = await FindMissingDevicesAsync(excelFileStream, fileName, deviceCodePrefixes);

            return new DeviceMissingInTaniumReportDto
            {
                FileContent = BuildMissingDevicesExcel(missingDevices),
                // ASCII-only trên mục đích: filename trong header Content-Disposition mà kèm dấu
                // tiếng Việt phải encode RFC 5987 (filename*=UTF-8''...) mới an toàn — tránh hẳn rắc
                // rối đó bằng cách không dùng ký tự có dấu ở tên file tự sinh.
                FileName = $"BaoCaoDoiChieuTanium_{TimeHelper.GetCurrentUtcTime():yyyyMMdd_HHmm}.xlsx",
                MissingCount = missingDevices.Count
            };
        }

        private static byte[] BuildMissingDevicesExcel(List<DeviceMissingInTaniumDto> devices)
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Thieu trong Tanium");

            string[] headers =
            {
                "STT", "Mã máy", "Tên máy", "Số seri", "Chi nhánh", "Loại thiết bị",
                "Nhóm", "Bộ phận", "Người quản lý", "Địa chỉ IP", "Ghi chú"
            };
            for (var col = 0; col < headers.Length; col++)
            {
                worksheet.Cell(1, col + 1).Value = headers[col];
            }
            worksheet.Row(1).Style.Font.Bold = true;
            worksheet.Row(1).Style.Fill.BackgroundColor = XLColor.FromHtml("#EFEFEF");

            for (var i = 0; i < devices.Count; i++)
            {
                var device = devices[i];
                var row = i + 2;
                worksheet.Cell(row, 1).Value = i + 1;
                worksheet.Cell(row, 2).Value = device.DeviceCode;
                worksheet.Cell(row, 3).Value = device.DeviceName;
                worksheet.Cell(row, 4).Value = device.SerialNumber ?? string.Empty;
                worksheet.Cell(row, 5).Value = device.BranchName;
                worksheet.Cell(row, 6).Value = device.DeviceTypeName;
                worksheet.Cell(row, 7).Value = device.GroupName ?? string.Empty;
                worksheet.Cell(row, 8).Value = device.DepartmentName ?? string.Empty;
                worksheet.Cell(row, 9).Value = device.Manager;
                worksheet.Cell(row, 10).Value = device.IpAddress ?? string.Empty;
                worksheet.Cell(row, 11).Value = device.Note ?? string.Empty;
            }

            worksheet.SheetView.FreezeRows(1);
            worksheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        // Adds the Tanium IP to the device (other IPs of the device are kept). Re-checks that the IP
        // is still Available at write time and skips it otherwise. Returns true when it was assigned.
        private async Task<bool> AssignAvailableIpAsync(int deviceId, int newIpAddressId)
        {
            var ip = await _unitOfWork.IpAddresses.GetByIdAsync(newIpAddressId);
            if (ip == null || ip.DeviceId.HasValue || ip.Status != (int)IpAddressStatus.Available) return false;

            ip.DeviceId = deviceId;
            ip.Status = (int)IpAddressStatus.Assigned;
            _unitOfWork.IpAddresses.Update(ip);

            return true;
        }

        // The serial was checked at validate time to belong to no other device, so it overwrites the old value.
        // The domain account is filled while the device has none; an existing one is replaced only on overwrite.
        private async Task<(bool SerialUpdated, bool AccountUpdated, bool NameUpdated)> UpdateDeviceFromTaniumAsync(
            int deviceId, string? serialNumber, string? domainAccount, string? deviceName, bool overwriteAccount)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
            if (device == null) return (false, false, false);

            var nameUpdated = !string.IsNullOrWhiteSpace(deviceName) && device.DeviceName != deviceName;
            var serialUpdated = !string.IsNullOrWhiteSpace(serialNumber) && device.SerialNumber != serialNumber;
            var accountUpdated = !string.IsNullOrWhiteSpace(domainAccount) && (string.IsNullOrWhiteSpace(device.ManagerDomainAccount)
                || (overwriteAccount && !device.ManagerDomainAccount.Equals(domainAccount, StringComparison.OrdinalIgnoreCase)));
            if (!serialUpdated && !accountUpdated && !nameUpdated) return (false, false, false);

            if (nameUpdated) device.DeviceName = deviceName!;
            if (serialUpdated) device.SerialNumber = serialNumber;
            if (accountUpdated) device.ManagerDomainAccount = domainAccount;
            _unitOfWork.Devices.Update(device);

            return (serialUpdated, accountUpdated, nameUpdated);
        }

        // Adds the addresses the device does not have yet (case-insensitive), including ones deleted earlier.
        // Never removes or edits existing emails, since Tanium may miss addresses that were typed by hand.
        private async Task<int> AddMissingDeviceEmailsAsync(int deviceId, IEnumerable<string> emails)
        {
            var existing = (await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == deviceId && !x.IsDeleted))
                .Select(x => x.Email)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var added = 0;
            foreach (var email in emails)
            {
                if (!existing.Add(email)) continue;
                await _unitOfWork.DeviceEmails.AddAsync(new DeviceEmail
                {
                    DeviceId = deviceId,
                    Email = email,
                    Note = TaniumEmailNote,
                    IsDeleted = false
                });
                added++;
            }

            return added;
        }

        private async Task<(List<DeviceConfigurationImportRowDto> Rows, int OutOfScopeSkippedCount)> ValidateAndResolveRowsAsync(List<DeviceConfigurationImportRowDto> rawRows)
        {
            var duplicatedCodesInFile = rawRows
                .Select(r => ParseComputerName(r.ComputerName ?? string.Empty))
                .Where(c => c != null)
                .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // Cùng 1 serial xuất hiện ở nhiều dòng → không dòng nào được ghi serial (unique index sẽ
            // làm hỏng cả transaction ở bước Confirm). Chỉ Warning, không chặn dòng.
            var duplicatedSerialsInFile = rawRows
                .Select(r => r.SerialNumber?.Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .GroupBy(s => s!, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // Batch-fetch device/IP/serial lookups thay vì query từng dòng: file Tanium export có thể
            // lên tới hàng nghìn dòng, mỗi dòng trước đây bắn 3 query riêng (device theo mã, IP theo
            // taniumIp, device theo serial) → hàng nghìn round-trip DB tuần tự (2026-08-11, xem
            // AGENTS.md §hiệu năng). Gom về 3 query duy nhất bằng `Contains` (SQL IN), dựng Dictionary
            // để tra trong bộ nhớ — kết quả nghiệp vụ giữ nguyên (collation SQL vẫn không phân biệt
            // hoa/thường như query cũ, GroupBy...First giữ đúng 1 bản ghi/khoá khi trùng mã ngoài ý muốn).
            var candidateCodes = rawRows
                .Select(r => ParseComputerName(r.ComputerName ?? string.Empty))
                .Where(c => c != null)
                .Select(c => c!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var devicesByCode = (await _unitOfWork.Devices.FindAsync(x => candidateCodes.Contains(x.DeviceCode) && !x.IsDeleted))
                .GroupBy(x => x.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var candidateIps = rawRows
                .Select(r => r.TaniumIpAddress?.Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ipsByAddress = (await _unitOfWork.IpAddresses.FindAsync(x => candidateIps.Contains(x.IpAddress1) && !x.IsDeleted))
                .GroupBy(x => x.IpAddress1, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
            var duplicatedIpsInFile = rawRows
                .Select(r => r.TaniumIpAddress?.Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .GroupBy(s => s!, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ipOwnerIds = ipsByAddress.Values
                .Where(x => x.DeviceId.HasValue)
                .Select(x => x.DeviceId!.Value)
                .ToHashSet();
            var ipOwnerCodesById = (await _unitOfWork.Devices.FindAsync(x => ipOwnerIds.Contains(x.Id)))
                .ToDictionary(x => x.Id, x => x.DeviceCode);

            var candidateSerials = rawRows
                .Select(r => r.SerialNumber?.Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var devicesBySerial = (await _unitOfWork.Devices.FindAsync(x => candidateSerials.Contains(x.SerialNumber!)))
                .GroupBy(x => x.SerialNumber!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var result = new List<DeviceConfigurationImportRowDto>();
            var outOfScopeSkippedCount = 0;

            foreach (var row in rawRows)
            {
                var parsedCode = ParseComputerName(row.ComputerName ?? string.Empty);
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
                    errors.Add("Dòng bị lỗi Tanium (không thu thập được dữ liệu).");
                }

                int? resolvedDeviceId = null;
                if (duplicatedCodesInFile.Contains(parsedCode))
                    errors.Add($"Mã '{parsedCode}' lặp trong file.");

                var device = devicesByCode.GetValueOrDefault(parsedCode);
                if (device == null) errors.Add($"Không có thiết bị mã '{parsedCode}'.");
                else resolvedDeviceId = device.Id;
                var isLiquidated = device != null && device.Status.IsLiquidationStatus();

                // Tanium IP is only assigned when it is still Available. An IP in use (another
                // device, or an external device) is never taken over; those cases and unknown or
                // duplicated IPs are warnings that skip the IP but keep the row.
                int? resolvedIpAddressId = null;
                var warnings = new List<string>();
                var taniumIp = row.TaniumIpAddress?.Trim();
                if (!string.IsNullOrWhiteSpace(taniumIp) && !errors.Any(e => e.StartsWith("Dòng bị lỗi Tanium")))
                {
                    var ipAddress = ipsByAddress.GetValueOrDefault(taniumIp);
                    if (isLiquidated)
                    {
                        warnings.Add("Máy chờ thanh lý/đã thanh lý — không gán IP.");
                    }
                    else if (ipAddress == null)
                    {
                        warnings.Add($"IP {taniumIp} chưa có trong hệ thống.");
                    }
                    else if (ipAddress.DeviceId.HasValue && ipAddress.DeviceId == resolvedDeviceId)
                    {
                        // Already attached to this device, nothing to do.
                    }
                    else if (duplicatedIpsInFile.Contains(taniumIp))
                    {
                        warnings.Add($"IP {taniumIp} lặp trong file.");
                    }
                    else if (ipAddress.DeviceId.HasValue)
                    {
                        var ownerCode = ipOwnerCodesById.GetValueOrDefault(ipAddress.DeviceId.Value) ?? $"#{ipAddress.DeviceId}";
                        warnings.Add($"IP {taniumIp} đang thuộc máy {ownerCode}.");
                    }
                    else if (ipAddress.Status != (int)IpAddressStatus.Available)
                    {
                        warnings.Add($"IP {taniumIp} đang do thiết bị ngoài dùng.");
                    }
                    else
                    {
                        resolvedIpAddressId = ipAddress.Id;
                    }
                }

                // Serial number (cột "Computer Serial Number", format mới 2026-07-23): ghi vào
                // Device.SerialNumber. SerialNumber là unique-khi-có trong DB nên nếu số này đang
                // thuộc về 1 Device KHÁC thì chỉ Warning + bỏ qua việc ghi serial (không chặn
                // dòng — cấu hình vẫn cập nhật bình thường), cùng triết lý với quy tắc IP ở trên.
                string? resolvedSerialNumber = null;
                var serialNumber = row.SerialNumber?.Trim();
                if (!string.IsNullOrWhiteSpace(serialNumber) && !errors.Any(e => e.StartsWith("Dòng bị lỗi Tanium")))
                {
                    var deviceOwningSerial = devicesBySerial.GetValueOrDefault(serialNumber);
                    if (IsPlaceholderSerial(serialNumber))
                    {
                        warnings.Add($"Serial {serialNumber} là giá trị mặc định BIOS.");
                    }
                    else if (duplicatedSerialsInFile.Contains(serialNumber))
                    {
                        warnings.Add($"Serial {serialNumber} lặp trong file.");
                    }
                    else if (deviceOwningSerial != null && deviceOwningSerial.Id != resolvedDeviceId)
                    {
                        warnings.Add($"Serial {serialNumber} đang thuộc máy {deviceOwningSerial.DeviceCode}.");
                    }
                    else
                    {
                        resolvedSerialNumber = serialNumber;
                    }
                }

                // Last logged-in user and email cell: both optional, never block the row.
                string? resolvedManagerDomainAccount = null;
                var resolvedEmails = new List<string>();
                if (!errors.Any(e => e.StartsWith("Dòng bị lỗi Tanium")))
                {
                    resolvedManagerDomainAccount = ResolveDomainAccount(row.LastLoggedInUser, row.ComputerName);
                    if (resolvedManagerDomainAccount != null && resolvedManagerDomainAccount.Length > MaxDomainAccountLength)
                    {
                        warnings.Add($"Tài khoản {resolvedManagerDomainAccount} quá dài.");
                        resolvedManagerDomainAccount = null;
                    }
                    else if (resolvedManagerDomainAccount != null && !string.IsNullOrWhiteSpace(device?.ManagerDomainAccount)
                        && !device.ManagerDomainAccount.Equals(resolvedManagerDomainAccount, StringComparison.OrdinalIgnoreCase))
                    {
                        warnings.Add($"Máy đã có tài khoản {device.ManagerDomainAccount} (tích \"Ghi đè\" để đổi).");
                    }

                    var (validEmails, invalidEmails) = ParseEmails(row.UserEmail);
                    resolvedEmails = validEmails;
                    foreach (var invalid in invalidEmails)
                        warnings.Add($"Email {invalid} không hợp lệ.");
                }

                // The device name is the Computer Name column without the ".yev.vn" domain suffix.
                string? resolvedDeviceName = null;
                var computerName = row.ComputerName?.Trim();
                if (computerName != null && computerName.EndsWith(DomainSuffix, StringComparison.OrdinalIgnoreCase))
                    computerName = computerName[..^DomainSuffix.Length];
                if (!string.IsNullOrEmpty(computerName) && !errors.Any(e => e.StartsWith("Dòng bị lỗi Tanium")))
                {
                    if (computerName.Length > MaxDeviceNameLength) warnings.Add("Computer Name quá dài, không đổi tên máy.");
                    else resolvedDeviceName = computerName;
                }

                result.Add(new DeviceConfigurationImportRowDto
                {
                    RowNumber = row.RowNumber,
                    ComputerName = row.ComputerName,
                    TaniumIpAddress = taniumIp,
                    LastLoggedInUser = row.LastLoggedInUser,
                    UserEmail = row.UserEmail,
                    Manufacturer = row.Manufacturer,
                    Model = row.Model,
                    SerialNumber = serialNumber,
                    Cpu = row.Cpu,
                    Ram = row.Ram,
                    Size = row.Size,
                    ParsedDeviceCode = parsedCode,
                    ResolvedDeviceName = resolvedDeviceName,
                    ResolvedDeviceId = resolvedDeviceId,
                    ResolvedIpAddressId = resolvedIpAddressId,
                    ResolvedSerialNumber = resolvedSerialNumber,
                    ResolvedManagerDomainAccount = resolvedManagerDomainAccount,
                    ResolvedEmails = resolvedEmails,
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
                HasTaniumErrorPrefix(row.Model) || HasTaniumErrorPrefix(row.SerialNumber) ||
                HasTaniumErrorPrefix(row.Cpu) || HasTaniumErrorPrefix(row.Ram) || HasTaniumErrorPrefix(row.Size) ||
                HasTaniumErrorPrefix(row.LastLoggedInUser) || HasTaniumErrorPrefix(row.UserEmail);
        }

        private static readonly string[] NonDomainPrefixes = { "Local", "AzureAD", "MicrosoftAccount", "WORKGROUP" };

        // Firmware placeholders that are not real serial numbers.
        private static readonly string[] PlaceholderSerials =
        {
            "to be filled by o.e.m.", "to be filled by oem", "default string", "system serial number", "none", "n/a",
            "na", "unknown", "not specified", "not applicable", "o.e.m.", "oem", "123456789", "0123456789"
        };
        private static readonly Regex RepeatedCharPattern = new(@"^(.)\1*$", RegexOptions.Compiled);

        private static bool IsPlaceholderSerial(string serial) =>
            serial.Length < 4 || PlaceholderSerials.Contains(serial, StringComparer.OrdinalIgnoreCase) || RepeatedCharPattern.IsMatch(serial);

        // A domain account is DOMAIN\user. Local/system/cloud accounts (Local\user, NT AUTHORITY\SYSTEM, AzureAD\x,
        // machine$, the machine's own name as the domain part) are not accounts Identity can match, so they are not stored.
        private static string? ResolveDomainAccount(string? lastLoggedInUser, string? computerName)
        {
            var value = lastLoggedInUser?.Trim();
            if (string.IsNullOrEmpty(value)) return null;

            var slash = value.IndexOf('\\');
            if (slash <= 0 || slash == value.Length - 1) return null;

            var prefix = value[..slash];
            if (prefix.Contains(' ') || NonDomainPrefixes.Contains(prefix, StringComparer.OrdinalIgnoreCase)) return null;
            if (value.EndsWith('$')) return null;

            var host = computerName?.Trim().Split('.')[0];
            if (!string.IsNullOrEmpty(host) && prefix.Equals(host, StringComparison.OrdinalIgnoreCase)) return null;

            return value;
        }

        // The cell holds zero or more addresses separated by line breaks, ';', ',' or spaces; [NOT_FOUND] means none.
        private static (List<string> Valid, List<string> Invalid) ParseEmails(string? raw)
        {
            var valid = new List<string>();
            var invalid = new List<string>();
            if (string.IsNullOrWhiteSpace(raw)) return (valid, invalid);

            var tokens = raw.Split(new[] { '\r', '\n', ';', ',', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var token in tokens)
            {
                if (token.Equals("[NOT_FOUND]", StringComparison.OrdinalIgnoreCase)) continue;

                if (token.Length > MaxEmailLength || !EmailPattern.IsMatch(token))
                    invalid.Add(token);
                else if (!valid.Contains(token, StringComparer.OrdinalIgnoreCase))
                    valid.Add(token.ToLowerInvariant());
            }

            return (valid, invalid);
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

        // Device code from a Computer Name, or null when the name is outside the 5 imported families
        // (the row is then skipped silently). The domain suffix after the first "." is dropped.
        // YDC/YLC/YDF/TYC + digits: the code puts "-" between letters and digits (YDC1877 -> YDC-1877).
        // AC + digits + optional letter: the code is the first two "-" segments (AC90B-2446).
        private static string? ParseComputerName(string rawComputerName)
        {
            var name = rawComputerName.Trim();
            var dotIndex = name.IndexOf('.');
            if (dotIndex >= 0) name = name[..dotIndex];

            var segments = name.Split('-', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) return null;

            var firstSegment = segments[0];

            var standardPrefix = StandardFamilyPrefixes.FirstOrDefault(p =>
                firstSegment.StartsWith(p, StringComparison.OrdinalIgnoreCase) &&
                firstSegment[p.Length..].All(char.IsDigit));
            if (standardPrefix != null)
            {
                var digits = firstSegment[standardPrefix.Length..];
                return digits.Length > 0 ? $"{standardPrefix}-{digits}" : standardPrefix;
            }

            if (AcFamilyPattern.IsMatch(firstSegment))
            {
                return segments.Length > 1 ? $"{segments[0]}-{segments[1]}" : segments[0];
            }

            return null;
        }

        // Fixed columns in the order of the Tanium inventory file (10 columns, row 1 is the header):
        // A=Computer Name, B=Tanium Client IP Address, C=Last Logged In User, D=Custom Registry
        // UserEmail, E=Manufacturer, F=Model, G=Computer Serial Number, H=CPU, I=Total Memory
        // (maps to Ram), J=Size. Files in an older layout shift the columns and must be re-exported.
        private static List<DeviceConfigurationImportRowDto> ParseXlsx(Stream stream)
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
                // ra ngoài thành lỗi 500 chung chung qua HandleExceptionMiddleware. Đây
                // chính là nguyên nhân bug thật gặp phải: file Tanium xuất ra thực chất là
                // .csv nhưng bị đổi đuôi/hiểu nhầm là .xlsx.
                throw new DomainException("File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx hoặc .csv).");
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<DeviceConfigurationImportRowDto>();
            if (usedRange == null) return rows;

            var dataRows = usedRange.RowsUsed().ToList();
            EnsureHeaderLayout(Enumerable.Range(1, 10).Select(i => dataRows[0].Cell(i).GetString()).ToArray());

            foreach (var xlRow in dataRows.Skip(1))
            {
                var computerName = xlRow.Cell(1).GetString().Trim();
                var taniumIp = xlRow.Cell(2).GetString().Trim();
                var lastLoggedInUser = xlRow.Cell(3).GetString().Trim();
                var userEmail = xlRow.Cell(4).GetString().Trim();
                var manufacturer = xlRow.Cell(5).GetString().Trim();
                var model = xlRow.Cell(6).GetString().Trim();
                var serialNumber = xlRow.Cell(7).GetString().Trim();
                var cpu = xlRow.Cell(8).GetString().Trim();
                var ram = xlRow.Cell(9).GetString().Trim();
                var size = xlRow.Cell(10).GetString().Trim();

                var isRowEmpty = string.IsNullOrWhiteSpace(computerName) && string.IsNullOrWhiteSpace(taniumIp) &&
                    string.IsNullOrWhiteSpace(lastLoggedInUser) && string.IsNullOrWhiteSpace(userEmail) &&
                    string.IsNullOrWhiteSpace(manufacturer) && string.IsNullOrWhiteSpace(model) &&
                    string.IsNullOrWhiteSpace(serialNumber) &&
                    string.IsNullOrWhiteSpace(cpu) && string.IsNullOrWhiteSpace(ram) && string.IsNullOrWhiteSpace(size);
                if (isRowEmpty) continue;

                rows.Add(new DeviceConfigurationImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    ComputerName = string.IsNullOrWhiteSpace(computerName) ? null : computerName,
                    TaniumIpAddress = string.IsNullOrWhiteSpace(taniumIp) ? null : taniumIp,
                    LastLoggedInUser = string.IsNullOrWhiteSpace(lastLoggedInUser) ? null : lastLoggedInUser,
                    UserEmail = string.IsNullOrWhiteSpace(userEmail) ? null : userEmail,
                    Manufacturer = string.IsNullOrWhiteSpace(manufacturer) ? null : manufacturer,
                    Model = string.IsNullOrWhiteSpace(model) ? null : model,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
                    Cpu = string.IsNullOrWhiteSpace(cpu) ? null : cpu,
                    Ram = string.IsNullOrWhiteSpace(ram) ? null : ram,
                    Size = NormalizeSize(size)
                });
            }

            return rows;
        }

        // Several disks arrive as line breaks or glued units ("238 GB238 GB"); join them with "; ".
        private static string? NormalizeSize(string size)
        {
            var glued = Regex.Replace(size, @"(?<=[KMGT]?B)(?=\d)", "\n", RegexOptions.IgnoreCase);
            var parts = glued.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return parts.Length == 0 ? null : string.Join("; ", parts);
        }

        // Same columns as ParseXlsx, read from a .csv (delimiter auto-detected by CsvFileHelper).
        private static List<DeviceConfigurationImportRowDto> ParseCsv(Stream stream)
        {
            var csvRows = CsvFileHelper.ReadRows(stream);
            var rows = new List<DeviceConfigurationImportRowDto>();
            if (csvRows.Count == 0) return rows;
            EnsureHeaderLayout(Enumerable.Range(0, 10).Select(i => GetCsvCell(csvRows[0], i)).ToArray());

            for (int i = 1; i < csvRows.Count; i++)
            {
                var cells = csvRows[i];
                var computerName = GetCsvCell(cells, 0);
                var taniumIp = GetCsvCell(cells, 1);
                var lastLoggedInUser = GetCsvCell(cells, 2);
                var userEmail = GetCsvCell(cells, 3);
                var manufacturer = GetCsvCell(cells, 4);
                var model = GetCsvCell(cells, 5);
                var serialNumber = GetCsvCell(cells, 6);
                var cpu = GetCsvCell(cells, 7);
                var ram = GetCsvCell(cells, 8);
                var size = GetCsvCell(cells, 9);

                var isRowEmpty = string.IsNullOrWhiteSpace(computerName) && string.IsNullOrWhiteSpace(taniumIp) &&
                    string.IsNullOrWhiteSpace(lastLoggedInUser) && string.IsNullOrWhiteSpace(userEmail) &&
                    string.IsNullOrWhiteSpace(manufacturer) && string.IsNullOrWhiteSpace(model) &&
                    string.IsNullOrWhiteSpace(serialNumber) &&
                    string.IsNullOrWhiteSpace(cpu) && string.IsNullOrWhiteSpace(ram) && string.IsNullOrWhiteSpace(size);
                if (isRowEmpty) continue;

                rows.Add(new DeviceConfigurationImportRowDto
                {
                    RowNumber = i + 1,
                    ComputerName = string.IsNullOrWhiteSpace(computerName) ? null : computerName,
                    TaniumIpAddress = string.IsNullOrWhiteSpace(taniumIp) ? null : taniumIp,
                    LastLoggedInUser = string.IsNullOrWhiteSpace(lastLoggedInUser) ? null : lastLoggedInUser,
                    UserEmail = string.IsNullOrWhiteSpace(userEmail) ? null : userEmail,
                    Manufacturer = string.IsNullOrWhiteSpace(manufacturer) ? null : manufacturer,
                    Model = string.IsNullOrWhiteSpace(model) ? null : model,
                    SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber,
                    Cpu = string.IsNullOrWhiteSpace(cpu) ? null : cpu,
                    Ram = string.IsNullOrWhiteSpace(ram) ? null : ram,
                    Size = NormalizeSize(size)
                });
            }

            return rows;
        }

        // Rejects a file whose header does not follow the 10-column layout, so an older 9-column export
        // cannot shift every value into the wrong field (e.g. the CPU text landing in the serial).
        private static void EnsureHeaderLayout(string[] header)
        {
            bool Is(int index, string keyword) => header[index].Contains(keyword, StringComparison.OrdinalIgnoreCase);

            if (!(Is(0, "computer name") && Is(2, "logged") && Is(3, "email") && Is(6, "serial") && Is(7, "cpu") && Is(8, "memory")))
                throw new DomainException(
                    "File không đúng định dạng 10 cột: Computer Name, Tanium Client IP Address, Last Logged In User, " +
                    "Custom Registry UserEmail, Manufacturer, Model, Computer Serial Number, CPU, Total Memory, Size. " +
                    "Vui lòng xuất lại file từ Tanium hoặc tải file mẫu.");
        }

        private static string GetCsvCell(string[] cells, int index) => index < cells.Length ? cells[index] : string.Empty;
    }
}
