using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class IpAddressService : BaseService<IAssetUnitOfWork>, IIpAddressService
    {
        public IpAddressService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<IpAddressDto>> GetPagedAsync(IpAddressFilterRequest request)
        {
            // `Device` is an optional navigation, so the include selector needs `!` to satisfy the
            // repository's Expression<Func<T, object>> signature. EF only reads the expression tree
            // here — nothing is dereferenced, so this cannot throw.
            var query = _unitOfWork.IpAddresses.GetQueryable(false, x => x.Device!, x => x.IpPrefix).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(request.Keyword))
            {
                query = query.Where(x => x.IpAddress1.Contains(request.Keyword)
                    || (x.Note != null && x.Note.Contains(request.Keyword)));
            }

            if (request.Status.HasValue)
            {
                query = query.Where(x => x.Status == request.Status.Value);
            }

            // Lọc theo mức độ sử dụng: đang sử dụng = đã gán (Status != Available), chưa sử dụng
            // = còn trống (Status == Available). Kết hợp AND với filter Status nếu cả hai được gửi.
            if (request.IsInUse.HasValue)
            {
                query = request.IsInUse.Value
                    ? query.Where(x => x.Status != (int)IpAddressStatus.Available)
                    : query.Where(x => x.Status == (int)IpAddressStatus.Available);
            }

            if (request.DeviceId.HasValue)
            {
                query = query.Where(x => x.DeviceId == request.DeviceId.Value);
            }

            // Materialize projected DTOs then sort by numeric IP value + page in memory: ordering
            // by the IpAddress string in SQL is lexicographic ("10.45.1.10" before "10.45.1.2").
            var all = await _unitOfWork.IpAddresses.ToListAsync(
                query,
                x => new IpAddressDto
                {
                    Id = x.Id,
                    IpAddress = x.IpAddress1,
                    DeviceId = x.DeviceId,
                    // Status = AssignedExternal (1) → hiển thị "Khác" (gán cho thiết bị ngoài,
                    // không có DeviceId); Assigned (2) → mã thiết bị thật; Available (0) → null.
                    DeviceCode = x.Status == (int)IpAddressStatus.AssignedExternal ? "Khác"
                        : x.Device != null ? x.Device.DeviceCode : null,
                    IpPrefixId = x.IpPrefixId,
                    Prefix = x.IpPrefix.Prefix,
                    PrefixSubnetMask = x.IpPrefix.SubnetMask,
                    PrefixGateway = x.IpPrefix.Gateway,
                    PrefixPreferredDns = x.IpPrefix.PreferredDns,
                    PrefixAlternateDns = x.IpPrefix.AlternateDns,
                    Status = x.Status,
                    // StatusText không đặt trong projection: đây là Expression<Func<>> được EF dịch
                    // sang SQL nên không gọi được method C#. Gán sau khi materialize để dùng chung
                    // một nguồn text duy nhất (IpAddressStatusExtensions) với các API còn lại.
                    Note = x.Note
                }
            );

            foreach (var item in all)
            {
                item.StatusText = item.Status.GetIpAddressStatusText();
            }

            var ordered = all.OrderBy(x => NetworkHelper.ToSortableKey(x.IpAddress)).ToList();

            var items = ordered
                .Skip((request.PageIndex - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            return new PagedResponse<IpAddressDto>(items, ordered.Count, request.PageIndex, request.PageSize);
        }

        public async Task<List<IpAddressDto>> GetAvailableAsync(string? keyword)
        {
            var normalizedKeyword = string.IsNullOrWhiteSpace(keyword) ? "" : keyword.Trim();

            var ipAddresses = await _unitOfWork.IpAddresses.SelectAsync(
                predicate: x => !x.IsDeleted
                    && x.Status == (int)IpAddressStatus.Available
                    && x.IpAddress1.Contains(normalizedKeyword),
                selector: x => new IpAddressDto
                {
                    Id = x.Id,
                    IpAddress = x.IpAddress1,
                    DeviceId = x.DeviceId,
                    DeviceCode = null,
                    IpPrefixId = x.IpPrefixId,
                    Prefix = x.IpPrefix.Prefix,
                    PrefixSubnetMask = x.IpPrefix.SubnetMask,
                    PrefixGateway = x.IpPrefix.Gateway,
                    PrefixPreferredDns = x.IpPrefix.PreferredDns,
                    PrefixAlternateDns = x.IpPrefix.AlternateDns,
                    Status = x.Status,
                    Note = x.Note
                });

            // Same reason as GetPagedAsync: text is applied after materialization (all rows here are
            // Available, but it still goes through the shared helper so the wording can never drift).
            foreach (var item in ipAddresses)
            {
                item.StatusText = item.Status.GetIpAddressStatusText();
            }

            return ipAddresses.OrderBy(x => NetworkHelper.ToSortableKey(x.IpAddress)).ToList();
        }

        public async Task<IpAddressDto> GetByIdAsync(int id)
        {
            var ipAddress = (await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.Id == id, x => x.Device!, x => x.IpPrefix)).OrThrowNotFound("Địa chỉ IP", id);

            return MapToDto(ipAddress);
        }

        // Không còn CreateAsync/DeleteAsync thủ công cho từng IpAddress (2026-07-11) — IP chỉ
        // sinh hàng loạt qua IpPrefixService.CreateAsync (255 địa chỉ/prefix) và dọn theo qua
        // IpPrefixService.DeleteAsync. UpdateAsync được giữ lại nhưng CHỈ cho đổi Status +
        // Note (không đổi IpAddress/IpPrefix/DeviceId — xem UpdateIpAddressDto).

        public async Task UpdateAsync(UpdateIpAddressDto request)
        {
            var ipAddress = (await _unitOfWork.IpAddresses.GetByIdAsync(request.Id)).OrThrowNotFound("Địa chỉ IP", request.Id);

            // Chỉ cho đổi Status + Note (2026-07-11, quyết định người dùng). Giữ bất biến
            // Status == Assigned(2) ⟺ DeviceId != null:
            // - IP đang gắn thiết bị (DeviceId != null): không cho đổi Status tay (phải gỡ gán
            //   trước), chỉ đổi được Note.
            // - IP chưa gắn (DeviceId == null): chỉ cho đặt Available(0) hoặc AssignedExternal(1),
            //   không cho đặt Assigned(2) vì không có DeviceId.
            if (ipAddress.DeviceId.HasValue)
            {
                if (request.Status != (int)IpAddressStatus.Assigned)
                    throw new DomainException("Địa chỉ IP đang được gán cho thiết bị, vui lòng gỡ gán trước khi đổi trạng thái.");
            }
            else
            {
                if (request.Status != (int)IpAddressStatus.Available && request.Status != (int)IpAddressStatus.AssignedExternal)
                    throw new DomainException($"Chỉ được đặt trạng thái '{IpAddressStatus.Available.GetDisplayText()}' hoặc '{IpAddressStatus.AssignedExternal.GetDisplayText()}' khi địa chỉ IP chưa gắn thiết bị.");

                ipAddress.Status = request.Status;
            }

            ipAddress.Note = request.Note;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        // Bulk status update (2026-07-23): tick several IPs on the grid and switch them all at once.
        // Keeps the same invariant as UpdateAsync (Assigned(2) <=> DeviceId != null) but, instead of
        // failing the whole batch on the first bad row, skips the offending IPs and reports them back
        // (same pattern as DeviceService.BulkDeleteAsync). All rows are saved in ONE SaveChanges so
        // the audit log records a single grouped entry, not one row per IP.
        public async Task<BulkUpdateIpAddressStatusResultDto> BulkUpdateStatusAsync(BulkUpdateIpAddressStatusRequestDto request)
        {
            // Assigned(2) is derived from the assignment, never picked by hand — use assign/unassign.
            if (request.Status != (int)IpAddressStatus.Available && request.Status != (int)IpAddressStatus.AssignedExternal)
                throw new DomainException($"Chỉ được đặt hàng loạt trạng thái '{IpAddressStatus.Available.GetDisplayText()}' hoặc '{IpAddressStatus.AssignedExternal.GetDisplayText()}'. Trạng thái '{IpAddressStatus.Assigned.GetDisplayText()}' do hệ thống tự đặt khi gán thiết bị.");

            var ids = request.Ids.Distinct().ToList();

            // Deliberately NOT Include(x => x.Device): FindAsync tracks the entities and
            // GenericRepository.Update() -> DbSet.Update() marks the whole reachable graph as Modified,
            // so an included Device would be rewritten (and audited) as well. Device codes needed for
            // the skip message are fetched separately below, only for the rows actually skipped.
            var ipAddresses = await _unitOfWork.IpAddresses.FindAsync(x => ids.Contains(x.Id) && !x.IsDeleted);

            var result = new BulkUpdateIpAddressStatusResultDto
            {
                Status = request.Status,
                StatusText = request.Status.GetIpAddressStatusText()
            };

            foreach (var missingId in ids.Where(id => ipAddresses.All(x => x.Id != id)))
            {
                result.SkippedIpAddresses.Add(new BulkUpdateIpAddressStatusSkippedDto
                {
                    Id = missingId,
                    IpAddress = null,
                    Reason = "Địa chỉ IP không tồn tại hoặc đã bị xóa."
                });
            }

            // Only resolve device codes when some of the selected IPs are actually still assigned.
            var assignedDeviceIds = ipAddresses.Where(x => x.DeviceId.HasValue)
                .Select(x => x.DeviceId!.Value)
                .Distinct()
                .ToList();

            var deviceCodes = assignedDeviceIds.Count == 0
                ? new Dictionary<int, string>()
                : (await _unitOfWork.Devices.SelectAsync(
                        d => assignedDeviceIds.Contains(d.Id),
                        d => new { d.Id, d.DeviceCode }))
                    .ToDictionary(d => d.Id, d => d.DeviceCode);

            foreach (var ipAddress in ipAddresses)
            {
                // An IP attached to a device must be unassigned first — the same rule UpdateAsync
                // enforces, except here it only skips this row instead of rejecting the whole batch.
                if (ipAddress.DeviceId.HasValue)
                {
                    var deviceLabel = deviceCodes.TryGetValue(ipAddress.DeviceId.Value, out var code)
                        ? code
                        : $"#{ipAddress.DeviceId}";

                    result.SkippedIpAddresses.Add(new BulkUpdateIpAddressStatusSkippedDto
                    {
                        Id = ipAddress.Id,
                        IpAddress = ipAddress.IpAddress1,
                        Reason = $"Đang gán cho thiết bị {deviceLabel}, vui lòng gỡ gán trước khi đổi trạng thái."
                    });
                    continue;
                }

                ipAddress.Status = request.Status;
                if (request.UpdateNote) ipAddress.Note = request.Note;

                _unitOfWork.IpAddresses.Update(ipAddress);
                result.UpdatedCount++;
            }

            if (result.UpdatedCount > 0)
            {
                await _unitOfWork.SaveChangesAsync();
            }

            return result;
        }

        public async Task AssignToDeviceAsync(int id, AssignIpAddressDto request)
        {
            var ipAddress = (await _unitOfWork.IpAddresses.GetByIdAsync(id)).OrThrowNotFound("Địa chỉ IP", id);

            var device = (await _unitOfWork.Devices.GetByIdAsync(request.DeviceId)).OrThrowNotFound("Thiết bị", request.DeviceId);

            ipAddress.DeviceId = request.DeviceId;
            ipAddress.Status = (int)IpAddressStatus.Assigned;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task UnassignAsync(int id)
        {
            var ipAddress = (await _unitOfWork.IpAddresses.GetByIdAsync(id)).OrThrowNotFound("Địa chỉ IP", id);

            ipAddress.DeviceId = null;
            ipAddress.Status = (int)IpAddressStatus.Available;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        private static IpAddressDto MapToDto(IpAddress ipAddress) => new IpAddressDto
        {
            Id = ipAddress.Id,
            IpAddress = ipAddress.IpAddress1,
            DeviceId = ipAddress.DeviceId,
            // AssignedExternal → "Khác"; Assigned → mã thiết bị thật; Available → null.
            DeviceCode = ipAddress.Status == (int)IpAddressStatus.AssignedExternal ? "Khác" : ipAddress.Device?.DeviceCode,
            IpPrefixId = ipAddress.IpPrefixId,
            Prefix = ipAddress.IpPrefix?.Prefix!,
            PrefixSubnetMask = ipAddress.IpPrefix?.SubnetMask,
            PrefixGateway = ipAddress.IpPrefix?.Gateway,
            PrefixPreferredDns = ipAddress.IpPrefix?.PreferredDns,
            PrefixAlternateDns = ipAddress.IpPrefix?.AlternateDns,
            Status = ipAddress.Status,
            StatusText = ipAddress.Status.GetIpAddressStatusText(),
            Note = ipAddress.Note
        };
    }
}
